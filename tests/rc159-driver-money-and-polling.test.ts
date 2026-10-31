import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {verifiedDriverEarning,sortDriverOffers} from '../src/lib/driver-offer-choice';
import {driverLocalDayKey} from '../src/lib/driver-operations-core';
import type {Order} from '../src/lib/types';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map=read('src/components/DriverLiveMap.tsx');
const workflow=read('src/components/DriverPwaWorkflow.tsx');
const make=(id:number,earning:string):Order=>({
 id,restaurant_id:id+100,status:'ready',order_type:'delivery',payment_method:'cash',
 payment_status:'pending',created_at:'2026-10-31T10:00:00',total:'120',items:[],driver_earning:earning
});
describe('RC159 courier correctness: money, network, and local calendar',()=>{
 it('validates earnings with one strict rule for sorting, offer cards and delivery cards',()=>{
  for(const value of [undefined,null,'','Infinity','NaN','-10','1e100','abc','0,50','22.123',-1,Infinity,NaN])
   expect(verifiedDriverEarning(value)).toBeNull();
  expect(verifiedDriverEarning('0')).toBe(0);
  expect(verifiedDriverEarning('32.00')).toBe(32);
  expect(verifiedDriverEarning(24.5)).toBe(24.5);
  expect(verifiedDriverEarning('00020')).toBeNull();
  expect(sortDriverOffers([make(1,'Infinity'),make(2,'32.00'),make(3,'-90')],'earnings',[],null).map(x=>x.id))
   .toEqual([2,1,3]);
  expect(workflow).toContain('verifiedDriverEarning(o.driver_earning??details?.earning)');
  expect(workflow).toContain("earning===null?'Ganancia pendiente':pesos(earning)");
  expect(map).toContain('const selectedEarning=verifiedDriverEarning(selected?.driver_earning)');
  expect(map).toContain("selectedEarning!==null?pesos(selectedEarning):'Por confirmar'");
  expect(map).toContain("verifiedDriverEarning(o.driver_earning)!==null?pesos(o.driver_earning):'Ver pedido'");
 });
 it('uses the local phone day instead of UTC when marking a weekly earning as today',()=>{
  expect(driverLocalDayKey(new Date(2026,9,31,23,59))).toBe('2026-10-31');
  expect(driverLocalDayKey(new Date(2026,10,1,0,1))).toBe('2026-11-01');
  expect(workflow).toContain("selectedEarningDay?.date===driverLocalDayKey()?'Hoy'");
  expect(workflow).not.toContain('new Date().toISOString().slice(0,10)');
 });
 it('limits overlapping scheduled background GETs without disabling priority manual or post-write refresh',()=>{
  expect(workflow).toContain('const pollingRefreshInFlight=useRef(false)');
  expect(workflow).toContain("if(document.visibilityState==='visible'&&!inFlight.current&&!pollingRefreshInFlight.current)");
  expect(workflow).toContain('pollingRefreshInFlight.current=true;');
  expect(workflow).toContain('void refresh().finally(()=>{pollingRefreshInFlight.current=false;});');
  expect(workflow).toContain("if(busy||refreshing)return;");
  expect(workflow).toContain('try{await refresh();}finally{if(mounted.current)setRefreshing(false);}');
  expect(workflow).toContain('const version=++refreshVersion.current;');
  expect(workflow).toContain('if(!mounted.current||version!==refreshVersion.current)return;');
  expect(workflow).toContain("if(mounted.current)await refresh();");
 });
 it('recovers from isolated tile failures without suppressing other map startup errors',()=>{
  expect(map).toContain("tileLayer.on('tileerror',()=>setMapError(");
  expect(map).toContain("tileLayer.on('tileload',()=>setMapError(old=>old.startsWith('No se pudieron cargar algunas calles.')?'':old))");
  expect(map).toContain("setMapError('El mapa no se pudo iniciar. Usa las tarjetas para elegir un pedido.')");
  expect(map).toContain('navigator.geolocation.watchPosition(');
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('api.driverReject(');
 });
 it('preserves server authorisation, account isolation, active PIN and wallet security',()=>{
  expect(workflow).toContain("return <DriverPwaWorkflowSession key={session.user?.id??'signed-out'}/>");
  expect(workflow).toContain("const actions=driverActionsAvailable(readiness,actionOptIn)");
  expect(workflow).toContain('disabled={operationsBlocked||!canProgress||!canSubmitDelivery(active,');
  expect(workflow).toContain('api.driverComplete(order.id');
  expect(workflow).not.toContain('STRIPE_SECRET_KEY');
  expect(map).not.toContain('fakeOrders');
 });
});
