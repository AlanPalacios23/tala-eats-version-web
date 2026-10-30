#!/usr/bin/env bash
# RC141 optional, STRICTLY isolated 18199-only Nginx security-header update.
# Never touches Clientes (18195), Restaurantes (18197), PM2, DB, Stripe or tunnels.
# --plan is read-only. --apply validates as the service user BEFORE HUP to
# the existing isolated Nginx master; failed checks restore old config.
set -Eeuo pipefail
set +x
umask 077
MODE="${1:-}" SHA="${2:-}" TOKEN="${3:-}"
APPROVE_APPLY=I_APPROVE_RC141_DRIVER_HEADERS_18199_ONLY
APPROVE_ROLLBACK=I_APPROVE_RC141_DRIVER_HEADERS_ROLLBACK
[[ "$MODE" =~ ^--(plan|apply|rollback)$ && "$SHA" =~ ^[0-9a-f]{40}$ ]] || {
 echo RC141_HEADERS=HOLD_USAGE;exit 2;
}
if [[ "$MODE" == --plan ]];then
 [[ "$#" -eq 2 ]] || { echo RC141_HEADERS=HOLD_ARGS;exit 2; }
else
 [[ "$#" -eq 3 && "$(id -u)" == 0 ]] || {
  echo RC141_HEADERS=HOLD_ROOT_APPROVAL_REQUIRED;exit 2;
 }
 if [[ "$MODE" == --apply ]];then
  [[ "$TOKEN" == "$APPROVE_APPLY" ]] || { echo RC141_HEADERS=HOLD_APPLY_APPROVAL;exit 2; }
 else
  [[ "$TOKEN" == "$APPROVE_ROLLBACK" ]] || { echo RC141_HEADERS=HOLD_ROLLBACK_APPROVAL;exit 2; }
 fi
fi
SERVICE=talaeats-repartidores-pwa.service
HOST=repartidores-talaeats.alan-palacios-dev.com
CONF=/etc/talaeats-repartidores-pwa/server.conf
MAIN=/etc/talaeats-repartidores-pwa/nginx.conf
SOURCE="/home/tala-node-stage/tala-eats-web-releases/$SHA"
CANDIDATE="$SOURCE/deploy/nginx-repartidores-isolated-server.conf"
AUDIT="$SOURCE/deploy/rc141-kali-driver-security-audit.sh"
BACKUP_DIR=/var/backups/talaeats-repartidores
BACKUP="$BACKUP_DIR/rc141-before-$SHA.conf"
for bin in git grep cmp runuser systemctl curl stat readlink install mktemp mv rm;do
 command -v "$bin" >/dev/null || { echo RC141_HEADERS=HOLD_TOOL;exit 2; }
done
[[ -f "$CONF" && ! -L "$CONF" && -f "$MAIN" && ! -L "$MAIN" &&
 -f "$CANDIDATE" && ! -L "$CANDIDATE" && -f "$AUDIT" && ! -L "$AUDIT" ]] || {
 echo RC141_HEADERS=HOLD_FILES;exit 2;
}
[[ "$(git -C "$SOURCE" rev-parse HEAD)" == "$SHA" &&
 -z "$(git -C "$SOURCE" status --porcelain --untracked-files=no)" ]] || {
 echo RC141_HEADERS=HOLD_SOURCE_SHA;exit 2;
}
[[ "$(systemctl show "$SERVICE" -p User --value)" == www-data &&
 "$(systemctl show "$SERVICE" -p Group --value)" == www-data ]] || {
 echo RC141_HEADERS=HOLD_SERVICE_USER;exit 2;
}
systemctl is-active --quiet "$SERVICE" || { echo RC141_HEADERS=HOLD_SERVICE_NOT_ACTIVE;exit 2; }
PID="$(systemctl show "$SERVICE" -p MainPID --value)"
[[ "$PID" =~ ^[1-9][0-9]*$ && -r "/proc/$PID/cmdline" ]] || {
 echo RC141_HEADERS=HOLD_MASTER_PID;exit 2;
}
tr '\\0' ' ' < "/proc/$PID/cmdline" | grep -Fq '/usr/sbin/nginx -c /etc/talaeats-repartidores-pwa/nginx.conf' || {
 echo RC141_HEADERS=HOLD_UNEXPECTED_NGINX_MASTER;exit 2;
}
for item in 'listen 127.0.0.1:18199;' \
 'server_name repartidores-talaeats.alan-palacios-dev.com;' \
 'root /srv/talaeats-repartidores-pwa/current;';do
 grep -Fq "$item" "$CONF" && grep -Fq "$item" "$CANDIDATE" || {
  echo RC141_HEADERS=HOLD_IDENTITY;exit 2;
 }
done
grep -Fq 'include /etc/talaeats-repartidores-pwa/server.conf;' "$MAIN" || {
 echo RC141_HEADERS=HOLD_MAIN_INCLUDE;exit 2;
}
grep -Fq "img-src 'self' data: blob:" "$CANDIDATE" || {
 echo RC141_HEADERS=HOLD_CANDIDATE_CSP;exit 2;
}
# Customer/Restaurant ports remain untouched. We check availability, not config.
code="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' \
 -H 'Host: web-talaeats.alan-palacios-dev.com' \
 http://127.0.0.1:18195/clientes)" || exit 2
