#!/usr/bin/env bash
# Recovery for pre-existing customized LIVE 18195 CSP (RC8.14 pickup).
# Config-only: no Nginx global reload, no PM2/Node/Stripe/PG/Cloudflared writes.
set -Eeuo pipefail
set +x
umask 077
MODE="${1:-}"
if [[ "$MODE" != --plan && "$MODE" != --apply ]] ||
   [[ "$MODE" == --plan && "$#" -ne 1 ]] ||
   [[ "$MODE" == --apply &&
      ( "$#" -ne 2 || "${2:-}" != I_APPROVE_RC814_ISOLATED_PWA_CSP_ONLY ) ]];then
 echo 'RC814_CSP_ABORT=USE_PLAN_OR_APPLY_WITH_EXPLICIT_APPROVAL'
 exit 2
fi
CONF=/etc/talaeats-web-pwa/server.conf
MAIN=/etc/talaeats-web-pwa/nginx.conf
SERVICE=talaeats-web-pwa.service
[[ -f "$CONF" && ! -L "$CONF" && -f "$MAIN" && ! -L "$MAIN" ]] || {
 echo 'RC814_CSP_HOLD=UNRECOGNIZED_ISOLATED_CONF';exit 1;
}
for name in python3 curl systemctl nginx cmp;do
 command -v "$name" >/dev/null || { echo "RC814_CSP_HOLD=MISSING_${name}";exit 1; }
