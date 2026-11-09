import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bike, CheckCircle2, ChefHat, Clock3, Coffee, Compass, LogIn, LogOut, MapPin, Menu, Minus, Package, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, ShoppingCart, Store, UserRound, WifiOff, X } from 'lucide-react';
import { api, ApiError, isDriverRole, isMerchantRole, pesos, safeImage } from './lib/api';
import { EMPTY_CART, addItem, basketTotal, lineItems, updateQuantity } from './lib/cart';
import type { Cart } from './lib/cart';
import { useSession } from './lib/session';
import type { MenuItem, Order, Restaurant } from './lib/types';
import {PUBLIC_DIRECTORY_PAGE_SIZE,joinRestaurantPages,
 filterRestaurantDirectory,nextDirectoryOffset} from './lib/catalogPagination';
import MerchantWorkspace from './merchant/MerchantWorkspace';

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
function FoodPicture({src,emoji,alt}:{src?:string|null;emoji?:string;alt:string}){const u=safeImage(src);return u?<img src={u} alt={alt} className="food-photo" loading="lazy" referrerPolicy="no-referrer"/>:<div className="food-placeholder" role="img" aria-label={alt}>{emoji||'🍽️'}</div>;}
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
function Home(){
 const {value:restaurants,loading,error,refresh}=useLoad(()=>api.restaurants(),[]);
 const [search,setSearch]=useState('');
 const [extra,setExtra]=useState<Restaurant[]>([]);
 const [hasMore,setHasMore]=useState(false);
 const [busyMore,setBusyMore]=useState(false);
 const [moreError,setMoreError]=useState('');
 const loadingController=useRef<AbortController|null>(null);
 useEffect(()=>{
  loadingController.current?.abort();
  loadingController.current=null;
  setExtra([]);
  setBusyMore(false);
  setMoreError('');
  setHasMore(Array.isArray(restaurants)&&restaurants.length===PUBLIC_DIRECTORY_PAGE_SIZE);
 },[restaurants]);
 useEffect(()=>()=>loadingController.current?.abort(),[]);
 const loaded=useMemo(()=>joinRestaurantPages(restaurants??[],extra),[restaurants,extra]);
 const filtered=useMemo(()=>filterRestaurantDirectory(loaded,search),[loaded,search]);
 const loadMore=async()=>{
  if(busyMore||!restaurants||!hasMore)return;
  const ctrl=new AbortController();
  loadingController.current=ctrl;
  setBusyMore(true);
  setMoreError('');
  try{
   const rows=await api.restaurantsPage(
    nextDirectoryOffset(restaurants,extra),PUBLIC_DIRECTORY_PAGE_SIZE,ctrl.signal);
   if(ctrl.signal.aborted)return;
   if(!Array.isArray(rows)||rows.length>PUBLIC_DIRECTORY_PAGE_SIZE||
     rows.some(row=>!row||!Number.isSafeInteger(row.id)||row.id<=0))
    throw Error('El catálogo devolvió una página inválida.');
   // Preserve raw page size for offsets; display is deduplicated by store ID.
   setExtra(previous=>[...previous,...rows]);
   setHasMore(rows.length===PUBLIC_DIRECTORY_PAGE_SIZE);
  }catch(e){
   if(!ctrl.signal.aborted)
    setMoreError(e instanceof Error?e.message:'No se pudieron cargar más comercios.');
  }finally{
   if(!ctrl.signal.aborted)setBusyMore(false);
   if(loadingController.current===ctrl)loadingController.current=null;
  }
 };
 return <><section className="hero"><div className="container hero-grid"><div className="hero-copy">
  <div className="hero-kicker"><MapPin size={15}/> Hecho en Tala, Jalisco</div><h1>Lo rico de <em>tu ciudad</em>, a un clic.</h1>
  <p>Descubre restaurantes y comercios locales. Elige lo que se te antoja y recógelo cuando esté listo.</p>
  <a href="#comercios" className="btn primary">Explorar comercios <ArrowRight size={18}/></a>
  <div className="hero-mini"><span><CheckCircle2 size={17}/> Negocios locales</span><span><ShieldCheck size={17}/> Pedido protegido</span></div>
 </div><div className="hero-art" aria-hidden="true"><div className="art-circle art-circle-one"/><div className="art-circle art-circle-two"/><div className="art-card center-card"><span className="art-emoji">🌮</span><strong>Antojos cerca de ti</strong><small>Sabores que nos unen</small></div><div className="art-float float-left">🍔 <span>Recién hecho</span></div><div className="art-float float-right">🥑 <span>Fresco y local</span></div></div></div></section>
 <section id="comercios" className="container section"><div className="section-title-row"><SectionTitle eyebrow="DESCUBRE" title="¿Qué se te antoja hoy?" description="Encuentra comercios verificados y revisa su menú."/><span className="muted">{filtered.length} de {loaded.length} comercios cargados</span></div>
  <label className="search-wrap"><Search size={21}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busca comida, tiendas o tu restaurante favorito" aria-label="Buscar comercios"/></label>
  {loading?<Spinner/>:error?<Alert><span>{error}</span> <button onClick={refresh}>Reintentar</button></Alert>:filtered.length===0?<EmptyState icon={<Store size={32}/>} title="No hay coincidencias entre los comercios cargados" description={search?'Prueba con otra búsqueda o carga más comercios para ampliar la búsqueda.':'Aún no hay comercios verificados publicados en los resultados cargados.'}/>:<div className="merchant-grid">{filtered.map(r=><Link to={'/comercio/'+r.id} className="merchant-card" key={r.id}><div className="merchant-cover"><FoodPicture src={r.cover_image_url} emoji={r.emoji||'🍲'} alt={r.name}/><span className={'open-label '+(r.is_open?'open':'closed')}>{r.is_open?'Abierto':'Cerrado'}</span></div><div className="merchant-body"><h3>{r.name}</h3><p>{r.cuisine||r.description||'Un sabor local'}</p><div className="merchant-meta"><span><Clock3 size={15}/>{r.eta_min??'—'} min</span><span><MapPin size={15}/> Tala y región</span></div></div></Link>)}</div>}
  {!loading&&!error&&<div className="directory-load-more" role="status" aria-live="polite">
   {moreError&&<div className="directory-load-error">{moreError} <button type="button" onClick={()=>void loadMore()}>Reintentar</button></div>}
   {hasMore&&<button type="button" className="directory-more-button" disabled={busyMore} onClick={()=>void loadMore()}>
    {busyMore?<><RefreshCw size={17} className="spin"/> Consultando comercios…</>:<>Cargar más comercios <ArrowRight size={17}/></>}
   </button>}
   {!hasMore&&loaded.length>0&&<small>Has llegado al final de los comercios publicados en esta lista.</small>}
   {hasMore&&Boolean(search.trim())&&<small>La búsqueda se realiza entre los comercios cargados. Puedes consultar más resultados con el botón.</small>}
  </div>}
 </section><section className="container section"><div className="benefit-grid"><div><span>🏡</span><strong>Apoya a los negocios de aquí</strong><p>Cada pedido impulsa a nuestra comunidad.</p></div><div><span>🛍️</span><strong>Compra sin complicaciones</strong><p>Consulta tu pedido y pasa a recogerlo.</p></div><div><span>🤝</span><strong>Hecho para todos</strong><p>Clientes, restaurantes y repartidores en un mismo lugar.</p></div></div></section></>;
}
function Commerce({add}:{add:(item:MenuItem)=>void}){
 const {id}=useParams();const parsed=Number(id);const good=Number.isSafeInteger(parsed)&&parsed>0;
 const {value:r,loading,error,refresh}=useLoad(()=>good?api.restaurant(parsed):Promise.reject(Error('Comercio inválido')),[parsed]);
 const [filter,setFilter]=useState('Todos');
 const categories=['Todos',...new Set((r?.menu_items??[]).map(i=>i.category||'General'))];
 const products=(r?.menu_items??[]).filter(i=>filter==='Todos'||(i.category||'General')===filter);
 return <div className="container page"><Link to="/clientes" className="back-link"><ArrowLeft size={18}/> Volver a comercios</Link>
 {loading?<Spinner/>:error?<Alert>{error} <button onClick={refresh}>Reintentar</button></Alert>:r&&<><div className="commerce-intro"><div className="commerce-pic"><FoodPicture src={r.cover_image_url} emoji={r.emoji||'🍽️'} alt={r.name}/></div><div><span className="eyebrow">COMERCIO LOCAL</span><h1>{r.name}</h1><p>{r.description||r.cuisine||'De Tala para ti'}</p><div className="commerce-info"><span><Clock3 size={18}/>{r.eta_min??'—'} min</span><span><MapPin size={18}/>{r.address||'Tala, Jalisco'}</span><span className={r.is_open?'text-green':'text-grey'}>{r.is_open?'● Abierto':'● Cerrado'}</span></div>{!r.pickup_enabled&&<Alert kind="info">Este comercio no tiene habilitada la recogida de pedidos.</Alert>}</div></div>
 <div className="section-title-row smaller"><SectionTitle eyebrow="EL MENÚ" title="Elige algo rico"/><span className="muted">{products.length} productos</span></div><div className="chips">{categories.map(c=><button key={c} className={'chip '+(c===filter?'active':'')} onClick={()=>setFilter(c)}>{c}</button>)}</div>
 {products.length===0?<EmptyState icon={<Coffee size={32}/>} title="Menú en preparación" description="Este comercio aún no publica productos en esta categoría."/>:<div className="product-grid">{products.map(p=><article className="product-card" key={p.id}><div className="product-pic"><FoodPicture src={p.image_url} emoji="🍴" alt={p.name}/></div><div className="product-content"><small>{p.category||'Especialidad'}</small><h3>{p.name}</h3><p>{p.description||'Hecho para disfrutar.'}</p><div className="product-bottom"><strong>{pesos(p.price)}</strong><button className="add-product" disabled={!r.is_open||!r.pickup_enabled||!p.is_available||p.stock<=0} onClick={()=>add(p)} title="Agregar al carrito"><Plus size={19}/></button></div>{(!p.is_available||p.stock<=0)&&<small className="text-grey">Agotado</small>}</div></article>)}</div>}
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
function Auth(){
 const {user,login,register}=useSession();const nav=useNavigate();const loc=useLocation();
 const [create,setCreate]=useState(Boolean((loc.state as {create?:boolean}|null)?.create)),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{
  if(create)await register(name,email,password);else await login(email,password,otp);
  const from=(loc.state as {from?:string}|null)?.from;
  nav(from?.startsWith('/')&&!from.startsWith('//')?from:'/cuenta',{replace:true});
 }catch(e){setError(e instanceof Error?e.message:'Error al iniciar sesión');}finally{setBusy(false);}};
 if(user)return <div className="container page"><EmptyState icon={<CheckCircle2 size={32}/>} title="Ya tienes una sesión activa" description={'Has iniciado sesión como '+user.name} action={<Link to="/cuenta" className="btn primary">Ir a mi cuenta</Link>}/></div>;
 return <div className="auth-page"><div className="auth-side"><span className="eyebrow">BIENVENIDO A TALA EATS</span><h1>Lo mejor de tu ciudad está aquí.</h1><p>Una sola cuenta para disfrutar los sabores de nuestra comunidad.</p><div className="auth-illustration">🥑 <span>🌮</span> 🍊</div></div><div className="auth-box"><div className="auth-card"><div className="auth-head"><span className="brand-mark"><ChefHat size={24}/></span><h2>{create?'Crea tu cuenta':'¡Qué bueno verte!'}</h2><p>{create?'Únete a Tala Eats.':'Ingresa para continuar tu experiencia.'}</p></div>
 {error&&<Alert>{error}</Alert>}<form onSubmit={submit} className="form-stack">
 {create&&<label>Nombre completo<input autoComplete="name" value={name} required minLength={2} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label>}
 <label>Correo electrónico<input type="email" autoComplete="email" value={email} required onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
 <label>Contraseña<input type="password" autoComplete={create?'new-password':'current-password'} value={password} required minLength={create?8:1} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
 {!create&&<label>Código de autenticación (si tienes 2FA)<input value={otp} maxLength={12} onChange={e=>setOtp(e.target.value)} inputMode="numeric" placeholder="Código de 6 dígitos"/></label>}
 <button className="btn primary full" disabled={busy}>{busy?'Un momento...':create?'Crear cuenta':'Entrar a Tala Eats'} <ArrowRight size={18}/></button></form>
 <p className="switch-auth">{create?'¿Ya tienes una cuenta?':'¿Todavía no tienes cuenta?'} <button className="link-inline" onClick={()=>{setCreate(!create);setError('');}}>{create?'Iniciar sesión':'Crear una cuenta'}</button></p>
 <p className="fineprint">Las cuentas nuevas son de cliente. Los permisos de comercio o repartidor requieren aprobación.</p></div></div></div>;
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
function Orders(){const {value,loading,error,refresh}=useLoad(()=>api.myOrders(),[]);return <div className="container page"><div className="section-title-row"><SectionTitle eyebrow="TU HISTORIAL" title="Mis pedidos" description="Consulta el estado real de tus compras."/><button className="btn outline small" onClick={refresh}><RefreshCw size={17}/> Actualizar</button></div>{loading?<Spinner/>:error?<Alert>{error}</Alert>:!value?.length?<EmptyState icon={<Package size={32}/>} title="Sin pedidos todavía" description="Cuando hagas tu primer pedido, aparecerá aquí." action={<Link to="/clientes" className="btn primary">Explorar</Link>}/>:<div className="order-list">{value.map(o=><article className="order-card" key={o.id}><div className="order-top"><div><span className="eyebrow">PEDIDO #{o.id}</span><h3>{pesos(o.total)}</h3><small>{new Date(o.created_at).toLocaleString('es-MX')}</small></div><StateTag state={o.status}/></div><p>{o.items?.map(i=>i.quantity+' × '+i.name_snapshot).join(', ')||'Productos del pedido'}</p><div className="order-bottom"><span><ShoppingBag size={16}/> {o.order_type==='pickup'?'Recoger en tienda':'Entrega'}</span><span>{o.payment_method==='cash'?'Efectivo':'Tarjeta'} · {o.payment_status}</span></div>{o.delivery_pin&&<p className="pin-hint">PIN de confirmación: <strong>{o.delivery_pin}</strong>. Compártelo solo al recibir tu pedido.</p>}</article>)}</div>}</div>;}
function Account(){const s=useSession(),nav=useNavigate();return <div className="container page narrow"><SectionTitle eyebrow="MI CUENTA" title="Tu perfil"/><div className="card padded"><div className="profile-row"><span className="profile-avatar"><UserRound size={27}/></span><div><h3>{s.user?.name}</h3><p>{s.user?.email}</p><small>Rol: {s.user?.role}</small></div></div><div className="account-links"><Link to="/pedidos"><Package size={20}/> Mis pedidos <ArrowRight size={17}/></Link>{isMerchantRole(s.user?.role)&&<Link to="/restaurante"><Store size={20}/> Panel restaurante <ArrowRight size={17}/></Link>}{isDriverRole(s.user?.role)&&<Link to="/repartidor"><Bike size={20}/> Panel repartidor <ArrowRight size={17}/></Link>}</div><button className="btn outline full" onClick={()=>void s.logout().then(()=>nav('/'))}><LogOut size={18}/> Cerrar sesión</button></div></div>;}
function Merchant(){return <MerchantWorkspace/>;}
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
 const [cart,setCart]=useState<Cart>(EMPTY_CART);const navigate=useNavigate();const location=useLocation();const isGateway=location.pathname==='/';
 const isMerchantRoute=location.pathname==='/restaurante'||location.pathname.startsWith('/restaurante/');
 const showSiteChrome=!isGateway&&!isMerchantRoute;
 const add=(item:MenuItem)=>{setCart(v=>addItem(v,item));};
 const count=cart.entries.reduce((sum,e)=>sum+e.quantity,0);
 return <div className="app">{showSiteChrome&&<AppHeader count={count}/>}<main><Routes>
   <Route path="/" element={<PortalLanding/>}/>
   <Route path="/clientes" element={<Home/>}/><Route path="/comercio/:id" element={<Commerce add={add}/>}/>
   <Route path="/carrito" element={<CartPage cart={cart} setCart={setCart}/>}/>
   <Route path="/pedidos" element={<Protected role="customer"><Orders/></Protected>}/>
   <Route path="/acceso" element={<Auth/>}/>
   <Route path="/cuenta" element={<Protected role="any"><Account/></Protected>}/>
   <Route path="/restaurante" element={<Protected role="restaurant"><Merchant/></Protected>}/>
   <Route path="/repartidor" element={<Protected role="driver"><Driver/></Protected>}/>
   <Route path="*" element={<div className="container page"><EmptyState icon={<WifiOff size={32}/>} title="No encontramos esta página" description="Regresa a Tala Eats para seguir explorando." action={<Link className="btn primary" to="/">Ir al inicio</Link>}/></div>}/>
 </Routes></main>{showSiteChrome&&<AppFooter/>}{showSiteChrome&&count>0&&<button className="mobile-cart-bar" onClick={()=>navigate('/carrito')}><ShoppingCart size={20}/> Ver carrito <span>{count} productos · {pesos(basketTotal(cart))}</span></button>}</div>;
}
