import {afterEach,describe,expect,it,vi} from 'vitest';
import {api} from '../src/lib/api';
import {EMPTY_CART,addItem} from '../src/lib/cart';
import {buildCheckoutRequest,assertServerQuote} from '../src/lib/customer-checkout';
/**
 * Contract-level UI/API test: synthetic responses, NO Stripe charge and NO
 * real database. Actual 3-role E2E still required on isolated backend.
 */
afterEach(()=>vi.unstubAllGlobals());
describe('RC96 PWA endpoint contract: client -> kitchen -> courier -> PIN',()=>{
 it('uses the existing canonical backend endpoints and never fakes delivery on UI',async()=>{
  const calls:Array<{method:string;path:string;body:Record<string,unknown>}>=[];
  let stage='received';
  const syntheticOrder=(paymentStatus='pending')=>({
   id:101,restaurant_id:7,order_type:'delivery',
   status:stage,payment_method:'cash',payment_status:paymentStatus,
   total:'119.00',driver_earning:'32.00',created_at:new Date().toISOString(),items:[],
  });
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
   const method=init?.method??'GET',path=input.replace('/api/v1','');
   const body=init?.body?JSON.parse(String(init.body)):{} as Record<string,unknown>;
   calls.push({method,path,body});
   const ok=(v:unknown)=>new Response(JSON.stringify(v),{status:200,headers:{'content-type':'application/json'}});
   if(path==='/orders/delivery-quote'&&method==='POST')
    return ok({currency:'MXN',restaurant_id:7,order_type:'delivery',payment_method:'cash',
     inventory_reserved:false,quote_is_binding:false,shipping_is_road_routing:false,
     subtotal:'70.00',service_fee:'7.00',delivery_fee:'42.00',tip:'0',total:'119.00'});
   if(path==='/orders'&&method==='POST'){
    expect(body.order_type).toBe('delivery');
    expect(body.payment_method).toBe('cash');
    expect(body.client_reference).toBe('once-per-checkout');
    return ok(syntheticOrder());
   }
   if(path==='/driver/availability'&&method==='PATCH')return ok({is_online:true,is_verified:true});
   if(path==='/driver/location'&&method==='PATCH')return ok({is_online:true,is_verified:true});
   if(path==='/driver/presence-readiness'&&method==='GET')return ok({
    environment:'staging',presence_enabled:true,admin_verified:true,
    online:true,fresh_gps:true,ready_for_dispatch:true,
    live_delivery_checkout_enabled:false,live_stripe_delivery_enabled:false,
   });
   if(path.startsWith('/owner/orders/101/status')&&method==='PATCH'){
    const next=String(body.status);
    const allowed:Record<string,string>={received:'confirmed',confirmed:'preparing',preparing:'ready'};
    expect(allowed[stage]).toBe(next);stage=next;return ok(syntheticOrder());
   }
   if(path==='/driver/orders/101/accept'&&method==='POST'){
    expect(stage).toBe('ready');stage='assigned';return ok(syntheticOrder());
   }
   if(path==='/driver/orders/101/status'&&method==='PATCH'){
    const allowed:Record<string,string>={assigned:'picked_up',picked_up:'on_the_way'};
    expect(allowed[stage]).toBe(body.status);stage=String(body.status);return ok(syntheticOrder());
   }
   if(path==='/driver/orders/101/complete'&&method==='POST'){
    expect(stage).toBe('on_the_way');
    expect(body.pin).toBe('1234');stage='delivered';return ok(syntheticOrder('paid'));
   }
   if(path==='/v11/orders/101/live'&&method==='GET')return ok({order:syntheticOrder(stage==='delivered'?'paid':'pending')});
   return new Response(JSON.stringify({error:'UNHANDLED_CONTRACT'}),{status:404});
  }));
  const cart=addItem(EMPTY_CART,{id:66,restaurant_id:7,name:'Tacos',price:'35.00',stock:10,is_available:true});
  const payload=buildCheckoutRequest(cart,'delivery','','0',{
   id:3,label:'Casa',address:'Tala Centro',lat:20.65,lng:-103.7,is_default:true,
  });
  const quote=assertServerQuote(await api.checkoutQuote(payload),payload);
  expect(quote.total).toBe('119.00');
  const order=await api.createCheckoutOrder(payload,'once-per-checkout','Sin cebolla','Tala Centro');
  expect(order.status).toBe('received');
  expect((await api.liveOrder(101)).order.status).toBe('received');
  for(const next of ['confirmed','preparing','ready'] as const)
   expect((await api.ownerUpdateStatus(101,next)).status).toBe(next);
  await api.driverSetAvailability(true);
  await api.driverLocation(20.65,-103.7);
  expect((await api.driverPresenceReadiness()).fresh_gps).toBe(true);
  expect((await api.driverAccept(101)).status).toBe('assigned');
  expect((await api.driverStatus(101,'picked_up')).status).toBe('picked_up');
  expect((await api.driverStatus(101,'on_the_way')).status).toBe('on_the_way');
  expect((await api.driverComplete(101,'1234')).status).toBe('delivered');
  expect((await api.liveOrder(101)).order.payment_status).toBe('paid');
  expect(calls.filter(x=>x.path==='/orders'&&x.method==='POST')).toHaveLength(1);
  expect(calls.some(x=>x.path.includes('payment-intent'))).toBe(false);
 });
});
