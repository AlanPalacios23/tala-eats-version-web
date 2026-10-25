import {describe,expect,it} from 'vitest';
import {EMPTY_CART,addVariantItem} from '../src/lib/cart';
import {assertServerQuote,buildCheckoutRequest,checkoutAllowed,fingerprint,quoteMateriallyChanged,validAddress,validateCartAgainstRestaurant} from '../src/lib/customer-checkout';
import type {CustomerAddress,VerifiedQuote} from '../src/lib/customer-checkout';
import type {MenuItem,PaymentOptions,Quote,Restaurant} from '../src/lib/types';
const item:MenuItem={id:6,restaurant_id:2,name:'Tacos',price:'45.00',stock:3,is_available:true};
const cart=addVariantItem(EMPTY_CART,item,2,'Sin cebolla');
const address:CustomerAddress={id:4,label:'Casa',address:'Centro 123, Tala',lat:20.65,lng:-103.7,is_default:true};
const methods:PaymentOptions={methods:[{id:'cash',enabled:true},{id:'stripe',enabled:true}],pickup_checkout_supported:true,pickup_quote_supported:true,delivery_checkout_supported:true,delivery_quote_supported:true,delivery_cash_supported:true};
const validQuote=(req:ReturnType<typeof buildCheckoutRequest>):Quote=>({
 currency:'MXN',restaurant_id:2,order_type:req.order_type,payment_method:'cash',
 inventory_reserved:false,quote_is_binding:false,shipping_is_road_routing:false,
 total:'112.00',subtotal:'90.00',service_fee:'7.00',delivery_fee:'15.00',tip:req.tip,distance_km:'2.10'
});
const merchant:Restaurant={id:2,name:'Antojitos',is_open:true,pickup_enabled:true,menu_items:[item]};
describe('Mobile 1.0.46 checkout security parity',()=>{
 it('fails closed for undeclared delivery capabilities and unsupported Stripe Web',()=>{
  expect(checkoutAllowed(methods,'delivery','cash')).toBe(true);
  expect(checkoutAllowed({...methods,delivery_quote_supported:undefined},'delivery','cash')).toBe(false);
  expect(checkoutAllowed({...methods,delivery_cash_supported:false},'delivery','cash')).toBe(false);
  expect(checkoutAllowed({...methods,delivery_checkout_supported:false},'delivery','cash')).toBe(false);
  expect(checkoutAllowed({...methods,pickup_quote_supported:false},'pickup','cash')).toBe(false);
  expect(checkoutAllowed(methods,'delivery','stripe')).toBe(false);
  expect(checkoutAllowed(null,'pickup','cash')).toBe(false);
 });
 it('will never send delivery without server-validated coordinates',()=>{
  expect(validAddress(address)).toBe(true);
  expect(validAddress({...address,lat:null})).toBe(false);
  expect(validAddress({...address,lat:200})).toBe(false);
  expect(()=>buildCheckoutRequest(cart,'delivery','', '0', {...address,lat:null})).toThrow(/coordenadas/);
 });
 it('keeps notes, coupon, coordinates and tip in request fingerprint',()=>{
  const req=buildCheckoutRequest(cart,'delivery','PROMO','20.00',address);
  expect(req.items).toEqual([{menu_item_id:6,quantity:2,options:'Sin cebolla'}]);
  expect(req.delivery_lat).toBe(address.lat);
  expect(req.coupon_code).toBe('PROMO');
  expect(req.tip).toBe('20.00');
  expect(fingerprint({...req,tip:'0'})).not.toBe(fingerprint(req));
  expect(buildCheckoutRequest(cart,'pickup','','20.00').tip).toBe('0');
 });
 it('rejects unbound or mismatched quotes, and checks all amounts',()=>{
  const req=buildCheckoutRequest(cart,'delivery','','0',address);
  expect(assertServerQuote(validQuote(req),req).total).toBe('112.00');
  for(const change of [{currency:'USD'},{inventory_reserved:true},{quote_is_binding:true},{order_type:'pickup'},{restaurant_id:3},{delivery_fee:'-1'},{shipping_is_road_routing:true}]){
   expect(()=>assertServerQuote({...validQuote(req),...change},req)).toThrow();
  }
 });
 it('requires deliberate second confirmation when any quote amount or distance changes',()=>{
  const req=buildCheckoutRequest(cart,'delivery','','0',address);
  const old=assertServerQuote(validQuote(req),req);
  expect(quoteMateriallyChanged(old,{...old,total:'113.00'} as VerifiedQuote)).toBe(true);
  expect(quoteMateriallyChanged(old,{...old,distance_km:'3.1'} as VerifiedQuote)).toBe(true);
  expect(quoteMateriallyChanged(old,{...old,total:112} as VerifiedQuote)).toBe(false);
 });
 it('sums all preference variants for stock and rejects stale prices',()=>{
  validateCartAgainstRestaurant(cart,merchant);
  const more=addVariantItem(cart,item,1,'Extra salsa');
  validateCartAgainstRestaurant(more,merchant);
  expect(()=>validateCartAgainstRestaurant(more,{...merchant,menu_items:[{...item,stock:2}]})).toThrow(/inventario/);
  expect(()=>validateCartAgainstRestaurant(cart,{...merchant,menu_items:[{...item,price:'55.00'}]})).toThrow(/precio/);
 });
});
