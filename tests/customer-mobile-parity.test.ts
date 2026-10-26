import { describe, expect, it } from 'vitest';
import { EMPTY_CART, addVariantItem, basketTotal, lineItems, updateQuantity } from '../src/lib/cart';
import { isCompletedOrder, orderProgress } from '../src/lib/mobile-parity';
import type { MenuItem } from '../src/lib/types';
const item:MenuItem={id:7,restaurant_id:12,name:'Tacos',price:'40.00',stock:3,is_available:true};
describe('Mobile Usuarios 1.0.46 cart parity',()=>{
 it('preserves preference and quantity through quote/order payload',()=>{
  const cart=addVariantItem(EMPTY_CART,item,2,'Sin cebolla');
  expect(lineItems(cart)).toEqual([{menu_item_id:7,quantity:2,options:'Sin cebolla'}]);
  expect(basketTotal(cart)).toBe(80);
 });
 it('keeps variants separate but enforces total physical stock',()=>{
  const a=addVariantItem(EMPTY_CART,item,2,'Sin cebolla');
  const b=addVariantItem(a,item,3,'Extra salsa');
  expect(b.entries).toHaveLength(2);
  expect(b.entries[1].quantity).toBe(1);
  const c=updateQuantity(b,7,4,'Sin cebolla');
  expect(c.entries[0].quantity+c.entries[1].quantity).toBe(3);
  expect(updateQuantity(c,7,-2,'Extra salsa').entries).toHaveLength(1);
 });
 it('does not add unavailable or oversold products',()=>{
  expect(addVariantItem(EMPTY_CART,{...item,is_available:false},1)).toEqual(EMPTY_CART);
  expect(addVariantItem(EMPTY_CART,item,0)).toEqual(EMPTY_CART);
 });
});
describe('Flutter order state mapping',()=>{
 it('uses correct pickup timeline',()=>{expect(orderProgress('ready','pickup').steps[3].label).toBe('Listo para recoger');expect(orderProgress('delivered','pickup').index).toBe(4);});
 it('uses delivery dispatched timeline',()=>{expect(orderProgress('assigned','delivery').index).toBe(3);expect(orderProgress('on_the_way','delivery').index).toBe(4);});
 it('keeps received/preparing active and delivered/cancelled in history',()=>{expect(isCompletedOrder('received')).toBe(false);expect(isCompletedOrder('preparing')).toBe(false);expect(isCompletedOrder('delivered')).toBe(true);expect(isCompletedOrder('cancelled')).toBe(true);});
});
