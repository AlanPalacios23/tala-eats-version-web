#!/usr/bin/env bash
# Tala Eats Web: third onboarding screen "Rapido y seguro" / acceso por correo.
# Requires the EXACT customer-uploaded 864x1536 JPEG as the only argument.
# Installs one STATIC frontend release with the existing rollback mechanism.
set -Eeuo pipefail
set +x
umask 077

SOURCE="${1:-}"
[[ "$#" == 1 && -f "$SOURCE" && ! -L "$SOURCE" ]] || {
  echo 'BAG_ABORT=USE: bash INSTALAR_TERCERA_PANTALLA_TALA_EATS_KALI.sh /path/to/original.jpg'; exit 2;
}
ORIGINAL_SHA='f6e5db7fcf4430961d5b9f2eb55720b307b7fe9a81102c02d01515a341a54065'
ASSET='onboarding-rapido-seguro-864x1536.jpg'
REPO='https://github.com/AlanPalacios23/tala-eats-version-web.git'
BRANCH='feat/mobile-parity-v1046-navigation'
STAGE='/home/tala-node-stage'
STAGED="$STAGE/tala-eats-web-assets/$ASSET"
EXPECTED_HEAD="${TALA_WEB_EXPECTED_SHA:-}"
HOST='web-talaeats.alan-palacios-dev.com'
ORIGIN='http://127.0.0.1:18195'

for tool in git python3 sha256sum sudo curl bash; do
 command -v "$tool" >/dev/null || { echo "BAG_ABORT=MISSING_DEPENDENCY:$tool"; exit 1; }
done
[[ "$(sha256sum "$SOURCE" | cut -d' ' -f1)" == "$ORIGINAL_SHA" ]] || {
 echo 'BAG_ABORT=ORIGINAL_PHOTOGRAPH_SHA_MISMATCH'; exit 1;
}
echo 'BAG_ORIGINAL_USER_PHOTOGRAPH=PASS'

# Stage the ORIGINAL JPEG bytes; do not invent, regenerate or inpaint imagery.
sudo install -d -o tala-node-stage -g tala-node-stage -m 0750 "$STAGE/tala-eats-web-assets"
sudo install -o tala-node-stage -g tala-node-stage -m 0644 "$SOURCE" "$STAGED"
sudo -iu tala-node-stage bash -s -- "$REPO" "$BRANCH" "$ASSET" "$ORIGINAL_SHA" "$EXPECTED_HEAD" <<'BUILD'
set -Eeuo pipefail
REPO="$1"; BRANCH="$2"; ASSET="$3"; ORIGINAL_SHA="$4"; EXPECTED_HEAD="$5"
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
BASE="$HOME/tala-eats-web-releases"
mkdir -p "$BASE"
TEMP="$(mktemp -d "$BASE/.incoming.XXXXXX")"
trap 'rm -rf -- "$TEMP"' EXIT
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TEMP"
SHA="$(git -C "$TEMP" rev-parse HEAD)"
if [[ -n "$EXPECTED_HEAD" && "$SHA" != "$EXPECTED_HEAD" ]];then
 echo "BAG_ABORT=BRANCH_CHANGED_EXPECTED:${EXPECTED_HEAD}_ACTUAL:${SHA}"
 exit 1
fi
TARGET="$BASE/$SHA"
[[ ! -e "$TARGET" ]] || { echo 'BAG_ABORT=RELEASE_ALREADY_STAGED';exit 1; }
mv "$TEMP" "$TARGET"
trap - EXIT
cd "$TARGET"
IMG="public/branding/$ASSET"
install -m 0644 "$HOME/tala-eats-web-assets/$ASSET" "$IMG"
test "$(sha256sum "$IMG" | cut -d' ' -f1)" = "$ORIGINAL_SHA"
grep -Fq 'customer-bag-next' src/components/CustomerOnboarding.tsx
grep -Fq 'to="/acceso"' src/components/CustomerOnboarding.tsx
npm install --no-audit --no-fund
npm run check
env -u VITE_PREVIEW_READONLY npm run build
cmp -s "$IMG" "dist/branding/$ASSET"
printf '%s\n' "$SHA" > "$BASE/.last-bag-ready-sha"
echo 'BAG_BUILD_AND_TESTS=PASS'
echo "BAG_BUILD_SHA=$SHA"
BUILD

SHA="$(sudo -iu tala-node-stage cat "$STAGE/tala-eats-web-releases/.last-bag-ready-sha")"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'BAG_ABORT=SHA_INVALID';exit 1; }
DEPLOY="$STAGE/tala-eats-web-releases/$SHA/deploy/kali-update-existing-public.sh"
sudo bash "$DEPLOY" --plan "$SHA"
sudo bash "$DEPLOY" --apply "$SHA" I_APPROVE_PUBLIC_STATIC_18195_ONLY
# Compare exact ORIGINAL bytes served by the existing site; no image substitution.
LIVE_SHA="$(curl -fsS --max-time 25 -H "Host: $HOST" "$ORIGIN/branding/$ASSET" | sha256sum | cut -d' ' -f1)"
[[ "$LIVE_SHA" == "$ORIGINAL_SHA" ]] || {
 echo 'BAG_ABORT=LIVE_IMAGE_HASH_MISMATCH_CHECK_FRONTEND';exit 1;
}
curl -fsS --max-time 20 "https://$HOST/iniciar" >/dev/null
echo 'BAG_THIRD_SCREEN_PUBLIC=PASS'
echo "BAG_DEPLOY_SHA=$SHA"
echo "BAG_URL=https://$HOST/iniciar"
echo 'BAG_BACKEND_STRIPE_POSTGRES_REDIS_CLOUDFLARE=UNMODIFIED'
