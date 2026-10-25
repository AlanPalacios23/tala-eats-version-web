#!/usr/bin/env bash
# Read-only check of the existing public Cloudflare Tunnel legal pages.
# No credentials, backend writes, server configuration or Stripe changes.
set -euo pipefail
BASE="https://talaeats.alan-palacios-dev.com"
check(){
 local path="$1" status mime
 status="$(curl --silent --show-error --location --max-time 12 --output /dev/null --write-out '%{http_code}' "$BASE/$path" || true)"
 printf 'LEGAL_URL=%s/%s HTTP=%s\n' "$BASE" "$path" "${status:-ERROR}"
}
check privacidad
check eliminar-cuenta
# The first two URLs were previously verified. The exact terms page slug
# wasn't recorded; probe common non-destructive alternatives, do NOT invent
# a successful result from route spelling.
check terminos
check terminos-y-condiciones
check terminos-condiciones
check terminos-de-servicio
check legal/terminos
check legal/terminos-y-condiciones
check terms
check terminos-de-uso
# Look for any source-advertised link containing term/condic/tos, never
# assume an inferred URL exists without a real HTTP 200.
for path in "" privacidad eliminar-cuenta; do
 curl -fsS --location --max-time 12 "$BASE/${path}" 2>/dev/null |
  grep -oiE 'href=["\x27][^"\x27<>]+' |
  grep -Ei 'termin|condici|legal|terms' |
  sort -u | head -12 | sed 's/^/LEGAL_DISCOVERY=/' || true
done
printf 'LEGAL_AUDIT=PASS_READ_ONLY_NO_WRITES\n'
