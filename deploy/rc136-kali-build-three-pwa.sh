#!/usr/bin/env bash
# RC136: compile three isolated PWA bundles at one immutable GitHub SHA.
# Run as tala-node-stage. Never writes PM2, Stripe, DB, nginx or /srv.
set -Eeuo pipefail
set +x
umask 022
SHA="${1:-}"
[[ "$#" == 1 && "$SHA" =~ ^[a-f0-9]{40}$ ]] || {
  echo 'RC136_BUILD_ABORT=USAGE_SHA40'; exit 2;
}
[[ "$(id -un)" == 'tala-node-stage' ]] || {
  echo 'RC136_BUILD_ABORT=RUN_AS_TALA_NODE_STAGE'; exit 2;
}
for tool in git npm node; do command -v "$tool" >/dev/null || {
 echo "RC136_BUILD_ABORT=MISSING:$tool"; exit 2;
}; done
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" == 24 || "$NODE_MAJOR" == 22 ]] || {
 echo 'RC136_BUILD_ABORT=NODE_22_OR_24_REQUIRED';exit 2;
}
[[ "${VITE_PREVIEW_READONLY:-false}" != 'true' &&
   "${VITE_CASH_HANDOFF_V2_ENABLED:-false}" != 'true' &&
   "${VITE_FINANCE_WALLET_V2_ENABLED:-false}" != 'true' ]] || {
 echo 'RC136_BUILD_ABORT=PREVIEW_OR_UNRELEASED_FINANCE_FLAGS';exit 2;
}
REPO='https://github.com/AlanPalacios23/tala-eats-version-web.git'
BASE='/home/tala-node-stage/tala-eats-web-releases'
TARGET="$BASE/$SHA"
[[ ! -e "$TARGET" && ! -L "$TARGET" ]] || {
 echo 'RC136_BUILD_ABORT=EXISTING_RELEASE_DO_NOT_OVERWRITE';exit 2;
}
mkdir -p "$BASE"
git clone --no-checkout "$REPO" "$TARGET"
abort(){
 local code=$?
 if [[ "$code" -ne 0 ]];then
  echo 'RC136_BUILD=FAILED_RELEASE_RETAINED_FOR_FORENSICS'
 fi
 exit "$code"
}
trap abort EXIT
git -C "$TARGET" fetch origin "$SHA"
git -C "$TARGET" checkout --detach "$SHA"
[[ "$(git -C "$TARGET" rev-parse HEAD)" == "$SHA" ]] || {
 echo 'RC136_BUILD_ABORT=SHA_MISMATCH';exit 2;
}
cd "$TARGET"
# Vite supports Node 22/24; all feature toggles are inherited deliberately.
# This is NOT the read-only preview. No API write is exercised at build time.
npm install --no-audit --no-fund --no-package-lock
npm run check
for asset in dist/index.html dist/sw.js dist/manifest-clientes.webmanifest \
 dist-restaurantes/restaurantes.html dist-restaurantes/sw-restaurante.js \
 dist-repartidores/repartidores.html dist-repartidores/sw-repartidor.js; do
 [[ -s "$asset" ]] || { echo "RC136_BUILD_ABORT=ASSET_MISSING:$asset";exit 1; }
done
for asset in dist/index.html dist-restaurantes/restaurantes.html \
 dist-repartidores/repartidores.html; do
 ! grep -Fq 'name="tala-preview-mode"' "$asset" || {
  echo "RC136_BUILD_ABORT=READONLY_PREVIEW_ARTIFACT:$asset";exit 1;
 }
done
printf 'RC136_BUILD_SHA=%s\n' "$SHA"
sha256sum dist/index.html dist-restaurantes/restaurantes.html \
 dist-repartidores/repartidores.html
echo 'RC136_BUILD=PASS_THREE_ISOLATED_PWA_BUNDLES'
echo 'RC136_BACKEND_PM2_STRIPE_POSTGRES=UNMODIFIED'
trap - EXIT
