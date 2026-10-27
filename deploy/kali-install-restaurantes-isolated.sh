#!/usr/bin/env bash
# One-time isolated installation of RESTAURANTES on port 18197.
# Does not edit Nginx 18195, API/Stripe PM2 18190, PostgreSQL or Cloudflared.
# --plan reads only; --apply has a distinct exact operator approval token.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="${1:-}" SHA="${2:-}" TOKEN="${3:-}"
APPROVAL='I_APPROVE_NEW_RESTAURANTES_NGINX_18197_ONLY'
HOST='restaurantes-talaeats.alan-palacios-dev.com'
PRIMARY='web-talaeats.alan-palacios-dev.com'
LOCAL='http://127.0.0.1:18197'
MAIN='http://127.0.0.1:18195'
LIVE='http://127.0.0.1:18190'
UNIT='talaeats-restaurantes-pwa.service'
ROOT='/srv/talaeats-restaurantes-pwa'
CONFIG='/etc/talaeats-restaurantes-pwa'
SYSUNIT='/etc/systemd/system/talaeats-restaurantes-pwa.service'
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SOURCE/dist-restaurantes"
DEST="$ROOT/releases/$SHA"
if [[ ! "$MODE" =~ ^--(plan|apply)$ ]] ||
 [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]] ||
 [[ "$MODE" == '--plan' && "$#" -ne 2 ]] ||
 [[ "$MODE" == '--apply' && ( "$#" -ne 3 || "$TOKEN" != "$APPROVAL" ) ]];then
 echo 'RESTAURANTES_INSTALL_ABORT=USAGE_OR_SHA_APPROVAL_INVALID'
 echo 'USE: bash deploy/kali-install-restaurantes-isolated.sh --plan SHA'
 echo "APPLY: sudo bash deploy/kali-install-restaurantes-isolated.sh --apply SHA $APPROVAL"
 exit 2
fi
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=ROOT_REQUIRED_FOR_APPLY'; exit 2;
}
for cmd in git grep curl python3 nginx systemctl ss cmp sha256sum readlink find;do
 command -v "$cmd" >/dev/null || {
  echo "RESTAURANTES_INSTALL_ABORT=MISSING:$cmd";exit 2;
 }
