#!/usr/bin/env bash
# Tres fotos originales: 'Un antojo', correo, contrasena.
# Destino: public frontend /iniciar and /acceso on existing :18195.
# No changes to backend, payments, Redis, PostgreSQL or tunnel.
set -Eeuo pipefail
set +x
umask 077
BASE="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
for cmd in curl bash sha256sum; do
 command -v "$cmd" >/dev/null || { echo "THREE_PHOTOS_ABORT=MISSING_DEPENDENCY:$cmd";exit 1; }
done
# Fail before any deploy when any GitHub original is missing or differs.
check(){
 local name="$1" sha="$2"
 curl -fsSL --retry 2 --max-time 45 "$BASE/public/branding/$name" -o "$TMP/$name"
 test "$(sha256sum "$TMP/$name" | cut -d' ' -f1)" = "$sha" || {
   echo "THREE_PHOTOS_ABORT=IMAGE_HASH_MISMATCH:$name";exit 1;
 }
}
check 'onboarding-un-antojo-864x1536.jpg' '105f48692d4a6f8d7f97539a4cf3a70cd0d1359ea3fd74117ef8bb8a5d6dc467'
check 'auth-continua-correo-864x1536.jpg' 'cda451a040e39149cae1180bba396db08995dce2b8b65879e9d9a97dd8d12c05'
check 'auth-contrasena-729x1536.jpg' 'f188855e75afa63973e78317d6198ac14b0e5a310be99e2c242f351d4d2570ed'
echo 'THREE_GITHUB_ORIGINAL_IMAGES=PASS'
curl -fsSL --retry 2 --max-time 30 "$BASE/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh" -o "$TMP/installer.sh"
bash -n "$TMP/installer.sh"
grep -Fq 'THREE_NEW_PHOTOS_PUBLIC=PASS' "$TMP/installer.sh" || {
 echo "THREE_PHOTOS_ABORT=INSTALLER_WITHOUT_NEW_IMAGE_CHECKS";exit 1;
}
bash "$TMP/installer.sh"
echo 'THREE_ONBOARDING_AND_AUTH_PHOTOS_DEPLOYED=PASS'
echo 'THREE_PHOTOS_URL=https://web-talaeats.alan-palacios-dev.com/iniciar'
