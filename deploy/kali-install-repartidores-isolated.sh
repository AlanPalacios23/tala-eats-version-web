#!/usr/bin/env bash
# One-time isolated installation of REPARTIDORES on port 18199.
# Does not edit Nginx 18195, API/Stripe PM2 18190, PostgreSQL or Cloudflared.
# --plan reads only; --apply has a distinct exact operator approval token.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="${1:-}" SHA="${2:-}" TOKEN="${3:-}"
APPROVAL='I_APPROVE_NEW_REPARTIDORES_NGINX_18199_ONLY'
HOST='repartidores-talaeats.alan-palacios-dev.com'
PRIMARY='web-talaeats.alan-palacios-dev.com'
LOCAL='http://127.0.0.1:18199'
MAIN='http://127.0.0.1:18195'
LIVE='http://127.0.0.1:18190'
UNIT='talaeats-repartidores-pwa.service'
ROOT='/srv/talaeats-repartidores-pwa'
CONFIG='/etc/talaeats-repartidores-pwa'
SYSUNIT='/etc/systemd/system/talaeats-repartidores-pwa.service'
RUNTIME='/run/talaeats-repartidores-pwa'
RUNTIME_CREATED=no
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SOURCE/dist-repartidores"
DEST="$ROOT/releases/$SHA"
if [[ ! "$MODE" =~ ^--(plan|apply)$ ]] ||
 [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]] ||
 [[ "$MODE" == '--plan' && "$#" -ne 2 ]] ||
 [[ "$MODE" == '--apply' && ( "$#" -ne 3 || "$TOKEN" != "$APPROVAL" ) ]];then
 echo 'REPARTIDORES_INSTALL_ABORT=USAGE_OR_SHA_APPROVAL_INVALID'
 echo 'USE: bash deploy/kali-install-repartidores-isolated.sh --plan SHA'
 echo "APPLY: sudo bash deploy/kali-install-repartidores-isolated.sh --apply SHA $APPROVAL"
 exit 2
fi
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=ROOT_REQUIRED_FOR_APPLY'; exit 2;
}
for cmd in git grep curl python3 nginx systemctl ss cmp sha256sum readlink find;do
 command -v "$cmd" >/dev/null || {
  echo "REPARTIDORES_INSTALL_ABORT=MISSING:$cmd";exit 2;
 }
