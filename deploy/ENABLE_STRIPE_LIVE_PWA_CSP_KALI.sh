#!/usr/bin/env bash
# TALA EATS: add only Stripe.js LIVE Payment Element origins to the EXISTING
# isolated public PWA Nginx CSP. No Node PM2, DB, Cloudflared, Stripe or global nginx.
set -Eeuo pipefail
set +x
umask 077
MODE="${1:-}"
[[ "$MODE" == "--plan" || "$MODE" == "--apply" ]] || {
 echo 'PICKUP_CSP_ABORT=USE_PLAN_OR_APPLY';exit 2;
}
[[ "$MODE" != "--apply" || "${2:-}" == "I_APPROVE_PWA_18195_CSP_ONLY" ]] || {
 echo 'PICKUP_CSP_ABORT=EXPLICIT_APPROVAL_REQUIRED';exit 2;
}
[[ "$MODE" != "--apply" || "$#" -eq 2 ]] || exit 2
CONF=/etc/talaeats-web-pwa/server.conf
MAIN=/etc/talaeats-web-pwa/nginx.conf
SERVICE=talaeats-web-pwa.service
[[ -f "$CONF" && ! -L "$CONF" && -f "$MAIN" && ! -L "$MAIN" ]] || {
 echo 'PICKUP_CSP_HOLD=EXISTING_ISOLATED_SITE_REQUIRED';exit 1;
}
systemctl is-active --quiet "$SERVICE" || {
 echo 'PICKUP_CSP_HOLD=EXISTING_SERVICE_NOT_ACTIVE';exit 1;
}
for name in python3 nginx systemctl curl;do
 command -v "$name" >/dev/null || { echo "PICKUP_CSP_HOLD=MISSING_$name";exit 1; }
done
# Preflight proves the installed site proxies to the existing LIVE payment API.
python3 - "$CONF" "$MODE" <<'PY'
from pathlib import Path
import re,sys
conf=Path(sys.argv[1]).read_text()
for required in (
 'listen 127.0.0.1:18195;',
 'server_name web-talaeats.alan-palacios-dev.com;',
 'root /srv/talaeats-pwa/current;',
 'proxy_pass http://127.0.0.1:18190;',
):
 if required not in conf:raise SystemExit('PICKUP_CSP_HOLD=UNRECOGNIZED_OR_CHANGED_PWA_SITE')
policies=re.findall(r'add_header Content-Security-Policy "([^"]+)" always;',conf)
if len(policies)!=1:raise SystemExit('PICKUP_CSP_HOLD=UNKNOWN_CSP_LAYOUT')
p=policies[0]
base="script-src 'self';"
connect="connect-src 'self';"
if "https://js.stripe.com" in p:
 for value in ("script-src 'self' https://js.stripe.com;",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com;",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com;"):
  if value not in p:raise SystemExit('PICKUP_CSP_HOLD=PARTIAL_OR_UNREVIEWED_STRIPE_CSP')
 print('PICKUP_CSP_ALREADY_CONFIGURED=PASS')
else:
 if p.count(base)!=1 or p.count(connect)!=1 or 'frame-src ' in p or 'form-action ' in p:
  raise SystemExit('PICKUP_CSP_HOLD=CSP_UNEXPECTED_OR_ALREADY_MODIFIED')
 print('PICKUP_CSP_EXACT_BASE_POLICY=PASS')
print('PICKUP_CSP_SITE_AND_LIVE_UPSTREAM=PASS')
print('PICKUP_CSP_PLAN=PASS_READ_ONLY')
PY
[[ "$MODE" == "--plan" ]] && exit 0
[[ "$(id -u)" == "0" ]] || { echo 'PICKUP_CSP_HOLD=RUN_APPLY_AS_ROOT';exit 1; }
BACKUPS=/etc/talaeats-web-pwa/stripe-csp-backups
mkdir -p -m 700 "$BACKUPS"
[[ -d "$BACKUPS" && ! -L "$BACKUPS" ]] || exit 1
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP="$BACKUPS/server.conf.$STAMP"
cp -- "$CONF" "$BACKUP"
chmod 600 "$BACKUP"
NEW="$(mktemp /etc/talaeats-web-pwa/.csp-XXXXXX)"
RESTORE=yes
restore() {
 local code="$?"
 trap - EXIT
 if [[ "$code" -ne 0 && "$RESTORE" == yes ]];then
  cp -- "$BACKUP" "$CONF"
  nginx -t -c "$MAIN" >/dev/null 2>&1 || true
  systemctl reload "$SERVICE" >/dev/null 2>&1 || true
  echo 'PICKUP_CSP_ROLLBACK=ATTEMPTED'
 fi
 rm -f -- "$NEW"
 exit "$code"
}
trap restore EXIT
python3 - "$CONF" "$NEW" <<'PY'
from pathlib import Path
import re,sys
current=Path(sys.argv[1]).read_text()
policy=re.findall(r'add_header Content-Security-Policy "([^"]+)" always;',current)
if len(policy)!=1:raise SystemExit('PICKUP_CSP_ABORT=UNKNOWN_POLICY')
p=policy[0]
if "script-src 'self' https://js.stripe.com;" in p:
 new=current
else:
 assert p.count("script-src 'self';")==1
 assert p.count("connect-src 'self';")==1
 p2=p.replace("script-src 'self';",
  "script-src 'self' https://js.stripe.com;")
 p2=p2.replace("connect-src 'self';",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com; form-action 'self' https://hooks.stripe.com;")
 new=current.replace('add_header Content-Security-Policy "'+p+'" always;',
  'add_header Content-Security-Policy "'+p2+'" always;')
 assert new!=current
Path(sys.argv[2]).write_text(new)
PY
cp -- "$NEW" "$CONF"
nginx -t -c "$MAIN"
systemctl reload "$SERVICE"
# Verify the ACTUAL publicly served CSP header, not just the on-disk config.
curl -fsSI --max-time 15 https://web-talaeats.alan-palacios-dev.com/clientes |
 python3 -c "import sys
h=sys.stdin.read().lower()
if 'https://js.stripe.com' not in h or 'https://api.stripe.com' not in h:
 raise SystemExit('PICKUP_CSP_HOLD=PUBLIC_HEADERS_NOT_UPDATED')
print('PICKUP_CSP_PUBLIC_STRIPE_HEADERS=PASS')"
RESTORE=no
trap - EXIT
rm -f -- "$NEW"
echo 'PICKUP_CSP_ISOLATED_NGINX_APPLY=PASS'
echo 'PICKUP_CSP_NODE_STRIPE_DATABASE_UNTOUCHED=YES'
