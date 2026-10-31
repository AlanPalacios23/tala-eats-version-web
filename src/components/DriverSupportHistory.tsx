import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {api} from '../lib/api';

type Entry={id:number;user_id?:number;category?:string;status?:string;created_at?:string};
/** Only verified own support tickets; backend may return heterogeneous/legacy
 * records and this PWA must NEVER show another account's information.
 */
export function DriverSupportHistory({accountId}:{accountId:number|null}){
 const [rows,setRows]=useState<Entry[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;
  setRows([]);setError('');
  if(!accountId||!Number.isSafeInteger(accountId)||accountId<=0){
   setLoading(false);setError('No se pudo verificar tu cuenta para consultar los reportes.');
   return()=>{active=false;};
  }
  setLoading(true);
  void api.supportTickets().then(items=>{
   if(!active)return;
   if(!Array.isArray(items))throw new Error('Respuesta de soporte no válida.');
   const verified:Entry[]=items.filter(item=>
    item!==null&&Number.isSafeInteger(item.id)&&item.id>0&&item.user_id===accountId);
   setRows(verified.slice(0,8));
  }).catch(()=>{
   if(active){setRows([]);setError('No se pudo verificar el historial de reportes.');}
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[accountId,revision]);
 return <section className="df-driver-ticket-history" aria-label="Reportes registrados">
  <div className="df-driver-ticket-head"><strong>Mis reportes</strong>
   <button type="button" onClick={()=>setRevision(v=>v+1)} disabled={loading||!accountId}>
    <RefreshCw size={15} aria-hidden="true"/>Actualizar
   </button></div>
  {loading&&<p role="status">Consultando tickets del servidor…</p>}
  {error&&<p role="status">{error}</p>}
  {!loading&&!error&&rows.length===0&&<p>No hay reportes verificables para esta cuenta.</p>}
  {!loading&&!error&&rows.map(item=><div className="df-driver-ticket-row" key={item.id}>
   <strong>Ticket #{item.id}</strong>
   <span>{item.status||'Registrado'} · {item.category||'Incidencia'}</span>
  </div>)}
 </section>;
}
