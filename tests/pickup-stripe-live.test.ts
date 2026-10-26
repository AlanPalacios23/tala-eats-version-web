import {describe,it,expect} from 'vitest';
import {requireStripeIntent,stripePaymentMode,stripePaymentAllowed} from '../src/lib/stripe-test';
import type {StripeTestConfig,StripeIntentReply} from '../src/lib/stripe-test';
import type {PaymentOptions} from '../src/lib/types';

const methods:PaymentOptions={
 methods:[{id:'cash',enabled:true,mode:'live-cash-pickup'},
  {id:'stripe',enabled:true,mode:'live-stripe-pickup'}],
 pickup_quote_supported:true,pickup_checkout_supported:true,
 delivery_checkout_supported:false,delivery_quote_supported:false,
};
const live:StripeTestConfig={
 enabled:true,checkout_ready:true,environment:'production',mode:'live-pickup-only',
 financial_writes_enabled:true,publishable_key:'pk_live_Pilot123ABC'
};
const reply:StripeIntentReply={
 provider:'stripe',mode:'live',order_id:77,payment_intent_id:'pi_Pilot123',
 amount_minor:21400,currency:'mxn',publishable_key:live.publishable_key,
 client_secret:'pi_Pilot123_secret_Value123'
};

describe('Tala Eats pickup: LIVE cash and Stripe UI financial gates',()=>{
 it('only advertises LIVE card in verified production pickup',()=>{
  expect(stripePaymentMode(methods,live,'pickup')).toBe('live');
  expect(stripePaymentMode(methods,live,'delivery')).toBeNull();
  expect(stripePaymentAllowed(methods,{...live,financial_writes_enabled:false},'pickup')).toBe(false);
  expect(stripePaymentMode(methods,{...live,publishable_key:'pk_test_other'},'pickup')).toBeNull();
  expect(stripePaymentMode(methods,{...live,environment:'staging'},'pickup')).toBeNull();
  expect(stripePaymentMode(methods,{...live,mode:'test-pickup-only'},'pickup')).toBeNull();
  expect(stripePaymentMode({...methods,methods:[{id:'stripe',enabled:true,mode:'stage-stripe-test-pickup'}]},live,'pickup')).toBeNull();
  expect(stripePaymentMode({...methods,methods:[{id:'stripe',enabled:false,mode:'live-stripe-pickup'}]},live,'pickup')).toBeNull();
  expect(stripePaymentMode(methods,{...live,checkout_ready:false},'pickup')).toBeNull();
 });
 it('rejects mismatched order, Stripe mode, provider, key, cents and secret',()=>{
  expect(requireStripeIntent(reply,live,{id:77,total:'214.00'},'live')).toBe(reply.client_secret);
  const mutations=[
   {order_id:78},{provider:'other'},{mode:'test' as const},
   {publishable_key:'pk_live_wrong'},{amount_minor:21401},{currency:'usd'},
   {payment_intent_id:'pi_Different'},
   {client_secret:'pi_Different_secret_ABC'},
   {already_paid:true}
  ];
  for(const wrong of mutations)
   expect(()=>requireStripeIntent({...reply,...wrong},live,{id:77,total:'214.00'},'live')).toThrow();
  expect(()=>requireStripeIntent(reply,live,{id:77,total:'214.01'},'live')).toThrow();
  expect(()=>requireStripeIntent(reply,{...live,publishable_key:'pk_test_fake'},{id:77,total:'214.00'},'live')).toThrow();
 });
 it('TEST still cannot be presented as LIVE',()=>{
  const cfg:StripeTestConfig={...live,environment:'staging',mode:'test-pickup-only',
   financial_writes_enabled:false,publishable_key:'pk_test_Demo123'};
  const opts:PaymentOptions={...methods,methods:[
   {id:'cash',enabled:true},{id:'stripe',enabled:true,mode:'stage-stripe-test-pickup'}]};
  expect(stripePaymentMode(opts,cfg,'pickup')).toBe('test');
  expect(stripePaymentMode(opts,cfg,'delivery')).toBeNull();
  expect(()=>requireStripeIntent({...reply,mode:'test',publishable_key:'pk_test_Demo123'},
   cfg,{id:77,total:'214.00'},'live')).toThrow();
 });
});
