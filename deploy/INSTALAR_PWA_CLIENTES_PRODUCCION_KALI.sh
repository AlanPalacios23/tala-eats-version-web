#!/usr/bin/env bash
# Tala Eats Web 2026-10: installable Cliente PWA production release.
# Use as 'alan' on Kali. Public static-only release; no backend or Stripe changes.
set -Eeuo pipefail
set +x
umask 077

REPO='https://github.com/AlanPalacios23/tala-eats-version-web.git'
BRANCH='feat/mobile-parity-v1046-navigation'
SITE='https://web-talaeats.alan-palacios-dev.com'
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
for name in curl bash git grep readlink python3 cmp;do
 command -v "$name" >/dev/null || { echo "CUSTOMER_PWA_ABORT=MISSING:$name";exit 1; }
done

# Resolve and freeze the same source SHA that will be compiled and published.
SHA="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || {
 echo 'CUSTOMER_PWA_ABORT=UNVERIFIED_GITHUB_SHA';exit 1;
}
RAW="https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/$SHA"
for path in src/components/CustomerPwaInstall.tsx public/manifest-clientes.webmanifest public/sw.js tests/customer-pwa-install.test.ts;do
 curl -fsSL --retry 2 --max-time 30 "$RAW/$path" -o "$TMP/${path##*/}"
done
grep -Fq 'CUSTOMER_PWA_INSTALL_NOTICE_KEY' "$TMP/CustomerPwaInstall.tsx"
grep -Fq 'beforeinstallprompt' "$TMP/CustomerPwaInstall.tsx"
grep -Fq 'PREVIEW_READONLY' "$TMP/CustomerPwaInstall.tsx"
grep -Fq "url.pathname.startsWith('/api/')" "$TMP/sw.js"
python3 - "$TMP/manifest-clientes.webmanifest" <<'PY'
import json,sys
m=json.load(open(sys.argv[1],encoding='utf-8'))
assert m['id']=='/app-clientes' and m['start_url']=='/clientes' and m['display']=='standalone'
assert len(m['icons'])>=2
print('CUSTOMER_PWA_MANIFEST_SOURCE=PASS')
PY
echo "CUSTOMER_PWA_TARGET_SHA=$SHA"

# The existing installer runs all tests, TypeScript/Vite, confirms API health,
# backs up /srv/talaeats-pwa/current and switches only the static PWA symlink.
curl -fsSL --retry 2 --max-time 30 "$RAW/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh" -o "$TMP/full-install.sh"
bash -n "$TMP/full-install.sh"
grep -Fq 'kali-update-existing-public.sh' "$TMP/full-install.sh" || {
 echo 'CUSTOMER_PWA_ABORT=UNRECOGNIZED_INSTALLER';exit 1;
}
grep -Fq 'TALA_EXPECTED_WEB_SHA' "$TMP/full-install.sh" || {
 echo 'CUSTOMER_PWA_ABORT=INSTALLER_IS_NOT_SHA_PINNED';exit 1;
}
echo 'CUSTOMER_PWA_PREDEPLOY=PASS'
TALA_EXPECTED_WEB_SHA="$SHA" bash "$TMP/full-install.sh"

# Post-deploy: prove both the files on disk and publicly served bytes are
# the version we pinned. Never imply that a payment was attempted.
ACTIVE="$(readlink -f /srv/talaeats-pwa/current)"
[[ "$ACTIVE" == /srv/talaeats-pwa/releases/* && "${ACTIVE##*/}" == "$SHA" ]] || {
 echo 'CUSTOMER_PWA_ABORT=WRONG_ACTIVE_RELEASE';exit 1;
}
test -s "$ACTIVE/sw.js"
test -s "$ACTIVE/manifest-clientes.webmanifest"
grep -RqF --include='*.js' 'tala-eats-customer-pwa-install-seen-v1' "$ACTIVE/assets" || {
 echo 'CUSTOMER_PWA_ABORT=NOTICE_NOT_IN_PRODUCTION_BUNDLE';exit 1;
}
grep -RqF --include='*.css' 'customer-pwa-install-notice' "$ACTIVE/assets" || {
 echo 'CUSTOMER_PWA_ABORT=NOTICE_STYLES_MISSING';exit 1;
}
curl -fsSL --retry 2 --max-time 25 "$SITE/manifest-clientes.webmanifest" -o "$TMP/public-manifest.json"
curl -fsSL --retry 2 --max-time 25 "$SITE/sw.js" -o "$TMP/public-sw.js"
cmp "$ACTIVE/manifest-clientes.webmanifest" "$TMP/public-manifest.json" >/dev/null || {
 echo 'CUSTOMER_PWA_ABORT=PUBLIC_MANIFEST_DIFFERENT';exit 1;
}
cmp "$ACTIVE/sw.js" "$TMP/public-sw.js" >/dev/null || {
 echo 'CUSTOMER_PWA_ABORT=PUBLIC_SERVICE_WORKER_DIFFERENT';exit 1;
}
for route in / /iniciar /clientes;do
 curl -fsSL --max-time 20 "$SITE$route" -o "$TMP/index-check.html"
 grep -Fq '<div id="root">' "$TMP/index-check.html" || {
  echo "CUSTOMER_PWA_ABORT=PUBLIC_ROUTE_INVALID:$route";exit 1;
 }
done
echo 'CUSTOMER_PWA_PUBLIC=PASS'
echo "CUSTOMER_PWA_DEPLOY_SHA=$SHA"
echo "CUSTOMER_PWA_URL=$SITE/iniciar"
echo 'CUSTOMER_PWA_BACKEND_PAYMENTS_POSTGRES_CLOUDFLARED=UNMODIFIED'
