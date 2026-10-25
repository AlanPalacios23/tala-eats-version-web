import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, MapPin, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { parseCoordinate, validAddress } from '../lib/customer-checkout';
import type { CustomerAddress } from '../lib/customer-checkout';

function AddAddressSheet({onClose,onSaved,makeDefault}:{onClose:()=>void;onSaved:()=>void;makeDefault:boolean}){
 const [label,setLabel]=useState('Casa'),[address,setAddress]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{cancel.current?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[onClose,busy]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   if(!label.trim()||address.trim().length<5)throw new Error('Indica una etiqueta y una dirección completa.');
   const geo=await api.geocode(address.trim());
   const first=geo.results?.[0];
   const lat=parseCoordinate(first?.lat,'lat'),lng=parseCoordinate(first?.lng,'lng');
   if(lat===null||lng===null)throw new Error('El servidor no pudo validar las coordenadas. Revisa tu dirección.');
   const saved=await api.addCustomerAddress({label:label.trim(),address:address.trim(),lat,lng,is_default:makeDefault});
   if(!validAddress(saved))throw new Error('La dirección se registró, pero el servidor no confirmó sus coordenadas. Actualiza tu lista.');
   onSaved();
  }catch(err){setError(err instanceof Error?err.message:'No logramos guardar la dirección.');}finally{setBusy(false);}
 }
 return <div className="mobile-sheet-scrim" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section className="mobile-address-sheet" role="dialog" aria-modal="true" aria-label="Agregar dirección">
   <div className="mobile-sheet-handle"/><div className="mobile-address-sheet-header"><h2>Agregar dirección</h2><button ref={cancel} onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={21}/></button></div>
   <form onSubmit={e=>void submit(e)}>
    <label>Nombre de la dirección<input maxLength={80} required value={label} onChange={e=>setLabel(e.target.value)} placeholder="Casa, trabajo…"/></label>
    <label>Dirección completa<input minLength={5} maxLength={240} required value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle, número, colonia, municipio"/></label>
    <p>Verificaremos la ubicación con el servidor antes de guardarla. No se aceptarán coordenadas estimadas.</p>
    {error&&<div className="mobile-address-error" role="alert">{error}</div>}
    <button className="mobile-add-action" disabled={busy} type="submit">{busy?'Verificando ubicación…':'Guardar dirección'}</button>
   </form>
  </section>
 </div>;
}

export function CustomerAddresses(){
 const loc=useLocation(),back=(loc.state as {returnTo?:string}|null)?.returnTo==='/checkout'?'/checkout':'/cuenta';
 const [rows,setRows]=useState<CustomerAddress[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [tick,setTick]=useState(0),[busy,setBusy]=useState<number|null>(null),[showAdd,setShowAdd]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.customerAddresses().then(value=>{if(active)setRows(value);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'Error al consultar direcciones');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[tick]);
 const refresh=()=>setTick(x=>x+1);
 async function select(row:CustomerAddress){
  if(busy!==null)return;setBusy(row.id);setError('');
  try{await api.updateCustomerAddress(row.id,{is_default:true});refresh();}
  catch(err){setError(err instanceof Error?err.message:'No se pudo seleccionar la dirección.');}finally{setBusy(null);}
 }
 async function remove(row:CustomerAddress){
  if(busy!==null||rows.length<=1)return;
  if(!window.confirm('¿Eliminar dirección? '+row.label+' dejará de aparecer en tus direcciones.'))return;
  setBusy(row.id);setError('');
  try{await api.deleteCustomerAddress(row.id);refresh();}
  catch(err){setError(err instanceof Error?err.message:'No se pudo eliminar la dirección.');}finally{setBusy(null);}
 }
 return <div className="mobile-customer-page mobile-addresses" data-mobile-screen="addresses">
  <div className="mobile-detail-header"><Link to={back} aria-label="Regresar"><ArrowLeft size={22}/></Link><h1>Direcciones</h1><button onClick={()=>setShowAdd(true)} aria-label="Agregar dirección"><Plus size={22}/></button></div>
  {error&&<div className="mobile-address-error" role="alert">{error}<button onClick={refresh}>Reintentar</button></div>}
  {loading?<p className="mobile-address-loading"><RefreshCw size={20} className="spin"/> Consultando direcciones…</p>:
   !rows.length?<div className="mobile-status"><MapPin size={32}/><h2>Aún no tienes direcciones</h2><p>Agrega dónde quieres recibir tus pedidos.</p><button onClick={()=>setShowAdd(true)}>Agregar dirección</button></div>:
   <><p className="mobile-addresses-intro">Elige dónde quieres recibir tus pedidos.</p>{rows.map(row=><div key={row.id} className={'mobile-address-card '+(row.is_default?'selected':'')}>
    <button className="mobile-address-choice" aria-pressed={row.is_default} disabled={busy!==null} onClick={()=>void select(row)}>
     {row.is_default?<CheckCircle2 size={24}/>:<MapPin size={24}/>}
     <span><strong>{row.label}</strong><small>{row.address}</small>{!validAddress(row)&&<small>Coordenadas sin confirmar: no usar para entrega</small>}</span>
     {!row.is_default&&<ChevronRight size={20}/>}
    </button>
    {rows.length>1&&<button className="mobile-address-delete" aria-label={'Eliminar '+row.label} disabled={busy!==null} onClick={()=>void remove(row)}><Trash2 size={19}/></button>}
   </div>)}</>}
  {showAdd&&<AddAddressSheet makeDefault={!rows.length} onSaved={()=>{setShowAdd(false);refresh();}} onClose={()=>setShowAdd(false)}/>}
 </div>;
}
