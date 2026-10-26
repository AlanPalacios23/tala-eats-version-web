import type { MenuItem } from './types';
export interface CartEntry { item: MenuItem; quantity: number; note?: string; }
export interface Cart { restaurantId: number|null; entries: CartEntry[]; }
export const EMPTY_CART:Cart={restaurantId:null,entries:[]};
/** The mobile app keeps preferences per cart line and enforces stock limits. */
/**
 * One merchant at a time; a physical item's stock is SHARED by its notes/
 * variations, and no more than 50 total units survive session restoration.
 */
export function remainingForVariant(cart:Cart,item:MenuItem,note=''):number{
 if(!item.is_available||!Number.isSafeInteger(item.stock)||item.stock<1)return 0;
 const entries=cart.restaurantId===item.restaurant_id?cart.entries:[];
 const normalizedNote=note.trim().slice(0,200);
 const current=entries.find(e=>e.item.id===item.id&&(e.note??'')===normalizedNote);
 const otherVariants=entries.filter(e=>e.item.id===item.id&&e!==current)
  .reduce((sum,e)=>sum+e.quantity,0);
 const otherProducts=entries.filter(e=>e.item.id!==item.id)
  .reduce((sum,e)=>sum+e.quantity,0);
 const already=current?.quantity??0;
 const physical=Math.max(0,item.stock-otherVariants-already);
 const remainingCart=Math.max(0,50-otherVariants-otherProducts-already);
 const remainingLine=Math.max(0,50-already);
 return Math.min(physical,remainingCart,remainingLine);
}
export function addVariantItem(cart:Cart,item:MenuItem,desiredQuantity=1,note=''):Cart{
 if(!Number.isSafeInteger(desiredQuantity)||desiredQuantity<1)return cart;
 const available=remainingForVariant(cart,item,note);
 if(available<1)return cart;
 const normalizedNote=note.trim().slice(0,200);
 const sameRestaurant=cart.restaurantId===item.restaurant_id;
 const entries=sameRestaurant?cart.entries:[];
 const old=entries.find(e=>e.item.id===item.id&&(e.note??'')===normalizedNote);
 const quantity=(old?.quantity??0)+Math.min(desiredQuantity,available);
 const updated=old?
  entries.map(e=>e===old?{item,quantity,note:normalizedNote}:e):
  [...entries,{item,quantity,note:normalizedNote}];
 return {restaurantId:item.restaurant_id,entries:updated};
}
export function addItem(cart:Cart,item:MenuItem):Cart{return addVariantItem(cart,item,1,'');}
export function updateQuantity(cart:Cart,itemId:number,delta:number,note?:string):Cart{
 if(!Number.isSafeInteger(delta)||delta===0)return cart;
 // A legacy unqualified item ID must not change multiple preference lines.
 if(note===undefined&&cart.entries.filter(e=>e.item.id===itemId).length!==1)return cart;
 let changed=false;
 const entries=cart.entries.map(e=>{
  if(e.item.id!==itemId||(note!==undefined&&(e.note??'')!==note))return e;
  const otherCount=cart.entries.filter(v=>v!==e).reduce((n,v)=>n+v.quantity,0);
  const otherVariants=cart.entries.filter(v=>v.item.id===itemId&&v!==e).reduce((n,v)=>n+v.quantity,0);
  const upper=Math.max(0,Math.min(50-otherCount,50,e.item.stock-otherVariants));
  const next=Math.max(0,Math.min(upper,e.quantity+delta));
  if(next!==e.quantity)changed=true;
  return {...e,quantity:next};
 }).filter(e=>e.quantity>0);
 if(!changed)return cart;
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
