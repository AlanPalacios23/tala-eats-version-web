#!/usr/bin/env bash
# RC138 driver-only PWA deployment, isolated port 18199. Explicit operator approval.
# NEVER deploys backend, changes LIVE financial release flags or touches other PWAs.
set -Eeuo pipefail
set +x
umask 077
MODE="${1:-}" WEB_SHA="${2:-}" BACK_SHA="${3:-}" APPROVAL="${4:-}"
[[ "$MODE" =~ ^--(plan|apply)$ && "$WEB_SHA" =~ ^[a-f0-9]{40}$ &&
 "$BACK_SHA" =~ ^[a-f0-9]{40}$ ]] || {
 echo 'DRIVER_RC138_DEPLOY=HOLD_USAGE';exit 2;
}
if [[ "$MODE" == --plan ]];then
 [[ "$#" -eq 3 ]] || { echo 'DRIVER_RC138_DEPLOY=HOLD_PLAN_ARGS';exit 2; }
else
 [[ "$#" -eq 4 && "$APPROVAL" == I_APPROVE_DRIVER_RC138_STATIC_ONLY &&
   "$(id -u)" == 0 ]] || {
  echo 'DRIVER_RC138_DEPLOY=HOLD_ROOT_AND_APPROVAL_REQUIRED';exit 2;
 }
fi
SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$WEB_SHA/deploy"
PREFLIGHT="$SCRIPT/rc138-kali-driver-live-preflight.sh"
UPDATE="$SCRIPT/kali-update-repartidores-isolated.sh"
[[ -f "$PREFLIGHT" && -f "$UPDATE" && ! -L "$PREFLIGHT" && ! -L "$UPDATE" ]] || {
 echo 'DRIVER_RC138_DEPLOY=HOLD_MISSING_PINNED_DEPLOY_FILES';exit 2;
}
if [[ "$(id -un)" == tala-node-stage ]];then
 gate(){ bash "$PREFLIGHT" "$@" ; }
else
 command -v sudo >/dev/null || {
  echo 'DRIVER_RC138_DEPLOY=HOLD_SUDO_REQUIRED';exit 2;
 }
 gate(){ sudo -n -H -u tala-node-stage bash "$PREFLIGHT" "$@" ; }
fi
# In both plan and apply, attest to EXACT running backend release,
# independently protected driver reads, live flags and expected built files.
gate --plan "$WEB_SHA" "$BACK_SHA"
bash "$UPDATE" --plan "$WEB_SHA"
echo 'DRIVER_RC138_PLAN=PASS_EXACT_BACKEND_AND_STATIC_PRECHECK'
if [[ "$MODE" == --plan ]];then
 echo 'DRIVER_RC138_DEPLOY=NOT_STARTED_PLAN_ONLY'
 exit 0
fi
# Existing updater backs up files and atomically swaps driver-only symlinks.
# Failure in new post-deploy gate triggers driver-only static rollback.
SWITCHED=no
recover(){
 local code=$?
 trap - EXIT
 if [[ "$code" -ne 0 && "$SWITCHED" == yes ]];then
  if bash "$UPDATE" --rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY;then
   echo 'DRIVER_RC138_DEPLOY=FAILED_ROLLBACK_PASS'
  else
   echo 'DRIVER_RC138_DEPLOY=FAILED_ROLLBACK_UNVERIFIED_STOP_MANUAL'
  fi
 fi
 exit "$code"
}
trap recover EXIT
bash "$UPDATE" --apply "$WEB_SHA" I_APPROVE_REPARTIDORES_STATIC_18199_ONLY
SWITCHED=yes
gate --post "$WEB_SHA" "$BACK_SHA"
SWITCHED=no
trap - EXIT
echo 'DRIVER_RC138_DEPLOY=PASS_DRIVER_18199_ONLY'
echo "DRIVER_RC138_PUBLISHED_SHA=$WEB_SHA"
echo "DRIVER_RC138_BACKEND_SHA_AT_DEPLOY=$BACK_SHA"
echo 'DRIVER_RC138_REAL_ORDER_AND_CASH_LEDGER=NOT_TESTED_NOT_APPROVED'
echo 'DRIVER_RC138_CUSTOMERS_RESTAURANTES_PM2_STRIPE_PG=UNTOUCHED'
