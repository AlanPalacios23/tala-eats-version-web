#!/usr/bin/env bash
# Update/rollback ONLY Restaurante isolated static site 18197; no config reload.
set -Eeuo pipefail
set +x
umask 022
MODE="${1:-}" SHA="${2:-}" APPROVAL="${3:-}"
ROOT='/srv/talaeats-restaurantes-pwa'
CURRENT="$ROOT/current"
PREVIOUS="$ROOT/previous"
BACKUPS="$ROOT/backups"
ORIGIN='http://127.0.0.1:18197'
HOST='restaurantes-talaeats.alan-palacios-dev.com'
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
SERVICE='talaeats-restaurantes-pwa.service'
if [[ "$MODE" == '--rollback' ]];then
 [[ "$#" -eq 2 && "$SHA" == 'I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY' ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=ROLLBACK_APPROVAL_INVALID';exit 2;
 }
elif [[ "$MODE" =~ ^--(plan|apply)$ ]];then
 [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=INVALID_SHA';exit 2;
 }
 if [[ "$MODE" == '--plan' && "$#" -ne 2 ]] ||
 [[ "$MODE" == '--apply' && ( "$#" -ne 3 || "$APPROVAL" != 'I_APPROVE_RESTAURANTES_STATIC_18197_ONLY' ) ]];then
 echo 'RESTAURANTES_STATIC_ABORT=EXPLICIT_APPROVAL_REQUIRED';exit 2;
 fi
else
 echo 'RESTAURANTES_STATIC_ABORT=USAGE: --plan SHA | --apply SHA APPROVAL | --rollback APPROVAL'
 exit 2
fi
[[ "$MODE" == '--plan' || "$(id -u)" == 0 ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=ROOT_REQUIRED';exit 2;
}
for bin in curl git cmp grep readlink python3 sha256sum;do
 command -v "$bin" >/dev/null || { echo "RESTAURANTES_STATIC_ABORT=MISSING:$bin";exit 2; }
done
[[ -L "$CURRENT" ]] || { echo 'RESTAURANTES_STATIC_ABORT=CURRENT_NOT_SYMLINK';exit 2; }
OLD="$(readlink -f "$CURRENT")"
[[ "$OLD" == "$ROOT"/releases/* && -s "$OLD/index.html" ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=INVALID_CURRENT_TARGET';exit 2;
}
grep -Fq 'listen 127.0.0.1:18197;' /etc/talaeats-restaurantes-pwa/server.conf &&
grep -Fq 'server_name restaurantes-talaeats.alan-palacios-dev.com;' /etc/talaeats-restaurantes-pwa/server.conf &&
grep -Fq 'root /srv/talaeats-restaurantes-pwa/current;' /etc/talaeats-restaurantes-pwa/server.conf || {
 echo 'RESTAURANTES_STATIC_ABORT=UNKNOWN_SERVER_CONFIG';exit 2;
}
systemctl is-active --quiet "$SERVICE" || {
 echo 'RESTAURANTES_STATIC_ABORT=ISOLATED_SERVICE_NOT_RUNNING';exit 2;
}
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
 cmp -s - "$OLD/index.html" || {
 echo 'RESTAURANTES_STATIC_ABORT=CURRENT_SERVED_BYTES_MISMATCH';exit 2;
}
if [[ "$MODE" == '--rollback' ]];then
 [[ -L "$PREVIOUS" ]] || { echo 'RESTAURANTES_STATIC_ABORT=NO_PREVIOUS';exit 2; }
 BACK="$(readlink -f "$PREVIOUS")"
 [[ "$BACK" == "$ROOT"/releases/* && "$BACK" != "$OLD" && -s "$BACK/index.html" ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=UNSAFE_PREVIOUS';exit 2;
 }
 TEMP="$ROOT/.rollback-$$"
 trap 'rm -f -- "$TEMP"' EXIT
 ln -s "$BACK" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
 if ! curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
 cmp -s - "$BACK/index.html";then
  ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
  echo 'RESTAURANTES_STATIC_ROLLBACK=FAILED_CURRENT_RESTORED';exit 1
 fi
 ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$PREVIOUS"
 trap - EXIT
 echo "RESTAURANTES_STATIC_ROLLBACK=PASS:$BACK"
 exit 0
fi
DEST="$ROOT/releases/$SHA"
[[ "$DEST" != "$OLD" && ! -e "$DEST" && ! -L "$DEST" ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=TARGET_ALREADY_EXISTS_OR_ACTIVE';exit 2;
}
[[ -d "$SOURCE" && ! -L "$SOURCE" && -d "$SOURCE/dist" && ! -L "$SOURCE/dist" ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=PINNED_BUILD_MISSING';exit 2;
}
[[ "$(git -c safe.directory="$SOURCE" -C "$SOURCE" rev-parse HEAD)" == "$SHA" &&
 -z "$(git -c safe.directory="$SOURCE" -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || {
 echo 'RESTAURANTES_STATIC_ABORT=PINNED_SHA_OR_TREE_UNSAFE';exit 2;
}
for asset in index.html sw.js manifest-restaurante.webmanifest;do
 [[ -s "$SOURCE/dist/$asset" ]] || { echo "RESTAURANTES_STATIC_ABORT=ASSET_MISSING:$asset";exit 2; }
done
grep -Fq 'name="tala-preview-mode"' "$SOURCE/dist/index.html" && {
 echo 'RESTAURANTES_STATIC_ABORT=PREVIEW_DIST_NOT_ALLOWED';exit 2;
}
echo "RESTAURANTES_STATIC_CURRENT=$OLD"
echo "RESTAURANTES_STATIC_TARGET=$DEST"
echo 'RESTAURANTES_STATIC_SCOPE=18197_ONLY'
if [[ "$MODE" == --plan ]];then
 echo 'RESTAURANTES_STATIC_PLAN=PASS_READ_ONLY'
 exit 0
fi
mkdir -p -m 755 "$BACKUPS"
BACKUP="$BACKUPS/$(basename "$OLD")-before-$SHA"
[[ ! -e "$BACKUP" ]] || { echo 'RESTAURANTES_STATIC_ABORT=BACKUP_NAME_COLLISION';exit 2; }
cp -a "$OLD" "$BACKUP"
cmp -s "$BACKUP/index.html" "$OLD/index.html" || {
 echo 'RESTAURANTES_STATIC_ABORT=BACKUP_FAILED';exit 2;
}
SWITCHED=no CREATED=no
recover(){
 local code=$?
 trap - EXIT
 if [[ "$code" -ne 0 ]];then
  if [[ "$SWITCHED" == yes ]];then
   local temp="$ROOT/.restore-$$"
   ln -s "$OLD" "$temp";mv -Tf "$temp" "$CURRENT" || true
  fi
  if [[ "$CREATED" == yes ]];then rm -rf -- "$DEST";fi
  echo 'RESTAURANTES_STATIC_APPLY=FAILED_OLD_RESTORED'
 fi
 exit "$code"
}
trap recover EXIT
mkdir -m 755 "$DEST";CREATED=yes
cp -a "$SOURCE/dist/." "$DEST/"
# Preserve original hashed assets while installed users transition versions.
if [[ -d "$OLD/assets" && -d "$DEST/assets" ]];then
 cp -an "$OLD/assets/." "$DEST/assets/"
fi
chmod -R a+rX,go-w "$DEST"
cmp -s "$SOURCE/dist/index.html" "$DEST/index.html" || exit 1
TEMP="$ROOT/.current-$$"
ln -s "$DEST" "$TEMP";mv -Tf "$TEMP" "$CURRENT";SWITCHED=yes
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
 cmp -s - "$DEST/index.html" || exit 1
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/api/v1/health" |
 python3 -c 'import json,sys;x=json.load(sys.stdin);assert x.get("status")=="ok" and x.get("production") is True' || exit 1
TEMP="$ROOT/.previous-$$"
ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$PREVIOUS"
SWITCHED=no;CREATED=no;trap - EXIT
echo 'RESTAURANTES_STATIC_DEPLOY=PASS'
echo "RESTAURANTES_STATIC_SHA=$SHA"
echo "RESTAURANTES_STATIC_BACKUP=$BACKUP"
echo 'RESTAURANTES_API_STRIPE_CUSTOMERS_PM2_CLOUDFLARED=UNMODIFIED'
