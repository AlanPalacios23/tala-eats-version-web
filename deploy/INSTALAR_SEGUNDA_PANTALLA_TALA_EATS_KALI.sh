#!/usr/bin/env bash
# Tala Eats Web /iniciar: conserva el splash original y sustituye la segunda
# pantalla por el arte "Comida de tu ciudad" ya versionado en GitHub.
# Solo frontend estatico en 127.0.0.1:18195; el instalador hace respaldo.
set -Eeuo pipefail
set +x
umask 077

BRANCH='feat/mobile-parity-v1046-navigation'
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/$BRANCH"
ASSET='public/branding/onboarding-comida-tu-ciudad-729x1536.webp'
ASSET_GIT_BLOB='49c25560dc2918817d474cd57749c983b5207499'
INSTALLER='deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for cmd in git curl bash grep; do
  command -v "$cmd" >/dev/null || { echo "ONBOARDING_ABORT=MISSING:$cmd"; exit 1; }
done

# Comprobar que GitHub sigue entregando exactamente la imagen aprobada.
curl -fsSL --retry 2 --max-time 45 "$RAW/$ASSET" -o "$TMP/second.webp"
test -s "$TMP/second.webp" || { echo 'ONBOARDING_ABORT=ASSET_MISSING'; exit 1; }
ACTUAL_BLOB="$(git hash-object "$TMP/second.webp")"
if [[ "$ACTUAL_BLOB" != "$ASSET_GIT_BLOB" ]]; then
  echo "ONBOARDING_ABORT=IMAGE_CHANGED"
  exit 1
fi
echo 'ONBOARDING_APPROVED_TACOS_ASSET=PASS'

# Usar el instalador existente: pruebas, build, backup y rollback.
curl -fsSL --retry 2 --max-time 25 "$RAW/$INSTALLER" -o "$TMP/install.sh"
bash -n "$TMP/install.sh"
grep -Fq 'onboarding-comida-tu-ciudad-729x1536.webp' "$TMP/install.sh" || {
  echo 'ONBOARDING_ABORT=INSTALLER_DOES_NOT_CHECK_SECOND_SCREEN'; exit 1;
}
grep -Fq 'kali-update-existing-public.sh' "$TMP/install.sh" || {
  echo 'ONBOARDING_ABORT=UNRECOGNIZED_DEPLOYER'; exit 1;
}

# Solo actualizar el frontend si pasan los chequeos de la API LIVE.
echo 'ONBOARDING_DEPLOY=START'
bash "$TMP/install.sh"
echo 'ONBOARDING_DEPLOY=SUCCESS'
echo 'ONBOARDING_PAGE=https://web-talaeats.alan-palacios-dev.com/iniciar'
echo 'ONBOARDING_BACKEND_PAYMENTS=NOT_MODIFIED'
