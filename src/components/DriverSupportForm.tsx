import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {AlertTriangle,CheckCircle2,RefreshCw,Send,ShieldCheck} from 'lucide-react';
import {api} from '../lib/api';
import {DriverSupportHistory} from './DriverSupportHistory';
import {linkedDriverTicketOrderId,verifiedDriverSupportCapability} from '../lib/driver-support-capability';

type Category='delivery_issue'|'merchant_issue'|'safety_issue'|'finance_question';
type Props={activeOrderId:number|null;offline:boolean;accountId:number|null};
const categoryLabel:Record<Category,string>={
 delivery_issue:'Problema con la entrega',
 merchant_issue:'Problema en el comercio',
 safety_issue:'Situación de seguridad',
 finance_question:'Duda sobre ganancias o efectivo',
};

/** RC153: the UI build flag alone never permits support writes. The courier
 * first needs a fresh authenticated capability from the Node server.
 * The server remains the only authority over assigned-order support tickets.
 */
export function DriverSupportForm({activeOrderId,offline,accountId}:Props){
 const [category,setCategory]=useState<Category>('delivery_issue');
 const [description,setDescription]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [ticketId,setTicketId]=useState<number|null>(null);
 const [capability,setCapability]=useState(false);
 const [checking,setChecking]=useState(true);
 const mounted=useRef(true);
 const inFlight=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let alive=true;
  setCapability(false);setChecking(true);setError('');
  if(offline||!Number.isSafeInteger(accountId)||!accountId||accountId<=0){
   setChecking(false);
   return()=>{alive=false;};
  }
  void api.driverSupportCapabilities().then(value=>{
   if(alive)setCapability(verifiedDriverSupportCapability(value)!==null);
  }).catch(()=>{
   if(alive)setCapability(false);
  }).finally(()=>{if(alive)setChecking(false);});
  return()=>{alive=false;};
 },[accountId,offline]);
 const valid=description.trim().length>=12&&description.trim().length<=1200;
 const allowed=capability&&!offline&&!!accountId&&Number.isSafeInteger(accountId)&&accountId>0;
 const linkedOrderId=linkedDriverTicketOrderId(activeOrderId,allowed);
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(inFlight.current||busy||!allowed||!valid)return;
  inFlight.current=true;setBusy(true);setError('');setTicketId(null);
  try{
   const result=await api.createSupportTicket(category,description.trim(),linkedOrderId);
   if(!Number.isSafeInteger(result?.id)||result.id<=0||
     result.user_id!==accountId||result.order_id!==linkedOrderId)
    throw Error('El servidor no confirmó la autoría y la vinculación del ticket.');
   if(mounted.current){setTicketId(result.id);setDescription('');}
  }catch(reason){
   if(mounted.current)setError(reason instanceof Error?reason.message:'No se pudo registrar la incidencia en el servidor.');
  }finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 };
 return <div className="df-driver-support">
  <p className="df-driver-support-intro"><ShieldCheck size={17} aria-hidden="true"/>
   Reporta una incidencia a soporte Tala Eats. El registro requiere confirmación del servidor.</p>
  {checking&&<p className="df-driver-support-context" role="status"><RefreshCw size={15} aria-hidden="true"/> Verificando permiso de soporte…</p>}
  {!checking&&!capability&&<p className="df-driver-support-warning" role="status">
   Soporte vinculado a pedidos no autorizado en este servidor. No se enviará ningún reporte hasta habilitarlo de forma segura.</p>}
  {activeOrderId&&capability&&<p className="df-driver-support-context">
   Entrega #{activeOrderId} · Se vinculará únicamente si el servidor confirma que eres su repartidor asignado.</p>}
  <form onSubmit={e=>void submit(e)}>
   <label htmlFor="df-support-category">Tipo de incidencia</label>
   <select id="df-support-category" value={category} disabled={busy||!allowed}
    onChange={e=>setCategory(e.target.value as Category)}>
    {(Object.keys(categoryLabel) as Category[]).map(key=><option key={key} value={key}>{categoryLabel[key]}</option>)}
   </select>
   <label htmlFor="df-support-description">¿Qué ocurrió?</label>
   <textarea id="df-support-description" rows={4} maxLength={1200} value={description}
    onChange={e=>setDescription(e.target.value)} disabled={busy||!allowed}
    placeholder="Explica el problema sin compartir PIN, contraseñas ni datos bancarios."/>
   <span className="df-driver-support-count">{description.length}/1200 · Mínimo 12 caracteres</span>
   <button className="df-primary" type="submit" disabled={busy||!allowed||!valid}>
    <Send size={17} aria-hidden="true"/>{busy?'Registrando…':'Enviar incidencia a soporte'}
   </button>
  </form>
  {offline&&<p className="df-driver-support-warning" role="status">Sin conexión: el reporte no se puede enviar.</p>}
  {error&&<p className="df-driver-support-warning" role="alert"><AlertTriangle size={16} aria-hidden="true"/>{error}</p>}
  {ticketId!==null&&<p className="df-driver-support-success" role="status"><CheckCircle2 size={16} aria-hidden="true"/>
   Ticket #{ticketId} confirmado por el servidor{linkedOrderId?' y vinculado a entrega #'+linkedOrderId:''}.</p>}
  {capability&&<DriverSupportHistory key={ticketId??'initial'} accountId={accountId}/>}
  <p className="df-driver-support-note">Este canal no reemplaza a los servicios de emergencia. No confirmes recogidas ni entregas que no hayan ocurrido.</p>
 </div>;
}
