#!/usr/bin/env bash
# RC166 - read-only HTTPS smoke after publishing the Restaurante PWA.
# No logins, orders, payments, DB changes, service restarts or deployment actions.
set -Eeuo pipefail
set +x
umask 077
if [[ "$#" -lt 2 || "$#" -gt 3 ]];then
 echo 'USAGE: bash deploy/rc166-postdeploy-smoke.sh https://restaurantes-talaeats.example.com SHA40 [--check-api]'
 exit 2
fi
BASE="$1"
SHA="$2"
API_CHECK=""
if [[ "$#" -eq 3 ]];then API_CHECK="$3";fi
if [[ ! "$BASE" =~ ^https://[A-Za-z0-9.-]+$ || ! "$SHA" =~ ^[a-f0-9]{40}$ ||
 ( -n "$API_CHECK" && "$API_CHECK" != --check-api ) ]];then
 echo 'RC166_SMOKE=HOLD_INVALID_ARGUMENTS'
 exit 2
fi
for program in curl python3;do
 command -v "$program" >/dev/null || { echo "RC166_SMOKE=HOLD_MISSING_DEPENDENCY:$program";exit 2; }
done
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
download(){
 local id="$1" route="$2" status
 # Never pass cookies or credentials. Do not follow redirects to other domains.
 status="$(curl -q --silent --show-error --max-time 15 --max-redirs 0 \
    -H 'Accept: */*' -H 'Cache-Control: no-cache' \
    --output "$WORK/$id.body" --dump-header "$WORK/$id.headers" \
    --write-out '%{http_code}' "$BASE$route")" || {
      echo "RC166_SMOKE=HOLD_NETWORK:$id";exit 1;
    }
 [[ "$status" == 200 ]] || { echo "RC166_SMOKE=HOLD_HTTP:$id:$status";exit 1; }
}
echo "RC166_TARGET=$BASE"
echo "RC166_EXPECTED_SHA=$SHA"
download app /restaurante
download manifest /manifest-restaurante.webmanifest
download release /release.json
download worker /sw.js
download icon180 /icons/restaurante-180.png
download icon192 /icons/restaurante-192.png
download icon512 /icons/restaurante-512.png
# Additional tab deep link: must serve the SPA, never a 404 or a redirect.
download wallet '/restaurante?tab=wallet'
if [[ "$API_CHECK" == --check-api ]];then download ready /api/v1/ready;fi
python3 - "$WORK" "$SHA" "$API_CHECK" <<'PY'
import datetime,json,pathlib,struct,sys
folder=pathlib.Path(sys.argv[1]); expected=sys.argv[2]; api_check=sys.argv[3]=='--check-api'
def hold(tag):
 print('RC166_SMOKE=HOLD_'+tag)
 raise SystemExit(1)
def load(name):
 try:return json.loads((folder/(name+'.body')).read_text('utf-8'))
 except (ValueError,UnicodeDecodeError,OSError):hold('INVALID_JSON_'+name)
app=(folder/'app.body').read_text('utf-8',errors='replace')
wallet=(folder/'wallet.body').read_text('utf-8',errors='replace')
if '<div id="root"></div>' not in app or '<div id="root"></div>' not in wallet:
 hold('SPA_NOT_RENDERED')
release=load('release')
if release.get('app')!='tala-eats-restaurantes-pwa' or release.get('source_sha')!=expected:
 hold('RELEASE_SHA_MISMATCH')
stamp=release.get('built_at')
try:
 date=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))
 if date.tzinfo is None:raise ValueError('no timezone')
except (TypeError,AttributeError,ValueError):hold('RELEASE_TIMESTAMP_INVALID')
manifest=load('manifest')
if manifest.get('id')!='/app-restaurante' or manifest.get('start_url')!='/restaurante' or manifest.get('display')!='standalone':
 hold('MANIFEST_IDENTITY')
icons=manifest.get('icons',[])
if not isinstance(icons,list) or sorted(i.get('src','') for i in icons if isinstance(i,dict))!=[
 '/icons/restaurante-192.png','/icons/restaurante-512.png']:
 hold('MANIFEST_ICONS')
for size in (180,192,512):
 p=(folder/('icon%d.body'%size)).read_bytes()
 if len(p)<25 or p[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',p[16:24])!=(size,size):
  hold('ICON_INVALID_%d'%size)
worker=(folder/'worker.body').read_text('utf-8',errors='replace')
if 'MERCHANT_APPROVE_UPDATE' not in worker or "url.pathname.startsWith('/api/')" not in worker:
 hold('UNSAFE_SERVICE_WORKER')
for name in ('app','manifest','release','worker'):
 header=(folder/(name+'.headers')).read_text('latin-1').lower()
 if name in ('manifest','release') and 'application/' not in header:
  hold('MISSING_JSON_CONTENT_TYPE_'+name)
 if 'cache-control:' not in header or 'no-store' not in header and 'no-cache' not in header:
  hold('MISSING_NO_CACHE_'+name)
if api_check:
 data=load('ready')
 if data.get('ready') is not True:hold('API_NOT_READY')
 print('RC166_API_READINESS=PASS_READ_ONLY')
print('RC166_STATIC_MANIFEST_ICONS=PASS')
print('RC166_SHA_MATCH=PASS')
print('RC166_SERVICE_WORKER_UPDATE=PASS')
print('RC166_SMOKE=PASS_READ_ONLY')
PY
