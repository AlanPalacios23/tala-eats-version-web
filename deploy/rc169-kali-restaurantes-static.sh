#!/usr/bin/env bash
# RC169 - update ONLY existing Tala Eats Restaurantes isolated site (18197).
# No nginx/systemd/cloudflared reloads, no backend, PM2, Redis, DB or Stripe writes.
set -Eeuo pipefail
set +x
umask 022
if [[ "$#" -lt 2 || "$#" -gt 3 ]];then
 echo 'USAGE: bash deploy/rc169-kali-restaurantes-static.sh --plan SHA40 | --apply SHA40 I_APPROVE_RC169_RESTAURANTES_STATIC_18197_ONLY | --rollback I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY'
 exit 2
fi
MODE="$1";SHA="$2";APPROVAL=""
if [[ "$#" -eq 3 ]];then APPROVAL="$3";fi
case "$MODE" in
 --plan)
  [[ "$#" -eq 2 && "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'RC169_ABORT=BAD_PLAN_ARGUMENTS';exit 2; };;
 --apply)
  [[ "$#" -eq 3 && "$SHA" =~ ^[0-9a-f]{40}$ && "$APPROVAL" == I_APPROVE_RC169_RESTAURANTES_STATIC_18197_ONLY && "$(id -u)" == 0 ]] || { echo 'RC169_ABORT=BAD_APPLY_OR_APPROVAL';exit 2; };;
 --rollback)
  [[ "$#" -eq 2 && "$SHA" == I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY && "$(id -u)" == 0 ]] || { echo 'RC169_ABORT=BAD_ROLLBACK_OR_APPROVAL';exit 2; };;
 *)
  echo 'RC169_ABORT=UNKNOWN_MODE';exit 2;;
esac
for bin in curl git cmp grep readlink python3 sha256sum systemctl;do
 command -v "$bin" >/dev/null || { echo "RC169_ABORT=MISSING_DEPENDENCY:$bin";exit 2; }