done
[[ -d "$SOURCE" && ! -L "$SOURCE" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=PINNED_CHECKOUT_OR_DIST_MISSING';exit 2;
}
[[ "$(git -c safe.directory="$SOURCE" -C "$SOURCE" rev-parse HEAD)" == "$SHA" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=SHA_MISMATCH';exit 2;
}
[[ -z "$(git -c safe.directory="$SOURCE" -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=DIRTY_CHECKOUT';exit 2;
}
for asset in repartidores.html sw-repartidor.js manifest-repartidor.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$asset" ]] || {
 echo "REPARTIDORES_INSTALL_ABORT=MISSING_DIST_ASSET:$asset";exit 2;
 }
done
[[ -z "$(find "$DIST" -type l -print -quit)" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=UNEXPECTED_SYMLINK';exit 2;
}
[[ -z "$(find "$DIST" -type f \( -name '*.pem' -o -name '*.key' -o -name '.env*' \) -print -quit)" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=SECRETS_IN_STATIC_DIST';exit 2;
}
if grep -Fq 'name="tala-preview-mode"' "$DIST/repartidores.html";then
 echo 'REPARTIDORES_INSTALL_ABORT=READONLY_PREVIEW_NOT_FOR_PUBLIC';exit 2;
fi
for p in "$CONFIG" "$SYSUNIT" "$ROOT/current" "$DEST";do
 [[ ! -e "$p" && ! -L "$p" ]] || {
 echo "REPARTIDORES_INSTALL_ABORT=EXISTING_TARGET_REQUIRES_UPDATE_NOT_INSTALL:$p";exit 2;
 }
done
if systemctl is-active --quiet "$UNIT";then
 echo 'REPARTIDORES_INSTALL_ABORT=SERVICE_ALREADY_RUNNING';exit 2;
fi
if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18199$';then
 echo 'REPARTIDORES_INSTALL_ABORT=18199_OCCUPIED';exit 2;
fi
[[ -f "$SOURCE/deploy/nginx-repartidores-isolated-main.conf" &&
 -f "$SOURCE/deploy/nginx-repartidores-isolated-server.conf" &&
 -f "$SOURCE/deploy/talaeats-repartidores-pwa.service" ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=INCOMPLETE_TEMPLATES';exit 2;
}
systemctl is-active --quiet talaeats-web-pwa.service || {
 echo 'REPARTIDORES_INSTALL_ABORT=CUSTOMERS_SERVICE_NOT_HEALTHY';exit 2;
}
curl -fsS --max-time 10 -H "Host: $PRIMARY" "$MAIN/clientes" |
 grep -Fq '<div id="root">' || {
 echo 'REPARTIDORES_INSTALL_ABORT=CUSTOMERS_APP_UNHEALTHY';exit 2;
}
curl -fsS --max-time 10 "$LIVE/api/v1/health" | python3 -c '
import json,sys
x=json.load(sys.stdin)
assert x.get("status")=="ok" and x.get("production") is True
print("REPARTIDORES_LIVE_BACKEND=PASS_READ_ONLY")
'
[[ ! -e "$DIST/index.html" ]] || { echo 'REPARTIDORES_INSTALL_ABORT=CUSTOMER_INDEX_INCLUDED';exit 2; }
grep -Fq 'src="/assets/' "$DIST/repartidores.html" || { echo 'REPARTIDORES_INSTALL_ABORT=MERCHANT_ASSETS_MISSING';exit 2; }
grep -Fq 'Tala Eats Repartidor' "$DIST/repartidores.html" || { echo 'REPARTIDORES_INSTALL_ABORT=MERCHANT_SHELL_WRONG';exit 2; }
echo "REPARTIDORES_INSTALL_SHA=$SHA"
echo "REPARTIDORES_INSTALL_DOMAIN=https://$HOST"
echo 'REPARTIDORES_INSTALL_BIND=127.0.0.1:18199'
echo 'REPARTIDORES_CUSTOMERS=UNTOUCHED_18195'
echo 'REPARTIDORES_FINANCIAL_WRITES=NONE'
if [[ "$MODE" == --plan ]];then
 echo 'REPARTIDORES_INSTALL_PLAN=PASS_READ_ONLY'
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
  if [[ "$RUNTIME_CREATED" == yes ]];then rmdir -- "$RUNTIME" >/dev/null 2>&1 || true;fi
  echo 'REPARTIDORES_INSTALL_ROLLBACK=NEW_RESOURCES_REVERTED'
 fi
 exit "$exit_code"
}
trap rollback EXIT
CREATED=yes
install -d -m 755 "$ROOT/releases"
install -d -m 755 "$DEST"
cp -a -- "$DIST/." "$DEST/"
chmod -R a+rX,go-w "$DEST"
cmp -s "$DIST/repartidores.html" "$DEST/repartidores.html" || {
 echo 'REPARTIDORES_INSTALL_ABORT=STATIC_COPY_FAILED';exit 1;
}
ln -s "$DEST" "$ROOT/current"
install -d -m 755 "$CONFIG"
install -m 644 "$SOURCE/deploy/nginx-repartidores-isolated-main.conf" "$CONFIG/nginx.conf"
install -m 644 "$SOURCE/deploy/nginx-repartidores-isolated-server.conf" "$CONFIG/server.conf"
install -m 644 "$SOURCE/deploy/talaeats-repartidores-pwa.service" "$SYSUNIT"
# nginx -t inspects the configured PID location BEFORE systemd's
# RuntimeDirectory= is created on first service start.
# Create only this dedicated /run directory; systemd will manage it after start.
[[ ! -L "$RUNTIME" ]] || { echo 'REPARTIDORES_INSTALL_ABORT=RUNTIME_SYMLINK';exit 1; }
if [[ ! -d "$RUNTIME" ]];then RUNTIME_CREATED=yes;fi
install -d -o www-data -g www-data -m 0755 "$RUNTIME"
nginx -t -c "$CONFIG/nginx.conf" || {
 echo 'REPARTIDORES_INSTALL_ABORT=NGINX_CONFIG_INVALID';exit 1;
}
systemctl daemon-reload
systemctl enable --now "$UNIT"
LIVE_HTTP=no
for n in $(seq 1 30);do
 if curl -fsS --max-time 2 -H "Host: $HOST" "$LOCAL/repartidor" 2>/dev/null |
 grep -Fq '<div id="root">';then LIVE_HTTP=yes;break;fi
 if systemctl is-failed --quiet "$UNIT";then break;fi
 sleep 1
done
[[ "$LIVE_HTTP" == yes ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=LOCAL_HTTP_NOT_READY';exit 1;
}
# Dedicated root must redirect to the restaurant experience.
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/")" == 302 ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=ROOT_REDIRECT_MISSING';exit 1;
}
for path in /repartidor/acceso /repartidor/registro /manifest-repartidor.webmanifest /sw-repartidor.js;do
 curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL$path" -o /dev/null || {
 echo "REPARTIDORES_INSTALL_ABORT=ROUTE:$path";exit 1;
 }
done
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/clientes")" == 404 &&
   "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/iniciar")" == 404 &&
   "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$LOCAL/sw.js")" == 404 ]] || {
 echo 'REPARTIDORES_INSTALL_ABORT=CUSTOMER_ROUTE_LEAK';exit 1;
}
curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL/api/v1/health" |
 python3 -c 'import json,sys; x=json.load(sys.stdin); assert x.get("status")=="ok" and x.get("production") is True' || {
 echo 'REPARTIDORES_INSTALL_ABORT=BACKEND_PROXY_BAD';exit 1;
}
CREATED=no
trap - EXIT
echo 'REPARTIDORES_INSTALL=PASS_LOCAL_ONLY'
echo "REPARTIDORES_RELEASE=$DEST"
echo 'REPARTIDORES_CLOUDFLARED_DNS=NOT_MODIFIED_CONFIGURE_AFTER_LOCAL_PASS'
echo 'REPARTIDORES_STRIPE_PG_PM2_CUSTOMERS=UNMODIFIED'
