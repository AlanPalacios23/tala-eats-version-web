#!/usr/bin/env bash
# RC138 independent driver PWA pre/post-deploy gate: READ-ONLY.
# Identifies actual LIVE API+worker SHA via PM2, not a GitHub branch or a public "200".
# No authenticated requests, SQL, Stripe requests, backend flags mutation or uploads.
set -Eeuo pipefail
set +x
umask 077
# Safe one-command discovery: show only the exact shared SHA, never PM2 JSON.
if [[ "${1:-}" == '--detect-backend' ]];then
 [[ "$#" -eq 1 && "$(id -un)" == tala-node-stage &&
    "$HOME" == /home/tala-node-stage ]] || {
  echo 'DRIVER_RC138_BACKEND_SHA=HOLD_SERVICE_USER_REQUIRED';exit 2;
 }
 export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
 command -v pm2 >/dev/null && command -v node >/dev/null || exit 2
 pm2 jlist | node -e '
let s="";process.stdin.on("data",b=>s+=b);process.stdin.on("end",()=>{
 try{
  const p=JSON.parse(s),names=[
   "tala-node-stage-api","tala-node-stage-worker"
  ],shas=[];
  if(p.length!==2)throw Error("COUNT");
  for(const name of names){
   const matches=p.filter(x=>x.name===name);
   if(matches.length!==1||matches[0].pm2_env?.status!=="online")
    throw Error("PROCESS");
   const cwd=matches[0].pm2_env.pm_cwd||"";
    const parts=cwd.split("/");
    if(parts.length!==6||parts[0]!==''||parts[1]!=='home'||
      parts[2]!=='tala-node-stage'||parts[3]!=='tala-node-releases'||
      parts[5]!=='node-backend'||!/^[a-f0-9]{40}$/.test(parts[4]))
      throw Error("RELEASE_DIR");
    shas.push(parts[4]);
  }
  if(shas[0]!==shas[1])throw Error("MISMATCH");
  console.log("DRIVER_RC138_CURRENT_LIVE_BACKEND_SHA="+shas[0]);
 }catch{
  console.log("DRIVER_RC138_CURRENT_LIVE_BACKEND_SHA=HOLD_UNVERIFIED");
  process.exitCode=2;
 }
})'
 exit $?
fi
MODE="${1:-}" WEB_SHA="${2:-}" BACK_SHA="${3:-}"
[[ "$#" -eq 3 && "$MODE" =~ ^--(plan|post)$ &&
 "$WEB_SHA" =~ ^[0-9a-f]{40}$ && "$BACK_SHA" =~ ^[0-9a-f]{40}$ ]] || {
 echo 'DRIVER_RC138_GATE=HOLD_USAGE_MODE_WEB_SHA40_BACKEND_SHA40';exit 2;
}
[[ "$(id -un)" == tala-node-stage && "$HOME" == /home/tala-node-stage ]] || {
 echo 'DRIVER_RC138_GATE=HOLD_SERVICE_USER_ONLY';exit 2;
}
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
for cmd in pm2 node python3 git curl readlink grep cmp systemctl;do
 command -v "$cmd" >/dev/null || { echo "DRIVER_RC138_GATE=HOLD_MISSING:$cmd";exit 2; }
done
WORK="$HOME/tala-node-releases/$BACK_SHA/node-backend"
WEB="$HOME/tala-eats-web-releases/$WEB_SHA"
HOST='repartidores-talaeats.alan-palacios-dev.com'
API='http://127.0.0.1:18199/api/v1'
LOCAL='http://127.0.0.1:18199'
ROOT='/srv/talaeats-repartidores-pwa'
[[ -d "$WORK" && ! -L "$WORK" &&
 -s "$WORK/src/marketplace/routes.ts" &&
 -s "$WORK/src/marketplace/driver.ts" &&
 -s "$WORK/dist/server.js" &&
 -s "$WORK/dist/live/production-worker.js" ]] || {
 echo 'DRIVER_RC138_GATE=HOLD_BACKEND_RELEASE_FILES';exit 2;
}
[[ -d "$WEB/dist-repartidores" && ! -L "$WEB" &&
 -s "$WEB/dist-repartidores/repartidores.html" &&
 -s "$WEB/dist-repartidores/sw-repartidor.js" ]] || {
 echo 'DRIVER_RC138_GATE=HOLD_WEB_BUILD_MISSING';exit 2;
}
for item in "$WORK/.." "$WEB";do
 expected="$BACK_SHA"
 [[ "$item" == "$WEB" ]] && expected="$WEB_SHA"
 [[ "$(git -C "$item" rev-parse HEAD)" == "$expected" &&
    -z "$(git -C "$item" status --porcelain --untracked-files=no)" ]] || {
  echo 'DRIVER_RC138_GATE=HOLD_SHA_OR_DIRTY_TRACKED_TREE';exit 2;
 }
