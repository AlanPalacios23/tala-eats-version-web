#!/usr/bin/env bash
# Update the EXISTING Tala Eats public frontend at 18195, not the preview 18196.
# Atomic static-only release switch, no backend/Stripe/Cloudflare/systemd writes.
set -Eeuo pipefail
set +x
umask 022
export PATH="/usr/sbin:/sbin:$PATH"
MODE="${1:-}" SHA="${2:-}" APPROVAL="${3:-}"
[[ "$MODE" =~ ^--(plan|apply|rollback)$ ]] || {
 echo "PUBLIC_PWA_ABORT=USE_PLAN_APPLY_OR_ROLLBACK";exit 2;
}
if [[ "$MODE" == --rollback ]];then
 [[ "$#" -eq 2 && "$SHA" == I_APPROVE_PUBLIC_STATIC_ROLLBACK ]] || {
 echo "PUBLIC_PWA_ABORT=ROLLBACK_APPROVAL_REQUIRED";exit 2;
 }
else
 [[ "$SHA" =~ ^[a-f0-9]{40}$ && ( "$MODE" == --plan && "$#" -eq 2 ||
  "$MODE" == --apply && "$#" -eq 3 && "$APPROVAL" == I_APPROVE_PUBLIC_STATIC_18195_ONLY ) ]] || {
 echo "PUBLIC_PWA_ABORT=SHA_OR_APPLY_APPROVAL_INVALID";exit 2;
 }
fi
[[ "$MODE" == --plan || "$(id -u)" == 0 ]] || {
 echo "PUBLIC_PWA_ABORT=APPLY_REQUIRES_SUDO";exit 1;
}

BASE=/srv/talaeats-pwa
CURRENT="$BASE/current"
PREVIOUS="$BASE/previous-public"
BACKUP_BASE="$BASE/backups"
HOST=web-talaeats.alan-palacios-dev.com
ORIGIN=http://127.0.0.1:18195
API=http://127.0.0.1:18190/api/v1/health
SRC="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DIST="$SRC/dist"
TARGET="$BASE/releases/$SHA"
SERVICE=""

for cmd in curl python3 sha256sum grep readlink stat cmp git;do
 command -v "$cmd" >/dev/null || { echo "PUBLIC_PWA_ABORT=MISSING_DEPENDENCY:$cmd";exit 1; }
