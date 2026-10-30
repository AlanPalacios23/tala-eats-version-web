import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {availableMapOffers,driverOfferMarkers,safeMapPoint} from '../src/lib/driver-live-map';
import type {Order,Restaurant} from '../src/lib/types';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map=read('src/components/DriverLiveMap.tsx');
const home=read('src/components/DriverPwaWorkflow.tsx');
const css=read('src/styles/driver-live-map.css');
const nginx=read('deploy/nginx-repartidores-isolated-server.conf');
const sw=read('public/sw-repartidor.js');
const offer=(id:number):Order=>({
 id,restaurant_id:9,status:'ready',order_type:'delivery',
 payment_method:'cash',payment_status:'pending',total:'187',
 created_at:'2026-10-30T02:00:00',items:[]
});
describe('RC143 courier full-viewport operational experience',()=>{
 it('uses the whole device viewport, including iOS safe areas, not a scrollable Home card',()=>{
  expect(map).toContain('className="dm-shell dm-immersive"');
  expect(map).toContain('data-map-mode="immersive"');
  expect(css).toContain('position:fixed;inset:0');
  expect(css).toContain('height:100dvh');
  expect(css).toContain('z-index:1100');
  expect(css).toContain('env(safe-area-inset-top)');
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(css).toContain('env(safe-area-inset-left)');
  expect(css).toContain('env(safe-area-inset-right)');
  expect(css).not.toContain('52dvh,540px');
  expect(css).toContain('overscroll-behavior:contain');
 });
 it('opens only after verified backend online and closes automatically for active assignments',()=>{
  expect(home).toContain("if(online&&tab==='inicio'&&!active)setMapOpen(true)");
  expect(home).toContain('{online&&mapOpen&&!active&&<DriverLiveMap');
  expect(home).toContain('eligible={actions&&!active}');
  expect(home).toContain("const actions=driverActionsAvailable(readiness,actionOptIn)");
  expect(home).toContain("press:()=>setMapOpen(true)");
  expect(home).toContain('onClose={closeMap}');
  expect(home).toContain("onGoOffline={()=>{if(!operationsBlocked&&!active)void setOnline(false);}}");
  expect(map).toContain('onClick={onClose}');
  expect(map).toContain('Volver al inicio sin desconectarte');
  expect(map).toContain('onClick={onGoOffline}');
 });
 it('keeps large native-like actions and a draggable accessible bottom-sheet',()=>{
  expect(map).toContain('className="dm-offer-panel"');
  expect(map).toContain("data-sheet={expanded?'expanded':'peek'}");
  expect(map).toContain('aria-expanded={expanded}');
  expect(map).toContain('onTouchStart=');
  expect(map).toContain('onTouchEnd=');
  expect(map).toContain('delta< -45');
  expect(map).toContain('delta>45');
  expect(map).toContain('className="dm-accept"');
  expect(map).toContain('className="dm-dismiss"');
  expect(css).toContain('min-height:54px');
  expect(css).toContain('@media(max-width:370px)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 });
 it('never invents offers, fake acceptances or server-side rejection',()=>{
  expect(availableMapOffers([offer(1)],new Set(),false)).toEqual([]);
  expect(availableMapOffers([offer(1)],new Set([1]),true)).toEqual([]);
  const stores:Restaurant[]=[{id:9,name:'Tienda de prueba',lat:20.64,lng:-103.70,is_open:true}];
  expect(driverOfferMarkers([offer(1)],stores)).toHaveLength(1);
  expect(safeMapPoint(0,0)).toBeNull();
  expect(map).toContain('const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)');
  expect(map).toContain('setDismissed(old=>new Set([...old,selected.id]))');
  expect(map).toContain('no la rechaza en el servidor');
  expect(map).not.toContain('api.driverReject(');
  expect(map).not.toContain('api.driverLocation(');
  expect(home).toContain("guardedAction(()=>api.driverAccept(order.id)");
  expect(map).toContain('errorMessage&&');
  expect(map).toContain('disabled={busy||offline}');
 });
 it('uses current foreground GPS only and has deterministic cleanup',()=>{
  expect(map).toContain('navigator.geolocation.watchPosition(');
  expect(map).toContain('navigator.geolocation.clearWatch(watchId)');
  expect(map).toContain("document.visibilityState!=='visible'");
  expect(map).toContain('document.body.style.overflow=oldOverflow');
  expect(map).toContain("event.key==='Escape'");
  expect(map).toContain("event.key!=='Tab'");
  expect(map).toContain('const previous=document.activeElement');
  expect(map).toContain('ResizeObserver');
  expect(map).not.toContain('localStorage.setItem');
  expect(map).not.toContain('setInterval(');
  expect(sw).toContain("u.origin!==self.location.origin");
  expect(sw).toContain("u.pathname.startsWith('/api/')");
 });
 it('never shows customer pickup markers or unsupported travel times',()=>{
  expect(map).toContain('km en línea recta');
  expect(map).toContain('Ubicación no disponible');
  expect(map).toContain('api.restaurants()');
  expect(map).not.toContain('customer.address');
  expect(map).not.toContain('estimatedMinutes');
  expect(map).not.toContain('fakeOrders');
  expect(map).toContain('© OpenStreetMap');
  expect(map).toContain("referrerPolicy:'strict-origin-when-cross-origin'");
  expect(nginx).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
 });
});
