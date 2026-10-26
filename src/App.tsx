import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bike, Home as HomeIcon, ClipboardList, ChefHat, Compass, LogIn, Menu, RefreshCw, Search, ShieldCheck, ShoppingBag, ShoppingCart, UserRound, WifiOff, X } from 'lucide-react';
import { api, ApiError, isDriverRole, isMerchantRole, pesos } from './lib/api';
import { PREVIEW_READONLY } from './lib/preview';
import { EMPTY_CART, CUSTOMER_CART_STORAGE_KEY, restoreCustomerCart, addVariantItem, basketTotal } from './lib/cart';
import type { Cart } from './lib/cart';
import { useSession } from './lib/session';
import type { MenuItem, Order } from './lib/types';
import { CustomerHome, CustomerSearch } from './components/CustomerMobile';
import { CustomerCommerce } from './components/CustomerCommerce';
import { isMarketCode, PILOT_MARKET } from './lib/markets';
import type { MarketCode } from './lib/markets';
import { CustomerOrders, CustomerOrderDetail } from './components/CustomerOrders';
import { CustomerCart, CustomerCheckout } from './components/CustomerCheckout';
import { CustomerAddresses } from './components/CustomerAddresses';
import { CustomerProfile } from './components/CustomerProfile';
import { LEGAL_LINKS } from './lib/legal-links';
import { CustomerStripeTest } from './components/CustomerStripeTest';
import { AdminPickupConnect } from './components/AdminPickupConnect';
import { CustomerOrderChat } from './components/CustomerOrderChat';
import { CustomerLaunch } from './components/CustomerLaunch';
import { CustomerEntry, CustomerStepAuth } from './components/CustomerOnboarding';
import { CustomerAccount, CustomerWallet, CustomerNotifications, CustomerSupport, CustomerFavorites } from './components/CustomerAccount';
import {CustomerPwaInstallMenuButton} from './components/CustomerPwaInstall';

