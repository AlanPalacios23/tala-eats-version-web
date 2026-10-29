#!/usr/bin/env bash
# RC136: fail-closed, three-domain static-only promotion; existing scripts
# create backups and atomically switch only their own frontend symlinks.
set -Eeuo pipefail
set +x
umask 022
MODE="${1:-}" SHA="${2:-}" APPROVAL="${3:-}"
[[ "$MODE" =~ ^--(plan|apply)$ && "$SHA" =~ ^[a-f0-9]{40}$ ]] || {
 echo 'RC136_DEPLOY_ABORT=USAGE_PLAN_OR_APPLY_SHA40';exit 2;
}
if [[ "$MODE" == --plan ]];then
 [[ "$#" -eq 2 ]] || exit 2
else
 [[ "$#" -eq 3 && "$APPROVAL" == 'I_APPROVE_RC136_THREE_STATIC_PWA_ONLY' && "$(id -u)" == 0 ]] || {
  echo 'RC136_DEPLOY_ABORT=ROOT_AND_EXPLICIT_APPROVAL_REQUIRED';exit 2;
 }
fi
for cmd in bash curl python3 grep git readlink;do command -v "$cmd" >/dev/null || {
 echo "RC136_DEPLOY_ABORT=MISSING:$cmd";exit 2;
};done
SRC="/home/tala-node-stage/tala-eats-web-releases/$SHA"
[[ -d "$SRC" && ! -L "$SRC" ]] || { echo 'RC136_DEPLOY_ABORT=RELEASE_NOT_PREPARED';exit 2; }
[[ "$(git -c safe.directory="$SRC" -C "$SRC" rev-parse HEAD)" == "$SHA" &&
   -z "$(git -c safe.directory="$SRC" -C "$SRC" status --porcelain --untracked-files=no)" ]] || {
 echo 'RC136_DEPLOY_ABORT=GIT_SHA_OR_TRACKED_TREE_MISMATCH';exit 2;
}
for f in dist/index.html dist/manifest-clientes.webmanifest \
 dist-restaurantes/restaurantes.html dist-restaurantes/manifest-restaurante.webmanifest \
 dist-repartidores/repartidores.html dist-repartidores/manifest-repartidor.webmanifest;do
 [[ -s "$SRC/$f" ]] || { echo "RC136_DEPLOY_ABORT=MISSING_BUILD:$f";exit 2; }
done
# All three web bundles explicitly request immersive Android and standalone
# fallback. They never change the server's role or financial policy.
python3 - "$SRC" <<'PY'
import json,sys,pathlib
r=pathlib.Path(sys.argv[1])
for path,entry in [
 ('dist/manifest-clientes.webmanifest','/clientes'),
 ('dist-restaurantes/manifest-restaurante.webmanifest','/restaurante'),
 ('dist-repartidores/manifest-repartidor.webmanifest','/repartidor')]:
 m=json.loads((r/path).read_text())
 assert m['start_url']==entry and m['display']=='standalone'
 assert m['display_override']==['fullscreen','standalone']
print('RC136_PWA_MANIFEST_GATES=PASS')
PY
HOST='repartidores-talaeats.alan-palacios-dev.com'
API='http://127.0.0.1:18199/api/v1'
# Check actual LIVE node via its dedicated PWA same-origin reverse proxy.
# A 401 from unauthenticated upload POST proves the route is mounted and
# protected; 404 would mean frontend-only release is still broken.
curl -fsS --max-time 8 -H "Host: $HOST" "$API/health" |
 python3 -c 'import json,sys;x=json.load(sys.stdin);assert x.get("status")=="ok" and x.get("production") is True' || {
 echo 'RC136_DEPLOY_ABORT=NODE_LIVE_HEALTH_NOT_READY';exit 1;
}
curl -fsS --max-time 8 -H "Host: $HOST" "$API/operations/onboarding-capabilities" |
 python3 -c 'import json,sys;x=json.load(sys.stdin);assert x.get("driver_plate_supported") is True and x.get("driver_documents_supported") is True and x.get("driver_admin_approval_required") is True' || {
 echo 'RC136_DEPLOY_ABORT=DRIVER_ONBOARDING_BACKEND_CAPABILITY_MISSING';exit 1;
}
status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 -H "Host: $HOST" \
 -H 'Content-Type: multipart/form-data; boundary=tala-no-file-readonly-probe' \
 -X POST --data '' "$API/uploads/onboarding-document")"
