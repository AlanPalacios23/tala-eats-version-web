#!/usr/bin/env bash
# RC144: avatar UI in Customers/Restaurants/Drivers only; no backend or finances.
# Uses existing proven RC136 isolated three-site deploy and rollback.
set -Eeuo pipefail
set +x
export GIT_OPTIONAL_LOCKS=0
umask 077
MODE="${1:-}" SHA="${2:-}" BACK_SHA="${3:-}" APPROVAL="${4:-}"
OLD_WEB='9101ae8c349aa22f9f14ad95d65a75067ec84738'
BACK_BASE='f92f5d9a52856f24e155dcbc140dcff0e266056a'
[[ "$MODE" =~ ^--(plan|apply)$ && "$SHA" =~ ^[0-9a-f]{40}$ &&
   "$BACK_SHA" =~ ^[0-9a-f]{40}$ ]] || {
 echo 'RC144_PWA=HOLD_INVALID_ARGUMENTS';exit 2;
}
if [[ "$MODE" == --plan ]];then
 [[ "$#" -eq 3 ]] || exit 2
else
 [[ "$#" -eq 4 && "$(id -u)" == 0 &&
   "$APPROVAL" == I_APPROVE_RC144_THREE_AVATAR_PWA_ONLY ]] || {
 echo 'RC144_PWA=HOLD_EXPLICIT_APPROVAL';exit 2;
 }
fi
WEB="/home/tala-node-stage/tala-eats-web-releases/$SHA"
BACK="/home/tala-node-stage/tala-node-releases/$BACK_SHA"
[[ -d "$WEB" && -d "$BACK" && ! -L "$WEB" && ! -L "$BACK" ]] || {
 echo 'RC144_PWA=HOLD_BUNDLES_OR_BACKEND_NOT_PREPARED';exit 2;
}
whead="$(git -c safe.directory="$WEB" -C "$WEB" rev-parse HEAD)" || exit 2
wstatus="$(git -c safe.directory="$WEB" -C "$WEB" status --porcelain --untracked-files=no)" || exit 2
[[ "$whead" == "$SHA" && -z "$wstatus" ]] || {
 echo 'RC144_PWA=HOLD_WEB_TREE_CHANGED';exit 2;
}
git -c safe.directory="$WEB" -C "$WEB" merge-base --is-ancestor "$OLD_WEB" "$SHA" || {
 echo 'RC144_PWA=HOLD_NOT_RC143_DESCENDANT';exit 2;
}
webdiff="$(git -c safe.directory="$WEB" -C "$WEB" diff --name-only "$OLD_WEB" "$SHA")" || exit 2
[[ -n "$webdiff" ]] || { echo 'RC144_PWA=HOLD_EMPTY_DIFF';exit 2; }
while IFS= read -r item;do
 case "$item" in
  src/components/CustomerOrders.tsx|src/components/DriverIdentity.tsx|  src/components/DriverPwaWorkflow.tsx|src/components/RestaurantApp.tsx|  src/components/RestaurantParity.tsx|src/lib/api.ts|  src/lib/driver-avatar.ts|src/lib/driver-delivery-ui.ts|  src/lib/types.ts|src/styles/driver-avatar-rc144.css|  tests/rc144-driver-avatar-cross-app.test.ts|  deploy/rc144-kali-avatar-three-pwa.sh|  deploy/RC144-AVATAR-ONLY-DEPLOY.md|\
  tests/rc144-avatar-deploy-only.test.ts)
   :;;
  *) echo "RC144_PWA=HOLD_UNRELATED_WEB_FILE:$item";exit 2;;
 esac
done <<< "$webdiff"
echo 'RC144_PWA_SCOPE=PASS_AVATAR_ONLY'
[[ -s "$WEB/dist/index.html" && -s "$WEB/dist-restaurantes/restaurantes.html" &&
   -s "$WEB/dist-repartidores/repartidores.html" ]] || {
 echo 'RC144_PWA=HOLD_THREE_BUILDS_MISSING';exit 2;
}
# Stage user examines exact running LIVE backend and durable directory, no writes.
if [[ "$(id -un)" == tala-node-stage ]];then
 bash "$BACK/node-backend/scripts/rc144-kali-avatar-live-preflight.sh"   --post "$BACK_SHA"
else
 sudo -n -H -u tala-node-stage   bash "$BACK/node-backend/scripts/rc144-kali-avatar-live-preflight.sh"   --post "$BACK_SHA"
fi
# Check the avatar route is enabled, using an impossible random-name GET:
# 404 proves the new reader exists; 503 is a blocked feature and must STOP.
AVATAR='http://127.0.0.1:18190/api/v1/driver/avatar/0000000000000000000000000000000000000000.webp'
code="$(curl -sS --connect-timeout 4 --max-time 9 -o /dev/null -w '%{http_code}' "$AVATAR")" || exit 2
[[ "$code" == 404 ]] || {
 echo "RC144_PWA=HOLD_AVATAR_FEATURE_NOT_READY_HTTP_$code";exit 2;
}
for spec in   '18195|web-talaeats.alan-palacios-dev.com'   '18197|restaurantes-talaeats.alan-palacios-dev.com'   '18199|repartidores-talaeats.alan-palacios-dev.com';do
 IFS='|' read -r port host <<< "$spec"
 code="$(curl -sS --connect-timeout 4 --max-time 9 -o /dev/null -w '%{http_code}'   -H "Host: $host"   "http://127.0.0.1:$port/api/v1/driver/avatar/0000000000000000000000000000000000000000.webp")" || exit 2
 [[ "$code" == 404 ]] || {
 echo "RC144_PWA=HOLD_AVATAR_PROXY_$port:$code";exit 2;
 }
done
echo 'RC144_THREE_AVATAR_PROXIES=PASS'
# Tested existing promoter switches 18199/18197/18195 with individual backups,
# and returns nonzero on errors. Avoid modifying its existing security policies.
SCRIPT="$WEB/deploy/rc136-kali-promote-three-pwa.sh"
[[ -f "$SCRIPT" && ! -L "$SCRIPT" ]] || exit 2
bash "$SCRIPT" --plan "$SHA"
if [[ "$MODE" == --plan ]];then
 echo 'RC144_AVATAR_THREE_PWA_PLAN=PASS_READ_ONLY'
 echo 'RC144_BACKEND_STRIPE_POSTGRES_NGINX=UNMODIFIED'
 exit 0
fi
bash "$SCRIPT" --apply "$SHA" I_APPROVE_RC136_THREE_STATIC_PWA_ONLY
echo 'RC144_AVATAR_THREE_PWA_APPLY=PASS'
echo 'RC144_BACKEND_STRIPE_POSTGRES_NGINX=UNMODIFIED'
