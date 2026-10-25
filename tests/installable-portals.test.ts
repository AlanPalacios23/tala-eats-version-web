import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
describe('portal plus three PWA install identities',()=>{
 it('each of four manifests has its own unique ID and correct entry URL',()=>{
   const specs:[string,string][]=[
    ['../public/manifest.webmanifest','/'],
    ['../public/manifest-clientes.webmanifest','/clientes'],
    ['../public/manifest-restaurante.webmanifest','/restaurante'],
    ['../public/manifest-repartidor.webmanifest','/repartidor'],
   ];
   const apps=specs.map(([file])=>JSON.parse(read(file)));
   expect(new Set(apps.map(a=>a.id)).size).toBe(4);
   specs.forEach(([,start],i)=>{
     expect(apps[i].start_url).toBe(start);
     expect(apps[i].display).toBe('standalone');
     expect(apps[i].scope).toBe('/');
     expect(apps[i].icons.length).toBeGreaterThanOrEqual(2);
   });
 });
 it('React changes install manifest when entering role portals, not server permissions',()=>{
   const main=read('../src/main.tsx');
   for(const p of ['/manifest-clientes.webmanifest','/manifest-restaurante.webmanifest',
                    '/manifest-repartidor.webmanifest']){
      expect(main).toContain(p);
   }
   expect(main).toContain('link.setAttribute');
   expect(main).toContain('register(\'/sw.js\'');
 });
 it('never uses service-worker caching of credentials or financial routes',()=>{
   const sw=read('../public/sw.js');
   expect(sw).toContain("url.pathname.startsWith('/api/')");
   expect(sw).toContain("if (req.method !== 'GET')");
 });
 it('installer cannot overwrite LIVE PM2 or an existing Nginx site',()=>{
  const script=read('../deploy/kali-install-pwa.sh');
  expect(script).toContain('PWA_NGINX_SITE_ALREADY_CONFIGURED_REVIEW');
  expect(script).toContain('PWA_INSTALL_PLAN=PASS_READ_ONLY');
  expect(script).toContain('I_APPROVE_NEW_PWA_NGINX_SITE_ONLY');
  expect(script).toContain('PWA_LIVE_PM2_POSTGRES_STRIPE=UNMODIFIED');
  expect(script).not.toContain('pm2 restart');
  expect(script).not.toContain('prisma migrate deploy');
 });
 it('dedicated Nginx uses a separate unit and has no global-service side effects',()=>{
  const install=read('../deploy/kali-install-pwa-isolated.sh');
  const unit=read('../deploy/talaeats-web-pwa.service');
  const config=read('../deploy/nginx-isolated-main.conf');
  expect(install).toContain('PWA_ISOLATED_INSTALL_PLAN=PASS_READ_ONLY');
  expect(install).toContain('I_APPROVE_ISOLATED_PWA_18195_ONLY');
  expect(install).toContain('talaeats-web-pwa.service');
  expect(install).toContain('PWA_GLOBAL_NGINX_PM2_POSTGRES_STRIPE=UNMODIFIED');
  expect(install).not.toContain('systemctl start nginx');
  expect(install).not.toContain('systemctl reload nginx');
  expect(install).not.toContain('pm2 restart');
  expect(unit).toContain('User=www-data');
  expect(unit).toContain('PrivateTmp=true');
  expect(unit).toContain('ProtectSystem=strict');
  expect(config).toContain('include /etc/talaeats-web-pwa/server.conf');
  expect(config).not.toContain('/etc/nginx/sites-enabled');
});
});
