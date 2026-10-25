import {describe,it,expect} from 'vitest';
import {matchCustomerDishes,matchCustomerRestaurants} from '../src/lib/customer-search';
import type {Restaurant,MenuItem} from '../src/lib/types';
const tacos:MenuItem={id:11,restaurant_id:1,name:'Tacos de BIRRÍA',category:'Birria',price:'35.00',is_available:true,stock:4};
const noStock:MenuItem={...tacos,id:12,name:'Quesadilla',stock:0};
const r:Restaurant={id:1,name:'Antojitos La Terraza',cuisine:'Comida mexicana',is_open:true,market_code:'TALA-JAL',menu_items:[tacos,noStock]};
describe('Flutter Usuarios SearchScreen parity',()=>{
 it('filters commerce, name, category without accent differences',()=>{
  expect(matchCustomerRestaurants([r],'antojitos')).toHaveLength(1);
  expect(matchCustomerRestaurants([r],'mexicana')).toHaveLength(1);
  expect(matchCustomerRestaurants([r],'inexistente')).toHaveLength(0);
 });
 it('finds real available menu items, not out of stock or imaginary foods',()=>{
  expect(matchCustomerDishes([r],'birria').map(hit=>hit.item.id)).toEqual([11]);
  expect(matchCustomerDishes([r],'quesadilla')).toHaveLength(0);
  expect(matchCustomerDishes([r],'')).toHaveLength(0);
 });
 it('does not accidentally leak items belonging to other towns',()=>{
  const same:Restaurant={...r,id:2,market_code:'AMECA-JAL'};
  const filtered=[r,same].filter(item=>item.market_code==='TALA-JAL');
  expect(matchCustomerDishes(filtered,'birria').map(hit=>hit.restaurant.id)).toEqual([1]);
 });
});
