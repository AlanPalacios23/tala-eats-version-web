#!/usr/bin/env bash
# RC814 production PWA CSP: read-only diagnosis after failed header check.
# No Nginx reload, systemd changes, payments, DB writes or tokens.
set -Eeuo pipefail
set +x
HOST=web-talaeats.alan-palacios-dev.com
CONF=/etc/talaeats-web-pwa/server.conf
SERVICE=talaeats-web-pwa.service
echo 'RC814_CSP_DIAGNOSTIC_MODE=READ_ONLY'
printf 'PUBLIC_PWA_RUNNING_SHA=%s\n' "$(basename "$(readlink -f /srv/talaeats-pwa/current 2>/dev/null || echo missing)")"
systemctl is-active --quiet "$SERVICE" && echo 'ISOLATED_NGINX_SERVICE=ACTIVE' || echo 'ISOLATED_NGINX_SERVICE=NOT_ACTIVE'
if [[ -r "$CONF" ]];then
 python3 - "$CONF" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
print('CONFIGURED_18195='+str(s.count('listen 127.0.0.1:18195;')==1))
print('CONFIGURED_API_18190='+str(s.count('proxy_pass http://127.0.0.1:18190;')==1))
policies=re.findall(r'add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always\s*;',s)
print('CONFIGURED_CSP_COUNT='+str(len(policies)))
print('CONFIGURED_CSP_HAS_STRIPE='+str(bool(policies) and all(
 v in p for p in policies for v in ('https://js.stripe.com','https://api.stripe.com'))))
spa=re.search(r'(?m)^\s*location\s+/\s*\{([^{}]*)\}',s)
print('CONFIGURED_SPA_LOCATION_CSP='+str(bool(spa and 'add_header Content-Security-Policy' in spa.group(1))))
PY
else
 echo 'CONFIGURED_CSP_INSPECTION=NEEDS_PRIVILEGED_READ'
fi
python3 - <<'PY'
import re,subprocess
cases=[
 ('LOCAL_GET','GET','http://127.0.0.1:18195/clientes',True),
 ('LOCAL_HEAD','HEAD','http://127.0.0.1:18195/clientes',True),
 ('LOCAL_INDEX_GET','GET','http://127.0.0.1:18195/index.html',True),
 ('PUBLIC_GET','GET','https://web-talaeats.alan-palacios-dev.com/clientes',False),
 ('PUBLIC_HEAD','HEAD','https://web-talaeats.alan-palacios-dev.com/clientes',False),
]
for name,verb,url,local in cases:
 cmd=['curl','-sS','--max-time','12','--connect-timeout','5',
      '--output','/dev/null','--dump-header','-', '--request',verb]
 if local:
  cmd+=['--noproxy','*','--header','Host: web-talaeats.alan-palacios-dev.com']
 cmd.append(url)
 try: p=subprocess.run(cmd,capture_output=True,text=True,timeout=16)
 except subprocess.TimeoutExpired:
  print(name+'_ERROR=TIMEOUT');continue
 print(name+'_CURL_EXIT='+str(p.returncode))
 if p.returncode:
  print(name+'_ERROR='+re.sub(r'[^a-zA-Z0-9:_./ -]','?',p.stderr[:140]));continue
 blocks=[z for z in re.split(r'\r?\n\r?\n',p.stdout) if z.strip()]
 for block in blocks:
  lines=block.splitlines()
  if not lines or not lines[0].startswith('HTTP/'):continue
  print(name+'_HTTP='+lines[0].split(' ',2)[1] if len(lines[0].split(' ',2))>1 else 'UNKNOWN')
  header={}
  for line in lines[1:]:
   if ':' not in line:continue
   key,value=line.split(':',1)
   header.setdefault(key.strip().lower(),[]).append(value.strip())
  csp=header.get('content-security-policy',[])
  print(name+'_CSP_HEADERS='+str(len(csp)))
  if csp:
   print(name+'_CSP_STRIPE_SCRIPT='+str(all('https://js.stripe.com' in x for x in csp)))
   print(name+'_CSP_STRIPE_API='+str(all('https://api.stripe.com' in x for x in csp)))
   print(name+'_CSP_FRAME_STRIPE='+str(all('frame-src' in x and 'https://js.stripe.com' in x for x in csp)))
  print(name+'_SERVER='+','.join(header.get('server',[]))[:70])
  if header.get('location'):
   print(name+'_LOCATION='+','.join(header['location'])[:110])
PY
echo 'RC814_CSP_DIAGNOSTIC_COMPLETE=PASS_READ_ONLY'
