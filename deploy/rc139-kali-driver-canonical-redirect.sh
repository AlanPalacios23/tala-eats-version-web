#!/usr/bin/env bash
# RC139: redirect legacy driver paths on MAIN customer origin 18195.
# Changes ONLY the main isolated Nginx config; no frontend, Node, DB, Stripe,
# driver PWA 18199 or restaurant PWA 18197 changes.
set -Eeuo pipefail
set +x
umask 077
[[ "$#" -ge 1 ]] || { echo RC139_REDIRECT=HOLD_USAGE;exit 2; }
MODE="$1"
if [[ "$MODE" == --plan || "$MODE" == --diagnose ]];then
 [[ "$#" -eq 1 ]] || exit 2
elif [[ "$MODE" == --apply ]];then
 [[ "$#" -eq 2 && "$2" == I_APPROVE_RC139_MAIN_DRIVER_REDIRECT_ONLY ]] || exit 2
else echo RC139_REDIRECT=HOLD_USAGE;exit 2;fi
[[ "$(id -u)" == 0 ]] || { echo RC139_REDIRECT=HOLD_ROOT_REQUIRED;exit 2; }
CONFIG=/etc/talaeats-web-pwa/server.conf
MAIN_CONF=/etc/talaeats-web-pwa/nginx.conf
MAIN=http://127.0.0.1:18195
DRIVER=http://127.0.0.1:18199
MHOST=web-talaeats.alan-palacios-dev.com
DHOST=repartidores-talaeats.alan-palacios-dev.com
SERVICE=talaeats-web-pwa.service
# The active service must be the expected isolated Nginx, not an unrelated
# system Nginx instance. A service named correctly is not sufficient.
verify_isolated_nginx(){
 local exec_start pid process_command
 exec_start="$(systemctl show --property=ExecStart --value "$SERVICE")" || return 1
 [[ "$exec_start" == *"/usr/sbin/nginx"* &&
    "$exec_start" == *"$MAIN_CONF"* ]] || return 1
 pid="$(systemctl show --property=MainPID --value "$SERVICE")" || return 1
 [[ "$pid" =~ ^[1-9][0-9]*$ && -r "/proc/$pid/cmdline" ]] || return 1
 process_command="$(tr '\0' ' ' < "/proc/$pid/cmdline")" || return 1
 [[ "$process_command" == *"nginx"* &&
    "$process_command" == *"$MAIN_CONF"* ]]
}
[[ -f "$CONFIG" && ! -L "$CONFIG" && -f "$MAIN_CONF" && ! -L "$MAIN_CONF" ]] || {
 echo RC139_REDIRECT=HOLD_UNKNOWN_CONFIG;exit 2;
}
for fragment in 'listen 127.0.0.1:18195;' \
 'server_name web-talaeats.alan-palacios-dev.com;' \
 'root /srv/talaeats-pwa/current;';do
 grep -Fq "$fragment" "$CONFIG" || { echo RC139_REDIRECT=HOLD_MAIN_IDENTITY;exit 2; }
done
grep -Fq '/etc/talaeats-web-pwa/server.conf;' "$MAIN_CONF" || exit 2
systemctl is-active --quiet "$SERVICE" || exit 2
systemctl is-active --quiet talaeats-repartidores-pwa.service || exit 2
verify_isolated_nginx || { echo RC139_REDIRECT=HOLD_ACTIVE_NGINX_IDENTITY;exit 2; }
echo RC139_ISOLATED_NGINX_IDENTITY=PASS
curl -fsS --max-time 8 -H "Host: $MHOST" "$MAIN/clientes" |
 grep -Fq '<div id="root">' || { echo RC139_REDIRECT=HOLD_MAIN_CUSTOMERS;exit 2; }
curl -fsS --max-time 8 -H "Host: $DHOST" "$DRIVER/repartidor/acceso" |
 grep -Fq '<div id="root">' || { echo RC139_REDIRECT=HOLD_DRIVER_TARGET;exit 2; }
curl -fsS --max-time 8 -H "Host: $MHOST" "$MAIN/api/v1/health" |
 python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["status"]=="ok" and d["production"] is True' || exit 2