done
[[ -L "$CURRENT" ]] || { echo "PUBLIC_PWA_ABORT=UNKNOWN_FRONTEND_CURRENT_LAYOUT";exit 1; }
OLD="$(readlink -f "$CURRENT")"
[[ "$OLD" == "$BASE"/releases/* && -d "$OLD" && -s "$OLD/index.html" ]] || {
 echo "PUBLIC_PWA_ABORT=UNSAFE_CURRENT_TARGET";exit 1;
}
# Detect supported site config; reject foreign/modified layouts rather than
# guessing where the public domain is served from.
SERVER_CONFIG=""
for p in /etc/talaeats-web-pwa/server.conf /etc/nginx/sites-available/tala-eats-web-pwa.conf;do
 if [[ -f "$p" ]] && grep -Fq "listen 127.0.0.1:18195;" "$p" &&
  grep -Fq "root /srv/talaeats-pwa/current;" "$p" &&
  grep -Fq "server_name web-talaeats.alan-palacios-dev.com;" "$p";then
  SERVER_CONFIG="$p"
  break
 fi
done
[[ -n "$SERVER_CONFIG" ]] || { echo "PUBLIC_PWA_ABORT=UNRECOGNIZED_18195_SERVER_CONFIG";exit 1; }
if [[ "$SERVER_CONFIG" == /etc/talaeats-web-pwa/server.conf ]];then
 SERVICE=talaeats-web-pwa.service
else
 SERVICE=nginx.service
fi
systemctl is-active --quiet "$SERVICE" || { echo "PUBLIC_PWA_ABORT=PUBLIC_NGINX_SERVICE_NOT_ACTIVE";exit 1; }
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/clientes" |
 grep -Fq '<div id="root">' || { echo "PUBLIC_PWA_ABORT=EXISTING_18195_ROUTE_UNHEALTHY";exit 1; }
curl -fsS --max-time 8 "$API" | python3 -c '
import json,sys
x=json.load(sys.stdin)
if x.get("status") != "ok" or x.get("production") is not True:
 raise SystemExit("PUBLIC_PWA_ABORT=BACKEND_LIVE_HEALTH_MISMATCH")
print("PUBLIC_PWA_BACKEND_LIVE=PASS")
'
if [[ "$MODE" == --rollback ]];then
 [[ -L "$PREVIOUS" ]] || { echo "PUBLIC_PWA_ABORT=NO_PREVIOUS_PUBLIC_RELEASE";exit 1; }
 BACK="$(readlink -f "$PREVIOUS")"
 [[ "$BACK" == "$BASE"/releases/* && -s "$BACK/index.html" && "$BACK" != "$OLD" ]] || {
  echo "PUBLIC_PWA_ABORT=INVALID_BACKUP_RELEASE";exit 1;
 }
 [[ ! -f "$BACK/index.html" ]] || ! grep -Fq 'tala-preview-mode' "$BACK/index.html" || {
  echo "PUBLIC_PWA_ABORT=BACKUP_IS_PREVIEW_BUILD";exit 1;
 }
 TMP="$BASE/.rollback-current-$$"
 ln -s "$BACK" "$TMP"
 mv -Tf "$TMP" "$CURRENT"
 if ! curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/clientes" | cmp -s - "$BACK/index.html";then
  ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$CURRENT"
  echo "PUBLIC_PWA_ROLLBACK=FAILED_OLD_RESTORED";exit 1
 fi
 TMP="$BASE/.rollback-previous-$$"
 ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$PREVIOUS"
 echo "PUBLIC_PWA_ROLLBACK=PASS"
 echo "PUBLIC_PWA_ACTIVE_RELEASE=$BACK"
 exit 0
fi

[[ -d "$SRC" && ! -L "$SRC" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo "PUBLIC_PWA_ABORT=PINNED_SOURCE_OR_DIST_MISSING";exit 1;
}
[[ "$(git -c safe.directory="$SRC" -C "$SRC" rev-parse HEAD)" == "$SHA" ]] || {
 echo "PUBLIC_PWA_ABORT=CHECKOUT_SHA_MISMATCH";exit 1;
}
[[ -z "$(git -c safe.directory="$SRC" -C "$SRC" status --porcelain --untracked-files=no)" ]] || {
 echo "PUBLIC_PWA_ABORT=CHECKOUT_DIRTY";exit 1;
}
for asset in index.html sw.js offline.html manifest.webmanifest \
 manifest-clientes.webmanifest manifest-restaurante.webmanifest \
 manifest-repartidor.webmanifest icons/icon-192.png icons/icon-512.png;do
 [[ -s "$DIST/$asset" ]] || { echo "PUBLIC_PWA_ABORT=MISSING_DIST_FILE:$asset";exit 1; }
done
[[ -z "$(find "$DIST" -type l -print -quit)" ]] || { echo "PUBLIC_PWA_ABORT=DIST_SYMLINKS";exit 1; }
[[ -z "$(find "$DIST" -type f \( -name '*.key' -o -name '*.pem' -o -name '.env*' \) -print -quit)" ]] || {
 echo "PUBLIC_PWA_ABORT=SECRET_FILES_IN_DIST";exit 1;
}
if grep -Fq 'name="tala-preview-mode"' "$DIST/index.html";then
 echo "PUBLIC_PWA_ABORT=READONLY_PREVIEW_BUILD_NOT_FOR_PUBLIC";exit 1;
fi
[[ "$OLD" != "$TARGET" ]] || { echo "PUBLIC_PWA_ABORT=ALREADY_ACTIVE_SHA";exit 1; }
[[ ! -e "$TARGET" && ! -L "$TARGET" ]] || { echo "PUBLIC_PWA_ABORT=RELEASE_SHA_ALREADY_EXISTS";exit 1; }
[[ -z "${VITE_PREVIEW_READONLY:-}" ]] || {
 echo "PUBLIC_PWA_ABORT=PREVIEW_ENV_MUST_BE_UNSET";exit 1;
}
echo "PUBLIC_PWA_CURRENT=$OLD"
echo "PUBLIC_PWA_TARGET=$TARGET"
echo "PUBLIC_PWA_CONFIG=$SERVER_CONFIG"
echo "PUBLIC_PWA_STATIC_ONLY=YES"
if [[ "$MODE" == --plan ]];then
 echo "PUBLIC_PWA_PLAN=PASS_READ_ONLY"
 echo "PUBLIC_PWA_DOMAIN=https://$HOST/clientes"
 exit 0
fi

# Backup current bytes AND retain the existing release before switching.
mkdir -p -m 755 "$BACKUP_BASE" "$BASE/releases"
BACKUP="$BACKUP_BASE/$(basename "$OLD")-before-$SHA"
[[ ! -e "$BACKUP" ]] || { echo "PUBLIC_PWA_ABORT=BACKUP_NAME_COLLISION";exit 1; }
cp -a -- "$OLD" "$BACKUP"
[[ -s "$BACKUP/index.html" ]] && cmp -s "$BACKUP/index.html" "$OLD/index.html" || {
 echo "PUBLIC_PWA_ABORT=BACKUP_VERIFICATION_FAILED";exit 1;
}
CREATED=no
SWITCHED=no
rollback_on_error(){
 local code=$?
 trap - EXIT
 if [[ "$code" -ne 0 ]];then
  if [[ "$SWITCHED" == yes ]];then
   local tmp="$BASE/.restore-$$"
   ln -s "$OLD" "$tmp";mv -Tf "$tmp" "$CURRENT" || true
  fi
  if [[ "$CREATED" == yes ]];then rm -rf -- "$TARGET";fi
  echo "PUBLIC_PWA_APPLY=FAILED_OLD_FRONTEND_RESTORED_CHECK_MANUALLY"
 fi
 exit "$code"
}
trap rollback_on_error EXIT

mkdir -m 755 "$TARGET"
CREATED=yes
cp -a -- "$DIST/." "$TARGET/"
# Keep immutable old hashed assets temporarily to protect clients with
# previously cached HTML during the upgrade; never overwrite new assets.
if [[ -d "$OLD/assets" && -d "$TARGET/assets" ]];then
 cp -an -- "$OLD/assets/." "$TARGET/assets/"
fi
chmod -R a+rX,go-w "$TARGET"
cmp -s "$DIST/index.html" "$TARGET/index.html" || { echo "PUBLIC_PWA_ABORT=COPY_FAILED";exit 1; }
TMP="$BASE/.public-current-$$"
ln -s "$TARGET" "$TMP"
mv -Tf "$TMP" "$CURRENT"
SWITCHED=yes

# No nginx reload needed: root resolves the /current symlink each request.
# Validate actual HTTP index and one backend read after the switch.
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/clientes" |
 cmp -s - "$DIST/index.html" || { echo "PUBLIC_PWA_ABORT=18195_SERVED_WRONG_RELEASE";exit 1; }
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/api/v1/health" |
 python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("status")=="ok"' || {
 echo "PUBLIC_PWA_ABORT=PROXY_FAILED";exit 1;
}

TMP="$BASE/.previous-public-$$"
ln -s "$OLD" "$TMP";mv -Tf "$TMP" "$PREVIOUS"
SWITCHED=no
CREATED=no
trap - EXIT
echo "PUBLIC_PWA_DEPLOY=PASS"
echo "PUBLIC_PWA_PINNED_SHA=$SHA"
echo "PUBLIC_PWA_BACKUP=$BACKUP"
echo "PUBLIC_PWA_URL=https://$HOST/clientes"
echo "PUBLIC_PWA_BACKEND_PM2_CLOUDFLARED_STRIPE=UNMODIFIED"
