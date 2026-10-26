import {describe,it,expect} from 'vitest';
import { extractServerPricing, referenceBreakdown } from '../src/lib/checkout-preview';
import type { PaymentOptions } from '../src/lib/types';
const options:PaymentOptions={
 methods:[{id:'cash',enabled:true}],
 pickup_checkout_supported:true,pickup_quote_supported:true,
 delivery_checkout_supported:false,delivery_quote_supported:false,delivery_cash_supported:false,
 commercial_pricing_version:'1.5.2',service_fee_rate:'0.07',delivery_base_fee:'39.00'
};
describe('Flutter pricing reference is not a charge or payable quote',()=>{
 it('shows full server-policy breakdown for a pickup even before a quote',()=>{
  expect(referenceBreakdown(260,options,false,'0',false)).toMatchObject({
   subtotal:260,serviceFee:18.2,deliveryBase:0,tip:0,total:278.2,rateLabel:'Tarifa de servicio (7%)'
  });
 });
 it('shows delivery base 39, tip and warning while DELIVERY IS BLOCKED',()=>{
  const r=referenceBreakdown(260,options,true,'20',false);
  expect(r.total).toBe(337.2);
  expect(r.deliveryBase).toBe(39);
  expect(r.note).toContain('BASE');
  expect(options.delivery_checkout_supported).toBe(false);
 });
 it('does not invent money when the server has no verified policy',()=>{
  expect(extractServerPricing({methods:options.methods})).toBeNull();
  const r=referenceBreakdown(260,{methods:options.methods},true,'0',false);
  expect(r.serviceFee).toBeNull();
  expect(r.deliveryBase).toBeNull();
  expect(r.total).toBeNull();
 });
 it('rejects malformed versions and accepts capped 1.6.2 policy',()=>{
  expect(extractServerPricing({...options,commercial_pricing_version:'bogus'})).toBeNull();
  const newer={...options,commercial_pricing_version:'1.6.2',service_fee_cap:'10',delivery_included_km:'2',delivery_additional_per_km:'5'};
  expect(referenceBreakdown(260,newer,true,'0',false).total).toBe(309);
 });
 it('does not pretend a coupon discount has been applied',()=>{
  const r=referenceBreakdown(260,options,true,'0',true);
  expect(r.total).toBe(317.2);
  expect(r.note).toContain('antes de cupones');
 });
});
