import {describe,it,expect} from 'vitest';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const shell=readFileSync(new URL('../deploy/RC814_RECUPERAR_CSP_STRIPE_KALI.sh',import.meta.url),'utf8');
const fixture=readFileSync(new URL('../deploy/nginx-web-talaeats.conf',import.meta.url),'utf8');
const startMark='python3 - "$CONF" "$MODE" "$OUT" <<\'PY\'\n';
const begin=shell.indexOf(startMark)+startMark.length;
const end=shell.indexOf('\nPY\n',begin);
if(!shell.includes(startMark)||end<begin)throw new Error('RC814_CSP_PYTHON_BLOCK_MISSING');
const python=shell.slice(begin,end);
function transform(conf:string){
 const dir=mkdtempSync(join(tmpdir(),'rc814-csp-'));
 try{
  const orig=join(dir,'server.conf'),out=join(dir,'new.conf');
  writeFileSync(orig,conf);
  const p=spawnSync('python3',['-c',python,orig,'--apply',out],{encoding:'utf8',timeout:10000});
  return {code:p.status??1,text:p.stdout+p.stderr,rendered:p.status===0?readFileSync(out,'utf8'):''};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
describe('RC814 production Stripe CSP recovery is additive and scoped',()=>{
 it('requires exact site, localhost port and live backend; no Stripe PM2 or cloudflared writes',()=>{
  const syntax=spawnSync('bash',['-n',new URL('../deploy/RC814_RECUPERAR_CSP_STRIPE_KALI.sh',import.meta.url).pathname],{encoding:'utf8'});
  expect(syntax.status).toBe(0);
  for(const s of ['listen 127.0.0.1:18195;','server_name web-talaeats.alan-palacios-dev.com;',
   'root /srv/talaeats-pwa/current;','proxy_pass http://127.0.0.1:18190;'])
   expect(python).toContain(s);
  for(const phrase of ['FLUSHALL','FLUSHDB','stripe.paymentIntents.create','pm2 restart','cloudflared restart'])
   expect(shell).not.toContain(phrase);
 });
 it('repairs installed template with redundant form-action and missing inherited SPA header',()=>{
  const r=transform(fixture);
  expect(r.code).toBe(0);
  expect(r.rendered).toContain('location / {\n');
  expect(r.rendered.match(/add_header Content-Security-Policy/g)?.length).toBe(2);
  const policies=[...r.rendered.matchAll(/Content-Security-Policy "([^"]+)"/g)].map(m=>m[1]);
  expect(policies[0]).toBe(policies[1]);
  expect(policies[0].match(/form-action /g)?.length).toBe(1);
  expect(policies[0]).toContain("script-src 'self' https://js.stripe.com");
  expect(policies[0]).toContain("frame-ancestors 'none'");
  expect(policies[0]).toContain("object-src 'none'");
  expect(r.rendered).toContain('proxy_pass http://127.0.0.1:18190;');
  expect(transform(r.rendered).rendered).toBe(r.rendered);
 });
 it('adds only payment host values to existing restrictive policies',()=>{
  const stripped=fixture.replaceAll(' https://js.stripe.com','').replaceAll(' https://api.stripe.com','')
   .replaceAll(' https://*.stripe.com','').replaceAll(' https://hooks.stripe.com','');
  const result=transform(stripped);
  expect(result.code).toBe(0);
  expect(result.rendered).toContain('script-src \'self\' https://js.stripe.com');
  expect(result.rendered).toContain("connect-src 'self' https://api.stripe.com");
  expect(result.rendered).toContain('frame-src https://js.stripe.com');
  expect(result.rendered).toContain("form-action 'self' https://hooks.stripe.com");
 });
 it('refuses changed backend, port or other CSP baseline security',()=>{
  for(const altered of [
   fixture.replace('127.0.0.1:18190','127.0.0.1:18192'),
   fixture.replace('listen 127.0.0.1:18195;','listen 127.0.0.1:18196;'),
   fixture.replace("object-src 'none'","object-src 'self'"),
   fixture.replace("frame-ancestors 'none'","frame-ancestors 'self'"),
  ]){
   const result=transform(altered);
   expect(result.code).not.toBe(0);
   expect(result.text).toContain('RC814_CSP_HOLD=');
  }
 });
});
