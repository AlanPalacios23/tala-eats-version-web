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


/** Public catalog-only cart snapshot; no payment credentials, tokens or PII.
 * Server stock and price are ALWAYS re-quoted at checkout after restoration.
 */
export function restoreCustomerCart(raw:unknown):Cart{
 if(!raw||typeof raw!=='object')return EMPTY_CART;
 const value=raw as Record<string,unknown>;
 const id=value.restaurantId;
 if(typeof id!=='number'||!Number.isSafeInteger(id)||id<=0||!Array.isArray(value.entries)||value.entries.length>50)return EMPTY_CART;
 const entries:CartEntry[]=[];
 let total=0;
 for(const entry of value.entries){
  if(!entry||typeof entry!=='object')return EMPTY_CART;
  const e=entry as Record<string,unknown>,item=e.item as MenuItem|undefined;
  if(!item||typeof item!=='object'||!Number.isSafeInteger(item.id)||item.id<=0||item.restaurant_id!==id||
   typeof item.name!=='string'||item.name.length>240||!Number.isFinite(Number(item.price))||Number(item.price)<0||
   Number(item.price)>1000000||!Number.isSafeInteger(item.stock)||item.stock<0||
   typeof item.is_available!=='boolean'||!Number.isSafeInteger(e.quantity)||Number(e.quantity)<1||Number(e.quantity)>50||
   (e.note!==undefined&&(typeof e.note!=='string'||e.note.length>200)))return EMPTY_CART;
  const quantity=Math.min(e.quantity as number,item.stock);
  if(quantity<1||!item.is_available)return EMPTY_CART;
  total+=quantity;
  if(total>50)return EMPTY_CART;
  entries.push({item,quantity,note:typeof e.note==='string'?e.note:''});
 }
 return entries.length?{restaurantId:id,entries}:EMPTY_CART;
}
export const CUSTOMER_CART_STORAGE_KEY='talaeats-customer-cart-v1';
