import type {PaymentOptions} from './types';
import type {FulfillmentMode} from './customer-checkout';

export interface StripeTestConfig{
 enabled?:boolean;publishable_key?:string;merchant_country?:string;
 environment?:'staging'|'production';mode?:string;checkout_ready?:boolean;
 financial_writes_enabled?:boolean;
}
export interface StripeIntentReply{
 client_secret?:string;publishable_key?:string;already_paid?:boolean;payment_status?:string;
 provider?:string;mode?:'live'|'test';order_id?:number;payment_intent_id?:string;
 amount_minor?:number;currency?:string;
}
export function stripeTestAllowed(methods:PaymentOptions|null|undefined,config:StripeTestConfig|null|undefined,mode:FulfillmentMode):boolean{
 if(config?.enabled!==true||typeof config.publishable_key!=='string'||!/^pk_test_[A-Za-z0-9]+$/.test(config.publishable_key))return false;
 if(!methods?.methods?.some(m=>m.id==='stripe'&&m.enabled===true))return false;
 if(mode==='pickup')return methods.pickup_quote_supported===true&&methods.pickup_checkout_supported!==false;
 return methods.delivery_checkout_supported===true&&methods.delivery_quote_supported===true&&methods.delivery_stripe_supported===true;
}
/** All LIVE payment UI gates are public capability checks, NOT authorization
 * to charge. The POST PaymentIntent endpoint enforces seller ownership, Connect,
 * immutable signed ledger and buyer identity again.
 */
export type StripePaymentMode='live'|'test';
export function stripePaymentMode(
 methods:PaymentOptions|null|undefined,
 config:StripeTestConfig|null|undefined,
 fulfillment:FulfillmentMode
):StripePaymentMode|null{
 if(!config||config.enabled!==true||config.checkout_ready!==true||
   typeof config.publishable_key!=='string')return null;
 const card=methods?.methods?.find(x=>x.id==='stripe'&&x.enabled===true);
 if(!card||methods?.pickup_quote_supported!==true||
   methods.pickup_checkout_supported===false)return null;
 if(config.environment==='production'&&config.mode==='live-pickup-only'&&
    config.financial_writes_enabled===true&&
    /^pk_live_[A-Za-z0-9]+$/.test(config.publishable_key)&&
    card.mode==='live-stripe-pickup'&&
    (fulfillment==='pickup'||(
      fulfillment==='delivery'&&methods?.delivery_checkout_supported===true&&
      methods.delivery_quote_supported===true&&methods.delivery_stripe_supported===true)))
   return 'live';
 if(config.environment==='staging'&&config.mode==='test-pickup-only'&&
    /^pk_test_[A-Za-z0-9]+$/.test(config.publishable_key)&&
    card.mode==='stage-stripe-test-pickup'&&
    (fulfillment==='pickup'||(methods?.delivery_checkout_supported===true&&
      methods.delivery_quote_supported===true&&methods.delivery_stripe_supported===true)))
   return 'test';
 return null;
}
export function stripePaymentAllowed(
 methods:PaymentOptions|null|undefined,
 config:StripeTestConfig|null|undefined,
 fulfillment:FulfillmentMode
):boolean{return stripePaymentMode(methods,config,fulfillment)!==null;}

