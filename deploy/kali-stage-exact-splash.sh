#!/usr/bin/env bash
# Install the *user-provided* exact splash artwork (no guessed/AI stock photo).
# Run only after copying the ChatGPT-generated .webp file into Kali.
# This stages an immutable public frontend ASSET, not the live web service.
set -euo pipefail
SHA="${1:-}"
SOURCE="${2:-/home/alan/talaeats_splash_exacto_728x1536.webp}"
if [[ ! "$SHA" =~ ^[a-f0-9]{40}$ ]]; then echo 'SPLASH_SHA_INVALID'; exit 2; fi
if [[ ! "$SOURCE" == /home/alan/* ]]; then echo 'SPLASH_SOURCE_MUST_BE_HOME_ALAN'; exit 2; fi
ROOT="/home/tala-node-stage/tala-eats-web-releases/$SHA"
DST="$ROOT/public/branding/splash-exacto-728x1536.webp"
if [[ ! -d "$ROOT/.git" && ! -f "$ROOT/.git/HEAD" ]]; then echo 'SPLASH_REPO_NOT_CLONED'; exit 2; fi
if [[ ! -f "$SOURCE" ]]; then echo "SPLASH_SOURCE_MISSING=$SOURCE"; exit 2; fi
# Image size, RIFF signature and VP8 encoded dimensions; no third-party packages.
python3 - "$SOURCE" <<'PY'
import os,sys,struct
p=sys.argv[1];z=os.path.getsize(p)
if not 30000<z<4000000:raise SystemExit('SPLASH_UNEXPECTED_FILE_SIZE')
with open(p,'rb') as f:d=f.read(128)
if d[:4]!=b'RIFF' or d[8:12]!=b'WEBP' or d[12:16]!=b'VP8 ':
 raise SystemExit('SPLASH_NOT_LOSSY_WEBP')
mark=d.find(b'\x9d\x01\x2a')
if mark<0 or mark+7>len(d):raise SystemExit('SPLASH_VP8_DIMENSIONS_MISSING')
width,height=struct.unpack_from('<HH',d,mark+3);width&=0x3fff;height&=0x3fff
if (width,height)!=(728,1536):raise SystemExit('SPLASH_EXPECTED_728x1536_GOT_'+str((width,height)))
print('SPLASH_ASSET_VALID=728x1536')
PY
install -D -o tala-node-stage -g tala-node-stage -m 0644 "$SOURCE" "$DST"
cmp -s "$SOURCE" "$DST"
echo "SPLASH_ASSET_STAGED=$DST"
echo "SPLASH_BACKEND_STRIPE_CLOUDFLARE=UNMODIFIED"
