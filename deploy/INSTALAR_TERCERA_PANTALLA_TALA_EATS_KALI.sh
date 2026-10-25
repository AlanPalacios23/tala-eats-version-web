#!/usr/bin/env bash
# Tala Eats /iniciar: all three original user-approved images from GitHub.
# Run directly as alan in Kali: no PowerShell, local photo or manual upload.
set -Eeuo pipefail
set +x
umask 077
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation"
ASSET="public/branding/onboarding-rapido-seguro-864x1536.jpg"
EXPECTED_SHA256="f6e5db7fcf4430961d5b9f2eb55720b307b7fe9a81102c02d01515a341a54065"
EXPECTED_BLOB="04f05eb2a7347d6f41ba84417ae3ca936e8f66af"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

for cmd in curl bash git sha256sum;do
 command -v "$cmd" >/dev/null || { echo "BAG_ABORT=MISSING_DEPENDENCY:$cmd";exit 1; }
done

curl -fsSL --retry 2 --max-time 45 "$RAW/$ASSET" -o "$TMP/bag-original.jpg"
test "$(sha256sum "$TMP/bag-original.jpg" | cut -d' ' -f1)" = "$EXPECTED_SHA256" || {
 echo "BAG_ABORT=SOURCE_IMAGE_SHA256_MISMATCH"; exit 1;
}
test "$(git hash-object "$TMP/bag-original.jpg")" = "$EXPECTED_BLOB" || {
 echo "BAG_ABORT=SOURCE_IMAGE_GIT_BLOB_MISMATCH";exit 1;
}
echo "BAG_ORIGINAL_IMAGE_FROM_GITHUB=PASS"

curl -fsSL --retry 2 --max-time 30 "$RAW/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh" -o "$TMP/full-installer.sh"
bash -n "$TMP/full-installer.sh"
grep -Fq 'BAG_GITHUB_APPROVED_ORIGINAL=PASS' "$TMP/full-installer.sh" || {
 echo "BAG_ABORT=UNRECOGNIZED_INSTALLER";exit 1;
}
echo "BAG_ALL_IMAGES_INSTALLER_VERIFIED=PASS"
bash "$TMP/full-installer.sh"
echo "BAG_ALL_THREE_SCREENS_DEPLOY=SUCCESS"
echo "BAG_THIRD_SCREEN_URL=https://web-talaeats.alan-palacios-dev.com/iniciar"
