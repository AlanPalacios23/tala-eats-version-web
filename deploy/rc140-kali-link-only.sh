#!/usr/bin/env bash
# RC140: add a single click-link bridge to the EXISTING public customer build.
# Never rebuild/replace the live SPA, restart Nginx, change systemd, PM2, DB,
# Stripe, Cloudflare or the independent Restaurant/Driver PWAs.
set -Eeuo pipefail
set +x
umask 022

MODE="${1:-}" SHA="${2:-}" APPROVAL="${3:-}"
if [[ "$MODE" == --plan ]];then
 [[ "$#" == 2 && "$SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
elif [[ "$MODE" == --apply ]];then
 [[ "$#" == 3 && "$SHA" =~ ^[a-f0-9]{40}$ &&
 "$APPROVAL" == I_APPROVE_RC140_LINK_ONLY_STATIC_18195 ]] || exit 2
elif [[ "$MODE" == --rollback ]];then
 [[ "$#" == 2 && "$SHA" == I_APPROVE_RC140_LINK_ONLY_ROLLBACK ]] || exit 2
else echo RC140=HOLD_INVALID_ARGUMENTS;exit 2;fi

[[ "$(id -u)" == 0 ]] || { echo RC140=HOLD_ROOT_REQUIRED;exit 2; }
BASE=/srv/talaeats-pwa
CURRENT="$BASE/current"
PREVIOUS="$BASE/previous-public"
HOST=web-talaeats.alan-palacios-dev.com
ORIGIN=http://127.0.0.1:18195
SERVICE=talaeats-web-pwa.service
TARGET_URL=https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
BRIDGE="$SOURCE/public/rc140-driver-link.js"
for bin in curl git python3 grep readlink cmp cp mv ln systemctl;do
 command -v "$bin" >/dev/null || { echo "RC140=HOLD_MISSING_$bin";exit 2; }
done
[[ -L "$CURRENT" ]] || { echo RC140=HOLD_CURRENT_NOT_SYMLINK;exit 2; }
OLD="$(readlink -f "$CURRENT")"
[[ "$OLD" == "$BASE"/releases/* && -s "$OLD/index.html" &&
 -s "$OLD/sw.js" ]] || { echo RC140=HOLD_INVALID_ACTIVE_RELEASE;exit 2; }
systemctl is-active --quiet "$SERVICE" || {
 echo RC140=HOLD_MAIN_SITE_NOT_ACTIVE;exit 2;
}
[[ -f /etc/talaeats-web-pwa/server.conf &&
 ! -L /etc/talaeats-web-pwa/server.conf ]] || exit 2
for marker in 'listen 127.0.0.1:18195;'  'server_name web-talaeats.alan-palacios-dev.com;'  'root /srv/talaeats-pwa/current;'  "script-src 'self'";do
 grep -Fq "$marker" /etc/talaeats-web-pwa/server.conf || {
  echo RC140=HOLD_SITE_IDENTITY_OR_CSP;exit 2;
 }
done
curl -fsS --connect-timeout 3 --max-time 10 -H "Host: $HOST"  "$ORIGIN/clientes" | cmp -s - "$OLD/index.html" || {
 echo RC140=HOLD_LIVE_SERVED_BYTES_MISMATCH;exit 2;
}
curl -fsS --connect-timeout 3 --max-time 10 -H "Host: $HOST"  "$ORIGIN/api/v1/health" | python3 -c  'import json,sys;x=json.load(sys.stdin);assert x.get("status")=="ok" and x.get("production") is True' || {
 echo RC140=HOLD_BACKEND_PROXY;exit 2;
}

if [[ "$MODE" == --rollback ]];then
 [[ "$(basename "$OLD")" == rc140-driver-link-* &&
 -L "$PREVIOUS" ]] || { echo RC140_ROLLBACK=HOLD_NO_RC140_OR_PREVIOUS;exit 2; }
 BACK="$(readlink -f "$PREVIOUS")"
 [[ "$BACK" == "$BASE"/releases/* && "$BACK" != "$OLD" &&
 -s "$BACK/index.html" ]] || exit 2
 TEMP="$BASE/.rc140-rollback-$$"
 trap 'rm -f -- "$TEMP"' EXIT
 ln -s "$BACK" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
 if ! curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN/clientes" |
 cmp -s - "$BACK/index.html";then
  ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$CURRENT"
  echo RC140_ROLLBACK=HOLD_RESTORED_NEWER_RELEASE;exit 1
 fi
 echo RC140_ROLLBACK=PASS_PREVIOUS_FRONTEND_RESTORED
 exit 0
fi

[[ "$(git -C "$SOURCE" rev-parse HEAD)" == "$SHA" &&
 -z "$(git -C "$SOURCE" status --porcelain --untracked-files=no)" &&
 -s "$BRIDGE" ]] || { echo RC140=HOLD_SOURCE_SHA_OR_ASSET;exit 2; }
node_readme_not_needed=true
[[ ! -e "$OLD/rc140-driver-link.js" ]] || {
 echo RC140=HOLD_BRIDGE_ALREADY_PRESENT;exit 2;
}
grep -Fq '<div id="root">' "$OLD/index.html" || {
 echo RC140=HOLD_NOT_CUSTOMER_REACT_HTML;exit 2;
}
grep -Fq '</body>' "$OLD/index.html" || {
 echo RC140=HOLD_UNEXPECTED_HTML;exit 2;
}
! grep -Fq 'src="/rc140-driver-link.js"' "$OLD/index.html" || {
 echo RC140=HOLD_ALREADY_PATCHED;exit 2;
}
curl -fsS --connect-timeout 3 --max-time 10 -o /dev/null "$TARGET_URL" || {
 echo RC140=HOLD_OFFICIAL_DRIVER_ACCESS_UNAVAILABLE;exit 2;
}
DEST="$BASE/releases/rc140-driver-link-$SHA"
[[ "$OLD" != "$DEST" && ! -e "$DEST" && ! -L "$DEST" ]] || {
 echo RC140=HOLD_TARGET_ALREADY_EXISTS;exit 2;
}
echo "RC140_ACTIVE_FRONTEND=$OLD"
echo "RC140_TARGET_FRONTEND=$DEST"
echo "RC140_TARGET_LINK=$TARGET_URL"
echo RC140_SCOPE=ONLY_MAIN_STATIC_HTML_AND_ONE_JS_LINK_HELPER
echo RC140_NGINX_BACKEND_DRIVER_RESTAURANTS_STRIPE=UNMODIFIED
if [[ "$MODE" == --plan ]];then
 echo RC140_PLAN=PASS_READ_ONLY
 exit 0
fi

mkdir -m 755 "$DEST"
CREATED=yes
SWITCHED=no
recover(){
 local status=$?
 trap - EXIT
 if [[ "$status" -ne 0 ]];then
  if [[ "$SWITCHED" == yes ]];then
   local tmp="$BASE/.rc140-recover-$$"
   ln -s "$OLD" "$tmp"
   mv -Tf "$tmp" "$CURRENT" || true
  fi
  if [[ "$CREATED" == yes ]];then rm -rf -- "$DEST";fi
  echo RC140_DEPLOY=FAILED_PREVIOUS_SYMLINK_RESTORED_CHECK_HTTP
 fi
 exit "$status"
}
trap recover EXIT
cp -a -- "$OLD/." "$DEST/"
cp -- "$BRIDGE" "$DEST/rc140-driver-link.js"
python3 - "$DEST/index.html" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
raw=p.read_bytes()
marker=b'<script defer src="/rc140-driver-link.js"></script>'
if raw.count(b'</body>')!=1 or marker in raw:
 raise SystemExit('RC140=HOLD_HTML_MARKER')
p.write_bytes(raw.replace(b'</body>',marker+b'</body>',1))
PY
chmod -R a+rX,go-w "$DEST"
# Every existing LIVE asset must be identical; only index.html gets one tag,
# and one new JS asset is allowed. No other customer files are overwritten.
while IFS= read -r -d '' file;do
 relative="${file#"$OLD"/}"
 [[ "$relative" == index.html ]] && continue
 cmp -s "$file" "$DEST/$relative" || {
  echo "RC140=HOLD_EXISTING_ASSET_CHANGED:$relative";exit 2;
 }
done < <(find "$OLD" -type f -print0)
cmp -s "$BRIDGE" "$DEST/rc140-driver-link.js" || exit 2
python3 - "$OLD/index.html" "$DEST/index.html" <<'PY'
import pathlib,sys
old=pathlib.Path(sys.argv[1]).read_bytes()
new=pathlib.Path(sys.argv[2]).read_bytes()
expected=old.replace(b'</body>',b'<script defer src="/rc140-driver-link.js"></script></body>',1)
assert new==expected, 'RC140=HOLD_MORE_THAN_ONE_HTML_CHANGE'
print('RC140_ONLY_ONE_HTML_SCRIPT_INJECTION=PASS')
PY

TEMP="$BASE/.rc140-current-$$"
ln -s "$DEST" "$TEMP";mv -Tf "$TEMP" "$CURRENT";SWITCHED=yes
curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN/clientes" |
 cmp -s - "$DEST/index.html" || { echo RC140=HOLD_NEW_HTML_NOT_SERVED;exit 1; }
curl -fsS --max-time 10 -H "Host: $HOST"  "$ORIGIN/rc140-driver-link.js" |
 cmp -s - "$DEST/rc140-driver-link.js" || {
 echo RC140=HOLD_LINK_ASSET_NOT_SERVED;exit 1;
}
curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN/api/v1/health" |
 python3 -c 'import json,sys;x=json.load(sys.stdin);assert x.get("status")=="ok"' || exit 1
curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN/restaurante" >/dev/null

TEMP="$BASE/.rc140-previous-$$"
ln -s "$OLD" "$TEMP";mv -Tf "$TEMP" "$PREVIOUS"
CREATED=no;SWITCHED=no
trap - EXIT
echo RC140_DEPLOY=PASS_LINK_ONLY_STATIC_NO_NGINX_RELOAD
echo "RC140_PREVIOUS_FRONTEND=$OLD"
