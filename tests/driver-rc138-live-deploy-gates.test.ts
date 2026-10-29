import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {spawnSync} from 'node:child_process';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('RC138 Driver PWA deployment gates are static-only and fail closed',()=>{
 const plan=read('../deploy/rc138-kali-driver-live-preflight.sh');
 const build=read('../deploy/rc138-kali-build-driver-only.sh');
 const deploy=read('../deploy/rc138-kali-driver-deploy.sh');
 const update=read('../deploy/kali-update-repartidores-isolated.sh');
 it('requires exact running PM2 API+worker SHA and same-origin authorization',()=>{
  for(const token of [
   'tala-node-stage-api','tala-node-stage-worker','dist/server.js',
   'dist/live/production-worker.js','DRIVER_EXPECTED_BACK_WORK',
   "stageDriverRouter.post('/orders/:orderId/complete'",
   '/driver/presence-readiness','/driver/mine','/driver/dashboard',
   '/driver/available','/driver/profile','401','403',
  ])expect(plan).toContain(token);
  expect(plan).toContain("DRIVER_RC138_PM2_API_WORKER_EXACT_SHA=PASS");
  expect(plan).toContain("DRIVER_RC138_REAL_ACCOUNT_E2E=NOT_EXECUTED");
  expect(plan).toContain("DRIVER_RC138_API_DB_FINANCIAL_WRITES=ZERO");
 });
 it('PM2 inline shell JavaScript stays valid in bash and identifies the exact same SHA',()=>{
  const bash=spawnSync('bash',['-n','deploy/rc138-kali-driver-live-preflight.sh'],{encoding:'utf8'});
  expect(bash.status).toBe(0);
  const scripts=[...plan.matchAll(/pm2 jlist \| node -e '([\s\S]*?)'\n/g)].map(m=>m[1]);
  expect(scripts).toHaveLength(2);
  for(const js of scripts){
   // The script embeds JS inside a single-quoted bash string. A lone quote
   // breaks execution even when the JavaScript itself parses correctly.
   expect(js).not.toContain("'");
   expect(()=>new Script(js)).not.toThrow();
  }
  const sha='a'.repeat(40),w='/home/tala-node-stage/tala-node-releases/'+sha+'/node-backend';
  const fixtures=[
   {name:'tala-node-stage-api',pm2_env:{status:'online',pm_cwd:w,pm_exec_path:w+'/dist/server.js'}},
   {name:'tala-node-stage-worker',pm2_env:{status:'online',pm_cwd:w,pm_exec_path:w+'/dist/live/production-worker.js'}},
  ];
  const invoke=(js:string,rows:unknown,env:Record<string,string>={})=>
   spawnSync(process.execPath,['-e',js],{encoding:'utf8',
    input:JSON.stringify(rows),env:{...process.env,...env}});
  const detected=invoke(scripts[0],fixtures);
  expect(detected.status).toBe(0);
  expect(detected.stdout).toContain('DRIVER_RC138_CURRENT_LIVE_BACKEND_SHA='+sha);
  const checked=invoke(scripts[1],fixtures,{DRIVER_EXPECTED_BACK_WORK:w});
  expect(checked.status).toBe(0);
  expect(checked.stdout).toContain('DRIVER_RC138_PM2_API_WORKER_EXACT_SHA=PASS');
  const mismatch=invoke(scripts[1],[fixtures[0],{...fixtures[1],pm2_env:
   {...fixtures[1].pm2_env,pm_cwd:w.replace(sha,'b'.repeat(40))}}],
   {DRIVER_EXPECTED_BACK_WORK:w});
  expect(mismatch.status).not.toBe(0);
  expect(mismatch.stdout).toContain('DRIVER_RC138_PM2_API_WORKER_EXACT_SHA=HOLD');
 });
 it('inspects actual cash/Stripe release switches without ever enabling them',()=>{
  for(const key of [
   'LIVE_DRIVER_PRESENCE_ENABLED','LIVE_CASH_HANDOFF_V2_ENABLED',
   'LIVE_DELIVERY_CASH_CHECKOUT_ENABLED','LIVE_DELIVERY_CASH_DISPATCH_ENABLED',
   'LIVE_DELIVERY_CASH_RELEASE_APPROVED',
   'LIVE_DELIVERY_CARD_CHECKOUT_ENABLED','LIVE_DELIVERY_CARD_E2E_APPROVED',
   'STRIPE_CONNECT_TRANSFERS_ENABLED',
  ])expect(plan).toContain(key);
  expect(plan).toContain('HOLD_FLAGS');
  expect(plan).toContain('NOT_EXECUTED');
  expect(plan).not.toMatch(/\b(?:psql|stripe\s|git\s+push|npm\s+publish|pm2\s+(?:start|delete|restart|reload))\b/);
  expect(plan).not.toContain("-X POST");
 });
 it('builds only the driver standalone bundle with no beta financial switches',()=>{
  expect(build).toContain('npm test');
  expect(build).toContain('npm run build:repartidor');
  expect(build).not.toContain('npm run build:restaurante');
  expect(build).not.toContain('npm run build\n');
  expect(build).toContain('VITE_FINANCE_WALLET_V2_ENABLED=false');
  expect(build).toContain('VITE_CASH_HANDOFF_V2_ENABLED=false');
  expect(build).toContain('VITE_DRIVER_ACTIONS_ENABLED=false');
  expect(build).toContain('HOLD_CUSTOMER_SHELL_INCLUDED');
  expect(build).toContain('BACKEND_STRIPE_PG_PM2_NGINX=UNMODIFIED');
 });
 it('runs precheck, exact SHA static switch, postcheck and rollback only its own site',()=>{
  expect(deploy).toContain('I_APPROVE_DRIVER_RC138_STATIC_ONLY');
  expect(deploy).toContain('gate --plan "$WEB_SHA" "$BACK_SHA"');
  expect(deploy).toContain('gate --post "$WEB_SHA" "$BACK_SHA"');
  expect(deploy).toContain('kali-update-repartidores-isolated.sh');
  expect(deploy).toContain('--rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY');
  expect(deploy).toContain('CUSTOMERS_RESTAURANTES_PM2_STRIPE_PG=UNTOUCHED');
  expect(update).toContain("ROOT='/srv/talaeats-repartidores-pwa'");
  expect(update).toContain("ORIGIN='http://127.0.0.1:18199'");
  expect(update).toContain('REPARTIDORES_STATIC_DEPLOY=PASS');
 });
});
