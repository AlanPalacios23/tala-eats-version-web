#!/usr/bin/env bash
# First-time TALA EATS PWA installation: NEW static Nginx site on 127.0.0.1:18195.
# No LIVE PM2 restart, no database/Stripe changes, no Cloudflared editing.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="${1:-}"; SHA="${2:-}"; APPROVAL="${3:-}"
if [[ ! "$MODE" =~ ^--(plan|apply)$ || ! "$SHA" =~ ^[a-f0-9]{40}$ ||
     ( "$MODE" == --plan && "$#" -ne 2 ) ||
     ( "$MODE" == --apply && "$#" -ne 3 ) ]]; then
 echo 'USAGE: bash deploy/kali-install-pwa.sh --plan|--apply 40_CHAR_SHA [I_APPROVE_NEW_PWA_NGINX_SITE_ONLY]'
 exit 2
fi
[[ "$MODE" == --plan || "$APPROVAL" == I_APPROVE_NEW_PWA_NGINX_SITE_ONLY ]] || {
 echo 'PWA_INSTALL_ABORT=EXPLICIT_APPROVAL_REQUIRED';exit 2;
}
if [[ "$MODE" == --apply && "$(id -u)" != 0 ]];then
 echo 'PWA_INSTALL_ABORT=ROOT_REQUIRED_FOR_STATIC_SITE_INSTALL';exit 1
fi
SRC="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SRC/dist"
CONF="$SRC/deploy/nginx-web-talaeats.conf"
DEST="/srv/talaeats-pwa"
RELEASE="$DEST/releases/$SHA"
CURRENT="$DEST/current"
SITE="/etc/nginx/sites-available/tala-eats-web-pwa.conf"
ENABLED="/etc/nginx/sites-enabled/tala-eats-web-pwa.conf"
[[ -d "$SRC" && -d "$DIST" && -f "$CONF" && ! -L "$SRC" && ! -L "$DIST" ]] || {
 echo 'PWA_INSTALL_ABORT=RELEASE_SOURCE_MISSING';exit 1;
}
for file in index.html sw.js offline.html manifest.webmanifest \
 manifest-clientes.webmanifest manifest-restaurante.webmanifest \
 manifest-repartidor.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$file" ]] || { echo "PWA_INSTALL_ABORT=STATIC_ASSET_MISSING:$file";exit 1; }
done
if find "$DIST" -type l -print -quit | grep -q .;then
 echo 'PWA_INSTALL_ABORT=DIST_SYMLINKS_NOT_ALLOWED';exit 1
fi
[[ "$(git -c safe.directory="$SRC" -C "$SRC" rev-parse HEAD 2>/dev/null)" == "$SHA" &&
   -z "$(git -c safe.directory="$SRC" -C "$SRC" status --porcelain --untracked-files=no)" ]] || {
 echo 'PWA_INSTALL_ABORT=CHECKOUT_SHA_OR_DIRTY';exit 1;
}
[[ -z "$(find "$DIST" -type f \( -name '.env*' -o -name '*.pem' -o -name '*.key' \) -print -quit)" ]] || {
 echo 'PWA_INSTALL_ABORT=SECRET_LIKE_FILES_IN_DIST';exit 1
}
command -v nginx >/dev/null && command -v curl >/dev/null && command -v python3 >/dev/null || {
 echo 'PWA_INSTALL_ABORT=NGINX_CURL_PYTHON_MISSING';exit 1
}
# LIVE API is read-only probed. Do not treat publicly reachable Stripe as
# seller-approved checkout: LIVE currently has zero owner-approved mappings.
curl -fsS --max-time 5 http://127.0.0.1:18190/api/v1/health | python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("version")!="rc8.13-unified-live" or d.get("production") is not True:
 raise SystemExit("PWA_INSTALL_ABORT=EXPECTED_RC813_LIVE_NOT_HEALTHY")
