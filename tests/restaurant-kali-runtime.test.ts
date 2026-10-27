import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const install=read('../deploy/kali-install-restaurantes-isolated.sh');
const main=read('../deploy/nginx-restaurantes-isolated-main.conf');
const service=read('../deploy/talaeats-restaurantes-pwa.service');
describe('Kali restaurant first-boot PID directory preflight',()=>{
 it('creates dedicated www-data runtime before syntax test, not during --plan',()=>{
  expect(main).toContain('pid /run/talaeats-restaurantes-pwa/nginx.pid;');
  expect(service).toContain('RuntimeDirectory=talaeats-restaurantes-pwa');
  expect(install).toContain("RUNTIME='/run/talaeats-restaurantes-pwa'");
  const planEnd=install.indexOf("echo 'RESTAURANTES_INSTALL_PLAN=PASS_READ_ONLY'");
  const create=install.indexOf('install -d -o www-data -g www-data -m 0755 "$RUNTIME"');
  const lint=install.indexOf('nginx -t -c "$CONFIG/nginx.conf"');
  expect(planEnd).toBeGreaterThan(0);
  expect(create).toBeGreaterThan(planEnd);
  expect(lint).toBeGreaterThan(create);
 });
 it('rejects runtime symlinks and cleans only the newly created directory after rollback',()=>{
  expect(install).toContain('RESTAURANTES_INSTALL_ABORT=RUNTIME_SYMLINK');
  expect(install).toContain('RUNTIME_CREATED=no');
  expect(install).toContain('if [[ "$RUNTIME_CREATED" == yes ]];then rmdir -- "$RUNTIME"');
  expect(install).toContain('I_APPROVE_NEW_RESTAURANTES_NGINX_18197_ONLY');
 });
});