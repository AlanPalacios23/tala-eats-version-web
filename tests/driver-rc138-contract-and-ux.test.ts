import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 canSubmitDelivery,cashCollectionRequired,driverDeliveredOrders,
 isDeliveryPinReady,safeDriverMapLink,sanitizeDeliveryPin,trustedActiveDriverDetail,
} from '../src/lib/driver-delivery-ui';
import type {Order} from '../src/lib/types';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const order=(overrides:Partial<Order>={}):Order=>({
 id:43,restaurant_id:7,status:'on_the_way',order_type:'delivery',
 payment_method:'cash',payment_status:'pending',total:'254.00',
 created_at:'2026-10-29T00:00:00Z',items:[],...overrides,
});
describe('RC138 Repartidores · mobile-safe operational contract',()=>{
 it('filters non-digits without ever storing more than four PIN digits',()=>{
  expect(sanitizeDeliveryPin('98a 0-12')).toBe('9801');
  expect(sanitizeDeliveryPin('123456')).toBe('1234');
  expect(sanitizeDeliveryPin('')).toBe('');
  expect(isDeliveryPinReady('0000')).toBe(true);
  expect(isDeliveryPinReady('12a4')).toBe(false);
  expect(isDeliveryPinReady('12345')).toBe(false);
 });
 it('blocks cash delivery completion without explicit physical collection acknowledgment',()=>{
  const cash=order();
  expect(cashCollectionRequired(cash)).toBe(true);
  expect(canSubmitDelivery(cash,'1234',false)).toBe(false);
  expect(canSubmitDelivery(cash,'1234',true)).toBe(true);
  expect(canSubmitDelivery(cash,'12',true)).toBe(false);
  expect(canSubmitDelivery({...cash,status:'assigned'},'1234',true)).toBe(false);
  const stripe=order({payment_method:'stripe'});
  expect(cashCollectionRequired(stripe)).toBe(false);
  expect(canSubmitDelivery(stripe,'1234',false)).toBe(true);
 });
 it('shows only canonical owner-scoped order history, not different dashboard.recent payload',()=>{
  const mine=[order({status:'assigned'}),order({id:44,status:'delivered'}),
   order({id:45,status:'delivered'}),order({id:46,status:'cancelled'})];
  expect(driverDeliveredOrders(mine).map(x=>x.id)).toEqual([44,45]);
  const app=read('../src/components/DriverPwaWorkflow.tsx');
  expect(app).toContain('driverDeliveredOrders(mine)');
  expect(app).not.toContain('dashboard?.recent?.filter');
  expect(app).toContain('data.user?.id!==session.user?.id');
 });
 it('only uses active route details from the SAME order and restaurant',()=>{
  const detailed={user:{id:5},active:{id:43,restaurant:{id:7,name:'Negocio',address:'Tala, Jal.'},customer:{address:'Centro, Tala'}}};
  expect(trustedActiveDriverDetail(detailed,order())?.restaurant?.name).toBe('Negocio');
  expect(trustedActiveDriverDetail(detailed,order({id:12}))).toBe(null);
  expect(trustedActiveDriverDetail({...detailed,active:{...detailed.active,restaurant:{id:8,name:'Ajeno'}}},order())).toBe(null);
  expect(trustedActiveDriverDetail(null,order())).toBe(null);
 });
 it('creates safe user-initiated map links, no implicit tracking or pre-acceptance destination',()=>{
  const href=safeDriverMapLink('Centro, Tala, Jalisco');
  expect(href).toContain('https://www.google.com/maps/search/?api=1&query=');
  expect(decodeURIComponent(href!.split('query=')[1]!)).toBe('Centro, Tala, Jalisco');
  expect(safeDriverMapLink('')).toBe(null);
  expect(safeDriverMapLink('x'.repeat(400))).toBe(null);
  expect(safeDriverMapLink('bad\u0001address')).toBe(null);
  const app=read('../src/components/DriverPwaWorkflow.tsx');
  expect(app).toContain('const customerAddress=!offer?');
  expect(app).toContain('safeDriverMapLink(customerAddress)');
  expect(app).toContain('rel="noopener noreferrer"');
 });
 it('fails closed on loss of backend readiness and keeps financial actions disabled',()=>{
  const app=read('../src/components/DriverPwaWorkflow.tsx');
  expect(app).toContain('setReadiness(null);setAvailable([]);setMine([])');
  expect(app).toContain('No pudimos sincronizar tus entregas');
  expect(app).toContain('cashReceived[active.id]===true');
  expect(app).toContain('sanitizeDeliveryPin(e.target.value)');
  expect(app).toContain('disabled>Configurar cuenta bancaria</button>');
  expect(app).not.toContain('sk_live_');
 });
});
