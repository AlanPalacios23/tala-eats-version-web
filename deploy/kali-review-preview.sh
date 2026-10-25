#!/usr/bin/env bash
# Kali: install/update an isolated READ-ONLY review build on localhost:18196.
# Never edits the live PWA 18195, backend 18190, cloudflared, Stripe, DB or PM2.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"

MODE="${1:-}"; SHA="${2:-}"; APPROVAL="${3:-}"
if [[ "$MODE" != --status && "$MODE" != --rollback &&
      ( "$MODE" != --plan && "$MODE" != --apply || ! "$SHA" =~ ^[a-f0-9]{40}$ ) ]]; then
 echo 'USAGE: bash deploy/kali-review-preview.sh --plan|--apply SHA [I_APPROVE_READONLY_PREVIEW_ONLY]';exit 2
fi
if [[ "$MODE" == --rollback ]];then
 [[ "$#" -eq 2 && "$SHA" == I_APPROVE_PREVIEW_ROLLBACK_ONLY ]] || {
   echo 'USAGE: bash deploy/kali-review-preview.sh --rollback I_APPROVE_PREVIEW_ROLLBACK_ONLY';exit 2;
 }
elif [[ "$MODE" == --status ]];then
 [[ "$#" -eq 1 ]] || exit 2
else
 [[ "$MODE" == --plan && "$#" -eq 2 ||
    "$MODE" == --apply && "$#" -eq 3 && "$APPROVAL" == I_APPROVE_READONLY_PREVIEW_ONLY ]] || {
   echo 'PREVIEW_ABORT=INVALID_ARGS_OR_APPROVAL';exit 2;
 }
fi

SRC="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SRC/dist"
BASE=/srv/talaeats-web-preview
RELEASE="$BASE/releases/$SHA"
CURRENT="$BASE/current"
PREVIOUS="$BASE/previous"
CONF_DIR=/etc/talaeats-web-preview
NGINX="$CONF_DIR/nginx.conf"
SERVER="$CONF_DIR/server.conf"
UNIT=/etc/systemd/system/talaeats-web-preview.service
SERVICE=talaeats-web-preview.service
PORT=18196
MARKER='<meta name="tala-preview-mode" content="read-only" />'

if [[ "$MODE" == --status ]];then
 echo "PREVIEW_CURRENT=$(readlink -f "$CURRENT" 2>/dev/null || echo NONE)"
 echo "PREVIEW_PREVIOUS=$(readlink -f "$PREVIOUS" 2>/dev/null || echo NONE)"
 if systemctl is-active --quiet "$SERVICE";then echo 'PREVIEW_SERVICE=ACTIVE';else echo 'PREVIEW_SERVICE=NOT_ACTIVE';fi
 echo "PREVIEW_LISTEN=127.0.0.1:$PORT"
 exit 0
fi
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || { echo 'PREVIEW_ABORT=ROOT_REQUIRED';exit 1; }
for command in nginx curl python3 git ss systemctl cmp;do
 command -v "$command" >/dev/null || { echo "PREVIEW_ABORT=MISSING:$command";exit 1; }
