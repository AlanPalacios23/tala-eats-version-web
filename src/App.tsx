import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Home as HomeIcon, ClipboardList, ChefHat, LogIn, Menu, RefreshCw, Search, ShieldCheck, ShoppingBag, ShoppingCart, UserRound, WifiOff, X } from 'lucide-react';
import { isDriverRole, isMerchantRole, pesos } from './lib/api';
import { PREVIEW_READONLY } from './lib/preview';
import { restaurantPortalDestination } from './lib/restaurant-host';
import { EMPTY_CART, CUSTOMER_CART_STORAGE_KEY, restoreCustomerCart, addVariantItem, basketTotal } from './lib/cart';
import type { Cart } from './lib/cart';
import { useSession } from './lib/session';
import type { MenuItem } from './lib/types';
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
import { RestaurantAccess,RestaurantOnboarding,RestaurantWorkspace,RestaurantAdminActivation } from './components/RestaurantApp';
import { RestaurantWelcome } from './components/RestaurantWelcome';
import { CustomerOrderChat } from './components/CustomerOrderChat';
import { CustomerLaunch } from './components/CustomerLaunch';
import { CustomerEntry, CustomerStepAuth } from './components/CustomerOnboarding';
import { CustomerAccount, CustomerWallet, CustomerNotifications, CustomerSupport, CustomerFavorites } from './components/CustomerAccount';
import {CustomerPwaInstallMenuButton} from './components/CustomerPwaInstall';
import {DriverPwaWorkflow} from './components/DriverPwaWorkflow';

function ExternalLegalRedirect({href}:{href:string}){
 useEffect(()=>{window.location.replace(href)},[href]);
 return <div role="status" className="mobile-status">Abriendo el documento oficial de Tala Eats… <a href={href}>Abrir documento</a></div>;
}
function Spinner(){return <div className="loading"><RefreshCw className="spin" size={20}/> Cargando información del servidor...</div>;}
function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;}
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
    {links.map(item=><Link className="gateway-portal"
     to={item.path==='/restaurante'?restaurantPortalDestination(import.meta.env.VITE_RESTAURANT_APP_URL):item.path}
     key={item.path}>
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
function RestaurantEntry(){
 const {user,loading}=useSession();
 if(loading)return <div className="rb-welcome-loading" role="status"><ChefHat size={24}/> Abriendo Tala Eats Restaurantes…</div>;
 if(user?.role==='restaurant')return <RestaurantWorkspace/>;
 if(user?.role==='admin')return <Navigate to="/admin/solicitudes-restaurantes" replace/>;
 return <RestaurantWelcome existingCustomer={user?.role==='customer'}/>;
}
function Protected({role,children}:{role:'customer'|'restaurant'|'driver'|'admin'|'any';children:ReactNode}){
 const {user,loading}=useSession();const location=useLocation();
 if(loading)return <div className="container page"><Spinner/></div>;
 if(!user)return <Navigate to={role==='restaurant'?'/restaurante/acceso':role==='driver'?'/acceso':'/iniciar'} replace state={{from:location.pathname}}/>;
 if(role==='restaurant'&&user.role==='customer')return <Navigate to="/restaurante/alta" replace/>;
 if(role==='restaurant'&&user.role==='admin')return <Navigate to="/admin/solicitudes-restaurantes" replace/>;
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
function Driver(){return <DriverPwaWorkflow/>;}
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
 const navigate=useNavigate();const location=useLocation();const isGateway=location.pathname==='/';const isRestaurantPortal=location.pathname==='/restaurante'||location.pathname.startsWith('/restaurante/')||location.pathname.startsWith('/admin/');const isOnboarding=['/iniciar','/acceso'].includes(location.pathname);const isCustomerShell=['/iniciar','/clientes','/buscar','/pedidos','/cuenta','/carrito','/checkout','/direcciones','/tala-club','/notificaciones','/soporte','/favoritos','/editar-perfil','/acceso'].includes(location.pathname)||location.pathname.startsWith('/comercio/')||location.pathname.startsWith('/pedidos/');
 const selectMarket=(code:MarketCode):boolean=>{if(code===market)return true;if(cart.entries.length&&!window.confirm('Tienes un carrito activo. Para cambiar de localidad es necesario vaciarlo. ¿Cambiar de zona?'))return false;setCart(EMPTY_CART);setMarket(code);try{localStorage.setItem('talaeats-market-code',code);}catch{/* Privacy mode: keep market in memory. */}return true;};
 const add=(item:MenuItem,quantity:number,note:string):boolean=>{if(cart.restaurantId!==null&&cart.restaurantId!==item.restaurant_id){if(!window.confirm('Tu carrito tiene productos de otro restaurante. ¿Empezar un carrito nuevo?'))return false;}const updated=addVariantItem(cart,item,quantity,note);if(updated===cart)return false;setCart(updated);return true;};
 const count=cart.entries.reduce((sum,e)=>sum+e.quantity,0);
 if(session.loading && !isRestaurantPortal && location.pathname!=='/' && location.pathname!=='/repartidor')return <CustomerLaunch/>;
 return <div className={"app"+(isCustomerShell?" customer-shell":"")}>{PREVIEW_READONLY&&<div className="tala-review-banner" role="status"><strong>VISTA PREVIA</strong><span>Modo de revisión: pedidos, pagos y cambios de datos bloqueados. La información consultada puede proceder del backend existente.</span></div>}{!isGateway&&!isOnboarding&&!isRestaurantPortal&&<AppHeader count={count}/>}<CustomerHashScroll/><main><Routes>
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
   <Route path="/restaurante/acceso" element={<RestaurantAccess/>}/>
   <Route path="/restaurante/alta" element={<RestaurantOnboarding/>}/>
   <Route path="/restaurante" element={<RestaurantEntry/>}/>
   <Route path="/admin/solicitudes-restaurantes" element={<Protected role="admin"><RestaurantAdminActivation/></Protected>}/>
   <Route path="/repartidor" element={<Protected role="driver"><Driver/></Protected>}/>
   <Route path="*" element={<div className="container page"><EmptyState icon={<WifiOff size={32}/>} title="No encontramos esta página" description="Regresa a Tala Eats para seguir explorando." action={<Link className="btn primary" to="/">Ir al inicio</Link>}/></div>}/>
 </Routes></main>{!isOnboarding&&<CustomerBottomDock/>}{!isGateway&&!isOnboarding&&!isRestaurantPortal&&<AppFooter/>}{!isGateway&&count>0&&location.pathname==='/clientes'&&<button className="mobile-cart-bar" onClick={()=>navigate('/carrito')}><ShoppingCart size={20}/> Ver carrito <span>{count} productos · {pesos(basketTotal(cart))}</span></button>}</div>;
}
