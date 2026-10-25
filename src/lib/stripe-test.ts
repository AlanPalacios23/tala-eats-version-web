import type {PaymentOptions} from './types';
import type {FulfillmentMode} from './customer-checkout';

export interface StripeTestConfig{enabled?:boolean;publishable_key?:string;merchant_country?:string;}
export interface StripeIntentReply{client_secret?:string;publishable_key?:string;already_paid?:boolean;payment_status?:string;}
export function stripeTestAllowed(methods:PaymentOptions|null|undefined,config:StripeTestConfig|null|undefined,mode:FulfillmentMode):boolean{
 if(config?.enabled!==true||typeof config.publishable_key!=='string'||!/^pk_test_[A-Za-z0-9]+$/.test(config.publishable_key))return false;
 if(!methods?.methods?.some(m=>m.id==='stripe'&&m.enabled===true))return false;
 if(mode==='pickup')return methods.pickup_quote_supported===true&&methods.pickup_checkout_supported!==false;
 return methods.delivery_checkout_supported===true&&methods.delivery_quote_supported===true&&methods.delivery_stripe_supported===true;
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