print("PWA_EXISTING_LIVE_RC813=PASS")
'
[[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]] || {
 echo 'PWA_INSTALL_ABORT=UNREVIEWED_NGINX_LAYOUT';exit 1;
}
[[ ! -e "$SITE" && ! -L "$SITE" && ! -e "$ENABLED" && ! -L "$ENABLED" ]] || {
 echo 'PWA_INSTALL_ABORT=PWA_NGINX_SITE_ALREADY_CONFIGURED_REVIEW';exit 1;
}
[[ ! -e "$RELEASE" && ! -L "$RELEASE" && ! -e "$CURRENT" && ! -L "$CURRENT" ]] || {
 echo 'PWA_INSTALL_ABORT=PWA_RELEASE_ALREADY_CONFIGURED_REVIEW';exit 1;
}
if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18195$';then
 echo 'PWA_INSTALL_ABORT=PORT_18195_ALREADY_IN_USE';exit 1;
fi
if [[ "$MODE" == --plan ]];then
 echo 'PWA_INSTALL_PLAN=PASS_READ_ONLY'
 echo 'PWA_FRONTEND_DOMAIN=web-talaeats.alan-palacios-dev.com'
 echo 'PWA_PORT=127.0.0.1:18195'
 echo 'PWA_API_UPSTREAM=127.0.0.1:18190'
 echo 'PWA_CLOUDFLARED_CONFIG_UNCHANGED=YES'
 exit 0
fi
# Confine mutations to the NEW static site, with rollback on failure.
CREATED_SITE=no
CREATED_RELEASE=no
ROLLBACK=no
rollback(){
 code=$?
 trap - EXIT
 if [[ "$ROLLBACK" == yes ]];then
   echo 'PWA_NGINX_SITE_ROLLBACK=START'
   if [[ "$CREATED_SITE" == yes ]];then
     rm -f -- "$ENABLED" "$SITE"
     nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
   fi
   if [[ "$CREATED_RELEASE" == yes ]];then
     rm -f -- "$CURRENT"
     rm -rf -- "$RELEASE"
   fi
   echo 'PWA_ROLLBACK_ATTEMPTED=CHECK_NGINX'
 fi
 exit "$code"
}
trap rollback EXIT
ROLLBACK=yes
mkdir -p -m 755 "$DEST/releases"
mkdir -m 755 "$RELEASE"
CREATED_RELEASE=yes
cp -a -- "$DIST/." "$RELEASE/"
chmod -R a+rX,go-w "$RELEASE"
ln -s "$RELEASE" "$CURRENT"
install -m 644 "$CONF" "$SITE"
CREATED_SITE=yes
ln -s "$SITE" "$ENABLED"
nginx -t
if ! systemctl is-active --quiet nginx;then
 echo 'PWA_INSTALL_ABORT=NGINX_SERVICE_NOT_RUNNING_NO_AUTOSTART';exit 1
fi
systemctl reload nginx
# Verify local static routes, distinct app identities, and SAME origin backend.
for path in / /clientes /restaurante /repartidor;do
 curl -fsS --max-time 5 -H 'Host: web-talaeats.alan-palacios-dev.com' \
   "http://127.0.0.1:18195$path" | grep -q '<div id="root">' || {
    echo "PWA_INSTALL_ABORT=LOCAL_ROUTE_FAILED:$path";exit 1
   }
done
curl -fsS --max-time 5 -H 'Host: web-talaeats.alan-palacios-dev.com' \
 http://127.0.0.1:18195/api/v1/health | python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("version")!="rc8.13-unified-live" or d.get("production") is not True:
 raise SystemExit("PWA_INSTALL_ABORT=API_REVERSE_PROXY_NOT_LIVE")
print("PWA_NGINX_SAME_ORIGIN_API=PASS")
'
ROLLBACK=no
trap - EXIT
echo 'PWA_KALI_NGINX_LOCAL_DEPLOY=PASS'
echo "PWA_DEPLOYED_SHA=$SHA"
echo 'PWA_PUBLIC_HTTPS=AWAITING_CLOUDFLARED_HOSTNAME'
echo 'PWA_LIVE_PM2_POSTGRES_STRIPE=UNMODIFIED'
