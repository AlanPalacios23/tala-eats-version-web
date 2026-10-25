#!/usr/bin/env bash
# UI-only atomic update of an already installed Tala Eats PWA.
# Does not modify/reload nginx.service, cloudflared, PM2, PostgreSQL or Stripe.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="\${1:-}"; SHA="\${2:-}"; APPROVAL="\${3:-}"
if [[ ! "$MODE" =~ ^--(plan|apply)$ || ! "$SHA" =~ ^[a-f0-9]{40}$ ||
    ( "$MODE" == --plan && "$#" != 2 ) ||
    ( "$MODE" == --apply && "$#" != 3 ) ]];then
 echo 'USAGE: bash deploy/kali-update-pwa-static.sh --plan|--apply SHA [I_APPROVE_STATIC_PWA_ONLY]'
 exit 2
fi
[[ "$MODE" == --plan || "$APPROVAL" == I_APPROVE_STATIC_PWA_ONLY ]] || {
 echo 'PWA_UPDATE_ABORT=APPROVAL_REQUIRED';exit 2;
}
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || {
 echo 'PWA_UPDATE_ABORT=SUDO_REQUIRED';exit 2;
}
SRC="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SRC/dist"
ROOT="/srv/talaeats-pwa"
RELEASES="$ROOT/releases"
NEW="$RELEASES/$SHA"
CURRENT="$ROOT/current"
SITE_HOST="web-talaeats.alan-palacios-dev.com"
LOCAL="http://127.0.0.1:18195"
SERVICE="talaeats-web-pwa.service"

[[ -d "$SRC" && -d "$DIST" && ! -L "$SRC" && ! -L "$DIST" ]] || {
 echo 'PWA_UPDATE_ABORT=SOURCE_OR_BUILD_NOT_FOUND';exit 1
}
[[ "$(git -c safe.directory="$SRC" -C "$SRC" rev-parse HEAD 2>/dev/null)" == "$SHA" &&
    -z "$(git -c safe.directory="$SRC" -C "$SRC" status --porcelain --untracked-files=no)" ]] || {
 echo 'PWA_UPDATE_ABORT=SHA_MISMATCH_OR_DIRTY_SOURCE';exit 1
}
for file in index.html sw.js offline.html manifest.webmanifest \
 manifest-clientes.webmanifest manifest-restaurante.webmanifest \
 manifest-repartidor.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$file" ]] || {
  echo "PWA_UPDATE_ABORT=MISSING_BUILD:$file";exit 1
 }
done
if find "$DIST" -type l -print -quit | grep -q .;then
 echo 'PWA_UPDATE_ABORT=SYMLINKS_IN_DIST';exit 1
fi
if find "$DIST" -type f \( -name '.env*' -o -name '*.pem' -o -name '*.key' \) -print -quit | grep -q .;then
 echo 'PWA_UPDATE_ABORT=SECRET_LIKE_BUILD_ASSETS';exit 1
fi
systemctl is-active --quiet "$SERVICE" || {
 echo 'PWA_UPDATE_ABORT=EXISTING_PWA_SERVICE_INACTIVE';exit 1
}
[[ -L "$CURRENT" && -d "$RELEASES" ]] || {
 echo 'PWA_UPDATE_ABORT=NO_INSTALLED_CURRENT_RELEASE';exit 1
}
OLD="$(readlink -f -- "$CURRENT")"
[[ "$OLD" == "$RELEASES/"* && -d "$OLD" && -s "$OLD/index.html" ]] || {
 echo 'PWA_UPDATE_ABORT=UNEXPECTED_OLD_RELEASE';exit 1
}
[[ ! -e "$NEW" && ! -L "$NEW" ]] || {
 echo 'PWA_UPDATE_ABORT=RELEASE_ALREADY_EXISTS_REVIEW';exit 1
}
curl -fsS --max-time 8 -H "Host: $SITE_HOST" "$LOCAL/api/v1/health" |
 python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("version")!="rc8.13-unified-live" or d.get("production") is not True:
 raise SystemExit("PWA_UPDATE_ABORT=LIVE_BACKEND_MISMATCH")
print("PWA_UPDATE_LIVE_BACKEND=PASS")
'
nginx -t -c /etc/talaeats-web-pwa/nginx.conf >/dev/null 2>&1 || {
 echo 'PWA_UPDATE_ABORT=ISOLATED_NGINX_SYNTAX_FAILED';exit 1
}
if [[ "$MODE" == --plan ]];then
 echo "PWA_UPDATE_OLD=$OLD"
 echo "PWA_UPDATE_NEW=$NEW"
 echo 'PWA_UPDATE_PLAN=PASS_READ_ONLY'
 echo 'PWA_UPDATE_UNRELATED_SERVICES=UNTOUCHED'
 exit 0
fi

NEXT_LINK="$ROOT/.current-next-$SHA"
ROLLBACK_LINK="$ROOT/.current-rollback-$SHA"
[[ ! -e "$NEXT_LINK" && ! -L "$NEXT_LINK" && ! -e "$ROLLBACK_LINK" && ! -L "$ROLLBACK_LINK" ]] || {
 echo 'PWA_UPDATE_ABORT=TEMP_LINK_COLLISION';exit 1
}
SWITCHED=no
trap 'code=$?; trap - EXIT;
  if [[ "$code" != 0 ]];then
    echo "PWA_UPDATE_ROLLBACK=START"
    if [[ "$SWITCHED" == yes ]];then
       ln -s "$OLD" "$ROLLBACK_LINK" && mv -Tf "$ROLLBACK_LINK" "$CURRENT" || true
    fi
    rm -f -- "$NEXT_LINK" "$ROLLBACK_LINK"
    if [[ -d "$NEW" ]];then rm -rf -- "$NEW";fi
    echo "PWA_UPDATE_ROLLBACK=ATTEMPTED"
  fi; exit "$code"' EXIT
mkdir -m 755 "$NEW"
cp -a -- "$DIST/." "$NEW/"
chmod -R a+rX,go-w "$NEW"
ln -s "$NEW" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT"
SWITCHED=yes
for route in / /clientes /buscar /restaurante /repartidor;do
 curl -fsS --max-time 8 -H "Host: $SITE_HOST" "$LOCAL$route" |
  grep -q '<div id="root">' || {
    echo "PWA_UPDATE_ABORT=ROUTE_UNAVAILABLE:$route";exit 1
  }
done
curl -fsS --max-time 8 -H "Host: $SITE_HOST" "$LOCAL/api/v1/health" |
  python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("version")!="rc8.13-unified-live" or d.get("production") is not True:
 raise SystemExit("PWA_UPDATE_ABORT=BACKEND_AFTER_SWITCH_FAILED")
print("PWA_UPDATE_API_AFTER_SWITCH=PASS")
'
trap - EXIT
echo "PWA_UPDATE_STATIC_SITE=PASS"
echo "PWA_UPDATE_CURRENT_SHA=$SHA"
echo "PWA_UPDATE_ROLLBACK_RELEASE=$OLD"
echo 'PWA_UPDATE_NGINX_CLOUDFLARED_STRIPE_PM2=UNMODIFIED'