# Report only HTTP codes and redirect URLs for public role paths; no cookies,
# tokens, addresses, PM2 metadata or confidential environment variables.
probe_routes(){
 local item path out
 for item in '/repartidor|/repartidor' '/repartidor/acceso|/repartidor/acceso' \
  '/repartidor/registro|/repartidor/registro' '/repartidor/extra|/repartidor';do
  IFS='|' read -r path _ <<< "$item"
  out="$(curl -sS --connect-timeout 3 --max-time 8 -o /dev/null \
   -w '%{http_code}|%{redirect_url}' -H "Host: $MHOST" "$MAIN$path")"
  printf '%s|%s\n' "$path" "$out"
 done
}
check_routes(){
 local item path expected out code url
 for item in '/repartidor|/repartidor' '/repartidor/acceso|/repartidor/acceso' \
  '/repartidor/registro|/repartidor/registro' '/repartidor/extra|/repartidor';do
  IFS='|' read -r path expected <<< "$item"
  out="$(curl -sS --connect-timeout 3 --max-time 8 -o /dev/null \
   -w '%{http_code}|%{redirect_url}' -H "Host: $MHOST" "$MAIN$path")" || return 1
  IFS='|' read -r code url <<< "$out"
  [[ "$code" == 302 && "$url" == "https://$DHOST$expected" ]] || return 1
 done
}
check_routes_retry(){
 local attempt
 for attempt in 1 2 3 4 5 6 7 8 9 10;do
  if check_routes;then return 0;fi
  sleep 1
 done
 return 1
}
show_diagnostics(){
 local marker=no
 grep -Fq RC139_CANONICAL_DRIVER_BEGIN "$CONFIG" && marker=yes
 echo "RC139_DIAG_CONFIG_MARKER=$marker"
 while IFS='|' read -r path code location;do
  [[ -n "$path" ]] || continue
  echo "RC139_DIAG_PATH=$path HTTP=$code DEST=${location:-NONE}"
 done < <(probe_routes)
}
if [[ "$MODE" == --diagnose ]];then
 show_diagnostics
 echo RC139_DIAG=READ_ONLY
 exit 0
fi

if grep -Fq RC139_CANONICAL_DRIVER_BEGIN "$CONFIG";then
 check_routes_retry || { show_diagnostics; echo RC139_REDIRECT=HOLD_MARKED_BUT_NOT_LIVE;exit 2; }
 echo RC139_REDIRECT=PASS_ALREADY_APPLIED
 exit 0
fi
grep -Eq 'location[[:space:]]+(=|\^~)?[[:space:]]*/repartidor(/|[[:space:]{])' "$CONFIG" && {
 echo RC139_REDIRECT=HOLD_CONFLICTING_RULE;exit 2;
}
echo RC139_MAIN_AND_DRIVER=PASS
echo RC139_SCOPE=NGINX_18195_DRIVER_PATHS_ONLY
if [[ "$MODE" == --plan ]];then
 show_diagnostics
 echo RC139_REDIRECT_PLAN=PASS_READ_ONLY
 exit 0
