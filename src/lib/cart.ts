import type { MenuItem } from './types';
export interface CartEntry { item: MenuItem; quantity: number; note?: string; }
export interface Cart { restaurantId: number|null; entries: CartEntry[]; }
export const EMPTY_CART:Cart={restaurantId:null,entries:[]};
/** The mobile app keeps preferences per cart line and enforces stock limits. */
export function addVariantItem(cart:Cart,item:MenuItem,desiredQuantity=1,note=''):Cart {
 if(!item.is_available||item.stock<1||!Number.isSafeInteger(desiredQuantity)||desiredQuantity<1)return cart;
 const normalizedNote=note.trim().slice(0,200);
 const sameRestaurant=cart.restaurantId===item.restaurant_id;
 const entries=sameRestaurant?cart.entries:[];
 const old=entries.find(x=>x.item.id===item.id && (x.note??'')===normalizedNote);
 const allocatedToOtherVariants=entries.filter(e=>e.item.id===item.id&&e!==old).reduce((total,e)=>total+e.quantity,0);
 const freeForThisLine=Math.max(0,item.stock-allocatedToOtherVariants);
 const quantity=Math.min(freeForThisLine,Math.min(50,(old?.quantity??0)+desiredQuantity));
 if(quantity<1)return cart;
 const changed=old?
  entries.map(x=>x===old?{item,quantity,note:normalizedNote}:x):
  [...entries,{item,quantity,note:normalizedNote}];
 return {restaurantId:item.restaurant_id,entries:changed};
}
export function addItem(cart:Cart,item:MenuItem):Cart {return addVariantItem(cart,item,1,'');}
/** Option-aware quantity updates. Legacy IDs continue to work for unambiguous lines. */
export function updateQuantity(cart:Cart,itemId:number,delta:number,note?:string):Cart {
 const entries=cart.entries.map(e=>{
  if(e.item.id!==itemId||(note!==undefined&&(e.note??'')!==note))return e;
  const others=cart.entries.filter(v=>v.item.id===itemId&&v!==e).reduce((n,v)=>n+v.quantity,0);
  return {...e,quantity:Math.min(50,Math.min(Math.max(0,e.item.stock-others),e.quantity+delta))};
 }).filter(e=>e.quantity>0);
 return entries.length?{...cart,entries}:EMPTY_CART;
}
export function lineItems(cart:Cart) {
 return cart.entries.map(e=>({menu_item_id:e.item.id,quantity:e.quantity,options:e.note??''}));
}
export function basketTotal(cart:Cart):number {return cart.entries.reduce((sum,e)=>sum+e.quantity*Number(e.item.price),0);}
