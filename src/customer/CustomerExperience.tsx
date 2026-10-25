import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Heart, Home, MapPin, Package, Search, Star, Store, UserRound, X, Clock3, RefreshCcw, ShoppingBag } from 'lucide-react';
import { api, safeImage } from '../lib/api';
import type { Restaurant } from '../lib/types';
import { useSession } from '../lib/session';
import './customer.css';

/**
 * Customer surfaces ported from tala-eats-mobile (Flutter main):
 * discovery_screens.dart HomeScreen, HomeSearchPill, RestaurantCard,
 * SearchScreen and PremiumBottomDock, plus design_system.dart.
 *
 * This is an incremental UI port. It NEVER creates fake stores, ratings,
 * promotional copy, ETAs, prices, payment options or checkout operations.
 * Keep the existing LIVE API and server-side authorization unchanged.
 */
const MARKET = 'Tala, Jalisco';
const numberRating = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 5 ? parsed : null;
};
const fold = (text: string): string => text
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function useCommerceList() {
  const [items,setItems] = useState<Restaurant[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [version,setVersion] = useState(0);
  useEffect(() => {
    let mounted = true;
    setLoading(true);setError('');
    api.restaurants().then(shops => {
      if (mounted) setItems(Array.isArray(shops) ? shops : []);
    }).catch(e => {
      if (mounted) setError(e instanceof Error ? e.message : 'Error al consultar comercios');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  },[version]);
  return {items,loading,error,refresh:()=>setVersion(v=>v+1)};
}

function CustomerState({icon,title,description,action}:{
  icon:ReactNode;title:string;description:string;action?:ReactNode;
}) {
  return <div className="te-customer-state" role="status">
    <span className="te-customer-state-icon">{icon}</span>
    <h3>{title}</h3><p>{description}</p>{action}
  </div>;
}

function CommercePhoto({shop}:{shop:Restaurant}) {
  const url=safeImage(shop.cover_image_url);
  return <div className={'te-customer-photo'+(shop.is_open?'':' te-closed-photo')}>
    {url?<img src={url} alt={'Fotografía de '+shop.name} loading="lazy"/>:
      <div className="te-customer-photo-empty" role="img" aria-label={'Imagen no disponible para '+shop.name}><Store size={46}/></div>}
  </div>;
}

function CommerceCard({shop,compact=false}:{shop:Restaurant;compact?:boolean}) {
  const rating=numberRating(shop.rating);
  const key='tala-eats-favorite-'+shop.id;
  // Flutter has a favorite control. Web uses per-device local preference only
  // until the authenticated server-side favorites contract is available.
  const [favorite,setFavorite]=useState(()=>{
    try { return window.localStorage.getItem(key)==='1'; } catch { return false; }
  });
  const toggle=()=>{
    const next=!favorite;
    setFavorite(next);
    try {
      if(next) window.localStorage.setItem(key,'1');
      else window.localStorage.removeItem(key);
    } catch { /* private mode may disallow browser storage */ }
  };
  return <article className={'te-customer-store'+(compact?' te-customer-store-compact':'')}>
    <Link className="te-customer-store-link" to={'/comercio/'+shop.id}
      aria-label={shop.name+(shop.is_open?', abierto':', cerrado')}>
      <div className="te-customer-media">
        <CommercePhoto shop={shop}/>
        {!shop.is_open&&<span className="te-customer-closed">Cerrado</span>}
      </div>
      <div className="te-customer-store-details">
        <div className="te-customer-store-title">
          <h3>{shop.name}</h3>
          {rating!==null&&<span className="te-customer-rating"><Star size={14} fill="currentColor"/>{rating.toFixed(1)}</span>}
        </div>
        {(shop.cuisine||shop.description)&&<p className="te-customer-category">{shop.cuisine||shop.description}</p>}
        <div className="te-customer-meta">
          {typeof shop.eta_min==='number'&&shop.eta_min>0&&<span><Clock3 size={15}/>{shop.eta_min} min</span>}
          {shop.pickup_enabled===true&&<span><ShoppingBag size={15}/>Recoger en tienda</span>}
        </div>
      </div>
    </Link>
    {!compact&&<button type="button" className="te-customer-favorite"
      aria-pressed={favorite} aria-label={favorite?'Quitar de favoritos':'Agregar a favoritos'}
      title="Favoritos guardados solo en este navegador" onClick={toggle}>
      <Heart size={21} fill={favorite?'currentColor':'none'}/>
    </button>}
  </article>;
}

function CommerceLoading() {
 return <div className="te-customer-skeletons" role="status" aria-label="Cargando comercios">
  {Array.from({length:3},(_,i)=><div className="te-customer-skeleton" key={i}>
    <div className="te-customer-skeleton-cover"/><div className="te-customer-skeleton-line"/><div className="te-customer-skeleton-line short"/>
  </div>)}
 </div>;
}

/** Four tabs and orange active pill match Flutter PremiumBottomDock. */
export function CustomerDock() {
 const tabs=[
   {to:'/clientes',name:'Inicio',Icon:Home},
   {to:'/buscar',name:'Buscar',Icon:Search},
   {to:'/pedidos',name:'Pedidos',Icon:Package},
   {to:'/cuenta',name:'Cuenta',Icon:UserRound},
 ];
 return <nav className="te-customer-dock" aria-label="Navegación de clientes">
   {tabs.map(({to,name,Icon})=><NavLink key={to} to={to} end className={({isActive})=>'te-customer-dock-item'+(isActive?' active':'')}>
     <span className="te-customer-dock-icon"><Icon size={22} strokeWidth={2.2}/></span>
     <span>{name}</span>
   </NavLink>)}
 </nav>;
}

export function CustomerHome() {
 const {user}=useSession();
 const {items,loading,error,refresh}=useCommerceList();
 const name=user?.name?.trim().split(/\s+/)[0]||'';
 return <div className="te-customer te-customer-home">
  <div className="te-customer-frame">
   <div className="te-customer-top">
    <div className="te-customer-place">
      <span className="te-customer-location-icon"><MapPin size={22} fill="currentColor" strokeWidth={1.6}/></span>
      <div><span className="te-customer-eyebrow">Comprar en</span>
      <strong>{MARKET} <ChevronDown size={17} aria-hidden="true"/></strong></div>
    </div>
    <div className="te-customer-actions">
      <span className="te-customer-bell" aria-label="Notificaciones no disponibles en la web" title="Notificaciones: próximamente"><Bell size={22}/></span>
      <Link className="te-customer-avatar" to={user?'/cuenta':'/acceso'} state={user?undefined:{from:'/clientes'}}
         aria-label={user?'Mi cuenta':'Iniciar sesión'}><UserRound size={21}/></Link>
    </div>
   </div>
   <div className="te-customer-market"><Store size={16}/>Comprar en Tala</div>
   <header className="te-customer-greeting">
     <span>{name?'Hola, '+name+' 👋':'Hola 👋'}</span>
     <h1>¿Qué se te antoja hoy?</h1>
   </header>
   <Link className="te-customer-search-pill" to="/buscar" aria-label="Buscar restaurantes o comida">
     <Search size={23}/><span>Buscar restaurantes o comida…</span>
   </Link>
   <section className="te-customer-results" aria-labelledby="te-customer-section-title">
     <div className="te-customer-section-row">
       <h2 id="te-customer-section-title">Restaurantes y comercios</h2>
       <button className="te-customer-refresh" onClick={refresh} disabled={loading} aria-label="Actualizar comercios"><RefreshCcw size={17}/></button>
     </div>
     {loading?<CommerceLoading/>:error?
      <CustomerState icon={<Store size={29}/>} title="No pudimos cargar los comercios" description="Revisa tu conexión e inténtalo de nuevo." action={<button onClick={refresh}>Reintentar</button>}/>:
      items.length===0?
       <CustomerState icon={<Store size={29}/>} title="Aún no hay comercios disponibles" description="Cuando haya negocios activos en Tala podrás encontrarlos aquí."/>:
       <div className="te-customer-store-list">{items.map(shop=><CommerceCard key={shop.id} shop={shop}/>)}</div>}
   </section>
  </div>
 </div>;
}

export function CustomerSearch() {
 const navigate=useNavigate();
 const {items,loading,error,refresh}=useCommerceList();
 const [query,setQuery]=useState('');
 const found=useMemo(()=>{
  const q=fold(query);
  return q?items.filter(shop=>fold([shop.name,shop.cuisine,shop.description].filter(Boolean).join(' ')).includes(q)):items.filter(shop=>shop.is_open);
 },[items,query]);
 return <div className="te-customer te-customer-search-page">
   <div className="te-customer-frame">
     <header className="te-customer-search-title"><h1>Buscar</h1></header>
     <label className="te-customer-search-field">
       <Search size={23} aria-hidden="true"/>
       <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
        placeholder="Restaurante o comercio…" aria-label="Buscar restaurantes o comercios" enterKeyHint="search"/>
       {query&&<button type="button" aria-label="Borrar búsqueda" onClick={()=>setQuery('')}><X size={19}/></button>}
     </label>
     <section className="te-customer-results" aria-live="polite">
       {loading?<CommerceLoading/>:error?
         <CustomerState icon={<Store size={30}/>} title="No pudimos cargar los comercios" description="Comprueba tu conexión e inténtalo de nuevo." action={<button onClick={refresh}>Reintentar</button>}/>:
         found.length===0?
           <CustomerState icon={<Search size={30}/>} title={query?'Sin resultados':'Aún no hay comercios para explorar'} description={query?'Prueba con otro restaurante o categoría.':'Cuando haya negocios disponibles en Tala los encontrarás aquí.'}/>:
           <><h2>{query?'Restaurantes':'Comercios disponibles'}</h2>
             <div className="te-customer-search-list">{found.map(shop=><CommerceCard compact key={shop.id} shop={shop}/>)}</div>
           </>}
     </section>
     <button className="te-customer-back" onClick={()=>navigate('/clientes')}>Volver a Inicio</button>
   </div>
 </div>;
}
