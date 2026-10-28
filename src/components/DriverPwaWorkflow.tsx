import {useCallback,useEffect,useRef,useState} from 'react';
import '../styles/driver-pwa.css';
import {Bike,CheckCircle2,MapPin,RefreshCw,ShieldCheck,WifiOff,Home,ReceiptText,Wallet,UserRound,Moon,LockKeyhole,HelpCircle,FileCheck2,ChevronRight,X,LogOut} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {DriverProfile,Order} from '../lib/types';
import {useSession} from '../lib/session';
import {maskedDriverPlate} from '../lib/driver-registration';
import '../styles/driver-flutter.css';
type DriverDash={user?:{name?:string;phone?:string};profile?:{vehicle?:string;plate?:string;is_verified?:boolean};
 today?:{earnings:number;deliveries:number;distance_km:number;average_earning:number};
 last_7_days?:Array<{date:string;earnings:number;deliveries:number}>;
 acceptance_rate?:number};
type DriverTab='inicio'|'entregas'|'ganancias'|'perfil';
const todayLabel=()=>new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
const safeAmount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?pesos(v):'—';
const displayStatus=(v:string)=>shipmentStatus[v]||v;
const deliveryInProgress=(o:Order)=>['assigned','picked_up','on_the_way'].includes(o.status);
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
 const session=useSession();
 const [tab,setTab]=useState<DriverTab>('inicio');
 const [sheet,setSheet]=useState<'vehicle'|'documents'|'security'|'help'|null>(null);
 const [dashboard,setDashboard]=useState<DriverDash|null>(null);
 const [dashboardError,setDashboardError]=useState(false);
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
   // Separate financial/dashboard read is deliberately non-authoritative if it fails.
   void api.driverDashboard().then(value=>{
    if(mounted.current){setDashboard(value as DriverDash);setDashboardError(false);}
   }).catch(()=>{if(mounted.current){setDashboard(null);setDashboardError(true);}});

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

 const active=mine.find(deliveryInProgress)??null;
 const doneToday=dashboard?.today?.deliveries;
 const onTab=(t:DriverTab)=>{setTab(t);setSheet(null);};
 const doLogout=async()=>{
  if(active){setError('Termina la entrega en curso antes de cerrar sesión.');return;}
  if(!window.confirm('¿Cerrar sesión? Dejarás de recibir pedidos hasta que vuelvas a entrar.'))return;
  setBusy(true);
  try{
   if(online)await api.driverSetAvailability(false);
   await session.logout();
  }catch(e){setError(failure(e));}finally{setBusy(false);}
 };
 const jobCard=(o:Order,offer=false)=><article key={o.id} className="df-surface df-job">
   <div className="df-job-head"><span>Pedido #{o.id}</span>
    <strong className="df-chip">{offer?'Disponible':displayStatus(o.status)}</strong></div>
   <div className="df-job-meta"><span><MapPin size={16}/>{o.address||'Ubicación disponible al aceptar'}</span>
    <span>{offer?'Ganancia por entrega':'Ganancia estimada'}: <b>{safeAmount(Number(o.driver_earning))}</b></span></div>
   {offer?actions&&<button className="df-primary" disabled={busy} onClick={()=>void doAction(()=>api.driverAccept(o.id),'Asignación confirmada por el servidor.')}>Aceptar entrega</button>:
    canProgress&&<div className="df-job-actions">
     {o.status==='assigned'&&<button className="df-primary" disabled={busy} onClick={()=>void doAction(()=>api.driverStatus(o.id,'picked_up'),'Recogida confirmada por el servidor.',true)}>Confirmar recogida</button>}
     {o.status==='picked_up'&&<button className="df-primary" disabled={busy} onClick={()=>void doAction(()=>api.driverStatus(o.id,'on_the_way'),'Ruta al cliente confirmada.',true)}>En camino al cliente</button>}
     {o.status==='on_the_way'&&<div className="df-pin-action">
      <label>PIN del cliente<input inputMode="numeric" pattern="[0-9]{4}" autoComplete="off"
       maxLength={4} placeholder="0000" value={pin[o.id]??''}
       onChange={e=>setPin(p=>({...p,[o.id]:e.target.value.replace(/\\D/g,'').slice(0,4)}))}/></label>
      <button className="df-primary" disabled={busy||!/^[0-9]{4}$/.test(pin[o.id]??'')}
       onClick={()=>void doAction(()=>api.driverComplete(o.id,pin[o.id]??''),'Entrega validada por el servidor.',true)}>Confirmar entrega</button>
      <p className="df-caption">La confirmación requiere el PIN real; el backend determina si la entrega es válida.</p>
     </div>}
    </div>}
  </article>;
 const fname=(session.user?.name||dashboard?.user?.name||'Repartidor').trim().split(/\\s+/)[0];
 const initial=(session.user?.name||'R').trim().split(/\\s+/).map(x=>x.slice(0,1)).slice(0,2).join('').toUpperCase();
 const metric=(v:unknown,suffix='')=>typeof v==='number'&&Number.isFinite(v)?String(Math.round(v*10)/10)+suffix:'—';
 return <div className="df-app" data-driver-pwa="true">
   <main className="df-content">
    {tab==='inicio'&&<>
      <header className="df-screen-header"><div><h1>Hola, {fname}</h1><p>{todayLabel()}</p></div>
       <button className="df-avatar" aria-label="Abrir perfil" onClick={()=>onTab('perfil')}>{initial}</button></header>
      <section className={'df-availability df-surface '+(online?'is-online':'')} aria-label="Tu disponibilidad">
       <span className={'df-status-dot '+(online?'active':'')}/>
       <div className="df-availability-text"><strong>{online?'En línea':'Fuera de línea'}</strong>
        <small>{active?'Entrega en curso':online?(reachable?'Recibiendo pedidos':'Esperando GPS vigente'):'No recibirás pedidos nuevos'}</small></div>
       <button className={'df-switch '+(online?'on':'')} type="button" role="switch" aria-checked={online}
        aria-label="Cambiar disponibilidad" disabled={busy||!!active||readiness?.presence_enabled!==true||!readiness?.admin_verified}
        onClick={()=>void setOnline(!online)}><span/></button>
      </section>
      {readiness?.admin_verified!==true&&<div className="df-alert df-alert-info"><ShieldCheck size={19}/> Tu cuenta debe estar aprobada por ADMIN antes de conectarte.</div>}
      {readiness?.presence_enabled===false&&<div className="df-alert df-alert-info"><LockKeyhole size={18}/> El servidor todavía no habilitó la presencia en este entorno.</div>}
      {online&&!reachable&&<div className="df-alert df-alert-info"><MapPin size={18}/> No hay GPS reciente confirmado. Mantén abierta la PWA.</div>}
      {online&&<button className="df-text-button df-gps-refresh" disabled={busy} onClick={()=>void heartbeat()}><RefreshCw size={16}/> Actualizar ubicación GPS</button>}
      <section className="df-main-stage">
       {active?<>{jobCard(active)}<p className="df-safety"><ShieldCheck size={17}/> Por seguridad, detente antes de usar la app en ruta.</p></>:
        <div className="df-empty df-surface">
         {online?<Bike size={34}/>:<Moon size={34}/>}
         <h2>{online?'Esperando pedidos':'Estás fuera de línea'}</h2>
         <p>{online?'Te avisaremos en cuanto tengas una asignación. Mantén la app abierta.':'Conéctate cuando estés listo para recibir pedidos.'}</p>
        </div>}
      </section>
      <section className="df-section">
       <header className="df-section-title"><h2>Tu jornada</h2><button onClick={()=>onTab('ganancias')}>Ver ganancias</button></header>
       <button className="df-surface df-metrics" onClick={()=>onTab('ganancias')} aria-label="Abrir ganancias">
        <div><small>Ganancias</small><strong>{dashboard?.today?safeAmount(dashboard.today.earnings):'—'}</strong></div>
        <div><small>Entregas</small><strong>{metric(doneToday)}</strong></div>
        <div><small>Distancia</small><strong>{metric(dashboard?.today?.distance_km,' km')}</strong></div>
       </button>
       {dashboardError&&<p className="df-caption" role="status">No se pudo cargar el resumen de jornada.</p>}
      </section>
    </>}
    {tab==='entregas'&&<>
      <header className="df-screen-header"><div><h1>Entregas</h1><p>{dashboard?.today?('Hoy · '+metric(doneToday)+' completadas'):'Historial de entregas'}</p></div>
       <button className="df-icon-button" aria-label="Actualizar entregas" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={21}/></button></header>
      {active&&<section className="df-section"><h2>En curso</h2>{jobCard(active)}</section>}
      <section className="df-section"><div className="df-section-title"><h2>Historial</h2><small>{mine.filter(o=>o.status==='delivered').length} pedidos</small></div>
       {mine.filter(o=>o.status==='delivered').length?mine.filter(o=>o.status==='delivered').map(o=>jobCard(o)):
       <div className="df-empty df-surface"><ReceiptText size={32}/><h2>Aún no hay entregas</h2><p>Las entregas que completes aparecerán aquí.</p></div>}
      </section>
      <section className="df-section"><h2>Pedidos disponibles</h2>
       {!actions&&<div className="df-alert df-alert-info"><LockKeyhole size={17}/> Las nuevas asignaciones no están autorizadas por el backend de este entorno.</div>}
       {available.length?available.map(o=>jobCard(o,true)):<div className="df-surface df-empty df-empty-small"><Bike size={25}/><p>No hay pedidos autorizados para tomar.</p></div>}
      </section>
    </>}
    {tab==='ganancias'&&<>
      <header className="df-screen-header"><div><h1>Ganancias</h1><p>{todayLabel()}</p></div></header>
      <section className="df-surface df-earnings-main"><span>TU GANANCIA DE HOY</span>
       <strong>{dashboard?.today?safeAmount(dashboard.today.earnings):'—'}</strong><hr/>
       <div className="df-metrics df-earnings-metrics">
        <div><small>Entregas</small><strong>{metric(doneToday)}</strong></div>
        <div><small>Promedio</small><strong>{dashboard?.today?safeAmount(dashboard.today.average_earning):'—'}</strong></div>
        <div><small>Distancia</small><strong>{metric(dashboard?.today?.distance_km,' km')}</strong></div>
       </div></section>
      <div className="df-surface df-wallet"><div><Wallet size={23}/><strong>Retirar ganancias</strong></div>
       <p>Tus retiros estarán disponibles cuando el backend verifique saldo liquidado, cuenta Stripe Connect y autorización.</p>
       <button className="df-outline" disabled>Retiro no disponible</button></div>
      <section className="df-section">
       <div className="df-section-title"><h2>Esta semana</h2><strong>{dashboard?.last_7_days?safeAmount(dashboard.last_7_days.reduce((sum,d)=>sum+(Number(d.earnings)||0),0)):'—'}</strong></div>
       <div className="df-surface df-week-chart" aria-label="Ganancias de los últimos siete días">
        {(dashboard?.last_7_days??[]).map(d=>{
         const max=Math.max(1,...(dashboard?.last_7_days??[]).map(x=>Number(x.earnings)||0));
         return <div key={d.date} title={d.date+' · '+safeAmount(d.earnings)}>
          <span className="df-week-bar"><span style={{height:(Math.max(0,Number(d.earnings)||0)/max*100)+'%'}}/></span>
          <small>{new Date(d.date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short'}).slice(0,2)}</small>
         </div>;
        })}
        {!dashboard?.last_7_days&&<p role="status">No se pudo consultar el historial de ganancias.</p>}
       </div>
       <p className="df-caption">Tus cortes y depósitos aparecerán aquí cuando estén disponibles.</p>
      </section>
    </>}
    {tab==='perfil'&&<>
      <header className="df-screen-header"><div><h1>Perfil</h1></div></header>
      <div className="df-surface df-profile-identity"><span className="df-avatar df-avatar-static">{initial}</span>
       <div><h2>{session.user?.name||'Repartidor'}</h2><p>Tala, Jalisco</p>
        <span className="df-chip"><ShieldCheck size={14}/>{profile?.is_verified?'Cuenta verificada':'Verificación pendiente'}</span>
       </div></div>
      <section className="df-section"><h2>Trabajo</h2><div className="df-surface df-settings">
       <button onClick={()=>setSheet('vehicle')}><Bike size={21}/><span><strong>Vehículo</strong><small>{profile?.vehicle||'Sin vehículo'} · {maskedDriverPlate(profile?.plate)}</small></span><ChevronRight size={19}/></button>
       <button onClick={()=>setSheet('documents')}><FileCheck2 size={21}/><span><strong>Documentos</strong><small>Consultar estado de verificación</small></span><ChevronRight size={19}/></button>
      </div></section>
      <section className="df-section"><h2>Cuenta</h2><div className="df-surface df-settings">
       <button onClick={()=>setSheet('security')}><ShieldCheck size={21}/><span><strong>Seguridad</strong><small>Acceso y sesión</small></span><ChevronRight size={19}/></button>
       <button onClick={()=>setSheet('help')}><HelpCircle size={21}/><span><strong>Ayuda</strong><small>Problemas frecuentes en una entrega</small></span><ChevronRight size={19}/></button>
      </div></section>
      <button className="df-logout" disabled={busy} onClick={()=>void doLogout()}><LogOut size={18}/> Cerrar sesión</button>
      <p className="df-version">Tala Eats Repartidor · Basado en Flutter v1.2.4</p>
    </>}
    {(error||message)&&<div className={'df-floating-status '+(error?'error':'ok')} role={error?'alert':'status'}>
     {error?<WifiOff size={18}/>:<CheckCircle2 size={18}/>}<span>{error||message}</span>
     <button aria-label="Cerrar aviso" onClick={()=>{setError('');setMessage('');}}><X size={16}/></button></div>}
    {loading&&<p className="df-caption" role="status">Consultando información real del servidor…</p>}
   </main>
   <nav className="df-bottom-nav" aria-label="Navegación de repartidor">
    {([{key:'inicio',label:'Inicio',Icon:Home},{key:'entregas',label:'Entregas',Icon:ReceiptText},
       {key:'ganancias',label:'Ganancias',Icon:Wallet},{key:'perfil',label:'Perfil',Icon:UserRound}] as const).map(t=>
     <button key={t.key} type="button" className={tab===t.key?'selected':''}
      aria-current={tab===t.key?'page':undefined} onClick={()=>onTab(t.key)}>
      <t.Icon size={23} strokeWidth={tab===t.key?2.6:2}/><span>{t.label}</span>
     </button>)}
   </nav>
   {sheet&&<div className="df-sheet-backdrop" role="presentation" onClick={()=>setSheet(null)}>
    <section className="df-sheet" role="dialog" aria-modal="true" aria-label="Detalle de perfil" onClick={e=>e.stopPropagation()}>
     <button className="df-icon-button df-sheet-close" aria-label="Cerrar" onClick={()=>setSheet(null)}><X size={21}/></button>
     <h2>{sheet==='vehicle'?'Mi vehículo':sheet==='documents'?'Mis documentos':sheet==='security'?'Seguridad':'Centro de ayuda'}</h2>
     {sheet==='vehicle'&&<p>{profile?.vehicle||'Vehículo sin verificar'} · {maskedDriverPlate(profile?.plate)}. Las modificaciones se validan desde ADMIN.</p>}
     {sheet==='documents'&&<p>Tu documentación se revisa en el proceso de aprobación. Si necesitas actualizarla, contacta al equipo de Tala Eats.</p>}
     {sheet==='security'&&<p>La autenticación, las sesiones y el 2FA son controlados por el backend. Nunca compartas tus credenciales ni el PIN del cliente.</p>}
     {sheet==='help'&&<p>Si no puedes recoger o entregar un pedido, evita confirmarlo manualmente. Consulta a soporte y conserva la entrega sin cambios hasta verificarla.</p>}
    </section></div>}
  </div>;
}
