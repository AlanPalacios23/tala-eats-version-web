import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Heart, LogOut, Package, ReceiptText, RefreshCw, ShieldCheck, ShoppingBag, Store, UserRound, Wallet } from 'lucide-react';
import { api, pesos } from '../lib/api';
import type { Order } from '../lib/types';
import { useSession } from '../lib/session';
import './customer-more.css';

const finished = (order:Order):boolean =>
  ['delivered','cancelled','refunded','failed','completed'].includes(order.status);

function OrderIcon(){return <div className="te-order-icon"><ShoppingBag size={24}/></div>;}
const translated:Record<string,string> = {
  received:'Recibido',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',
  assigned:'Asignado',picked_up:'Recogido',on_the_way:'En camino',delivered:'Entregado',
  cancelled:'Cancelado',awaiting_payment:'Esperando pago',
};
function OrderStep({order}:{order:Order}) {
  const states=order.order_type==='delivery'?
   ['received','confirmed','preparing','ready','assigned','picked_up','on_the_way','delivered']:
   ['received','confirmed','preparing','ready','delivered'];
  const progress=states.indexOf(order.status);
  return <div className="te-order-steps" aria-label={'Estado: '+(translated[order.status]||order.status)}>
    {states.map((state,i)=><span key={state} className={'te-order-step'+(progress>=0&&i<=progress?' done':'')}/>)}
  </div>;
}
function CustomerOrderCard({order,onOpen}:{order:Order;onOpen:()=>void}) {
 const isDone=finished(order);
 return <button type="button" className={'te-order-card te-motion-reveal'+(isDone?' te-order-past':'')} onClick={onOpen}>
   <div className="te-order-card-top">
     <OrderIcon/>
     <div className="te-order-card-info"><strong>Pedido #{order.id}</strong>
       <span>{order.order_type==='pickup'?'Para recoger':'A domicilio'} · {pesos(order.total)}</span>
     </div>
     <span className={'te-order-state'+(isDone?' terminal':'')}>{translated[order.status]||order.status}</span>
   </div>
   {!isDone&&<OrderStep order={order}/>}
   <div className="te-order-card-end"><span>{new Date(order.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span>Ver pedido <ChevronRight size={17}/></span>
   </div>
 </button>;
}

export function CustomerOrders() {
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [tick,setTick]=useState(0);
 const [selected,setSelected]=useState<Order|null>(null);
 useEffect(()=>{
   let active=true;
   setLoading(true);setError('');
   api.myOrders().then(list=>{if(active)setOrders(Array.isArray(list)?list:[]);})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:'Error de conexión');})
    .finally(()=>{if(active)setLoading(false);});
   return ()=>{active=false;};
 },[tick]);
 const refresh=()=>setTick(v=>v+1);
 const active=orders.filter(o=>!finished(o));
 const past=orders.filter(finished);
 if(selected) return <div className="te-customer te-panel-page te-motion-page" key={'order-'+selected.id}>
   <div className="te-panel-inner">
    <button type="button" className="te-panel-back" onClick={()=>setSelected(null)}>‹ Volver a pedidos</button>
    <h1>Pedido #{selected.id}</h1>
    <div className="te-panel-card"><div className="te-order-card-top">
      <OrderIcon/><div className="te-order-card-info"><strong>{translated[selected.status]||selected.status}</strong>
      <span>{selected.order_type==='pickup'?'Para recoger':'A domicilio'}</span></div>
    </div><OrderStep order={selected}/></div>
    <div className="te-panel-card"><h2>Tu pedido</h2>
      {(selected.items||[]).map((line,i)=><div className="te-panel-amount" key={line.id??i}>
        <span>{line.quantity} × {line.name_snapshot}</span><span>{pesos(Number(line.unit_price)*line.quantity)}</span>
      </div>)}
      <div className="te-panel-amount total"><strong>Total</strong><strong>{pesos(selected.total)}</strong></div>
    </div>
    <div className="te-panel-card"><h2>Información de pago</h2><p>{selected.payment_method==='cash'?'Efectivo':'Stripe'} · {selected.payment_status}</p>
      {selected.delivery_pin&&<p className="te-pin-notice"><ShieldCheck size={17}/>PIN de entrega: <strong>{selected.delivery_pin}</strong>. Compártelo únicamente al recibir el pedido.</p>}
    </div>
   </div>
  </div>;
 return <div className="te-customer te-panel-page te-motion-page">
   <div className="te-panel-inner">
     <div className="te-panel-title-row"><h1>Pedidos</h1><button className="te-panel-refresh" aria-label="Actualizar pedidos" onClick={refresh} disabled={loading}><RefreshCw size={19}/></button></div>
     {loading?<div className="te-panel-loading" role="status">Cargando pedidos…</div>:
      error?<div className="te-panel-empty" role="alert"><ReceiptText size={30}/><h2>No pudimos cargar tus pedidos</h2><p>Revisa tu conexión e intenta actualizar el historial.</p><button onClick={refresh}>Reintentar</button></div>:
      orders.length===0?<div className="te-panel-empty" role="status"><ReceiptText size={31}/><h2>Aún no tienes pedidos</h2><p>Cuando hagas tu primer pedido podrás seguirlo aquí.</p><Link to="/clientes" className="te-panel-cta">Explorar restaurantes</Link></div>:
      <>
       {active.length>0&&<section className="te-panel-section"><h2>En curso <small>{active.length}</small></h2>
        <div className="te-order-list">{active.map(o=><CustomerOrderCard key={o.id} order={o} onOpen={()=>setSelected(o)}/>)}</div></section>}
       {past.length>0&&<section className="te-panel-section"><h2>Anteriores</h2>
        <div className="te-order-list">{past.map(o=><CustomerOrderCard key={o.id} order={o} onOpen={()=>setSelected(o)}/>)}</div></section>}
      </>}
   </div>
 </div>;
}

