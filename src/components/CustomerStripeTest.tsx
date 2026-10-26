import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,Clock3,CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {api,pesos} from '../lib/api';
import {loadStripePayment,requireStripeIntent,stripePaymentMode} from '../lib/stripe-test';
import type {StripeClient,StripeElements,StripeElement,StripeTestConfig,StripePaymentMode} from '../lib/stripe-test';
import type {Order,PaymentOptions} from '../lib/types';

type VerifiedServerStatus=Awaited<ReturnType<typeof api.stripePaymentStatus>>;

/** LIVE and TEST use the same Stripe.js form but never share key modes.
 * Only the signed-webhook financial ledger can mark a card payment paid.
 */
export function CustomerStripeTest(){
 const {id}=useParams(),orderId=Number(id);
 const validId=Number.isSafeInteger(orderId)&&orderId>0;
 const [order,setOrder]=useState<Order|null>(null);
 const [config,setConfig]=useState<StripeTestConfig|null>(null);
 const [methods,setMethods]=useState<PaymentOptions|null>(null);
 const [status,setStatus]=useState<VerifiedServerStatus|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const [creating,setCreating]=useState(false),[confirming,setConfirming]=useState(false),[secret,setSecret]=useState<string|null>(null);
 const [elementReady,setElementReady]=useState(false);
 const stripeRef=useRef<StripeClient|null>(null),elementsRef=useRef<StripeElements|null>(null),paymentRef=useRef<StripeElement|null>(null);
 const inFlight=useRef(false),pollCount=useRef(0);
 const refresh=()=>setReload(n=>n+1);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');setStatus(null);setOrder(null);setMethods(null);setConfig(null);
  if(!validId){setLoading(false);setError('Identificador de pedido inválido.');return()=>{active=false};}
  Promise.all([api.liveOrder(orderId),api.paymentOptions(),
    api.stripeTestConfig(),api.stripePaymentStatus(orderId)]).then(([data,opts,cfg,verified])=>{
   if(!active)return;
   if(!data?.order||data.order.id!==orderId||verified.order_id!==orderId||
     verified.provider!=='stripe'||verified.currency!=='mxn')
     throw new Error('El servidor no confirmó la identidad del pago.');
   setOrder(data.order);setMethods(opts);setConfig(cfg);setStatus(verified);
  }).catch(err=>{if(active)setError(err instanceof Error?err.message:'No pudimos verificar el pago.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[orderId,validId,reload]);
 const paymentMode:StripePaymentMode|null=order?.payment_method==='stripe'
  ?stripePaymentMode(methods,config,order.order_type==='delivery'?'delivery':'pickup'):null;
 const trusted=Boolean(status&&paymentMode&&status.mode===paymentMode);
 const paid=Boolean(trusted&&status?.confirmed_by_server===true&&
   status?.payment_status==='paid'&&order?.payment_status==='paid');
 const pendingPayment=Boolean(trusted&&status?.payment_status==='pending'&&!paid);
 const supported=Boolean(paymentMode&&trusted&&order&&pendingPayment);
 const label=paymentMode==='live'?'Stripe LIVE':'Stripe TEST';

 // Bounded reconciliation polling; Stripe.js response alone is never proof.
 useEffect(()=>{
  if(paid){pollCount.current=0;return;}
  if(!order||order.payment_method!=='stripe'||secret||creating||confirming||
     !status||pollCount.current>=12)return;
  const timer=window.setTimeout(()=>{pollCount.current++;refresh();},5000);
  return()=>window.clearTimeout(timer);
 },[order?.id,status?.payment_status,paid,secret,creating,confirming,reload]);

 useEffect(()=>{
  let alive=true;
  if(!secret||!config?.publishable_key||!paymentMode||!supported)return()=>{alive=false};
  setElementReady(false);
  loadStripePayment(config.publishable_key,paymentMode).then(stripe=>{
   if(!alive)return;
   const elements=stripe.elements({clientSecret:secret,appearance:{theme:'stripe',
    variables:{colorPrimary:'#CE3C0A',fontFamily:'Roboto, Arial, sans-serif',borderRadius:'16px'}}});
   const payment=elements.create('payment',{layout:'tabs'});
   stripeRef.current=stripe;elementsRef.current=elements;paymentRef.current=payment;
   payment.mount('#tala-stripe-payment-element');setElementReady(true);
  }).catch(err=>{if(alive)setError(err instanceof Error?err.message:'No pudimos preparar Stripe.');});
  return()=>{alive=false;paymentRef.current?.destroy();paymentRef.current=null;
   elementsRef.current=null;stripeRef.current=null;};
 },[secret,config?.publishable_key,paymentMode,supported]);
 async function begin(){
  if(creating||inFlight.current||!supported||paid||!config?.publishable_key||!order||!paymentMode)return;
  inFlight.current=true;setCreating(true);setError('');
  try{
   const [fresh,flags,profile,verified]=await Promise.all([
    api.liveOrder(orderId),api.paymentOptions(),api.stripeTestConfig(),api.stripePaymentStatus(orderId)]);
   if(fresh.order.id!==orderId||fresh.order.payment_method!=='stripe'||
     verified.order_id!==orderId||verified.payment_status!=='pending'||
     verified.confirmed_by_server===true||verified.mode!==paymentMode)
     throw new Error('El estado del pedido cambió: actualiza antes de pagar.');
   const newMode=stripePaymentMode(flags,profile,
     fresh.order.order_type==='delivery'?'delivery':'pickup');
   if(newMode!==paymentMode||profile.publishable_key!==config.publishable_key)
     throw new Error('La autorización de Stripe cambió. No se creó ningún pago.');
   // Explicit user action only; no retry on timeout or unknown payment state.
   const reply=await api.stripeTestIntent(orderId);
   const clientSecret=requireStripeIntent(reply,profile,fresh.order,paymentMode);
   setSecret(clientSecret);setConfig(profile);setMethods(flags);setStatus(verified);
  }catch(err){setError(err instanceof Error?err.message:'No pudimos iniciar el pago; revisa el estado antes de reintentar.');}
  finally{setCreating(false);inFlight.current=false;}
 }
 async function confirm(){
  if(confirming||inFlight.current||!elementReady||!stripeRef.current||!elementsRef.current||
     !supported||paid)return;
  inFlight.current=true;setConfirming(true);setError('');
  try{
   const result=await stripeRef.current.confirmPayment({
    elements:elementsRef.current,
    confirmParams:{return_url:window.location.origin+'/pago/'+orderId},
    redirect:'if_required'
   });
   if(result.error)throw new Error(result.error.message||'Stripe no pudo confirmar el pago.');
   // NEVER infer paid from Stripe SDK. The signed webhook must post an exact
   // immutable ledger receipt and the server status contract must verify it.
   setSecret(null);setElementReady(false);pollCount.current=0;refresh();
  }catch(err){setError(err instanceof Error?err.message:'No se pudo confirmar el pago. Comprueba su estado antes de reintentar.');}
  finally{inFlight.current=false;setConfirming(false);}
 }
 return <div className="mobile-customer-page mobile-stripe-status" data-mobile-screen="payment-status">
  <div className="mobile-detail-header"><Link to="/pedidos" aria-label="Volver a pedidos"><ArrowLeft size={22}/></Link><h1>Pago con Stripe</h1><button onClick={()=>{pollCount.current=0;refresh();}} disabled={loading||confirming||creating} aria-label="Verificar pago"><RefreshCw size={19}/></button></div>
  <div className="mobile-payment-orb">{paid?<CheckCircle2 size={42}/>:<Clock3 size={42}/>}</div>
  <h2>{paid?'¡Pago verificado!':loading?'Verificando pago…':'Pago pendiente de confirmación'}</h2>
  <p className="mobile-stripe-center">{order?'Pedido #'+order.id+' · '+pesos(order.total):'Verificando pedido en el servidor…'}</p>
  <section className="mobile-checkout-card">
   <div className="mobile-stripe-head"><ShieldCheck size={23}/><div><strong>{label}</strong><span>{paymentMode==='live'?'Pago real en pesos mexicanos. Tarjeta procesada de forma segura por Stripe.':'Entorno de pruebas. No se realizarán cargos reales.'}</span></div></div>
   {loading&&<p className="mobile-loading-order"><RefreshCw size={17} className="spin"/> Verificando estado del servidor…</p>}
   {error&&<div role="alert" className="mobile-address-error">{error}</div>}
   {order?.payment_method!=='stripe'&&order&&<div className="mobile-checkout-note">Este pedido no utiliza Stripe.</div>}
   {order&&order.payment_method==='stripe'&&!supported&&!paid&&!loading&&
    <div className="mobile-checkout-note">No está disponible un pago nuevo. Verifica que el restaurante esté aprobado, o espera la conciliación de Stripe.</div>}
   {supported&&!paid&&!loading&&!secret&&<button className="mobile-checkout-fixed" disabled={creating} onClick={()=>void begin()}><CreditCard size={19}/>{creating?'Preparando pago…':paymentMode==='live'?'Pagar de forma segura con Stripe LIVE':'Abrir pago de prueba Stripe TEST'}</button>}
   {secret&&supported&&!paid&&<><div id="tala-stripe-payment-element" className="mobile-stripe-element" aria-label="Formulario seguro de Stripe"/><button className="mobile-checkout-fixed" disabled={confirming||!elementReady} onClick={()=>void confirm()}>{confirming?'Confirmando con Stripe…':paymentMode==='live'?'Confirmar pago real':'Confirmar pago de prueba'}</button></>}
   {order&&!paid&&<p className="mobile-checkout-disclosure">No vuelvas a realizar el cobro si el resultado es incierto. El pedido se actualizará únicamente cuando el backend verifique el webhook de Stripe y su asiento contable.</p>}
   {paid&&<div className="mobile-profile-saved"><CheckCircle2 size={20}/> Pago confirmado por recibo financiero del servidor.</div>}
  </section>
  {order&&<Link className="mobile-status-link" to={'/pedidos/'+order.id}>Ver estado de mi pedido</Link>}
 </div>;
}
