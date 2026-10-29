import {describe,it,expect,vi,afterEach} from 'vitest';
import {stripePaymentMode} from '../src/lib/stripe-test';
import {api} from '../src/lib/api';
import type {PaymentOptions} from '../src/lib/types';
const live={enabled:true,checkout_ready:true,financial_writes_enabled:true,
 environment:'production' as const,mode:'live-pickup-only',
 publishable_key:'pk_live_Pilot123ABC'};
const base:PaymentOptions={methods:[{id:'stripe',enabled:true,mode:'live-stripe-pickup'},
 {id:'cash',enabled:false}],pickup_quote_supported:true,pickup_checkout_supported:true,
 delivery_checkout_supported:false,delivery_quote_supported:false,
 delivery_stripe_supported:false,delivery_cash_supported:false};
afterEach(()=>vi.unstubAllGlobals());
describe('RC12.3 real four-mode PWA checkout hardening',()=>{
 it('LIVE Stripe pickup never implies Stripe home delivery',()=>{
  expect(stripePaymentMode(base,live,'pickup')).toBe('live');
  expect(stripePaymentMode(base,live,'delivery')).toBeNull();
  const released={...base,delivery_checkout_supported:true,
   delivery_quote_supported:true,delivery_stripe_supported:true};
  expect(stripePaymentMode(released,live,'delivery')).toBe('live');
  expect(stripePaymentMode({...released,delivery_stripe_supported:false},live,'delivery')).toBeNull();
  expect(stripePaymentMode(released,{...live,financial_writes_enabled:false},'delivery')).toBeNull();
  expect(stripePaymentMode(released,{...live,publishable_key:'pk_test_wrong'},'delivery')).toBeNull();
 });
 it('client retrieves independent delivery readiness rather than pickup-only readiness',async()=>{
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
   calls.push(input);
   return new Response(JSON.stringify({restaurant_id:8,order_type:'delivery',
    ready:true,cash_enabled:false,stripe_enabled:true,reason:'READY'}),
    {status:200,headers:{'content-type':'application/json'}});
  }));
  const result=await api.deliveryReadiness(8);
  expect(result.order_type).toBe('delivery');
  expect(result.stripe_enabled).toBe(true);
  expect(result.cash_enabled).toBe(false);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/restaurants/8/delivery-readiness');
  expect(calls[0]).not.toContain('/pickup-readiness');
 });
});