done
[[ -d "$SOURCE" && ! -L "$SOURCE" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=PINNED_CHECKOUT_OR_DIST_MISSING';exit 2;
}
[[ "$(git -c safe.directory="$SOURCE" -C "$SOURCE" rev-parse HEAD)" == "$SHA" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=SHA_MISMATCH';exit 2;
}
[[ -z "$(git -c safe.directory="$SOURCE" -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=DIRTY_CHECKOUT';exit 2;
}
for asset in restaurantes.html sw-restaurante.js manifest-restaurante.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$asset" ]] || {
 echo "RESTAURANTES_INSTALL_ABORT=MISSING_DIST_ASSET:$asset";exit 2;
 }
done
[[ -z "$(find "$DIST" -type l -print -quit)" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=UNEXPECTED_SYMLINK';exit 2;
}
[[ -z "$(find "$DIST" -type f \( -name '*.pem' -o -name '*.key' -o -name '.env*' \) -print -quit)" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=SECRETS_IN_STATIC_DIST';exit 2;
}
if grep -Fq 'name="tala-preview-mode"' "$DIST/index.html";then
 echo 'RESTAURANTES_INSTALL_ABORT=READONLY_PREVIEW_NOT_FOR_PUBLIC';exit 2;
fi
for p in "$CONFIG" "$SYSUNIT" "$ROOT/current" "$DEST";do
 [[ ! -e "$p" && ! -L "$p" ]] || {
 echo "RESTAURANTES_INSTALL_ABORT=EXISTING_TARGET_REQUIRES_UPDATE_NOT_INSTALL:$p";exit 2;
 }
done
if systemctl is-active --quiet "$UNIT";then
 echo 'RESTAURANTES_INSTALL_ABORT=SERVICE_ALREADY_RUNNING';exit 2;
fi
if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18197$';then
 echo 'RESTAURANTES_INSTALL_ABORT=18197_OCCUPIED';exit 2;
fi
[[ -f "$SOURCE/deploy/nginx-restaurantes-isolated-main.conf" &&
 -f "$SOURCE/deploy/nginx-restaurantes-isolated-server.conf" &&
 -f "$SOURCE/deploy/talaeats-restaurantes-pwa.service" ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=INCOMPLETE_TEMPLATES';exit 2;
}
systemctl is-active --quiet talaeats-web-pwa.service || {
 echo 'RESTAURANTES_INSTALL_ABORT=CUSTOMERS_SERVICE_NOT_HEALTHY';exit 2;
}
curl -fsS --max-time 10 -H "Host: $PRIMARY" "$MAIN/clientes" |
 grep -Fq '<div id="root">' || {
 echo 'RESTAURANTES_INSTALL_ABORT=CUSTOMERS_APP_UNHEALTHY';exit 2;
}
curl -fsS --max-time 10 "$LIVE/api/v1/health" | python3 -c '
import json,sys
x=json.load(sys.stdin)
assert x.get("status")=="ok" and x.get("production") is True
print("RESTAURANTES_LIVE_BACKEND=PASS_READ_ONLY")
'
[[ ! -e "$DIST/index.html" ]] || { echo 'RESTAURANTES_INSTALL_ABORT=CUSTOMER_INDEX_INCLUDED';exit 2; }
grep -Fq 'src="/assets/' "$DIST/restaurantes.html" || { echo 'RESTAURANTES_INSTALL_ABORT=MERCHANT_ASSETS_MISSING';exit 2; }
grep -Fq 'Tala Eats Restaurantes' "$DIST/restaurantes.html" || { echo 'RESTAURANTES_INSTALL_ABORT=MERCHANT_SHELL_WRONG';exit 2; }
echo "RESTAURANTES_INSTALL_SHA=$SHA"
echo "RESTAURANTES_INSTALL_DOMAIN=https://$HOST"
echo 'RESTAURANTES_INSTALL_BIND=127.0.0.1:18197'
echo 'RESTAURANTES_CUSTOMERS=UNTOUCHED_18195'
echo 'RESTAURANTES_FINANCIAL_WRITES=NONE'
if [[ "$MODE" == --plan ]];then
 echo 'RESTAURANTES_INSTALL_PLAN=PASS_READ_ONLY'
 exit 0
fi
# Reserve only NEW resources. Rollback removes nothing outside the new namespace.
CREATED=no
rollback(){
 local exit_code=$?
 trap - EXIT
 if [[ "$CREATED" == yes && "$exit_code" -ne 0 ]];then
  systemctl disable --now "$UNIT" >/dev/null 2>&1 || true
  rm -f -- "$SYSUNIT"
  systemctl daemon-reload >/dev/null 2>&1 || true
  rm -f -- "$CONFIG/nginx.conf" "$CONFIG/server.conf"
  rmdir -- "$CONFIG" >/dev/null 2>&1 || true
  rm -f -- "$ROOT/current"
  rm -rf -- "$DEST"
  echo 'RESTAURANTES_INSTALL_ROLLBACK=NEW_RESOURCES_REVERTED'
 fi
 exit "$exit_code"
}
trap rollback EXIT
CREATED=yes
install -d -m 755 "$ROOT/releases"
install -d -m 755 "$DEST"
cp -a -- "$DIST/." "$DEST/"
chmod -R a+rX,go-w "$DEST"
cmp -s "$DIST/restaurantes.html" "$DEST/restaurantes.html" || {
 echo 'RESTAURANTES_INSTALL_ABORT=STATIC_COPY_FAILED';exit 1;
}
ln -s "$DEST" "$ROOT/current"
install -d -m 755 "$CONFIG"
install -m 644 "$SOURCE/deploy/nginx-restaurantes-isolated-main.conf" "$CONFIG/nginx.conf"
install -m 644 "$SOURCE/deploy/nginx-restaurantes-isolated-server.conf" "$CONFIG/server.conf"
install -m 644 "$SOURCE/deploy/talaeats-restaurantes-pwa.service" "$SYSUNIT"
nginx -t -c "$CONFIG/nginx.conf" || {
 echo 'RESTAURANTES_INSTALL_ABORT=NGINX_CONFIG_INVALID';exit 1;
}
systemctl daemon-reload
systemctl enable --now "$UNIT"
LIVE_HTTP=no
for n in $(seq 1 30);do
 if curl -fsS --max-time 2 -H "Host: $HOST" "$LOCAL/restaurante" 2>/dev/null |
 grep -Fq '<div id="root">';then LIVE_HTTP=yes;break;fi
 if systemctl is-failed --quiet "$UNIT";then break;fi
 sleep 1
done
[[ "$LIVE_HTTP" == yes ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=LOCAL_HTTP_NOT_READY';exit 1;
}
# Dedicated root must redirect to the restaurant experience.
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/")" == 302 ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=ROOT_REDIRECT_MISSING';exit 1;
}
for path in /restaurante/acceso /restaurante/alta /manifest-restaurante.webmanifest /sw-restaurante.js;do
 curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL$path" -o /dev/null || {
 echo "RESTAURANTES_INSTALL_ABORT=ROUTE:$path";exit 1;
 }
done
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/clientes")" == 404 &&
   "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/iniciar")" == 404 &&
   "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/sw.js")" == 404 ]] || {
 echo 'RESTAURANTES_INSTALL_ABORT=CUSTOMER_ROUTE_LEAK';exit 1;
}
curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL/api/v1/health" |
 python3 -c 'import json,sys; x=json.load(sys.stdin); assert x.get("status")=="ok" and x.get("production") is True' || {
 echo 'RESTAURANTES_INSTALL_ABORT=BACKEND_PROXY_BAD';exit 1;
}
CREATED=no
trap - EXIT
echo 'RESTAURANTES_INSTALL=PASS_LOCAL_ONLY'
echo "RESTAURANTES_RELEASE=$DEST"
echo 'RESTAURANTES_CLOUDFLARED_DNS=NOT_MODIFIED_CONFIGURE_AFTER_LOCAL_PASS'
echo 'RESTAURANTES_STRIPE_PG_PM2_CUSTOMERS=UNMODIFIED'