done
if [[ "$MODE" == --rollback ]];then
 [[ -L "$CURRENT" && -L "$PREVIOUS" ]] || { echo 'PREVIEW_ABORT=NO_PRIOR_RELEASE';exit 1; }
 BACK=$(readlink -f "$PREVIOUS")
 OLD=$(readlink -f "$CURRENT")
 [[ "$BACK" == "$BASE"/releases/* && -f "$BACK/index.html" && "$OLD" == "$BASE"/releases/* ]] || {
  echo 'PREVIEW_ABORT=INVALID_RELEASE_SYMLINK';exit 1;
 }
 grep -Fq "$MARKER" "$BACK/index.html" || { echo 'PREVIEW_ABORT=BACKUP_IS_NOT_READONLY';exit 1; }
 TMP="$BASE/.next-$$"
 ln -s "$BACK" "$TMP"
 mv -Tf "$TMP" "$CURRENT"
 if ! systemctl reload "$SERVICE" || ! curl -fsS --max-time 5 "http://127.0.0.1:$PORT/__preview_health" | grep -qx TALA_EATS_PREVIEW_READ_ONLY;then
  ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$CURRENT";systemctl reload "$SERVICE" || true
  echo 'PREVIEW_ROLLBACK=FAILED_RESTORED_CURRENT';exit 1
 fi
 ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$PREVIOUS"
 echo 'PREVIEW_ROLLBACK=PASS'
 exit 0
fi

[[ -d "$SRC" && ! -L "$SRC" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo 'PREVIEW_ABORT=SOURCE_OR_BUILT_DIST_MISSING';exit 1;
}
[[ "$(git -c safe.directory="$SRC" -C "$SRC" rev-parse HEAD 2>/dev/null)" == "$SHA" &&
   -z "$(git -c safe.directory="$SRC" -C "$SRC" status --porcelain --untracked-files=no)" ]] || {
 echo 'PREVIEW_ABORT=SHA_NOT_PINNED_OR_WORKTREE_DIRTY';exit 1;
}
grep -Fq "$MARKER" "$DIST/index.html" || { echo 'PREVIEW_ABORT=BUILD_IS_NOT_PREVIEW_READONLY';exit 1; }
for file in index.html offline.html manifest.webmanifest manifest-clientes.webmanifest \
 manifest-restaurante.webmanifest manifest-repartidor.webmanifest icons/icon-192.png \
 icons/icon-512.png;do
 [[ -s "$DIST/$file" ]] || { echo "PREVIEW_ABORT=ASSET_MISSING:$file";exit 1; }
done
[[ -z "$(find "$DIST" -type l -print -quit)" &&
   -z "$(find "$DIST" -type f \( -name '.env*' -o -name '*.pem' -o -name '*.key' \) -print -quit)" ]] || {
 echo 'PREVIEW_ABORT=SYMLINK_OR_SECRET_LIKE_BUILD_FILE';exit 1;
}
for file in nginx-preview-main.conf nginx-preview-server.conf talaeats-web-preview.service;do
 [[ -s "$SRC/deploy/$file" ]] || { echo "PREVIEW_ABORT=REVIEW_TEMPLATE_MISSING:$file";exit 1; }
done
# Critical: forbid financial writes even if a customer bypasses React.
grep -Fq 'limit_except GET { deny all; }' "$SRC/deploy/nginx-preview-server.conf" || {
 echo 'PREVIEW_ABORT=API_READONLY_PROXY_RULE_MISSING';exit 1;
}
grep -Fq 'listen 127.0.0.1:18196;' "$SRC/deploy/nginx-preview-server.conf" || {
 echo 'PREVIEW_ABORT=NOT_LOOPBACK_ONLY';exit 1;
}
curl -fsS --max-time 5 http://127.0.0.1:18190/api/v1/health | python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("status")!="ok" or d.get("production") is not True:
 raise SystemExit("PREVIEW_ABORT=EXPECTED_EXISTING_LIVE_API_UNAVAILABLE")
print("PREVIEW_BACKEND_READ_ONLY_HEALTH=PASS")
'
[[ ! -e "$RELEASE" && ! -L "$RELEASE" ]] || {
 echo 'PREVIEW_ABORT=RELEASE_EXISTS_NEW_SHA_REQUIRED';exit 1;
}
if [[ -e "$UNIT" || -L "$UNIT" || -e "$CONF_DIR" || -L "$CONF_DIR" ]];then
 [[ -f "$UNIT" && -f "$NGINX" && -f "$SERVER" && -L "$CURRENT" ]] || {
  echo 'PREVIEW_ABORT=PARTIAL_OR_FOREIGN_EXISTING_REVIEW_SERVICE';exit 1;
 }
 cmp -s "$SRC/deploy/nginx-preview-main.conf" "$NGINX" &&
 cmp -s "$SRC/deploy/nginx-preview-server.conf" "$SERVER" &&
 cmp -s "$SRC/deploy/talaeats-web-preview.service" "$UNIT" || {
  echo 'PREVIEW_ABORT=EXISTING_REVIEW_CONFIG_DRIFT_MANUAL_AUDIT';exit 1;
 }
 [[ "$(readlink -f "$CURRENT")" == "$BASE"/releases/* ]] || {
  echo 'PREVIEW_ABORT=UNTRUSTED_CURRENT_POINTER';exit 1;
 }
 systemctl is-active --quiet "$SERVICE" || { echo 'PREVIEW_ABORT=REVIEW_SERVICE_INACTIVE_MANUAL_REVIEW';exit 1; }
 EXISTING=yes
else
 [[ ! -e "$CURRENT" && ! -L "$CURRENT" && ! -e "$PREVIOUS" && ! -L "$PREVIOUS" ]] || {
  echo 'PREVIEW_ABORT=CONFLICTING_PREVIEW_FILES';exit 1;
 }
 ss -lntH | awk '{print $4}' | grep -Eq '(^|:)18196$' && {
  echo 'PREVIEW_ABORT=PORT_18196_OCCUPIED';exit 1;
 }
 [[ -f /etc/nginx/mime.types ]] || { echo 'PREVIEW_ABORT=NGINX_MIME_TYPES_MISSING';exit 1; }
 id www-data >/dev/null || { echo 'PREVIEW_ABORT=WWW_DATA_MISSING';exit 1; }
 EXISTING=no
fi
if [[ "$MODE" == --plan ]];then
 echo 'PREVIEW_PLAN=PASS_READ_ONLY'
 echo "PREVIEW_MODE=$([[ "$EXISTING" == yes ]] && echo UPDATE || echo FIRST_INSTALL)"
 echo "PREVIEW_SHA=$SHA"
 echo "PREVIEW_URL=http://127.0.0.1:$PORT/clientes"
 echo 'PREVIEW_UPSTREAM=LIVE_READ_ONLY_WITH_LOGIN_LOGOUT_EXCEPTIONS'
 echo 'PREVIEW_PROD_SITE_BACKEND_STRIPE=UNTOUCHED'
 exit 0
fi
CREATED_RELEASE=no;CREATED_SERVICE=no;SWITCHED=no
OLD=""
if [[ "$EXISTING" == yes ]];then OLD=$(readlink -f "$CURRENT");fi
cleanup(){
 local result=$?
 trap - EXIT
 if [[ "$result" -ne 0 ]];then
  if [[ "$SWITCHED" == yes ]];then
   rm -f -- "$CURRENT"
   if [[ -n "$OLD" ]];then ln -s "$OLD" "$CURRENT";systemctl reload "$SERVICE" || true;fi
  fi
  if [[ "$CREATED_SERVICE" == yes ]];then
   systemctl disable --now "$SERVICE" >/dev/null 2>&1 || true
   rm -f -- "$UNIT"
   systemctl daemon-reload >/dev/null 2>&1 || true
   rm -f -- "$NGINX" "$SERVER"
   rmdir -- "$CONF_DIR" >/dev/null 2>&1 || true
  fi
  if [[ "$CREATED_RELEASE" == yes ]];then rm -rf -- "$RELEASE";fi
  echo 'PREVIEW_APPLY=ROLLBACK_ATTEMPTED_CHECK_RESIDUALS'
 fi
 exit "$result"
}
trap cleanup EXIT
mkdir -p -m 755 "$BASE/releases"
mkdir -m 755 "$RELEASE"
CREATED_RELEASE=yes
cp -a -- "$DIST/." "$RELEASE/"
chmod -R a+rX,go-w "$RELEASE"
if [[ "$EXISTING" == no ]];then
 mkdir -m 755 "$CONF_DIR"
 CREATED_SERVICE=yes
 install -m 644 "$SRC/deploy/nginx-preview-main.conf" "$NGINX"
 install -m 644 "$SRC/deploy/nginx-preview-server.conf" "$SERVER"
 install -m 644 "$SRC/deploy/talaeats-web-preview.service" "$UNIT"
 systemctl daemon-reload
 # The systemd ExecStartPre runs nginx -t AS www-data, avoiding a root-owned PID.
 ln -s "$RELEASE" "$CURRENT"
 SWITCHED=yes
 systemctl enable --now "$SERVICE"
else
 TMP="$BASE/.next-$$"
 ln -s "$RELEASE" "$TMP"
 mv -Tf "$TMP" "$CURRENT"
 SWITCHED=yes
 nginx -t -c "$NGINX"
 systemctl reload "$SERVICE"
fi
READY=no
for attempt in $(seq 1 20);do
 if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/__preview_health" 2>/dev/null | grep -qx TALA_EATS_PREVIEW_READ_ONLY;then
  READY=yes;break
 fi
 if systemctl is-failed --quiet "$SERVICE";then break;fi
 sleep 1
done
[[ "$READY" == yes ]] || { echo 'PREVIEW_ABORT=HTTP_NOT_READY';exit 1; }
curl -fsS --max-time 6 "http://127.0.0.1:$PORT/clientes" | grep -Fq 'name="tala-preview-mode"' || {
 echo 'PREVIEW_ABORT=READONLY_FRONTEND_NOT_SERVED';exit 1;
}
curl -fsS --max-time 6 "http://127.0.0.1:$PORT/api/v1/health" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if d.get("status")!="ok":raise SystemExit("PREVIEW_ABORT=API_PROXY_HEALTH_FAILED")
'
if [[ -n "$OLD" ]];then
 TMP="$BASE/.previous-$$"
 ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$PREVIOUS"
fi
SWITCHED=no
CREATED_RELEASE=no
CREATED_SERVICE=no
trap - EXIT
echo 'PREVIEW_APPLY=PASS'
echo "PREVIEW_PINNED_SHA=$SHA"
echo "PREVIEW_URL=http://127.0.0.1:$PORT/clientes"
echo 'PREVIEW_CLOUDFLARED_GLOBAL_NGINX_LIVE_PM2_STRIPE=UNTOUCHED'
