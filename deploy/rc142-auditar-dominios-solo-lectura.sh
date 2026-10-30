#!/usr/bin/env bash
# TALA EATS: inventario DNS/HTTP/Cloudflared/nginx SIN modificaciones.
# No muestra variables de entorno, tokens ni archivos secretos completos.
set -Eeuo pipefail
set +x
umask 077

canonical=(
  web-talaeats.alan-palacios-dev.com
  repartidores-talaeats.alan-palacios-dev.com
  restaurantes-talaeats.alan-palacios-dev.com
  tienda-talaeats.alan-palacios-dev.com
)
legacy=(
  talaeats.alan-palacios-dev.com
  api-stage-talaeats.alan-palacios-dev.com
  preview-talaeats.alan-palacios-dev.com
)
echo 'TALAEATS_DOMAIN_AUDIT=READ_ONLY'
echo 'TALAEATS_EXPECTED_CANONICAL_PUBLIC_DOMAINS=4'
echo 'TALAEATS_STORE_DOMAIN=PROPOSED_NOT_PROVISIONED'
echo 'TALAEATS_API_OLD_HOST=DO_NOT_REMOVE_BEFORE_MOBILE_STRIPE_CALLBACK_MIGRATION'

if command -v curl >/dev/null 2>&1;then
  for h in "${canonical[@]}" "${legacy[@]}";do
    # Codes only: no response body, cookies, headers or credentials.
    code="$(curl -sS -o /dev/null -w '%{http_code}' \
      --connect-timeout 4 --max-time 9 "https://$h/" 2>/dev/null || true)"
    [[ "$code" =~ ^[0-9]{3}$ ]] || code=000
    printf 'TALAEATS_HTTP=%s:%s\n' "$h" "$code"
    # A 404 on / may be a healthy API-only hostname. Check the backend
    # endpoint independently before any decommission decision.
    api_code="$(curl -sS -o /dev/null -w '%{http_code}' \
      --connect-timeout 4 --max-time 9 "https://$h/api/v1/health" 2>/dev/null || true)"
    [[ "$api_code" =~ ^[0-9]{3}$ ]] || api_code=000
    printf 'TALAEATS_API_HEALTH_HTTP=%s:%s\n' "$h" "$api_code"
  done
else
  echo 'TALAEATS_HTTP=NOT_CHECKED_CURL_MISSING'
fi

python3 <<'PY'
from pathlib import Path
import re
# Never echo entire config: tunnel credentials may coexist in the YAML.
cloud_paths=(
    Path('/etc/cloudflared/config.yml'),
    Path('/etc/cloudflared/config.yaml'),
    Path('/home/alan/.cloudflared/config.yml'),
)
host_re=re.compile(r'^\s*-?\s*hostname\s*:\s*["\']?([A-Za-z0-9.-]+)')
server_re=re.compile(r'^\s*server_name\s+([^;]+);')
checked_paths=0
readable_paths=0
for path in cloud_paths:
    try:
        # is_file() itself can raise PermissionError if a parent dir is private.
        if not path.is_file():
            continue
        checked_paths+=1
        lines=path.read_text(errors='replace').splitlines()
        readable_paths+=1
    except (OSError, PermissionError):
        print('TALAEATS_TUNNEL_CONFIG=NOT_READABLE')
        continue
    names=sorted({m.group(1).lower() for ln in lines
                  if (m:=host_re.match(ln)) is not None
                  and 'talaeat' in m.group(1).lower()})
    for name in names:
        print('TALAEATS_CLOUDFLARED_HOST='+name)
if readable_paths==0:
    print('TALAEATS_CLOUDFLARED_HOST=UNKNOWN_LOCAL_CONFIG_PRIVATE_OR_REMOTE')
else:
    print('TALAEATS_CLOUDFLARED_READABLE_CONFIG_COUNT='+str(readable_paths))
for path in (
    Path('/etc/talaeats-web-pwa/server.conf'),
    Path('/etc/talaeats-restaurantes-pwa/server.conf'),
    Path('/etc/talaeats-repartidores-pwa/server.conf'),
    Path('/etc/talaeats-tienda-pwa/server.conf'),
):
    try:
        if not path.is_file():
            continue
        for ln in path.read_text(errors='replace').splitlines():
            match=server_re.match(ln)
            if match:
                for token in match.group(1).split():
                    if re.fullmatch(r'[A-Za-z0-9.-]+', token):
                        print('TALAEATS_NGINX_SERVER_NAME='+token.lower())
    except (OSError,PermissionError):
        print('TALAEATS_NGINX_CONFIG=NOT_READABLE')
PY

echo 'TALAEATS_AUDIT_NO_DNS_PG_PM2_STRIPE_CHANGES=YES'
echo 'TALAEATS_NEXT_GATE=CHECK_MOBILE_APP_DEFAULTS_AND_STRIPE_WEBHOOK_AND_CONNECT_REDIRECT_BEFORE_DELETING_OLD_API_HOST'
