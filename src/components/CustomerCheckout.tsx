import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, CreditCard, Info, MapPin, Minus, Plus, RefreshCw, ShoppingBag, Store, Truck, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, pesos } from '../lib/api';
import { CustomerPhoto } from './CustomerPhoto';
import { basketTotal, remainingForVariant, updateQuantity } from '../lib/cart';
import { referenceBreakdown } from '../lib/checkout-preview';
import type { Cart } from '../lib/cart';
import { useSession } from '../lib/session';
import { stripePaymentAllowed, stripePaymentMode } from '../lib/stripe-test';
import type { StripeTestConfig } from '../lib/stripe-test';
import { buildCheckoutRequest, checkoutAllowed, assertServerQuote, fingerprint, quoteMateriallyChanged, validAddress, validateCartAgainstRestaurant } from '../lib/customer-checkout';
import type { CustomerAddress, FulfillmentMode, PaymentKind, VerifiedQuote } from '../lib/customer-checkout';
import type { Order, PaymentOptions, Restaurant } from '../lib/types';

function OrderAmount({label,value,primary=false,hint}:{label:string;value:string|number|null|undefined;primary?:boolean;hint?:string}){
 return <div className={'mobile-checkout-amount'+(primary?' primary':'')}><span>{label}{hint&&<small className="mobile-checkout-amount-hint">{hint}</small>}</span><strong>{value==null?'Por confirmar':pesos(value)}</strong></div>;
}
function OrderSummary({quote,delivery,cart,options,tip,coupon}:{quote:VerifiedQuote|null;delivery:boolean;cart:Cart;options:PaymentOptions|null;tip:string;coupon:string}){
 const reference=referenceBreakdown(basketTotal(cart),options,delivery,tip,Boolean(coupon.trim()));
 const fee=quote?.service_fee??reference.serviceFee;
 const shipping=quote?.delivery_fee??reference.deliveryBase;
 const total=quote?.total??reference.total;
 return <section className="mobile-checkout-card"><h2>Resumen</h2>
  <div className="mobile-checkout-products">{cart.entries.map(row=><div key={row.item.id+'-'+(row.note??'')}><b>{row.quantity}×</b><span>{row.item.name}</span><strong>{pesos(Number(row.item.price)*row.quantity)}</strong></div>)}</div>
  <OrderAmount label="Subtotal" value={quote?.subtotal??reference.subtotal}/>
  <OrderAmount label={reference.rateLabel} value={fee} hint="Aplica a efectivo y pago digital; no a envío ni propina."/>
  <OrderAmount label={delivery?(quote?'Envío estimado por distancia':'Envío (referencia base)'):'Recoger en restaurante'} value={shipping} hint={delivery&&!quote?'La tarifa final depende del cálculo del servidor; esta es solo la tarifa base.':undefined}/>
  {delivery&&<OrderAmount label="Propina para repartidor" value={quote?.tip as string|number|undefined??reference.tip}/>}
  <OrderAmount label={quote?'Total calculado por el servidor':'Total de referencia'} value={total} primary/>
  <p className="mobile-checkout-disclosure">{quote?'Importes calculados por el servidor; se verifican otra vez al registrar el pedido. No se ha reservado inventario.':reference.note}</p>
 </section>;
}
export function CustomerCart({cart,setCart}:{cart:Cart;setCart:(value:Cart)=>void}){
 const {user}=useSession();const [options,setOptions]=useState<PaymentOptions|null>(null);
 useEffect(()=>{let active=true;setOptions(null);if(!user)return()=>{active=false;};
  api.paymentOptions().then(v=>{if(active)setOptions(v)}).catch(()=>{if(active)setOptions(null)});
  return()=>{active=false};
 },[user?.id]);
 const reference=referenceBreakdown(basketTotal(cart),options,false,'0',false);
 const count=cart.entries.reduce((sum,e)=>sum+e.quantity,0);
 return <div className="mobile-customer-page mobile-cart" data-mobile-screen="cart">
  <div className="mobile-detail-header"><Link to={cart.restaurantId?'/comercio/'+cart.restaurantId:'/clientes'} aria-label="Volver"><ArrowLeft size={22}/></Link><h1>Tu carrito</h1></div>
  {!count?<div className="mobile-status"><ShoppingBag size={32}/><h2>Tu carrito está vacío</h2><p>Agrega productos desde el menú de un restaurante.</p><Link className="mobile-status-link" to="/clientes">Explorar restaurantes</Link></div>:
  <><section className="mobile-checkout-card"><h2>{count} {count===1?'producto':'productos'}</h2><Link className="mobile-cart-merchant" to={'/comercio/'+cart.restaurantId}><Store size={21}/> Agregar más productos <ChevronRight size={18}/></Link></section>
   <div className="mobile-cart-lines">{cart.entries.map(entry=><article className="mobile-cart-entry" key={entry.item.id+'-'+(entry.note??'')}>
    <CustomerPhoto src={entry.item.image_url} alt={entry.item.name} fallback="🛍️" className="mobile-cart-item-image"/><div className="mobile-cart-entry-info"><strong>{entry.item.name}</strong>{entry.note&&<small>{entry.note}</small>}<span>{pesos(entry.item.price)} por unidad</span></div>
    <div className="mobile-stepper"><button aria-label={'Restar '+entry.item.name} onClick={()=>setCart(updateQuantity(cart,entry.item.id,-1,entry.note??''))}><Minus size={18}/></button><strong>{entry.quantity}</strong><button aria-label={'Sumar '+entry.item.name} onClick={()=>setCart(updateQuantity(cart,entry.item.id,1,entry.note??''))} disabled={remainingForVariant(cart,entry.item,entry.note??'')===0}><Plus size={18}/></button></div>
   </article>)}</div>
   <section className="mobile-checkout-card"><h2>Resumen</h2><OrderAmount label="Productos" value={basketTotal(cart)}/><OrderAmount label={reference.rateLabel} value={reference.serviceFee}/><OrderAmount label="Estimación antes del envío" value={reference.total} primary/><p className="mobile-checkout-disclosure">Elige domicilio o recoger al finalizar la compra. {reference.note} Los envíos y descuentos solo se confirman en la cotización del servidor; la comisión al comercio no se cobra aparte.</p></section>
   <Link className="mobile-checkout-fixed" to="/checkout">Continuar al pago <ChevronRight size={19}/></Link>
  </>}
 </div>;
}

