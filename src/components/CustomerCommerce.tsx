import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, MapPin, Minus, Plus, Store, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, pesos } from '../lib/api';
import { CustomerPhoto } from './CustomerPhoto';
import type { MenuItem, Restaurant } from '../lib/types';
import { basketTotal, remainingForVariant } from '../lib/cart';
import type { Cart } from '../lib/cart';
import { marketLabel } from '../lib/markets';
import type { MarketCode } from '../lib/markets';

function ProductPhoto({url,label}:{url?:string|null;label:string}){
 return <CustomerPhoto src={url} alt={label} fallback="🛍️"/>;
}
function ProductSheet({item,merchant,cart,onClose,onAdd}:{item:MenuItem;merchant:Restaurant;cart:Cart;onClose:()=>void;onAdd:(item:MenuItem,quantity:number,note:string)=>boolean}){
 const [quantity,setQuantity]=useState(1),[note,setNote]=useState(''),[addError,setAddError]=useState('');
 const closeRef=useRef<HTMLButtonElement>(null);
 const sheetRef=useRef<HTMLElement>(null);
 const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
 useEffect(()=>{
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const old=document.body.style.overflow;document.body.style.overflow='hidden';closeRef.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();onCloseRef.current();return;}
   if(e.key!=='Tab'||!sheetRef.current)return;
   const controls=Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)'));
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',onKey);previousFocus?.focus();};
 },[]);
 const max=remainingForVariant(cart,item,note);
 const effectiveQuantity=Math.min(quantity,max);
 return <div className="mobile-sheet-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={sheetRef} className="mobile-product-sheet" role="dialog" aria-modal="true" aria-label={'Agregar '+item.name}>
   <div className="mobile-sheet-handle"/>
   <button ref={closeRef} className="mobile-sheet-close" onClick={onClose} aria-label="Cerrar ficha"><X size={21}/></button>
   <div className="mobile-sheet-body">
    <div className="mobile-sheet-photo"><ProductPhoto url={item.image_url} label={item.name}/></div>
    <h2>{item.name}</h2><p className="mobile-sheet-merchant">{merchant.name}</p>
    {item.description&&<p className="mobile-sheet-description">{item.description}</p>}
    <div className="mobile-sheet-price">{pesos(item.price)}</div>
    <label className="mobile-product-note"><strong>Indicaciones para el comercio <small>(opcional)</small></strong><textarea maxLength={200} rows={2} value={note} onChange={e=>{setNote(e.target.value);setAddError('');}} placeholder="Escribe indicaciones sobre este producto, si son necesarias…"/></label>
    <p className="mobile-product-stock" role="status">{max>0?`Puedes agregar ${max} ${max===1?'unidad':'unidades'} más de esta presentación.`:'No quedan unidades disponibles para agregar en este carrito.'}</p>
    {addError&&<p className="mobile-product-error" role="alert">{addError}</p>}
   </div>
   <div className="mobile-sheet-actions">
    <div className="mobile-stepper"><button type="button" disabled={quantity<=1||max<1} aria-label="Quitar uno" onClick={()=>setQuantity(v=>Math.max(1,v-1))}><Minus size={18}/></button><strong>{max>0?effectiveQuantity:0}</strong><button type="button" disabled={quantity>=max||max<1} aria-label="Agregar uno" onClick={()=>setQuantity(v=>Math.min(max,v+1))}><Plus size={18}/></button></div>
    <button type="button" className="mobile-add-action" disabled={max<1} onClick={()=>{if(onAdd(item,effectiveQuantity,note.trim()))onClose();else setAddError('No se agregó el producto. Revisa el inventario y el límite de tu carrito.');}}>Agregar · {pesos(Number(item.price)*effectiveQuantity)}</button>
   </div>
  </section>
 </div>;
}
export function CustomerCommerce({cart,onAdd,market}:{cart:Cart;onAdd:(item:MenuItem,quantity:number,note:string)=>boolean;market:MarketCode}){
 const {id}=useParams(),restaurantId=Number(id);const [params,setParams]=useSearchParams();
 const [merchant,setMerchant]=useState<Restaurant|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [retry,setRetry]=useState(0),[category,setCategory]=useState('Todos'),[selected,setSelected]=useState<MenuItem|null>(null);
 useEffect(()=>{setCategory('Todos');setSelected(null);},[restaurantId,market]);
 useEffect(()=>{let active=true;setLoading(true);setError('');setMerchant(null);
  if(!Number.isSafeInteger(restaurantId)||restaurantId<=0){setError('Comercio no válido');setLoading(false);return;}
  api.restaurant(restaurantId).then(value=>{if(value.market_code?.trim().toUpperCase()!==market)throw new Error('Este comercio no pertenece a la localidad seleccionada o el servidor no confirma su zona.');if(active)setMerchant(value);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'No pudimos cargar el menú');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[restaurantId,retry,market]);
 useEffect(()=>{
  const requested=Number(params.get('platillo'));
  if(!Number.isSafeInteger(requested)||requested<=0||!merchant||selected)return;
  const found=merchant.menu_items?.find(p=>p.id===requested);
  if(found&&found.is_available&&found.stock>0&&merchant.is_open)setSelected(found);
 },[merchant,params,selected]);
 const closeProduct=()=>{setSelected(null);if(params.has('platillo')){const next=new URLSearchParams(params);next.delete('platillo');setParams(next,{replace:true});}};
 const cats=useMemo(()=>['Todos',...new Set((merchant?.menu_items||[]).map(item=>item.category||'General'))],[merchant]);
 const dishes=(merchant?.menu_items||[]).filter(item=>category==='Todos'||(item.category||'General')===category);
 const canOrder=Boolean(merchant?.is_open);
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
    <div className="mobile-commerce-metadata">{merchant.eta_min!=null&&<span><Clock3 size={16}/>{merchant.eta_min} min</span>}<span><MapPin size={16}/>{merchant.address||marketLabel(market)}</span>{merchant.pickup_enabled&&<span><Store size={16}/>Para recoger</span>}</div>
    {!merchant.is_open&&<div className="mobile-commerce-warning">Este comercio está cerrado por ahora. Puedes ver su menú y pedir cuando vuelva a abrir.</div>}
    {merchant.is_open&&!merchant.pickup_enabled&&<div className="mobile-commerce-warning">Este comercio no permite recoger en tienda. Consulta la disponibilidad de entrega a domicilio y pagos al finalizar tu pedido.</div>}
    <h2>Menú</h2>
   </div>
   <div className="mobile-commerce-categories" role="group" aria-label="Categorías">{cats.map(c=><button key={c} onClick={()=>setCategory(c)} aria-pressed={category===c} className={category===c?'selected':''}>{c}</button>)}</div>
   <div className="mobile-commerce-dishes">{dishes.length?dishes.map(item=>{
    const available=canOrder&&item.is_available&&item.stock>0;
    return <article key={item.id} className={'mobile-dish-card'+(!available?' unavailable':'')}>
     <div className="mobile-dish-details"><h3>{item.name}</h3>{item.description&&<p>{item.description}</p>}<strong>{pesos(item.price)}</strong>{(!item.is_available||item.stock<=0)&&<span className="mobile-dish-soldout">Agotado</span>}</div>
     <div className="mobile-dish-photo"><ProductPhoto url={item.image_url} label={item.name}/><button disabled={!available} onClick={()=>setSelected(item)} aria-label={'Ver detalles y agregar '+item.name}><Plus size={23}/></button></div>
    </article>;
   }):<div className="mobile-status"><Store size={30}/><h3>Menú en preparación</h3><p>Este comercio aún no tiene productos en esta categoría.</p></div>}</div>
   {quantity>0&&<Link to="/carrito" className="mobile-commerce-cartbar"><span>{quantity}</span><strong>Ver carrito</strong><strong>{pesos(basketTotal(cart))}</strong><ChevronRight size={21}/></Link>}
   {selected&&<ProductSheet item={selected} merchant={merchant} cart={cart} onClose={closeProduct} onAdd={onAdd}/>}
  </>}
 </div>;
}