done
# Confirm these actual source route contracts are in the CURRENT deployed SHA.
for contract in "stageDriverRouter.get('/presence-readiness'" \
 "stageDriverRouter.get('/mine'" "stageDriverRouter.get('/dashboard'" \
 "stageDriverRouter.get('/available'" "stageDriverRouter.patch('/availability'" \
 "stageDriverRouter.patch('/location'" "stageDriverRouter.post('/orders/:orderId/accept'" \
 "stageDriverRouter.patch('/orders/:orderId/status'" "stageDriverRouter.post('/orders/:orderId/complete'";do
 grep -Fq "$contract" "$WORK/src/marketplace/routes.ts" || {
  echo 'DRIVER_RC138_GATE=HOLD_BACKEND_CONTRACT_MISSING';exit 2;
 }
done
# In addition to path existence, require the response shape consumed by RC138.
# A historical backend with similarly named routes is not necessarily compatible.
grep -Fq 'user:{id:actor.id,name:' "$WORK/src/marketplace/driver.ts" &&
grep -Fq 'live_delivery_checkout_enabled:' "$WORK/src/marketplace/driver.ts" &&
grep -Fq 'const driverCompleteInput=z.strictObject({' "$WORK/src/marketplace/routes.ts" || {
 echo 'DRIVER_RC138_GATE=HOLD_BACKEND_PAYLOAD_OR_PIN_CONTRACT';exit 2;
}
export DRIVER_EXPECTED_BACK_WORK="$WORK"
# PM2 output contains private process metadata. Parse it only in-memory;
# never output jlist, pm2_env, command arguments, environment or credentials.
pm2 jlist | node -e '
let s="";process.stdin.on("data",b=>s+=b);process.stdin.on("end",()=>{
 try{
  const p=JSON.parse(s),w=process.env.DRIVER_EXPECTED_BACK_WORK;
  const expected={
   "tala-node-stage-api":"dist/server.js",
   "tala-node-stage-worker":"dist/live/production-worker.js"
  };
  if(p.length!==2)throw Error("COUNT");
  for(const [name,script] of Object.entries(expected)){
   const item=p.filter(x=>x.name===name);
   if(item.length!==1||item[0].pm2_env?.status!=="online"||
     item[0].pm2_env?.pm_cwd!==w||
     item[0].pm2_env?.pm_exec_path!==w+"/"+script)
    throw Error("IDENTITY");
  }
  console.log("DRIVER_RC138_PM2_API_WORKER_EXACT_SHA=PASS");
 }catch{console.log("DRIVER_RC138_PM2_API_WORKER_EXACT_SHA=HOLD");process.exitCode=2;}
})'
curl -fsS --connect-timeout 3 --max-time 10 "$API/health" |
 python3 -c 'import json,sys;d=json.load(sys.stdin);assert d.get("status")=="ok" and d.get("production") is True' || {
 echo 'DRIVER_RC138_GATE=HOLD_LOCAL_NODE_LIVE_HEALTH';exit 2;
}
curl -fsS --connect-timeout 3 --max-time 10 "$API/ready" |
 python3 -c 'import json,sys;d=json.load(sys.stdin);assert d.get("ready") is True and d.get("workerOnline") is True' || {
 echo 'DRIVER_RC138_GATE=HOLD_API_WORKER_NOT_READY';exit 2;
}
curl -fsS --connect-timeout 3 --max-time 10 "$API/operations/onboarding-capabilities" |
 python3 -c 'import json,sys;d=json.load(sys.stdin);assert d.get("driver_plate_supported") is True and d.get("driver_documents_supported") is True and d.get("driver_admin_approval_required") is True' || {
 echo 'DRIVER_RC138_GATE=HOLD_DRIVER_SIGNUP_CAPABILITIES';exit 2;
}
# Unauthenticated GET must be protected and routed (401/403), NOT 404,
# 200 private data or a browser redirect. No financial or state-changing calls.
for path in /driver/profile /driver/mine /driver/available \
 /driver/dashboard /driver/presence-readiness;do
 code="$(curl -sS --connect-timeout 3 --max-time 8 -o /dev/null \
  -w '%{http_code}' -H "Host: $HOST" "$API$path")"
 [[ "$code" == 401 || "$code" == 403 ]] || {
  echo "DRIVER_RC138_GATE=HOLD_PRIVATE_DRIVER_GET_CODE_$code";exit 2;
 }
