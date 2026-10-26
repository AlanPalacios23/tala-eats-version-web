import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bike, ChevronRight, Heart, Headphones, LogOut, MapPin, Package, RefreshCw, ShieldCheck, Store, FileText, Wallet, WifiOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, isMerchantRole, isDriverRole, pesos } from '../lib/api';
import { useSession } from '../lib/session';
import { amountInCents } from '../lib/mobile-parity';
import type { Restaurant } from '../lib/types';
import {CustomerAvatar} from './CustomerAvatar';
import {LEGAL_LINKS} from '../lib/legal-links';
import {enableWebPush,disableWebPush,getWebPushConfig,isWebPushEnabledForUser,supportsWebPush,webPushPermission} from '../lib/web-push';
import type {WebPushConfig} from '../lib/web-push';
import {PREVIEW_READONLY} from '../lib/preview';

function Heading({title,back='/cuenta',refresh}:{title:string;back?:string;refresh?:()=>void}){
 return <div className="mobile-detail-header"><Link to={back} aria-label="Regresar"><ArrowLeft size={22}/></Link><h1>{title}</h1>{refresh&&<button aria-label="Actualizar" onClick={refresh}><RefreshCw size={20}/></button>}</div>;
}
function AccountLink({to,label,icon,subtitle}:{to:string;label:string;icon:ReactNode;subtitle?:string}){
 const content=<><span className="mobile-account-icon">{icon}</span><span className="mobile-account-link-copy"><strong>{label}</strong>{subtitle&&<small>{subtitle}</small>}</span><ChevronRight size={19}/></>;
 return to.startsWith('https://')?<a className="mobile-account-link" href={to} target="_blank" rel="noopener noreferrer">{content}</a>:<Link className="mobile-account-link" to={to}>{content}</Link>;
}
export function CustomerAccount(){
 const {user,logout}=useSession(),nav=useNavigate();const [busy,setBusy]=useState(false),[logoutError,setLogoutError]=useState('');
 async function leave(){
  if(busy||!window.confirm('¿Cerrar sesión? Podrás volver a entrar con tu correo y contraseña.'))return;
  setBusy(true);setLogoutError('');
  try{
   await logout();
   // Flutter returns to the login/welcome flow after signing out; NEVER
   // leave the previous authenticated customer's storefront/account visible.
   nav('/acceso',{replace:true,state:{from:'/clientes'}});
  }catch(e){setLogoutError(e instanceof Error?e.message:'No se pudo cerrar sesión. Inténtalo de nuevo.');}
  finally{setBusy(false);}
 }
 return <div className="mobile-customer-page mobile-account" data-mobile-screen="account">
  <h1>Cuenta</h1>
  {logoutError&&<div role="alert" className="mobile-address-error">{logoutError}</div>}
  <Link to="/editar-perfil" className="mobile-account-profile"><span className="mobile-account-avatar"><CustomerAvatar userId={user?.id} url={user?.avatar_url}/></span><div><strong>{user?.name||'Tu perfil'}</strong><span>{user?.email}</span></div><ChevronRight size={20}/></Link>
  <Link to="/tala-club" className="mobile-account-club"><Wallet size={23}/><div><strong>Tala Club</strong><small>Consulta saldo, puntos y movimientos verificados</small></div><ChevronRight size={20}/></Link>
  <h2>Tu cuenta</h2><div className="mobile-account-group">
   <AccountLink to="/favoritos" label="Favoritos" icon={<Heart size={21}/>}/>
   <AccountLink to="/pedidos" label="Mis pedidos" icon={<Package size={21}/>}/>
   <AccountLink to="/direcciones" label="Direcciones" icon={<MapPin size={21}/>}/>
   <AccountLink to="/notificaciones" label="Notificaciones" icon={<Bell size={21}/>}/>
  </div>
  <h2>Privacidad y documentos</h2><div className="mobile-account-group">
   <AccountLink to={LEGAL_LINKS.terms} label="Términos y condiciones" subtitle="Documento público de Tala Eats" icon={<FileText size={21}/>}/>
   <AccountLink to={LEGAL_LINKS.privacy} label="Aviso de privacidad" subtitle="Documento oficial de Tala Eats" icon={<ShieldCheck size={21}/>}/>
   <AccountLink to={LEGAL_LINKS.deletion} label="Eliminar mi cuenta" subtitle="Consultar el procedimiento oficial" icon={<ShieldCheck size={21}/>}/>
  </div>
  <h2>Ayuda</h2><div className="mobile-account-group">
   <AccountLink to="/soporte" label="Ayuda y soporte" icon={<Headphones size={21}/>}/>
  </div>
  {(isMerchantRole(user?.role)||isDriverRole(user?.role))&&<div className="mobile-account-group">{isMerchantRole(user?.role)&&<AccountLink to="/restaurante" label="Panel restaurante" icon={<Store size={21}/>}/>} {isDriverRole(user?.role)&&<AccountLink to="/repartidor" label="Panel repartidor" icon={<Bike size={21}/>}/>} </div>}
  <button className="mobile-account-logout" disabled={busy} onClick={()=>void leave()}><LogOut size={20}/> {busy?'Cerrando sesión…':'Cerrar sesión'}</button>
 </div>;
}
interface WalletSnapshot{balance:string|number;points:number;plus_member?:boolean;referral_code?:string;tier?:string;transactions?:{id?:number;kind?:string;description?:string;amount?:number|string;created_at?:string}[]}
export function CustomerWallet(){
 const [snapshot,setSnapshot]=useState<WalletSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tick,setTick]=useState(0),[busy,setBusy]=useState(false),[redemptionUncertain,setRedemptionUncertain]=useState(false);
 const refresh=()=>setTick(n=>n+1);
 useEffect(()=>{let active=true;setLoading(true);setError('');setSnapshot(null);
  api.wallet().then(value=>{if(amountInCents(value.balance)===null||!Number.isSafeInteger(value.points)||value.points<0|| (value.transactions!==undefined&&!Array.isArray(value.transactions)))throw new Error('El servidor devolvió un saldo o puntos inválidos.');if(active){setSnapshot(value);setRedemptionUncertain(false);}}).catch(err=>{if(active)setError(err instanceof Error?err.message:'No pudimos verificar tu saldo.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[tick]);
 async function redeem(){
  if(!snapshot||busy||redemptionUncertain||snapshot.points<500)return;
  if(!window.confirm('¿Canjear 500 puntos? El servidor confirmará si tu recompensa está disponible.'))return;
  setBusy(true);setError('');
  try{await api.redeemReward();refresh();}
  catch(err){setRedemptionUncertain(true);setError((err instanceof Error?err.message:'No se pudo confirmar la recompensa.')+' Actualiza el saldo antes de volver a canjear.');}finally{setBusy(false);}
 }
 return <div className="mobile-customer-page mobile-wallet" data-mobile-screen="wallet">
  <Heading title="Tala Club" refresh={refresh}/>
  {error&&<div className="mobile-address-error" role="alert"><WifiOff size={18}/>{error} Los datos no se consideran verificados.</div>}
  <section className="mobile-wallet-hero"><small>TALA CLUB</small><span>Saldo disponible</span><strong>{loading?'Verificando…':snapshot?pesos(snapshot.balance):'Sin verificar'}</strong><p>{snapshot? `${snapshot.points} puntos · Nivel ${snapshot.tier||'Por confirmar'}`:'Los importes requieren respuesta del servidor.'}</p>{snapshot?.plus_member&&<span>Membresía activa</span>}</section>
  <section className="mobile-checkout-card"><h2>Recompensas</h2><p>Canjea 500 puntos cuando estén disponibles y confirmados por el servidor.</p><div className="mobile-wallet-progress"><span style={{width:`${Math.min(100,Math.max(0,(snapshot?.points??0)/500*100))}%`}}/></div><button className="mobile-checkout-fixed" disabled={busy||redemptionUncertain||!snapshot||snapshot.points<500} onClick={()=>void redeem()}>{busy?'Verificando canje…':'Canjear 500 puntos'}</button></section>
  <h2>Movimientos</h2>
  {!snapshot?<div className="mobile-status"><WifiOff size={30}/><h3>Movimientos no disponibles</h3><p>No pudimos consultar el historial. No significa que no tengas movimientos.</p></div>:!snapshot.transactions?.length?<div className="mobile-status"><Wallet size={29}/><h3>Sin movimientos</h3><p>Tus movimientos de saldo y puntos aparecerán aquí.</p></div>:<div className="mobile-account-group">{snapshot.transactions.map((txn,i)=><div className="mobile-wallet-transaction" key={txn.id??i}><div><strong>{txn.description||'Movimiento'}</strong><small>{txn.created_at?new Date(txn.created_at).toLocaleDateString('es-MX'):''}</small></div><b>{txn.amount!==undefined?pesos(txn.amount):'—'}</b></div>)}</div>}
 </div>;
}
interface Notice{id:number;kind:string;title:string;message:string;is_read:boolean;created_at:string}
export function CustomerNotifications(){
 const {user}=useSession();
 const [rows,setRows]=useState<Notice[]|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tick,setTick]=useState(0),[busy,setBusy]=useState(false);
 const [pushConfig,setPushConfig]=useState<WebPushConfig|null>(null);
 const [pushEnabled,setPushEnabled]=useState(false),[pushLoading,setPushLoading]=useState(true);
 const [pushBusy,setPushBusy]=useState(false),[pushError,setPushError]=useState(''),[pushInfo,setPushInfo]=useState('');
 const refresh=()=>setTick(v=>v+1);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.customerNotifications().then(value=>{if(active)setRows(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron verificar las notificaciones.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[tick]);
 useEffect(()=>{
  let active=true;
  setPushConfig(null);setPushEnabled(false);setPushInfo('');setPushError('');
  if(!user||user.role!=='customer'||PREVIEW_READONLY){setPushLoading(false);return()=>{active=false};}
  setPushLoading(true);
  Promise.allSettled([getWebPushConfig(),isWebPushEnabledForUser(user.id)]).then(([config,state])=>{
   if(!active)return;
   if(config.status==='fulfilled')setPushConfig(config.value);
   else setPushError('El servidor todavía no confirma el servicio de notificaciones push para esta PWA.');
   if(state.status==='fulfilled')setPushEnabled(state.value);
  }).finally(()=>{if(active)setPushLoading(false);});
  return()=>{active=false};
 },[user?.id,user?.role]);
 useEffect(()=>{
  if(!user)return;
  const check=()=>{if(document.visibilityState==='visible')refresh();};
  const interval=window.setInterval(check,60_000);
  document.addEventListener('visibilitychange',check);
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',check);};
 },[user?.id]);
 async function changePush(){
  if(!user||user.role!=='customer'||pushBusy||PREVIEW_READONLY)return;
  setPushBusy(true);setPushError('');setPushInfo('');
  try{
   if(pushEnabled){
    await disableWebPush(user.id);
    setPushEnabled(false);
    setPushInfo('Notificaciones del navegador desactivadas.');
   }else{
    if(!pushConfig)throw new Error('Web Push no está disponible en el backend de este entorno.');
    await enableWebPush(user.id,pushConfig);
    setPushEnabled(true);
    setPushInfo('Dispositivo registrado en el servidor. Recibirás avisos cuando haya eventos reales.');
   }
  }catch(e){
   setPushError(e instanceof Error?e.message:'No fue posible actualizar las notificaciones push.');
   if(pushEnabled){
    const stillEnabled=await isWebPushEnabledForUser(user.id).catch(()=>false);
    setPushEnabled(stillEnabled);
   }
  }finally{setPushBusy(false);}
 }
 async function mark(id:number|null){
  if(busy)return;setBusy(true);setError('');
  try{if(id===null)await api.notificationsReadAll();else await api.notificationRead(id);refresh();}
  catch(e){setError(e instanceof Error?e.message:'No pudimos marcar la notificación.');}finally{setBusy(false);}
 }
 return <div className="mobile-customer-page mobile-notifications" data-mobile-screen="notifications">
  <Heading title="Notificaciones" refresh={refresh}/>
  <section className="mobile-push-preferences" aria-labelledby="mobile-push-title">
   <div className="mobile-push-title"><Bell size={22}/><div><h2 id="mobile-push-title">Avisos en tu dispositivo</h2><p>Pedidos, repartos, pagos y novedades de tu cuenta. Sin permiso automático ni mensajes de prueba.</p></div></div>
   {pushLoading?<p role="status">Comprobando compatibilidad con el servidor…</p>:
    !supportsWebPush()?<p role="status">Este navegador no admite Web Push. En iPhone, instala primero la PWA desde Safari y ábrela desde tu pantalla de inicio.</p>:
    webPushPermission()==='denied'?<p role="status">Las notificaciones están bloqueadas. Habilítalas en los ajustes de este navegador o de la PWA.</p>:
    <button type="button" className={'mobile-push-toggle'+(pushEnabled?' active':'')} disabled={pushBusy||(!pushConfig&&!pushEnabled)} onClick={()=>void changePush()}>
     {pushBusy?'Guardando…':pushEnabled?'Desactivar avisos push':'Activar notificaciones reales'}
    </button>}
   {pushInfo&&<p role="status" className="mobile-push-ok">{pushInfo}</p>}
   {pushError&&<p role="alert" className="mobile-push-error">{pushError}</p>}
   <p className="mobile-push-disclosure">Para recibir avisos con la aplicación cerrada, el servidor debe tener VAPID y un worker de Web Push activos. Las promociones requieren consentimiento independiente.</p>
  </section>
  {rows?.some(r=>!r.is_read)&&<button className="mobile-notice-all" disabled={busy} onClick={()=>void mark(null)}>Marcar todo leído</button>}
  {error&&<div className="mobile-address-error" role="alert">{error}</div>}
  {loading&&!rows?<div className="mobile-loading-order"><RefreshCw className="spin" size={19}/>Cargando avisos…</div>:
   !rows?.length?<div className="mobile-status"><Bell size={32}/><h2>{error?'Avisos sin verificar':'No hay notificaciones'}</h2><p>{error?'Intenta actualizar para consultar tus avisos.':'Cuando haya novedades de tu cuenta y pedidos las verás aquí.'}</p></div>:
   <div className="mobile-account-group">{rows.map(row=><button className={'mobile-notice '+(!row.is_read?'unread':'')} key={row.id} disabled={busy||row.is_read} onClick={()=>void mark(row.id)}><Bell size={20}/><span><strong>{row.title}</strong><small>{row.message}</small><small>{row.created_at?new Date(row.created_at).toLocaleString('es-MX'):''}</small></span>{!row.is_read&&<span className="mobile-unread-dot"/>}</button>)}</div>}
  <p className="mobile-checkout-disclosure">Los avisos de esta lista proceden de tu cuenta en el backend de Tala Eats.</p>
 </div>;
}
interface Ticket{id:number;user_id?:number;order_id?:number|null;category?:string;message:string;status?:string;created_at?:string}
const categories:{value:string;label:string}[]=[{value:'general',label:'General'},{value:'pedido',label:'Pedido'},{value:'pago',label:'Pago'},{value:'cuenta',label:'Cuenta'},{value:'reembolso',label:'Reembolso'},{value:'otro',label:'Otro'}];
export function CustomerSupport(){
 const {user}=useSession();const [params]=useSearchParams();const rawOrder=Number(params.get('pedido'));const orderId=Number.isSafeInteger(rawOrder)&&rawOrder>0?rawOrder:null;const [tickets,setTickets]=useState<Ticket[]|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[sendError,setSendError]=useState('');
 const [category,setCategory]=useState(orderId?'pedido':'general'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[tick,setTick]=useState(0);
 const refresh=()=>setTick(v=>v+1);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  api.supportTickets().then(rows=>{if(active){setTickets(rows.filter(row=>(row.user_id===undefined||row.user_id===user?.id)&&(orderId===null||row.order_id===orderId)).reverse());setUncertain(false);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No logramos cargar tus solicitudes.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[tick,user?.id,orderId]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||uncertain)return;
  const trimmed=message.trim();
  if(trimmed.length<5||trimmed.length>3000){setSendError('Escribe un mensaje entre 5 y 3000 caracteres.');return;}
  setBusy(true);setSendError('');
  try{
   const ticket=await api.createSupportTicket(category,trimmed,orderId);
   if(!Number.isSafeInteger(Number(ticket.id))||Number(ticket.id)<=0)throw new Error('El servidor no confirmó el número de solicitud. Consulta el historial.');
   setTickets(prev=>[...(prev??[]),ticket]);setMessage('');
  }catch(e){setUncertain(true);setSendError(e instanceof Error?e.message:'No pudimos confirmar el envío. Consulta tu historial antes de reintentar.');}
  finally{setBusy(false);}
 }
 return <div className="mobile-customer-page mobile-support" data-mobile-screen="support">
  <Heading title={orderId?'Ayuda · Pedido #'+orderId:'Ayuda y soporte'} refresh={refresh}/>
  {error&&<div className="mobile-address-error" role="alert">{error}</div>}
  <section className="mobile-support-thread">
   {loading&&!tickets?<div className="mobile-loading-order"><RefreshCw className="spin" size={18}/>Cargando conversaciones…</div>:!tickets?.length?<div className="mobile-status"><Headphones size={30}/><h3>{error?'Historial no disponible':'¿En qué podemos ayudarte?'}</h3><p>{error?'No significa que no tengas solicitudes.':'Envía tu consulta y conserva el número de solicitud.'}</p></div>:
   tickets.map(row=><div className="mobile-support-ticket" key={row.id}><strong>Solicitud #{row.id} · {row.category||'general'}</strong><p>{row.message}</p><small>{row.status||'Estado por confirmar'} · {row.created_at?new Date(row.created_at).toLocaleString('es-MX'):''}</small></div>)}
  </section>
  <form className="mobile-support-compose" onSubmit={e=>void submit(e)}>
   <label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
   <label>Mensaje<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={3000} minLength={5} rows={4} required placeholder="Describe tu problema o pregunta…"/></label>
   {sendError&&<div className="mobile-address-error" role="alert">{sendError}</div>}
   {uncertain&&<p className="mobile-checkout-disclosure">El envío no fue confirmado. Actualiza el historial antes de considerar otra solicitud.</p>}
   <button className="mobile-checkout-fixed" type="submit" disabled={busy||uncertain}>{busy?'Enviando…':'Enviar mensaje'} <ArrowRight size={18}/></button>
  </form>
 </div>;
}
export function CustomerFavorites(){
 const [rows,setRows]=useState<{id:number;name?:string}[]|null>(null),[merchants,setMerchants]=useState<Record<number,Restaurant>>({}),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;
  api.favorites().then(list=>{if(!active)return;setRows(list);void Promise.allSettled(list.map(async row=>{const data=await api.restaurant(row.id);if(active)setMerchants(old=>({...old,[row.id]:data}));}));}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo cargar favoritos.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[]);
 return <div className="mobile-customer-page mobile-favorites" data-mobile-screen="favorites"><Heading title="Favoritos"/>{error&&<div className="mobile-address-error" role="alert">{error}</div>}
  {loading?<p className="mobile-loading-order"><RefreshCw size={18} className="spin"/> Verificando tus favoritos…</p>:!rows?.length?<div className="mobile-status"><Heart size={32}/><h2>{error?'Favoritos no disponibles':'Aún no tienes favoritos'}</h2><p>Guarda tus comercios preferidos desde Inicio.</p><Link to="/clientes" className="mobile-status-link">Explorar restaurantes</Link></div>:<div className="mobile-account-group">{rows.map(row=><Link className="mobile-account-link" to={'/comercio/'+row.id} key={row.id}><Heart size={20}/><span className="mobile-account-link-copy"><strong>{merchants[row.id]?.name||row.name||'Comercio #'+row.id}</strong><small>Ver restaurante</small></span><ChevronRight size={20}/></Link>)}</div>}
 </div>;
}
