import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Order,Restaurant} from '../src/lib/types';
import type {MerchantApplication} from '../src/lib/api';
import {
 latestRestaurantApplication,merchantConnectSteps,canOwnerPrepare,
 canHandoffPickup,nextMerchantState
} from '../src/lib/restaurant-state';
const restaurant:Restaurant={id:1,name:'Restaurante piloto',is_open:true,pickup_enabled:true,
 verification_status:'verified',menu_items:[]};
const order:Order={id:1,restaurant_id:1,status:'received',order_type:'pickup',
 payment_method:'cash',payment_status:'pending',total:'115.00',
 created_at:'2026-10-26T16:00:00Z',items:[]};
describe('Tala Eats Restaurante: activación y pickup LIVE',()=>{
 it('restaurant activation requires actual Connect consent and Stripe capabilities',()=>{
  const missing=merchantConnectSteps(restaurant,{owner_approved:false,
   transfers_active:true,payouts_enabled:true,details_submitted:true});
  expect(missing.map(x=>x.complete)).toEqual([true,true,true,false,false]);
  const approved=merchantConnectSteps(restaurant,{owner_approved:true,
   transfers_active:true,payouts_enabled:true,details_submitted:true});
  expect(approved.every(x=>x.complete)).toBe(true);
  expect(merchantConnectSteps(restaurant,null)[2].complete).toBe(false);
  expect(merchantConnectSteps({...restaurant,verification_status:'pending'},null)[0].complete).toBe(false);
 });
 it('new merchant orders progress only with server-backed payment',()=>{
  expect(nextMerchantState(order)).toBe('confirmed');
  expect(nextMerchantState({...order,status:'confirmed'})).toBe('preparing');
  expect(nextMerchantState({...order,status:'preparing'})).toBe('ready');
  expect(nextMerchantState({...order,status:'ready'})).toBe(null);
  expect(canOwnerPrepare({...order,payment_method:'stripe',payment_status:'pending'})).toBe(false);
  expect(nextMerchantState({...order,payment_method:'stripe',payment_status:'pending'})).toBe(null);
  expect(nextMerchantState({...order,payment_method:'stripe',payment_status:'paid'})).toBe('confirmed');
 });
 it('pickup PIN + cash acknowledgment strictly gates handoff; card must be paid',()=>{
  const cash={...order,status:'ready'};
  expect(canHandoffPickup(cash,'1234',false)).toBe(false);
  expect(canHandoffPickup(cash,'1234',true)).toBe(true);
  expect(canHandoffPickup(cash,'123',true)).toBe(false);
  expect(canHandoffPickup(cash,'0000',true)).toBe(true);
  expect(canHandoffPickup(cash,'12345',true)).toBe(false);
  expect(canHandoffPickup({...cash,payment_method:'stripe',payment_status:'pending'},'1234',true)).toBe(false);
  expect(canHandoffPickup({...cash,payment_method:'stripe',payment_status:'paid'},'1234',false)).toBe(true);
  expect(canHandoffPickup({...cash,order_type:'delivery'},'1234',true)).toBe(false);
 });
 it('latest application filters driver and does not fabricate approval',()=>{
  const items=[
   {id:1,entity_type:'restaurant',status:'pending',updated_at:'2026-10-25T10:00:00Z'},
   {id:2,entity_type:'driver',status:'approved',updated_at:'2026-10-26T12:00:00Z'},
   {id:3,entity_type:'restaurant',status:'needs_info',updated_at:'2026-10-26T12:00:00Z'},
  ] as MerchantApplication[];
  expect(latestRestaurantApplication(items)?.id).toBe(3);
  expect(latestRestaurantApplication([])).toBeNull();
 });
 it('real backend activation and merchant money routes are explicitly connected',()=>{
  const api=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const view=readFileSync(new URL('../src/components/RestaurantApp.tsx',import.meta.url),'utf8');
  for(const path of ['/onboarding/mine','/onboarding','/admin/onboarding','/owner/finance',
   '/owner/restaurant','/owner/orders','/owner/finance/connect/',
   '/owner/orders/','/owner/menu'])
   expect(api).toContain(path);
  for(const route of ['/restaurante/acceso','/restaurante/alta','/restaurante',
   '/admin/solicitudes-restaurantes'])expect(app).toContain(route);
  expect(view).toContain('const poll=window.setInterval');
  expect(view).toContain('api.ownerCompletePickup');
  expect(view).toContain('api.adminReviewRestaurantApplication');
  expect(view).toContain('api.restaurantOnboardingSubmit');
  expect(view).not.toContain('stripe.paymentIntents.create');
 });
});
