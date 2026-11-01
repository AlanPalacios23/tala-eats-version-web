import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const sw=read('../public/sw.js');
const banner=read('../src/merchant/MerchantUpdateBanner.tsx');
const workspace=read('../src/merchant/MerchantWorkspace.tsx');
const style=read('../src/merchant/merchant.css');
const releaseScript=read('../scripts/write-release-meta.mjs');
const postdeploy=read('../deploy/rc166-postdeploy-smoke.sh');
const ci=read('../.github/workflows/ci.yml');
const pkg=JSON.parse(read('../package.json'));

describe('RC166 · mantenimiento postdespliegue sin detener operaciones',()=>{
 it('espera consentimiento antes de activar una nueva versión PWA',()=>{
   expect(sw).toContain("const CACHE=PREFIX+'v5'");
   expect(sw).toContain("if(event.data?.type==='MERCHANT_APPROVE_UPDATE')self.skipWaiting()");
   expect(sw).not.toContain("event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));\n  self.skipWaiting()");
   expect(sw).toContain("url.pathname.startsWith('/api/')");
   expect(sw).toContain("url.pathname.includes('/withdrawals/')");
   expect(sw).toContain("req.mode==='navigate'");
 });
 it('no fuerza un reload en medio de un pedido ni pierde ediciones del menú',()=>{
   expect(banner).toContain("navigator.serviceWorker.getRegistration('/')");
   expect(banner).toContain("registration.addEventListener('updatefound',updateFound)");
   expect(banner).toContain("navigator.serviceWorker.addEventListener('controllerchange',changed)");
   expect(banner).toContain("if(applying.current)window.location.reload()");
   expect(banner).toContain("if(locked)");
   expect(banner).toContain("document.querySelector('.merchant-product .merchant-discard-button')");
   expect(banner).toContain("document.querySelector('.merchant-add-form')");
   expect(banner).toContain("worker.postMessage({type:'MERCHANT_APPROVE_UPDATE'})");
   expect(banner).toContain("setDismissed(true)");
   expect(workspace).toContain('<MerchantUpdateBanner locked={busyOrder!==null||menuMutating||savingStore||submitting||refreshing}/>');
   expect(style).toContain('.merchant-update-banner');
 });
 it('crea un metadato trazable sin incrustar secretos ni alterar el backend',()=>{
   expect(pkg.scripts.build).toContain('node scripts/write-release-meta.mjs');
   expect(releaseScript).toContain("spawnSync('git',['rev-parse','HEAD']");
   expect(releaseScript).toContain("source_sha:sha");
   expect(releaseScript).toContain("built_at:new Date().toISOString()");
   expect(releaseScript).toContain("public','release.json");
   expect(releaseScript).not.toContain('process.env.STRIPE');
   expect(ci).toContain('test -s dist/release.json');
   expect(ci).toContain("p.source_sha!==process.env.GITHUB_SHA");
 });
 it('deja una prueba posdespliegue estrictamente de lectura y con SHA exacto',()=>{
   expect(postdeploy).toContain('RC166_SMOKE=PASS_READ_ONLY');
   expect(postdeploy).toContain("if [[ ! \"$BASE\" =~ ^https://");
   expect(postdeploy).toContain('HOLD_RELEASE_SHA_MISMATCH'.replace('HOLD_','').replace('HOLD_',''));
   expect(postdeploy).toContain('MERCHANT_APPROVE_UPDATE');
   expect(postdeploy).toContain('download manifest /manifest-restaurante.webmanifest');
   expect(postdeploy).toContain('download release /release.json');
   expect(postdeploy).toContain("download wallet '/restaurante?tab=wallet'");
   expect(postdeploy).toContain("if [[ \"$API_CHECK\" == --check-api ]]");
   expect(postdeploy).not.toContain('stripe trigger');
   expect(postdeploy).not.toContain('pm2 restart');
   expect(postdeploy).not.toContain('prisma migrate');
   expect(ci).toContain('bash -n deploy/rc166-postdeploy-smoke.sh');
 });
});
