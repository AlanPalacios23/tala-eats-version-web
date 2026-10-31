import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('deploy/rc156-kali-readonly-postcheck.sh');
const checklist=read('docs/RC156-REPARTIDORES-POSTDEPLOY-CHECKLIST.md');
const isolated=read('deploy/kali-update-repartidores-isolated.sh');
const workflow=read('src/components/DriverPwaWorkflow.tsx');

describe('RC156 · Deploy and post-deploy read-only safety gates',()=>{
 it('has valid Bash syntax without executing on Kali or invoking network',()=>{
  const path=new URL('../deploy/rc156-kali-readonly-postcheck.sh',import.meta.url);
  const check=spawnSync('bash',['-n',path.pathname],{encoding:'utf8'});
  expect(check.status).toBe(0);
 });
 it('requires the exact known running SHA and cannot mutate services or static files',()=>{
  expect(script).toContain('^--sha=[a-f0-9]{40}$');
  expect(script).toContain("ROOT='/srv/talaeats-repartidores-pwa'");
  expect(script).toContain('ACTIVE="$(readlink -f -- "$CURRENT")"');
  expect(script).toContain('"$ACTIVE" == "$ROOT/releases/$SHA"');
  expect(script).toContain('COURIER_ACTIVE_SHA=PASS');
  expect(script).toContain('COURIER_SERVED_ASSETS=PASS');
  expect(script).toContain('GIT_OPTIONAL_LOCKS=0');
  expect(script).not.toMatch(/\b(?:rm|mv|ln|chmod|chown|systemctl\s+restart|sudo|git checkout|git reset)\s+[-\w]/);
  expect(script).not.toContain('--data');
  expect(script).not.toContain('-X POST');
 });
 it('checks actual HTML, service worker and manifest plus role authentication and backend readiness',()=>{
  expect(script).toContain('repartidor|repartidores.html');
  expect(script).toContain('sw-repartidor.js|sw-repartidor.js');
  expect(script).toContain('manifest-repartidor.webmanifest|manifest-repartidor.webmanifest');
  expect(script).toContain('cmp -s - "$ACTIVE/$file"');
  expect(script).toContain('platform/support/capabilities');
  expect(script).toContain('[[ "$status" == 401 ]]');
  expect(script).toContain('workerOnline');
  expect(script).toContain('environment');
  expect(script).toContain('RC156_POSTDEPLOY_READ_ONLY=PASS');
 });
 it('reuses existing isolated release plan and rollback and keeps support flags OFF initially',()=>{
  expect(isolated).toContain('REPARTIDORES_STATIC_PLAN=PASS_READ_ONLY');
  expect(isolated).toContain('I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY');
  expect(isolated).toContain('REPARTIDORES_STATIC_SCOPE=18199_ONLY');
  expect(checklist).toContain('VITE_DRIVER_SUPPORT_ENABLED');
  expect(checklist).toContain('DRIVER_ORDER_SUPPORT_ENABLED');
  expect(checklist).toContain('node scripts/rc156-postdeploy-readonly.mjs --mode=live --with-pwas');
  expect(workflow).toContain("const driverSupportEnabled=import.meta.env.VITE_DRIVER_SUPPORT_ENABLED==='true'");
 });
});
