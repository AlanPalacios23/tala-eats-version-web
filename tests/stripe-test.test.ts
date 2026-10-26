import {describe,it,expect} from 'vitest';
import {requireTestIntent,stripeTestAllowed} from '../src/lib/stripe-test';
import type {PaymentOptions} from '../src/lib/types';
const methods:PaymentOptions={methods:[{id:'cash',enabled:true},{id:'stripe',enabled:true}],pickup_quote_supported:true,pickup_checkout_supported:true,delivery_checkout_supported:true,delivery_quote_supported:true,delivery_stripe_supported:true};
const config={enabled:true,publishable_key:'pk_test_1234ABCD'};
describe('Stripe TEST Web financial guard',()=>{
 it('requires test publishable key and explicit enabled methods',()=>{
  expect(stripeTestAllowed(methods,config,'pickup')).toBe(true);
  expect(stripeTestAllowed(methods,config,'delivery')).toBe(true);
  expect(stripeTestAllowed(methods,{...config,publishable_key:'pk_live_1234ABCD'},'pickup')).toBe(false);
  expect(stripeTestAllowed(methods,{...config,enabled:false},'pickup')).toBe(false);
  expect(stripeTestAllowed(methods,null,'pickup')).toBe(false);
  expect(stripeTestAllowed({...methods,methods:[{id:'stripe',enabled:false}]},config,'pickup')).toBe(false);
  expect(stripeTestAllowed({...methods,delivery_stripe_supported:false},config,'delivery')).toBe(false);
  expect(stripeTestAllowed({...methods,delivery_quote_supported:false},config,'delivery')).toBe(false);
 });
 it('accepts only matching test intent secrets; cannot use live key or provider change',()=>{
  expect(requireTestIntent({client_secret:'pi_123_secret_ABC'},config.publishable_key)).toBe('pi_123_secret_ABC');
  expect(()=>requireTestIntent({client_secret:'pi_123_secret_ABC'},'pk_live_123')).toThrow();
  expect(()=>requireTestIntent({client_secret:'pi_123_secret_ABC',publishable_key:'pk_test_other'},config.publishable_key)).toThrow();
  expect(()=>requireTestIntent({client_secret:'seti_123_secret_ABC'},config.publishable_key)).toThrow();
  expect(()=>requireTestIntent({payment_status:'paid',already_paid:true},config.publishable_key)).toThrow();
 });
});
