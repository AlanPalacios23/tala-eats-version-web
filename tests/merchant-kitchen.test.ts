import {describe,it,expect} from 'vitest';
import type {Order} from '../src/lib/types';
import {kitchenOrders,minutesSinceOrder,orderElapsedLabel,kitchenOrderTypeLabel} from '../src/lib/merchant-kitchen';
const order=(id:number,status:string,date='2026-10-27T08:00:00Z',type='pickup')=>
 ({id,status,created_at:date,order_type:type} as Order);
describe('Merchant operations KDS: order priority and truthful timing',()=>{
 it('sorts active commands oldest first without mutating server response',()=>{
  const source=[order(8,'received','2026-10-27T09:00:00Z'),order(2,'preparing','2026-10-27T07:00:00Z'),order(1,'delivered','2026-10-27T05:00:00Z')];
  expect(kitchenOrders(source).map(o=>o.id)).toEqual([2,8]);
  expect(source.map(o=>o.id)).toEqual([8,2,1]);
 });
 it('separates pickup and delivery but never hides unknown payment status behind a fake delivery state',()=>{
  const source=[order(2,'ready',undefined,'delivery'),order(3,'confirmed',undefined,'pickup'),order(4,'received',undefined,'other')];
  expect(kitchenOrders(source,'pickup').map(o=>o.id)).toEqual([3]);
  expect(kitchenOrders(source,'delivery').map(o=>o.id)).toEqual([2]);
  expect(kitchenOrderTypeLabel('other')).toBe('Modalidad sin confirmar');
 });
 it('shows elapsed time from backend-created timestamps rather than assumed ETA',()=>{
  const now=Date.parse('2026-10-27T09:05:00Z');
  expect(minutesSinceOrder('2026-10-27T08:00:00Z',now)).toBe(65);
  expect(orderElapsedLabel('2026-10-27T08:00:00Z',now)).toBe('Hace 1 h 5 min');
  expect(orderElapsedLabel('2026-10-27T09:05:00Z',now)).toBe('Hace menos de 1 min');
  expect(minutesSinceOrder('2026-10-27T10:00:00Z',now)).toBe(0);
 });
 it('marks missing or malformed times as unconfirmed instead of inventing a time',()=>{
  expect(minutesSinceOrder('invalid',0)).toBeNull();
  expect(orderElapsedLabel('invalid',0)).toBe('Hora sin confirmar');
 });
});