/** Flutter account grouping without inventing wallet/points API responses. */
export function CustomerAccount() {
 const {user,logout}=useSession();
 const navigate=useNavigate();
 const [loggingOut,setLoggingOut]=useState(false);
 const [confirm,setConfirm]=useState(false);
 const [showFavorites,setShowFavorites]=useState(false);
 const [favoriteShops,setFavoriteShops]=useState<Array<{id:number;name:string}>>([]);
 useEffect(()=>{
  if(!showFavorites) return;
  let mounted=true;
  api.restaurants().then(shops=>{
   if(!mounted)return;
   setFavoriteShops(shops.filter(shop=>{
      try{return localStorage.getItem('tala-eats-favorite-'+shop.id)==='1';}
      catch{return false;}
   }).map(({id,name})=>({id,name})));
  }).catch(()=>setFavoriteShops([]));
  return ()=>{mounted=false;};
 },[showFavorites]);
 const signOut=async()=>{setLoggingOut(true);try{await logout();navigate('/clientes');}finally{setLoggingOut(false);}};
 if(showFavorites)return <div className="te-customer te-panel-page te-motion-page"><div className="te-panel-inner">
   <button className="te-panel-back" onClick={()=>setShowFavorites(false)}>‹ Volver a Cuenta</button><h1>Favoritos</h1>
   <p className="te-panel-muted">Guardados en este navegador; no se sincronizan con tu cuenta.</p>
   {favoriteShops.length?favoriteShops.map(shop=><Link className="te-account-link" to={'/comercio/'+shop.id} key={shop.id}><Store size={19}/><span>{shop.name}</span><ChevronRight size={18}/></Link>):
    <div className="te-panel-empty"><Heart size={30}/><h2>Aún no tienes favoritos</h2><p>Guarda tus comercios desde Inicio.</p></div>}
  </div></div>;
 return <div className="te-customer te-panel-page te-motion-page">
  <div className="te-panel-inner">
    <h1>Cuenta</h1>
    <div className="te-account-profile te-motion-reveal">
       <span className="te-account-avatar"><UserRound size={27}/></span>
       <div className="te-account-info"><strong>{user?.name||'Tu perfil'}</strong><span>{user?.email||''}</span></div>
       <ChevronRight size={19} aria-hidden="true"/>
    </div>
    <div className="te-account-club te-motion-reveal">
      <span className="te-account-icon"><Wallet size={23}/></span>
      <div><strong>Tala Club</strong><span>Consulta de saldo y puntos: no disponible en la PWA todavía</span></div>
    </div>
    <section className="te-account-group">
      <h2>Tu cuenta</h2>
      <button className="te-account-link" onClick={()=>setShowFavorites(true)}><Heart size={20}/><span>Favoritos</span><ChevronRight size={19}/></button>
      <Link className="te-account-link" to="/pedidos"><Package size={20}/><span>Mis pedidos</span><ChevronRight size={19}/></Link>
      {(user?.role==='restaurant'||user?.role==='admin')&&<Link className="te-account-link" to="/restaurante"><Store size={20}/><span>Panel restaurante</span><ChevronRight size={19}/></Link>}
      {user?.role==='driver'&&<Link className="te-account-link" to="/repartidor"><Package size={20}/><span>Panel repartidor</span><ChevronRight size={19}/></Link>}
    </section>
    <section className="te-account-group">
      <h2>Seguridad y privacidad</h2>
      <div className="te-account-link te-account-info-static"><ShieldCheck size={20}/><span>Sesión protegida por el servidor</span></div>
    </section>
    <section className="te-account-group">
      <h2>Ayuda</h2>
      <p className="te-panel-muted">Para asistencia utiliza los canales oficiales de TALA EATS.</p>
    </section>
    {confirm?<div className="te-account-confirm" role="alertdialog" aria-label="Confirmar cierre de sesión">
      <strong>¿Cerrar sesión?</strong><p>Podrás volver a entrar con tu correo y contraseña.</p>
      <div><button onClick={()=>setConfirm(false)}>Cancelar</button><button disabled={loggingOut} onClick={()=>void signOut()}>{loggingOut?'Saliendo…':'Cerrar sesión'}</button></div>
    </div>:
      <button className="te-account-logout" onClick={()=>setConfirm(true)}><LogOut size={19}/>Cerrar sesión</button>}
  </div>
 </div>;
}
