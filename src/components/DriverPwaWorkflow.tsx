import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import '../styles/driver-pwa.css';
import {Bike,CheckCircle2,Clock3,MapPin,RefreshCw,ShieldCheck,Truck,WifiOff} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {DriverProfile,Order} from '../lib/types';
import {currentDriverPosition,DRIVER_GPS_HEARTBEAT_MS,driverActionsAvailable,driverCanProgressExistingDelivery,verifiedOnlinePresence} from '../lib/driver-presence';
import type {DriverPresenceReadiness} from '../lib/driver-presence';

const shipmentStatus:Record<string,string>={
 assigned:'Asignado',picked_up:'Recogido',on_the_way:'En camino',
 delivered:'Entregado',ready:'Listo para recoger',
};
const actionOptIn=import.meta.env.VITE_DRIVER_ACTIONS_ENABLED==='true';
const failure=(reason:unknown)=>reason instanceof Error?reason.message:'La operación fue rechazada por el servidor.';

/**
 * PWA driver UI never infers availability from local state, a stored toggle
 * or the browser GPS alone. PostgreSQL approval + Redis heartbeat drive the UI.
 * Inactive delivery/Stripe endpoints remain locked by RC9.5 server guards.
 */
export function DriverPwaWorkflow(){
 const [profile,setProfile]=useState<DriverProfile|null>(null);
 const [readiness,setReadiness]=useState<DriverPresenceReadiness|null>(null);
 const [mine,setMine]=useState<Order[]>([]);
 const [available,setAvailable]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [pin,setPin]=useState<Record<number,string>>({});
 const mounted=useRef(true),inFlight=useRef(false),gpsInFlight=useRef(false);
 const online=readiness?.online===true;
 const reachable=verifiedOnlinePresence(readiness);
 const actions=driverActionsAvailable(readiness,actionOptIn);
 const canProgress=driverCanProgressExistingDelivery(readiness,actionOptIn);
 // Installable driver PWA has its own start_url, not the customer storefront.
 useEffect(()=>{
  const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const previousManifest=manifest?.getAttribute('href')??null;
  const previousTitle=document.title;
  manifest?.setAttribute('href','/manifest-repartidor.webmanifest');
  document.title='Tala Eats Repartidor';
  return()=>{
   if(manifest&&previousManifest!==null)manifest.setAttribute('href',previousManifest);
   document.title=previousTitle;
  };
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [p,proof,jobs,offers]=await Promise.all([
    api.driverProfile(),api.driverPresenceReadiness(),
    api.driverMine(),api.driverAvailable(),
   ]);
   if(!mounted.current)return;
   setProfile(p);setReadiness(proof);setMine(jobs);setAvailable(offers);setError('');
  }catch(e){if(mounted.current)setError(failure(e));}
  finally{if(mounted.current)setLoading(false);}
 },[]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  const interval=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&!inFlight.current)void refresh();
  },15000);
  return()=>{mounted.current=false;window.clearInterval(interval);};
 },[refresh]);

 // Browser GPS is foreground-only. Expired TTL means "unavailable" even if
 // PostgreSQL still says online; no fake movement or cached positions.
 const heartbeat=useCallback(async()=>{
  if(gpsInFlight.current||inFlight.current)return;
  gpsInFlight.current=true;
  try{
   const gps=await currentDriverPosition();
   await api.driverLocation(gps.lat,gps.lng);
   const next=await api.driverPresenceReadiness();
   if(mounted.current){setReadiness(next);setError('');}
  }catch(e){
   if(mounted.current){setError('No se confirmó GPS reciente: '+failure(e));setReadiness(old=>old?{...old,fresh_gps:false}:old);}
  }finally{gpsInFlight.current=false;}
 },[]);
 useEffect(()=>{
  if(!online||readiness?.presence_enabled!==true)return;
  const onResume=()=>{
   if(document.visibilityState==='visible'){
    void heartbeat();
    void refresh();
   }
  };
  const interval=window.setInterval(()=>{
   if(document.visibilityState==='visible')void heartbeat();
  },DRIVER_GPS_HEARTBEAT_MS);
  document.addEventListener('visibilitychange',onResume);
  void heartbeat();
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onResume);};
 },[online,readiness?.presence_enabled,heartbeat,refresh]);

 async function setOnline(next:boolean){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');setMessage('');
  let serverOnline=false;
  try{
   if(next){
    // Obtain permission before touching server availability; the backend
    // rejects GPS until availability is already enabled.
    const gps=await currentDriverPosition();
    await api.driverSetAvailability(true);serverOnline=true;
    await api.driverLocation(gps.lat,gps.lng);
    const proof=await api.driverPresenceReadiness();
    if(!verifiedOnlinePresence(proof))throw new Error('El servidor todavía no confirmó tu ubicación y aprobación.');
    setMessage('Conectado con ubicación reciente verificada.');
   }else{
    await api.driverSetAvailability(false);
    setMessage('Disponibilidad desactivada en el servidor.');
   }
  }catch(e){
   if(next&&serverOnline){
    try{await api.driverSetAvailability(false);}catch{
     setError('No se confirmó GPS y tampoco pudimos cerrar disponibilidad. Revisa tu conexión y vuelve a verificar.');
    }
   }
   if(mounted.current)setError(prev=>prev||failure(e));
  }finally{
   inFlight.current=false;
   if(mounted.current){setBusy(false);await refresh();}
  }
 }
 async function doAction(action:()=>Promise<unknown>,success:string,existing=false){
  if(inFlight.current||!(existing?canProgress:actions))return;
  inFlight.current=true;setBusy(true);setMessage('');setError('');
  try{await action();if(mounted.current)setMessage(success);}
  catch(e){if(mounted.current)setError(failure(e));}
  finally{inFlight.current=false;if(mounted.current){setBusy(false);await refresh();}}
 }
 return <div className="container page dashboard driver-pwa" data-driver-pwa="true">
  <div className="dashboard-heading">
   <div><Link to="/" className="driver-pwa-home">Tala Eats</Link><span className="eyebrow">REPARTIDOR</span>
    <h1>Mis entregas</h1><p>Tu conexión y cada entrega se confirman con el servidor.</p></div>
   <button className="btn outline small" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/> Actualizar</button>
  </div>
  {loading&&<p role="status">Consultando el backend…</p>}
  {error&&<div role="alert" className="alert error"><WifiOff size={17}/> {error}</div>}
  {message&&<div role="status" className="alert success"><CheckCircle2 size={17}/> {message}</div>}
  <section className="card padded driver-pwa-panel">
   <div className="driver-pwa-status">
    <div><ShieldCheck size={20}/><strong>{readiness?.admin_verified?'Cuenta aprobada':'Cuenta pendiente de aprobación'}</strong></div>
    <div><MapPin size={20}/><strong>{reachable?'GPS vigente':online?'Sin GPS reciente':'Fuera de línea'}</strong></div>
   </div>
   <p className="muted">{profile?.vehicle?'Vehículo: '+profile.vehicle+'. ':''}
    {reachable?'Estás disponible para el piloto de presencia.':online?'La ubicación debe estar activa para recibir asignaciones.':'Conéctate únicamente cuando puedas realizar entregas.'}</p>
   {readiness?.presence_enabled===true?
    <div className="driver-pwa-controls">
     <button className="btn primary" disabled={busy||!readiness.admin_verified} onClick={()=>void setOnline(!online)}>
      {busy?'Verificando…':online?'Desconectarme':'Conectarme con GPS'}</button>
     {online&&<button className="btn outline" disabled={busy||gpsInFlight.current} onClick={()=>void heartbeat()}>Actualizar ubicación</button>}
    </div>:
    <p className="muted" role="status">El servidor todavía no habilitó la presencia de repartidores en este entorno.</p>}
   <p className="driver-pwa-help">Se utiliza GPS real del navegador mientras esta PWA esté abierta y visible. Si cierras la aplicación o el GPS caduca, no se confirma disponibilidad para asignaciones.</p>
  </section>
  {!actions&&<div className="alert info" role="status"><Clock3 size={18}/>
    {canProgress?'No puedes recibir nuevas asignaciones sin GPS vigente. Si ya tienes una entrega, puedes continuarla.':'La asignación, recogida y entrega todavía no están liberadas para este entorno. Tener GPS activo no autoriza pedidos ni cobros Stripe a domicilio.'}</div>}
  <section className="driver-pwa-jobs"><h2><Truck size={21}/> Mis entregas</h2>
   {!mine.length?<p className="muted">Todavía no tienes entregas asignadas.</p>:mine.map(order=>
   <article className="card padded" key={order.id}>
    <div className="order-top"><h3>Pedido #{order.id}</h3><strong>{shipmentStatus[order.status]||order.status}</strong></div>
    <p>Total del pedido: {pesos(order.total)} · Ganancia estimada: {pesos(order.driver_earning)}</p>
    {canProgress&&<div className="driver-pwa-controls">
     {order.status==='assigned'&&<button className="btn primary" disabled={busy} onClick={()=>void doAction(()=>api.driverStatus(order.id,'picked_up'),'Recogida confirmada por el servidor.',true)}>Confirmar recogida</button>}
     {order.status==='picked_up'&&<button className="btn primary" disabled={busy} onClick={()=>void doAction(()=>api.driverStatus(order.id,'on_the_way'),'Ruta al cliente confirmada.',true)}>En camino al cliente</button>}
     {order.status==='on_the_way'&&<>
      <input aria-label={'PIN de entrega del pedido '+order.id} inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
       placeholder="PIN de 4 dígitos" value={pin[order.id]??''}
       onChange={e=>setPin(p=>({...p,[order.id]:e.target.value.replace(/\D/g,'').slice(0,4)}))}/>
      <button className="btn primary" disabled={busy||!/^[0-9]{4}$/.test(pin[order.id]??'')}
       onClick={()=>void doAction(()=>api.driverComplete(order.id,pin[order.id]??''),'Entrega validada con PIN en el servidor.',true)}>Confirmar entrega</button>
     </>}
    </div>}
   </article>)}
  </section>
  <section className="driver-pwa-jobs"><h2><Bike size={21}/> Pedidos disponibles</h2>
   {!available.length?<p className="muted">No hay pedidos autorizados para tomar en este momento.</p>:available.map(order=>
    <article className="card padded" key={order.id}>
     <div className="order-top"><h3>Pedido #{order.id}</h3><strong>{pesos(order.driver_earning)}</strong></div>
     {actions&&<button className="btn primary" disabled={busy} onClick={()=>void doAction(()=>api.driverAccept(order.id),'Asignación confirmada.')}>Aceptar entrega</button>}
    </article>)}
  </section>
 </div>;
}
