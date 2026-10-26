#!/usr/bin/env bash
# Tala Eats Web — real push PWA production deployment gate.
# Runs directly on Kali as alan. Does NOT generate VAPID private keys or edit
# Node, PostgreSQL, Redis, Stripe, PM2 or Cloudflared.
set -Eeuo pipefail
set +x
umask 077
SITE='https://web-talaeats.alan-palacios-dev.com'
BASE='https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation'
MODE="${1:---require-push-ready}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for cmd in curl python3 bash git;do
 command -v "$cmd" >/dev/null||{echo "WEB_PUSH_ABORT=MISSING_$cmd";exit 1;}
done
case "$MODE" in
 --require-push-ready|--frontend-only|--check) ;;
 *) echo 'Usage: bash INSTALAR_WEB_PUSH_TALA_EATS_KALI.sh [--check|--require-push-ready|--frontend-only]';exit 2;;
esac
echo "WEB_PUSH_MODE=$MODE"
push_ready=0
status="$(curl -sS --max-time 18 -o "$TMP/config.json" -w '%{http_code}' "$SITE/api/v1/v11/push/config" || true)"
if [[ "$status" == '200' ]];then
 if python3 - "$TMP/config.json" <<'PY'
import json,sys,re,base64
try:
 j=json.load(open(sys.argv[1],encoding='utf-8'))
 key=j.get('public_key')
 assert j.get('enabled') is True and isinstance(key,str)
 assert re.fullmatch(r'[A-Za-z0-9_-]{86,88}',key)
 data=base64.urlsafe_b64decode(key+'='*((-len(key))%4))
 assert len(data)==65 and data[0]==4
except Exception:
 sys.exit(1)
PY
 then push_ready=1;fi
fi
if [[ "$push_ready" == 1 ]];then
 echo 'WEB_PUSH_NODE_VAPID_CONFIG=PASS'
else
 echo "WEB_PUSH_NODE_VAPID_CONFIG=HOLD_HTTP_$status"
 echo 'WEB_PUSH_NODE_ACTION=Verify GET /api/v1/v11/push/config and configure VAPID plus POST/DELETE subscription routes and worker in Node.'
fi
if [[ "$MODE" == '--check' ]];then
 echo 'WEB_PUSH_CHECK_READ_ONLY=PASS'
 exit 0
fi
if [[ "$MODE" == '--require-push-ready' && "$push_ready" != 1 ]];then
 echo 'WEB_PUSH_DEPLOY=HOLD_BACKEND_NOT_READY'
 exit 12
fi
curl -fsSL --retry 2 --max-time 25 "$BASE/deploy/INSTALAR_PWA_CLIENTES_PRODUCCION_KALI.sh" -o "$TMP/installer.sh"
bash -n "$TMP/installer.sh"
grep -Fq 'TALA_EXPECTED_WEB_SHA' "$TMP/installer.sh" || { echo 'WEB_PUSH_ABORT=UNPINNED_INSTALLER';exit 1;}
echo 'WEB_PUSH_FRONTEND_DEPLOY=START'
bash "$TMP/installer.sh"
curl -fsSL --max-time 25 "$SITE/sw.js" -o "$TMP/sw-live.js"
grep -Fq "self.addEventListener('push'" "$TMP/sw-live.js"||{ echo 'WEB_PUSH_ABORT=PUBLIC_WORKER_MISSING_PUSH_HANDLER';exit 1;}
grep -Fq "self.addEventListener('notificationclick'" "$TMP/sw-live.js"||{ echo 'WEB_PUSH_ABORT=PUBLIC_WORKER_MISSING_CLICK_HANDLER';exit 1;}
echo 'WEB_PUSH_FRONTEND_PUBLIC=PASS'
if [[ "$push_ready" == 1 ]];then
 echo 'WEB_PUSH_BACKEND_CONFIG=PASS_WORKER_DELIVERY_REQUIRES_E2E_DEVICE_TEST'
else
 echo 'WEB_PUSH_BACKEND=HOLD_PUSH_NOT_ACTIVATABLE_UNTIL_NODE_SUPPORT'
fi
echo 'WEB_PUSH_NO_FINANCIAL_SERVICES_MODIFIED=PASS'
