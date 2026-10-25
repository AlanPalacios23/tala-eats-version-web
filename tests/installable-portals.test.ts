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
});
