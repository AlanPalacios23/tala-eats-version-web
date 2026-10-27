import type {MerchantConnectStatus} from './restaurant-state';

/** Treat data from finance endpoints as untrusted until the shape/merchant ID is checked. */
export function checkedOwnerConnectStatus(payload:unknown,restaurantId:number):MerchantConnectStatus{
 if(!Number.isSafeInteger(restaurantId)||restaurantId<1||!payload||typeof payload!=='object')
  throw new Error('No se pudo validar el estado de Stripe Connect.');
 const obj=payload as Record<string,unknown>;
 if(obj.restaurant_id!==undefined&&obj.restaurant_id!==restaurantId)
  throw new Error('La cuenta Stripe Connect no corresponde al restaurante autorizado.');
 const fields=['owner_approved','transfers_active','payouts_enabled','details_submitted'] as const;
 for(const field of fields){
  if(typeof obj[field]!=='boolean')throw new Error('La respuesta de Stripe Connect está incompleta.');
 }
 if(obj.ready!==undefined&&typeof obj.ready!=='boolean')
  throw new Error('El servidor devolvió un estado Stripe Connect inválido.');
 return {
  owner_approved:obj.owner_approved as boolean,
  transfers_active:obj.transfers_active as boolean,
  payouts_enabled:obj.payouts_enabled as boolean,
  details_submitted:obj.details_submitted as boolean,
  ...(typeof obj.ready==='boolean'?{ready:obj.ready}:{})
 };
}
export type MerchantConnectStage='unlinked'|'owner'|'stripe'|'review'|'ready';
export function merchantConnectStage(status:MerchantConnectStatus|null):MerchantConnectStage{
 if(!status)return 'unlinked';
 if(!status.owner_approved)return 'owner';
 if(!status.details_submitted||!status.transfers_active||!status.payouts_enabled)return 'stripe';
 // The seller gates can still be closed by server business or payment policy.
 return status.ready===true?'ready':'review';
}
/** Account Links are one-time, short-lived credentials, never placed in UI/logs. */
export function trustedStripeConnectLink(payload:unknown,nowMs=Date.now()):string{
 if(!payload||typeof payload!=='object')
  throw new Error('Stripe Connect no devolvió un enlace válido.');
 const x=payload as Record<string,unknown>;
 if(typeof x.url!=='string'||x.url.length<30||x.url.length>8192)
  throw new Error('Stripe Connect no devolvió un enlace válido.');
 if(typeof x.expires_at!=='number'||!Number.isSafeInteger(x.expires_at)||x.expires_at*1000<=nowMs+15000)
  throw new Error('El enlace de Stripe expiró. Solicita otro desde Activación.');
 let url:URL;
 try{url=new URL(x.url);}catch{throw new Error('Stripe Connect devolvió una dirección inválida.');}
 if(url.protocol!=='https:'||url.hostname!=='connect.stripe.com'||
  url.username!==''||url.password!==''||url.port!==''||url.hash!==''||
  url.pathname==='/'||url.pathname.includes('//'))
  throw new Error('Stripe Connect devolvió un enlace fuera del dominio autorizado.');
 return url.href;
}
