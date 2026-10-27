#!/usr/bin/env bash
# Safe read-only audit of the already published three-app Tala Eats PWA.
# Never deploy, activate cards, create restaurants or mutate PM2/PostgreSQL.
set -Eeuo pipefail
set +x
HOST='web-talaeats.alan-palacios-dev.com'
ORIGIN='http://127.0.0.1:18195'
ROOT='/srv/talaeats-pwa/current'
for dep in curl python3 sha256sum readlink;do
 command -v "$dep" >/dev/null || { echo "RESTAURANTS_AUDIT_ABORT=DEPENDENCY:$dep";exit 2; }
done
[[ -L "$ROOT" && -f "$ROOT/index.html" ]] || {
 echo "RESTAURANTS_AUDIT_ABORT=PUBLIC_RELEASE_MISSING";exit 2;
}
release="$(readlink -f "$ROOT")"
[[ "$release" == /srv/talaeats-pwa/releases/* ]] || {
 echo "RESTAURANTS_AUDIT_ABORT=UNEXPECTED_RELEASE_PATH";exit 2;
}
echo "RESTAURANTS_AUDIT_RELEASE=$release"
status=0
for route in / /iniciar /clientes /restaurante /restaurante/acceso /restaurante/alta /repartidor;do
 if curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN$route" |
   grep -Fq '<div id="root">';then
  echo "RESTAURANTS_AUDIT_ROUTE=$route:PASS"
 else
  echo "RESTAURANTS_AUDIT_ROUTE=$route:FAIL"
  status=1
 fi
done
if curl -fsS --max-time 10 -H "Host: $HOST"  "$ORIGIN/manifest-restaurante.webmanifest" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d.get("id")=="/app-restaurante"
assert d.get("start_url")=="/restaurante"
assert d.get("display")=="standalone"
assert d.get("name")=="Tala Eats Restaurante"
print("RESTAURANTS_AUDIT_PWA_IDENTITY=PASS")
';then :;else
 echo "RESTAURANTS_AUDIT_PWA_IDENTITY=FAIL";status=1
fi
if curl -fsS --max-time 10 -H "Host: $HOST" "$ORIGIN/api/v1/health" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d.get("status")=="ok"
assert d.get("production") is True
print("RESTAURANTS_AUDIT_BACKEND_HEALTH=PASS")
';then :;else
 echo "RESTAURANTS_AUDIT_BACKEND_HEALTH=FAIL";status=1
fi
sha="$(sha256sum "$ROOT/index.html" | cut -d" " -f1)"
echo "RESTAURANTS_AUDIT_INDEX_SHA256=$sha"
echo 'RESTAURANTS_AUDIT_FINANCIAL_WRITES=ZERO'
echo 'RESTAURANTS_AUDIT_GITHUB_BRANCH_IS_NOT_DEPLOYED_UNLESS_SHA_MATCHES_OPERATOR_RECORD'
if [[ "$status" -ne 0 ]];then
 echo "RESTAURANTS_AUDIT=FAIL_READ_ONLY";exit 1
fi
echo 'RESTAURANTS_AUDIT=PASS_READ_ONLY'
