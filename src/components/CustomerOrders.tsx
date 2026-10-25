import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Package, RefreshCw, ShoppingBag, WifiOff } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, pesos } from '../lib/api';
import { ORDER_LABELS, isCompletedOrder, orderProgress } from '../lib/mobile-parity';
import type { Order } from '../lib/types';

/** Source: Flutter Usuarios 1.0.46 OrdersScreen / ActiveOrderCard / PastOrderTile. */
function useOrders(){
 const [orders,setOrders]=useState<Order[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [refreshIndex,setRefreshIndex]=useState(0);
 const refresh=useCallback(()=>setRefreshIndex(n=>n+1),[]);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.myOrders().then(value=>{if(active)setOrders(value);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'No se pudo cargar el historial');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[refreshIndex]);
 return {orders,loading,error,refresh};
}
function OrderImage(){return <div className="mobile-order-image" aria-hidden="true"><ShoppingBag size={23}/></div>;}
function SegmentedProgress({order}:{order:Order}){
 const {steps,index}=orderProgress(order.status,order.order_type);
 return <div className="mobile-order-steps" aria-label={'Etapa '+(index+1)+' de '+steps.length}>{steps.map((step,i)=><span key={step.label} className={i<=index?'filled':''}/>)}</div>;
}
function ActiveCard({order}:{order:Order}){
 return <Link to={'/pedidos/'+order.id} className="mobile-active-order reveal-enter">
  <div className="mobile-order-card-header"><OrderImage/><div className="mobile-order-identity"><strong>Pedido #{order.id}</strong><span>{order.order_type==='delivery'?'A domicilio':'Para recoger'}</span></div><span className="mobile-order-pill">{ORDER_LABELS[order.status]||order.status}</span></div>
  <SegmentedProgress order={order}/>
  <div className="mobile-order-footer"><span>Pedido #{order.id} · {pesos(order.total)}</span><strong>Ver pedido <ChevronRight size={17}/></strong></div>
 </Link>;
}
function PastCard({order}:{order:Order}){
 const cancelled=order.status==='cancelled';
 return <Link to={'/pedidos/'+order.id} className="mobile-past-order reveal-enter">
  <OrderImage/><div className="mobile-past-copy"><strong>Pedido #{order.id}</strong><span>{pesos(order.total)} · {order.items?.reduce((n,item)=>n+item.quantity,0)??0} productos</span></div>
  <span className={'mobile-past-status '+(cancelled?'cancelled':'complete')}>{ORDER_LABELS[order.status]||order.status}</span>
 </Link>;
}
export function CustomerOrders(){
 const {orders,loading,error,refresh}=useOrders();
 const active=(orders??[]).filter(o=>!isCompletedOrder(o.status));
 const past=(orders??[]).filter(o=>isCompletedOrder(o.status));
 return <div className="mobile-customer-page mobile-orders" data-mobile-screen="orders">
  <div className="mobile-orders-heading"><h1>Pedidos</h1><button onClick={refresh} disabled={loading} aria-label="Actualizar pedidos"><RefreshCw size={20}/></button></div>
  {error&&<div className="mobile-orders-offline" role="status"><WifiOff size={18}/><span>No pudimos actualizar tus pedidos. {orders?'Se muestra el último estado consultado.':'Revisa tu conexión.'}</span><button onClick={refresh}>Reintentar</button></div>}
  {loading&&!orders?<div className="mobile-loading-order"><RefreshCw size={20} className="spin"/>Cargando tus pedidos…</div>:
   !orders?.length?<div className="mobile-status"><Package size={33}/><h2>{error?'No pudimos cargar tus pedidos':'Aún no tienes pedidos'}</h2><p>{error?'Puedes intentar actualizar el historial.':'Cuando hagas tu primer pedido podrás seguirlo aquí en tiempo real.'}</p><Link className="mobile-status-link" to="/clientes">Explorar restaurantes</Link></div>:
   <>{active.length>0&&<section className="mobile-orders-section"><div className="mobile-orders-section-head"><h2>En curso</h2><span>{active.length}</span></div>{active.map(order=><ActiveCard key={order.id} order={order}/>)}</section>}
    {past.length>0&&<section className="mobile-orders-section"><h2>Anteriores</h2>{past.map(order=><PastCard key={order.id} order={order}/>)}</section>}</>}
 </div>;
}
export function CustomerOrderDetail(){
 const {id}=useParams(),n=Number(id);
 const {orders,loading,error,refresh}=useOrders();
 const order=Number.isSafeInteger(n)?orders?.find(o=>o.id===n):null;
 return <div className="mobile-customer-page mobile-order-detail" data-mobile-screen="order-detail">
  <div className="mobile-detail-header"><Link to="/pedidos" aria-label="Volver a pedidos"><ArrowLeft size={22}/></Link><h1>Pedido #{id}</h1><button onClick={refresh} disabled={loading} aria-label="Actualizar estado"><RefreshCw size={20}/></button></div>
  {error&&<div className="mobile-orders-offline" role="status"><WifiOff size={18}/><span>No se pudo verificar el estado actual del pedido.</span><button onClick={refresh}>Reintentar</button></div>}
  {loading&&!orders?<div className="mobile-loading-order"><RefreshCw className="spin" size={19}/> Consultando pedido…</div>:
   !order?<div className="mobile-status"><Package size={30}/><h2>No encontramos este pedido</h2><p>Comprueba tu conexión o consulta tu historial.</p><Link to="/pedidos" className="mobile-status-link">Ver mis pedidos</Link></div>:
   <><section className="mobile-order-detail-hero"><span className="mobile-order-mini">Estado del pedido</span><h2>{ORDER_LABELS[order.status]||order.status}</h2><p>{order.order_type==='delivery'?'Entrega a domicilio':'Recoger en establecimiento'} · {pesos(order.total)}</p></section>
    {order.status!=='cancelled'&&<section className="mobile-order-timeline"><h3>Seguimiento</h3>{orderProgress(order.status,order.order_type).steps.map((step,i)=>{const current=orderProgress(order.status,order.order_type).index;return <div className={'mobile-order-timeline-step '+(i<current?'done':i===current?'current':'future')} key={step.label}><div className="mobile-order-step-indicator">{i<current?<Check size={14}/>:null}</div><span>{step.label}</span>{i===current&&<b>Ahora</b>}</div>;})}</section>}
    {order.status==='cancelled'&&<p className="mobile-order-cancelled">Este pedido fue cancelado.</p>}
    <section className="mobile-order-products"><h3>Tu pedido</h3>{order.items?.map((item,i)=><div key={i}><span>{item.quantity} × {item.name_snapshot}</span><strong>{pesos(item.unit_price)}</strong></div>)}
    <div className="mobile-detail-total"><span>Total</span><strong>{pesos(order.total)}</strong></div></section>
    {order.delivery_pin&&order.status!=='cancelled'&&<div className="mobile-order-pin"><strong>PIN de entrega: {order.delivery_pin}</strong><span>Compártelo únicamente cuando recibas tu pedido.</span></div>}
    <div className="mobile-order-payment">Pago: {order.payment_method==='cash'?'Efectivo':'Tarjeta'} · {order.payment_status}</div>
    <Link className="mobile-order-support" to={'/soporte?pedido='+order.id}>Ayuda con este pedido <ChevronRight size={18}/></Link>
    <p className="mobile-order-disclaimer">El estado y el pago se muestran tal como los informa el servidor. Actualiza para verificar los cambios.</p>
   </>}
 </div>;
}
