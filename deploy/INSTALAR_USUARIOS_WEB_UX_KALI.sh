#!/usr/bin/env bash
# Tala Eats Pedir comida Web UX + fixes: /clientes, /buscar, /comercio,
# /carrito, /checkout. Reuse vetted static-only production deployment.
set -Eeuo pipefail
set +x
umask 077
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
for cmd in curl bash grep git sha256sum readlink awk;do
 command -v "$cmd" >/dev/null || { echo "USERS_WEB_ABORT=MISSING:$cmd"; exit 1; }
done
curl -fsSL --retry 2 --max-time 30 "$RAW/src/lib/cart.ts" -o "$TMP/cart.ts"
curl -fsSL --retry 2 --max-time 30 "$RAW/src/components/CustomerCommerce.tsx" -o "$TMP/commerce.tsx"
curl -fsSL --retry 2 --max-time 30 "$RAW/src/components/CustomerCheckout.tsx" -o "$TMP/checkout.tsx"
curl -fsSL --retry 2 --max-time 30 "$RAW/src/styles/main.css" -o "$TMP/styles.css"
curl -fsSL --retry 2 --max-time 30 "$RAW/tests/customer-storefront-hardening.test.ts" -o "$TMP/qa.ts"
grep -Fq 'remainingForVariant' "$TMP/cart.ts"
grep -Fq 'maxLength={200}' "$TMP/commerce.tsx"
grep -Fq 'restaurant?.pickup_enabled!==true' "$TMP/checkout.tsx"
grep -Fq 'premium minimal food storefront' "$TMP/styles.css"
grep -Fq 'never grows beyond fifty units' "$TMP/qa.ts"
echo "USERS_WEB_UX_SOURCE=PASS"
curl -fsSL --retry 2 --max-time 30 "$RAW/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh" -o "$TMP/installer.sh"
bash -n "$TMP/installer.sh"
grep -Fq 'kali-update-existing-public.sh' "$TMP/installer.sh" || {
 echo 'USERS_WEB_ABORT=UNSAFE_DEPLOYER';exit 1;
}
# Pin the exact tested branch HEAD: if it moves during installation,
# the upstream static installer aborts BEFORE plan/apply.
EXPECTED="$(git ls-remote 'https://github.com/AlanPalacios23/tala-eats-version-web.git' 'refs/heads/feat/mobile-parity-v1046-navigation' | awk 'NR==1{print $1}')"
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]] || { echo 'USERS_WEB_ABORT=REMOTE_SHA_INVALID';exit 1; }
echo "USERS_WEB_TARGET_SHA=$EXPECTED"
TALA_EXPECTED_WEB_SHA="$EXPECTED" bash "$TMP/installer.sh"
ACTIVE="$(readlink -f /srv/talaeats-pwa/current)"
[[ "$ACTIVE" == /srv/talaeats-pwa/releases/* ]] || {
 echo 'USERS_WEB_ABORT=ACTIVE_RELEASE_UNKNOWN';exit 1;
}
SHA="${ACTIVE##*/}"
test "$SHA" = "$EXPECTED" || { echo 'USERS_WEB_ABORT=ACTIVE_RELEASE_SHA_CHANGED';exit 1; }
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
test -s "$SOURCE/tests/customer-storefront-hardening.test.ts"
test -s "$ACTIVE/index.html"
grep -RFql --include='*.css' 'mobile-product-note' "$ACTIVE/assets" ||
 { echo 'USERS_WEB_ABORT=DEPLOYED_STYLE_MISSING';exit 1; }
curl -fsSL --max-time 20 'https://web-talaeats.alan-palacios-dev.com/clientes' |
 grep -Fq '<div id="root">' ||
 { echo 'USERS_WEB_ABORT=PUBLIC_CUSTOMER_SHELL_INVALID';exit 1; }
echo "USERS_WEB_UX_PUBLIC=PASS"
echo "USERS_WEB_DEPLOY_SHA=$SHA"
echo 'USERS_WEB_BACKEND_AND_STRIPE=UNMODIFIED'
echo 'USERS_WEB_URL=https://web-talaeats.alan-palacios-dev.com/clientes'
