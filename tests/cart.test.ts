import {describe,it,expect} from 'vitest';
import {EMPTY_CART,addItem,updateQuantity,basketTotal,lineItems,restoreCustomerCart} from '../src/lib/cart';
import type {MenuItem} from '../src/lib/types';
const product=(id:number,rid=1,stock=5):MenuItem=>({id,restaurant_id:rid,name:'Tacos',price:'25.50',is_available:true,stock});
describe('Carrito comercial - contratos sin dinero real',()=>{
 it('agrega únicamente mercancía disponible y respeta stock',()=>{
  let cart=EMPTY_CART; for(let i=0;i<10;i++)cart=addItem(cart,product(5));
  expect(cart.entries[0]?.quantity).toBe(5);
  expect(basketTotal(cart)).toBe(127.5);
 });
 it('no mezcla productos de tiendas diferentes',()=>{
  let cart=addItem(EMPTY_CART,product(1));cart=addItem(cart,product(2,99));
  expect(cart.restaurantId).toBe(99);expect(cart.entries).toHaveLength(1);
 });
 it('nunca crea pedidos vacíos ni opciones de precio inventadas',()=>{
  const c=updateQuantity(addItem(EMPTY_CART,product(1)),1,-1);
  expect(c.entries).toHaveLength(0);expect(c.restaurantId).toBe(null);
  expect(lineItems(addItem(EMPTY_CART,product(1)))).toEqual([{menu_item_id:1,quantity:1,options:''}]);
 });
 it('restaura el carrito tras iniciar sesión, sin saltarse cuotas ni stock',()=>{
  const productOne=product(101,7,3);
  const raw={restaurantId:7,entries:[{item:productOne,quantity:2,note:'Sin cebolla'}]};
  expect(restoreCustomerCart(raw)).toEqual(raw);
  expect(restoreCustomerCart({...raw,entries:[{item:productOne,quantity:99}]})).toEqual(EMPTY_CART);
  expect(restoreCustomerCart({...raw,entries:[{item:productOne,quantity:2,note:'x'.repeat(201)}]})).toEqual(EMPTY_CART);
  expect(restoreCustomerCart({...raw,entries:[{item:productOne,quantity:2},{item:{...productOne,restaurant_id:9},quantity:1}]})).toEqual(EMPTY_CART);
 });
 it('respeta las restricciones de disponibilidad',()=>{
  expect(addItem(EMPTY_CART,{...product(1),is_available:false})).toEqual(EMPTY_CART);
 });
});
