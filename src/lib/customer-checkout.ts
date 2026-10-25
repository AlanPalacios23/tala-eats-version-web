import type { Cart } from './cart';
import type { PaymentOptions, Quote, Restaurant } from './types';
import { amountInCents } from './mobile-parity';

export type FulfillmentMode='pickup'|'delivery';
export type PaymentKind='cash'|'stripe';
export interface CustomerAddress { id:number;label:string;address:string;lat:number|null;lng:number|null;is_default:boolean; }
export interface CheckoutLine {menu_item_id:number;quantity:number;options:string}
export interface CheckoutRequest{
 restaurant_id:number;order_type:FulfillmentMode;payment_method:PaymentKind;items:CheckoutLine[];
 tip:string;coupon_code:string;delivery_lat:number|null;delivery_lng:number|null;
}
export interface VerifiedQuote extends Quote {
 currency:'MXN';restaurant_id:number;order_type:FulfillmentMode;payment_method:PaymentKind;
 inventory_reserved:false;quote_is_binding:false;delivery_fee:string|number;subtotal:string|number;service_fee:string|number;
}
export function validAddress(address:CustomerAddress|undefined|null):address is CustomerAddress & {lat:number;lng:number} {
 return Boolean(address&&Number.isFinite(address.lat)&&Number.isFinite(address.lng)&&
  address.lat!>=-90&&address.lat!<=90&&address.lng!>=-180&&address.lng!<=180);
}
/** Both UI and POST fail-closed when delivery capabilities are absent or false. */
export function checkoutAllowed(options:PaymentOptions|null|undefined,mode:FulfillmentMode,method:PaymentKind):boolean {
 if(!options||!Array.isArray(options.methods)||method!=='cash')return false; // Stripe Web SDK not yet integrated
 const cash=options.methods.some(row=>row.id==='cash'&&row.enabled===true);
 if(!cash)return false;
 if(mode==='pickup')return options.pickup_quote_supported===true&&options.pickup_checkout_supported!==false;
 return options.delivery_cash_supported===true&&options.delivery_checkout_supported===true&&options.delivery_quote_supported===true;
}
export function buildCheckoutRequest(cart:Cart,mode:FulfillmentMode,coupon:string,tip:string,address?:CustomerAddress|null,method:PaymentKind='cash'):CheckoutRequest{
 if(!cart.restaurantId||!cart.entries.length)throw new Error('El carrito está vacío.');
 if(mode==='delivery'&&!validAddress(address))throw new Error('Agrega una dirección con coordenadas válidas.');
 if(!/^[0-9]{1,6}([.][0-9]{1,2})?$/.test(tip))throw new Error('La propina no es válida.');
 return {
  restaurant_id:cart.restaurantId,order_type:mode,payment_method:method,
  items:cart.entries.map(e=>({menu_item_id:e.item.id,quantity:e.quantity,options:e.note??''})),
  tip:mode==='pickup'?'0':tip,coupon_code:coupon.trim(),
  delivery_lat:mode==='delivery'?address!.lat:null,delivery_lng:mode==='delivery'?address!.lng:null
 };
}
export function assertServerQuote(raw:Quote,request:CheckoutRequest):VerifiedQuote {
 const q=raw as VerifiedQuote;
 if(!q||q.currency!=='MXN'||q.restaurant_id!==request.restaurant_id||
  q.order_type!==request.order_type||q.payment_method!==request.payment_method||
  q.inventory_reserved!==false||q.quote_is_binding!==false||
  (request.order_type==='delivery'&&q.shipping_is_road_routing!==false))
  throw new Error('La cotización del servidor no coincide con el pedido.');
 for(const key of ['total','subtotal','service_fee','delivery_fee'] as const) {
  const cents=amountInCents(q[key]);
  if(cents===null||(key==='total'?cents<=0:cents<0))throw new Error('La cotización contiene importes inválidos.');
 }
 return q;
}
/** Compare all material amounts and calculated straight-line distance before any write. */
export function quoteMateriallyChanged(previous:VerifiedQuote,fresh:VerifiedQuote):boolean{
 const amountKeys=['total','subtotal','service_fee','delivery_fee','tip'] as const;
 if(amountKeys.some(k=>{
  const old=previous[k],current=fresh[k];
  if(old===undefined&&current===undefined)return false;
  return amountInCents(old)!==amountInCents(current);
 }))return true;
 return String(previous.distance_km??'')!==String(fresh.distance_km??'');
}
export function fingerprint(request:CheckoutRequest):string{return JSON.stringify(request);}
export function validateCartAgainstRestaurant(cart:Cart,restaurant:Restaurant):void{
 if(!restaurant.is_open)throw new Error('Este comercio dejó de aceptar pedidos.');
 const totals=new Map<number,number>();
 for(const entry of cart.entries){
  if(entry.item.restaurant_id!==restaurant.id)throw new Error('El carrito contiene productos de otro comercio.');
  totals.set(entry.item.id,(totals.get(entry.item.id)??0)+entry.quantity);
 }
 for(const [id,qty] of totals){
  const current=restaurant.menu_items?.find(p=>p.id===id);
  const original=cart.entries.find(e=>e.item.id===id)?.item;
  if(!current||!original||!current.is_available||qty>current.stock||qty<=0||
   amountInCents(current.price)!==amountInCents(original.price))
   throw new Error('El precio o inventario cambió. Vuelve al menú y revisa tu pedido.');
 }
}

/** Mobile _asNullableDouble parity: JSON coordinates may arrive as decimal strings. */
export function parseCoordinate(value:unknown,axis:'lat'|'lng'):number|null{
 if(typeof value!=='string'&&typeof value!=='number')return null;
 if(typeof value==='string'&&!value.trim())return null;
 const n=Number(value);
 const max=axis==='lat'?90:180;
 return Number.isFinite(n)&&n>=-max&&n<=max?n:null;
}
export function normalizeCustomerAddress(raw:unknown):CustomerAddress{
 if(!raw||typeof raw!=='object')throw new Error('El servidor devolvió una dirección inválida.');
 const value=raw as Record<string,unknown>;
 const id=Number(value.id);
 if(!Number.isSafeInteger(id)||id<=0)throw new Error('Identificador de dirección inválido.');
 return {id,label:String(value.label??''),address:String(value.address??''),
  lat:parseCoordinate(value.lat,'lat'),lng:parseCoordinate(value.lng,'lng'),is_default:value.is_default===true};
}
