#!/usr/bin/env bash
# Instala Tala Eats Usuarios Web DESDE GITHUB: imagen exacta + frontend.
# Solo modifica archivos estaticos del dominio publico EXISTENTE (18195).
set -euo pipefail
REPO="https://github.com/AlanPalacios23/tala-eats-version-web.git"
BRANCH="feat/mobile-parity-v1046-navigation"
IMG="public/branding/splash-exacto-728x1536.webp"
echo "SPLASH_INSTALL_SOURCE=GITHUB_ONLY"

sudo -iu tala-node-stage bash -s -- "$REPO" "$BRANCH" "$IMG" <<'BUILD'
set -euo pipefail
REPO="$1"; BRANCH="$2"; IMG="$3"
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
mkdir -p "$HOME/tala-eats-web-releases"
TMP="$(mktemp -d "$HOME/tala-eats-web-releases/.incoming.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP"
SHA="$(git -C "$TMP" rev-parse HEAD)"
ROOT="$HOME/tala-eats-web-releases/$SHA"
if [[ -d "$ROOT" ]]; then
  test "$(git -C "$ROOT" rev-parse HEAD)" = "$SHA"
else
  mv "$TMP" "$ROOT"
  trap - EXIT
fi
cd "$ROOT"
test -s "$IMG"
python3 - "$IMG" <<'PY'
import struct,sys
d=open(sys.argv[1],"rb").read(128)
if d[:4]!=b"RIFF" or d[8:12]!=b"WEBP" or d[12:16]!=b"VP8 ":
 raise SystemExit("SPLASH_IMAGE_INVALID")
m=d.find(b"\x9d\x01\x2a")
if m<0 or m+7>len(d):raise SystemExit("SPLASH_DIMENSIONS_MISSING")
w,h=struct.unpack_from("<HH",d,m+3)
if (w & 0x3fff,h & 0x3fff)!=(728,1536):
 raise SystemExit("SPLASH_WRONG_RESOLUTION")
print("SPLASH_GITHUB_IMAGE_728x1536=PASS")
PY
# Fail closed: never update public Web if the NEW second screen photo is missing.
TACOS="public/branding/onboarding-comida-tu-ciudad-729x1536.webp"
test -s "$TACOS"
python3 - "$TACOS" <<'PY'
import struct,sys
d=open(sys.argv[1],"rb").read(128)
if d[:4]!=b"RIFF" or d[8:12]!=b"WEBP" or d[12:16]!=b"VP8 ":
 raise SystemExit("TACOS_IMAGE_INVALID")
m=d.find(bytes([0x9d,0x01,0x2a]))
if m<0 or m+7>len(d):raise SystemExit("TACOS_DIMENSIONS_MISSING")
w,h=struct.unpack_from("<HH",d,m+3)
if (w&0x3fff,h&0x3fff)!=(729,1536):raise SystemExit("TACOS_WRONG_RESOLUTION")
print("TACOS_GITHUB_IMAGE_729x1536=PASS")
PY
npm install --no-audit --no-fund
npm run check
env -u VITE_PREVIEW_READONLY npm run build
cmp -s "$IMG" "dist/branding/splash-exacto-728x1536.webp"
cmp -s "$TACOS" "dist/branding/onboarding-comida-tu-ciudad-729x1536.webp"
printf '%s\n' "$SHA" > "$HOME/tala-eats-web-releases/.last-splash-ready-sha"
echo "BUILD_AND_IMAGE=PASS"
BUILD

SHA="$(sudo -iu tala-node-stage cat /home/tala-node-stage/tala-eats-web-releases/.last-splash-ready-sha)"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]]
SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-existing-public.sh"
sudo bash "$SCRIPT" --plan "$SHA"
sudo bash "$SCRIPT" --apply "$SHA" I_APPROVE_PUBLIC_STATIC_18195_ONLY

DOMAIN="https://web-talaeats.alan-palacios-dev.com"
JS="$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' /srv/talaeats-pwa/current/index.html | head -n 1)"
curl -fsS --max-time 20 "$DOMAIN/clientes" | grep -Fq "$JS"
TYPE="$(curl -sSIL --max-time 20 -o /dev/null -w '%{content_type}' "$DOMAIN/branding/splash-exacto-728x1536.webp")"
test "$TYPE" = "image/webp"
TACOS_TYPE="$(curl -sSIL --max-time 20 -o /dev/null -w '%{content_type}' "$DOMAIN/branding/onboarding-comida-tu-ciudad-729x1536.webp")"
test "$TACOS_TYPE" = "image/webp"
echo "TACOS_PUBLIC_729x1536=PASS"
echo "SPLASH_DEPLOY_SHA=$SHA"
echo "PUBLIC_VERSION_VERIFIED=PASS"
echo "BACKEND_PM2_STRIPE_CLOUDFLARED=UNMODIFIED"