done
systemctl is-active --quiet talaeats-repartidores-pwa.service || {
 echo 'DRIVER_RC138_GATE=HOLD_DRIVER_NGINX_SERVICE';exit 2;
}
grep -Fq 'listen 127.0.0.1:18199;' /etc/talaeats-repartidores-pwa/server.conf &&
grep -Fq 'root /srv/talaeats-repartidores-pwa/current;' /etc/talaeats-repartidores-pwa/server.conf || {
 echo 'DRIVER_RC138_GATE=HOLD_NGINX_ROOT_OR_PORT';exit 2;
}
if [[ "$MODE" == --post ]];then
 [[ -L "$ROOT/current" && "$(readlink -f "$ROOT/current")" == "$ROOT/releases/$WEB_SHA" ]] || {
  echo 'DRIVER_RC138_GATE=HOLD_WRONG_DEPLOYED_STATIC_SHA';exit 2;
 }
 curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL/repartidor" |
  cmp -s - "$WEB/dist-repartidores/repartidores.html" || {
   echo 'DRIVER_RC138_GATE=HOLD_SERVED_BYTES_MISMATCH';exit 2;
 }
 for url in /repartidor/acceso /repartidor/registro \
  /sw-repartidor.js /manifest-repartidor.webmanifest;do
  curl -fsS --max-time 8 -H "Host: $HOST" "$LOCAL$url" -o /dev/null || {
   echo 'DRIVER_RC138_GATE=HOLD_PWA_ROUTE';exit 2;
  }
 done
 # Cloudflare public hostname must serve the same immutable driver shell;
 # the local nginx 200 alone is not proof the public PWA was published.
 curl -fsS --connect-timeout 5 --max-time 15 "https://$HOST/repartidor" |
  cmp -s - "$WEB/dist-repartidores/repartidores.html" || {
   echo 'DRIVER_RC138_GATE=HOLD_PUBLIC_DRIVER_SHA_OR_TUNNEL';exit 2;
  }
 curl -fsS --connect-timeout 5 --max-time 15 \
  "https://$HOST/manifest-repartidor.webmanifest" |
  python3 -c 'import json,sys;m=json.load(sys.stdin);assert m["start_url"]=="/repartidor"' || {
   echo 'DRIVER_RC138_GATE=HOLD_PUBLIC_MANIFEST';exit 2;
  }
fi
# Inspect only explicit non-secret boolean keys; never echo entire .env.
ENV="$HOME/.config/talaeats-node-live.env"
[[ -f "$ENV" && ! -L "$ENV" && "$(stat -c %a "$ENV")" == 600 &&
 "$(stat -c %u "$ENV")" == "$(id -u)" ]] || {
 echo 'DRIVER_RC138_GATE=HOLD_LIVE_ENV_FILE_PERMISSIONS';exit 2;
}
python3 - "$ENV" <<'PY'
import sys
path=sys.argv[1]
keys=[
 'LIVE_DRIVER_PRESENCE_ENABLED','LIVE_DELIVERY_CASH_CHECKOUT_ENABLED',
 'LIVE_DELIVERY_CASH_DISPATCH_ENABLED','LIVE_DELIVERY_CASH_RELEASE_APPROVED',
 'LIVE_CASH_HANDOFF_V2_ENABLED','LIVE_DELIVERY_DISPATCH_ENABLED',
 'LIVE_DELIVERY_CARD_CHECKOUT_ENABLED','LIVE_DELIVERY_RELEASE_APPROVED',
 'LIVE_DELIVERY_CARD_E2E_APPROVED','STRIPE_CONNECT_TRANSFERS_ENABLED',
]
flags={}
with open(path,encoding='utf-8') as f:
 for line in f:
  line=line.strip()
  if '=' not in line or line.startswith('#'):continue
  k,v=line.split('=',1)
  if k in keys:
   flags[k]=v.strip().strip('"').strip("'").lower()
for key in keys:
 v=flags.get(key,'unverified')
 # Never print unexpected raw values from the env file.
 print('DRIVER_RC138_FLAG_'+key+'='+v.upper() if v in ('true','false') else
       'DRIVER_RC138_FLAG_'+key+'=UNVERIFIED')
cash=all(flags.get(k)=='true' for k in keys[1:5])
card=all(flags.get(k)=='true' for k in keys[5:9])
presence=flags.get(keys[0])=='true'
print('DRIVER_RC138_CASH_REAL_E2E='+
 ('ELIGIBLE_FOR_OPERATOR_CHECK_NOT_PROVED' if presence and cash else 'HOLD_FLAGS'))
print('DRIVER_RC138_CARD_REAL_E2E='+
 ('ELIGIBLE_FOR_OPERATOR_CHECK_NOT_PROVED' if presence and card else 'HOLD_FLAGS'))
print('DRIVER_RC138_STRIPE_PAYOUTS_NOT_APPROVED_BY_THIS_CHECK=YES')
PY
echo "DRIVER_RC138_LIVE_BACKEND_SHA=$BACK_SHA"
echo "DRIVER_RC138_PWA_TARGET_SHA=$WEB_SHA"
echo "DRIVER_RC138_STATIC_GATE=PASS_$MODE"
echo 'DRIVER_RC138_REAL_ACCOUNT_E2E=NOT_EXECUTED'
echo 'DRIVER_RC138_API_DB_FINANCIAL_WRITES=ZERO'
