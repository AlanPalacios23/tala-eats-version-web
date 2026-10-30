import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const nginx=read('deploy/nginx-repartidores-isolated-server.conf');
const audit=read('deploy/rc141-kali-driver-security-audit.sh');
const workflow=read('src/components/DriverPwaWorkflow.tsx');
const sw=read('public/sw-repartidor.js');

describe('RC141: isolated courier web security and rollout gates',()=>{
 it('retains security headers in every nested location with add_header',()=>{
  const parts=nginx.split(/(?=^ location )/m);
  const nested=parts.filter(p=>p.includes('add_header Cache-Control'));
  expect(nested.length).toBe(7);
  for(const fragment of nested){
   for(const header of ['X-Content-Type-Options nosniff','X-Frame-Options DENY',
    'Referrer-Policy no-referrer','Permissions-Policy','Content-Security-Policy',
    'X-Robots-Tag'])expect(fragment).toContain(header);
  }
  expect(nginx).toContain("img-src 'self' data: blob:");
  expect(nginx).toContain("worker-src 'self'");
  expect(nginx).toContain("manifest-src 'self'");
  expect(nginx).toContain("frame-ancestors 'none'");
  expect(nginx).toContain("object-src 'none'");
  expect(nginx).toContain('location = /sw.js { return 404; }');
  expect(nginx).toContain('location / { return 404; }');
  expect(nginx).toContain('proxy_no_cache 1;');
 });
 it('audits actual active HTTPS security, API confidentiality and cache policy without writes',()=>{
  expect(spawnSync('bash',['-n','deploy/rc141-kali-driver-security-audit.sh']).status).toBe(0);
  for(const token of ['--audit','--public','/repartidor/acceso','/sw-repartidor.js',
   '/manifest-repartidor.webmanifest','/api/v1/driver/profile',
   '/api/v1/driver/mine',"if 'no-store' not in cache:",
   "RC141_SECURITY_READ_ONLY=PASS"])expect(audit).toContain(token);
  // Security commentary names forbidden operations; verify executable lines only.
  const statements=audit.split('\n').filter(line=>!/^\s*#/.test(line)).join('\n');
  expect(statements).not.toMatch(/\b(systemctl\s+(?:reload|restart|stop|start)|chmod|chown|pm2\s|psql\s|nginx\s+-s|curl\s+.*\-X\s+POST)\b/);
  expect(audit).not.toContain('source /home/tala-node-stage/.config/talaeats-node-live.env');
 });
 it('does not persist customer delivery PIN, clears it when hidden and prevents offline writes',()=>{
  expect(workflow).toContain("if(document.visibilityState==='hidden')");
  expect(workflow).toContain('setPin({});setCashReceived({});');
  expect(workflow).toContain('const operationsBlocked=browserOffline||busy');
  expect(workflow).toContain('if(browserOffline||!canSubmitDelivery(');
  expect(workflow).toContain('aria-describedby="df-availability-desc"');
  expect(workflow).toContain("api.driverComplete(order.id,pin[order.id]??'')");
  expect(workflow).not.toContain('localStorage.setItem');
 });
 it('does not cache private GPS, orders, invoices, or authenticated HTML in service worker',()=>{
  expect(sw).toContain("req.method!=='GET'");
  expect(sw).toContain("req.mode==='navigate'");
  expect(sw).toContain("u.pathname.startsWith('/api/')");
  expect(sw).toContain("u.pathname.startsWith('/repartidor')");
  expect(sw).toContain("u.origin!==self.location.origin");
  expect(sw).not.toContain('caches.open(CACHE).then(c=>c.addAll([\'/repartidor');
 });
});