function ExternalLegalRedirect({href}:{href:string}){
 useEffect(()=>{window.location.replace(href)},[href]);
 return <div role="status" className="mobile-status">Abriendo el documento oficial de Tala Eats… <a href={href}>Abrir documento</a></div>;
}
type AsyncState<T>={value:T|null;loading:boolean;error:string};
function useLoad<T>(load:()=>Promise<T>,dependencies:unknown[]):AsyncState<T>&{refresh:()=>void} {
 const [tick,setTick]=useState(0); const [state,setState]=useState<AsyncState<T>>({value:null,loading:true,error:''});
 const refresh=()=>setTick(x=>x+1);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{let active=true;setState(s=>({...s,loading:true,error:''}));load().then(value=>{
  if(active)setState({value,loading:false,error:''});
 }).catch(err=>{if(active)setState({value:null,loading:false,error:err instanceof Error?err.message:'Error de conexión'});});
 return()=>{active=false;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[tick,...dependencies]);
 return {...state,refresh};
}
function Alert({children,kind='error'}:{children:ReactNode;kind?:'error'|'info'|'success'}) {return <div role="status" className={'alert '+kind}>{children}</div>;}
function Spinner(){return <div className="loading"><RefreshCw className="spin" size={20}/> Cargando información del servidor...</div>;}
function SectionTitle({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>;}
function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;}
function StateTag({state}:{state:string}){const tags:Record<string,string>={received:'Recibido',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',assigned:'Asignado',picked_up:'Recogido',on_the_way:'En camino',delivered:'Entregado',cancelled:'Cancelado',awaiting_payment:'Esperando pago'};return <span className={'status status-'+state}>{tags[state]??state}</span>;}
function AppHeader({count}:{count:number}){
 const session=useSession();const [menuOpen,setMenuOpen]=useState(false);const location=useLocation();
 useEffect(()=>setMenuOpen(false),[location.pathname]);
 return <header className="site-header"><div className="topbar container">
  <Link to="/" className="brand" aria-label="Tala Eats inicio"><span className="brand-mark"><ChefHat size={23} strokeWidth={2.4}/></span><span className="brand-name">Tala <b>Eats</b><small>COMERCIO LOCAL</small></span></Link>
  <nav className={'navlinks '+(menuOpen?'open':'')} aria-label="Navegación principal">
   <NavLink to="/clientes">Explorar</NavLink><NavLink to="/pedidos">Mis pedidos</NavLink>
   <NavLink to="/restaurante">Restaurantes</NavLink><NavLink to="/repartidor">Repartidores</NavLink>
  </nav>
  <div className="header-actions"><CustomerPwaInstallMenuButton/>
    <Link className="header-cart" to="/carrito" aria-label={'Carrito con '+count+' artículos'}><ShoppingBag size={21}/>{count>0&&<span className="cart-dot">{count}</span>}</Link>
    {session.user?<Link className="user-pill" to="/cuenta"><UserRound size={18}/><span>{session.user.name.split(' ')[0]}</span></Link>:<Link className="user-pill" to="/acceso"><LogIn size={18}/><span>Entrar</span></Link>}
    <button className="icon-button nav-toggle" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menú">{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
  </div>
 </div></header>;
}
function AppFooter(){return <footer className="footer"><div className="container footer-inner"><div><strong>Tala Eats</strong><p>La comida de aquí, contigo. Hecho para la comunidad de Tala y la región.</p></div><div><Link to="/clientes">Descubrir</Link><Link to="/restaurante">Soy comercio</Link><Link to="/repartidor">Soy repartidor</Link></div><div className="foot-note">Versión Web PWA · Los pagos y entregas dependen de la disponibilidad real de cada comercio.</div></div></footer>;}
function PortalLanding(){
 const links=[
  {title:'Pedir comida',description:'Explora restaurantes y tiendas cerca de ti',path:'/iniciar',number:'01'},
  {title:'Restaurantes',description:'Pedidos, menús y gestión de tu comercio',path:'/restaurante',number:'02'},
  {title:'Repartidores',description:'Tu espacio para gestionar entregas',path:'/repartidor',number:'03'},
 ];
 return <div className="gateway gateway-minimal">
  <header className="gateway-header" aria-label="Tala Eats">
   <Link to="/" className="gateway-brand" aria-label="Tala Eats, inicio"><span>Tala</span><b>Eats</b><span className="gateway-brand-dot"/></Link>
  </header>
  <main className="gateway-main">
   <nav className="gateway-portals" aria-label="Acceso a las aplicaciones de Tala Eats">
    {links.map(item=><Link className="gateway-portal" to={item.path} key={item.path}>
     <span className="gateway-portal-text"><strong>{item.title}</strong><small>{item.description}</small></span>
     <span className="gateway-portal-arrow" aria-hidden="true"><ArrowRight size={35} strokeWidth={1.7}/></span>
    </Link>)}
   </nav>
  </main>
  <footer className="gateway-footer" aria-label="Enlaces legales">
   <a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer">Términos y condiciones</a>
   <a href={LEGAL_LINKS.deletion} target="_blank" rel="noopener noreferrer">Eliminación de cuenta</a>
  </footer>
 </div>;
}
function Protected({role,children}:{role:'customer'|'restaurant'|'driver'|'admin'|'any';children:ReactNode}){
 const {user,loading}=useSession();const location=useLocation();
 if(loading)return <div className="container page"><Spinner/></div>;
 if(!user)return <Navigate to={role==='restaurant'||role==='driver'?'/acceso':'/iniciar'} replace state={{from:location.pathname}}/>;
 if((role==='customer'&&user.role!=='customer')||(role==='restaurant'&&!isMerchantRole(user.role))||(role==='driver'&&!isDriverRole(user.role))||(role==='admin'&&user.role!=='admin'))return <div className="container page"><EmptyState icon={<ShieldCheck size={32}/>} title="Este acceso requiere otro rol" description="Tu cuenta no tiene permisos para esta sección. Los roles de restaurante y repartidor se autorizan desde administración." action={<Link className="btn outline" to="/">Volver al inicio</Link>}/></div>;
 return <>{children}</>;
}
function CustomerGate({children}:{children:ReactNode}){
 const {user,loading}=useSession();const location=useLocation();
 if(loading)return <CustomerLaunch/>;
 // Catalog belongs to authenticated Usuarios, like the Flutter CustomerShell.
 // Returning from the gateway must display onboarding before any catalog data.
 if(!user)return <Navigate to="/iniciar" replace state={{from:location.pathname}}/>;
 if(user.role!=='customer')return <div className="mobile-status" role="alert">Esta cuenta pertenece a otra aplicación de TALA EATS.</div>;
 return <>{children}</>;
}
function Merchant(){
 const [tab,setTab]=useState<'pedidos'|'menu'|'negocio'>('pedidos');const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [connectState,setConnectState]=useState<{
  owner_approved:boolean;transfers_active:boolean;payouts_enabled:boolean;details_submitted:boolean
 }|null>(null);
 const [connectBusy,setConnectBusy]=useState(false),[connectError,setConnectError]=useState('');
 const [connectTick,setConnectTick]=useState(0);
 const [pickupPins,setPickupPins]=useState<Record<number,string>>({});
 const [cashConfirmed,setCashConfirmed]=useState<Record<number,boolean>>({});
 const restaurant=useLoad(()=>api.ownerRestaurant(),[]),orders=useLoad(()=>api.ownerOrders(),[]),analytics=useLoad(()=>api.ownerAnalytics(),[]);
 const refresh=()=>{restaurant.refresh();orders.refresh();analytics.refresh();setConnectTick(x=>x+1);};
 useEffect(()=>{
  let current=true;
  const restaurantId=restaurant.value?.id;
  setConnectState(null);setConnectError('');
  if(!restaurantId)return()=>{current=false;};
  api.ownerConnectStatus(restaurantId).then(x=>{if(current)setConnectState(x);})
   .catch(e=>{
    if(!current)return;
    setConnectState(null);
    if(!(e instanceof ApiError&&(e.status===403||e.status===404)))
     setConnectError('No fue posible verificar Stripe Connect. No aceptes pagos hasta confirmar el estado.');
   });
  return()=>{current=false;};
 },[restaurant.value?.id,connectTick]);
 const connectReady=Boolean(connectState?.owner_approved&&connectState.transfers_active&&
   connectState.payouts_enabled&&connectState.details_submitted);
 async function confirmConnectOwner(){
  if(!restaurant.value||connectBusy||!connectState||connectState.owner_approved)return;
  if(!window.confirm('¿Confirmas que eres el propietario de este comercio y autorizas asociarlo a tu cuenta Stripe Connect?'))return;
  setConnectBusy(true);setConnectError('');
  try{await api.ownerConfirmConnect(restaurant.value.id);setConnectTick(x=>x+1);}
  catch(e){setConnectError(e instanceof Error?e.message:'No se pudo confirmar la vinculación.');}
  finally{setConnectBusy(false);}
 }
 async function openConnectOnboarding(){
  if(!restaurant.value||!connectState?.owner_approved||connectBusy)return;
  setConnectBusy(true);setConnectError('');
  try{
   const result=await api.ownerConnectOnboardingLink(restaurant.value.id);
   const url=new URL(result.url);
   if(url.protocol!=='https:'||url.hostname!=='connect.stripe.com')
    throw new Error('Stripe devolvió un enlace de incorporación no autorizado.');
   window.location.assign(url.href);
  }catch(e){setConnectError(e instanceof Error?e.message:'No fue posible abrir Stripe Connect.');setConnectBusy(false);}
 }

 async function status(id:number,s:'confirmed'|'preparing'|'ready'){setBusy(true);setMessage('');try{await api.ownerUpdateStatus(id,s);orders.refresh();setMessage('Estado actualizado en servidor.');}catch(e){setMessage(e instanceof Error?e.message:'Acción no disponible');}finally{setBusy(false);}}
 async function completePickup(order:Order){
  if(busy||order.order_type!=='pickup'||order.status!=='ready')return;
  const pin=pickupPins[order.id]??'';
  if(!/^\\d{4}$/.test(pin)){setMessage('Solicita el PIN de 4 dígitos al cliente al entregar el pedido.');return;}
  if(order.payment_method==='cash'&&!cashConfirmed[order.id]){
   setMessage('Confirma que recibiste el efectivo antes de cerrar la recogida.');return;
  }
  if(order.payment_method==='stripe'&&order.payment_status!=='paid'){
   setMessage('El cobro Stripe todavía no está confirmado por el servidor.');return;
  }
  const question=order.payment_method==='cash'
   ?'¿El cliente recibió el pedido y cobraste '+pesos(order.total)+' en efectivo?'
   :'¿Entregaste este pedido, ya pagado con Stripe, al cliente con PIN correcto?';
  if(!window.confirm(question))return;
  setBusy(true);setMessage('');
  try{
   await api.ownerCompletePickup(order.id,pin);
   setPickupPins(v=>({...v,[order.id]:''}));
   setCashConfirmed(v=>({...v,[order.id]:false}));
   orders.refresh();analytics.refresh();
   setMessage('Pedido recogido y registrado por el servidor.');
  }catch(e){setMessage(e instanceof Error?e.message:'La entrega no pudo confirmarse; revisa el pedido.');}
  finally{setBusy(false);}
 }
 async function toggle(){if(!restaurant.value)return;setBusy(true);setMessage('');try{await api.ownerUpdateRestaurant({is_open:!restaurant.value.is_open});restaurant.refresh();setMessage('Disponibilidad actualizada.');}catch(e){setMessage(e instanceof Error?e.message:'Error al actualizar');}finally{setBusy(false);}}
 const [newName,setNewName]=useState(''),[newPrice,setNewPrice]=useState(''),[newStock,setNewStock]=useState(20);
 async function addProduct(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await api.ownerAddItem({name:newName,price:newPrice,stock:newStock,description:'',category:'General',is_available:true});setNewName('');setNewPrice('');restaurant.refresh();setMessage('Producto agregado.');}catch(e){setMessage(e instanceof Error?e.message:'No fue posible agregar');}finally{setBusy(false);}}
 return <div className="container page dashboard"><div className="dashboard-heading"><div><span className="eyebrow">PORTAL DE COMERCIOS</span><h1>Hola, {restaurant.value?.name||'comercio'} 👋</h1><p>Administra tu negocio con información del servidor.</p></div><button className="btn outline small" onClick={refresh}><RefreshCw size={17}/> Actualizar</button></div>
 {(restaurant.error||orders.error||analytics.error)&&<Alert>{restaurant.error||orders.error||analytics.error}</Alert>}{(restaurant.loading||orders.loading)?<Spinner/>:<>
 <div className="stats-grid"><div className="stat"><span>Pedidos</span><strong>{analytics.value?.orders??'—'}</strong><small>Histórico total</small></div><div className="stat"><span>Entregados</span><strong>{analytics.value?.delivered??'—'}</strong><small>Completados</small></div><div className="stat"><span>Venta entregada</span><strong>{pesos(analytics.value?.gross_sales)}</strong><small>Dato del backend</small></div><div className="stat"><span>Stock bajo</span><strong>{analytics.value?.inventory_low??'—'}</strong><small>Productos con pocas piezas</small></div></div>
 <div className="tabs"><button className={tab==='pedidos'?'active':''} onClick={()=>setTab('pedidos')}>Pedidos</button><button className={tab==='menu'?'active':''} onClick={()=>setTab('menu')}>Mi menú</button><button className={tab==='negocio'?'active':''} onClick={()=>setTab('negocio')}>Mi negocio</button></div>
 {message&&<Alert kind={message.includes('actualizad')||message.includes('agregado')?'success':'info'}>{message}</Alert>}
 {tab==='pedidos'&&(!orders.value?.length?<EmptyState icon={<ShoppingBag size={31}/>} title="Sin pedidos por ahora" description="Cuando el servidor reciba pedidos válidos, estarán en esta sección."/>:<div className="owner-order-grid">{orders.value.map(o=><div className="card padded" key={o.id}><div className="order-top"><div><span className="eyebrow">ORDEN #{o.id}</span><h3>{pesos(o.total)}</h3></div><StateTag state={o.status}/></div><p>{o.items?.map(i=>`${i.quantity} × ${i.name_snapshot}`).join(', ')}</p><p className="muted">{o.payment_method==='cash'?'Efectivo':'Stripe verificado'} · {o.order_type==='pickup'?'Recoger':'Domicilio'}</p><div className="action-buttons">{o.status==='received'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'confirmed')}>Aceptar</button>}{o.status==='confirmed'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'preparing')}>Preparando</button>}{o.status==='preparing'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'ready')}>Marcar listo</button>}{o.status==='ready'&&o.order_type==='pickup'&&<div className="pickup-handoff">
  <label className="muted">PIN del cliente
   <input type="password" inputMode="numeric" autoComplete="off" placeholder="4 dígitos"
    maxLength={4} pattern="[0-9]{4}" aria-label={'PIN de recogida pedido '+o.id}
    value={pickupPins[o.id]??''} disabled={busy}
    onChange={e=>setPickupPins(v=>({...v,[o.id]:e.target.value.replace(/\\D/g,'').slice(0,4)}))}/>
  </label>
  {o.payment_method==='cash'&&<label className="checkbox-label">
   <input type="checkbox" checked={cashConfirmed[o.id]===true} disabled={busy}
    onChange={e=>setCashConfirmed(v=>({...v,[o.id]:e.target.checked}))}/>
   Confirmo que recibí {pesos(o.total)} en efectivo
  </label>}
  <button className="btn primary small" disabled={busy||(pickupPins[o.id]??'').length!==4||
    (o.payment_method==='cash'&&!cashConfirmed[o.id])||
    (o.payment_method==='stripe'&&o.payment_status!=='paid')}
   onClick={()=>void completePickup(o)}>Confirmar recogida</button>
 </div>}{o.status==='ready'&&o.order_type!=='pickup'&&<span className="muted">Esperando repartidor</span>}
 {o.status==='delivered'&&<span className="muted">Finalizado</span>}</div></div>)}</div>)}
 {tab==='menu'&&<><div className="owner-order-grid">{(restaurant.value?.menu_items??[]).map(p=><MenuEditor key={p.id} item={p} onSaved={restaurant.refresh}/>)}</div><div className="card padded add-menu"><h3>Agregar producto</h3><form onSubmit={addProduct} className="form-grid"><label>Nombre<input required minLength={2} maxLength={150} value={newName} onChange={e=>setNewName(e.target.value)}/></label><label>Precio (MXN)<input required pattern="[0-9]+(\\.[0-9]{1,2})?" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="89.00"/></label><label>Stock inicial<input type="number" min="0" step="1" value={newStock} onChange={e=>setNewStock(Number(e.target.value))}/></label><button className="btn primary" disabled={busy}>Agregar producto</button></form></div></>}
 {tab==='negocio'&&<div className="card padded business-settings"><h3>{restaurant.value?.name}</h3><p>{restaurant.value?.address||'Dirección sin publicar'}</p><p>Verificación: <strong>{restaurant.value?.verification_status??'sin datos'}</strong></p><p>Recogida: <strong>{restaurant.value?.pickup_enabled?'Activa':'Desactivada'}</strong></p><div className="space-between"><strong>{restaurant.value?.is_open?'El comercio aparece abierto':'El comercio está cerrado'}</strong><button className="btn outline" disabled={busy||!restaurant.value} onClick={()=>void toggle()}>{restaurant.value?.is_open?'Cerrar temporalmente':'Abrir comercio'}</button></div><p className="fineprint">Solo un comercio verificado puede abrirse. Para aceptar pedidos LIVE se requiere cuenta Stripe Connect propia y confirmada, incluso cuando el cliente elige efectivo.</p>
 <section className="mobile-checkout-card" aria-label="Estado de Stripe Connect para recoger">
  <h3>Habilitación de pedidos para recoger</h3>
  <p>{connectReady?'Cuenta del comercio lista para revisión final de pedidos LIVE.':
    connectState?'Stripe Connect requiere completar las autorizaciones del negocio.':
    'Este comercio todavía no tiene una asociación Stripe Connect verificada. Solicita al administrador vincular tu cuenta empresarial.'}</p>
  {connectState&&<p className="fineprint">Propietario confirmado: {connectState.owner_approved?'Sí':'No'} · Datos enviados: {connectState.details_submitted?'Sí':'No'} · Transferencias: {connectState.transfers_active?'Activas':'Pendientes'} · Retiros: {connectState.payouts_enabled?'Habilitados':'Pendientes'}</p>}
  {connectError&&<p role="alert" className="mobile-address-error">{connectError}</p>}
  {connectState&&!connectState.owner_approved&&
   <button type="button" className="btn outline" disabled={connectBusy} onClick={()=>void confirmConnectOwner()}>Confirmar titularidad del negocio</button>}
  {connectState?.owner_approved&&!connectReady&&
   <button type="button" className="btn outline" disabled={connectBusy} onClick={()=>void openConnectOnboarding()}>Completar registro Stripe Connect</button>}
  <button type="button" className="btn outline small" disabled={connectBusy} onClick={()=>setConnectTick(x=>x+1)}>Volver a consultar</button>
 </section></div>}
 </>}
 </div>;
}
function MenuEditor({item,onSaved}:{item:MenuItem;onSaved:()=>void}){const [stock,setStock]=useState(item.stock),[available,setAvailable]=useState(item.is_available),[price,setPrice]=useState(item.price),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(){setBusy(true);setMessage('');try{await api.ownerUpdateItem(item.id,{stock,is_available:available,price});onSaved();setMessage('Guardado');}catch(e){setMessage(e instanceof Error?e.message:'Error');}finally{setBusy(false);}}
 return <div className="card padded menu-editor"><div><h3>{item.name}</h3><p>{item.category||'General'}</p></div><div className="form-grid"><label>Precio<input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/></label><label>Stock<input type="number" min="0" value={stock} onChange={e=>setStock(Number(e.target.value))}/></label><label className="checkbox-label"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/> Disponible</label><button className="btn outline small" disabled={busy} onClick={()=>void save()}>Guardar</button></div>{message&&<small role="status">{message}</small>}</div>;}
function Driver(){
 const {value:profile,loading,error,refresh}=useLoad(()=>api.driverProfile(),[]);
 const mine=useLoad(()=>api.driverMine(),[]),available=useLoad(()=>api.driverAvailable(),[]), dashboard=useLoad(()=>api.driverDashboard(),[]);
 const allowActions=import.meta.env.VITE_DRIVER_ACTIONS_ENABLED==='true';
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pin,setPin]=useState<Record<number,string>>({});
 const reload=()=>{refresh();mine.refresh();available.refresh();dashboard.refresh();};
 const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await fn();reload();setMessage('Actualizado en servidor.');}catch(e){setMessage(e instanceof Error?e.message:'Acción rechazada por el servidor');}finally{setBusy(false);}};
 return <div className="container page dashboard"><div className="dashboard-heading"><div><span className="eyebrow">PORTAL DE REPARTIDORES</span><h1>Tu ruta comienza aquí <Bike size={32} className="inline-icon"/></h1><p>Consulta tu perfil y los pedidos que te asigna el sistema.</p></div><button className="btn outline small" onClick={reload}><RefreshCw size={16}/> Actualizar</button></div>
 {!allowActions&&<Alert kind="info"><ShieldCheck size={18}/> El reparto con repartidor todavía no está habilitado para operación LIVE. Este portal no puede aceptar ni entregar pedidos reales hasta superar las pruebas financieras y operativas.</Alert>}
 {(error||mine.error||available.error)&&<Alert>{error||mine.error||available.error}</Alert>}
 {loading?<Spinner/>:<><div className="stats-grid driver-stats"><div className="stat"><span>Tu cuenta</span><strong>{profile?.is_verified?'Verificada':'Pendiente'}</strong><small>Validación del administrador</small></div><div className="stat"><span>Disponibilidad</span><strong>{profile?.is_online?'Conectado':'Desconectado'}</strong><small>Estado del servidor</small></div><div className="stat"><span>Entregas</span><strong>{profile?.total_deliveries??'—'}</strong><small>Acumulado</small></div></div>
 {allowActions&&<div className="card padded space-between"><span>Disponibilidad para nuevos pedidos</span><button className="btn outline" disabled={busy} onClick={()=>void act(()=>api.driverSetAvailability(!profile?.is_online))}>{profile?.is_online?'Desconectarme':'Conectarme'}</button></div>}
 {message&&<Alert kind="info">{message}</Alert>}
 <SectionTitle eyebrow="ASIGNACIONES" title="Mis entregas"/>{mine.loading?<Spinner/>:!mine.value?.length?<EmptyState icon={<Bike size={30}/>} title="Aún no tienes entregas" description="Cuando se habilite el reparto y recibas una asignación, aparecerá aquí."/>:<div className="owner-order-grid">{mine.value.map(o=><div className="card padded" key={o.id}><div className="order-top"><h3>Pedido #{o.id}</h3><StateTag state={o.status}/></div><p>Importe: {pesos(o.total)}</p><p>Pago repartidor: {pesos(o.driver_earning)}</p>{allowActions&&<div className="action-buttons">{o.status==='assigned'&&<button className="btn primary small" disabled={busy} onClick={()=>void act(()=>api.driverStatus(o.id,'picked_up'))}>He recogido</button>}{o.status==='picked_up'&&<button className="btn primary small" disabled={busy} onClick={()=>void act(()=>api.driverStatus(o.id,'on_the_way'))}>En camino</button>}{o.status==='on_the_way'&&<><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="PIN entrega" aria-label="PIN del pedido" value={pin[o.id]??''} onChange={e=>setPin(v=>({...v,[o.id]:e.target.value}))}/><button className="btn primary small" disabled={busy||!/^[0-9]{4}$/.test(pin[o.id]??'')} onClick={()=>void act(()=>api.driverComplete(o.id,pin[o.id]??''))}>Entregado</button></>}</div>}</div>)}</div>}
 <SectionTitle eyebrow="OFERTAS" title="Pedidos disponibles"/>{available.loading?<Spinner/>:!available.value?.length?<EmptyState icon={<Compass size={30}/>} title="Sin entregas disponibles" description="Las ofertas solo aparecen cuando el backend autoriza despacho y tu perfil está verificado."/>:<div className="owner-order-grid">{available.value.map(o=><div className="card padded" key={o.id}><h3>Pedido #{o.id}</h3><p>Ganancia prevista: {pesos(o.driver_earning)}</p>{allowActions&&<button className="btn primary small" disabled={busy} onClick={()=>void act(()=>api.driverAccept(o.id))}>Aceptar entrega</button>}</div>)}</div>}
 {dashboard.error&&<p className="muted">Resumen del repartidor no disponible.</p>}
 </>}</div>;
}
function CustomerBottomDock(){
 const location=useLocation();
 const tabs=[
  {to:'/clientes',label:'Inicio',Icon:HomeIcon},
  {to:'/buscar',label:'Buscar',Icon:Search},
  {to:'/pedidos',label:'Pedidos',Icon:ClipboardList},
  {to:'/cuenta',label:'Cuenta',Icon:UserRound}
 ];
 const onCustomerRoute=['/clientes','/buscar','/pedidos','/cuenta'].includes(location.pathname)||location.pathname.startsWith('/pedidos/')||location.pathname.startsWith('/pago/')||location.pathname.startsWith('/chat/');
 if(!onCustomerRoute)return null;
 return <nav className="customer-bottom-dock" aria-label="Navegación de clientes">
  {tabs.map(({to,label,Icon})=><Link key={label} to={to} className={'customer-dock-item '+((label==='Inicio'?location.pathname==='/clientes':(label==='Pedidos'&&location.pathname.startsWith('/pedidos/'))||location.pathname===to)?'selected':'')} aria-label={label}>
   <Icon size={22}/><span>{label}</span>
  </Link>)}
 </nav>;
}
function CustomerHashScroll(){
 const location=useLocation();
 useEffect(()=>{const viewport=document.querySelector('.customer-shell > main');if(viewport instanceof HTMLElement)viewport.scrollTop=0;else window.scrollTo(0,0);if(location.pathname==='/clientes'&&location.hash==='#comercios'){document.getElementById('comercios')?.scrollIntoView({behavior:'instant' as ScrollBehavior,block:'start'});}},[location.pathname,location.hash]);
 return null;
}
export default function App(){
 const session=useSession();
 const [cart,setCart]=useState<Cart>(()=>{try{return restoreCustomerCart(JSON.parse(sessionStorage.getItem(CUSTOMER_CART_STORAGE_KEY)||'null'));}catch{return EMPTY_CART;}});
 const lastUserId=useRef<number|null>(null);
 useEffect(()=>{
  const next=session.user?.id??null;
  if(lastUserId.current!==null&&lastUserId.current!==next)setCart(EMPTY_CART);
  lastUserId.current=next;
 },[session.user?.id]);
 useEffect(()=>{try{
  if(cart.entries.length)sessionStorage.setItem(CUSTOMER_CART_STORAGE_KEY,JSON.stringify(cart));
  else sessionStorage.removeItem(CUSTOMER_CART_STORAGE_KEY);
 }catch{/* Private browsing or storage full: in-memory cart remains functional. */}},[cart]);
 const [market,setMarket]=useState<MarketCode>(()=>{try{const stored=localStorage.getItem('talaeats-market-code');return stored&&isMarketCode(stored)?stored:PILOT_MARKET;}catch{return PILOT_MARKET;}});
 const navigate=useNavigate();const location=useLocation();const isGateway=location.pathname==='/';const isOnboarding=['/iniciar','/acceso'].includes(location.pathname);const isCustomerShell=['/iniciar','/clientes','/buscar','/pedidos','/cuenta','/carrito','/checkout','/direcciones','/tala-club','/notificaciones','/soporte','/favoritos','/editar-perfil','/acceso'].includes(location.pathname)||location.pathname.startsWith('/comercio/')||location.pathname.startsWith('/pedidos/');
 const selectMarket=(code:MarketCode):boolean=>{if(code===market)return true;if(cart.entries.length&&!window.confirm('Tienes un carrito activo. Para cambiar de localidad es necesario vaciarlo. ¿Cambiar de zona?'))return false;setCart(EMPTY_CART);setMarket(code);try{localStorage.setItem('talaeats-market-code',code);}catch{/* Privacy mode: keep market in memory. */}return true;};
 const add=(item:MenuItem,quantity:number,note:string):boolean=>{if(cart.restaurantId!==null&&cart.restaurantId!==item.restaurant_id){if(!window.confirm('Tu carrito tiene productos de otro restaurante. ¿Empezar un carrito nuevo?'))return false;}const updated=addVariantItem(cart,item,quantity,note);if(updated===cart)return false;setCart(updated);return true;};
 const count=cart.entries.reduce((sum,e)=>sum+e.quantity,0);
 if(session.loading && (location.pathname!=='/' && location.pathname!=='/restaurante' && location.pathname!=='/repartidor'))return <CustomerLaunch/>;
 return <div className={"app"+(isCustomerShell?" customer-shell":"")}>{PREVIEW_READONLY&&<div className="tala-review-banner" role="status"><strong>VISTA PREVIA</strong><span>Modo de revisión: pedidos, pagos y cambios de datos bloqueados. La información consultada puede proceder del backend existente.</span></div>}{!isGateway&&!isOnboarding&&<AppHeader count={count}/>}<CustomerHashScroll/><main><Routes>
   <Route path="/" element={<PortalLanding/>}/>
   <Route path="/iniciar" element={<CustomerEntry/>}/>
   <Route path="/clientes" element={<CustomerGate><CustomerHome market={market} onSelectMarket={selectMarket}/></CustomerGate>}/><Route path="/buscar" element={<CustomerGate><CustomerSearch market={market}/></CustomerGate>}/><Route path="/comercio/:id" element={<CustomerGate><CustomerCommerce cart={cart} onAdd={add} market={market}/></CustomerGate>}/>
   <Route path="/carrito" element={<CustomerCart cart={cart} setCart={setCart}/>}/><Route path="/checkout" element={<Protected role="customer"><CustomerCheckout cart={cart} setCart={setCart}/></Protected>}/><Route path="/pago/:id" element={<Protected role="customer"><CustomerStripeTest/></Protected>}/><Route path="/chat/:id" element={<Protected role="customer"><CustomerOrderChat/></Protected>}/><Route path="/direcciones" element={<Protected role="customer"><CustomerAddresses/></Protected>}/>
   <Route path="/pedidos" element={<Protected role="customer"><CustomerOrders/></Protected>}/><Route path="/pedidos/:id" element={<Protected role="customer"><CustomerOrderDetail/></Protected>}/>
   <Route path="/editar-perfil" element={<Protected role="customer"><CustomerProfile/></Protected>}/>
   <Route path="/terminos" element={<ExternalLegalRedirect href={LEGAL_LINKS.terms}/>}/><Route path="/aviso-privacidad" element={<ExternalLegalRedirect href={LEGAL_LINKS.privacy}/>}/>
   <Route path="/privacidad" element={<ExternalLegalRedirect href={LEGAL_LINKS.privacy}/>}/>
   <Route path="/eliminar-cuenta" element={<ExternalLegalRedirect href={LEGAL_LINKS.deletion}/>}/>
   <Route path="/acceso" element={<CustomerStepAuth/>}/>
   <Route path="/cuenta" element={<Protected role="any"><CustomerAccount/></Protected>}/><Route path="/tala-club" element={<Protected role="customer"><CustomerWallet/></Protected>}/><Route path="/notificaciones" element={<Protected role="customer"><CustomerNotifications/></Protected>}/><Route path="/soporte" element={<Protected role="customer"><CustomerSupport/></Protected>}/><Route path="/favoritos" element={<Protected role="customer"><CustomerFavorites/></Protected>}/>
   <Route path="/admin/conectar-restaurante" element={<Protected role="admin"><AdminPickupConnect/></Protected>}/>
   <Route path="/restaurante" element={<Protected role="restaurant"><Merchant/></Protected>}/>
   <Route path="/repartidor" element={<Protected role="driver"><Driver/></Protected>}/>
   <Route path="*" element={<div className="container page"><EmptyState icon={<WifiOff size={32}/>} title="No encontramos esta página" description="Regresa a Tala Eats para seguir explorando." action={<Link className="btn primary" to="/">Ir al inicio</Link>}/></div>}/>
 </Routes></main>{!isOnboarding&&<CustomerBottomDock/>}{!isGateway&&!isOnboarding&&<AppFooter/>}{!isGateway&&count>0&&location.pathname==='/clientes'&&<button className="mobile-cart-bar" onClick={()=>navigate('/carrito')}><ShoppingCart size={20}/> Ver carrito <span>{count} productos · {pesos(basketTotal(cart))}</span></button>}</div>;
}
