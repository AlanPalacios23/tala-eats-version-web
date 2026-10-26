#!/usr/bin/env bash
# Una sola importacion de la foto EXACTA 728x1536 desde el ZIP de ChatGPT.
# Ejecutar como alan en Kali, CON credenciales de GitHub para hacer git push.
# No modifica el servidor Web, Stripe, Cloudflared, PM2 ni PostgreSQL.
set -euo pipefail
REPO="https://github.com/AlanPalacios23/tala-eats-version-web.git"
BRANCH="feat/mobile-parity-v1046-navigation"
ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" ]]; then
 for path in "$HOME/Downloads/TalaEats_Splash_Exacto_Instalacion_Kali.zip" "$HOME/Descargas/TalaEats_Splash_Exacto_Instalacion_Kali.zip" "$HOME/TalaEats_Splash_Exacto_Instalacion_Kali.zip"; do
  if [[ -s "$path" ]]; then ARCHIVE="$path";break;fi
 done
fi
if [[ -z "$ARCHIVE" || ! -s "$ARCHIVE" ]]; then
 echo 'Falta ZIP. Copia TalaEats_Splash_Exacto_Instalacion_Kali.zip a ~/Downloads o ~/Descargas en Kali.' >&2
 exit 2
fi
ARCHIVE="$(realpath "$ARCHIVE")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo '=== Validacion de imagen exacta y ZIP ==='
unzip -tqq "$ARCHIVE"
unzip -p "$ARCHIVE" branding/splash-exacto-728x1536.webp > "$TMP/image.webp"
echo 'b48a972b1307ea9563f3d1167926d00299f7edc11569244baca5148ac69c3031  '"$TMP/image.webp" | sha256sum -c -
python3 - "$TMP/image.webp" <<'PY'
import sys,struct
d=open(sys.argv[1],'rb').read(128)
if d[:4]!=b'RIFF' or d[8:12]!=b'WEBP' or d[12:16]!=b'VP8 ':raise SystemExit('SPLASH_NOT_WEBP')
p=d.find(b'\x9d\x01\x2a')
if p<0 or p+7>len(d):raise SystemExit('SPLASH_HEADER_INVALID')
w,h=struct.unpack_from('<HH',d,p+3)
if (w&0x3fff,h&0x3fff)!=(728,1536):raise SystemExit('SPLASH_NOT_728x1536')
print('IMAGE_VERIFIED_728x1536=PASS')
PY
echo '=== Clonar rama desde GitHub ==='
git clone --quiet --depth 1 --single-branch --branch "$BRANCH" "$REPO" "$TMP/repo"
cd "$TMP/repo"
mkdir -p public/branding deploy/releases
cp "$TMP/image.webp" public/branding/splash-exacto-728x1536.webp
cp "$ARCHIVE" deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip
test -s deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh
git add public/branding/splash-exacto-728x1536.webp deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip
if git diff --cached --quiet; then
 echo 'GITHUB_SPLASH_FILES_ALREADY_UPLOADED=PASS'
else
 if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
  echo 'Configura git config --global user.name y user.email antes del push.' >&2
  exit 2
 fi
 git commit -m 'assets(splash): add exact user artwork and reusable Kali ZIP'
 git push origin "HEAD:refs/heads/$BRANCH"
fi
echo '=== Comprobar archivos en GitHub ==='
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/$BRANCH"
for path in public/branding/splash-exacto-728x1536.webp deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip;do
 code="$(curl -fsSL --max-time 20 -o /dev/null -w '%{http_code}' "$RAW/$path")"
 echo "$path HTTP=$code"
 test "$code" = 200
done
echo 'GITHUB_SPLASH_UPLOAD=PASS'