export function requireStripeIntent(
 reply:StripeIntentReply,config:StripeTestConfig,
 order:{id:number;total:string|number},expectedMode:StripePaymentMode
):string {
 const publishable=config.publishable_key;
 const keyPrefix=expectedMode==='live'?'pk_live_':'pk_test_';
 if(!publishable?.startsWith(keyPrefix)||
   !/^[A-Za-z0-9]+$/.test(publishable.slice(keyPrefix.length))||
   reply.provider!=='stripe'||reply.mode!==expectedMode||
   reply.publishable_key!==publishable||
   reply.order_id!==order.id||reply.currency!=='mxn'||
   !Number.isSafeInteger(reply.amount_minor)||!reply.amount_minor||reply.amount_minor<=0||
   !/^pi_[A-Za-z0-9]+$/.test(reply.payment_intent_id??''))
   throw new Error('El intento de pago no coincide con el pedido ni el entorno Stripe.');
 const [whole,part='']=String(order.total).split('.');
 if(!/^(?:0|[1-9]\d{0,7})$/.test(whole)||!/^\d{0,2}$/.test(part)||
   Number(whole)*100+Number((part+'00').slice(0,2))!==reply.amount_minor)
   throw new Error('Stripe devolvió un importe diferente al total verificado.');
 if(reply.already_paid===true||reply.payment_status==='paid')
   throw new Error('El pedido ya puede estar pagado; consulta el estado antes de reintentar.');
 const secret=reply.client_secret;
 if(!secret||!/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(secret)||
   !secret.startsWith(reply.payment_intent_id+'_secret_'))
   throw new Error('Stripe devolvió un secreto de pago inválido.');
 return secret;
}

export function requireTestIntent(reply:StripeIntentReply,key:string):string{
 if(!/^pk_test_[A-Za-z0-9]+$/.test(key))throw new Error('Stripe LIVE no está habilitado en esta versión Web.');
 if(reply.publishable_key!==undefined&&reply.publishable_key!==key)throw new Error('La configuración de Stripe no coincide con el servidor.');
 if(reply.already_paid===true||reply.payment_status==='paid')throw new Error('El servidor ya informa el pago; comprueba el estado del pedido.');
 const secret=reply.client_secret;
 if(!secret||!/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(secret))throw new Error('Stripe TEST no devolvió un PaymentIntent válido.');
 return secret;
}
export interface StripeElement{
 mount(selector:string|HTMLElement):void;
 destroy():void;
}
export interface StripeElements{
 create(type:'payment',options?:Record<string,unknown>):StripeElement;
}
export interface StripeClient{
 elements(options:{clientSecret:string;appearance?:Record<string,unknown>}):StripeElements;
 confirmPayment(options:{
  elements:StripeElements;confirmParams:{return_url:string};redirect:'if_required'
 }):Promise<{error?:{message?:string;type?:string};paymentIntent?:{status?:string}}>;
}
declare global { interface Window {Stripe?: (publishableKey:string)=>StripeClient|null;} }
let stripeScript:Promise<void>|null=null;
/** Stripe.js must be served by Stripe, never copied into our own PWA bundle or cache. */
export async function loadStripeTest(key:string):Promise<StripeClient>{
 if(!/^pk_test_[A-Za-z0-9]+$/.test(key))throw new Error('Solo se permite Stripe TEST.');
 if(!window.Stripe){
  if(!stripeScript){
   stripeScript=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://js.stripe.com/v3/';
    script.async=true;script.setAttribute('data-stripe-test','1');
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('No se pudo cargar el formulario seguro de Stripe.'));
    document.head.appendChild(script);
   }).catch(err=>{stripeScript=null;throw err;});
  }
  await stripeScript;
 }
 const instance=window.Stripe?.(key);
 if(!instance)throw new Error('Stripe TEST no está disponible en este navegador.');
 return instance;
}

/** Only Stripe.js hosted by Stripe can tokenize cards; never embed a secret key. */
export async function loadStripePayment(key:string,mode:StripePaymentMode):Promise<StripeClient>{
 if(!(mode==='live'?/^pk_live_[A-Za-z0-9]+$/:/^pk_test_[A-Za-z0-9]+$/).test(key))
  throw new Error('Configuración de Stripe incompatible con el entorno del pago.');
 if(!window.Stripe){
  if(!stripeScript){
   stripeScript=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://js.stripe.com/v3/';
    script.async=true;
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('No se pudo cargar el formulario seguro de Stripe.'));
    document.head.appendChild(script);
   }).catch(err=>{stripeScript=null;throw err;});
  }
  await stripeScript;
 }
 const stripe=window.Stripe?.(key);
 if(!stripe)throw new Error('El formulario seguro de Stripe no está disponible.');
 return stripe;
}
