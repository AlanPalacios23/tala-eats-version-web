import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validLivePosition} from '../src/lib/driver-live-map';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('src/components/DriverPwaWorkflow.tsx');
const map=read('src/components/DriverLiveMap.tsx');
const styles=read('src/styles/driver-journey-focus-rc158.css');

describe('RC158 · focused trips, useful offers and expiring GPS',()=>{
 it('preserves the active delivery contract but hides repeated stops behind a native detail disclosure on Home only',()=>{
  expect(main).toContain('const tripStops=deliveryInProgress(o)?<div className="df-route-stops">');
  expect(main).toContain("tripStops&&(tab==='inicio'?<details className=\"df-trip-more\">");
  expect(main).toContain('<summary>Ver paradas y direcciones</summary>{tripStops}');
  expect(main).toContain('</details>:tripStops)');
  expect(main).toContain('driverNavigationChoices(o,dashboard)');
  expect(main).toContain('href={routeChoices.google} target="_blank" rel="noopener noreferrer"');
  expect(main).toContain('href={routeChoices.apple} target="_blank" rel="noopener noreferrer"');
  expect(main).toContain('onClick={()=>void completeDelivery(active)}');
 });
 it('keeps primary actions outside collapsible details and prevents unauthorized order processing',()=>{
  expect(main).toContain('disabled={homeAction.disabled} onClick={homeAction.press}');
  expect(main).toContain("disabled={operationsBlocked||!canProgress||!canSubmitDelivery(active,pin[active.id]??'',cashReceived[active.id]===true)}");
  expect(main).toContain("guardedAction(()=>api.driverStatus(active.id");
  expect(main).toContain("VITE_DRIVER_ACTIONS_ENABLED==='true'");
  expect(main).toContain("return <DriverPwaWorkflowSession key={session.user?.id??'signed-out'}/>");
 });
 it('makes sorting opt-in without hiding accepted server offer details',()=>{
  expect(map).toContain('eligible&&sortedOffers.length>1&&<details className="dm-sort-details"');
  expect(map).toContain('<summary>Ordenar ofertas</summary>');
  expect(map).toContain('role="group" aria-label="Ordenar pedidos disponibles"');
  expect(map).toContain("onClick={()=>onAccept(selected)}");
  expect(map).toContain('onFocusOffer={openOffer}');
  expect(map).toContain("const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)");
  expect(map).not.toContain('api.driverReject(');
 });
 it('expires stale GPS in the foreground even when watchPosition stops emitting',()=>{
  expect(map).toContain('let expiryTimer:number|null=null;');
  expect(map).toContain('window.clearTimeout(expiryTimer)');
  expect(map).toContain('const epoch=activeEpoch;');
  expect(map).toContain("if(epoch!==activeEpoch||document.visibilityState!=='visible')return;");
  expect(map).toContain('expiryTimer=window.setTimeout(()=>{');
  expect(map).toContain('},Math.max(1,60000-ageMs));');
  expect(map).toContain('setPosition(null);');
  expect(map).toContain("navigator.geolocation.clearWatch(watchId)");
  expect(map).not.toContain('setInterval(');
  const now=Date.now();
  expect(validLivePosition(20.65,-103.71,16,now-45000,now)).toBe(true);
  expect(validLivePosition(20.65,-103.71,16,now-61000,now)).toBe(false);
  expect(validLivePosition(20.65,-103.71,160,now,now)).toBe(false);
 });
 it('stays readable on small screens and preserves native accessibility',()=>{
  expect(styles).toContain('.df-app .df-trip-more>summary');
  expect(styles).toContain('.dm-immersive .dm-sort-details>summary');
  expect(styles).toContain('min-height:44px');
  expect(styles).toContain('focus-visible');
  expect(styles).toContain('@media(max-width:370px)');
  expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
  expect(styles).not.toContain('env(safe-area-inset-bottom)');
 });
 it('cannot modify backend finance, secret configuration, customer maps or delivery state by visual changes',()=>{
  expect(map).not.toContain('STRIPE_SECRET_KEY');
  expect(map).not.toContain('localStorage.setItem');
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('customer.address');
  expect(main).toContain('api.driverComplete(order.id');
 });
});
