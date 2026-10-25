import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock3, Heart, MapPin, Search, Store, UserRound, WifiOff, X } from 'lucide-react';
import { api, safeImage } from '../lib/api';
import { useSession } from '../lib/session';
import { foldSearch } from '../lib/mobile-parity';
import { MARKETS, marketLabel } from '../lib/markets';
import type { MarketCode } from '../lib/markets';
import type { Restaurant } from '../lib/types';

/** Fidelity reference: Mobile Usuarios 1.0.46+57 / HomeScreen, SearchScreen, RestaurantCard.
 * Delivery and notifications must never be simulated as successful API operations.
 */
function useRestaurants(market:MarketCode) {
 const [restaurants,setRestaurants]=useState<Restaurant[]|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [tick,setTick]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.restaurantsForMarket(market).then(value=>{if(active)setRestaurants(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No hay conexión');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[tick,market]);
 return {restaurants,loading,error,refresh:()=>setTick(v=>v+1)};
}
function useFavorites(){
 const {user}=useSession();
 const [ids,setIds]=useState<Set<number>>(new Set());
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [pending,setPending]=useState<number|null>(null);
 useEffect(()=>{let active=true;setIds(new Set());setReady(false);setError('');
  if(!user){setReady(true);return ()=>{active=false};}
  api.favorites().then(rows=>{if(active){setIds(new Set(rows.map(row=>row.id)));setReady(true);}}).catch(()=>{if(active){setError('No pudimos verificar tus favoritos.');setReady(false);}});
  return()=>{active=false};
 },[user?.id]);
 const toggle=async(id:number)=>{
  if(!user||pending!==null||!ready)return;
  const was=ids.has(id);
  setPending(id);setError('');setIds(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});
  try{const response=await api.toggleFavorite(id);setIds(old=>{const next=new Set(old);if(response.favorite)next.add(id);else next.delete(id);return next;});}
  catch{setIds(old=>{const next=new Set(old);if(was)next.add(id);else next.delete(id);return next;});setError('No se pudo guardar el favorito. Vuelve a intentarlo.');}
  finally{setPending(null);}
 };
 return {ids,ready,error,pending,toggle,user};
}
function MerchantCard({restaurant:r,index,favorite,ready,pending,toggle,user}:{restaurant:Restaurant;index:number;favorite:boolean;ready:boolean;pending:boolean;toggle:(id:number)=>void;user:boolean}){
 return <article className="mobile-merchant-card reveal-enter" style={{animationDelay:Math.min(index,7)*45+'ms'}}>
  <Link to={'/comercio/'+r.id} className="mobile-merchant-photo" aria-label={'Ver '+r.name}>
   {safeImage(r.cover_image_url)?<img src={safeImage(r.cover_image_url)!} alt={r.name} loading="lazy" referrerPolicy="no-referrer"/>:<div className="mobile-merchant-fallback" role="img" aria-label={r.name}>{r.emoji||'🍲'}</div>}
   {!r.is_open&&<span className="mobile-closed">Cerrado</span>}
  </Link>
  {user?<button type="button" disabled={!ready||pending} className={'mobile-favorite '+(favorite?'active':'')} aria-pressed={favorite} aria-label={favorite?'Quitar de favoritos':'Agregar a favoritos'} title={ready?'Guardar favorito en tu cuenta':'Verificando favoritos'} onClick={()=>toggle(r.id)}>
   <Heart size={21} fill={favorite?'currentColor':'none'}/>
  </button>:<Link className="mobile-favorite" to="/acceso" state={{from:'/clientes'}} aria-label="Iniciar sesión para guardar favorito"><Heart size={21}/></Link>}
  <Link to={'/comercio/'+r.id} className="mobile-merchant-details">
   <strong>{r.name}</strong>
   <span>{r.cuisine||r.description||'Comercio local'}</span>
   <div className="mobile-merchant-meta">{r.eta_min!=null&&<small><Clock3 size={14}/>{r.eta_min} min</small>}<small><MapPin size={14}/>Tala y región</small></div>
  </Link>
 </article>;
}
function MerchantList({items,loading,error,refresh,searching=false}:{items:Restaurant[];loading:boolean;error:string;refresh:()=>void;searching?:boolean}){
 const favorite=useFavorites();
 if(loading)return <div className="mobile-customer-list" aria-label="Cargando comercios">{[0,1,2].map(i=><div className="customer-card-skeleton" key={i}><div/><span/><span/></div>)}</div>;
 if(error)return <div className="mobile-status"><WifiOff size={30}/><h3>No pudimos cargar los comercios</h3><p>Revisa tu conexión e inténtalo de nuevo.</p><button onClick={refresh}>Reintentar</button></div>;
 if(!items.length)return <div className="mobile-status"><Store size={30}/><h3>{searching?'Sin resultados':'Aún no hay comercios disponibles'}</h3><p>{searching?'Prueba con otro nombre o categoría.':'Cuando haya negocios activos en esta zona podrás encontrarlos aquí.'}</p></div>;
 return <><div role="status" className="mobile-favorites-error">{favorite.error}</div><div className="mobile-customer-list">{items.map((item,index)=><MerchantCard restaurant={item} index={index} key={item.id} favorite={favorite.ids.has(item.id)} ready={favorite.ready} pending={favorite.pending===item.id} toggle={favorite.toggle} user={Boolean(favorite.user)}/>)}</div></>;
}
function MarketSelector({market,onChange}:{market:MarketCode;onChange:(next:MarketCode)=>boolean}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[open]);
 return <>
  <button className="mobile-market-select" onClick={()=>setOpen(true)} aria-label={'Comprar en '+marketLabel(market)+'. Cambiar localidad'}>
   <Store size={17}/><span>Comprar en {marketLabel(market)}</span><span aria-hidden="true">⌄</span>
  </button>
  {open&&<div className="mobile-market-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <section className="mobile-market-sheet" role="dialog" aria-modal="true" aria-label="Seleccionar localidad">
    <span className="mobile-sheet-handle"/><h2>¿Dónde quieres comprar?</h2>
    <p>Selecciona tu localidad. Tala es el mercado piloto; las demás zonas mostrarán negocios solo cuando estén disponibles.</p>
    <div>{MARKETS.map(m=><button key={m.code} onClick={()=>{if(market===m.code||onChange(m.code))setOpen(false);}} aria-pressed={market===m.code}>
     <MapPin size={19}/><span><strong>{m.label}</strong><small>{m.code==='TALA-JAL'?'Mercado piloto':'Sujeto a disponibilidad de comercios'}</small></span>{market===m.code?<span>✓</span>:<span>›</span>}
    </button>)}</div>
    <button className="mobile-market-close" onClick={()=>setOpen(false)}>Cerrar</button>
   </section>
  </div>}
 </>;
}
export function CustomerHome({market,onSelectMarket}:{market:MarketCode;onSelectMarket:(next:MarketCode)=>boolean}){
 const {user}=useSession();const {restaurants,loading,error,refresh}=useRestaurants(market);
 const [address,setAddress]=useState('Agregar dirección');
 useEffect(()=>{
  let active=true;
  if(!user){setAddress('Agregar dirección');return ()=>{active=false};}
  setAddress('Verificando dirección…');
  api.customerAddresses().then(rows=>{if(active)setAddress((rows.find(row=>row.is_default)??rows[0])?.label||'Agregar dirección');})
   .catch(()=>{if(active)setAddress('Dirección sin verificar');});
  return()=>{active=false};
 },[user?.id]);
 const first=(user?.name||'').trim().split(/\s+/)[0];
 return <div className="mobile-customer-page mobile-home" data-mobile-screen="home">
  <div className="mobile-home-top">
   <Link to={user?'/direcciones':'/acceso'} state={user?undefined:{from:'/direcciones'}} className="mobile-address"><span className="mobile-address-icon"><MapPin size={22}/></span><div><small>Entregar en</small><strong>{address} <span aria-hidden="true">⌄</span></strong></div></Link>
   <div className="mobile-home-actions"><Link to="/notificaciones" className="mobile-round-action" aria-label="Notificaciones"><Bell size={21}/></Link><Link to="/cuenta" className="mobile-round-action" aria-label="Mi cuenta"><UserRound size={21}/></Link></div>
  </div>
  <MarketSelector market={market} onChange={onSelectMarket}/>
  <div className="mobile-greeting reveal-enter"><span>{first?'Hola, '+first+' 👋':'Hola 👋'}</span><h1>¿Qué se te antoja hoy?</h1></div>
  <Link className="mobile-search-pill reveal-enter reveal-delay-one" to="/buscar"><Search size={23}/><span>Buscar restaurantes o comida…</span></Link>
  <div className="mobile-section-heading"><h2>Restaurantes y comercios</h2></div>
  <MerchantList items={restaurants??[]} loading={loading} error={error} refresh={refresh}/>
 </div>;
}
export function CustomerSearch({market}:{market:MarketCode}){
 const {restaurants,loading,error,refresh}=useRestaurants(market);const [query,setQuery]=useState('');
 const normalized=foldSearch(query);
 const items=useMemo(()=>normalized?(restaurants??[]).filter(r=>foldSearch([r.name,r.cuisine??'',r.description??''].join(' ')).includes(normalized)):(restaurants??[]).filter(r=>r.is_open),[restaurants,normalized]);
 return <div className="mobile-customer-page mobile-search-page" data-mobile-screen="search">
  <h1>Buscar</h1><p className="mobile-search-locality">Comprar en {marketLabel(market)}</p>
  <label className="mobile-search-input"><Search size={22}/><input aria-label="Buscar restaurante, comercio o platillo" type="search" placeholder="Restaurante, comercio o platillo…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Borrar búsqueda" type="button" onClick={()=>setQuery('')}><X size={19}/></button>}</label>
  <section className="mobile-search-results" key={normalized?'results':'idle'}>
   <h2>{normalized?'Resultados':'Comercios disponibles'}</h2>
   <MerchantList items={items} loading={loading} error={error} refresh={refresh} searching={!!normalized}/>
  </section>
 </div>;
}