done
ROOT='/srv/talaeats-restaurantes-pwa'
CURRENT="$ROOT/current"
PREVIOUS="$ROOT/previous"
BACKUPS="$ROOT/backups"
HOST='restaurantes-talaeats.alan-palacios-dev.com'
ORIGIN='http://127.0.0.1:18197'
SERVICE='talaeats-restaurantes-pwa.service'
CONFIG='/etc/talaeats-restaurantes-pwa/server.conf'
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
[[ -L "$CURRENT" ]] || { echo 'RC169_ABORT=NO_CURRENT_SYMLINK';exit 2; }
OLD="$(readlink -f -- "$CURRENT")"
[[ "$OLD" == "$ROOT"/releases/* && -s "$OLD/restaurantes.html" ]] || {
 echo 'RC169_ABORT=UNKNOWN_ACTIVE_RELEASE';exit 2;
}
[[ -f "$CONFIG" ]] || { echo 'RC169_ABORT=NO_ISOLATED_SERVER_CONFIG';exit 2; }
for needle in \
 'listen 127.0.0.1:18197;' \
 'server_name restaurantes-talaeats.alan-palacios-dev.com;' \
 'root /srv/talaeats-restaurantes-pwa/current;' \
 'location = /sw-restaurante.js';do
 grep -Fq "$needle" "$CONFIG" || { echo 'RC169_ABORT=UNKNOWN_18197_CONFIG';exit 2; }
done
systemctl is-active --quiet "$SERVICE" || { echo 'RC169_ABORT=MERCHANT_SITE_NOT_ACTIVE';exit 2; }
# Nginx must currently be serving bytes from this symlink, not a different release.
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
 cmp -s - "$OLD/restaurantes.html" || { echo 'RC169_ABORT=ACTIVE_HTML_NOT_SERVED';exit 2; }
health(){
 curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/api/v1/health" |
 python3 -c 'import json,sys;x=json.load(sys.stdin);assert x.get("status")=="ok" and x.get("production") is True' || {
  echo 'RC169_ABORT=EXISTING_LIVE_API_HEALTH_FAILED';return 1;
 }
}
# GET only. Does not inspect, echo or modify tokens/secrets.
health
if [[ "$MODE" == --rollback ]];then
 [[ -L "$PREVIOUS" ]] || { echo 'RC169_ABORT=NO_PREVIOUS_ROLLBACK_TARGET';exit 2; }
 BACK="$(readlink -f -- "$PREVIOUS")"
 [[ "$BACK" == "$ROOT"/releases/* && "$BACK" != "$OLD" && -s "$BACK/restaurantes.html" ]] || {
  echo 'RC169_ABORT=INVALID_ROLLBACK_TARGET';exit 2;
 }
 TEMP="$ROOT/.rc169-rollback-$$"
 trap 'rm -f -- "$TEMP"' EXIT
 ln -s "$BACK" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
 if ! curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
   cmp -s - "$BACK/restaurantes.html";then
  ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
  echo 'RC169_ROLLBACK=FAILED_CURRENT_RESTORED';exit 1
 fi
 ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$PREVIOUS"
 trap - EXIT
 echo "RC169_RESTAURANTES_ROLLBACK=PASS:$BACK"
 exit 0
fi
DEST="$ROOT/releases/$SHA"
[[ "$DEST" != "$OLD" && ! -e "$DEST" && ! -L "$DEST" ]] || {
 echo 'RC169_ABORT=RELEASE_ALREADY_EXISTS_OR_ACTIVE';exit 2;
}
DIST="$SOURCE/dist-restaurantes"
[[ -d "$SOURCE" && ! -L "$SOURCE" && -d "$DIST" && ! -L "$DIST" ]] || {
 echo 'RC169_ABORT=MERCHANT_BUILD_NOT_PREPARED';exit 2;
}
[[ "$(git -c safe.directory="$SOURCE" -C "$SOURCE" rev-parse HEAD 2>/dev/null)" == "$SHA" &&
 -z "$(git -c safe.directory="$SOURCE" -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || {
 echo 'RC169_ABORT=SOURCE_SHA_OR_TRACKED_FILES_MISMATCH';exit 2;
}
for f in restaurantes.html sw-restaurante.js manifest-restaurante.webmanifest offline.html \
 icons/restaurante-180.png icons/restaurante-192.png icons/restaurante-512.png release.json;do
 [[ -s "$DIST/$f" ]] || { echo "RC169_ABORT=MISSING_STATIC_ASSET:$f";exit 2; }
done
[[ ! -e "$DIST/index.html" ]] || { echo 'RC169_ABORT=GENERIC_WEB_INDEX_IN_RESTAURANT_BUNDLE';exit 2; }
if find "$DIST" -type l -print -quit | grep -q .;then
 echo 'RC169_ABORT=UNSAFE_SYMLINK_IN_DIST';exit 2;
fi
if find "$DIST" -type f \( -name '.env*' -o -name '*.pem' -o -name '*.key' \) -print -quit | grep -q .;then
 echo 'RC169_ABORT=SECRET_LIKE_FILE_IN_DIST';exit 2;
fi
python3 - "$DIST" "$SHA" <<'PY'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]); sha=sys.argv[2]
meta=json.loads((root/'release.json').read_text())
manifest=json.loads((root/'manifest-restaurante.webmanifest').read_text())
html=(root/'restaurantes.html').read_text()
sw=(root/'sw-restaurante.js').read_text()
if meta.get('source_sha')!=sha or meta.get('app')!='tala-eats-restaurantes-pwa':
 raise SystemExit('RC169_ABORT=BUILT_RELEASE_SHA_INVALID')
if manifest.get('id')!='/app-restaurante' or manifest.get('start_url')!='/restaurante' or manifest.get('display')!='standalone':
 raise SystemExit('RC169_ABORT=MERCHANT_MANIFEST_INVALID')
if '<meta name="tala-release-sha" content="'+sha+'"/>' not in html or 'src="/assets/' not in html or '/manifest-restaurante.webmanifest' not in html:
 raise SystemExit('RC169_ABORT=WRONG_MERCHANT_HTML_OR_RELEASE_MARKER')
if 'MERCHANT_APPROVE_UPDATE' not in sw or "url.pathname.startsWith('/api/')" not in sw:
 raise SystemExit('RC169_ABORT=UNSAFE_WORKER')
print('RC169_BUNDLE_GATES=PASS')
PY
echo "RC169_CURRENT=$OLD"
echo "RC169_TARGET=$DEST"
echo 'RC169_SCOPE=RESTAURANTES_18197_ONLY'
if [[ "$MODE" == --plan ]];then
 echo 'RC169_RESTAURANTES_PLAN=PASS_READ_ONLY'
 exit 0
fi
mkdir -p -m 755 "$BACKUPS"
BACKUP="$BACKUPS/$(basename "$OLD")-before-$SHA"
[[ ! -e "$BACKUP" && ! -L "$BACKUP" ]] || { echo 'RC169_ABORT=BACKUP_COLLISION';exit 2; }
cp -a "$OLD" "$BACKUP"
cmp -s "$OLD/restaurantes.html" "$BACKUP/restaurantes.html" || {
 echo 'RC169_ABORT=BACKUP_UNVERIFIED';exit 2;
}
SWITCHED=no;CREATED=no
recover(){
 local code=$?
 trap - EXIT
 if [[ "$code" -ne 0 ]];then
  if [[ "$SWITCHED" == yes ]];then
   local tmp="$ROOT/.rc169-recover-$$"
   ln -s "$OLD" "$tmp";mv -Tf "$tmp" "$CURRENT" || true
  fi
  if [[ "$CREATED" == yes ]];then rm -rf -- "$DEST";fi
  echo 'RC169_RESTAURANTES_APPLY=FAILED_PREVIOUS_RESTORED'
 fi
 exit "$code"
}
trap recover EXIT
mkdir -m 755 "$DEST";CREATED=yes
cp -a "$DIST/." "$DEST/"
# Keep old hashed assets reachable while existing installed clients transition.
if [[ -d "$OLD/assets" && -d "$DEST/assets" ]];then cp -an "$OLD/assets/." "$DEST/assets/";fi
chmod -R a+rX,go-w "$DEST"
cmp -s "$DIST/restaurantes.html" "$DEST/restaurantes.html"
TEMP="$ROOT/.rc169-current-$$"
ln -s "$DEST" "$TEMP";mv -Tf "$TEMP" "$CURRENT";SWITCHED=yes
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/restaurante" |
 cmp -s - "$DEST/restaurantes.html"
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/sw-restaurante.js" |
 cmp -s - "$DEST/sw-restaurante.js"
curl -fsS --max-time 8 -H "Host: $HOST" "$ORIGIN/manifest-restaurante.webmanifest" |
 cmp -s - "$DEST/manifest-restaurante.webmanifest"
for size in 180 192 512;do
 curl -fsS --max-time 8 -o /dev/null -H "Host: $HOST" "$ORIGIN/icons/restaurante-$size.png"
done
# One immutable JS file from the compiled HTML must be served correctly.
JS="$(python3 - "$DEST/restaurantes.html" <<'PY'
import pathlib,re,sys
s=pathlib.Path(sys.argv[1]).read_text()
m=re.search(r'<script[^>]+src="(/assets/[^"]+\.js)"',s)
if not m:raise SystemExit('RC169_ABORT=NO_PRODUCTION_JS_ASSET')
print(m.group(1))
PY
)"
curl -fsS --max-time 8 -o /dev/null -H "Host: $HOST" "$ORIGIN$JS"
health
TEMP="$ROOT/.rc169-previous-$$"
ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$PREVIOUS"
SWITCHED=no;CREATED=no;trap - EXIT
echo 'RC169_RESTAURANTES_DEPLOY=PASS'
echo "RC169_RESTAURANTES_SHA=$SHA"
echo "RC169_RESTAURANTES_BACKUP=$BACKUP"
echo 'RC169_RESTAURANTES_SCOPE=18197_ONLY'
echo 'RC169_CUSTOMERS_DRIVERS_PM2_STRIPE_DB_CLOUDFLARED=UNMODIFIED'
