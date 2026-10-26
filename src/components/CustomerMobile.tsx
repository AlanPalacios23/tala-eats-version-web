import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock3, Heart, MapPin, Search, Store, UserRound, WifiOff, X } from 'lucide-react';
import { api } from '../lib/api';
import { CustomerPhoto } from './CustomerPhoto';
import { useSession } from '../lib/session';
import { foldSearch } from '../lib/mobile-parity';
import { matchCustomerDishes, matchCustomerRestaurants } from '../lib/customer-search';
import { pesos } from '../lib/api';
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
 useEffect(()=>{let active=true;setRestaurants(null);setLoading(true);setError('');
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
function MerchantCard({restaurant:r,index,favorite,ready,pending,toggle,user,market}:{restaurant:Restaurant;index:number;favorite:boolean;ready:boolean;pending:boolean;toggle:(id:number)=>void;user:boolean;market:MarketCode}){
 return <article className="mobile-merchant-card reveal-enter" style={{animationDelay:Math.min(index,7)*45+'ms'}}>
  <Link to={'/comercio/'+r.id} className="mobile-merchant-photo" aria-label={'Ver '+r.name}>
   <CustomerPhoto src={r.cover_image_url} alt={r.name} fallback={r.emoji||'🍲'}/>
   {!r.is_open&&<span className="mobile-closed">Cerrado</span>}
  </Link>
  {user?<button type="button" disabled={!ready||pending} className={'mobile-favorite '+(favorite?'active':'')} aria-pressed={favorite} aria-label={favorite?'Quitar de favoritos':'Agregar a favoritos'} title={ready?'Guardar favorito en tu cuenta':'Verificando favoritos'} onClick={()=>toggle(r.id)}>
   <Heart size={21} fill={favorite?'currentColor':'none'}/>
  </button>:<Link className="mobile-favorite" to="/acceso" state={{from:'/clientes'}} aria-label="Iniciar sesión para guardar favorito"><Heart size={21}/></Link>}
  <Link to={'/comercio/'+r.id} className="mobile-merchant-details">
   <strong>{r.name}</strong>
   <span>{r.cuisine||r.description||'Comercio local'}</span>
   <div className="mobile-merchant-meta">{r.eta_min!=null&&<small><Clock3 size={14}/>{r.eta_min} min</small>}<small><MapPin size={14}/>{r.address||marketLabel(market)}</small></div>
  </Link>
 </article>;
}
function MerchantList({items,loading,error,refresh,market,searching=false}:{items:Restaurant[];loading:boolean;error:string;refresh:()=>void;market:MarketCode;searching?:boolean}){
 const favorite=useFavorites();
 if(loading)return <div className="mobile-customer-list" aria-label="Cargando comercios">{[0,1,2].map(i=><div className="customer-card-skeleton" key={i}><div/><span/><span/></div>)}</div>;
 if(error)return <div className="mobile-status"><WifiOff size={30}/><h3>No pudimos cargar los comercios</h3><p>Revisa tu conexión e inténtalo de nuevo.</p><button onClick={refresh}>Reintentar</button></div>;
 if(!items.length)return <div className="mobile-status"><Store size={30}/><h3>{searching?'Sin resultados':'Aún no hay comercios disponibles'}</h3><p>{searching?'Prueba con otro nombre o categoría.':'Cuando haya negocios activos en esta zona podrás encontrarlos aquí.'}</p></div>;
 return <>{favorite.error&&<div role="status" className="mobile-favorites-error">{favorite.error}</div>}<div className="mobile-customer-list">{items.map((item,index)=><MerchantCard restaurant={item} index={index} key={item.id} favorite={favorite.ids.has(item.id)} ready={favorite.ready} pending={favorite.pending!==null} toggle={favorite.toggle} user={Boolean(favorite.user)} market={market}/>)}</div></>;
}
function MarketSelector({market,onChange}:{market:MarketCode;onChange:(next:MarketCode)=>boolean}){
 const [open,setOpen]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 const sheetRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setOpen(false);return;}
   if(e.key!=='Tab'||!sheetRef.current)return;
   const controls=Array.from(sheetRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
   const first=controls[0],last=controls[controls.length-1];
   if(!first||!last)return;
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',onKey);previousFocus?.focus();};
 },[open]);
 return <>
  <button className="mobile-market-select" onClick={()=>setOpen(true)} aria-label={'Comprar en '+marketLabel(market)+'. Cambiar localidad'}>
   <Store size={17}/><span>Comprar en {marketLabel(market)}</span><span aria-hidden="true">⌄</span>
  </button>
  {open&&<div className="mobile-market-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <section ref={sheetRef} className="mobile-market-sheet" role="dialog" aria-modal="true" aria-label="Seleccionar localidad">
    <span className="mobile-sheet-handle"/><h2>¿Dónde quieres comprar?</h2>
    <p>Selecciona tu localidad. Tala es el mercado piloto; las demás zonas mostrarán negocios solo cuando estén disponibles.</p>
    <div>{MARKETS.map(m=><button key={m.code} onClick={()=>{if(market===m.code||onChange(m.code))setOpen(false);}} aria-pressed={market===m.code}>
     <MapPin size={19}/><span><strong>{m.label}</strong><small>{m.code==='TALA-JAL'?'Mercado piloto':'Sujeto a disponibilidad de comercios'}</small></span>{market===m.code?<span>✓</span>:<span>›</span>}
    </button>)}</div>
    <button ref={closeRef} type="button" className="mobile-market-close" onClick={()=>setOpen(false)}>Cerrar</button>
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
  <MerchantList items={restaurants??[]} loading={loading} error={error} refresh={refresh} market={market}/>
 </div>;
}
export function CustomerSearch({market}:{market:MarketCode}){
 const {restaurants,loading,error,refresh}=useRestaurants(market);const [query,setQuery]=useState('');
 const [details,setDetails]=useState<Restaurant[]>([]),[menuLoading,setMenuLoading]=useState(false),[menuError,setMenuError]=useState('');
 const normalized=foldSearch(query);
 const directory=useMemo(()=>matchCustomerRestaurants(restaurants??[],query),[restaurants,query]);
 const dishes=useMemo(()=>matchCustomerDishes(details,query),[details,query]);
 useEffect(()=>{
  let active=true;setDetails([]);setMenuError('');setMenuLoading(false);
  if(normalized.length<2||!restaurants?.length)return ()=>{active=false;};
  if(restaurants.length>100){setMenuError('La búsqueda de platillos requiere un índice completo del servidor para esta cantidad de comercios.');return ()=>{active=false;};}
  const check=async()=>{
   setMenuLoading(true);
   const collected:Restaurant[]=[];
   const failed:string[]=[];
   // Concurrency bound: never blast one request per merchant all at once.
   for(let i=0;i<restaurants.length;i+=5){
    const group=restaurants.slice(i,i+5);
    const results=await Promise.allSettled(group.map(r=>r.menu_items?Promise.resolve(r):api.restaurant(r.id)));
    if(!active)return;
    results.forEach((result,j)=>{
     if(result.status==='rejected'){failed.push(group[j].name);return;}
     if(result.value.market_code?.trim().toUpperCase()!==market){failed.push(group[j].name);return;}
     collected.push(result.value);
    });
   }
   if(active){setDetails(collected);setMenuError(failed.length?'No se pudieron consultar todos los menús; los resultados de platillos pueden estar incompletos.':'');setMenuLoading(false);}
  };
  void check();
  return ()=>{active=false;};
 },[market,restaurants,normalized.length>=2]);
 return <div className="mobile-customer-page mobile-search-page" data-mobile-screen="search">
  <h1>Buscar</h1><p className="mobile-search-locality">Comprar en {marketLabel(market)}</p>
  <label className="mobile-search-input"><Search size={22}/><input aria-label="Buscar restaurante, comercio o platillo" type="search" placeholder="Restaurante, comercio o platillo…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Borrar búsqueda" type="button" onClick={()=>setQuery('')}><X size={19}/></button>}</label>
  <section className="mobile-search-results" key={normalized?'results':'idle'}>
   {!normalized?<><h2>Comercios disponibles</h2><MerchantList items={directory} loading={loading} error={error} refresh={refresh} market={market}/></>:
    <>
     {loading?<div className="mobile-loading-order">Cargando comercios…</div>:error?<div role="alert" className="mobile-address-error">{error}<button onClick={refresh}>Reintentar</button></div>:null}
     {directory.length>0&&<><h2>Comercios</h2><MerchantList items={directory} loading={false} error="" refresh={refresh} market={market} searching/></>}
     <h2>Productos y platillos</h2>
     {normalized.length===1&&<p className="mobile-search-helper" role="status">Escribe al menos dos caracteres para buscar en los menús.</p>}
     {menuLoading&&<p className="mobile-loading-order">Buscando platillos en menús reales…</p>}
     {menuError&&<div role="status" className="mobile-address-error">{menuError}</div>}
     {dishes.length>0?<div className="mobile-dish-search-results">{dishes.map(hit=><Link key={hit.restaurant.id+'-'+hit.item.id} to={'/comercio/'+hit.restaurant.id+'?platillo='+hit.item.id} className="mobile-dish-search-tile">
       <div><strong>{hit.item.name}</strong><span>{hit.restaurant.name} · {hit.item.category||'Comida local'}</span><b>{pesos(hit.item.price)}</b></div>
       <CustomerPhoto src={hit.item.image_url} alt={hit.item.name} fallback="🍔" className="mobile-dish-search-photo"/>
      </Link>)}</div>:normalized.length>=2&&!menuLoading&&!directory.length&&!error&&!menuError?<div className="mobile-status"><Search size={30}/><h3>Sin resultados</h3><p>No encontramos “{query.trim()}”. Prueba con otro nombre, comida o categoría.</p></div>:null}
    </>}
  </section>
 </div>;
}
