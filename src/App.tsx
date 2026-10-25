import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bike, CheckCircle2, ChefHat, Clock3, Coffee, Compass, LogIn, Menu, Minus, Plus, RefreshCw, ShieldCheck, ShoppingBag, ShoppingCart, UserRound, WifiOff, X, Heart, Star } from 'lucide-react';
import { api, ApiError, isDriverRole, isMerchantRole, pesos, safeImage } from './lib/api';
import { EMPTY_CART, addItem, basketTotal, lineItems, updateQuantity } from './lib/cart';
import type { Cart } from './lib/cart';
import { useSession } from './lib/session';
import type { MenuItem, Order } from './lib/types';
import { CustomerHome, CustomerSearch, CustomerDock } from './customer/CustomerExperience';
import { CustomerOrders, CustomerAccount } from './customer/CustomerPanels';
import { CustomerStartup } from './customer/CustomerStartup';
import { CustomerWelcome, CustomerMethods } from './customer/CustomerJourney';
import { CustomerStepAuth } from './customer/CustomerStepAuth';
import { CustomerWallet, CustomerNotifications, CustomerSupport } from './customer/CustomerExtras';
import { CustomerAuth } from './customer/CustomerAuth';
import { CustomerLegal } from './customer/CustomerLegal';

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
function InstallPWA(){
 const [prompt,setPrompt]=useState<(Event & {prompt:()=>Promise<void>})|null>(null);
 const [ios,setIos]=useState(false);
 useEffect(()=>{
  const show=(event:Event)=>{event.preventDefault();setPrompt(event as Event & {prompt:()=>Promise<void>});};
  window.addEventListener('beforeinstallprompt',show);
  setIos(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches);
  return()=>window.removeEventListener('beforeinstallprompt',show);
 },[]);
 if(prompt)return <button className="text-button install" onClick={()=>{void prompt.prompt();setPrompt(null);}}>Instalar la app</button>;
 if(ios)return <span className="install-tip" title="En Safari: Compartir → Agregar a inicio">Agregar a inicio desde Safari</span>;
 return null;
}
function AppHeader({count}:{count:number}){
 const session=useSession();const [menuOpen,setMenuOpen]=useState(false);const location=useLocation();
 useEffect(()=>setMenuOpen(false),[location.pathname]);
 return <header className="site-header"><div className="topbar container">
  <Link to="/" className="brand" aria-label="Tala Eats inicio"><span className="brand-mark"><ChefHat size={23} strokeWidth={2.4}/></span><span className="brand-name">Tala <b>Eats</b><small>COMERCIO LOCAL</small></span></Link>
  <nav className={'navlinks '+(menuOpen?'open':'')} aria-label="Navegación principal">
   <NavLink to="/clientes">Explorar</NavLink><NavLink to="/pedidos">Mis pedidos</NavLink>
   <NavLink to="/restaurante">Restaurantes</NavLink><NavLink to="/repartidor">Repartidores</NavLink>
  </nav>
  <div className="header-actions"><InstallPWA/>
    <Link className="header-cart" to="/carrito" aria-label={'Carrito con '+count+' artículos'}><ShoppingBag size={21}/>{count>0&&<span className="cart-dot">{count}</span>}</Link>
    {session.user?<Link className="user-pill" to="/cuenta"><UserRound size={18}/><span>{session.user.name.split(' ')[0]}</span></Link>:<Link className="user-pill" to="/acceso"><LogIn size={18}/><span>Entrar</span></Link>}
    <button className="icon-button nav-toggle" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menú">{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
  </div>
 </div></header>;
}
function AppFooter(){return <footer className="footer"><div className="container footer-inner"><div><strong>Tala Eats</strong><p>La comida de aquí, contigo. Hecho para la comunidad de Tala y la región.</p></div><div><Link to="/clientes">Descubrir</Link><Link to="/restaurante">Soy comercio</Link><Link to="/repartidor">Soy repartidor</Link></div><div className="foot-note">Versión Web PWA · Los pagos y entregas dependen de la disponibilidad real de cada comercio.</div></div></footer>;}
function PortalLanding(){
 const [menuOpen,setMenuOpen]=useState(false);
 const links=[
  {title:'Pedir comida',description:'Explora restaurantes y tiendas cerca de ti',path:'/clientes',number:'01'},
  {title:'Restaurantes',description:'Pedidos, menús y gestión de tu comercio',path:'/restaurante',number:'02'},
  {title:'Repartidores',description:'Tu espacio para gestionar entregas',path:'/repartidor',number:'03'},
 ];
 return <div className="gateway">
  <header className="gateway-header" aria-label="Encabezado Tala Eats">
   <Link to="/" className="gateway-brand" aria-label="Tala Eats, inicio"><span>Tala</span><b>Eats</b><span className="gateway-brand-dot"/></Link>
   <div className="gateway-header-actions">
    <Link className="gateway-login" to="/acceso" state={{from:'/clientes'}}>Entrar</Link>
    <Link className="gateway-signup" to="/acceso" state={{create:true,from:'/clientes'}}>Registrarse</Link>
    <button type="button" className="gateway-menu-toggle" aria-label={menuOpen?'Cerrar menú':'Abrir menú'} aria-expanded={menuOpen} aria-controls="gateway-menu" onClick={()=>setMenuOpen(x=>!x)}>{menuOpen?<X size={22}/>:<Menu size={23}/>}</button>
   </div>
   {menuOpen&&<nav className="gateway-menu" id="gateway-menu" aria-label="Accesos principales">
    {links.map(item=><Link key={item.path} to={item.path} onClick={()=>setMenuOpen(false)}>{item.title}<ArrowRight size={18}/></Link>)}
    <Link to="/pedidos" onClick={()=>setMenuOpen(false)}>Mis pedidos<ArrowRight size={18}/></Link>
   </nav>}
  </header>
  <main className="gateway-main">
   <div className="gateway-heading"><p className="gateway-kicker"><span className="gateway-kicker-dot"/> TU CIUDAD, A TU ALCANCE</p>
    <h1>Tala<span>Eats</span></h1><p className="gateway-tagline">Todo lo bueno de aquí, en un solo lugar.</p>
   </div>
   <nav className="gateway-portals" aria-label="Elige cómo usar Tala Eats">
    <p className="gateway-choose">¿Cómo quieres empezar?</p>
    {links.map(item=><Link className="gateway-portal" to={item.path} key={item.path}>
     <span className="gateway-portal-text"><strong>{item.title}</strong><small>{item.description}</small></span>
     <span className="gateway-portal-arrow" aria-hidden="true"><ArrowRight size={35} strokeWidth={1.7}/></span>
    </Link>)}
   </nav>
  </main>
  <footer className="gateway-footer"><div><span className="gateway-footer-brand">Tala Eats</span><p>Hecho para Tala y nuestra región.</p></div><div><Link to="/clientes">Explorar comercios</Link><Link to="/acceso">Mi cuenta</Link><InstallPWA/></div><span className="gateway-copyright">© 2026 TALA EATS</span></footer>
 </div>;
}
function Commerce({add}:{add:(item:MenuItem)=>void}){
 const {id}=useParams();const parsed=Number(id);const good=Number.isSafeInteger(parsed)&&parsed>0;
 const {value:r,loading,error,refresh}=useLoad(()=>good?api.restaurant(parsed):Promise.reject(Error('Comercio inválido')),[parsed]);
 const [filter,setFilter]=useState('Todos');
 const [favorite,setFavorite]=useState(false);
 const [headerCompact,setHeaderCompact]=useState(false);
 useEffect(()=>{window.scrollTo(0,0);},[parsed]);
 useEffect(()=>{
  const track=()=>setHeaderCompact(window.scrollY>160);
  track();
  window.addEventListener('scroll',track,{passive:true});
  return ()=>window.removeEventListener('scroll',track);
 },[]);
 useEffect(()=>{try{setFavorite(window.localStorage.getItem('tala-eats-favorite-'+parsed)==='1');}catch{setFavorite(false);}},[parsed]);
 const toggleFavorite=()=>{const next=!favorite;setFavorite(next);try{if(next)localStorage.setItem('tala-eats-favorite-'+parsed,'1');else localStorage.removeItem('tala-eats-favorite-'+parsed);}catch{/* Browser may disable storage */}};
 const categories=['Todos',...new Set((r?.menu_items??[]).map(i=>i.category||'General'))];
 const products=(r?.menu_items??[]).filter(i=>filter==='Todos'||(i.category||'General')===filter);
 const rating=r?.rating?Number(r.rating):0;
 return <div className="te-customer-commerce te-motion-page">
  <div className={"te-commerce-header"+(headerCompact?" compact":"")}>
   <Link to="/clientes" className="te-commerce-back" aria-label="Regresar a Inicio"><ArrowLeft size={21}/></Link>
   <span>{headerCompact?r?.name||"Restaurante":""}</span>
   <button type="button" className="te-commerce-fav" aria-label={favorite?'Quitar de favoritos':'Agregar a favoritos'} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={20} fill={favorite?'currentColor':'none'}/></button>
  </div>
  {loading?<div className="te-commerce-loading" role="status"><Spinner/></div>:
   error?<div className="te-commerce-loading"><Alert>{error} <button onClick={refresh}>Reintentar</button></Alert></div>:
   r&&<>
    <div className="te-commerce-hero">
      {safeImage(r.cover_image_url)?<img src={safeImage(r.cover_image_url)!} alt={r.name} loading="eager"/>:<div className="te-commerce-hero-fallback"><Coffee size={64}/></div>}
    </div>
    <div className="te-commerce-content">
      <div className="te-commerce-info te-motion-reveal">
       <h1>{r.name}</h1>
       {(r.cuisine||r.description)&&<p className="te-commerce-category">{r.cuisine||r.description}</p>}
       {r.description&&r.cuisine&&<p className="te-commerce-desc">{r.description}</p>}
       <div className="te-commerce-facts">
         {Number.isFinite(rating)&&rating>0&&rating<=5&&<span><Star size={16} fill="currentColor"/>{rating.toFixed(1)}</span>}
         {typeof r.eta_min==='number'&&r.eta_min>0&&<span><Clock3 size={16}/>{r.eta_min} min</span>}
         {r.pickup_enabled&&<span><ShoppingBag size={16}/>Para recoger</span>}
       </div>
       {!r.is_open&&<Alert kind="info">Este comercio está cerrado por ahora. Puedes revisar el menú y pedir cuando vuelva a abrir.</Alert>}
       {!r.pickup_enabled&&<Alert kind="info">Este comercio no tiene habilitada la recogida de pedidos.</Alert>}
      </div>
      <div className="te-commerce-menu">
       <h2>Menú</h2>
       {categories.length>1&&<div className="te-commerce-categories" aria-label="Categorías del menú">
        {categories.map(c=><button key={c} type="button" className={filter===c?'selected':''} aria-pressed={filter===c} onClick={()=>setFilter(c)}>{c}</button>)}
       </div>}
       {products.length===0?
        <EmptyState icon={<Coffee size={30}/>} title="Menú no disponible por ahora" description="Este comercio todavía no tiene productos disponibles en esta categoría."/>:
        <div className="te-commerce-dishes">{products.map((product,index)=><article className="te-commerce-dish te-motion-reveal" key={product.id} style={{animationDelay:Math.min(index,7)*45+'ms'}}>
          <div className="te-commerce-dish-copy">
           <h3>{product.name}</h3>
           {product.description&&<p>{product.description}</p>}
           <strong>{pesos(product.price)}</strong>
           {(!product.is_available||product.stock<=0)&&<span className="te-commerce-unavailable">Agotado</span>}
          </div>
          <div className="te-commerce-dish-side">
           <div className="te-commerce-dish-media">{safeImage(product.image_url)?<img src={safeImage(product.image_url)!} loading="lazy" alt={product.name}/>:<Coffee size={24}/>}</div>
           <button type="button" className="te-commerce-dish-add" disabled={!r.is_open||!r.pickup_enabled||!product.is_available||product.stock<=0} onClick={()=>add(product)} aria-label={'Agregar '+product.name+' al carrito'}><Plus size={19}/></button>
          </div>
        </article>)}</div>}
      </div>
    </div>
   </>}
 </div>;
}

