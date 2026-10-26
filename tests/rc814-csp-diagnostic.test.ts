import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=new URL('../deploy/RC814_CSP_DIAGNOSTIC_KALI.sh',import.meta.url);
const sh=readFileSync(source,'utf8');
describe('RC814 Nginx CSP diagnostic is inspection-only',()=>{
 it('passes shell syntax and does not touch LIVE Stripe, PM2, nginx or production files',()=>{
  const result=spawnSync('bash',['-n',source.pathname],{encoding:'utf8'});
  expect(result.status).toBe(0);
  for(const expected of [
   'RC814_CSP_DIAGNOSTIC_MODE=READ_ONLY',
   'RC814_CSP_DIAGNOSTIC_COMPLETE=PASS_READ_ONLY',
   'LOCAL_GET','LOCAL_HEAD','PUBLIC_GET','PUBLIC_HEAD',
   'http://127.0.0.1:18195/clientes',
   'https://web-talaeats.alan-palacios-dev.com/clientes',
   'CONFIGURED_SPA_LOCATION_CSP',
  ])expect(sh).toContain(expected);
  for(const prohibited of ['systemctl reload','systemctl restart','nginx -s reload',
   'pm2 restart','stripe.paymentIntents.create','prisma migrate',
   'os.replace','shutil.copyfile','cloudflared restart','sudo tee','FLUSHDB'])
   expect(sh).not.toContain(prohibited);
 });
});
