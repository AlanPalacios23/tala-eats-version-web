import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CUSTOMER_PWA_HELP_EVENT,CUSTOMER_PWA_INSTALL_NOTICE_KEY,isCustomerInstallRoute,isInstalledPwa,pwaInstallPlatform,shouldShowCustomerPwaOffer} from '../src/components/CustomerPwaInstall';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const main=read('../src/main.tsx');
const app=read('../src/App.tsx');
const notice=read('../src/components/CustomerPwaInstall.tsx');
const css=read('../src/styles/main.css');
const sw=read('../public/sw.js');
const manifest=JSON.parse(read('../public/manifest-clientes.webmanifest'));

describe('first-visit Tala Eats customer PWA installation',()=>{
 it('offers exactly on customer welcome/auth/home/search and never on checkout, payments, merchant or driver',()=>{
  for(const path of ['/iniciar','/acceso','/clientes','/buscar'])expect(isCustomerInstallRoute(path)).toBe(true);
  for(const path of ['/','/checkout','/pago/50','/restaurante','/repartidor','/pedidos'])expect(isCustomerInstallRoute(path)).toBe(false);
  expect(shouldShowCustomerPwaOffer('/iniciar',false,false,false)).toBe(true);
  expect(shouldShowCustomerPwaOffer('/iniciar',true,false,false)).toBe(false);
  expect(shouldShowCustomerPwaOffer('/iniciar',false,true,false)).toBe(false);
  expect(shouldShowCustomerPwaOffer('/iniciar',false,false,true)).toBe(false);
 });
 it('detects standalone installations including iPhone and offers the right instructions',()=>{
  expect(isInstalledPwa(true,false)).toBe(true);
  expect(isInstalledPwa(false,true)).toBe(true);
  expect(isInstalledPwa(false,false)).toBe(false);
  expect(pwaInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
  expect(pwaInstallPlatform('Mozilla/5.0 (Linux; Android 16; Pixel)')).toBe('android');
  expect(pwaInstallPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other');
 });
 it('does not request notification permissions or auto-install without user gesture',()=>{
  expect(notice).toContain("window.addEventListener('beforeinstallprompt'");
  expect(notice).toContain("window.addEventListener('appinstalled'");
  expect(notice).toContain('await event.prompt()');
  expect(notice).toContain('onClick={()=>void install()}');
  expect(notice).toContain('setHelp(true)');
  expect(notice).toContain('role="status"');
  expect(notice).toContain('Añadir a pantalla de inicio');
  expect(notice).not.toContain('Notification.requestPermission');
  expect(notice).not.toContain('navigator.serviceWorker.getRegistration');
 });
 it('persists one-time presentation without using private account data',()=>{
  expect(CUSTOMER_PWA_INSTALL_NOTICE_KEY).toBe('tala-eats-customer-pwa-install-seen-v1');
  expect(notice).toContain('window.localStorage.getItem(CUSTOMER_PWA_INSTALL_NOTICE_KEY)');
  expect(notice).toContain("window.localStorage.setItem(CUSTOMER_PWA_INSTALL_NOTICE_KEY,'seen')");
  expect(notice).toContain('alreadyOffered.current=true');
  expect(notice).toContain('PREVIEW_READONLY');
  expect(CUSTOMER_PWA_HELP_EVENT).toBe('tala-eats-open-install-help');
  expect(app).toContain('CustomerPwaInstallMenuButton');
  expect(main).toContain('<CustomerPwaInstallNotice/>');
 });
 it('installs the customer app, not the generic portal, from /iniciar',()=>{
  expect(main).toContain("path === '/iniciar'");
  expect(main).toContain("'/manifest-clientes.webmanifest'");
  expect(manifest.id).toBe('/app-clientes');
  expect(manifest.start_url).toBe('/clientes');
  expect(manifest.name).toContain('Pedir comida');
  expect(manifest.description).toContain('domicilio');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(2);
 });
 it('production installer has valid shell syntax and pins/validates the public release',()=>{
  const text=read('../deploy/INSTALAR_PWA_CLIENTES_PRODUCCION_KALI.sh');
  expect(text).toContain('TALA_EXPECTED_WEB_SHA="$SHA"');
  expect(text).toContain('CUSTOMER_PWA_PUBLIC=PASS');
  expect(text).toContain('CUSTOMER_PWA_BACKEND_PAYMENTS_POSTGRES_CLOUDFLARED=UNMODIFIED');
  expect(text).toContain("cmp \"$ACTIVE/sw.js\" \"$TMP/public-sw.js\"");
  if(process.platform!=='win32'){
   const script=fileURLToPath(new URL('../deploy/INSTALAR_PWA_CLIENTES_PRODUCCION_KALI.sh',import.meta.url));
   const result=spawnSync('bash',['-n',script],{encoding:'utf8'});
   expect(result.status).toBe(0);
   expect(result.stderr).toBe('');
  }
 });
 it('is mobile and keyboard accessible, preserves the offline shell and does not cache API',()=>{
  expect(css).toContain('.customer-pwa-install-notice{');
  expect(css).toContain('.customer-pwa-install-notice button:focus-visible');
  expect(css).toContain('@media(max-width:380px)');
  expect(sw).toContain("url.pathname.startsWith('/api/')");
  expect(sw).toContain("req.mode==='navigate'");
  expect(sw).toContain("url.pathname.startsWith('/branding/')");
  expect(sw).toContain('event.waitUntil(caches.open(CACHE)');
  expect(sw).not.toContain('cache.put(req,await fetch');
 });
});
