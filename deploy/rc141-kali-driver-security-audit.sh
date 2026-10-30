#!/usr/bin/env bash
# READ-ONLY driver-security gate for an existing isolated Nginx 18199.
# Does not reload, restart, chmod/chown, edit config, access secrets or create orders.
set -Eeuo pipefail
set +x
umask 077
MODE="${1:---audit}"
[[ "$#" -le 1 && ( "$MODE" == --audit || "$MODE" == --public ) ]] || {
 echo 'RC141_SECURITY=HOLD_USAGE';exit 2;
}
HOST=repartidores-talaeats.alan-palacios-dev.com
URL="http://127.0.0.1:18199"
[[ "$MODE" == --public ]] && URL="https://$HOST"
for command in curl python3 mktemp;do command -v "$command" >/dev/null || {
 echo 'RC141_SECURITY=HOLD_MISSING_DEPENDENCY';exit 2;
};done
if [[ "$MODE" == --audit ]];then
 systemctl is-active --quiet talaeats-repartidores-pwa.service || {
  echo 'RC141_SECURITY=HOLD_DRIVER_SERVICE';exit 2;
 }
 [[ -f /etc/talaeats-repartidores-pwa/server.conf ]] || {
  echo 'RC141_SECURITY=HOLD_CONFIG_NOT_FOUND';exit 2;
 }
 grep -Fq 'listen 127.0.0.1:18199;' /etc/talaeats-repartidores-pwa/server.conf || {
  echo 'RC141_SECURITY=HOLD_PORT_IDENTITY';exit 2;
 }
fi
HEADERS="$(mktemp)"
trap 'rm -f -- "$HEADERS"' EXIT
for route in /repartidor /repartidor/acceso /repartidor/registro \
 /sw-repartidor.js /manifest-repartidor.webmanifest /api/v1/health;do
 : > "$HEADERS"
 code="$(curl -sS --noproxy '*' --connect-timeout 4 --max-time 12 \
  -H "Host: $HOST" -D "$HEADERS" -o /dev/null -w '%{http_code}' \
  "$URL$route")" || { echo 'RC141_SECURITY=HOLD_HTTP_CONNECTIVITY';exit 2; }
 [[ "$code" == 200 ]] || { echo "RC141_SECURITY=HOLD_HTTP_CODE_$code";exit 2; }
 python3 - "$HEADERS" "$route" <<'PY'
import sys
headers={}
for line in open(sys.argv[1],encoding='iso-8859-1'):
 if ':' not in line: continue
 key,value=line.split(':',1)
 headers[key.lower().strip()]=value.strip()
route=sys.argv[2]
mandatory={
 'x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'self'",
 'permissions-policy':'geolocation=(self)',
 'x-robots-tag':'noindex',
}
for key,part in mandatory.items():
 if part.lower() not in headers.get(key,'').lower():
  print('RC141_SECURITY=HOLD_MISSING_HEADER_'+key.replace('-','_').upper())
  raise SystemExit(2)
csp=headers['content-security-policy'].lower()
for required in ["script-src 'self'","img-src 'self' data: blob:","connect-src 'self'","frame-ancestors 'none'","object-src 'none'"]:
 if required not in csp:
  print('RC141_SECURITY=HOLD_CSP_POLICY')
  raise SystemExit(2)
cache=headers.get('cache-control','').lower()
if route.startswith('/repartidor') or route.startswith('/api/') or route.startswith('/manifest-') or route.endswith('.js'):
 if 'no-store' not in cache:
  print('RC141_SECURITY=HOLD_PRIVATE_OR_SHELL_CACHE_POLICY')
  raise SystemExit(2)
print('RC141_SECURITY_ROUTE=PASS:'+route)
PY
done
# Unauthenticated private reads must never return customer or courier data.
for route in /api/v1/driver/profile /api/v1/driver/mine \
 /api/v1/driver/presence-readiness /api/v1/driver/dashboard;do
 code="$(curl -sS --noproxy '*' --connect-timeout 3 --max-time 10 \
  -H "Host: $HOST" -o /dev/null -w '%{http_code}' "$URL$route")" || {
 echo RC141_SECURITY=HOLD_PRIVATE_ROUTE_CONNECTIVITY;exit 2;
 }
 [[ "$code" == 401 || "$code" == 403 ]] || {
  echo "RC141_SECURITY=HOLD_PRIVATE_ROUTE_HTTP_$code";exit 2;
 }
done
echo 'RC141_SECURITY_READ_ONLY=PASS'
echo "RC141_SECURITY_SCOPE=DRIVER_18199_ONLY:$MODE"
echo 'RC141_SECURITY_NO_MUTATIONS=YES'