[[ "$code" == 200 ]] || { echo RC141_HEADERS=HOLD_CUSTOMERS_DOWN;exit 2; }
code="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' \
 -H "Host: $HOST" http://127.0.0.1:18199/repartidor/acceso)" || exit 2
[[ "$code" == 200 ]] || { echo RC141_HEADERS=HOLD_DRIVER_DOWN;exit 2; }
echo "RC141_HEADERS_TARGET_SHA=$SHA"
echo RC141_HEADERS_SCOPE=ONLY_ISOLATED_18199_SERVER_CONF
echo RC141_HEADERS_BACKEND_STRIPE_CUSTOMERS_RESTAURANTS=UNTOUCHED
if [[ "$MODE" == --plan ]];then
 echo RC141_HEADERS_PLAN=PASS_READ_ONLY
 exit 0
fi
# Root-only backup lives outside the web-root, never within a *.conf include.
if [[ "$MODE" == --apply ]];then
 [[ ! -e "$BACKUP" ]] || { echo RC141_HEADERS=HOLD_BACKUP_COLLISION;exit 2; }
 install -d -o root -g root -m 0700 "$BACKUP_DIR"
 install -o root -g root -m 0600 "$CONF" "$BACKUP"
else
 [[ -f "$BACKUP" && ! -L "$BACKUP" ]] || { echo RC141_HEADERS=HOLD_BACKUP_MISSING;exit 2; }
 cmp -s "$CONF" "$CANDIDATE" || { echo RC141_HEADERS=HOLD_CONFIG_CHANGED_SINCE_APPLY;exit 2; }
fi
ORIGINAL="$BACKUP"
NEW="$CANDIDATE"
if [[ "$MODE" == --rollback ]];then
 NEW="$BACKUP"
fi
# Save no other configuration; restore backup with mode readable by www-data.
changed=no
reload_happened=no
restore(){
 local code=$?
 trap - EXIT
 if [[ "$code" -ne 0 && "$changed" == yes ]];then
  local tmp
  tmp="$(mktemp /etc/talaeats-repartidores-pwa/.server-restore.XXXXXX)" || exit 3
  if install -o root -g www-data -m 0640 "$ORIGINAL" "$tmp";then
   mv -f -- "$tmp" "$CONF"
   if [[ "$reload_happened" == yes ]];then
    systemctl kill --kill-who=main -s HUP "$SERVICE" || true
   fi
   echo RC141_HEADERS_RESTORED=PREVIOUS_CONFIG
  else
   echo RC141_HEADERS=HOLD_RESTORE_FAILED_CHECK_SERVICE
  fi
 fi
 exit "$code"
}
trap restore EXIT
temp="$(mktemp /etc/talaeats-repartidores-pwa/.server-candidate.XXXXXX)"
install -o root -g www-data -m 0640 "$NEW" "$temp"
runuser -u www-data -- test -r "$temp" || {
 echo RC141_HEADERS=HOLD_WWW_DATA_CANNOT_READ_TEMP;exit 2;
}
mv -f -- "$temp" "$CONF"
changed=yes
runuser -u www-data -- test -r "$CONF" || {
 echo RC141_HEADERS=HOLD_WWW_DATA_CANNOT_READ_ACTIVE;exit 2;
}
# Vital: testing as root alone missed a prior 0600 outage; validate as real user.
runuser -u www-data -- /usr/sbin/nginx -t -c "$MAIN" || {
 echo RC141_HEADERS=HOLD_NGINX_TEST_AS_WWW_DATA;exit 2;
}
systemctl kill --kill-who=main -s HUP "$SERVICE"
reload_happened=yes
# Confirm master remains alive; no systemd restart permitted.
systemctl is-active --quiet "$SERVICE" || { echo RC141_HEADERS=HOLD_SERVICE_AFTER_HUP;exit 2; }
[[ "$(systemctl show "$SERVICE" -p MainPID --value)" == "$PID" ]] || {
 echo RC141_HEADERS=HOLD_MASTER_CHANGED;exit 2;
}
if [[ "$MODE" == --apply ]];then
 bash "$AUDIT" --audit || { echo RC141_HEADERS=HOLD_SECURITY_AUDIT;exit 2; }
 bash "$AUDIT" --public || { echo RC141_HEADERS=HOLD_PUBLIC_SECURITY_AUDIT;exit 2; }
else
 code="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' \
   -H "Host: $HOST" http://127.0.0.1:18199/repartidor/acceso)" || exit 2
 [[ "$code" == 200 ]] || { echo RC141_HEADERS=HOLD_ROLLBACK_HTTP;exit 2; }
fi
changed=no;trap - EXIT
echo "RC141_HEADERS=PASS_$MODE"
echo 'RC141_HEADERS_NO_NGINX_RESTART=YES'
