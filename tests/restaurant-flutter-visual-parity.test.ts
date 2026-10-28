import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../src/components/RestaurantApp.tsx');
const views=read('../src/components/RestaurantParity.tsx');
const css=read('../src/styles/restaurant-flutter-parity.css');
const wallet=read('../src/components/MerchantWallet.tsx');
describe('Flutter Restaurante v0.7.6+46 -> isolated web appearance parity',()=>{
 it('uses source-of-truth Flutter steel, orange and kitchen-paper tokens, not old olive branding',()=>{
  for(const x of ['#F1F2EF','#E0E2DC','#1C1D1B','#FF5A1F','#127A47','#131412','#1D1F1C','#F8F7F2'])
   expect(css).toContain(x);
  expect(css).toContain('Flutter 0.7.6+46');
  expect(app).toContain("restaurant-flutter-parity.css");
 });
 it('mirrors native five bottom NavigationDestinations; KDS is a dedicated operational mode',()=>{
  expect(app).toContain("['inicio','pedidos','menu','finanzas','mas']");
  expect(app).toContain('data-kitchen-open');
  expect(views).toContain('flutter-kds-header');
  expect(views).toContain('flutter-kitchen-entry');
  expect(css).toContain('.rp-layout[data-kitchen-open="true"] .rp-mobile-tabs');
  expect(css).toContain('display:none!important');
 });
 it('uses native home hierarchy and real owner availability instead of sample data',()=>{
  for(const val of ['flutter-store-heading','flutter-open-card','Requiere atención','Modo cocina','En curso','flutter-summary'])
   expect(views).toContain(val);
  expect(views).toContain('api.ownerUpdateRestaurant');
  expect(views).toContain('restaurant.is_open');
  expect(views).not.toContain('fake_payout');
 });
 it('matches Flutter More sign-out and conditional new-order attention without adding visual clutter',()=>{
  expect(views).toContain('onSignOut?:()=>Promise<void>');
  expect(views).toContain('flutter-signout');
  expect(views).toContain('¿Cerrar sesión?');
  expect(app).toContain('onSignOut={signOut}');
  expect(app).toContain('flutter-incoming-banner');
  expect(app).toContain("!['inicio','pedidos','cocina'].includes(tab)");
  expect(css).toContain('.rp-layout .flutter-incoming-banner');
  expect(css).toContain('.rp-layout .flutter-signout');
 });
 it('keeps Flutter product toggle server-backed and wallet withdrawals fail-closed',()=>{
  expect(app).toContain('role="switch"');
  expect(app).toContain('api.ownerUpdateItem(item.id,{is_available:available})');
  expect(wallet).toContain('Retirar ganancias');
  expect(wallet).toContain('Los retiros bancarios aún no están habilitados');
  expect(wallet).not.toMatch(/api\.[A-Za-z]*(Withdraw|Transfer|Payout)/);
 });
});