import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=file('src/components/DriverPwaWorkflow.tsx');
const map=file('src/components/DriverLiveMap.tsx');
const shell=file('src/styles/driver-focus-shell-rc157.css');
const mapCss=file('src/styles/driver-focus-map-rc157.css');

describe('RC157 · clutter-free Tala Eats courier UX',()=>{
 it('scopes the new visual hierarchy to the courier PWA, never customers, restaurants, or server files',()=>{
  expect(home).toContain("import '../styles/driver-focus-shell-rc157.css'");
  expect(map).toContain("import '../styles/driver-focus-map-rc157.css'");
  expect(shell).toContain('.df-app');
  expect(mapCss).toContain('.dm-immersive');
  expect(shell).not.toContain('.customer-');
  expect(shell).not.toContain('.restaurant-');
  expect(mapCss).not.toContain('body{');
  expect(mapCss).not.toContain('html{');
 });
 it('keeps a direct, truthful offline start and visible account status while reducing repeated copy',()=>{
  expect(home).toContain('Listo para salir');
  expect(home).toContain('Conéctate para ver tu ubicación y los pedidos que autorice Tala Eats.');
  expect(home).toContain("!reachable?'Esperando GPS vigente':actions?'Disponible para recibir pedidos':'Esperando autorización de pedidos'");
  expect(home).toContain('{online&&!reachable&&<button className="df-text-button df-gps-refresh"');
  expect(home).toContain('Conectado. Las nuevas asignaciones aún no están habilitadas.');
  expect(shell).toContain('.df-app .df-availability-text small');
  expect(shell).toContain('.df-app[data-driver-tab="inicio"] .df-metrics');
 });
 it('gives the map and one high-contrast primary action the first level of attention',()=>{
  expect(map).toContain('data-map-mode="immersive"');
  expect(map).toContain('Pedido disponible');
  expect(map).toContain('Buscando pedidos');
  expect(map).toContain('Sin pedidos disponibles todavía');
  expect(mapCss).toContain('.dm-immersive .dm-offer-panel');
  expect(mapCss).toContain('.dm-immersive .dm-accept');
  expect(mapCss).toContain('background:#17231d');
  expect(mapCss).toContain('.dm-immersive .dm-panel-count{display:none}');
  expect(mapCss).toContain('.dm-immersive .dm-overline{display:none}');
 });
 it('does not misrepresent dismissing offers as rejection, acceptance, or a live assigned job',()=>{
  expect(map).toContain('Ocultar retira la oferta de tu vista, no la rechaza en el servidor.');
  expect(map).toContain("setDismissed(old=>new Set([...old,selected.id]))");
  expect(map).not.toContain('api.driverReject(');
  expect(map).not.toContain('fakeOrders');
  expect(home).toContain("const actions=driverActionsAvailable(readiness,actionOptIn)");
  expect(home).toContain('eligible={actions&&!active}');
  expect(home).toContain('disabled={operationsBlocked||!!active||readiness?.presence_enabled!==true||!readiness?.admin_verified}');
 });
 it('preserves trusted delivery completion and private session boundaries',()=>{
  expect(home).toContain("return <DriverPwaWorkflowSession key={session.user?.id??'signed-out'}/>");
  expect(home).toContain('canSubmitDelivery(active,pin[active.id]??\'\',cashReceived[active.id]===true)');
  expect(home).toContain('api.driverComplete(order.id');
  expect(home).toContain('VITE_DRIVER_SUPPORT_ENABLED');
  expect(home).toContain('VITE_DRIVER_ACTIONS_ENABLED');
  expect(home).not.toContain('STRIPE_SECRET_KEY');
  expect(map).not.toContain('localStorage.setItem');
 });
 it('fits mobile 320dp with safe areas, focus outlines and reduced motion',()=>{
  expect(shell).toContain('@media(max-width:320px)');
  expect(shell).toContain('@media(max-width:389px)');
  expect(shell).toContain('env(safe-area-inset-bottom)');
  expect(shell).toContain('focus-visible');
  expect(shell).toContain('@media(prefers-reduced-motion:reduce)');
  expect(mapCss).toContain('@media(max-width:370px)');
  expect(mapCss).toContain('@media(max-height:620px)');
  expect(mapCss).toContain('@media(prefers-reduced-motion:reduce)');
 });
});