[[ "$status" == 401 ]] || {
 echo "RC136_DEPLOY_ABORT=PRIVATE_UPLOAD_ENDPOINT_EXPECTED_401_GOT_$status";exit 1;
}
for args in \
 "http://127.0.0.1:18195|web-talaeats.alan-palacios-dev.com|/clientes" \
 "http://127.0.0.1:18197|restaurantes-talaeats.alan-palacios-dev.com|/restaurante" \
 "http://127.0.0.1:18199|repartidores-talaeats.alan-palacios-dev.com|/repartidor";do
 IFS='|' read -r origin host path <<< "$args"
 curl -fsS --max-time 8 -H "Host: $host" "$origin$path" >/dev/null || {
  echo "RC136_DEPLOY_ABORT=PORTAL_NOT_READY:$path";exit 1;
 }
done
for port in 18195 18197 18199;do
 : "$port"
done
SCRIPTS=(
 "$SRC/deploy/kali-update-repartidores-isolated.sh"
 "$SRC/deploy/kali-update-restaurantes-isolated.sh"
 "$SRC/deploy/kali-update-existing-public.sh"
)
for script in "${SCRIPTS[@]}";do
 bash "$script" --plan "$SHA"
done
echo 'RC136_DEPLOY_PREFLIGHT=PASS_BACKEND_DOCUMENTS_AND_THREE_PORTALS'
if [[ "$MODE" == --plan ]];then
 echo 'RC136_DEPLOY_PLAN=PASS_READ_ONLY'
 exit 0
fi
# Each script keeps its own verified backup and previous link.
completed=()
recover(){
 local code=$?
 trap - EXIT
 if (( code != 0 ));then
  echo 'RC136_DEPLOY=FAILED_ROLLING_BACK_ALL_COMPLETED_PORTALS'
  for name in "${completed[@]}";do
   case "$name" in
    driver) bash "${SCRIPTS[0]}" --rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY || true;;
    merchant) bash "${SCRIPTS[1]}" --rollback I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY || true;;
    customer) bash "${SCRIPTS[2]}" --rollback I_APPROVE_PUBLIC_STATIC_ROLLBACK || true;;
   esac
  done
 fi
 exit "$code"
}
trap recover EXIT
bash "${SCRIPTS[0]}" --apply "$SHA" I_APPROVE_REPARTIDORES_STATIC_18199_ONLY
completed=(driver)
bash "${SCRIPTS[1]}" --apply "$SHA" I_APPROVE_RESTAURANTES_STATIC_18197_ONLY
completed=(merchant driver)
bash "${SCRIPTS[2]}" --apply "$SHA" I_APPROVE_PUBLIC_STATIC_18195_ONLY
completed=(customer merchant driver)
# Revalidate installed PWA manifests from each site after switching symlinks.
for item in \
 "18195|web-talaeats.alan-palacios-dev.com|manifest-clientes.webmanifest" \
 "18197|restaurantes-talaeats.alan-palacios-dev.com|manifest-restaurante.webmanifest" \
 "18199|repartidores-talaeats.alan-palacios-dev.com|manifest-repartidor.webmanifest";do
 IFS='|' read -r port host manifest <<< "$item"
 curl -fsS --max-time 8 -H "Host: $host" "http://127.0.0.1:$port/$manifest" |
  python3 -c 'import json,sys;m=json.load(sys.stdin);assert m["display_override"]==["fullscreen","standalone"]'
done
trap - EXIT
echo "RC136_THREE_PWA_DEPLOY=PASS_SHA:$SHA"
echo 'RC136_BACKEND_STRIPE_POSTGRES_PM2_CLOUDFLARED=UNMODIFIED'
