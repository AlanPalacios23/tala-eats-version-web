import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Wallet, LifeBuoy } from 'lucide-react';
import { api,pesos } from '../lib/api';
import './customer-extras.css';
function Frame({title,children}:{title:string;children:React.ReactNode}){
 return <div className="te-customer te-extra"><div className="te-extra-inner">
 <Link to="/cuenta" className="te-extra-back"><ArrowLeft size={18}/>Cuenta</Link><h1>{title}</h1>{children}</div></div>;
}
function Failure({retry}:{retry:()=>void}){return <div role="alert" className="te-extra-message">
 No se pudo verificar esta información con el servidor. No significa que tengas saldo cero ni que no existan movimientos.
 <button onClick={retry}>Reintentar</button></div>}
export function CustomerWallet(){
 const [data,setData]=useState<Awaited<ReturnType<typeof api.wallet>>|null>(null);
 const [state,setState]=useState<'loading'|'ok'|'error'>('loading');
 const [tick,setTick]=useState(0);
 useEffect(()=>{let active=true;setState('loading');api.wallet().then(x=>{if(active){setData(x);setState('ok');}})
 .catch(()=>{if(active){setData(null);setState('error');}});return()=>{active=false;};},[tick]);
 return <Frame title="Tala Club">{state==='loading'?<p role="status">Consultando saldo…</p>:
 state==='error'||!data?<Failure retry={()=>setTick(x=>x+1)}/>:
 <><div className="te-extra-hero"><Wallet size={24}/><span>Saldo disponible</span>
 <strong>{pesos(data.balance)}</strong><p>{data.points} puntos</p></div>
 <h2>Movimientos</h2>{!data.transactions?.length?<p>Sin movimientos registrados.</p>:
 data.transactions.map((t,i)=><div className="te-extra-entry" key={t.id??i}>
 <div><strong>{t.description||'Movimiento'}</strong><small>{t.created_at?.slice(0,10)||''}</small></div>
 <b>{Number(t.amount)>=0?'+':''}{pesos(t.amount)}</b></div>)}</>}</Frame>;
}
export function CustomerNotifications(){
 const [data,setData]=useState<Awaited<ReturnType<typeof api.notifications>>>([]);
 const [state,setState]=useState<'loading'|'ok'|'error'>('loading'),[tick,setTick]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const reload=()=>setTick(x=>x+1);
 useEffect(()=>{let active=true;setState('loading');api.notifications().then(x=>{if(active){setData(Array.isArray(x)?x:[]);setState('ok');}})
 .catch(()=>{if(active)setState('error');});return()=>{active=false;};},[tick]);
 const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await fn();reload();}catch(e){setMessage(e instanceof Error?e.message:'Error del servidor');}finally{setBusy(false);}};
 return <Frame title="Notificaciones">
 {state==='loading'?<p>Cargando…</p>:state==='error'?<Failure retry={reload}/>:
 <>{data.some(x=>!x.is_read)&&<button className="te-extra-action" disabled={busy} onClick={()=>void act(api.markAllNotificationsRead)}>Marcar todo leído</button>}
 {!data.length?<p>No tienes notificaciones.</p>:data.map(x=><button className="te-extra-entry te-extra-note" disabled={busy||x.is_read} key={x.id} onClick={()=>void act(()=>api.markNotificationRead(x.id))}>
 <Bell size={20}/><span><strong>{x.title}</strong><small>{x.message}</small><small>{x.created_at?.slice(0,10)}</small></span>{!x.is_read&&<em>•</em>}</button>)}</>}
 {message&&<p role="alert">{message}</p>}</Frame>;
}
export function CustomerSupport(){
 const [text,setText]=useState(''),[category,setCategory]=useState('general'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy||text.trim().length<5)return;setBusy(true);setError('');setSent(false);
 try{await api.supportTicket(text.trim(),category);setSent(true);setText('');}
 catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la solicitud');}finally{setBusy(false);}};
 return <Frame title="Ayuda y soporte"><div className="te-extra-hero"><LifeBuoy size={25}/><h2>¿En qué podemos ayudarte?</h2></div>
 <form onSubmit={e=>void submit(e)} className="te-extra-form">
 <label>Motivo<select value={category} onChange={e=>setCategory(e.target.value)}><option value="general">General</option><option value="order">Pedido</option><option value="payment">Pago</option><option value="account">Cuenta</option></select></label>
 <label>Mensaje<textarea rows={6} required minLength={5} maxLength={1500} value={text} onChange={e=>setText(e.target.value)} placeholder="Describe tu problema…"/></label>
 {error&&<p role="alert">{error}</p>}{sent&&<p role="status">Solicitud registrada en el servidor.</p>}
 <button type="submit" disabled={busy||text.trim().length<5}>{busy?'Enviando…':'Enviar solicitud'}</button>
 </form></Frame>;
}
