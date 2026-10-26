#!/usr/bin/env bash
# Tala Eats Web — solo portada principal /.
# Conserva la marca Tala Eats y los tres accesos; pie solo con 2 enlaces legales.
# Reutiliza el instalador probado: pruebas, build, backup y switch atomico
# SOLO de archivos estaticos del sitio publico 127.0.0.1:18195.
set -Eeuo pipefail
set +x
umask 077
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation"
HOST="web-talaeats.alan-palacios-dev.com"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
for tool in curl bash grep awk readlink;do
 command -v "$tool" >/dev/null || { echo "GATEWAY_ABORT=MISSING:$tool";exit 1; }
done

# Confirm the GitHub source is the minimal portal, not an older review.
curl -fsSL --retry 2 --max-time 30 "$RAW/src/App.tsx" -o "$TMP/App.tsx"
awk '/function PortalLanding\\(\\)\\{/{inside=1} /function Protected\\(/{inside=0} inside {print}' "$TMP/App.tsx" > "$TMP/portal.tsx"
grep -Fq 'className="gateway gateway-minimal"' "$TMP/portal.tsx" ||
 { echo 'GATEWAY_ABORT=NOT_MINIMAL';exit 1; }
grep -Fq 'href={LEGAL_LINKS.terms}' "$TMP/portal.tsx" ||
 { echo 'GATEWAY_ABORT=TERMS_LINK_MISSING';exit 1; }
grep -Fq 'href={LEGAL_LINKS.deletion}' "$TMP/portal.tsx" ||
 { echo 'GATEWAY_ABORT=ACCOUNT_DELETION_LINK_MISSING';exit 1; }
if grep -Eq 'gateway-(header-actions|heading|menu-toggle|footer-brand)' "$TMP/portal.tsx";then
 echo 'GATEWAY_ABORT=OLD_PORTAL_ELEMENTS_FOUND';exit 1
fi
echo 'GATEWAY_MINIMAL_SOURCE=PASS'

# Reuse hardened Kali production static-only deploy, WITHOUT touching backend.
curl -fsSL --retry 2 --max-time 30 "$RAW/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh" -o "$TMP/installer.sh"
bash -n "$TMP/installer.sh"
grep -Fq 'kali-update-existing-public.sh' "$TMP/installer.sh" ||
 { echo 'GATEWAY_ABORT=UNTRUSTED_DEPLOY_PATH';exit 1; }
bash "$TMP/installer.sh"

# Verify active production assets include this portal layout.
ACTIVE="$(readlink -f /srv/talaeats-pwa/current)"
[[ "$ACTIVE" == /srv/talaeats-pwa/releases/* ]] ||
 { echo 'GATEWAY_ABORT=INVALID_ACTIVE_RELEASE';exit 1; }
test -s "$ACTIVE/index.html"
grep -RFlq --include='*.js' 'gateway-minimal' "$ACTIVE/assets" ||
 { echo 'GATEWAY_ABORT=ACTIVE_JS_NOT_MINIMAL';exit 1; }
grep -RFlq --include='*.js' 'Eliminación de cuenta' "$ACTIVE/assets" ||
 { echo 'GATEWAY_ABORT=LEGAL_DELETION_TEXT_NOT_IN_BUNDLE';exit 1; }
curl -fsS --retry 2 --max-time 20 "https://$HOST/" |
 grep -Fq '<div id="root">' ||
 { echo 'GATEWAY_ABORT=PUBLIC_ROOT_UNHEALTHY';exit 1; }
echo 'GATEWAY_MINIMAL_PUBLIC=PASS'
echo 'GATEWAY_PUBLIC_URL=https://web-talaeats.alan-palacios-dev.com/'
echo 'GATEWAY_BACKEND_STRIPE_CLOUDFLARED=UNMODIFIED'
