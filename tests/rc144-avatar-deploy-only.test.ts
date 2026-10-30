import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('deploy/rc144-kali-avatar-three-pwa.sh');
describe('RC144 avatars-only PWA deployment controls',()=>{
 it('is shell-parseable and does not touch backend, Stripe or financial flags',()=>{
  const r=spawnSync('bash',['-n'],{input:script,encoding:'utf8'});
  expect(r.status,r.stderr).toBe(0);
  expect(script).toContain('set -Eeuo pipefail');
  expect(script).toContain('export GIT_OPTIONAL_LOCKS=0');
  expect(script).not.toMatch(/pm2 (?:delete|start|stop|restart)|psql|pg_dump|STRIPE_SECRET_KEY|--env-file/);
 });
 it('rejects unrelated frontend files and pins base to RC143',()=>{
  expect(script).toContain("OLD_WEB='9101ae8c349aa22f9f14ad95d65a75067ec84738'");
  expect(script).toContain('merge-base --is-ancestor');
  expect(script).toContain('HOLD_UNRELATED_WEB_FILE');
  expect(script).toContain('RC144_PWA_SCOPE=PASS_AVATAR_ONLY');
 });
 it('blocks UI release until actual backend and all three avatar paths work',()=>{
  expect(script).toContain('rc144-kali-avatar-live-preflight.sh');
  expect(script).toContain('RC144_PWA=HOLD_AVATAR_FEATURE_NOT_READY');
  expect(script).toContain('RC144_THREE_AVATAR_PROXIES=PASS');
  expect(script).toContain("web-talaeats.alan-palacios-dev.com");
  expect(script).toContain("restaurantes-talaeats.alan-palacios-dev.com");
  expect(script).toContain("repartidores-talaeats.alan-palacios-dev.com");
  expect(script).toContain('[[ "$code" == 404 ]]');
 });
 it('reuses existing three-site backup and rollback, requires explicit approval',()=>{
  expect(script).toContain('I_APPROVE_RC144_THREE_AVATAR_PWA_ONLY');
  expect(script).toContain('rc136-kali-promote-three-pwa.sh');
  expect(script).toContain('I_APPROVE_RC136_THREE_STATIC_PWA_ONLY');
  expect(script).toContain("if [[ \"$MODE\" == --plan ]]");
  expect(script).toContain('PASS_READ_ONLY');
 });
});
