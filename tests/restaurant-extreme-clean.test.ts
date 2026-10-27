import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const shell=read('../src/components/RestaurantApp.tsx');
const parity=read('../src/components/RestaurantParity.tsx');
const wallet=read('../src/components/MerchantWallet.tsx');
const css=read('../src/styles/restaurant-mobile-wallet.css');
describe('Restaurantes premium clean | mobile priority without removing operations',()=>{
 it('keeps the business title, real order operations and the five main navigation destinations',()=>{
  expect(shell).toContain("<h1>{restaurant?.name||'Restaurantes'}</h1>");
  expect(shell).toContain("['inicio','pedidos','cocina','menu','mas']");
  expect(shell).toContain("aria-label=\"Navegación móvil de restaurantes\"");
  expect(parity).toContain("aria-label=\"Inicio rápido del restaurante\"");
  expect(parity).toContain("go('cocina')");
  expect(parity).toContain("go('pedidos')");
  expect(parity).toContain("go('finanzas')");
 });
 it('does not render the repeated branding, marketing date or duplicate order callout in the authenticated shell',()=>{
  expect(shell).not.toContain('GESTIÓN DEL COMERCIO');
  expect(shell).not.toContain('TALA EATS RESTAURANTES</span>');
  expect(shell).not.toContain('Tala Eats <b>Business</b>');
  expect(shell).not.toContain('new Date().toLocaleDateString');
  expect(shell).not.toContain('className=\"rp-new-orders\"');
  expect(css).toContain('.rp-layout .rp-sidebar{display:none!important}');
  expect(css).toContain('.rp-layout .rp-mobile-tabs button svg{display:none}');
 });
 it('removes unnecessary icons in mobile operational shortcuts and bogus image placeholders',()=>{
  expect(parity).not.toContain('<ChefHat size={19}/>');
  expect(parity).not.toContain('<PackageCheck size={19}/>');
  expect(parity).toContain('<strong>Wallet</strong>');
  expect(parity).toContain('<strong>Equipo</strong>');
  expect(shell).not.toContain('<ChefHat size={30}/>');
  expect(shell).toContain('safePhoto&&!imageBroken&&<div');
 });
 it('retains truthful Wallet and withdrawal guard',()=>{
  expect(wallet).toContain('Retirar ganancias');
  expect(wallet).toContain('Los retiros bancarios aún no están habilitados');
  expect(wallet).toContain('Disponible para retirar');
  expect(wallet).toContain('Transferencia bancaria');
  expect(wallet).not.toContain('TALA EATS WALLET</span>');
  expect(wallet).not.toMatch(/api\.[A-Za-z]*(Withdraw|Transfer|Payout)/);
 });
 it('retains accessibility, alerts, merchant onboarding and static isolation',()=>{
  expect(shell).toContain('RestaurantOrderAlerts');
  expect(shell).toContain('RestaurantOnboarding');
  expect(shell).toContain('aria-label=\"Actualizar pedidos y negocio\"');
  expect(parity).toContain('notPaid.length>0');
  expect(parity).toContain('confirm(');
  expect(css).toContain('@media(max-width:360px)');
  expect(css).toContain('min-height:100dvh');
 });
});