#!/usr/bin/env bash
# One-time install TALA EATS PWA when the system-wide nginx.service is inactive.
# Runs a SEPARATE, unprivileged Nginx master under its own systemd service.
# Never starts/edits/reloads global nginx.service, PM2, PostgreSQL or Cloudflared.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="${1:-}"; SHA="${2:-}"; APPROVAL="${3:-}"
if [[ ! "$MODE" =~ ^--(plan|apply)$ || ! "$SHA" =~ ^[a-f0-9]{40}$ ||
 ( "$MODE" == --plan && "$#" -ne 2 ) ||
 ( "$MODE" == --apply && "$#" -ne 3 ) ]];then
 echo 'USAGE: bash deploy/kali-install-pwa-isolated.sh --plan|--apply SHA [I_APPROVE_ISOLATED_PWA_18195_ONLY]'
 exit 2
fi
[[ "$MODE" == --plan || "$APPROVAL" == I_APPROVE_ISOLATED_PWA_18195_ONLY ]] || {
 echo 'PWA_ISOLATED_ABORT=EXPLICIT_APPROVAL_REQUIRED';exit 2
}
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || {
 echo 'PWA_ISOLATED_ABORT=RUN_APPLY_AS_ROOT';exit 1
}

REPO="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$REPO/dist"
STATIC="/srv/talaeats-pwa"
RELEASE="$STATIC/releases/$SHA"
CURRENT="$STATIC/current"
PRIVATE="/etc/talaeats-web-pwa"
MAIN="$PRIVATE/nginx.conf"
SERVER="$PRIVATE/server.conf"
SERVICE="/etc/systemd/system/talaeats-web-pwa.service"
NAME=talaeats-web-pwa.service

[[ -d "$REPO" && ! -L "$REPO" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo 'PWA_ISOLATED_ABORT=SOURCE_RELEASE_MISSING';exit 1
}
[[ "$(git -c safe.directory="$REPO" -C "$REPO" rev-parse HEAD 2>/dev/null)" == "$SHA" &&
 -z "$(git -c safe.directory="$REPO" -C "$REPO" status --porcelain --untracked-files=no)" ]] || {
 echo 'PWA_ISOLATED_ABORT=SOURCE_SHA_MISMATCH_OR_DIRTY';exit 1
}
for file in index.html sw.js offline.html manifest.webmanifest \
 manifest-clientes.webmanifest manifest-restaurante.webmanifest \
 manifest-repartidor.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$file" ]] || {
  echo "PWA_ISOLATED_ABORT=MISSING_DIST_ASSET:$file";exit 1
 }
done
if find "$DIST" -type l -print -quit | grep -q .;then
 echo 'PWA_ISOLATED_ABORT=SYMLINK_IN_STATIC_DIST';exit 1
fi
if find "$DIST" -type f \( -name '.env*' -o -name '*.pem' -o -name '*.key' \) -print -quit | grep -q .;then
 echo 'PWA_ISOLATED_ABORT=SECRET_LIKE_STATIC_FILE';exit 1
fi
for command in nginx systemctl ss curl python3 git;do
 command -v "$command" >/dev/null || {
  echo "PWA_ISOLATED_ABORT=DEPENDENCY_MISSING:$command";exit 1
 }
done
[[ -f /etc/nginx/mime.types && -f "$REPO/deploy/nginx-isolated-main.conf" &&
 -f "$REPO/deploy/nginx-web-talaeats.conf" &&
 -f "$REPO/deploy/talaeats-web-pwa.service" ]] || {
 echo 'PWA_ISOLATED_ABORT=NGINX_TEMPLATES_MISSING';exit 1
}
id www-data >/dev/null 2>&1 || {
 echo 'PWA_ISOLATED_ABORT=WWW_DATA_USER_MISSING';exit 1
}
for target in "$MAIN" "$SERVER" "$SERVICE" "$RELEASE" "$CURRENT" \
 /etc/nginx/sites-available/tala-eats-web-pwa.conf \
 /etc/nginx/sites-enabled/tala-eats-web-pwa.conf;do
 [[ ! -e "$target" && ! -L "$target" ]] || {
  echo 'PWA_ISOLATED_ABORT=EXISTING_INSTALL_OR_GLOBAL_NGINX_SITE_REVIEW';exit 1
 }
done
[[ ! -e "$PRIVATE" && ! -L "$PRIVATE" ]] || {
 echo 'PWA_ISOLATED_ABORT=PRIVATE_NGINX_CONFIG_ALREADY_EXISTS';exit 1
}
if systemctl is-active --quiet "$NAME";then
 echo 'PWA_ISOLATED_ABORT=DEDICATED_SERVICE_ALREADY_ACTIVE';exit 1
fi
if ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18195$';then
 echo 'PWA_ISOLATED_ABORT=PORT_18195_IN_USE';exit 1
fi
# Require LIVE existing production rather than silently proxying to staging.
curl -fsS --max-time 8 http://127.0.0.1:18190/api/v1/health | python3 -c '
import json,sys
data=json.load(sys.stdin)
if data.get("status")!="ok" or data.get("version")!="rc8.13-unified-live" or data.get("production") is not True:
 raise SystemExit("PWA_ISOLATED_ABORT=LIVE_RC813_HEALTH_MISMATCH")
