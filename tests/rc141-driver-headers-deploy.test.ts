import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('deploy/rc141-kali-driver-headers-18199.sh');
const audit=read('deploy/rc141-kali-driver-security-audit.sh');
describe('RC141 isolated Nginx 18199 security header release',()=>{
 it('passes shell syntax and requires explicit review/apply/rollback',()=>{
  expect(spawnSync('bash',['-n','deploy/rc141-kali-driver-headers-18199.sh']).status).toBe(0);
  expect(script).toContain('RC141_HEADERS_PLAN=PASS_READ_ONLY');
  expect(script).toContain('I_APPROVE_RC141_DRIVER_HEADERS_18199_ONLY');
  expect(script).toContain('I_APPROVE_RC141_DRIVER_HEADERS_ROLLBACK');
  expect(script).toContain('RC141_HEADERS_SCOPE=ONLY_ISOLATED_18199_SERVER_CONF');
  expect(script).toContain('BACKUP_DIR=/var/backups/talaeats-repartidores');
  expect(script).toContain('install -o root -g root -m 0600 "$CONF" "$BACKUP"');
 });
 it('refuses a different service, root URL or unexpected Nginx master',()=>{
  expect(script).toContain('SERVICE=talaeats-repartidores-pwa.service');
  expect(script).toContain('HOST=repartidores-talaeats.alan-palacios-dev.com');
  expect(script).toContain("server_name repartidores-talaeats.alan-palacios-dev.com;");
  expect(script).toContain("root /srv/talaeats-repartidores-pwa/current;");
  expect(script).toContain("listen 127.0.0.1:18199;");
  expect(script).toContain('HOLD_UNEXPECTED_NGINX_MASTER');
  expect(script).toContain('www-data');
  expect(script).toContain('RC141_HEADERS=HOLD_CUSTOMERS_DOWN');
  expect(script).not.toContain('systemctl restart ');
  expect(script).not.toContain('systemctl reload ');
  expect(script).not.toContain('talaeats-web-pwa.service');
  expect(script).not.toContain('talaeats-restaurantes-pwa.service');
 });
 it('tests active include as www-data before HUP and auto-restores on failed checks',()=>{
  expect(script).toContain('install -o root -g www-data -m 0640 "$NEW" "$temp"');
  expect(script).toContain('runuser -u www-data -- test -r "$CONF"');
  expect(script).toContain('runuser -u www-data -- /usr/sbin/nginx -t -c "$MAIN"');
  expect(script).toContain('systemctl kill --kill-who=main -s HUP "$SERVICE"');
  expect(script).toContain('RC141_HEADERS_RESTORED=PREVIOUS_CONFIG');
  expect(script).toContain('ORIGINAL="$CANDIDATE"');
  expect(script).toContain('security_ok=no');
  expect(script).toContain('bash "$AUDIT" --audit && bash "$AUDIT" --public');
  expect(audit).toContain('RC141_SECURITY_READ_ONLY=PASS');
 });
});
