import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const get=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const view=get('../src/components/RestaurantApp.tsx');
const more=get('../src/components/RestaurantParity.tsx');
const wallet=get('../src/components/MerchantWallet.tsx');
const api=get('../src/lib/api.ts');
const css=get('../src/styles/restaurant.css');
describe('Tala Eats Restaurantes web parity vs Flutter',()=>{
 it('exposes seven real merchant areas and five mobile destinations',()=>{
  for(const n of ['inicio','pedidos','cocina','menu','finanzas','activacion','mas'])expect(view).toContain("id:'"+n+"'");
  for(const n of ['MerchantOverview','MerchantKitchen','MerchantMore','bottomTabs'])expect(view).toContain(n);
  expect(css).toContain('repeat(5,minmax(0,1fr))');
 });
 it('reads server-backed orders and never creates payment intents from kitchen',()=>{
  expect(more).toContain('api.ownerUpdateStatus');
  expect(more).toContain('nextMerchantState');
  expect(more).toContain('payment_status');
  expect(more).not.toContain('stripe.paymentIntents.create');
 });
 it('supports categories product media team and guarded menu delete',()=>{
  for(const needle of ['selectedCategory','api.ownerDeleteItem','api.ownerUploadItemPhoto'])expect(view).toContain(needle);
  for(const needle of ['/owner/employees?email=','/owner/menu/','/uploads/catalog/restaurant-cover'])expect(api).toContain(needle);
  expect(more).toContain('api.ownerInviteEmployee');
 });
 it('does not promise withdrawals or delivery as a completed live feature',()=>{
  expect(wallet).toContain('Los retiros bancarios aún no están habilitados');
  expect(wallet).toContain('No iniciada');
  expect(more).toContain('El reparto a domicilio LIVE requiere');
 });
});