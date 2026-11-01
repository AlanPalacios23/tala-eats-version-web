#!/usr/bin/env bash
# RC169: no-login, no-cookie public HTTPS smoke for isolated Restaurantes PWA.
set -Eeuo pipefail
set +x
umask 077
if [[ "$#" -ne 2 ]];then
 echo 'USAGE: bash deploy/rc169-restaurantes-smoke.sh SHA40 https://restaurantes-talaeats.alan-palacios-dev.com'
 exit 2
fi
SHA="$1";BASE="$2"
[[ "$SHA" =~ ^[a-f0-9]{40}$ && "$BASE" == https://restaurantes-talaeats.alan-palacios-dev.com ]] || {
 echo 'RC169_PUBLIC=HOLD_INVALID_SHA_OR_MERCHANT_DOMAIN';exit 2;
}
for bin in curl python3;do command -v "$bin" >/dev/null || {
 echo "RC169_PUBLIC=HOLD_DEPENDENCY:$bin";exit 2;
};done
DIR="$(mktemp -d)"
trap 'rm -rf -- "$DIR"' EXIT
get(){
 local key="$1" path="$2" expected="200" status
 if [[ "$#" -eq 3 ]];then expected="$3";fi
 status="$(curl -q --silent --show-error --max-time 15 --max-redirs 0 \
  -H 'Cache-Control: no-cache' -o "$DIR/$key.body" -D "$DIR/$key.headers" \
  -w '%{http_code}' "$BASE$path")" || {
  echo "RC169_PUBLIC=HOLD_NETWORK:$key";exit 1;
 }
 if [[ "$status" != "$expected" ]];then echo "RC169_PUBLIC=HOLD_HTTP:$key:$status";exit 1;fi
}
get app /restaurante
get menu '/restaurante?tab=menu'
get wallet '/restaurante?tab=wallet'
get manifest /manifest-restaurante.webmanifest
get worker /sw-restaurante.js
get icon180 /icons/restaurante-180.png
get icon192 /icons/restaurante-192.png
get icon512 /icons/restaurante-512.png
# Existing isolated nginx must NOT expose Customer and Driver apps on this origin.
get clients /clientes 404
get driver /repartidor 404
get generic_worker /sw.js 404
python3 - "$DIR" "$SHA" <<'PY'
import json,pathlib,struct,sys
root=pathlib.Path(sys.argv[1]);sha=sys.argv[2]
def hold(reason):
 print('RC169_PUBLIC=HOLD_'+reason);raise SystemExit(1)
pages=[(root/(name+'.body')).read_text('utf8',errors='replace') for name in ('app','menu','wallet')]
stamp='<meta name="tala-release-sha" content="'+sha+'"/>'
if any(stamp not in p or '<div id="root"></div>' not in p for p in pages):
 hold('PUBLIC_SHA_OR_HTML_MISMATCH')
if any('src="/assets/' not in p for p in pages):
 hold('VITE_ASSET_MISSING_FROM_HTML')
try:manifest=json.loads((root/'manifest.body').read_text())
except Exception:hold('INVALID_MANIFEST')
if manifest.get('id')!='/app-restaurante' or manifest.get('start_url')!='/restaurante' or manifest.get('display')!='standalone':
 hold('MANIFEST_IDENTITY')
worker=(root/'worker.body').read_text('utf8',errors='replace')
if 'MERCHANT_APPROVE_UPDATE' not in worker or "url.pathname.startsWith('/api/')" not in worker:
 hold('WORKER_SECURITY')
for size in (180,192,512):
 raw=(root/('icon'+str(size)+'.body')).read_bytes()
 if raw[:8]!=b'\x89PNG\r\n\x1a\n' or len(raw)<25 or struct.unpack('>II',raw[16:24])!=(size,size):
  hold('ICON_'+str(size))
for name in ('app','manifest','worker'):
 header=(root/(name+'.headers')).read_text('latin1').lower()
 if 'cache-control:' not in header or ('no-cache' not in header and 'no-store' not in header):
  hold('CACHE_POLICY_'+name)
print('RC169_PUBLIC_SHA=PASS')
print('RC169_PUBLIC_ISOLATED_ROUTES=PASS')
print('RC169_PUBLIC_PWA=PASS')
print('RC169_PUBLIC=PASS_READ_ONLY')
PY
