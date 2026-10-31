import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {driverNavigationChoices} from '../src/lib/driver-route-options-rc152';
import type {DriverDashboardPayload} from '../src/lib/driver-delivery-ui';
import type {Order} from '../src/lib/types';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=source('src/components/DriverPwaWorkflow.tsx');
const help=source('src/components/DriverSupportForm.tsx');
const history=source('src/components/DriverSupportHistory.tsx');
const map=source('src/components/DriverLiveMap.tsx');
const alert=source('src/components/DriverOfferAttention.tsx');
const health=source('src/components/DriverOperationsOverview.tsx');
const wallet=source('src/components/FinanceWeeklyPreview.tsx');
const css=source('src/styles/driver-operational-rc152.css');

const assigned={
 id:71,restaurant_id:29,status:'assigned',order_type:'delivery',
 payment_method:'cash',payment_status:'pending',total:'210',
 address:'Calle Cliente 18, Tala, Jalisco',items:[],created_at:'2026-10-30T17:10:00'
} as Order;
const dash:DriverDashboardPayload={
 active:{id:71,restaurant:{id:29,name:'Comercio',address:'Calle Comercio 31, Tala, Jalisco'},
 customer:{address:'Domicilio verificado del cliente'}}
};

describe('RC152 operational experience, never simulated finance or dispatch',()=>{
 it('directs to store before pickup then to customer after pickup',()=>{
  expect(driverNavigationChoices(assigned,dash)).toEqual({
   destination:'Comercio',
   google:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('Calle Comercio 31, Tala, Jalisco'),
   apple:'https://maps.apple.com/?daddr='+encodeURIComponent('Calle Comercio 31, Tala, Jalisco')+'&dirflg=d'
  });
  const next=driverNavigationChoices({...assigned,status:'picked_up'},dash);
  expect(next?.destination).toBe('Cliente');
  expect(next?.google).toContain(encodeURIComponent('Calle Cliente 18, Tala, Jalisco'));
  expect(driverNavigationChoices({...assigned,status:'on_the_way'},dash)?.destination).toBe('Cliente');
 });
 it('refuses directions for stale/mismatched dashboard data, invalid address or finished order',()=>{
  expect(driverNavigationChoices({...assigned,status:'delivered'},dash)).toBeNull();
  expect(driverNavigationChoices({...assigned,address:''},null)).toBeNull();
  expect(driverNavigationChoices({...assigned,address:'\n',status:'picked_up'},dash)).toBeNull();
  expect(driverNavigationChoices({...assigned,address:'A'.repeat(281),status:'picked_up'},dash)).toBeNull();
  expect(driverNavigationChoices({...assigned,restaurant_id:30},dash)).toBeNull();
  expect(driverNavigationChoices(null,dash)).toBeNull();
 });
 it('opens provider links only through explicit user actions on real active delivery',()=>{
  expect(workflow).toContain('driverNavigationChoices(o,dashboard)');
  expect(workflow).toContain('deliveryInProgress(o)?driverNavigationChoices(o,dashboard):null');
  expect(workflow).toContain('href={routeChoices.google} target="_blank" rel="noopener noreferrer"');
  expect(workflow).toContain('href={routeChoices.apple} target="_blank" rel="noopener noreferrer"');
  expect(workflow).toContain("o.status==='on_the_way'");
  expect(workflow).toContain('api.driverComplete(order.id');
  expect(css).toContain('min-height:43px');
 });
 it('foreground offer notification can focus the exact authorised offer without accepting it',()=>{
  expect(alert).toContain('onFocusOffer?:(id:number)=>void');
  expect(alert).toContain('onFocusOffer(latest);setLatest(null)');
  expect(alert).toContain('const [enabled,setEnabled]=useState(false)');
  expect(map).toContain('onFocusOffer={openOffer}');
  expect(map).toContain('const offer=readyOffers.find(o=>o.id===id)');
  expect(map).not.toContain('api.driverReject(');
  expect(alert).not.toContain('Notification.requestPermission');
 });
 it('limits support visibility to the authenticated driver and blocks duplicate writes',()=>{
  expect(workflow).toContain("VITE_DRIVER_SUPPORT_ENABLED==='true'");
  expect(workflow).toContain('accountId={session.user?.id??null}');
  expect(workflow).toContain('key={session.user?.id??"unknown"} activeOrderId=');
  expect(help).toContain('if(inFlight.current||busy||!allowed||!valid)return;');
  expect(help).toContain('api.createSupportTicket(category,description.trim(),linkedOrderId)');
  expect(help).toContain('<DriverSupportHistory key={ticketId??\'initial\'} accountId={accountId}/>');
  expect(history).toContain('item.user_id===accountId');
  expect(history).toContain('No se pudo verificar el historial de reportes.');
  expect(history).not.toContain('localStorage');
  expect(help).toContain('servicios de emergencia');
 });
 it('keeps wallet read-only and resets it on authenticated driver account changes',()=>{
  expect(workflow).toContain('<FinanceWeeklyPreview key={session.user?.id??"unknown"} kind="driver" actorId={session.user?.id}/>');
  expect(wallet).toContain("if(kind==='driver'&&(!Number.isSafeInteger(actorId)||!actorId||actorId<=0))");
  expect(wallet).toContain('},[kind,restaurantId,actorId]);');
  expect(wallet).toContain("value.withdrawable_cents!=='0'");
  expect(workflow).toContain('<DriverCashHandoff orders={delivered}/>');
  expect(workflow).toContain('no representan saldo disponible para retiro');
 });
 it('shows operational health only from verified flags with responsive and accessible design',()=>{
  expect(health).toContain('readiness?.ready_for_dispatch===true&&verified&&online&&fresh');
  expect(health).toContain("offline?'Dispositivo sin conexión'");
  expect(health).toContain('readiness?.fresh_gps===true');
  expect(health).toContain('aria-label="Estado operativo del repartidor"');
  expect(workflow).toContain('<DriverOperationsOverview readiness={readiness}');
  expect(css).toContain('.df-app .df-operational-panel');
  expect(css).toContain('@media(max-width:380px)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 });
});
