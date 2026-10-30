import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const load=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const driver=load('src/components/DriverPwaWorkflow.tsx');
const polish=load('src/styles/driver-polish-rc146.css');
const oldStyles=load('src/styles/driver-flutter.css');
const map=load('src/components/DriverLiveMap.tsx');

describe('RC146 driver PWA visual quality and truthful states',()=>{
 it('loads premium styles only in driver workflow without customer, restaurant or backend mutations',()=>{
  expect(driver).toContain("import '../styles/driver-polish-rc146.css'");
  expect(polish).toContain('.df-app');
  expect(polish).toContain('.dm-immersive');
  expect(driver).toContain('api.driverPresenceReadiness()');
  expect(driver).toContain('api.driverAvailable()');
  expect(driver).toContain("const actions=driverActionsAvailable(readiness,actionOptIn)");
  expect(driver).not.toContain("localStorage.setItem");
  expect(map).not.toContain("api.driverLocation(");
 });
 it('shows a true initial loading state rather than an invented offline status',()=>{
  expect(driver).toContain('aria-busy={loading&&!readiness}');
  expect(driver).toContain('{loading&&!readiness&&<div className="df-loading-state"');
  expect(driver).toContain('role="status" aria-live="polite"');
  expect(driver).toContain('aria-hidden="true"');
  expect(driver).toContain('{(!loading||readiness)&&<>');
  expect(driver).toContain('df-loading-preview');
  expect(driver).not.toContain('Consultando información real del servidor…');
 });
 it('does not promise assignment while GPS or backend dispatch permission is missing',()=>{
  expect(driver).toContain("!reachable?'Esperando GPS vigente':actions?'Disponible para recibir pedidos':'Esperando autorización de pedidos'");
  expect(driver).toContain('eligible={actions&&!active}');
  expect(driver).toContain('disabled={operationsBlocked||!!active||readiness?.presence_enabled!==true||!readiness?.admin_verified}');
 });
 it('keeps all four navigation labels readable on 320 to 389dp screens',()=>{
  expect(oldStyles).toContain('.df-bottom-nav button:not(.selected) .df-nav-label{display:none}');
  expect(polish).toContain('@media(max-width:389px)');
  expect(polish).toContain('.df-app .df-bottom-nav button:not(.selected) .df-nav-label{display:block}');
  expect(polish).toContain('width:25%;min-width:0');
  expect(driver).toContain("label:'Ganancias'");
  expect(driver).toContain("label:'Entregas'");
  expect(driver).toContain('aria-current={tab===t.key?\'page\':undefined}');
 });
 it('uses modest animations, focus cues, reduced-motion fallbacks and correct profile approval color',()=>{
  expect(polish).toContain('@media(prefers-reduced-motion:reduce)');
  expect(polish).toContain('animation:none!important;transition:none!important');
  expect(polish).toContain('.df-app .df-switch:focus-visible');
  expect(polish).toContain('.df-app .df-week-day:focus-visible');
  expect(polish).toContain('.df-app .df-profile-verified');
  expect(polish).toContain('.df-app .df-profile-pending');
  expect(driver).toContain('"df-chip df-profile-verified":"df-chip df-profile-pending"');
  expect(driver).toContain('df-avatar-edit');
  expect(driver).toContain('Tu información y seguridad');
 });
});
