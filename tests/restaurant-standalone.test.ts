import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const config=read('../vite.restaurante.config.ts');
const root=read('../restaurantes.html');
const entry=read('../src/main-restaurantes.tsx');
const routes=read('../src/RestaurantStandalone.tsx');
const nginx=read('../deploy/nginx-restaurantes-isolated-server.conf');
const install=read('../deploy/kali-install-restaurantes-isolated.sh');
const update=read('../deploy/kali-update-restaurantes-isolated.sh');
const worker=read('../public/sw-restaurante.js');
describe('true stand-alone Tala Eats Restaurantes build',()=>{
 it('builds independent HTML entry, excluding customer application component imports',()=>{
  expect(config).toContain("outDir:'dist-restaurantes'");
  expect(config).toContain("'restaurantes.html'");
  expect(root).toContain('Tala Eats Restaurantes · Tu centro de operaciones');
  expect(root).toContain('/src/main-restaurantes.tsx');
  expect(root).not.toContain('Pide, disfruta y repite.');
  expect(entry).toContain("import RestaurantStandalone from './RestaurantStandalone'");
  expect(entry).not.toContain("import App from './App'");
  expect(entry).not.toContain('CustomerPwaInstallNotice');
  expect(routes).not.toContain('CustomerHome');
  expect(routes).not.toContain('CustomerCheckout');
  expect(routes).not.toContain('CustomerEntry');
  expect(routes).toContain('data-merchant-standalone="true"');
 });
 it('preserves signup, merchant KDS and both protected ADMIN workflows',()=>{
  for(const segment of ['/restaurante/acceso','/restaurante/alta','/restaurante','/admin/solicitudes-restaurantes','/admin/conectar-restaurante'])
   expect(routes).toContain(segment);
  expect(routes).toContain("user.role!=='admin'");
  expect(routes).toContain("user?.role==='restaurant'");
 });
 it('serves only merchant HTML + merchant worker on the separate origin',()=>{
  expect(nginx).toContain('index restaurantes.html;');
  expect(nginx).toContain('try_files $uri /restaurantes.html;');
  expect(nginx).toContain('location = /sw-restaurante.js');
  expect(nginx).toContain('location = /sw.js { return 404; }');
  expect(nginx).toContain('location / { return 404; }');
  expect(nginx).toContain('proxy_pass http://127.0.0.1:18190;');
 });
 it('install and rollback ONLY the isolated dist-restaurantes bytes',()=>{
  expect(install).toContain('DIST="$SOURCE/dist-restaurantes"');
  expect(install).toContain('for asset in restaurantes.html sw-restaurante.js manifest-restaurante.webmanifest');
  expect(update).toContain('dist-restaurantes');
  expect(update).toContain('RESTAURANTES_STATIC_BACKUP=');
  expect(install).not.toContain('systemctl restart nginx');
  expect(update).not.toContain('systemctl restart nginx');
 });
 it('does not persist sensitive merchant API data or customer push notifications',()=>{
  expect(worker).toContain("url.pathname.startsWith('/api/')");
  expect(worker).toContain("url.pathname.startsWith('/admin/')");
  expect(worker).toContain("req.mode==='navigate'");
  expect(worker).not.toContain("addEventListener('push'");
  expect(entry).toContain("register('/sw-restaurante.js'");
 });
});