print("PWA_ISOLATED_EXISTING_RC813_LIVE=PASS")
'
if [[ "$MODE" == --plan ]];then
 echo 'PWA_ISOLATED_INSTALL_PLAN=PASS_READ_ONLY'
 echo 'PWA_WEBSERVER=DEDICATED_SYSTEMD_NGINX_NO_GLOBAL_SERVICE'
 echo 'PWA_BIND=127.0.0.1:18195'
 echo 'PWA_BACKEND_PROXY=127.0.0.1:18190'
 echo 'PWA_GLOBAL_NGINX_CLOUDFLARED_PM2_UNTOUCHED=YES'
 exit 0
fi

# Only following resources can be created. This fails closed on any collision.
ROLLBACK=no
rollback(){
 local exit_code=$?
 trap - EXIT
 if [[ "$ROLLBACK" == yes ]];then
  echo 'PWA_ISOLATED_ROLLBACK=START'
  systemctl disable --now "$NAME" >/dev/null 2>&1 || true
  rm -f -- "$SERVICE"
  systemctl daemon-reload >/dev/null 2>&1 || true
  rm -f -- "$MAIN" "$SERVER"
  rmdir -- "$PRIVATE" >/dev/null 2>&1 || true
  rm -f -- "$CURRENT"
  rm -rf -- "$RELEASE"
  echo 'PWA_ISOLATED_ROLLBACK=ATTEMPTED_CHECK_RESIDUALS'
 fi
 exit "$exit_code"
}
trap rollback EXIT
ROLLBACK=yes
mkdir -p -m 755 "$STATIC/releases"
mkdir -m 755 "$RELEASE"
cp -a -- "$DIST/." "$RELEASE/"
chmod -R a+rX,go-w "$RELEASE"
ln -s "$RELEASE" "$CURRENT"
mkdir -m 755 "$PRIVATE"
install -m 644 "$REPO/deploy/nginx-isolated-main.conf" "$MAIN"
install -m 644 "$REPO/deploy/nginx-web-talaeats.conf" "$SERVER"
install -m 644 "$REPO/deploy/talaeats-web-pwa.service" "$SERVICE"
# Local config references only the NEW server block and never includes
# /etc/nginx/nginx.conf or /etc/nginx/sites-enabled/*.
systemctl daemon-reload
systemctl enable --now "$NAME"
# systemd Type=simple reports active before Nginx has necessarily finished
# ExecStart and bound 18195. Wait for REAL HTTP readiness, not just "active".
# Never start/reload global nginx.service.
NGINX_LISTEN_READY=no
for attempt in $(seq 1 30);do
 if curl -fsS --max-time 2 -H 'Host: web-talaeats.alan-palacios-dev.com' \
   http://127.0.0.1:18195/ 2>/dev/null | grep -q '<div id="root">';then
  NGINX_LISTEN_READY=yes
  break
 fi
 if systemctl is-failed --quiet "$NAME";then
  echo 'PWA_ISOLATED_ABORT=DEDICATED_NGINX_SYSTEMD_FAILED'
  systemctl show "$NAME" -p ActiveState -p SubState -p Result --no-pager || true
  exit 1
 fi
 sleep 1
done
if [[ "$NGINX_LISTEN_READY" != yes ]];then
 echo 'PWA_ISOLATED_ABORT=NGINX_18195_NOT_READY_AFTER_30_CHECKS'
 systemctl show "$NAME" -p ActiveState -p SubState -p Result --no-pager || true
 exit 1
fi
systemctl is-active --quiet "$NAME" || {
 echo 'PWA_ISOLATED_ABORT=DEDICATED_NGINX_NOT_ACTIVE_AFTER_BIND';exit 1
}
echo 'PWA_ISOLATED_NGINX_HTTP_READY=PASS'
for path in / /clientes /restaurante /repartidor;do
 curl -fsS --max-time 8 -H 'Host: web-talaeats.alan-palacios-dev.com' \
  "http://127.0.0.1:18195$path" | grep -q '<div id="root">' || {
  echo "PWA_ISOLATED_ABORT=STATIC_ROUTE_FAILED:$path";exit 1
 }
done
for path in /manifest.webmanifest /manifest-clientes.webmanifest \
 /manifest-restaurante.webmanifest /manifest-repartidor.webmanifest /sw.js;do
 curl -fsS --max-time 8 -o /dev/null -H 'Host: web-talaeats.alan-palacios-dev.com' \
  "http://127.0.0.1:18195$path" || {
  echo "PWA_ISOLATED_ABORT=MANIFEST_OR_SW_FAILED:$path";exit 1
 }
done
curl -fsS --max-time 8 -H 'Host: web-talaeats.alan-palacios-dev.com' \
 http://127.0.0.1:18195/api/v1/health | python3 -c '
import json,sys
data=json.load(sys.stdin)
if data.get("version")!="rc8.13-unified-live" or data.get("production") is not True:
 raise SystemExit("PWA_ISOLATED_ABORT=SAME_ORIGIN_BACKEND_MISMATCH")
print("PWA_ISOLATED_SAME_ORIGIN_API=PASS")
'
ROLLBACK=no
trap - EXIT
echo 'PWA_ISOLATED_KALI_LOCAL_DEPLOY=PASS'
echo "PWA_ISOLATED_SHA=$SHA"
echo 'PWA_HTTPS_CLOUDFLARED=AWAITING_HOSTNAME'
echo 'PWA_GLOBAL_NGINX_PM2_POSTGRES_STRIPE=UNMODIFIED'
