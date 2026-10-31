#!/usr/bin/env bash
# RC156: read-only inspection of the ACTUAL served courier PWA release on Kali.
# Usage: bash deploy/rc156-kali-readonly-postcheck.sh --sha=<40-character-active-sha>
# ZERO writes: no sudo, no rm/mv/ln, no git checkout, no Stripe credentials.
set -Eeuo pipefail
set +x
export GIT_OPTIONAL_LOCKS=0
EXPECTED="${1:-}"
[[ "$#" == 1 && "$EXPECTED" =~ ^--sha=[a-f0-9]{40}$ ]] || {
 echo 'RC156_POSTCHECK=INVALID_SHA_ARGUMENT'; exit 2;
}
SHA="${EXPECTED#--sha=}"
ROOT='/srv/talaeats-repartidores-pwa'
CURRENT="$ROOT/current"
ORIGIN='http://127.0.0.1:18199'
HOST='repartidores-talaeats.alan-palacios-dev.com'
for binary in curl cmp readlink python3 systemctl;do
 command -v "$binary" >/dev/null || { echo "RC156_POSTCHECK=MISSING_TOOL";exit 2; }
done
[[ -L "$CURRENT" ]] || { echo 'RC156_POSTCHECK=NO_ACTIVE_SYMLINK';exit 1; }
ACTIVE="$(readlink -f -- "$CURRENT")" || exit 1
[[ "$ACTIVE" == "$ROOT/releases/$SHA" && -d "$ACTIVE" ]] || {
 echo 'RC156_POSTCHECK=ACTIVE_SHA_MISMATCH';exit 1;
}
systemctl is-active --quiet talaeats-repartidores-pwa.service || {
 echo 'RC156_POSTCHECK=COURIER_SERVICE_DOWN';exit 1;
}
for pair in "repartidor|repartidores.html" \
            "sw-repartidor.js|sw-repartidor.js" \
            "manifest-repartidor.webmanifest|manifest-repartidor.webmanifest";do
 IFS='|' read -r route file <<< "$pair"
 [[ -s "$ACTIVE/$file" ]] || { echo 'RC156_POSTCHECK=ASSET_MISSING';exit 1; }
 curl -fsS --connect-timeout 3 --max-time 8 -H "Host: $HOST" "$ORIGIN/$route" |
  cmp -s - "$ACTIVE/$file" || {
   echo 'RC156_POSTCHECK=SERVED_BYTES_NOT_FROM_ACTIVE_RELEASE';exit 1;
  }
done
echo 'COURIER_ACTIVE_SHA=PASS'
echo 'COURIER_SERVED_ASSETS=PASS'
# Never send a cookie or bearer token. The protected API route must return 401.
for route in platform/support platform/support/capabilities;do
 status="$(curl -sS --connect-timeout 3 --max-time 8 -o /dev/null -w '%{http_code}' \
  -H "Host: $HOST" "$ORIGIN/api/v1/$route")" || {
   echo 'RC156_POSTCHECK=API_NOT_REACHABLE';exit 1;
  }
 [[ "$status" == 401 ]] || { echo 'RC156_POSTCHECK=PROTECTED_ROUTE_NOT_READY';exit 1; }
done
curl -fsS --connect-timeout 3 --max-time 8 -H "Host: $HOST" "$ORIGIN/api/v1/ready" |
 python3 -c 'import sys,json; x=json.load(sys.stdin);assert x.get("ready") is True and x.get("database") is True and x.get("redis") is True and x.get("workerOnline") is True and x.get("environment")=="production"' || {
 echo 'RC156_POSTCHECK=NODE_DEPENDENCY_FAILURE';exit 1;
}
echo 'COURIER_BACKEND_PRIVATE_ENDPOINTS=PASS'
echo 'COURIER_BACKEND_READINESS=PASS'
echo 'RC156_POSTDEPLOY_READ_ONLY=PASS'
echo 'FINANCIAL_OR_ORDER_WRITES=ZERO'