done
systemctl is-active --quiet "$SERVICE" || {
 echo 'RC814_CSP_HOLD=ISOLATED_NGINX_NOT_ACTIVE';exit 1;
}
[[ "$(readlink -f /srv/talaeats-pwa/current)" == /srv/talaeats-pwa/releases/* ]] || {
 echo 'RC814_CSP_HOLD=UNKNOWN_PUBLIC_RELEASE';exit 1;
}
OUT=""
if [[ "$MODE" == --apply ]];then
 [[ "$(id -u)" == 0 ]] || { echo 'RC814_CSP_HOLD=ROOT_REQUIRED_FOR_CSP_ONLY';exit 1; }
 OUT="$(mktemp /etc/talaeats-web-pwa/.rc814-csp-XXXXXX)"
fi
cleanup_tmp(){ [[ -z "$OUT" ]] || rm -f -- "$OUT"; }
trap cleanup_tmp EXIT

python3 - "$CONF" "$MODE" "$OUT" <<'PY'
import re,sys
from pathlib import Path
source=Path(sys.argv[1]).read_text(encoding="utf-8")
mode,out=sys.argv[2:4]
expected=(
 "listen 127.0.0.1:18195;",
 "server_name web-talaeats.alan-palacios-dev.com;",
 "root /srv/talaeats-pwa/current;",
 "proxy_pass http://127.0.0.1:18190;",
)
if any(source.count(k)!=1 for k in expected):
 raise SystemExit("RC814_CSP_HOLD=ISOLATION_OR_LIVE_BACKEND_MISMATCH")
pattern=r'add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always\s*;'
matches=list(re.finditer(pattern,source))
if not 1<=len(matches)<=2:
 raise SystemExit("RC814_CSP_HOLD=MISSING_OR_MULTIPLE_CSP")
policies=[m.group(1) for m in matches]
if any(p!=policies[0] for p in policies):
 raise SystemExit("RC814_CSP_HOLD=CONFLICTING_CSP_POLICIES")
p=policies[0]
directives=[]
for piece in p.split(';'):
 piece=piece.strip()
 if not piece:continue
 chunks=piece.split()
 if not re.fullmatch('[a-z][a-z-]*',chunks[0]):
  raise SystemExit("RC814_CSP_HOLD=INVALID_DIRECTIVE")
 directives.append((chunks[0],chunks[1:]))
if not directives:
 raise SystemExit("RC814_CSP_HOLD=EMPTY_POLICY")
idx={}
for i,(name,values) in enumerate(directives):
 if name in idx:
  # Existing PWA template has a redundant form-action 'self' directive.
  # No other duplicate is safely editable.
  if (name=="form-action" and set(values)=={"'self'"} and
      "'self'" in directives[idx[name]][1]):
   directives[i]=('',[])
   continue
  raise SystemExit("RC814_CSP_HOLD=DUPLICATE_DIRECTIVE_"+name)
 idx[name]=i
for name,token in (("default-src","'self'"),("script-src","'self'"),
                   ("connect-src","'self'"),("object-src","'none'"),
                   ("frame-ancestors","'none'")):
 if name not in idx or token not in directives[idx[name]][1]:
  raise SystemExit("RC814_CSP_HOLD=BASELINE_SECURITY_CHANGED_"+name)
def extend(name,adds):
 if name in idx:
  pos=idx[name]
  values=directives[pos][1]
  for value in adds:
   if value not in values:values.append(value)
 else:
  idx[name]=len(directives)
  directives.append((name,adds.copy()))
extend("script-src",["https://js.stripe.com"])
extend("connect-src",["https://api.stripe.com","https://*.stripe.com"])
extend("frame-src",["https://js.stripe.com","https://hooks.stripe.com","https://*.stripe.com"])
extend("form-action",["'self'","https://hooks.stripe.com"])
new_policy="; ".join(name+" "+" ".join(values) for name,values in directives if name)
new_text=re.sub(pattern,lambda match:match.group(0).replace(match.group(1),new_policy),source)
# This site defines add_header Cache-Control inside location /.
# Nginx then loses inherited server-level Content-Security-Policy.
# Reapply the same CSP within the SPA location without altering other locations.
locations=list(re.finditer(r'(?m)^([ \t]*)location\s+/\s*\{([^{}]*)\}',new_text))
if len(locations)!=1:
 raise SystemExit("RC814_CSP_HOLD=UNKNOWN_SPA_LOCATION")
loc=locations[0]
body=loc.group(2)
if "add_header Content-Security-Policy" not in body:
 indent=loc.group(1)+"    "
 insertion="\n"+indent+'add_header Content-Security-Policy "'+new_policy+'" always;'
 new_text=new_text[:loc.start(2)]+insertion+new_text[loc.start(2):]
elif new_policy not in body:
 raise SystemExit("RC814_CSP_HOLD=SPA_CSP_NOT_IDENTICAL")
if "https://js.stripe.com" not in new_text or "https://api.stripe.com" not in new_text:
 raise SystemExit("RC814_CSP_HOLD=MISSING_STRIPE_DIRECTIVES")
print("RC814_CSP_BASELINE_PRESERVED=PASS")
print("RC814_CSP_STRIPE_SCRIPTS_API_FRAMES=PASS")
print("RC814_CSP_SPA_LOCATION_HEADER=PASS")
print("RC814_CSP_CHANGE_REQUIRED="+("YES" if new_text!=source else "NO"))
if mode=="--apply":
 Path(out).write_text(new_text,encoding="utf-8")
else:
 print("RC814_CSP_PLAN=PASS_NO_WRITES")
PY

[[ "$MODE" == --plan ]] && exit 0

BACKUPDIR=/etc/talaeats-web-pwa/stripe-csp-backups
mkdir -p -m 700 "$BACKUPDIR"
[[ -d "$BACKUPDIR" && ! -L "$BACKUPDIR" ]] || {
 echo 'RC814_CSP_HOLD=BACKUP_DIRECTORY_UNSAFE';exit 1;
}
BACK="$BACKUPDIR/server-rc814-$(date -u +%Y%m%dT%H%M%SZ)-$$.conf"
cp -p -- "$CONF" "$BACK"
chmod 600 "$BACK"
[[ -s "$BACK" ]] && cmp -s "$BACK" "$CONF" || {
 echo 'RC814_CSP_HOLD=BACKUP_INVALID';exit 1;
}
CHANGED=no
restore_if_failed(){
 code="$?"
 trap - EXIT
 if [[ "$code" -ne 0 && "$CHANGED" == yes ]];then
  cp -p -- "$BACK" "$CONF"
  nginx -t -c "$MAIN" >/dev/null 2>&1 || true
  systemctl reload "$SERVICE" >/dev/null 2>&1 || true
  echo 'RC814_CSP_ROLLBACK=ATTEMPTED_OPERATOR_REVIEW_REQUIRED'
 fi
 cleanup_tmp
 exit "$code"
}
trap restore_if_failed EXIT
if ! cmp -s "$CONF" "$OUT";then
 cp -- "$OUT" "$CONF"
 CHANGED=yes
fi
nginx -t -c "$MAIN"
if [[ "$CHANGED" == yes ]];then
 systemctl reload "$SERVICE"
fi
for origin in http://127.0.0.1:18195 https://web-talaeats.alan-palacios-dev.com;do
 args=(--fail --silent --show-error --head --max-time 15)
 if [[ "$origin" == http:* ]];then args+=(-H 'Host: web-talaeats.alan-palacios-dev.com');fi
 curl "${args[@]}" "$origin/clientes" |
 python3 -c 'import sys,re
headers=sys.stdin.read()
policies=re.findall(r"(?im)^Content-Security-Policy:\s*(.+)\r?$",headers)
if len(policies)!=1:raise SystemExit("RC814_CSP_HOLD=HTTP_HEADER_NOT_PRESENT")
p=policies[0]
for directive,needed in [
 ("script-src",["https://js.stripe.com"]),
 ("connect-src",["https://api.stripe.com"]),
 ("frame-src",["https://js.stripe.com","https://hooks.stripe.com"])
]:
 matches=re.findall(r"(?:^|;)\s*"+directive+r"\s+([^;]+)",p)
 if len(matches)!=1 or any(v not in matches[0].split() for v in needed):
  raise SystemExit("RC814_CSP_HOLD=HTTP_STRIPE_DIRECTIVE_MISSING_"+directive)
print("RC814_CSP_EFFECTIVE_BROWSER_POLICY=PASS")'
done
CHANGED=no
trap - EXIT
cleanup_tmp
echo 'RC814_CSP_ISOLATED_18195=PASS'
echo 'RC814_CSP_LIVE_STRIPE_BACKEND_PM2_UNTOUCHED=YES'