fi
BASELINE_ROUTES="$(probe_routes)"
[[ -n "$BASELINE_ROUTES" ]] || { echo RC139_REDIRECT=HOLD_NO_BASELINE_HTTP;exit 2; }
BACKUP="$CONFIG.before-rc139-$(date -u +%Y%m%dT%H%M%SZ)"
[[ ! -e "$BACKUP" ]] || exit 2
cp -a -- "$CONFIG" "$BACKUP"
cmp -s "$CONFIG" "$BACKUP" || exit 2
TEMP="$(mktemp "$CONFIG.rc139.XXXXXX")"
RESTORE=yes
recover(){
 local status=$?
 trap - EXIT
 rm -f -- "$TEMP"
 if [[ "$status" -ne 0 && "$RESTORE" == yes ]];then
  cp -a -- "$BACKUP" "$CONFIG"
  if cmp -s "$BACKUP" "$CONFIG" &&
   /usr/sbin/nginx -t -c "$MAIN_CONF" >/dev/null 2>&1;then
   # A prior reload did not adopt the new rules. Restarting ONLY this
   # dedicated frontend unit makes rollback deterministic as well.
   if ! systemctl restart "$SERVICE";then
    echo RC139_REDIRECT=FAILED_ROLLBACK_RESTART_UNVERIFIED
   else
    local attempt restored=no
    for attempt in 1 2 3 4 5 6 7 8 9 10;do
     if [[ "$(probe_routes)" == "$BASELINE_ROUTES" ]];then
      restored=yes
      break
     fi
     sleep 1
    done
    if [[ "$restored" == yes ]];then
     echo RC139_REDIRECT=FAILED_BUT_ROLLBACK_HTTP_VERIFIED
    else
     show_diagnostics
     echo RC139_REDIRECT=FAILED_ROLLBACK_HTTP_NOT_VERIFIED
    fi
   fi
  else
   echo RC139_REDIRECT=FAILED_ROLLBACK_CONFIG_NOT_VERIFIED
  fi
 fi
 exit "$status"
}
trap recover EXIT
python3 - "$CONFIG" "$TEMP" <<'PY'
import pathlib,re,sys
current=pathlib.Path(sys.argv[1]).read_text()
server=list(re.finditer(r'(?m)^server[ \t]*\{[ \t]*$',current))
if len(server)!=1:raise SystemExit('RC139_REDIRECT=HOLD_SERVER_BLOCK')
block="""
    # RC139_CANONICAL_DRIVER_BEGIN
    # Fixed URLs only. Do not forward query strings or arbitrary paths.
    location = /repartidor { return 302 https://repartidores-talaeats.alan-palacios-dev.com/repartidor; }
    location = /repartidor/acceso { return 302 https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso; }
    location = /repartidor/registro { return 302 https://repartidores-talaeats.alan-palacios-dev.com/repartidor/registro; }
    location ^~ /repartidor/ { return 302 https://repartidores-talaeats.alan-palacios-dev.com/repartidor; }
    # RC139_CANONICAL_DRIVER_END
"""
pos=server[0].end()
pathlib.Path(sys.argv[2]).write_text(current[:pos]+'\n'+block+current[pos:])
PY
chmod --reference="$CONFIG" "$TEMP"
chown --reference="$CONFIG" "$TEMP"
mv -f -- "$TEMP" "$CONFIG"
/usr/sbin/nginx -t -c "$MAIN_CONF"
echo RC139_NGINX_ACTIVATION=RELOAD_ATTEMPTED
if systemctl reload "$SERVICE" && check_routes_retry;then
 echo RC139_NGINX_ACTIVATION=PASS_RELOAD
else
 # Some installed service units signal a different/old master and acknowledge
 # the reload without loading the changed config. Restart just the main PWA
 # service; Stripe, PM2, Repartidores and Restaurantes are never restarted.
 echo RC139_NGINX_ACTIVATION=RELOAD_STALE_RESTARTING_MAIN_18195_ONLY
 verify_isolated_nginx || { echo RC139_REDIRECT=HOLD_ACTIVE_NGINX_IDENTITY;exit 1; }
 systemctl restart "$SERVICE" || {
  echo RC139_REDIRECT=HOLD_ISOLATED_RESTART;exit 1;
 }
 check_routes_retry || { show_diagnostics; echo RC139_REDIRECT=HOLD_POST_RESTART;exit 1; }
 echo RC139_NGINX_ACTIVATION=PASS_ISOLATED_RESTART
fi
curl -fsS --max-time 8 -H "Host: $MHOST" "$MAIN/clientes" |
 grep -Fq '<div id="root">' || exit 1
# Validate the Cloudflare hostname, not merely localhost; do not follow the
# redirect into a logged-in application (this remains an unauthenticated GET).
check_public(){
 local out code url
 out="$(curl -sS --connect-timeout 5 --max-time 12 -o /dev/null \
  -w '%{http_code}|%{redirect_url}' "https://$MHOST/repartidor/acceso")" || return 1
 IFS='|' read -r code url <<< "$out"
 [[ "$code" == 302 && "$url" == "https://$DHOST/repartidor/acceso" ]]
}
check_public_retry(){
 local attempt
 for attempt in 1 2 3 4 5;do
  if check_public;then return 0;fi
  sleep 1
 done
 return 1
}
curl -fsS --max-time 8 -H "Host: $MHOST" "$MAIN/api/v1/health" |
 python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["status"]=="ok"' || exit 1
check_public_retry || {
 local_public="$(curl -sS --connect-timeout 5 --max-time 12 -o /dev/null -w '%{http_code}|%{redirect_url}' "https://$MHOST/repartidor/acceso" || true)"
 echo "RC139_DIAG_PUBLIC_ACCESS=$local_public"
 echo RC139_REDIRECT=HOLD_PUBLIC_HTTPS_POSTCHECK
 exit 1
}
RESTORE=no
trap - EXIT
echo RC139_REDIRECT=PASS_MAIN_18195_TO_DRIVER_18199
echo "RC139_REDIRECT_BACKUP=$BACKUP"
echo RC139_BACKEND_STRIPE_DB_RESTAURANTS_DRIVER_SITE=UNMODIFIED