function Protected({role,children}:{role:'customer'|'restaurant'|'driver'|'any';children:ReactNode}){
 const {user,loading}=useSession();const location=useLocation();
 if(loading)return <div className="container page"><Spinner/></div>;
 if(!user)return <div className="container page"><EmptyState icon={<LogIn size={32}/>} title="Inicia sesión para continuar" description="Tu sesión es necesaria para ver información privada." action={<Link className="btn primary" to="/acceso" state={{from:location.pathname}}>Entrar a mi cuenta</Link>}/></div>;
 if((role==='customer'&&user.role!=='customer')||(role==='restaurant'&&!isMerchantRole(user.role))||(role==='driver'&&!isDriverRole(user.role)))return <div className="container page"><EmptyState icon={<ShieldCheck size={32}/>} title="Este acceso requiere otro rol" description="Tu cuenta no tiene permisos para esta sección. Los roles de restaurante y repartidor se autorizan desde administración." action={<Link className="btn outline" to="/">Volver al inicio</Link>}/></div>;
 return <>{children}</>;
}
function CartPage({cart,setCart}:{cart:Cart;setCart:(v:Cart)=>void}){
 const {user}=useSession();
 const [notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Order|null>(null);
 const [reference,setReference]=useState<string|null>(null);
 const items=useMemo(()=>lineItems(cart),[cart]);
 const detail=useLoad(()=>cart.restaurantId?api.restaurant(cart.restaurantId):Promise.reject(Error('Carrito vacío')),[cart.restaurantId]);
 const quote=useLoad(()=>cart.restaurantId&&items.length&&user?api.quote(cart.restaurantId,items):Promise.reject(Error('Inicia sesión y agrega productos para obtener una cotización real.')),[cart.restaurantId,JSON.stringify(items),user?.id]);
 const methods=useLoad(()=>user?api.paymentOptions():Promise.reject(Error('Inicia sesión para ver medios de pago.')),[user?.id]);
 const cash=methods.value?.methods?.find(m=>m.id==='cash')?.enabled===true;
 const canCheckout=Boolean(cart.restaurantId&&items.length&&user?.role==='customer'&&quote.value&&cash&&detail.value?.is_open&&detail.value?.pickup_enabled);
 async function submit(){if(!canCheckout||!cart.restaurantId)return;setBusy(true);setError('');
  const ref=reference??crypto.randomUUID().replace(/-/g,'');setReference(ref);
  try{const order=await api.placeCashPickup(cart.restaurantId,items,ref,notes);setResult(order);setCart(EMPTY_CART);setReference(null);}
  catch(err){
   // Unknown network outcome: look up the SAME idempotency reference before retry.
   try{const existing=await api.byReference(ref);setResult(existing);setCart(EMPTY_CART);setReference(null);}
   catch{setError(err instanceof ApiError?err.message:'No pudimos confirmar el pedido. Consulta Mis pedidos antes de volver a intentarlo.');}
  }finally{setBusy(false);}
 }
 if(result)return <div className="container page"><EmptyState icon={<CheckCircle2 size={34}/>} title={'Pedido #'+result.id+' recibido'} description="Tu solicitud se guardó en el servidor. Consulta el estado antes de pasar a recogerlo." action={<Link className="btn primary" to="/pedidos">Ver mis pedidos</Link>}/></div>;
 return <div className="container page"><Link to="/clientes" className="back-link"><ArrowLeft size={18}/> Seguir explorando</Link><SectionTitle eyebrow="TU ELECCIÓN" title="Tu carrito" description="Confirma los productos antes de realizar el pedido."/>
 {!cart.entries.length?<EmptyState icon={<ShoppingCart size={32}/>} title="Tu carrito está vacío" description="Descubre algo delicioso y agrégalo aquí." action={<Link to="/clientes" className="btn primary">Ver comercios</Link>}/>:<div className="cart-layout"><div className="cart-items"><h3>{detail.value?.name||'Productos elegidos'}</h3>{cart.entries.map(e=><div key={e.item.id} className="cart-line"><div className="cart-icon">🍽️</div><div><strong>{e.item.name}</strong><small>{pesos(e.item.price)} por unidad</small></div><div className="qty"><button onClick={()=>setCart(updateQuantity(cart,e.item.id,-1))} aria-label="Quitar uno"><Minus size={15}/></button><b>{e.quantity}</b><button onClick={()=>setCart(updateQuantity(cart,e.item.id,1))} aria-label="Agregar uno"><Plus size={15}/></button></div></div>)}<label className="note-field">Notas para el restaurante<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ej. Sin cebolla..." rows={3}/></label></div><aside className="summary-card"><h3>Resumen de pedido</h3><p className="summary-line">Productos <strong>{pesos(basketTotal(cart))}</strong></p><p className="summary-line">Servicio y total <span>Calculados por el servidor</span></p><hr/>
 {quote.loading?<p className="muted">Consultando el precio real…</p>:quote.error?<Alert>{quote.error}</Alert>:quote.value?<div className="summary-total"><span>Total confirmado</span><strong>{pesos(quote.value.total)}</strong></div>:null}
 <div className="choice-note"><ShoppingBag size={19}/><div><strong>Recoger en el negocio</strong><span>Sin servicio de repartidor en esta versión LIVE.</span></div></div>
 {!user?<Link to="/acceso" state={{from:'/carrito'}} className="btn primary full">Entrar para pedir</Link>:user.role!=='customer'?<Alert kind="info">El pedido debe realizarse con una cuenta de cliente.</Alert>:<><div className="payment-choice">{methods.loading?'Cargando medios de pago…':<><span className="payment-radio">●</span><div><strong>Efectivo al recoger</strong><small>{cash?'Disponible según validación del restaurante':'No disponible por ahora'}</small></div></>}</div><p className="fineprint">La tarjeta requiere un flujo web Stripe verificado; no está habilitada en este MVP.</p><button className="btn primary full" disabled={busy||!canCheckout} onClick={()=>void submit()}>{busy?'Confirmando...':'Confirmar pedido'} <ArrowRight size={18}/></button></>}
 {error&&<Alert>{error}</Alert>}
 {!cash&&user&&<Alert kind="info">Los medios de pago dependen del backend y de la aprobación del restaurante. No se aceptarán pedidos sin autorización.</Alert>}
 </aside></div>}
 </div>;
}
function Merchant(){
 const [tab,setTab]=useState<'pedidos'|'menu'|'negocio'>('pedidos');const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const restaurant=useLoad(()=>api.ownerRestaurant(),[]),orders=useLoad(()=>api.ownerOrders(),[]),analytics=useLoad(()=>api.ownerAnalytics(),[]);
 const refresh=()=>{restaurant.refresh();orders.refresh();analytics.refresh();};
 async function status(id:number,s:'confirmed'|'preparing'|'ready'){setBusy(true);setMessage('');try{await api.ownerUpdateStatus(id,s);orders.refresh();setMessage('Estado actualizado en servidor.');}catch(e){setMessage(e instanceof Error?e.message:'Acción no disponible');}finally{setBusy(false);}}
 async function toggle(){if(!restaurant.value)return;setBusy(true);setMessage('');try{await api.ownerUpdateRestaurant({is_open:!restaurant.value.is_open});restaurant.refresh();setMessage('Disponibilidad actualizada.');}catch(e){setMessage(e instanceof Error?e.message:'Error al actualizar');}finally{setBusy(false);}}
 const [newName,setNewName]=useState(''),[newPrice,setNewPrice]=useState(''),[newStock,setNewStock]=useState(20);
 async function addProduct(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await api.ownerAddItem({name:newName,price:newPrice,stock:newStock,description:'',category:'General',is_available:true});setNewName('');setNewPrice('');restaurant.refresh();setMessage('Producto agregado.');}catch(e){setMessage(e instanceof Error?e.message:'No fue posible agregar');}finally{setBusy(false);}}
 return <div className="container page dashboard"><div className="dashboard-heading"><div><span className="eyebrow">PORTAL DE COMERCIOS</span><h1>Hola, {restaurant.value?.name||'comercio'} 👋</h1><p>Administra tu negocio con información del servidor.</p></div><button className="btn outline small" onClick={refresh}><RefreshCw size={17}/> Actualizar</button></div>
 {(restaurant.error||orders.error||analytics.error)&&<Alert>{restaurant.error||orders.error||analytics.error}</Alert>}{(restaurant.loading||orders.loading)?<Spinner/>:<>
 <div className="stats-grid"><div className="stat"><span>Pedidos</span><strong>{analytics.value?.orders??'—'}</strong><small>Histórico total</small></div><div className="stat"><span>Entregados</span><strong>{analytics.value?.delivered??'—'}</strong><small>Completados</small></div><div className="stat"><span>Venta entregada</span><strong>{pesos(analytics.value?.gross_sales)}</strong><small>Dato del backend</small></div><div className="stat"><span>Stock bajo</span><strong>{analytics.value?.inventory_low??'—'}</strong><small>Productos con pocas piezas</small></div></div>
 <div className="tabs"><button className={tab==='pedidos'?'active':''} onClick={()=>setTab('pedidos')}>Pedidos</button><button className={tab==='menu'?'active':''} onClick={()=>setTab('menu')}>Mi menú</button><button className={tab==='negocio'?'active':''} onClick={()=>setTab('negocio')}>Mi negocio</button></div>
 {message&&<Alert kind={message.includes('actualizad')||message.includes('agregado')?'success':'info'}>{message}</Alert>}
 {tab==='pedidos'&&(!orders.value?.length?<EmptyState icon={<ShoppingBag size={31}/>} title="Sin pedidos por ahora" description="Cuando el servidor reciba pedidos válidos, estarán en esta sección."/>:<div className="owner-order-grid">{orders.value.map(o=><div className="card padded" key={o.id}><div className="order-top"><div><span className="eyebrow">ORDEN #{o.id}</span><h3>{pesos(o.total)}</h3></div><StateTag state={o.status}/></div><p>{o.items?.map(i=>`${i.quantity} × ${i.name_snapshot}`).join(', ')}</p><p className="muted">{o.payment_method==='cash'?'Efectivo':'Stripe verificado'} · {o.order_type==='pickup'?'Recoger':'Domicilio'}</p><div className="action-buttons">{o.status==='received'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'confirmed')}>Aceptar</button>}{o.status==='confirmed'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'preparing')}>Preparando</button>}{o.status==='preparing'&&<button disabled={busy} className="btn primary small" onClick={()=>void status(o.id,'ready')}>Marcar listo</button>}{['ready','delivered'].includes(o.status)&&<span className="muted">{o.status==='ready'?'Esperando recogida':'Finalizado'}</span>}</div></div>)}</div>)}
 {tab==='menu'&&<><div className="owner-order-grid">{(restaurant.value?.menu_items??[]).map(p=><MenuEditor key={p.id} item={p} onSaved={restaurant.refresh}/>)}</div><div className="card padded add-menu"><h3>Agregar producto</h3><form onSubmit={addProduct} className="form-grid"><label>Nombre<input required minLength={2} maxLength={150} value={newName} onChange={e=>setNewName(e.target.value)}/></label><label>Precio (MXN)<input required pattern="[0-9]+(\\.[0-9]{1,2})?" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="89.00"/></label><label>Stock inicial<input type="number" min="0" step="1" value={newStock} onChange={e=>setNewStock(Number(e.target.value))}/></label><button className="btn primary" disabled={busy}>Agregar producto</button></form></div></>}
 {tab==='negocio'&&<div className="card padded business-settings"><h3>{restaurant.value?.name}</h3><p>{restaurant.value?.address||'Dirección sin publicar'}</p><p>Verificación: <strong>{restaurant.value?.verification_status??'sin datos'}</strong></p><p>Recogida: <strong>{restaurant.value?.pickup_enabled?'Activa':'Desactivada'}</strong></p><div className="space-between"><strong>{restaurant.value?.is_open?'El comercio aparece abierto':'El comercio está cerrado'}</strong><button className="btn outline" disabled={busy||!restaurant.value} onClick={()=>void toggle()}>{restaurant.value?.is_open?'Cerrar temporalmente':'Abrir comercio'}</button></div><p className="fineprint">Solo un comercio verificado puede abrirse. Los cobros reales requieren aprobación administrativa de Stripe Connect.</p></div>}
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
export default function App(){
 const [cart,setCart]=useState<Cart>(EMPTY_CART);const navigate=useNavigate();const location=useLocation();const isGateway=location.pathname==='/';const isCustomerTab=['/clientes','/buscar','/pedidos','/cuenta'].includes(location.pathname);const isCustomer=isCustomerTab||location.pathname.startsWith('/comercio/')||['/carrito','/bienvenida','/metodos','/acceso','/recuperar','/restablecer','/terminos','/privacidad','/wallet','/notificaciones','/soporte'].includes(location.pathname);
 const add=(item:MenuItem)=>{setCart(v=>addItem(v,item));};
 const count=cart.entries.reduce((sum,e)=>sum+e.quantity,0);
 return <div className={"app"+(isCustomer?" is-customer":"")}>{!isGateway&&!isCustomer&&<AppHeader count={count}/>}<main><Routes>
   <Route path="/" element={<PortalLanding/>}/>
   <Route element={<CustomerStartup/>}>
    <Route path="/clientes" element={<CustomerHome/>}/>
    <Route path="/buscar" element={<CustomerSearch/>}/>
    <Route path="/comercio/:id" element={<Commerce add={add}/>}/>
    <Route path="/carrito" element={<CartPage cart={cart} setCart={setCart}/>}/>
    <Route path="/pedidos" element={<Protected role="customer"><CustomerOrders/></Protected>}/>
    <Route path="/bienvenida" element={<CustomerWelcome/>}/>
    <Route path="/metodos" element={<CustomerMethods/>}/>
    <Route path="/acceso" element={<CustomerStepAuth/>}/>
    <Route path="/recuperar" element={<CustomerAuth/>}/>
    <Route path="/restablecer" element={<CustomerAuth/>}/>
    <Route path="/terminos" element={<CustomerLegal/>}/>
    <Route path="/privacidad" element={<CustomerLegal/>}/>
    <Route path="/cuenta" element={<Protected role="any"><CustomerAccount/></Protected>}/>
    <Route path="/wallet" element={<Protected role="customer"><CustomerWallet/></Protected>}/>
    <Route path="/notificaciones" element={<Protected role="customer"><CustomerNotifications/></Protected>}/>
    <Route path="/soporte" element={<Protected role="customer"><CustomerSupport/></Protected>}/>
   </Route>
   <Route path="/restaurante" element={<Protected role="restaurant"><Merchant/></Protected>}/>
   <Route path="/repartidor" element={<Protected role="driver"><Driver/></Protected>}/>
   <Route path="*" element={<div className="container page"><EmptyState icon={<WifiOff size={32}/>} title="No encontramos esta página" description="Regresa a Tala Eats para seguir explorando." action={<Link className="btn primary" to="/">Ir al inicio</Link>}/></div>}/>
 </Routes></main>{isCustomerTab&&<CustomerDock/>}{!isGateway&&!isCustomer&&<AppFooter/>}{location.pathname.startsWith('/comercio/')&&count>0&&<button className="mobile-cart-bar" onClick={()=>navigate('/carrito')}><ShoppingCart size={20}/> Ver carrito <span>{count} productos · {pesos(basketTotal(cart))}</span></button>}</div>;
}
