import type { MenuItem } from './types';
export interface CartEntry { item: MenuItem; quantity: number; }
export interface Cart { restaurantId: number|null; entries: CartEntry[]; }
export const EMPTY_CART:Cart={restaurantId:null,entries:[]};
export function addItem(cart:Cart,item:MenuItem):Cart {
 if(!item.is_available||item.stock<1)return cart;
 const same = cart.restaurantId===item.restaurant_id;
 const entries = same?cart.entries:[];
 const old=entries.find(x=>x.item.id===item.id);
 const quantity=Math.min(item.stock,Math.min(50,(old?.quantity??0)+1));
 return {restaurantId:item.restaurant_id,entries:old?
  entries.map(x=>x.item.id===item.id?{item,quantity}:x):[...entries,{item,quantity}]};
}
export function updateQuantity(cart:Cart,itemId:number,delta:number):Cart {
 const entries=cart.entries.map(e=>e.item.id!==itemId?e:{...e,quantity:Math.min(50,Math.min(e.item.stock,e.quantity+delta))}).filter(e=>e.quantity>0);
 return entries.length?{...cart,entries}:EMPTY_CART;
}
export function lineItems(cart:Cart) {
 return cart.entries.map(e=>({menu_item_id:e.item.id,quantity:e.quantity,options:'' as const}));
}
export function basketTotal(cart:Cart):number { return cart.entries.reduce((sum,e)=>sum+e.quantity*Number(e.item.price),0); }
