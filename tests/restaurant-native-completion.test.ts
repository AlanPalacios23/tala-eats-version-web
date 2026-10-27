import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const view=read('../src/components/RestaurantApp.tsx');
const parity=read('../src/components/RestaurantParity.tsx');
const welcome=read('../src/components/RestaurantWelcome.tsx');
const wallet=read('../src/components/MerchantWallet.tsx');
const css=read('../src/styles/restaurant-flutter-parity.css');
const landing=read('../src/styles/restaurant-welcome.css');

describe('Restaurantes Web: fidelity to Flutter v0.7.6 merchant mobile contract',()=>{
 it('has native welcome ticket, three real steps and two exact actions',()=>{
  expect(welcome).toContain('className="rb-flutter-welcome"');
  for(const s of ['Tu cuenta','Tu restaurante','Tu primer producto','Crear mi restaurante','Ya tengo cuenta'])expect(welcome).toContain(s);
  expect(landing).toContain('.rb-welcome>#rb-main');
  expect(landing).toContain('background:#F1F2EF');
 });
 it('opens a dedicated native-style login, only requiring six digit OTP on challenge',()=>{
  expect(view).toContain('const [needsOtp,setNeedsOtp]=useState(false)');
  expect(view).toContain("mode==='login'&&needsOtp");
  expect(view).toContain('pattern="[0-9]{6}"');
  expect(view).toContain('Verificar e iniciar sesión');
  expect(css).toContain('.rp-auth-page .rp-intro{display:none!important}');
 });
 it('renders Flutter More identity 16/7 and operational navigation backed by same API',()=>{
  expect(parity).toContain('rm-flutter-identity');
  expect(parity).toContain('rm-flutter-settings-group');
  for(const key of ['Modo cocina','Ubicación del establecimiento','Recoger en tienda',
    'Preparación y entrega','Retiros y cuenta bancaria','Equipo y permisos','Cuenta'])
   expect(parity).toContain(key);
  expect(parity).toContain("api.ownerUpdateRestaurant({pickup_enabled:!restaurant.pickup_enabled})");
  expect(css).toContain('aspect-ratio:16/7');
  expect(parity).toContain('ref={profileRef}');
  expect(parity).toContain('ref={teamRef}');
 });
 it('groups Orders into three native operational stages with server-controlled pickup',()=>{
  expect(view).toContain("(['received','kitchen','ready'] as const).map");
  expect(view).toContain("o.status==='confirmed'||o.status==='preparing'");
  expect(view).toContain('canHandoffPickup(o,pins[o.id]');
  expect(view).toContain("api.ownerCompletePickup(order.id,pin)");
  expect(view).toContain('aria-label="Abrir modo cocina"');
 });
 it('keeps native Orders as vertical groups with tappable counts and history-only search',()=>{
  expect(view).toContain("(['received','kitchen','ready'] as const).map");
  expect(view).toContain("['all','Activos',activeOrders.length]");
  expect(view).toContain('className="rp-order-controls rp-flutter-filter-controls" data-filter={orderFilter}');
  expect(view).toContain('rp-filter-count');
  expect(view).toContain("setOrderFilter(id);setOrderQuery('');");
  expect(css).toContain('data-filter="history"]>.rp-flutter-orders-search');
  expect(css).toContain('.rp-history-secondary{display:none!important}');
  expect(css).toContain('min-height:48px!important');
 });
 it('makes native More app information actionable and keyboard accessible',()=>{
  expect(parity).toContain('accountTwoFactorEnabled');
  expect(parity).toContain('className="rm-about-backdrop"');
  expect(parity).toContain('role="dialog" aria-modal="true"');
  expect(parity).toContain("if(event.key==='Escape')");
  expect(parity).toContain('target.focus({preventScroll:true})');
  expect(view).toContain('accountTwoFactorEnabled={user?.two_factor_enabled===true}');
 });
 it('exposes native period selector in Wallet without presenting a fake withdrawable balance',()=>{
  expect(wallet).toContain('<MerchantFinanceActivity orders={orders}/>');
  expect(parity).toContain("['today','Hoy']");
  expect(parity).toContain("['week','7 días']");
  expect(parity).toContain("['month','30 días']");
  expect(parity).toContain('Muestra de hasta 200 pedidos recientes');
  expect(wallet).toContain('Saldo retirable confirmado');
  expect(wallet).not.toMatch(/api\.[A-Za-z]*(Withdraw|Transfer|Payout)/);
 });
 it('preserves isolation and does not install the merchant PWA over Clients',()=>{
  const vite=read('../vite.restaurante.config.ts');
  expect(vite).toContain('dist-restaurantes');
  const api=read('../src/lib/api.ts');
  expect(api).toContain("ownerEarnings:");
  expect(api).toContain("ownerOrders:");
  expect(view).toContain('data-kitchen-open');
 });
});
