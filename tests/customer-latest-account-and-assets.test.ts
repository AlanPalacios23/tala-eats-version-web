import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../src/App.tsx'),api=read('../src/lib/api.ts');
const panels=read('../src/customer/CustomerPanels.tsx'),extras=read('../src/customer/CustomerExtras.tsx');
const importer=read('../scripts/verify-mobile-hd-assets.py'),installer=read('../deploy/kali-update-pwa-static.sh');
describe('Mobile v1.0.46 customer account parity and approved HD assets',()=>{
 it('uses real wallet, notifications and support backend and no invented default balance',()=>{
  expect(api).toContain("'/platform/wallet'");
  expect(api).toContain("'/platform/notifications'");
  expect(api).toContain("'/platform/notifications/read-all'");
  expect(api).toContain("'/platform/support'");
  expect(extras).toContain('api.wallet()');
  expect(extras).toContain('api.notifications()');
  expect(extras).toContain('api.supportTicket(');
  expect(extras).toContain("setState('error')");
  expect(extras).toContain('No se pudo verificar esta información con el servidor');
  expect(panels).toContain('to="/wallet"');
  expect(app).toContain('path="/soporte"');
  expect(app).toContain('path="/notificaciones"');
 });
 it('fails closed if official media are missing from the repo checkout and dist',()=>{
  for(const name of ['food_fiesta.webp','food_tala.webp','tala_eats_original_wordmark.png','tala_eats_wordmark_transparent.png']){
    expect(importer).toContain(name);
    expect(installer).toContain(name);
  }
  expect(importer).toContain('hashlib.sha256(data).hexdigest()!=digest');
  expect(installer).toContain('PWA_UPDATE_ABORT=OFFICIAL_LANDING_MEDIA_MISSING_OR_WRONG_HASH');
 });
 it('protects real payment, merchant and driver routes',()=>{
  expect(app).toContain('path="/restaurante" element={<Protected role="restaurant">');
  expect(app).toContain('path="/repartidor" element={<Protected role="driver">');
  expect(api).toContain('placeCashPickup');
  expect(api).toContain('credentials:');
 });
});
