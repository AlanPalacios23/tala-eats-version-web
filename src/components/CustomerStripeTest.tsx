import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,Clock3,CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {api,pesos} from '../lib/api';
import {loadStripeTest,requireTestIntent,stripeTestAllowed} from '../lib/stripe-test';
import type {StripeClient,StripeElements,StripeElement,StripeTestConfig} from '../lib/stripe-test';
import type {Order,PaymentOptions} from '../lib/types';

export function CustomerStripeTest(){
 const {id}=useParams(),orderId=Number(id);
 const validId=Number.isSafeInteger(orderId)&&orderId>0;
 const [order,setOrder]=useState<Order|null>(null),[config,setConfig]=useState<StripeTestConfig|null>(null),[methods,setMethods]=useState<PaymentOptions|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const [creating,setCreating]=useState(false),[confirming,setConfirming]=useState(false),[secret,setSecret]=useState<string|null>(null);
 const [elementReady,setElementReady]=useState(false);
 const stripeRef=useRef<StripeClient|null>(null),elementsRef=useRef<StripeElements|null>(null),paymentRef=useRef<StripeElement|null>(null);
 const inFlight=useRef(false);
 const refresh=()=>setReload(n=>n+1);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setOrder(null);setMethods(null);setConfig(null);
  if(!validId){setLoading(false);setError('Identificador de pedido inválido.');return()=>{active=false};}
  Promise.all([api.liveOrder(orderId),api.paymentOptions(),api.stripeTestConfig()]).then(([data,opts,cfg])=>{
   if(!active)return;
   if(!data?.order||data.order.id!==orderId)throw new Error('El servidor no confirmó la identidad del pedido.');
   setOrder(data.order);setMethods(opts);setConfig(cfg);
  }).catch(err=>{if(active)setError(err instanceof Error?err.message:'No pudimos verificar el pago.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[orderId,validId,reload]);
 const supported=Boolean(order&&order.payment_method==='stripe'&&config&&
  stripeTestAllowed(methods,config,order.order_type==='delivery'?'delivery':'pickup'));
 const paid=order?.payment_status==='paid';
 useEffect(()=>{
  let alive=true;
  if(!secret||!config?.publishable_key||!supported)return()=>{alive=false};
  setElementReady(false);
  loadStripeTest(config.publishable_key).then(stripe=>{
   if(!alive)return;
   const elements=stripe.elements({clientSecret:secret,appearance:{theme:'stripe',variables:{colorPrimary:'#CE3C0A',fontFamily:'Roboto, Arial, sans-serif',borderRadius:'16px'}}});
   const payment=elements.create('payment',{layout:'tabs'});
   stripeRef.current=stripe;elementsRef.current=elements;paymentRef.current=payment;
   payment.mount('#tala-stripe-payment-element');setElementReady(true);
  }).catch(err=>{if(alive)setError(err instanceof Error?err.message:'No pudimos preparar Stripe TEST.');});
  return()=>{alive=false;paymentRef.current?.destroy();paymentRef.current=null;elementsRef.current=null;stripeRef.current=null;};
 },[secret,config?.publishable_key,supported]);
 async function begin(){
  if(creating||inFlight.current||!supported||paid||!config?.publishable_key||!order)return;
  inFlight.current=true;setCreating(true);setError('');
  try{
   // Checks are repeated directly before creating a Stripe TEST PaymentIntent.
   const [fresh,flags,profile]=await Promise.all([api.liveOrder(orderId),api.paymentOptions(),api.stripeTestConfig()]);
   if(fresh.order.id!==orderId||fresh.order.payment_method!=='stripe'||fresh.order.payment_status==='paid')throw new Error('Revisa el estado del pedido antes de pagar.');
   if(!stripeTestAllowed(flags,profile,fresh.order.order_type==='delivery'?'delivery':'pickup')||profile.publishable_key!==config.publishable_key)throw new Error('Stripe TEST dejó de estar habilitado. No se creó el pago.');
   const reply=await api.stripeTestIntent(orderId);
   setSecret(requireTestIntent(reply,profile.publishable_key!));
   setConfig(profile);setMethods(flags);
  }catch(err){setError(err instanceof Error?err.message:'No pudimos crear el intento de pago TEST.');}
  finally{setCreating(false);inFlight.current=false;}
 }
 async function confirm(){
  if(confirming||inFlight.current||!elementReady||!stripeRef.current||!elementsRef.current||!supported||paid)return;
  inFlight.current=true;setConfirming(true);setError('');
  try{
   const result=await stripeRef.current.confirmPayment({
    elements:elementsRef.current,
    confirmParams:{return_url:window.location.origin+'/pago/'+orderId},
    redirect:'if_required'
   });
   if(result.error)throw new Error(result.error.message||'Stripe TEST no pudo confirmar el pago.');
   // NEVER infer paid from Stripe SDK success; backend webhook owns final state.
   setSecret(null);setElementReady(false);refresh();
  }catch(err){setError(err instanceof Error?err.message:'No se pudo confirmar Stripe TEST.');}
  finally{inFlight.current=false;setConfirming(false);}
 }
 return <div className="mobile-customer-page mobile-stripe-status" data-mobile-screen="payment-status">
  <div className="mobile-detail-header"><Link to="/pedidos" aria-label="Volver a pedidos"><ArrowLeft size={22}/></Link><h1>Pago con Stripe</h1><button onClick={refresh} disabled={loading||confirming||creating} aria-label="Verificar pago"><RefreshCw size={19}/></button></div>
  <div className="mobile-payment-orb">{paid?<CheckCircle2 size={42}/>:<Clock3 size={42}/>}</div>
  <h2>{paid?'¡Pago confirmado!':'Completa tu pago'}</h2>
  <p className="mobile-stripe-center">{order?'Pedido #'+order.id+' · '+pesos(order.total):'Verificando pedido en el servidor…'}</p>
  <section className="mobile-checkout-card">
   <div className="mobile-stripe-head"><ShieldCheck size={23}/><div><strong>Stripe TEST</strong><span>Modo de pruebas. No se aceptan cobros reales desde esta pantalla.</span></div></div>
   {loading&&<p className="mobile-loading-order"><RefreshCw size={17} className="spin"/> Verificando estado…</p>}
   {error&&<div role="alert" className="mobile-address-error">{error}</div>}
   {order?.payment_method!=='stripe'&&order&&<div className="mobile-checkout-note">Este pedido no utiliza Stripe.</div>}
   {order&&order.payment_method==='stripe'&&!supported&&!paid&&!loading&&<div className="mobile-checkout-note">Stripe TEST no está habilitado para este pedido o la configuración del servidor no es de pruebas.</div>}
   {order&&supported&&!paid&&!loading&&!secret&&<button className="mobile-checkout-fixed" disabled={creating} onClick={()=>void begin()}><CreditCard size={19}/>{creating?'Preparando pago de prueba…':'Abrir pago seguro TEST'}</button>}
   {secret&&supported&&!paid&&<><div id="tala-stripe-payment-element" className="mobile-stripe-element" aria-label="Formulario seguro de Stripe TEST"/><button className="mobile-checkout-fixed" disabled={confirming||!elementReady} onClick={()=>void confirm()}>{confirming?'Verificando con Stripe…':'Confirmar pago de prueba'}</button></>}
   {order&&!paid&&<p className="mobile-checkout-disclosure">Un resultado del formulario no confirma el pago. El servidor actualiza el estado después de recibir y verificar el webhook.</p>}
   {paid&&<div className="mobile-profile-saved"><CheckCircle2 size={20}/> Pago confirmado por el backend.</div>}
  </section>
  {order&&<Link className="mobile-status-link" to={'/pedidos/'+order.id}>Ver estado de mi pedido</Link>}
 </div>;
}
