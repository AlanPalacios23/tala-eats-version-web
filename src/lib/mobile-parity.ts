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
  if (!/^\\d{1,10}(?:\\.\\d{1,2})?$/.test(value)) return null;
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
  return value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();
}
