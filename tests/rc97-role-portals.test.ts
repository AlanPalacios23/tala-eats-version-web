import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../src/App.tsx');
const boot=read('../src/main.tsx');
const driver=read('../src/components/DriverPwaWorkflow.tsx');
const css=read('../src/styles/driver-pwa.css');

describe('RC9.7: three operational PWA role portals',()=>{
 it('keeps main portal, customer, restaurant and courier routes independent',()=>{
  for(const r of ['path="/" element={<PortalLanding/>}','path="/clientes"','path="/restaurante"','path="/repartidor"']){
   expect(app).toContain(r);
  }
  expect(app).toContain('restaurantPortalDestination(import.meta.env.VITE_RESTAURANT_APP_URL)');
  expect(app).toContain('<DriverCanonicalRedirect suffix=""/>');
 });
 it('does not show the customer shopping cart, customer header or footer inside Driver',()=>{
  expect(app).toContain("const isDriverPortal=location.pathname==='/repartidor'||location.pathname.startsWith('/repartidor/')");
  expect(app).toContain('(isDriverPortal?" driver-shell":"")');
  expect(app).toContain('!isGateway&&!isOnboarding&&!isRestaurantPortal&&!isDriverPortal&&<AppHeader count={count}/>');
  expect(app).toContain('!isGateway&&!isOnboarding&&!isRestaurantPortal&&!isDriverPortal&&<AppFooter/>');
  expect(css).toContain('.app.driver-shell');
  expect(driver).toContain('className="df-screen-header"');
  expect(driver).toContain('className="df-bottom-nav"');
 });
 it('never flashes customer-only opening artwork in restaurant or driver portals',()=>{
  expect(boot).toContain('repartidor(?:\\/|$)');
  expect(boot).toContain("manifestForPath(location.pathname)");
  expect(boot).toContain("navigator.serviceWorker.register('/sw.js'");
 });
 it('keeps dispatch authority and Stripe checkout out of the role-only visual change',()=>{
  expect(driver).toContain("const actionOptIn=import.meta.env.VITE_DRIVER_ACTIONS_ENABLED==='true'");
  expect(driver).toContain('driverActionsAvailable(readiness,actionOptIn)');
  expect(driver).toContain('api.driverPresenceReadiness()');
 });
});
