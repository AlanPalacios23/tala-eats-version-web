import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Order,Restaurant} from '../src/lib/types';
import {
 safeMapPoint,driverOfferMarker,driverOfferMarkers,availableMapOffers,
 straightLineKm,validLivePosition
} from '../src/lib/driver-live-map';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map=read('src/components/DriverLiveMap.tsx');
const app=read('src/components/DriverPwaWorkflow.tsx');
const nginx=read('deploy/nginx-repartidores-isolated-server.conf');
const audit=read('deploy/rc141-kali-driver-security-audit.sh');
const sw=read('public/sw-repartidor.js');
const makeOrder=(id=10,restaurant_id=5):Order=>({
 id,restaurant_id,status:'ready',order_type:'delivery',payment_method:'cash',
 payment_status:'pending',total:'189',created_at:'2026-10-30T00:00:00',items:[]
});
describe('RC142 live driver map: verified dispatch and map privacy',()=>{
 it('does not invent GPS or geocode private customer addresses',()=>{
  expect(safeMapPoint(20.66,-103.70)).toEqual({lat:20.66,lng:-103.7});
  expect(safeMapPoint(0,0)).toBeNull();
  expect(safeMapPoint(91,-103)).toBeNull();
  expect(safeMapPoint('20.66',-103.7)).toBeNull();
  const order={...makeOrder(),address:'Customer house, secret street'};
  expect(driverOfferMarker(order,[])).toBeNull();
  const catalog:Restaurant[]=[{id:5,name:'Restaurante ejemplo',lat:20.652,lng:-103.712,is_open:true}];
  expect(driverOfferMarker(order,catalog)).toMatchObject({name:'Restaurante ejemplo',source:'catalog',point:{lat:20.652,lng:-103.712}});
  expect(driverOfferMarker({...makeOrder(),restaurant:{lat:20.665,lng:-103.707,name:'Tienda'}},catalog)).toMatchObject({source:'offer',point:{lat:20.665,lng:-103.707}});
 });
 it('shows only server-authorized undismissed offers; dismissal never cancels an order',()=>{
  const orders=[makeOrder(10),makeOrder(11),makeOrder(12)];
  expect(availableMapOffers(orders,new Set([11]),true).map(o=>o.id)).toEqual([10,12]);
  expect(availableMapOffers(orders,new Set(),false)).toEqual([]);
  expect(driverOfferMarkers(orders,[])).toEqual([]);
  expect(map).toContain("setDismissed(old=>new Set([...old,selected.id]))");
  expect(map).toContain('no la rechaza en el servidor');
  expect(map).not.toContain('api.driverReject(');
  expect(map).not.toContain('api.driverCancel(');
  expect(map).not.toContain('localStorage.setItem');
 });
 it('uses high-accuracy foreground GPS with no extra backend location writes',()=>{
  const now=Date.now();
  expect(validLivePosition(20.66,-103.7,42,now,now)).toBe(true);
  expect(validLivePosition(20.66,-103.7,250,now,now)).toBe(false);
  expect(validLivePosition(20.66,-103.7,30,now-70000,now)).toBe(false);
  expect(validLivePosition(0,0,1,now,now)).toBe(false);
  expect(map).toContain('navigator.geolocation.watchPosition(');
  expect(map).toContain('navigator.geolocation.clearWatch(watchId)');
  expect(map).toContain("document.visibilityState!=='visible'");
  expect(map).toContain('maximumAge:0,timeout:20000');
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('setInterval(');
 });
 it('only renders on confirmed online presence; accepting always calls existing guarded API',()=>{
  expect(app).toContain('{online&&mapOpen&&!active&&<DriverLiveMap');
  expect(app).toContain('eligible={actions&&!active}');
  expect(app).toContain('offers={active?[]:available}');
  expect(app).toContain("onAccept={order=>{void guardedAction(()=>api.driverAccept(order.id)");
  expect(app).toContain("const actions=driverActionsAvailable(readiness,actionOptIn)");
  expect(app).toContain('verifiedOnlinePresence(readiness)');
  expect(map).toContain('eligible&&!offline');
  expect(map).toContain('disabled={busy||offline}');
 });
 it('has only real merchant map pins; estimates are straight-line only, not fabricated ETAs',()=>{
  expect(Math.round(straightLineKm({lat:20.65,lng:-103.7},{lat:20.65,lng:-103.7}))).toBe(0);
  expect(map).toContain('km en línea recta');
  expect(map).toContain('Ubicación no disponible');
  expect(map).toContain('L.circleMarker');
  expect(map).toContain('api.restaurants()');
  expect(map).not.toContain('customer.address');
 });
 it('requires explicit map-tile CSP and OSM attribution, with private app policies intact',()=>{
  expect(nginx.match(/img-src 'self' data: blob: https:\/\/tile\.openstreetmap\.org;/g)?.length).toBe(8);
  expect(audit).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
  expect(map).toContain("referrerPolicy:'strict-origin-when-cross-origin'");
  expect(map).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  expect(map).toContain('© OpenStreetMap');
  expect(nginx).toContain('Referrer-Policy no-referrer');
  expect(sw).toContain("u.origin!==self.location.origin");
  expect(sw).toContain("u.pathname.startsWith('/api/')");
 });
});
