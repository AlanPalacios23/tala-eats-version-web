import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clock3, MapPin, Minus, Plus, Store, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, pesos, safeImage } from '../lib/api';
import type { MenuItem, Restaurant } from '../lib/types';
import { basketTotal } from '../lib/cart';
import type { Cart } from '../lib/cart';

const CHOICES=['Sin cambios','Sin cebolla','Extra salsa','Bien cocido'] as const;
function ProductPhoto({url,label}:{url?:string|null;label:string}){
 const safe=safeImage(url);
 return safe?<img src={safe} loading="lazy" referrerPolicy="no-referrer" alt={label}/>:<span className="mobile-commerce-fallback" role="img" aria-label={label}>🍽️</span>;
}
function ProductSheet({item,merchant,onClose,onAdd}:{item:MenuItem;merchant:Restaurant;onClose:()=>void;onAdd:(item:MenuItem,quantity:number,note:string)=>boolean}){
 const [quantity,setQuantity]=useState(1),[choice,setChoice]=useState('Sin cambios');
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';closeRef.current?.focus();
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',onKey);};
 },[onClose]);
 const max=Math.min(50,item.stock);
 return <div className="mobile-sheet-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="mobile-product-sheet" role="dialog" aria-modal="true" aria-label={'Agregar '+item.name}>
   <div className="mobile-sheet-handle"/>
   <button ref={closeRef} className="mobile-sheet-close" onClick={onClose} aria-label="Cerrar ficha"><X size={21}/></button>
   <div className="mobile-sheet-body">
    <div className="mobile-sheet-photo"><ProductPhoto url={item.image_url} label={item.name}/></div>
    <h2>{item.name}</h2><p className="mobile-sheet-merchant">{merchant.name}</p>
    {item.description&&<p className="mobile-sheet-description">{item.description}</p>}
    <div className="mobile-sheet-price">{pesos(item.price)}</div>
    <div className="mobile-sheet-preferences"><strong>Preferencias</strong><span>Opcional</span></div>
    <div className="mobile-sheet-choices">{CHOICES.map(option=><button key={option} className={choice===option?'selected':''} onClick={()=>setChoice(option)} aria-pressed={choice===option}>{choice===option&&<Check size={15}/>} {option}</button>)}</div>
   </div>
   <div className="mobile-sheet-actions">
    <div className="mobile-stepper"><button disabled={quantity<=1} aria-label="Quitar uno" onClick={()=>setQuantity(v=>Math.max(1,v-1))}><Minus size={18}/></button><strong>{quantity}</strong><button disabled={quantity>=max} aria-label="Agregar uno" onClick={()=>setQuantity(v=>Math.min(max,v+1))}><Plus size={18}/></button></div>
    <button className="mobile-add-action" onClick={()=>{if(onAdd(item,quantity,choice==='Sin cambios'?'':choice))onClose();}}>Agregar · {pesos(Number(item.price)*quantity)}</button>
   </div>
  </section>
 </div>;
}
export function CustomerCommerce({cart,onAdd}:{cart:Cart;onAdd:(item:MenuItem,quantity:number,note:string)=>boolean}){
 const {id}=useParams(),restaurantId=Number(id);
 const [merchant,setMerchant]=useState<Restaurant|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [retry,setRetry]=useState(0),[category,setCategory]=useState('Todos'),[selected,setSelected]=useState<MenuItem|null>(null);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  if(!Number.isSafeInteger(restaurantId)||restaurantId<=0){setError('Comercio no válido');setLoading(false);return;}
  api.restaurant(restaurantId).then(value=>{if(active)setMerchant(value);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'No pudimos cargar el menú');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[restaurantId,retry]);
 const cats=useMemo(()=>['Todos',...new Set((merchant?.menu_items||[]).map(item=>item.category||'General'))],[merchant]);
 const dishes=(merchant?.menu_items||[]).filter(item=>category==='Todos'||(item.category||'General')===category);
 const canOrder=Boolean(merchant?.is_open&&merchant?.pickup_enabled);
 const quantity=cart.restaurantId===restaurantId?cart.entries.reduce((n,e)=>n+e.quantity,0):0;
 return <div className="mobile-commerce" data-mobile-screen="restaurant">
  <div className="mobile-commerce-hero">
   {merchant?<ProductPhoto url={merchant.cover_image_url} label={merchant.name}/>:<div className="mobile-commerce-fallback"/>}
   <div className="mobile-commerce-overlay"/>
   <Link to="/clientes" className="mobile-commerce-back" aria-label="Regresar al inicio"><ArrowLeft size={22}/></Link>
  </div>
  {loading?<div className="mobile-commerce-loading">Cargando menú…</div>:error?<div className="mobile-status"><Store size={30}/><h2>No pudimos cargar este comercio</h2><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>Reintentar</button></div>:merchant&&<>
   <div className="mobile-commerce-info">
    <h1>{merchant.name}</h1>
    <p>{merchant.cuisine||'Comercio local'}</p>
    {merchant.description&&<p className="mobile-commerce-about">{merchant.description}</p>}
    <div className="mobile-commerce-metadata">{merchant.eta_min!=null&&<span><Clock3 size={16}/>{merchant.eta_min} min</span>}<span><MapPin size={16}/>{merchant.address||'Tala y región'}</span><span><Store size={16}/>Para recoger</span></div>
    {!merchant.is_open&&<div className="mobile-commerce-warning">Este comercio está cerrado por ahora. Puedes ver su menú y pedir cuando vuelva a abrir.</div>}
    {merchant.is_open&&!merchant.pickup_enabled&&<div className="mobile-commerce-warning">Recoger en tienda no está disponible. El pedido a domicilio se habilitará cuando el backend lo autorice para Web.</div>}
    <h2>Menú</h2>
   </div>
   <div className="mobile-commerce-categories" role="group" aria-label="Categorías">{cats.map(c=><button key={c} onClick={()=>setCategory(c)} aria-pressed={category===c} className={category===c?'selected':''}>{c}</button>)}</div>
   <div className="mobile-commerce-dishes">{dishes.length?dishes.map(item=>{
    const available=canOrder&&item.is_available&&item.stock>0;
    return <article key={item.id} className={'mobile-dish-card'+(!available?' unavailable':'')}>
     <div className="mobile-dish-details"><h3>{item.name}</h3>{item.description&&<p>{item.description}</p>}<strong>{pesos(item.price)}</strong>{(!item.is_available||item.stock<=0)&&<span className="mobile-dish-soldout">Agotado</span>}</div>
     <div className="mobile-dish-photo"><ProductPhoto url={item.image_url} label={item.name}/><button disabled={!available} onClick={()=>setSelected(item)} aria-label={'Ver preferencias y agregar '+item.name}><Plus size={23}/></button></div>
    </article>;
   }):<div className="mobile-status"><Store size={30}/><h3>Menú en preparación</h3><p>Este comercio aún no tiene productos en esta categoría.</p></div>}</div>
   {quantity>0&&<Link to="/carrito" className="mobile-commerce-cartbar"><span>{quantity}</span><strong>Ver carrito</strong><strong>{pesos(basketTotal(cart))}</strong><ChevronRight size={21}/></Link>}
   {selected&&<ProductSheet item={selected} merchant={merchant} onClose={()=>setSelected(null)} onAdd={onAdd}/>}
  </>}
 </div>;
}
