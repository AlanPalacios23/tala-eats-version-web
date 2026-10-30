#!/usr/bin/env bash
# RC138: produce ONLY the independent driver PWA build from an immutable GitHub SHA.
# Never changes /srv, PM2, Stripe, PostgreSQL, nginx, Cloudflared or public domains.
set -Eeuo pipefail
set +x
umask 022
SHA="${1:-}"
[[ "$#" -eq 1 && "$SHA" =~ ^[0-9a-f]{40}$ ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_SHA40_REQUIRED';exit 2;
}
[[ "$(id -un)" == tala-node-stage && "$HOME" == /home/tala-node-stage ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_RUN_AS_TALA_NODE_STAGE';exit 2;
}
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
for bin in git node npm python3 sha256sum grep find;do command -v "$bin" >/dev/null || {
 echo "DRIVER_RC138_BUILD=HOLD_MISSING_TOOL:$bin";exit 2;
};done
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$MAJOR" == 22 || "$MAJOR" == 24 ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_NODE_22_OR_24_REQUIRED';exit 2;
}
# Financial features are server releases, NEVER enabled by a frontend-only build.
for flag in VITE_PREVIEW_READONLY VITE_DRIVER_ACTIONS_ENABLED VITE_CASH_HANDOFF_V2_ENABLED VITE_FINANCE_WALLET_V2_ENABLED;do
 [[ "${!flag:-false}" != true ]] || {
  echo "DRIVER_RC138_BUILD=HOLD_FRONTEND_FLAG:$flag";exit 2;
 }
done
BASE="$HOME/tala-eats-web-releases"
TARGET="$BASE/$SHA"
[[ ! -e "$TARGET" && ! -L "$TARGET" ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_TARGET_EXISTS_NO_OVERWRITE';exit 2;
}
mkdir -p "$BASE"
git clone --no-checkout https://github.com/AlanPalacios23/tala-eats-version-web.git "$TARGET"
git -C "$TARGET" fetch origin "$SHA"
git -C "$TARGET" checkout --detach "$SHA"
actual="$(git -C "$TARGET" rev-parse HEAD)" || {
 echo 'DRIVER_RC138_BUILD=HOLD_GIT_REV_PARSE';exit 2;
}
tracked="$(git -C "$TARGET" status --porcelain --untracked-files=no)" || {
 echo 'DRIVER_RC138_BUILD=HOLD_GIT_INDEX_UNREADABLE';exit 2;
}
[[ "$actual" == "$SHA" && -z "$tracked" ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_UNTRUSTED_TREE';exit 2;
}
cd "$TARGET"
# Explicitly avoid stale operator VITE_* values. These environment-only toggles
# do NOT enable real server releases; the production API remains authoritative.
export VITE_PREVIEW_READONLY=false
export VITE_DRIVER_ACTIONS_ENABLED=false
export VITE_CASH_HANDOFF_V2_ENABLED=false
export VITE_FINANCE_WALLET_V2_ENABLED=false
# Current repository has no package-lock.json; use the same install procedure
# as its passing GitHub Actions workflow. CI must pass for this exact commit.
npm install --no-package-lock --no-audit --no-fund
npm test
npm run build:repartidor
DIST="$TARGET/dist-repartidores"
for asset in repartidores.html sw-repartidor.js manifest-repartidor.webmanifest;do
 [[ -s "$DIST/$asset" ]] || { echo "DRIVER_RC138_BUILD=HOLD_ASSET:$asset";exit 2; }
done
[[ ! -e "$DIST/index.html" ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_CUSTOMER_SHELL_INCLUDED';exit 2;
}
[[ -z "$(find "$DIST" -type l -print -quit)" ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_SYMLINK_IN_DIST';exit 2;
}
[[ -z "$(find "$DIST" -type f \( -name '*.key' -o -name '*.pem' -o -name '.env*' \) -print -quit)" ]] || {
 echo 'DRIVER_RC138_BUILD=HOLD_SECRETS_IN_DIST';exit 2;
}
! grep -Fq 'name="tala-preview-mode"' "$DIST/repartidores.html" || {
 echo 'DRIVER_RC138_BUILD=HOLD_PREVIEW_SHELL';exit 2;
}
python3 - "$DIST/manifest-repartidor.webmanifest" <<'PY'
import json,sys
m=json.load(open(sys.argv[1]))
assert m['start_url']=='/repartidor'
assert m['display']=='standalone'
assert m['display_override']==['fullscreen','standalone']
print('DRIVER_RC138_MANIFEST=PASS')
PY
echo "DRIVER_RC138_BUILD_SHA=$SHA"
sha256sum "$DIST/repartidores.html" "$DIST/sw-repartidor.js"
echo 'DRIVER_RC138_BUILD=PASS_NOT_DEPLOYED'
echo 'DRIVER_RC138_BACKEND_STRIPE_PG_PM2_NGINX=UNMODIFIED'
