import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {AlertTriangle,CheckCircle2,Send,ShieldCheck} from 'lucide-react';
import {api} from '../lib/api';

type Category='delivery_issue'|'merchant_issue'|'safety_issue'|'finance_question';
type Props={activeOrderId:number|null;offline:boolean};
const categoryLabel:Record<Category,string>={
 delivery_issue:'Problema con la entrega',
 merchant_issue:'Problema en el comercio',
 safety_issue:'Situación de seguridad',
 finance_question:'Duda sobre ganancias o efectivo',
};
/** Uses the authenticated support API that already exists in the client.
 * The currently verified backend does NOT authorize drivers to attach an order
 * by order_id, so the reference goes in text and order_id is always null.
 * Never represents the ticket as a server-linked delivery event.
 */
export function DriverSupportForm({activeOrderId,offline}:Props){
 const [category,setCategory]=useState<Category>('delivery_issue');
 const [description,setDescription]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [ticketId,setTicketId]=useState<number|null>(null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const valid=description.trim().length>=12&&description.trim().length<=1200;
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(busy||offline||!valid)return;
  setBusy(true);setError('');setTicketId(null);
  try{
   // Deliberately NULL: old server authorises order-linked tickets only for
   // its customer, not for an assigned courier. Do not evade this contract.
   const message=(activeOrderId&&Number.isSafeInteger(activeOrderId)&&activeOrderId>0
    ?'Referencia informativa de entrega #'+activeOrderId+'. ':'')+description.trim();
   const result=await api.createSupportTicket(category,message,null);
   if(!Number.isSafeInteger(result?.id)||result.id<=0)throw Error('El servidor no confirmó un folio válido.');
   if(mounted.current){setTicketId(result.id);setDescription('');}
  }catch(reason){
   if(mounted.current)setError(reason instanceof Error?reason.message:'No se pudo registrar la incidencia en el servidor.');
  }finally{if(mounted.current)setBusy(false);}
 };
 return <div className="df-driver-support">
  <p className="df-driver-support-intro"><ShieldCheck size={17} aria-hidden="true"/>
   Reporta una incidencia a soporte Tala Eats. El registro requiere confirmación del servidor.</p>
  {activeOrderId&&<p className="df-driver-support-context">Entrega #{activeOrderId} · La referencia se incluirá en el mensaje; aún no se vincula automáticamente al pedido.</p>}
  <form onSubmit={e=>void submit(e)}>
   <label htmlFor="df-support-category">Tipo de incidencia</label>
   <select id="df-support-category" value={category} disabled={busy}
    onChange={e=>setCategory(e.target.value as Category)}>
    {(Object.keys(categoryLabel) as Category[]).map(key=><option key={key} value={key}>{categoryLabel[key]}</option>)}
   </select>
   <label htmlFor="df-support-description">¿Qué ocurrió?</label>
   <textarea id="df-support-description" rows={4} maxLength={1200} value={description}
    onChange={e=>setDescription(e.target.value)} disabled={busy}
    placeholder="Explica el problema sin compartir PIN, contraseñas ni datos bancarios."/>
   <span className="df-driver-support-count">{description.length}/1200 · Mínimo 12 caracteres</span>
   <button className="df-primary" type="submit" disabled={busy||offline||!valid}>
    <Send size={17} aria-hidden="true"/>{busy?'Registrando…':'Enviar incidencia a soporte'}
   </button>
  </form>
  {offline&&<p className="df-driver-support-warning" role="status">Sin conexión: el reporte no se puede enviar.</p>}
  {error&&<p className="df-driver-support-warning" role="alert"><AlertTriangle size={16} aria-hidden="true"/>{error}</p>}
  {ticketId!==null&&<p className="df-driver-support-success" role="status"><CheckCircle2 size={16} aria-hidden="true"/>Ticket #{ticketId} confirmado por el servidor.</p>}
  <p className="df-driver-support-note">Este canal no reemplaza a los servicios de emergencia. No confirmes recogidas ni entregas que no hayan ocurrido.</p>
 </div>;
}
