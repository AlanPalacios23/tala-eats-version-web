import {describe,it,expect} from 'vitest';
import type {Order} from '../src/lib/types';
import {newlyReceivedOrderIds,receivedOrderIds} from '../src/lib/restaurant-alerts';
const order=(id:number,status:string)=>({id,status} as Order);
describe('Restaurant pending order alerts',()=>{
 it('does not beep or notify about existing orders on initial hydration',()=>{
  expect(newlyReceivedOrderIds(null,[order(1,'received'),order(2,'received')])).toEqual([]);
 });
 it('announces only newly arrived received orders',()=>{
  const previous=receivedOrderIds([order(1,'received'),order(5,'preparing')]);
  expect(newlyReceivedOrderIds(previous,[order(1,'received'),order(2,'received'),order(5,'ready')])).toEqual([2]);
 });
 it('does not re-announce paid, ready or preparing orders',()=>{
  const previous=receivedOrderIds([order(1,'received'),order(2,'received')]);
  expect(newlyReceivedOrderIds(previous,[order(1,'confirmed'),order(2,'received'),order(3,'ready')])).toEqual([]);
 });
 it('tracks latest received set instead of retaining completed orders',()=>{
  const prior=receivedOrderIds([order(1,'received'),order(2,'preparing')]);
  expect([...prior]).toEqual([1]);
  const next=receivedOrderIds([order(3,'received')]);
  expect(newlyReceivedOrderIds(next,[order(3,'received')])).toEqual([]);
 });
});
