import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Order} from '../src/lib/types';
import {driverJourneyStage,driverJourneyNavigationHref} from '../src/lib/driver-journey-ux';
import type {DriverDashboardPayload} from '../src/lib/driver-delivery-ui';

const code=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const driver=code('src/components/DriverPwaWorkflow.tsx');
const map=code('src/components/DriverLiveMap.tsx');
const styles=code('src/styles/driver-journey-rc147.css');
const order={
 id:17,restaurant_id:41,status:'assigned',order_type:'delivery',payment_method:'cash',
 address:'Calle de Entrega 15, Tala, Jalisco',payment_status:'pending',total:'239',
 subtotal:'200',created_at:'2026-10-30T08:00:00',items:[]
} as Order;
const verified:DriverDashboardPayload={
 active:{id:17,restaurant:{id:41,name:'Comercio',address:'Calle de Recogida 18, Tala, Jalisco'}},
};

describe('RC147 · same API, clearer Uber-like active trip UI',()=>{
 it('only renders stages for actual in-progress server statuses',()=>{
  expect(driverJourneyStage('assigned')).toMatchObject({step:1,title:'Dirígete a recoger'});
  expect(driverJourneyStage('picked_up')).toMatchObject({step:2,title:'Pedido recogido'});
  expect(driverJourneyStage('on_the_way')).toMatchObject({step:3,title:'Entrega en curso'});
  for(const invalid of ['ready','delivered','cancelled','none',undefined])
   expect(driverJourneyStage(invalid)).toBeNull();
  expect(driver).toContain("aria-label={'Progreso de entrega: paso '+stage.step+' de 3, '+stage.title}");
 });
 it('maps pickup first; only after pickup offers customer directions',()=>{
  const pickup=driverJourneyNavigationHref(order,verified);
  expect(pickup).toBe('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('Calle de Recogida 18, Tala, Jalisco'));
  const dropoff=driverJourneyNavigationHref({...order,status:'picked_up'},verified);
  expect(dropoff).toBe('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(order.address!));
  expect(driverJourneyNavigationHref({...order,status:'on_the_way'},verified)).toBe(dropoff);
 });
 it('never invents directions if missing, invalid, not active or mismatched',()=>{
  const noAddress={...order,address:''};
  expect(driverJourneyNavigationHref(noAddress,null)).toBeNull();
  expect(driverJourneyNavigationHref({...noAddress,status:'on_the_way'},null)).toBeNull();
  expect(driverJourneyNavigationHref({...noAddress,status:'picked_up'},verified)).toBeNull();
  expect(driverJourneyNavigationHref({...order,status:'delivered'},verified)).toBeNull();
  expect(driverJourneyNavigationHref(null,verified)).toBeNull();
  expect(driverJourneyNavigationHref({...order,restaurant_id:19},verified)).toBeNull();
  expect(driverJourneyNavigationHref({...order,address:'X'.repeat(281),status:'on_the_way'},verified)).toBeNull();
  expect(driverJourneyNavigationHref({...order,address:'\n',status:'on_the_way'},verified)).toBeNull();
 });
 it('adds a single action for directions beside the existing protected primary CTA',()=>{
  expect(driver).toContain('const activeNavigationHref=driverJourneyNavigationHref(active,dashboard)');
  expect(driver).toContain("activeNavigationHref?' df-home-action-route':'");
  expect(driver).toContain('href={activeNavigationHref}');
  expect(driver).toContain('target="_blank" rel="noopener noreferrer"');
  expect(driver).toContain('className="df-route-quick"');
  expect(driver).toContain('disabled={homeAction.disabled} onClick={homeAction.press}');
  expect(driver).toContain('api.driverStatus(active.id');
  expect(driver).toContain('openDeliveryProof(active)');
  expect(styles).toContain('.df-app .df-home-action-route>.df-primary');
  expect(styles).toContain('@media(max-width:380px)');
  expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
 });
 it('keeps active trip and GPS map transitions consistent with reduced motion',()=>{
  expect(map).toContain("const motionAllowed=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches");
  expect(map).toContain('if(motionAllowed())');
  expect(map).toContain('map.setView([marker.point.lat,marker.point.lng],15,{animate:false})');
  expect(map).toContain("offline?'SIN RED':'EN LÍNEA'");
  expect(map).toContain('aria-live="polite"');
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('api.driverReject(');
 });
});
