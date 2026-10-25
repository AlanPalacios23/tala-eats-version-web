import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Heart, MapPin, Search, Store, UserRound, WifiOff, X } from 'lucide-react';
import { api, safeImage } from '../lib/api';
import { useSession } from '../lib/session';
import { foldSearch } from '../lib/mobile-parity';
import type { Restaurant } from '../lib/types';

/** Fidelity reference: Mobile Usuarios 1.0.46+57 / HomeScreen, SearchScreen, RestaurantCard.
 * Delivery, favorite persistence and notifications must never be simulated as successful API operations.
 */
function useRestaurants() {
 const [restaurants,setRestaurants]=useState<Restaurant[]|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [tick,setTick]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.restaurants().then(value=>{if(active)setRestaurants(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No hay conexión');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[tick]);
 return {restaurants,loading,error,refresh:()=>setTick(v=>v+1)};
}
function MerchantCard({restaurant:r,index}:{restaurant:Restaurant;index:number}){
 const [favorite,setFavorite]=useState(false);
 return <article className="mobile-merchant-card reveal-enter" style={{animationDelay:Math.min(index,7)*45+'ms'}}>
  <Link to={'/comercio/'+r.id} className="mobile-merchant-photo" aria-label={'Ver '+r.name}>
   {safeImage(r.cover_image_url)?<img src={safeImage(r.cover_image_url)!} alt={r.name} loading="lazy" referrerPolicy="no-referrer"/>:<div className="mobile-merchant-fallback" role="img" aria-label={r.name}>{r.emoji||'🍲'}</div>}
   {!r.is_open&&<span className="mobile-closed">Cerrado</span>}
  </Link>
  <button type="button" className={'mobile-favorite '+(favorite?'active':'')} aria-pressed={favorite} aria-label={favorite?'Quitar de favoritos':'Agregar a favoritos'} title="Favorito temporal de esta pantalla" onClick={()=>setFavorite(v=>!v)}>
   <Heart size={21} fill={favorite?'currentColor':'none'}/>
  </button>
  <Link to={'/comercio/'+r.id} className="mobile-merchant-details">
   <strong>{r.name}</strong>
   <span>{r.cuisine||r.description||'Comercio local'}</span>
   <div className="mobile-merchant-meta">{r.eta_min!=null&&<small><Clock3 size={14}/>{r.eta_min} min</small>}<small><MapPin size={14}/>Tala y región</small></div>
  </Link>
 </article>;
}
function MerchantList({items,loading,error,refresh,searching=false}:{items:Restaurant[];loading:boolean;error:string;refresh:()=>void;searching?:boolean}){
 if(loading)return <div className="mobile-customer-list" aria-label="Cargando comercios">{[0,1,2].map(i=><div className="customer-card-skeleton" key={i}><div/><span/><span/></div>)}</div>;
 if(error)return <div className="mobile-status"><WifiOff size={30}/><h3>No pudimos cargar los comercios</h3><p>Revisa tu conexión e inténtalo de nuevo.</p><button onClick={refresh}>Reintentar</button></div>;
 if(!items.length)return <div className="mobile-status"><Store size={30}/><h3>{searching?'Sin resultados':'Aún no hay comercios disponibles'}</h3><p>{searching?'Prueba con otro nombre o categoría.':'Cuando haya negocios activos en esta zona podrás encontrarlos aquí.'}</p></div>;
 return <div className="mobile-customer-list">{items.map((item,index)=><MerchantCard restaurant={item} index={index} key={item.id}/>)}</div>;
}
export function CustomerHome(){
 const {user}=useSession();const {restaurants,loading,error,refresh}=useRestaurants();
 const first=(user?.name||'').trim().split(/\s+/)[0];
 return <div className="mobile-customer-page mobile-home" data-mobile-screen="home">
  <div className="mobile-home-top">
   <div className="mobile-address"><span className="mobile-address-icon"><MapPin size={22}/></span><div><small>Entregar en</small><strong>Tala y región <span aria-hidden="true">⌄</span></strong></div></div>
   <Link to="/cuenta" className="mobile-round-action" aria-label="Mi cuenta"><UserRound size={21}/></Link>
  </div>
  <div className="mobile-greeting reveal-enter"><span>{first?'Hola, '+first+' 👋':'Hola 👋'}</span><h1>¿Qué se te antoja hoy?</h1></div>
  <Link className="mobile-search-pill reveal-enter reveal-delay-one" to="/buscar"><Search size={23}/><span>Buscar restaurantes o comida…</span></Link>
  <div className="mobile-section-heading"><h2>Restaurantes y comercios</h2></div>
  <MerchantList items={restaurants??[]} loading={loading} error={error} refresh={refresh}/>
 </div>;
}
export function CustomerSearch(){
 const {restaurants,loading,error,refresh}=useRestaurants();const [query,setQuery]=useState('');
 const normalized=foldSearch(query);
 const items=useMemo(()=>normalized?(restaurants??[]).filter(r=>foldSearch([r.name,r.cuisine??'',r.description??''].join(' ')).includes(normalized)):(restaurants??[]).filter(r=>r.is_open),[restaurants,normalized]);
 return <div className="mobile-customer-page mobile-search-page" data-mobile-screen="search">
  <h1>Buscar</h1>
  <label className="mobile-search-input"><Search size={22}/><input aria-label="Buscar restaurante, comercio o platillo" type="search" placeholder="Restaurante, comercio o platillo…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Borrar búsqueda" type="button" onClick={()=>setQuery('')}><X size={19}/></button>}</label>
  <section className="mobile-search-results" key={normalized?'results':'idle'}>
   <h2>{normalized?'Resultados':'Comercios disponibles'}</h2>
   <MerchantList items={items} loading={loading} error={error} refresh={refresh} searching={!!normalized}/>
  </section>
 </div>;
}
