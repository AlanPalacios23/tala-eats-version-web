import {useCallback,useEffect,useRef,useState} from 'react';
import '../styles/driver-pwa.css';
import {Bike,CheckCircle2,MapPin,RefreshCw,ShieldCheck,WifiOff,Home,ReceiptText,Wallet,Navigation,ArrowUpRight,UserRound,Moon,LockKeyhole,HelpCircle,FileCheck2,ChevronRight,X,LogOut,ChartNoAxesCombined} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {DriverProfile,Order} from '../lib/types';
import {useSession} from '../lib/session';
import {maskedDriverPlate} from '../lib/driver-registration';
import '../styles/driver-flutter.css';
import {FinanceWeeklyPreview} from './FinanceWeeklyPreview';
import {DriverCashHandoff} from './CashHandoffV2';
import {canSubmitDelivery,cashCollectionRequired,driverDeliveredOrders,safeDriverMapLink,sanitizeDeliveryPin,trustedActiveDriverDetail} from '../lib/driver-delivery-ui';
import type {DriverDashboardPayload} from '../lib/driver-delivery-ui';
type DriverDash=DriverDashboardPayload;
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
 const [proofSheet,setProofSheet]=useState(false);
 const proofInput=useRef<HTMLInputElement>(null);
 const [selectedDay,setSelectedDay]=useState<string|null>(null);
 const actionCooldown=useRef(0);
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
 const [cashReceived,setCashReceived]=useState<Record<number,boolean>>({});
 const refreshVersion=useRef(0);
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
  // Polling, resume, GPS and manual refresh may overlap. Only newest responses
  // can update operational state or a previous merchant/driver's private data.
  const version=++refreshVersion.current;
  try{
   const [p,proof,jobs,offers]=await Promise.all([
    api.driverProfile(),api.driverPresenceReadiness(),
    api.driverMine(),api.driverAvailable(),
   ]);
   if(!mounted.current||version!==refreshVersion.current)return;
   if(!Array.isArray(jobs)||!Array.isArray(offers)||
      typeof proof?.admin_verified!=='boolean'||typeof proof?.online!=='boolean')
    throw new Error('El backend no devolvió un estado de reparto válido.');
   setProfile(p);setReadiness(proof);setMine(jobs);setAvailable(offers);setError('');
   // Dashboard has a DIFFERENT order payload: only use it for stats and
   // identity-checked active route details, never as delivery history.
   void api.driverDashboard().then(value=>{
    if(!mounted.current||version!==refreshVersion.current)return;
    const data=value as DriverDash;
    if(data.user?.id!==session.user?.id)throw new Error('Resumen no autorizado');
    setDashboard(data);setDashboardError(false);
   }).catch(()=>{
    if(mounted.current&&version===refreshVersion.current){setDashboard(null);setDashboardError(true);}
   });
  }catch(e){
   if(mounted.current&&version===refreshVersion.current){
    setReadiness(null);setAvailable([]);setMine([]);setProfile(null);
    setDashboard(null);setDashboardError(true);setError(failure(e));
   }
  }finally{if(mounted.current&&version===refreshVersion.current)setLoading(false);}
 },[session.user?.id]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  const interval=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&!inFlight.current)void refresh();
  },15000);
  return()=>{mounted.current=false;refreshVersion.current++;window.clearInterval(interval);};
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
  let failed:string|null=null;
  try{await action();if(mounted.current)setMessage(success);}
  catch(e){failed=failure(e);}
  finally{
   inFlight.current=false;
   if(mounted.current){
    setBusy(false);
    await refresh();
    // A successful read must not hide an unsuccessful delivery/financial write.
    if(failed&&mounted.current){setMessage('');setError(failed);}
   }
  }
 }

 const active=mine.find(deliveryInProgress)??null;
 const delivered=driverDeliveredOrders(mine);
 const weekdays=dashboard?.last_7_days??[];
 const selectedEarningDay=weekdays.find(d=>d.date===selectedDay)??weekdays[weekdays.length-1];
 const hasEarnings=dashboard?.today?.deliveries!==undefined&&dashboard.today.deliveries>0;
 const cannotReceive=readiness?.admin_verified!==true||readiness?.presence_enabled!==true;
 const cooldown=()=>Date.now()-actionCooldown.current<650;
 async function guardedAction(action:()=>Promise<unknown>,success:string,existing=false) {
  if(cooldown()||busy)return;
  actionCooldown.current=Date.now();
  await doAction(action,success,existing);
 }

 const doneToday=dashboard?.today?.deliveries;
 useEffect(()=>{if(!active&&proofSheet)setProofSheet(false);},[active?.id,proofSheet]);
 useEffect(()=>{
  if(!proofSheet)return;
  const scroll=document.body.style.overflow;
  document.body.style.overflow='hidden';
  proofInput.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!busy){e.preventDefault();setProofSheet(false);}
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=scroll;document.removeEventListener('keydown',key);};
 },[proofSheet,busy]);
 const onTab=(t:DriverTab)=>{setTab(t);setSheet(null);setProofSheet(false);};
 const openDeliveryProof=(order:Order)=>{
  if(order.status==='on_the_way'&&canProgress&&!busy){
   setPin(old=>({...old,[order.id]:''}));
   setCashReceived(old=>({...old,[order.id]:false}));
   setProofSheet(true);
  }
 };
 const completeDelivery=async(order:Order)=>{
  if(!canSubmitDelivery(order,pin[order.id]??'',cashReceived[order.id]===true))return;
  await guardedAction(async()=>{
   await api.driverComplete(order.id,pin[order.id]??'');
   if(mounted.current){
    setProofSheet(false);
    setPin(old=>{const next={...old};delete next[order.id];return next;});
    setCashReceived(old=>{const next={...old};delete next[order.id];return next;});
   }
  },'Entrega validada por el servidor.',true);
 };
 const doLogout=async()=>{
  if(active){setError('Termina la entrega en curso antes de cerrar sesión.');return;}
  if(!window.confirm('¿Cerrar sesión? Dejarás de recibir pedidos hasta que vuelvas a entrar.'))return;
  setBusy(true);
  try{
   if(online)await api.driverSetAvailability(false);
   await session.logout();
  }catch(e){setError(failure(e));}finally{setBusy(false);}
 };
 const jobCard=(o:Order,offer=false)=>{
   const details=trustedActiveDriverDetail(dashboard,o);
   const store=(o as Order & {restaurant?:{name?:string;address?:string}}).restaurant;
   const storeName=details?.restaurant?.name||store?.name||'Comercio #'+o.restaurant_id;
   const storeAddressKnown=details?.restaurant?.address||store?.address||null;
   const storeAddress=storeAddressKnown||'Consulta la ubicación al aceptar';
   const customerAddress=!offer?(o.address||details?.customer?.address||null):null;
   const deliveryAddress=customerAddress||'Dirección pendiente del servidor';
   const storeRoute=!offer?safeDriverMapLink(storeAddressKnown):null;
   const customerRoute=!offer?safeDriverMapLink(customerAddress):null;
   const earning=o.driver_earning??details?.earning;
   const cash=o.payment_method==='cash';
   return <article key={o.id} className={'df-surface df-job'+(deliveryInProgress(o)?' is-active':'')} aria-label={'Pedido '+o.id}>
    <div className="df-job-head"><span className="df-order-code">Pedido #{o.id}</span>
     <strong className={'df-chip'+(offer?' df-chip-offer':'')}>{offer?'Disponible':displayStatus(o.status)}</strong></div>
    {!offer&&deliveryInProgress(o)&&<div className="df-stage-progress"
      role="img" aria-label={'Progreso de entrega: '+displayStatus(o.status)}>
     {Array.from({length:3},(_,i)=>{
      const progress=o.status==='assigned'?1:o.status==='picked_up'?2:3;
      return <span className={i<progress?'filled':''} key={i}/>;
     })}
    </div>}
    <div className="df-order-highlights">
     <span><Bike size={15}/>{cash?'Cobro en efectivo':'Pedido con tarjeta'}</span>
     <strong>{earning===undefined?'Ganancia pendiente':safeAmount(Number(earning))}</strong>
    </div>
    {deliveryInProgress(o)&&<div className="df-route-stops">
     <div className={'df-route-stop'+(o.status==='assigned'?' current':' done')}>
      <div className="df-stop-icon"><Bike size={19}/></div>
      <div><small>01 · RECOGER</small><strong>{storeName}</strong>
       <span>{storeAddress}</span>
       {storeRoute&&<a href={storeRoute} target="_blank" rel="noopener noreferrer" className="df-route-link"><Navigation size={15}/> Cómo llegar <ArrowUpRight size={14}/></a>}
      </div>
     </div>
     <div className={'df-route-stop'+(o.status==='on_the_way'?' current':' upcoming')}>
      <div className="df-stop-icon"><MapPin size={19}/></div>
      <div><small>02 · ENTREGAR</small><strong>Destino del cliente</strong>
       <span>{deliveryAddress}</span>
       {customerRoute&&<a href={customerRoute} target="_blank" rel="noopener noreferrer" className="df-route-link"><Navigation size={15}/> Ver ruta <ArrowUpRight size={14}/></a>}
      </div>
     </div>
    </div>}
    {offer&&<p className="df-offer-location"><MapPin size={15}/> {storeName} · Ubicación del cliente disponible al aceptar</p>}
    {!offer&&o.status==='delivered'&&<div className="df-job-complete"><CheckCircle2 size={17}/> Entrega completada y validada</div>}
    {offer?actions&&<button type="button" className="df-primary" disabled={busy||!!active} onClick={()=>void guardedAction(()=>api.driverAccept(o.id),'Asignación confirmada por el servidor.')}>Aceptar entrega</button>:
     canProgress&&tab!=='inicio'&&<div className="df-job-actions">
      {o.status==='assigned'&&<button type="button" className="df-primary" disabled={busy} onClick={()=>void guardedAction(()=>api.driverStatus(o.id,'picked_up'),'Recogida confirmada por el servidor.',true)}>Confirmar recogida</button>}
      {o.status==='picked_up'&&<button type="button" className="df-primary" disabled={busy} onClick={()=>void guardedAction(()=>api.driverStatus(o.id,'on_the_way'),'Ruta al cliente confirmada.',true)}>Iniciar ruta al cliente</button>}
      {o.status==='on_the_way'&&<button type="button" className="df-primary" disabled={busy} onClick={()=>openDeliveryProof(o)}>
       Validar entrega con PIN <ArrowUpRight size={17}/></button>}
     </div>}
   </article>;
  };
 const homeAction=tab!=='inicio'?null:!online?{
  label:'Conectarme',
  disabled:busy||cannotReceive||!!active,
  press:()=>{if(!cooldown()){actionCooldown.current=Date.now();void setOnline(true);}}
 }:active?.status==='assigned'&&canProgress?{
  label:'Confirmar recogida',disabled:busy,
  press:()=>{void guardedAction(()=>api.driverStatus(active.id,'picked_up'),'Recogida confirmada por el servidor.',true);}
 }:active?.status==='picked_up'&&canProgress?{
  label:'En camino al cliente',disabled:busy,
  press:()=>{void guardedAction(()=>api.driverStatus(active.id,'on_the_way'),'Ruta al cliente confirmada.',true);}
 }:active?.status==='on_the_way'&&canProgress?{
  label:'Validar entrega con PIN',disabled:busy,
  press:()=>{if(!cooldown()){actionCooldown.current=Date.now();openDeliveryProof(active);}}
 }:null;
 const fname=(session.user?.name||dashboard?.user?.name||'Repartidor').trim().split(/\s+/)[0];
 const initial=(session.user?.name||'R').trim().split(/\s+/).map(x=>x.slice(0,1)).slice(0,2).join('').toUpperCase();
 const metric=(v:unknown,suffix='')=>typeof v==='number'&&Number.isFinite(v)?String(Math.round(v*10)/10)+suffix:'—';
 return <div className="df-app" data-driver-pwa="true" data-presence={online?'online':readiness?'offline':'unavailable'}>
   <main className="df-content">
    {!readiness&&!loading&&error&&<section className="df-reconnect df-surface" role="alert">
     <WifiOff size={24}/><div><strong>No pudimos sincronizar tus entregas</strong>
      <p>Por seguridad no se aceptarán nuevos pedidos hasta recuperar la conexión con Tala Eats.</p></div>
     <button type="button" className="df-outline" onClick={()=>void refresh()}>Reintentar</button>
    </section>}
    {loading&&!readiness&&<div className="df-initial-loading" role="status"><RefreshCw size={20} className="df-rotate"/> Sincronizando tu cuenta con Tala Eats…</div>}
    {tab==='inicio'&&<>
      <header className="df-screen-header df-header-premium"><div><span className="df-eyebrow">TALA EATS · REPARTIDOR</span><h1>Hola, {fname}</h1><p>{todayLabel()}</p></div>
       <button className="df-avatar" aria-label="Abrir perfil" onClick={()=>onTab('perfil')}>{initial}</button></header>
      <section className={'df-availability df-surface '+(online?'is-online':'')} aria-label="Tu disponibilidad">
       <span className={'df-status-dot '+(online?'active':'')}/>
       <div className="df-availability-text"><strong>{!readiness?'Sin conexión':online?'En línea':'Fuera de línea'}</strong>
        <small>{active?'Entrega en curso':online?(reachable?'Listo para nuevas asignaciones':'Esperando GPS vigente'):'No recibirás pedidos nuevos'}</small></div>
       <button className={'df-switch '+(online?'on':'')} type="button" role="switch" aria-checked={online}
        aria-label="Cambiar disponibilidad" disabled={busy||!!active||readiness?.presence_enabled!==true||!readiness?.admin_verified}
        onClick={()=>void setOnline(!online)}><span/></button>
      </section>
      {readiness?.admin_verified!==true&&<div className="df-alert df-alert-info"><ShieldCheck size={19}/> Tu cuenta debe estar aprobada por ADMIN antes de conectarte.</div>}
      {readiness?.presence_enabled===false&&<div className="df-alert df-alert-info"><LockKeyhole size={18}/> El servidor todavía no habilitó la presencia en este entorno.</div>}
      {online&&!reachable&&<div className="df-alert df-alert-info"><MapPin size={18}/> No hay GPS reciente confirmado. Mantén la PWA abierta y permite la ubicación precisa.</div>}
      {online&&reachable&&!actions&&!active&&<div className="df-alert df-alert-info"><ShieldCheck size={18}/> Estás conectado y verificado. El servidor aún no habilita nuevas asignaciones para este modo de reparto.</div>}
      {online&&<button className="df-text-button df-gps-refresh" disabled={busy} onClick={()=>void heartbeat()}><RefreshCw size={16}/> Actualizar ubicación GPS</button>}
      <section className="df-main-stage">
       {active?<>{jobCard(active)}<p className="df-safety"><ShieldCheck size={17}/> Por seguridad, detente antes de usar la app en ruta.</p></>:
        <div className="df-empty df-surface">
         {online?<Bike size={34}/>:<Moon size={34}/>}
         <h2>{online?'Esperando pedidos':'Estás fuera de línea'}</h2>
         <p>{online?'Consulta tus entregas y mantén la app abierta para recibir actualizaciones.':'Conéctate cuando estés listo para recibir pedidos.'}</p>
        </div>}
      </section>
      <section className="df-section">
       <header className="df-section-title"><h2>Tu jornada</h2><button onClick={()=>onTab('ganancias')}>Ver ganancias <ArrowUpRight size={15}/></button></header>
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
      <section className="df-section"><div className="df-section-title"><h2>Historial validado</h2><small>{delivered.length} pedidos</small></div>
       {delivered.length?delivered.map(o=>jobCard(o)):
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
       {hasEarnings?<div className="df-metrics df-earnings-metrics">
        <div><small>Entregas</small><strong>{metric(doneToday)}</strong></div>
        <div><small>Promedio</small><strong>{dashboard?.today?safeAmount(dashboard.today.average_earning):'—'}</strong></div>
        <div><small>Km hoy</small><strong>{metric(dashboard?.today?.distance_km,' km')}</strong></div>
       </div>:<div className="df-no-earnings"><ChartNoAxesCombined size={20}/><span>Aún no tienes ganancias hoy. Se sumarán aquí al completar tu primera entrega.</span></div>}
       </section>
      <FinanceWeeklyPreview kind="driver"/>
      <DriverCashHandoff orders={delivered}/>
      <div className="df-surface df-wallet"><div><Wallet size={23}/><strong>Cuenta bancaria y retiros</strong></div>
       <p>Vincula tu banco de forma segura con Stripe. Tus ganancias registradas no son saldo retirable.</p>
       <button className="df-outline" disabled>Configurar cuenta bancaria</button>
       <p className="df-caption">Los retiros reales solo se habilitan con saldo confirmado y autorización de Tala Eats.</p></div>
      <section className="df-section">
       <div className="df-section-title"><h2>Esta semana</h2><strong>{dashboard?.last_7_days?safeAmount(dashboard.last_7_days.reduce((sum,d)=>sum+(Number(d.earnings)||0),0)):'—'}</strong></div>
       <div className="df-surface df-week-panel">
         <div className="df-week-selected" aria-live="polite">
          <span>{selectedEarningDay?.date===new Date().toISOString().slice(0,10)?'Hoy':selectedEarningDay?.date?
            new Date(selectedEarningDay.date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long'}):'Esta semana'}</span>
          <strong>{selectedEarningDay?safeAmount(selectedEarningDay.earnings):'—'}</strong>
         </div>
         <div className="df-week-chart" role="group" aria-label="Ganancias de los últimos siete días">
          {weekdays.map(d=>{
           const max=Math.max(1,...weekdays.map(x=>Number(x.earnings)||0));
           const selected=d.date===selectedEarningDay?.date;
           return <button key={d.date} className={'df-week-day'+(selected?' selected':'')} type="button"
            aria-pressed={selected} aria-label={d.date+' · '+safeAmount(d.earnings)}
            onClick={()=>setSelectedDay(d.date)}>
            <span className="df-week-bar"><span style={{height:(Math.max(0,Number(d.earnings)||0)/max*100)+'%'}}/></span>
            <small>{new Date(d.date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short'}).slice(0,2)}</small>
           </button>;
          })}
          {!dashboard?.last_7_days&&<p role="status">No se pudo consultar el historial de ganancias.</p>}
         </div>
        </div>
        <p className="df-caption">Tus cortes y depósitos aparecerán aquí cuando estén disponibles.</p>
      </section>
    </>}
    {tab==='perfil'&&<>
      <header className="df-screen-header"><div><h1>Perfil</h1></div></header>
      <div className="df-surface df-profile-identity"><span className="df-avatar df-avatar-static">{initial}</span>
       <div><h2>{session.user?.name||'Repartidor'}</h2><p>Tala, Jalisco</p>
        <span className="df-chip"><ShieldCheck size={14}/>{readiness?.admin_verified===true?'Cuenta verificada':'Verificación pendiente'}</span>
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
   {homeAction&&<div className="df-home-action">
      <button type="button" className="df-primary" disabled={homeAction.disabled} onClick={homeAction.press}>
       {busy?'Actualizando…':homeAction.label}
      </button>
     </div>}
   <nav className="df-bottom-nav" aria-label="Navegación de repartidor">
    {([{key:'inicio',label:'Inicio',Icon:Home},{key:'entregas',label:'Entregas',Icon:ReceiptText},
       {key:'ganancias',label:'Ganancias',Icon:Wallet},{key:'perfil',label:'Perfil',Icon:UserRound}] as const).map(t=>
     <button key={t.key} type="button" className={tab===t.key?'selected':''}
      aria-current={tab===t.key?'page':undefined} onClick={()=>onTab(t.key)}>
      <span className="df-nav-icon"><t.Icon size={24} strokeWidth={tab===t.key?2.6:1.9}/>{t.key==='inicio'&&active&&tab!=='inicio'&&<i className="df-active-pip"/>}</span><span className="df-nav-label">{t.label}</span>
     </button>)}
   </nav>
   {proofSheet&&active?.status==='on_the_way'&&<div className="df-sheet-backdrop" role="presentation" onClick={()=>{if(!busy)setProofSheet(false);}}>
     <section className="df-sheet df-proof-sheet" role="dialog" aria-modal="true" aria-labelledby="df-proof-title" aria-describedby="df-proof-description" onClick={e=>e.stopPropagation()}>
      <button type="button" className="df-icon-button df-sheet-close" aria-label="Cerrar" disabled={busy} onClick={()=>setProofSheet(false)}><X size={21}/></button>
      <span className="df-sheet-handle" aria-hidden="true"/>
      <span className="df-eyebrow">PEDIDO #{active.id} · ÚLTIMO PASO</span>
      <h2 id="df-proof-title">Confirmar entrega</h2>
      <p id="df-proof-description">Solicita al cliente el PIN de 4 dígitos. Solo el servidor puede autorizar el cierre del pedido.</p>
      {cashCollectionRequired(active)&&<label className="df-cash-ack">
        <input type="checkbox" checked={cashReceived[active.id]===true} disabled={busy}
         onChange={e=>setCashReceived(old=>({...old,[active.id]:e.target.checked}))}/>
        <span><strong>Recibí el efectivo del cliente</strong>
         <small>Confirmo que conté y recibí {pesos(active.total)}. El backend registrará esta cobranza y quedará pendiente de conciliación; no es mi ganancia.</small></span>
       </label>}
      <label className="df-proof-pin-label" htmlFor="df-pin-entry">PIN de entrega
       <input ref={proofInput} id="df-pin-entry" type="text" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}"
        placeholder="••••" value={pin[active.id]??''} disabled={busy}
        onChange={e=>setPin(old=>({...old,[active.id]:sanitizeDeliveryPin(e.target.value)}))}/>
      </label>
      <p className="df-proof-note"><ShieldCheck size={16}/> El PIN no se guarda en este dispositivo. La evidencia fotográfica no está habilitada en esta versión.</p>
      <button type="button" className="df-primary" disabled={busy||!canProgress||!canSubmitDelivery(active,pin[active.id]??'',cashReceived[active.id]===true)}
       onClick={()=>void completeDelivery(active)}>
       {busy?'Validando en el servidor…':'Confirmar entrega de forma segura'}</button>
     </section>
    </div>}
   {sheet&&<div className="df-sheet-backdrop" role="presentation" onClick={()=>setSheet(null)}>
    <section className="df-sheet" role="dialog" aria-modal="true" aria-label="Detalle de perfil" onClick={e=>e.stopPropagation()}>
     <button className="df-icon-button df-sheet-close" aria-label="Cerrar" onClick={()=>setSheet(null)}><X size={21}/></button>
     <span className="df-sheet-handle" aria-hidden="true"/><h2>{sheet==='vehicle'?'Mi vehículo':sheet==='documents'?'Mis documentos':sheet==='security'?'Seguridad':'Centro de ayuda'}</h2>
     {sheet==='vehicle'&&<>
      <p>Datos registrados para tus entregas.</p>
      <div className="df-detail-row"><span>Tipo</span><strong>{profile?.vehicle||'No registrado'}</strong></div>
      <div className="df-detail-row"><span>Placa</span><strong>{maskedDriverPlate(profile?.plate)}</strong></div>
      <div className="df-alert df-alert-info"><ShieldCheck size={17}/> Para cambiar de vehículo, contacta a soporte de repartidores.</div>
     </>}
     {sheet==='documents'&&<>
      <p>Estado de tu documentación.</p>
      <div className="df-doc-empty"><FileCheck2 size={30}/><strong>{readiness?.admin_verified?'Cuenta aprobada':'Verificación pendiente'}</strong>
       <span>Esta sección muestra el estado general de tu aprobación. El detalle de cada documento no está disponible en esta vista.</span></div>
     </>}
     {sheet==='security'&&<><p>Acceso y sesión</p>
      <div className="df-detail-row"><span>Correo</span><strong>{session.user?.email||'No disponible'}</strong></div>
      <div className="df-alert df-alert-info"><ShieldCheck size={17}/> El 2FA y las sesiones se administran desde el servidor. Nunca compartas tus credenciales.</div>
     </>}
     {sheet==='help'&&<><p>Problemas frecuentes en una entrega</p>
      <div className="df-detail-row"><span>No puedo recoger</span><strong>Contacta al comercio</strong></div>
      <div className="df-detail-row"><span>No puedo entregar</span><strong>Solicita ayuda</strong></div>
      <div className="df-alert df-alert-info"><ShieldCheck size={17}/> No confirmes entregas ni cobros sin que el backend los autorice.</div>
     </>}
    </section></div>}
  </div>;
}