interface PendingReference{userId:number;reference:string;fingerprint:string}
function pendingStorageKey(userId:number){return 'talaeats-checkout-pending-'+userId;}
function readPending(userId:number):PendingReference|null{
 try{
  const raw=sessionStorage.getItem(pendingStorageKey(userId));
  if(!raw)return null;
  const parsed=JSON.parse(raw) as PendingReference;
  return parsed.userId===userId&&typeof parsed.reference==='string'&&parsed.reference.length>=20?parsed:null;
 }catch{return null;}
}
export function CustomerCheckout({cart,setCart}:{cart:Cart;setCart:(value:Cart)=>void}){
 const {user}=useSession(),navigate=useNavigate();
 const [restaurant,setRestaurant]=useState<Restaurant|null>(null),[options,setOptions]=useState<PaymentOptions|null>(null),[addresses,setAddresses]=useState<CustomerAddress[]>([]);
 const [stripeConfig,setStripeConfig]=useState<StripeTestConfig|null>(null),[method,setMethod]=useState<PaymentKind>('cash');
 const [sellerReadiness,setSellerReadiness]=useState<{ready:boolean;cash_enabled:boolean;stripe_enabled:boolean;reason:string}|null>(null);

 const [loading,setLoading]=useState(true),[serverError,setServerError]=useState('');
 const [refresh,setRefresh]=useState(0),[mode,setMode]=useState<FulfillmentMode>('pickup'),[coupon,setCoupon]=useState(''),[notes,setNotes]=useState('');
 const [tip,setTip]=useState('0'),[error,setError]=useState(''),[quote,setQuote]=useState<{fingerprint:string;value:VerifiedQuote}|null>(null),[quoteBusy,setQuoteBusy]=useState(false);
 const [submitting,setSubmitting]=useState(false),[pending,setPending]=useState<PendingReference|null>(null),[rechecking,setRechecking]=useState(false),[quoteEpoch,setQuoteEpoch]=useState(0);
 const lock=useRef(false);
 const restaurantId=cart.restaurantId, userId=user?.id;
 useEffect(()=>{setPending(userId?readPending(userId):null);},[userId]);
 useEffect(()=>{
  let active=true;setLoading(true);setOptions(null);setServerError('');setRestaurant(null);
  if(!restaurantId||!userId){setLoading(false);return ()=>{active=false};}
  setStripeConfig(null);setSellerReadiness(null);
  Promise.all([api.restaurant(restaurantId),api.paymentOptions(),
    api.customerAddresses().catch(()=>[]),api.stripeTestConfig()])
   .then(async([r,p,a,cfg])=>{
    // Fail closed on LIVE merchant approval: global Stripe availability never
    // means this restaurant is permitted to accept money or cash orders.
    const readiness=cfg.environment==='production'
      ?await api.pickupReadiness(restaurantId):null;
    if(active){
     setRestaurant(r);setOptions(p);setAddresses(a);setStripeConfig(cfg);
     setSellerReadiness(readiness);
     if(!r.pickup_enabled&&p.delivery_checkout_supported===true&&p.delivery_quote_supported===true)
      setMode('delivery');
    }
   }).catch(e=>{if(active)setServerError(e instanceof Error?e.message:'Error verificando tu pedido.');})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[restaurantId,userId,refresh]);
 const address=addresses.find(a=>a.is_default)??addresses[0];
 // A missing Stripe environment response is never permission to take cash
 // in production. Both live methods require this merchant's Connect approval.
 const trustedEnvironment=stripeConfig?.environment==='production'||
   stripeConfig?.environment==='staging';
 const sellerApproved=trustedEnvironment&&
   (stripeConfig?.environment==='staging'||sellerReadiness?.ready===true);
 const cashEnabled=Boolean(sellerApproved&&
   (stripeConfig?.environment==='staging'||sellerReadiness?.cash_enabled===true)&&
   checkoutAllowed(options,mode,'cash'));
 const stripeEnabled=Boolean(sellerApproved&&
   (stripeConfig?.environment==='staging'||sellerReadiness?.stripe_enabled===true)&&
   stripePaymentAllowed(options,stripeConfig,mode));
 const stripeMode=stripePaymentMode(options,stripeConfig,mode);
 const canUse=method==='cash'?cashEnabled:stripeEnabled;
 const selectedRequest=useMemo(()=>{
  if(!restaurantId||!cart.entries.length||!canUse||mode==='delivery'&&!validAddress(address))return null;
  try{return buildCheckoutRequest(cart,mode,coupon,tip,address,method);}catch{return null;}
 },[cart,mode,coupon,tip,address,canUse,restaurantId,method]);
 const key=selectedRequest?fingerprint(selectedRequest):'';
 useEffect(()=>{
  let active=true;
  setQuote(null);setQuoteBusy(false);setError('');
  if(!selectedRequest)return ()=>{active=false};
  setQuoteBusy(true);
  // Debounce address, tip and coupon changes; never expose stale quotes.
  const timer=window.setTimeout(()=>{
   api.checkoutQuote(selectedRequest).then(raw=>{
    const verified=assertServerQuote(raw,selectedRequest);
    if(active)setQuote({fingerprint:key,value:verified});
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo cotizar el pedido.');})
    .finally(()=>{if(active)setQuoteBusy(false);});
  },350);
  return()=>{active=false;window.clearTimeout(timer);};
 },[key,quoteEpoch]);
 const displayed=quote?.fingerprint===key?quote.value:null;
 const ready=Boolean(user?.role==='customer'&&restaurant?.is_open&&
  (mode==='delivery'||restaurant?.pickup_enabled)&&selectedRequest&&displayed&&!loading&&!submitting&&!pending);
 const choose=(next:FulfillmentMode)=>{if(submitting||pending)return;setMode(next);setError('');};
 const reload=()=>{setQuote(null);setError('');setRefresh(v=>v+1);setQuoteEpoch(v=>v+1);};
 const recover=async()=>{
  if(!userId||!pending||rechecking)return;
  setRechecking(true);setError('');
  try{
   const order=await api.byReference(pending.reference);
   sessionStorage.removeItem(pendingStorageKey(userId));setPending(null);setCart({restaurantId:null,entries:[]});
   navigate(order.payment_method==='stripe'?'/pago/'+order.id:'/pedidos/'+order.id,{replace:true});
  }catch{setError('El resultado del pedido sigue sin confirmarse. No se enviará un segundo pedido. Consulta Pedidos o soporte.');}
  finally{setRechecking(false);}
 };
 const submit=async()=>{
  if(!ready||!userId||!selectedRequest||!displayed||lock.current||!restaurantId)return;
  lock.current=true;setSubmitting(true);setError('');
  try{
   if(!canUse)throw new Error('El servidor no autoriza el método seleccionado.');
   const freshOptions=await api.paymentOptions();
   const freshStripe=await api.stripeTestConfig();
   if(freshStripe.environment==='production'){
    const seller=await api.pickupReadiness(restaurantId);
    if(!seller.ready||(method==='cash'?!seller.cash_enabled:!seller.stripe_enabled))
     throw new Error('El restaurante aún no está autorizado para recibir este pedido LIVE.');
   }
   if(method==='cash'?!checkoutAllowed(freshOptions,mode,'cash'):
     !stripePaymentAllowed(freshOptions,freshStripe,mode))
    throw new Error('El método de pago dejó de estar disponible. Revisa el pago.');
   const freshMerchant=await api.restaurant(restaurantId);
   validateCartAgainstRestaurant(cart,freshMerchant);
   if(mode==='pickup'&&!freshMerchant.pickup_enabled)throw new Error('Recoger en tienda ya no está disponible.');
   const latest=assertServerQuote(await api.checkoutQuote(selectedRequest),selectedRequest);
   if(quoteMateriallyChanged(displayed,latest)){
    setQuote({fingerprint:key,value:latest});
    throw new Error('El servidor actualizó el total. Revisa el nuevo desglose antes de confirmar otra vez.');
   }
   const previous=readPending(userId);
   if(previous)throw new Error('Ya existe un pedido pendiente de confirmación. Consulta su estado antes de reintentar.');
   const reference=crypto.randomUUID().replace(/-/g,'');
   const record:PendingReference={userId,reference,fingerprint:key};
   sessionStorage.setItem(pendingStorageKey(userId),JSON.stringify(record));
   setPending(record);
   // After entering the pending journal, never auto-post twice on unknown outcomes.
   const result:Order=await api.createCheckoutOrder(selectedRequest,reference,notes,mode==='pickup'?'Recoger en '+freshMerchant.name:address!.address);
   sessionStorage.removeItem(pendingStorageKey(userId));setPending(null);setCart({restaurantId:null,entries:[]});
   navigate(method==='stripe'?'/pago/'+result.id:'/pedidos/'+result.id,{replace:true});
  }catch(e){setError(e instanceof Error?e.message:'No se pudo verificar el pedido.');}
  finally{lock.current=false;setSubmitting(false);}
 };
 if(!cart.entries.length&&!pending)return <div className="mobile-customer-page"><div className="mobile-detail-header"><Link to="/clientes"><ArrowLeft size={22}/></Link><h1>Finalizar pedido</h1></div><div className="mobile-status"><ShoppingBag size={30}/><h2>Tu carrito está vacío</h2><p>Agrega productos para continuar.</p><Link className="mobile-status-link" to="/clientes">Explorar restaurantes</Link></div></div>;
 return <div className="mobile-customer-page mobile-checkout" data-mobile-screen="checkout">
  <div className="mobile-detail-header"><Link to="/carrito" aria-label="Volver a carrito"><ArrowLeft size={22}/></Link><h1>Finalizar pedido</h1><button onClick={reload} disabled={loading||submitting} aria-label="Actualizar cotización"><RefreshCw size={19}/></button></div>
  {serverError&&<div className="mobile-address-error" role="alert">No logramos verificar tu pedido: {serverError}<button onClick={reload}>Reintentar</button></div>}
  {stripeConfig?.environment==='production'&&sellerReadiness?.ready===false&&
    <div className="mobile-address-error" role="alert">Este comercio todavía no está habilitado para recibir pedidos reales. El restaurante debe completar su autorización Stripe Connect antes de ofrecer efectivo o tarjeta.</div>}
  <section className="mobile-checkout-card"><h2>Entrega</h2><div className="mobile-checkout-modes">
   <button className={mode==='delivery'?'selected':''} aria-pressed={mode==='delivery'} disabled={loading||options?.delivery_checkout_supported!==true||submitting||Boolean(pending)} onClick={()=>choose('delivery')}><Truck size={24}/><span>A domicilio<small>{options?.delivery_checkout_supported===true?'Según disponibilidad':'Sujeto a activación'}</small></span></button>
   <button className={mode==='pickup'?'selected':''} aria-pressed={mode==='pickup'} disabled={loading||restaurant?.pickup_enabled!==true||submitting||Boolean(pending)} onClick={()=>choose('pickup')}><Store size={24}/><span>Recoger<small>Sin costo de envío</small></span></button>
  </div>
  {mode==='delivery'?<div className="mobile-checkout-address">
   <h3>Dirección de entrega</h3>{validAddress(address)?<p><MapPin size={18}/>{address.label}: {address.address}</p>:<p>No hay una dirección con coordenadas verificadas.</p>}
   <Link to="/direcciones" state={{returnTo:'/checkout'}}>Administrar direcciones <ChevronRight size={17}/></Link>
   {!cashEnabled&&!stripeEnabled&&<div className="mobile-checkout-note">La entrega a domicilio todavía no está autorizada para este método por el backend. No se podrá confirmar un pedido.</div>}
  </div>:<p className="mobile-checkout-note"><Store size={17}/> Recoge tu pedido en el establecimiento.</p>}
  </section>
  {mode==='delivery'&&<section className="mobile-checkout-card"><h2>Propina para repartidor</h2><div className="mobile-tip-options">{['0','10','20','30'].map(value=><button key={value} className={tip===value?'selected':''} disabled={submitting||Boolean(pending)} onClick={()=>{setTip(value);setError('');}}>{value==='0'?'Sin propina':pesos(value)}</button>)}</div><p className="mobile-checkout-disclosure">La propina se transfiere sin comisión de la plataforma.</p></section>}
  <section className="mobile-checkout-card"><h2>Pago</h2>
   <button className={'mobile-payment-method'+(method==='cash'&&cashEnabled?' selected':'')} disabled={!cashEnabled||loading||submitting||Boolean(pending)} aria-pressed={method==='cash'&&cashEnabled} onClick={()=>{setMethod('cash');setError('');}}>
    <Wallet size={22}/><span><strong>Efectivo</strong><small>{cashEnabled?(mode==='delivery'?'Paga al recibir tu pedido':'Paga al recoger tu pedido'):'Pendiente de activación del servidor'}</small></span>{method==='cash'&&cashEnabled&&<CheckCircle2 size={20}/>}
   </button>
   <button className={'mobile-payment-method'+(method==='stripe'&&stripeEnabled?' selected':'')} disabled={!stripeEnabled||loading||submitting||Boolean(pending)} aria-pressed={method==='stripe'&&stripeEnabled} onClick={()=>{setMethod('stripe');setError('');}}>
    <CreditCard size={22}/><span><strong>Tarjeta con Stripe</strong><small>{stripeEnabled?(stripeMode==='live'?'Pago real y seguro con Stripe':'Stripe TEST · método de prueba seguro'):'Disponible cuando el restaurante y el servidor autoricen Stripe'}</small></span>{method==='stripe'&&stripeEnabled&&<CheckCircle2 size={20}/>}
   </button>
   <p className="mobile-checkout-disclosure">Los métodos disponibles y el cobro los confirma el servidor.</p>
  </section>
  <section className="mobile-checkout-card"><h2>Cupón</h2><input className="mobile-checkout-input" maxLength={50} value={coupon} disabled={submitting||Boolean(pending)} onChange={e=>{setCoupon(e.target.value);setError('');}} placeholder="Código de descuento (opcional)" aria-label="Código de descuento"/></section>
  <section className="mobile-checkout-card"><h2>Notas para restaurante</h2><textarea className="mobile-checkout-input" maxLength={1000} rows={2} value={notes} disabled={submitting||Boolean(pending)} onChange={e=>setNotes(e.target.value)} placeholder="Instrucciones especiales (opcional)"/></section>
  <div className="mobile-quote-status" role="status" aria-live="polite">{quoteBusy?<><RefreshCw size={16} className="spin"/> Calculando el total…</>:displayed?<><CheckCircle2 size={16}/> Total verificado por el servidor</>:<><Info size={16}/> Esperando una cotización válida</>}</div>
  <OrderSummary quote={displayed} delivery={mode==='delivery'} cart={cart} options={options} tip={tip} coupon={coupon}/>
  {error&&<div className="mobile-address-error" role="alert"><Info size={16}/>{error}</div>}
  {pending&&<div className="mobile-checkout-pending"><strong>Pedido pendiente de confirmación</strong><p>No volveremos a enviarlo mientras no podamos comprobar qué sucedió.</p><button disabled={rechecking} onClick={()=>void recover()}>{rechecking?'Consultando…':'Consultar pedido pendiente'}</button></div>}
  <div className="mobile-checkout-actions"><button className="mobile-checkout-fixed" disabled={!ready} aria-busy={submitting} onClick={()=>void submit()}>{submitting?'Confirmando pedido…':pending?'Pedido en verificación':quoteBusy?'Calculando total…':!displayed?'Verifica tu pedido':method==='stripe'?(stripeMode==='live'?'Continuar a pago seguro con Stripe':'Continuar a Stripe TEST'):'Confirmar pedido'} <ChevronRight size={19}/></button></div>
 </div>;
}
