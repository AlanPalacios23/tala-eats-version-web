/** Paridad verificable con tala-eats-mobile Usuarios PR #67 (borrador).
 * Fuente: f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d.
 * El backend, y no esta capa de presentación, determina precios y pagos.
 */
import type { PaymentOptions, Quote } from './types';
export const MOBILE_REFERENCE = Object.freeze({ version:'1.0.46+57', sha:'f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d' });
export const MOBILE_MOTION = Object.freeze({micro:140,select:200,reveal:300,page:320,pageReverse:260,success:620});
export const MOBILE_PALETTE = Object.freeze({brand:'#FF5A1F',brandDeep:'#CE3C0A',ink:'#171717',muted:'#737373',background:'#FAFAF9',softOrange:'#FFE9DF',line:'#EAE8E5'});
const FIELDS=['total','subtotal','service_fee','delivery_fee','tip'] as const;
export function amountInCents(amount:unknown):number|null {
  if (typeof amount!=='number' && typeof amount!=='string') return null;
  const value=String(amount);
  if (!(new RegExp('^[0-9]{1,10}([.][0-9]{1,2})?$')).test(value)) return null;
  const [whole,decimal='']=value.split('.');
  const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  return Number.isSafeInteger(cents)?cents:null;
}
export function quoteIsUsable(quote:Quote|null|undefined):quote is Quote {
  return Boolean(quote && amountInCents(quote.total)!==null && (amountInCents(quote.total) ?? 0)>0 &&
    (quote.currency===undefined || quote.currency==='MXN') &&
    (quote.order_type===undefined || quote.order_type==='pickup') &&
    (quote.payment_method===undefined || quote.payment_method==='cash') &&
    (quote.inventory_reserved===undefined || quote.inventory_reserved===false) &&
    (quote.quote_is_binding===undefined || quote.quote_is_binding===false));
}
export function quoteChanged(before:Quote,after:Quote):boolean {
  return FIELDS.some(key=> {
    const a=before[key], b=after[key];
    if(a===undefined && b===undefined) return false;
    return amountInCents(a)!==amountInCents(b);
  });
}
export function pickupCashAllowed(methods:PaymentOptions|null|undefined):boolean {
  return Boolean(methods?.methods?.some(method=>method.id==='cash' && method.enabled===true) &&
    methods.pickup_checkout_supported!==false && methods.pickup_quote_supported!==false);
}
export function foldSearch(value:string):string {
  return value.normalize('NFD').split('').filter(char=>char.charCodeAt(0)<768 || char.charCodeAt(0)>879).join('').toLowerCase().trim();
}

/** Identical status labels and step buckets to Flutter ui/order_screens.dart. */
export const ORDER_STEPS_PICKUP=[
 {label:'Recibido',codes:['received']},
 {label:'Confirmado',codes:['confirmed']},
 {label:'Preparando',codes:['preparing']},
 {label:'Listo para recoger',codes:['ready','assigned','picked_up','on_the_way']},
 {label:'Recogido',codes:['delivered']}
] as const;
export const ORDER_STEPS_DELIVERY=[
 {label:'Recibido',codes:['received']},
 {label:'Confirmado',codes:['confirmed']},
 {label:'Preparando',codes:['preparing']},
 {label:'Listo',codes:['ready','assigned']},
 {label:'En camino',codes:['picked_up','on_the_way']},
 {label:'Entregado',codes:['delivered']}
] as const;
export const ORDER_LABELS:Record<string,string>={
 received:'Recibido',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',assigned:'Asignado',
 picked_up:'Recogido por repartidor',on_the_way:'En camino',delivered:'Entregado',cancelled:'Cancelado',awaiting_payment:'Esperando pago'
};
export function isCompletedOrder(status:string):boolean {
 return status==='delivered'||status==='cancelled'||status==='refunded';
}
export function orderProgress(status:string,mode:string){
 const steps=mode==='delivery'?ORDER_STEPS_DELIVERY:ORDER_STEPS_PICKUP;
 const index=steps.findIndex(step=>(step.codes as readonly string[]).includes(status));
 return {steps,index:Math.max(0,index)};
}
