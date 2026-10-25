import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowLeft,MessageCircle,RefreshCw,Send,WifiOff} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../lib/api';import {useSession} from '../lib/session';
interface ChatMessage{id?:number;sender_id:number;message:string;created_at?:string}
export function CustomerOrderChat(){
 const {id}=useParams(),n=Number(id);const valid=Number.isSafeInteger(n)&&n>0;
 const {user}=useSession();const [messages,setMessages]=useState<ChatMessage[]|null>(null);
 const [error,setError]=useState(''),[draft,setDraft]=useState(''),[loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false),[uncertain,setUncertain]=useState(false),[epoch,setEpoch]=useState(0);
 const current=useRef(false);
 const refresh=()=>setEpoch(v=>v+1);
 useEffect(()=>{
  let active=true;let pending=false;
  if(!valid){setError('Pedido inválido.');setLoading(false);return()=>{active=false};}
  const load=async()=>{
   if(pending||document.visibilityState==='hidden')return;pending=true;
   try{
    const rows=await api.customerOrderChat(n);
    if(!Array.isArray(rows))throw new Error('El servidor devolvió mensajes inválidos.');
    if(active){setMessages(rows);setError('');setUncertain(false);}
   }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudieron actualizar los mensajes.');}
   finally{pending=false;if(active)setLoading(false);}
  };
  void load();
  const interval=window.setInterval(()=>void load(),5000);
  const focus=()=>void load();
  document.addEventListener('visibilitychange',focus);
  return()=>{active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',focus);};
 },[n,valid,epoch,user?.id]);
 async function submit(e:FormEvent){
  e.preventDefault();
  const message=draft.trim();
  if(!message||message.length>3000||sending||uncertain||current.current||!valid)return;
  current.current=true;setSending(true);setError('');
  try{
   const response=await api.sendCustomerOrderChat(n,message);
   if(!response||response.message!==message)throw new Error('El servidor no confirmó el mensaje.');
   setDraft('');setMessages(prev=>[...(prev??[]),response]);refresh();
  }catch(err){setUncertain(true);setError((err instanceof Error?err.message:'No se pudo confirmar el mensaje.')+' Actualiza el chat antes de reintentar.');}
  finally{setSending(false);current.current=false;}
 }
 return <div className="mobile-customer-page mobile-order-chat" data-mobile-screen="order-chat">
  <div className="mobile-detail-header"><Link to={'/pedidos/'+id} aria-label="Volver al pedido"><ArrowLeft size={22}/></Link><h1>Chat del pedido #{id}</h1><button onClick={refresh} aria-label="Actualizar chat"><RefreshCw size={19}/></button></div>
  {error&&<div className="mobile-address-error" role="alert"><WifiOff size={17}/>{error}</div>}
  <div className="mobile-chat-messages">
   {loading&&!messages?<div className="mobile-loading-order"><RefreshCw className="spin" size={19}/>Cargando mensajes…</div>:
   !messages?.length?<div className="mobile-status"><MessageCircle size={32}/><h2>{error?'Mensajes no disponibles':'Aún no hay mensajes'}</h2><p>{error?'Revisa la conexión y vuelve a actualizar.':'Escribe aquí para hablar con el equipo de tu pedido.'}</p></div>:
   messages.map((msg,i)=><div className={'mobile-chat-bubble '+(msg.sender_id===user?.id?'mine':'other')} key={msg.id??i}>
    <span>{msg.message}</span><small>{msg.created_at?new Date(msg.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):''}</small>
   </div>)}
  </div>
  <form className="mobile-chat-composer" onSubmit={e=>void submit(e)}>
   <textarea aria-label="Escribe un mensaje" rows={1} maxLength={3000} value={draft} disabled={sending||uncertain||!valid} onChange={e=>setDraft(e.target.value)} placeholder="Escribe un mensaje…" />
   <button aria-label="Enviar mensaje" disabled={sending||uncertain||!draft.trim()||!valid} type="submit">{sending?<RefreshCw size={20} className="spin"/>:<Send size={21}/>}</button>
  </form>
  <p className="mobile-checkout-disclosure">Mensajes actualizados cada 5 segundos mientras tengas esta pantalla abierta. No se muestra confirmación antes de recibirla del servidor.</p>
 </div>;
}
