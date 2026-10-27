import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BadgeCheck,Check,ChefHat,Clock3,CreditCard,
 KeyRound,LogOut,PackageCheck,RefreshCw,ShieldCheck,
 ShoppingBag,Store,UtensilsCrossed,Wallet,AlertCircle,Plus,LockKeyhole,Download} from 'lucide-react';
import {api,ApiError,pesos,safeImage} from '../lib/api';
import type {MerchantApplication,MerchantFinance} from '../lib/api';
import {useSession} from '../lib/session';
import type {Order,Restaurant,MenuItem} from '../lib/types';
import {PREVIEW_READONLY} from '../lib/preview';
import {mainTalaEatsPortalHref} from '../lib/restaurant-host';
import {normalizePickupPin} from '../lib/pickup-handoff';
import {merchantConnectSteps,merchantStateLabel,nextMerchantState,canHandoffPickup} from '../lib/restaurant-state';
import type {MerchantConnectStatus,MerchantTab} from '../lib/restaurant-state';
import '../styles/restaurant.css';
import '../styles/restaurant-polish.css';
import {MerchantOverview,MerchantKitchen,MerchantMore} from './RestaurantParity';
import {MerchantWallet} from './MerchantWallet';
import {RestaurantOrderAlerts} from './RestaurantOrderAlerts';
import {Home as HomeIcon,MoreHorizontal,ReceiptText,Search as SearchIcon} from 'lucide-react';
import '../styles/restaurant-flutter-parity.css';

const AUTH_EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const allTabs: {id:MerchantTab;label:string;Icon:typeof ShoppingBag}[]=[
 {id:'inicio',label:'Inicio',Icon:HomeIcon},
 {id:'pedidos',label:'Pedidos',Icon:ReceiptText},
 {id:'menu',label:'Menú',Icon:UtensilsCrossed},
 {id:'finanzas',label:'Wallet',Icon:Wallet},
 {id:'mas',label:'Más',Icon:MoreHorizontal},
 {id:'cocina',label:'Cocina',Icon:ChefHat},
 {id:'activacion',label:'Activación',Icon:BadgeCheck},
];
const bottomTabs=allTabs.filter(t=>['inicio','pedidos','menu','finanzas','mas'].includes(t.id));
function MerchantBrand(){return <Link className="rp-brand" to={mainTalaEatsPortalHref(window.location.hostname)} aria-label="Tala Eats inicio">Tala<span>Eats.</span><small>RESTAURANTES</small></Link>;}
function MerchantLoadingSkeleton(){
 return <div className="rp-skeleton-layout" role="status" aria-label="Preparando el panel de tu restaurante">
  <div className="rp-skeleton-heading" aria-hidden="true">
   <span className="rp-skeleton-bar short"/><span className="rp-skeleton-bar heading"/><span className="rp-skeleton-bar long"/>
  </div>
  <div className="rp-skeleton-kpis" aria-hidden="true">
   {Array.from({length:4},(_,i)=><div className="rp-skeleton-card" key={i}>
    <span className="rp-skeleton-bar label"/><span className="rp-skeleton-bar metric"/><span className="rp-skeleton-bar label short"/>
   </div>)}
  </div>
  <div className="rp-skeleton-body" aria-hidden="true">
   <div className="rp-skeleton-panel"><span className="rp-skeleton-bar heading"/><span className="rp-skeleton-bar long"/><span className="rp-skeleton-bar long"/></div>
   <div className="rp-skeleton-panel"><span className="rp-skeleton-bar heading"/><span className="rp-skeleton-bar long"/><span className="rp-skeleton-bar long"/></div>
  </div>
  <span className="rp-skeleton-status"><RefreshCw size={17} className="rp-spin"/> Sincronizando pedidos y negocio de forma segura…</span>
 </div>;
}
function Notice({message,kind='info'}:{message:string;kind?:'info'|'error'|'success'}){
 return <div role={kind==='error'?'alert':'status'} className={'rp-notice '+kind}>
   {kind==='error'?<AlertCircle size={19}/>:<ShieldCheck size={19}/>}<span>{message}</span>
 </div>;
}
function MerchantIntro({title,subtitle}:{title:string;subtitle:string}){
 return <div className="rp-intro"><MerchantBrand/><span className="rp-eyebrow">TALA EATS BUSINESS</span>
  <h1>{title}</h1><p>{subtitle}</p>
  <div className="rp-intro-points"><span><Check size={17}/> Pedidos en vivo</span>
   <span><Check size={17}/> Menú y disponibilidad</span>
   <span><Check size={17}/> Stripe Connect seguro</span></div>
  <p className="rp-intro-caption">Una plataforma para operar tu comercio, no para crear pagos de prueba.</p>
 </div>;
}
interface MerchantInstallPrompt extends Event{
 prompt:()=>Promise<void>;
 userChoice?:Promise<{outcome:'accepted'|'dismissed'}>;
}
function MerchantInstallButton(){
 const deferred=useRef<MerchantInstallPrompt|null>(null);
 const [available,setAvailable]=useState(false),[help,setHelp]=useState(false);
 useEffect(()=>{
  const onPrompt=(event:Event)=>{event.preventDefault();deferred.current=event as MerchantInstallPrompt;setAvailable(true);};
  const onInstalled=()=>{deferred.current=null;setAvailable(false);setHelp(false);};
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  return()=>{
   window.removeEventListener('beforeinstallprompt',onPrompt);
   window.removeEventListener('appinstalled',onInstalled);
  };
 },[]);
 async function install(){
  const event=deferred.current;
  if(!event){setHelp(v=>!v);return;}
  deferred.current=null;setAvailable(false);
  try{await event.prompt();await event.userChoice;}
  catch{setHelp(true);}
 }
 if(PREVIEW_READONLY)return null;
 return <div className="rp-install-wrap">
  <button type="button" className="rp-btn outline small" onClick={()=>void install()}>
   <Download size={16}/>{available?'Instalar app':'Instalar en mi equipo'}</button>
  {help&&<p role="status" className="rp-install-help">En Chrome o Edge, utiliza «Instalar aplicación» del menú del navegador. En iPhone, Safari → Compartir → Añadir a pantalla de inicio.</p>}
 </div>;
}
export function RestaurantAccess(){
 const {user,login,register,logout}=useSession(),navigate=useNavigate();
 const [mode,setMode]=useState<'login'|'register'>(()=>new URLSearchParams(window.location.search).get('mode')==='register'?'register':'login');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const allowed=AUTH_EMAIL.test(email.trim())&&password.length>0&&
   (mode==='login'||(name.trim().length>=2&&password.length>=8));
 useEffect(()=>{
  if(user?.role==='restaurant')navigate('/restaurante',{replace:true});
  else if(user?.role==='admin')navigate('/admin/solicitudes-restaurantes',{replace:true});
 },[user?.role,navigate]);
 async function enter(event:FormEvent){
  event.preventDefault();
  if(busy||!allowed)return;
  setBusy(true);setError('');
  try{
   if(mode==='login')await login(email.trim(),password,otp.trim()||undefined);
   else await register(name.trim(),email.trim(),password);
   const verified=await api.me();
   navigate(verified.role==='restaurant'?'/restaurante':
     verified.role==='admin'?'/admin/solicitudes-restaurantes':'/restaurante/alta',{replace:true});
  }catch(e){setError(e instanceof Error?e.message:'No se pudo verificar tu cuenta.');}
  finally{setBusy(false);}
 }
 return <div className="rp-auth-page"><MerchantIntro title="Tu negocio, en movimiento."
  subtitle="Recibe y prepara pedidos, administra tus productos y activa los pagos para recoger desde un solo espacio."/>
  <section className="rp-access-card" aria-label="Acceso de restaurantes">
   <Link to={mainTalaEatsPortalHref(window.location.hostname)} className="rp-muted-link"><ArrowLeft size={16}/> Volver a Tala Eats</Link>
   {user?.role==='customer'?<>
    <span className="rp-eyebrow">CUENTA EXISTENTE</span>
    <h2>Solicita activar tu comercio</h2>
    <p>Tu cuenta actual es de cliente. Puedes enviar una solicitud real para que administración revise tu restaurante.</p>
    <Link to="/restaurante/alta" className="rp-btn primary">Ir a mi solicitud <ArrowRight size={18}/></Link>
    <button type="button" className="rp-btn quiet" onClick={()=>void logout()}>Entrar con otra cuenta</button>
   </>:<>
    <span className="rp-eyebrow">ACCESO EMPRESARIAL</span>
    <h2>{mode==='login'?'Bienvenido de nuevo':'Comienza con tu comercio'}</h2>
    <p>{mode==='login'?'Inicia sesión con tu cuenta autorizada de restaurante.':
      'Primero crea una cuenta personal. El restaurante se activa únicamente después de la revisión administrativa.'}</p>
    <form onSubmit={e=>void enter(e)} className="rp-form">
     {mode==='register'&&<label>Nombre del titular
      <input autoComplete="name" required minLength={2} maxLength={120} value={name} disabled={busy}
       onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label>}
     <label>Correo electrónico
      <input type="email" autoComplete="email" required value={email} maxLength={254}
       disabled={busy} onChange={e=>setEmail(e.target.value)} placeholder="tu@restaurante.com"/></label>
     <label>Contraseña
      <input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required
       minLength={8} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}
       placeholder="Mínimo 8 caracteres"/></label>
     {mode==='login'&&<label>Código 2FA (si tu cuenta lo tiene)
      <input autoComplete="one-time-code" inputMode="numeric" maxLength={12}
       value={otp} disabled={busy} onChange={e=>setOtp(e.target.value)} placeholder="Código de 6 dígitos"/></label>}
     {error&&<Notice kind="error" message={error}/>}
     <button type="submit" className="rp-btn primary" disabled={!allowed||busy}>
       {busy?'Verificando…':mode==='login'?'Entrar a mi restaurante':'Crear cuenta y solicitar alta'}
       <ArrowRight size={19}/>
     </button>
    </form>
    <button type="button" className="rp-switch" disabled={busy} onClick={()=>{setError('');setMode(v=>v==='login'?'register':'login');}}>
     {mode==='login'?'¿Aún no tienes cuenta? Registra tu negocio':'¿Ya tienes una cuenta? Inicia sesión'}
    </button>
    <p className="rp-legal">El registro no habilita automáticamente cobros ni asigna el rol Restaurante.</p>
   </>}
  </section>
 </div>;
}
export function RestaurantOnboarding(){
 const {user,loading,logout}=useSession();
 const [requests,setRequests]=useState<MerchantApplication[]|null>(null);
 const [businessName,setBusinessName]=useState(''),[taxId,setTaxId]=useState('');
 const [documents,setDocuments]=useState<File[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const refresh=useCallback(async()=>{
  setError('');setRequests(null);
  try{
   const data=await api.restaurantOnboardingMine();
   if(!Array.isArray(data))throw new Error('El servidor no devolvió una lista válida de solicitudes.');
   setRequests(data.filter(a=>a.entity_type==='restaurant'));
  }catch(e){setError(e instanceof ApiError&&e.status===401?
    'Tu sesión venció o los permisos fueron actualizados. Vuelve a iniciar sesión para activar tu panel.':
    e instanceof Error?e.message:'No se pudo consultar tu solicitud.');}
 },[]);
 useEffect(()=>{if(user?.role==='customer')void refresh();},[user?.role,refresh]);
 if(loading)return <div className="rp-loading"><RefreshCw className="rp-spin"/> Verificando sesión…</div>;
 if(!user)return <RestaurantAccess/>;
 if(user.role==='restaurant')return <div className="rp-standalone"><MerchantBrand/><h1>Tu restaurante ya está asignado</h1><Link className="rp-btn primary" to="/restaurante">Entrar al panel <ArrowRight size={18}/></Link></div>;
 if(user.role!=='customer')return <div className="rp-standalone"><MerchantBrand/><h1>Tu cuenta no puede solicitar este alta</h1><Link to={mainTalaEatsPortalHref(window.location.hostname)}>Volver al inicio</Link></div>;
 const latest=requests?.slice().sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
 const waiting=latest?.status==='pending'||latest?.status==='approved';
 async function submit(event:FormEvent){
  event.preventDefault();if(busy||businessName.trim().length<3)return;
  if(documents.length>3||documents.some(f=>!f.size||f.size>5*1024*1024||
    !['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))){
   setError('Solo se aceptan 3 archivos JPG, PNG, WEBP o PDF de máximo 5 MB cada uno.');return;
  }
  setBusy(true);setError('');setNote('');
  try{
   const uploaded:string[]=[];
   for(const file of documents){
    const doc=await api.restaurantOnboardingDocument(file);
    uploaded.push(doc.url);
   }
   const result=await api.restaurantOnboardingSubmit(businessName.trim(),taxId.trim(),uploaded);
   setRequests(v=>[result,...(v??[]).filter(x=>x.id!==result.id)]);
   setDocuments([]);
   setNote('Solicitud y referencias de documentos enviadas al backend. Administración deberá verificar tu negocio antes de activar el acceso.');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la solicitud.');}
  finally{setBusy(false);}
 }
 return <div className="rp-onboarding"><div className="rp-onboard-wrap"><MerchantBrand/>
  <Link to="/restaurante/acceso" className="rp-muted-link"><ArrowLeft size={16}/> Acceso restaurantes</Link>
  <span className="rp-eyebrow">ACTIVACIÓN DE COMERCIOS</span>
  <h1>Activa tu restaurante en Tala Eats.</h1>
  <p>El alta requiere la aprobación de administración. Después podrás preparar tu catálogo y verificar Stripe Connect para aceptar pedidos reales.</p>
  <div className="rp-activation-track">
   <span className="active">01 Solicitud</span><span>02 Revisión</span><span>03 Panel</span><span>04 Stripe Connect</span>
  </div>
  {error&&<Notice kind="error" message={error}/>}
  {error.includes('sesión venció')&&<a className="rp-btn outline" href="/restaurante/acceso">Volver a iniciar sesión</a>}
  {note&&<Notice kind="success" message={note}/>}
  {requests===null?<section className="rp-panel-card" role="status">
    <p>{error?'No se pudo consultar el estado de tu solicitud.':'Consultando estado de tu alta…'}</p>
    {error&&<button type="button" className="rp-btn outline" onClick={()=>void refresh()}>
     <RefreshCw size={17}/> Reintentar consulta</button>}
   </section>:
   latest&&waiting?<section className="rp-panel-card"><span className="rp-eyebrow">SOLICITUD #{latest.id}</span>
    <h2>{latest.status==='approved'?'Solicitud aprobada':'Tu solicitud está en revisión'}</h2>
    <p>{latest.business_name}</p>
    {latest.status==='approved'?<p>Administración aprobó el comercio. Cierra sesión y vuelve a entrar: el backend revoca la autorización anterior al cambiar tu rol.</p>:
     <p>El equipo administrativo debe confirmar los datos antes de activar tu restaurante.</p>}
    {latest.notes&&<Notice message={latest.notes}/>}
    <button className="rp-btn outline" onClick={()=>void refresh()}><RefreshCw size={18}/> Consultar estado</button>
    {latest.status==='approved'&&<button className="rp-btn primary" onClick={()=>void logout()}>Cerrar sesión para volver a entrar</button>}
   </section>:
   <section className="rp-panel-card"><h2>Datos del negocio</h2>
    {latest?.status==='needs_info'&&<Notice kind="info" message={'Administración solicita información adicional: '+(latest.notes||'actualiza los datos del negocio')}/>}
    {latest?.status==='rejected'&&<Notice kind="error" message={'Solicitud rechazada: '+(latest.notes||'contacta administración')}/>}
    <form onSubmit={e=>void submit(e)} className="rp-form">
     <label>Nombre del restaurante
      <input required minLength={3} maxLength={160} value={businessName}
       onChange={e=>setBusinessName(e.target.value)} placeholder="Ej. Antojitos La Terraza" disabled={busy}/></label>
     <label>RFC del negocio (si corresponde)
      <input maxLength={60} value={taxId} onChange={e=>setTaxId(e.target.value.toUpperCase())}
       placeholder="RFC del titular" disabled={busy}/></label>
     <label>Documentos del negocio (opcional, máximo 3)
      <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple disabled={busy}
       onChange={e=>{
        const files=Array.from(e.target.files??[]);
        if(files.length>3){
         setDocuments([]);
         setError('Selecciona como máximo 3 documentos. No se enviará ninguno hasta corregir la selección.');
         e.target.value='';
         return;
        }
        setDocuments(files);setError('');
       }}/>
      <span className="rp-legal">{documents.length?documents.length+' archivo(s) seleccionado(s). ':' '}JPG, PNG, WEBP o PDF; máximo 5 MB por archivo. Solo el titular y administración pueden acceder a documentos asociados.</span>
     </label>
     <p className="rp-legal">Administración puede solicitar información adicional. No cargues contraseñas ni claves de Stripe. Los documentos se guardan en almacenamiento privado del backend.</p>
     <button type="submit" className="rp-btn primary" disabled={busy||businessName.trim().length<3}>Enviar solicitud <ArrowRight size={18}/></button>
    </form>
   </section>}
  <p className="rp-legal">Tu cuenta seguirá siendo Cliente hasta que administración autorice el cambio. Ninguna solicitud crea por sí sola pagos Stripe LIVE.</p>
 </div></div>;
}
export function RestaurantAdminActivation(){
 const [requests,setRequests]=useState<MerchantApplication[]|null>(null);
 const [notes,setNotes]=useState<Record<number,string>>({});
 const [busy,setBusy]=useState<number|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  setError('');
  try{setRequests((await api.adminRestaurantApplications()).filter(x=>x.entity_type==='restaurant'));}
  catch(e){setError(e instanceof Error?e.message:'No se pudieron consultar las solicitudes.');}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function review(item:MerchantApplication,status:'approved'|'rejected'|'needs_info'|'suspended'){
  if(busy!==null)return;
  const meaning=status==='approved'?'APROBAR Y ACTIVAR ROL RESTAURANTE':status==='rejected'?'RECHAZAR':status==='needs_info'?'SOLICITAR INFORMACIÓN':'SUSPENDER';
  if(!window.confirm(meaning+' la solicitud #'+item.id+' del comercio '+item.business_name+'? El backend registrará la decisión y puede revocar sesiones.'))return;
  setBusy(item.id);setError('');setNotice('');
  try{
   await api.adminReviewRestaurantApplication(item.id,status,(notes[item.id]??'').trim());
   setNotice('Decisión registrada en el backend. Si se aprobó, el comerciante debe cerrar sesión y volver a iniciar.');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo revisar la solicitud.');}
  finally{setBusy(null);}
 }
 return <div className="rp-admin-page"><div className="rp-admin-title">
  <div><span className="rp-eyebrow">ADMIN · VERIFICACIÓN</span><h1>Activación de restaurantes</h1>
   <p>Revisa las solicitudes reales. La aprobación crea o verifica el comercio y asigna el rol Restaurante; Stripe Connect se autoriza por separado.</p></div>
  <Link className="rp-btn outline" to="/admin/conectar-restaurante">Vincular Stripe Connect <ArrowRight size={18}/></Link>
 </div>
  <div className="rp-action-row"><button className="rp-btn outline" onClick={()=>void refresh()}><RefreshCw size={16}/> Actualizar solicitudes</button>
   <Link className="rp-muted-link" to={mainTalaEatsPortalHref(window.location.hostname)}>Volver a Tala Eats</Link></div>
  {error&&<Notice kind="error" message={error}/>}
  {notice&&<Notice kind="success" message={notice}/>}
  {requests===null?<p>Consultando backend administrativo…</p>:
   requests.length===0?<section className="rp-panel-card"><h2>Sin solicitudes de restaurantes</h2><p>Las solicitudes aparecerán aquí en cuanto los comerciantes completen el formulario de alta.</p></section>:
   <div className="rp-admin-grid">{requests.map(item=><article className="rp-panel-card" key={item.id}>
    <span className={'rp-pill '+item.status}>{merchantStateLabel(item.status)}</span>
    <h2>{item.business_name||'Restaurante sin nombre'}</h2>
    <p className="rp-muted">Solicitud #{item.id} · Cuenta #{item.user_id} · {new Date(item.created_at).toLocaleDateString('es-MX')}</p>
    <p className="rp-muted">RFC: {item.tax_id||'No proporcionado'}</p>
    {item.notes&&<p>Última observación: {item.notes}</p>}
    {item.status!=='approved'&&<><label className="rp-review-note">Nota para el comerciante
     <textarea maxLength={2000} rows={3} value={notes[item.id]??''}
      onChange={e=>setNotes(v=>({...v,[item.id]:e.target.value}))}
      placeholder="Documentación revisada, información faltante…"/></label>
     <div className="rp-admin-actions">
      <button className="rp-btn primary" disabled={busy!==null} onClick={()=>void review(item,'approved')}>Aprobar <Check size={16}/></button>
      <button className="rp-btn outline" disabled={busy!==null} onClick={()=>void review(item,'needs_info')}>Solicitar datos</button>
      <button className="rp-btn quiet" disabled={busy!==null} onClick={()=>void review(item,'rejected')}>Rechazar</button>
     </div></>}
    {item.status==='approved'&&<p className="rp-approved-note"><BadgeCheck size={16}/> Alta aprobada. Falta habilitación individual de Stripe Connect.</p>}
   </article>)}</div>}
  <p className="rp-legal">El servidor exige rol administrador, 2FA y sesión válida para aprobar solicitudes. Esta pantalla no vincula automáticamente cuentas Stripe ni mueve dinero.</p>
 </div>;
}
type Stats={orders:number;delivered:number;gross_sales:number;inventory_low:number};
export function RestaurantWorkspace(){
 const {user,logout}=useSession();
 const navigate=useNavigate();
 const [tab,setTab]=useState<MerchantTab>('inicio');
 const [orderFilter,setOrderFilter]=useState<'all'|'received'|'kitchen'|'ready'|'history'>('all');
 const [orderQuery,setOrderQuery]=useState('');
 const [restaurant,setRestaurant]=useState<Restaurant|null>(null),[orders,setOrders]=useState<Order[]>([]);
 const [stats,setStats]=useState<Stats|null>(null),[finance,setFinance]=useState<MerchantFinance|null>(null);
 const [connect,setConnect]=useState<MerchantConnectStatus|null>(null);
 const [connectError,setConnectError]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [syncHealthy,setSyncHealthy]=useState(false),[refreshing,setRefreshing]=useState(false);

 const [busy,setBusy]=useState(false),[lastSync,setLastSync]=useState<Date|null>(null);
 const [pins,setPins]=useState<Record<number,string>>({}),[cashConfirmed,setCashConfirmed]=useState<Record<number,boolean>>({});
 const mounted=useRef(true),requestVersion=useRef(0),busyRef=useRef(false);
 const currentRestaurantId=useRef<number|null>(null);
 const refresh=useCallback(async()=>{
  const version=++requestVersion.current;
  setRefreshing(true);
  try{
   // Order operations are the critical path: optional finance/analytics must
   // never keep the merchant staring at an empty dashboard.
   const [r,o]=await Promise.all([api.ownerRestaurant(),api.ownerOrders()]);
   if(!mounted.current||version!==requestVersion.current)return;
   if(!r||!Number.isSafeInteger(r.id)||!Array.isArray(o))
    throw new Error('El backend no devolvió los datos válidos del restaurante.');
   if(o.some(order=>order.restaurant_id!==r.id))
    throw new Error('Los pedidos no corresponden al restaurante autorizado.');
   if(currentRestaurantId.current!==r.id){
    // Discard approvals and balances belonging to the previous merchant.
    currentRestaurantId.current=r.id;
    setStats(null);setFinance(null);setConnect(null);setConnectError('');
    setPins({});setCashConfirmed({});
   }
   setRestaurant(r);setOrders(o);setError('');setSyncHealthy(true);
   setLoading(false);setLastSync(new Date());
   const [a,c,f]=await Promise.allSettled([
    api.ownerAnalytics(),api.ownerConnectStatus(r.id),api.ownerFinance()
   ]);
   if(!mounted.current||version!==requestVersion.current)return;
   setStats(a.status==='fulfilled'?a.value:null);
   if(c.status==='fulfilled'){setConnect(c.value);setConnectError('');}
   else {setConnect(null);setConnectError('No hay una cuenta Connect autorizada o no se pudo consultar.');}
   setFinance(f.status==='fulfilled'?f.value:null);
  }catch(e){
   if(mounted.current&&version===requestVersion.current){
    // No assigned shop is a legitimate empty state, not a retry loop.
    if(e instanceof ApiError&&e.status===404){
     currentRestaurantId.current=null;
     setRestaurant(null);setOrders([]);setStats(null);setFinance(null);setConnect(null);
     setPins({});setCashConfirmed({});
     setSyncHealthy(true);setError('');
    }else{
     // Do not allow actions against stale orders after a server/session failure.
     setSyncHealthy(false);
     setError(e instanceof Error?e.message:'No se pudo conectar con el backend de tu restaurante.');
    }
   }
  }finally{
   if(mounted.current&&version===requestVersion.current){setLoading(false);setRefreshing(false);}
  }
 },[]);
 // Edit forms are never replaced by a background timer. Order-focused views
 // keep polling only while visible, and get a fresh snapshot on returning.
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  return()=>{mounted.current=false;requestVersion.current++;};
 },[refresh]);
 useEffect(()=>{
  if(!['inicio','pedidos','cocina'].includes(tab))return;
  const onResume=()=>{if(document.visibilityState==='visible'&&!busyRef.current)void refresh();};
  const poll=window.setInterval(onResume,20000);
  document.addEventListener('visibilitychange',onResume);
  window.addEventListener('online',onResume);
  return()=>{window.clearInterval(poll);document.removeEventListener('visibilitychange',onResume);window.removeEventListener('online',onResume);};
 },[refresh,tab]);
 const doAction=async(work:()=>Promise<unknown>,message:string)=>{
  if(busyRef.current||!syncHealthy||PREVIEW_READONLY){
   setError(PREVIEW_READONLY?'Vista previa: cambios bloqueados.':'Sin conexión confirmada. Actualiza el panel antes de realizar cambios.');
   return false;
  }
  busyRef.current=true;setBusy(true);setError('');setNotice('');
  try{await work();setNotice(message);await refresh();return true;}
  catch(e){
   // A successful refresh clears setError: report the failed write *after* resync.
   const reason=e instanceof Error?e.message:'La operación no pudo confirmarse en el servidor.';
   await refresh();setError(reason);return false;
  }
  finally{busyRef.current=false;setBusy(false);}
 };
 async function signOut(){
  if(busyRef.current)return;
  try{await logout();navigate('/restaurante/acceso',{replace:true});}
  catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar sesión.');}
 }
 function confirmOwner(){
  if(!restaurant||!connect||connect.owner_approved)return;
  if(!window.confirm('Confirma SOLO si eres el titular legal del restaurante y reconoces como propia la cuenta Stripe Connect que administración vinculó. ¿Autorizar esta asociación?'))return;
  void doAction(()=>api.ownerConfirmConnect(restaurant.id),'Titularidad registrada. Stripe y el backend verificarán los requisitos antes de aceptar pagos.');
 }
 async function onboardingLink(){
  if(!restaurant||!connect?.owner_approved||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');
  try{
   const result=await api.ownerConnectOnboardingLink(restaurant.id);
   const url=new URL(result.url);
   if(url.protocol!=='https:'||url.hostname!=='connect.stripe.com')
    throw new Error('Stripe Connect devolvió un enlace no autorizado.');
   window.location.assign(url.href);
  }catch(e){setError(e instanceof Error?e.message:'No fue posible continuar a Stripe Connect.');}
  finally{busyRef.current=false;setBusy(false);}
 }
 function statusAction(order:Order){
  const next=nextMerchantState(order);
  if(!next)return;
  void doAction(()=>api.ownerUpdateStatus(order.id,next),'Pedido #'+order.id+' actualizado por el servidor.');
 }
 function handoff(order:Order){
  const pin=pins[order.id]??'',cash=cashConfirmed[order.id]===true;
  if(!canHandoffPickup(order,pin,cash))return;
  const message=order.payment_method==='cash'?
   'Confirma que recibiste físicamente '+pesos(order.total)+' en efectivo y entregaste el pedido #'+order.id+'.':
   'Confirma que entregaste el pedido #'+order.id+', pagado y conciliado mediante Stripe, al cliente con PIN válido.';
  if(!window.confirm(message))return;
  void doAction(async()=>{
   await api.ownerCompletePickup(order.id,pin);
   setPins(v=>({...v,[order.id]:''}));
   setCashConfirmed(v=>({...v,[order.id]:false}));
  },'Recogida registrada con PIN. El recibo y estado contable quedan en el servidor.');
 }
 function openToggle(){
  if(!restaurant)return;
  void doAction(()=>api.ownerUpdateRestaurant({is_open:!restaurant.is_open}),
   restaurant.is_open?'Comercio cerrado temporalmente.':'Comercio abierto según verificación del backend.');
 }
 function pickupToggle(){
  if(!restaurant)return;
  void doAction(()=>api.ownerUpdateRestaurant({pickup_enabled:!restaurant.pickup_enabled}),
   'Preferencia de recogida actualizada en el servidor.');
 }
 const activeOrders=orders.filter(o=>['received','confirmed','preparing','ready'].includes(o.status));
 const incomingCount=activeOrders.filter(o=>o.status==='received').length;
 const waitingPayment=orders.filter(o=>o.status==='awaiting_payment'||(o.status==='received'&&o.payment_method==='stripe'&&o.payment_status!=='paid'));
 const matchesOrder=(o:Order)=>!orderQuery.trim()||String(o.id).includes(orderQuery.trim())||
   (o.items??[]).some(item=>item.name_snapshot.toLocaleLowerCase('es-MX').includes(orderQuery.trim().toLocaleLowerCase('es-MX')));
 const visibleOrders=activeOrders.filter(o=>matchesOrder(o)&&(orderFilter==='all'||orderFilter==='received'&&o.status==='received'||
  orderFilter==='kitchen'&&['confirmed','preparing'].includes(o.status)||
  orderFilter==='ready'&&o.status==='ready'));

 const completedOrders=orders.filter(o=>['delivered','cancelled'].includes(o.status))
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,30);
 const matchingCompletedOrders=completedOrders.filter(matchesOrder);
 const connectSteps=restaurant?merchantConnectSteps(restaurant,connect):[];
 const connectComplete=connectSteps.length>0&&connectSteps.every(x=>x.complete);
 return <div className="rp-layout" data-restaurant-app="true" data-kitchen-open={tab==='cocina'?'true':'false'} data-current-tab={tab}>
  <aside className="rp-sidebar"><span className="rp-sidebar-label">Restaurantes</span>
   <nav className="rp-nav" aria-label="Secciones del restaurante">
    {allTabs.map(({id,label,Icon})=><button key={id} type="button"
      className={'rp-nav-item '+(tab===id?'selected':'')} aria-current={tab===id?'page':undefined}
      onClick={()=>setTab(id)}><Icon size={20}/>{label}
      {id==='pedidos'&&activeOrders.length>0&&<em>{activeOrders.length}</em>}
      {id==='activacion'&&!connectComplete&&<span className="rp-nav-dot" aria-label="Configuración pendiente"/>}
     </button>)}
   </nav>
   <div className="rp-side-bottom"><div className="rp-owner-avatar">{(user?.name||'R').slice(0,1).toUpperCase()}</div>
    <div><strong>{user?.name||'Restaurante'}</strong><small>Cuenta del comercio</small></div>
    <button type="button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={()=>void signOut()}><LogOut size={18}/></button>
   </div>
  </aside>
  <div className="rp-workspace">
   <header className="rp-topbar">
    <div className="rp-top-identity">
     <h1>{restaurant?.name||'Restaurantes'}</h1>
     {!syncHealthy&&<span className="rp-sync-meta" role="status">Sin conexión</span>}
    </div>
    <div className="rp-top-actions">
     <RestaurantOrderAlerts orders={orders} live={syncHealthy} onOpenOrders={()=>{setTab('pedidos');setOrderFilter('received');setOrderQuery('');}}/>
     <MerchantInstallButton/>
     <span className={'rp-open-badge '+(restaurant?.is_open?'open':'closed')}><span/>
       {restaurant?.is_open?'Abierto':'Cerrado'}</span>
     <button type="button" className="rp-icon-btn" aria-label="Actualizar pedidos y negocio"
      title="Actualizar desde el servidor" disabled={refreshing||busy}
      onClick={()=>void refresh()}><RefreshCw size={19} className={refreshing?'rp-spin':undefined}/></button>
    </div>
   </header>
   <main className="rp-content">
    {syncHealthy&&incomingCount>0&&!['inicio','pedidos','cocina'].includes(tab)&&<button
     type="button" className="flutter-incoming-banner" onClick={()=>{setOrderFilter('received');setOrderQuery('');setTab('pedidos');}}>
     <span>{incomingCount===1?'1 pedido nuevo espera respuesta':incomingCount+' pedidos nuevos esperan respuesta'}</span>
     <ArrowRight size={17}/>
    </button>}
    {PREVIEW_READONLY&&<Notice message="Vista previa: se puede explorar el diseño, pero las acciones de administración y cobro están bloqueadas."/>}
    {error&&<Notice kind="error" message={error}/>}
    {notice&&<Notice kind="success" message={notice}/>}
    {!loading&&!syncHealthy&&<section className="rp-outage" role="status">
     <div><AlertCircle size={22}/><span><strong>Conexión no confirmada</strong><small>Los cambios están bloqueados para proteger tus pedidos. Reintenta la sincronización.</small></span></div>
     <button className="rp-btn outline small" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={16}/> Reintentar</button>
    </section>}
    {loading?<MerchantLoadingSkeleton/>:
    !syncHealthy?<section className="rp-panel-card"><h2>No podemos verificar el estado del restaurante</h2><p>No se muestran pedidos antiguos ni se habilitan cambios hasta recuperar la conexión.</p><button className="rp-btn outline" disabled={refreshing} onClick={()=>void refresh()}>Reintentar conexión</button></section>:
    !restaurant?<section className="rp-panel-card"><h2>No tienes un restaurante asignado</h2><p>Solicita el alta y aprobación administrativa. Ninguna cuenta recibe permisos de comercio automáticamente.</p>
     <Link to="/restaurante/alta" className="rp-btn primary">Ver activación <ArrowRight size={18}/></Link></section>:
    <>
     {tab==='inicio'&&<MerchantOverview {...{restaurant,orders,stats,finance,connect,busy:busy||!syncHealthy,run:doAction,go:setTab}}/>}
     {tab==='cocina'&&<MerchantKitchen {...{restaurant,orders,stats,finance,connect,busy:busy||!syncHealthy,run:doAction,go:setTab}}/>}
     {tab==='mas'&&<MerchantMore {...{restaurant,orders,stats,finance,connect,busy:busy||!syncHealthy,run:doAction,go:setTab}} onSignOut={signOut}/>}
     {tab==='pedidos'&&<>
      <div className="rp-heading-row"><div><h2>Pedidos</h2></div>
       <span className="rp-last-sync"><Clock3 size={16}/> {lastSync?'Actualizado '+lastSync.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'Sin sincronizar'} · Cada 20 s</span>
      </div>
      <div className="rp-stats">
       <div><span>Pedidos históricos</span><strong>{stats?.orders??'—'}</strong><small>Desde el servidor</small></div>
       <div><span>Activos</span><strong>{activeOrders.length}</strong><small>En espera o preparación</small></div>
       <div><span>Entregados</span><strong>{stats?.delivered??'—'}</strong><small>Recogidas y entregas</small></div>
       <div><span>Stock bajo</span><strong>{stats?.inventory_low??'—'}</strong><small>Productos bajo 10 uds.</small></div>
      </div>
      {!connectComplete&&<section className="rp-activation-banner">
       <LockKeyhole size={24}/><div><strong>Falta completar la activación LIVE</strong>
        <p>Los pedidos reales se habilitan cuando el propietario confirma su cuenta Stripe Connect y el servidor valida la configuración.</p></div>
       <button className="rp-btn small dark" onClick={()=>setTab('activacion')}>Ver activación <ArrowRight size={16}/></button>
      </section>}
      <div className="rp-order-controls">
       <label><SearchIcon size={18}/><input aria-label="Buscar pedidos por número o producto" placeholder="Buscar número o producto" value={orderQuery} onChange={e=>setOrderQuery(e.target.value)}/></label>
       <div className="rp-order-filters" aria-label="Filtrar pedidos">{([
        ['all','Todos'],['received','Nuevos'],['kitchen','En cocina'],['ready','Listos'],['history','Historial']
       ] as const).map(([id,label])=><button key={id} className={orderFilter===id?'selected':''} onClick={()=>setOrderFilter(id)} aria-pressed={orderFilter===id}>{label}</button>)}</div>
      </div>
      {waitingPayment.length>0&&orderFilter!=='history'&&<div className="rp-pending-payment-note" role="status">
       <AlertCircle size={19}/>
       <span><strong>{waitingPayment.length} pedido(s) requieren revisión de pago</strong>
        <small>Los pedidos de tarjeta pendientes de conciliación no se preparan ni se cobran nuevamente desde este panel.</small></span>
      </div>}
      {orderFilter!=='history'&&visibleOrders.length===0&&orderQuery.trim()&&<div className="rp-search-empty" role="status">
       <SearchIcon size={20}/><strong>No se encontraron pedidos activos</strong>
       <span>Prueba otro número, producto o filtro.</span>
       <button className="rp-btn outline small" onClick={()=>{setOrderQuery('');setOrderFilter('all');}}>Limpiar búsqueda</button>
      </div>}
      {orderFilter!=='history'&&<div className="rp-lane-grid">
       {(['received','confirmed','preparing','ready'] as const).map(state=>{
        const lane=visibleOrders.filter(o=>o.status===state);
        return <section className={'rp-order-lane '+(lane.length===0?'rp-lane-empty':'')} key={state}>
         <div className="rp-lane-title"><span className={'rp-lane-indicator '+state}/>
          <h3>{merchantStateLabel(state)}</h3><span>{lane.length}</span></div>
         {lane.length===0?<div className="rp-empty-lane"><PackageCheck size={29}/><p>Sin pedidos en esta etapa</p></div>:
          lane.map(o=><article className="rp-order-card" key={o.id}>
           <div className="rp-order-head"><div><strong>Pedido #{o.id}</strong>
            <small>{new Date(o.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</small></div>
            <b>{pesos(o.total)}</b></div>
           <div className="rp-payment-tag"><CreditCard size={16}/>
            {o.payment_method==='cash'?'Efectivo al recoger':
             o.payment_status==='paid'?'Tarjeta · Confirmada por servidor':'Tarjeta · Pendiente de conciliación'}</div>
           <div className="rp-order-items">{(o.items??[]).map((item,i)=><p key={i}>{item.quantity} × {item.name_snapshot}</p>)}</div>
           <p className="rp-muted">{o.order_type==='pickup'?'Recoger en el local':'Entrega a domicilio'}</p>
           {nextMerchantState(o)&&<button className="rp-btn primary small" disabled={busy}
             onClick={()=>statusAction(o)}>{state==='received'?'Aceptar pedido':state==='confirmed'?'Comenzar preparación':'Marcar listo'} <ArrowRight size={16}/></button>}
           {state==='ready'&&o.order_type==='pickup'&&<div className="rp-handoff">
            <label>PIN del cliente
             <input type="password" inputMode="numeric" autoComplete="off" maxLength={4}
              value={pins[o.id]??''} placeholder="••••" aria-label={'PIN de pedido '+o.id}
              onChange={e=>setPins(v=>({...v,[o.id]:normalizePickupPin(e.target.value)}))}
              disabled={busy}/></label>
            {o.payment_method==='cash'&&<label className="rp-cash-check">
             <input type="checkbox" checked={cashConfirmed[o.id]===true} disabled={busy}
              onChange={e=>setCashConfirmed(v=>({...v,[o.id]:e.target.checked}))}/>
             Recibí {pesos(o.total)} en efectivo
            </label>}
            <button type="button" className="rp-btn primary small"
             disabled={busy||!canHandoffPickup(o,pins[o.id]??'',cashConfirmed[o.id]===true)}
             onClick={()=>handoff(o)}><PackageCheck size={16}/> Confirmar recogida</button>
            <small>El servidor valida el PIN y registra el recibo sin duplicar cobros.</small>
           </div>}
           {state==='ready'&&o.order_type!=='pickup'&&<p className="rp-muted">Pendiente de reparto autorizado.</p>}
          </article>)}
        </section>;
       })}
      </div>}
      {(orderFilter==='all'||orderFilter==='history')&&<section className="rp-history">
       <div className="rp-history-head"><div><span className="rp-eyebrow">REGISTRO CONSULTADO</span><h3>Últimos pedidos finalizados</h3></div>
        <span>{matchingCompletedOrders.length} de {completedOrders.length} registros recientes</span></div>
       {matchingCompletedOrders.length===0?<div className="rp-search-empty">
        <PackageCheck size={21}/><strong>{completedOrders.length?'No hay resultados en este historial':'Aún no hay pedidos finalizados'}</strong>
        <span>El historial mostrado corresponde a los registros recientes recibidos del backend.</span>
       </div>:
        matchingCompletedOrders.map(o=><div className="rp-history-row" key={o.id}>
         <span>#{o.id} · {merchantStateLabel(o.status)}</span>
         <span className="rp-history-date">{new Date(o.created_at).toLocaleDateString('es-MX')}</span>
         <strong>{pesos(o.total)}</strong>
        </div>)}
       {completedOrders.length>=30&&<p className="rp-legal">Historial reciente limitado a 30 registros de los pedidos consultados, no es el libro contable completo.</p>}
      </section>}
     </>}
     {tab==='menu'&&<MerchantMenu restaurant={restaurant} busy={busy} run={doAction}/>}
     {tab==='activacion'&&<>
      <div className="rp-heading-row"><div><h2>Activación</h2>
       <p>Verificación del negocio, recogida y cuenta Stripe Connect del propietario.</p></div>
       <span className={'rp-pill '+(connectComplete?'approved':'pending')}>{connectComplete?'Requisitos revisados':'Configuración pendiente'}</span></div>
      <div className="rp-activation-grid"><section className="rp-panel-card"><div className="rp-card-top"><BadgeCheck size={22}/><h3>Lista de activación</h3></div>
       <div className="rp-steps">{connectSteps.map((step,i)=><div key={step.id} className={step.complete?'done':''}>
        <span>{step.complete?<Check size={16}/>:String(i+1).padStart(2,'0')}</span><p>{step.label}</p></div>)}</div>
       {connectError&&<Notice kind="info" message={connectError}/>}
       {!connect&&<p className="rp-muted">Si no existe una asociación Connect, administración debe verificar el negocio y registrar la cuenta correcta.</p>}
       {connect&&!connect.owner_approved&&<button className="rp-btn primary" disabled={busy} onClick={confirmOwner}>
        <KeyRound size={17}/> Confirmar mi titularidad</button>}
       {connect?.owner_approved&&!(connect.details_submitted&&connect.transfers_active&&connect.payouts_enabled)&&
        <button className="rp-btn primary" disabled={busy} onClick={()=>void onboardingLink()}>
         Completar verificación con Stripe <ArrowRight size={17}/></button>}
       <button className="rp-btn outline small" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/> Verificar de nuevo</button>
       <p className="rp-legal">El panel nunca crea una cuenta Connect por su cuenta ni promete pagos automáticos. El checkout confirma cada habilitación directamente en el backend.</p>
      </section>
      <section className="rp-panel-card"><div className="rp-card-top"><Store size={22}/><h3>Disponibilidad</h3></div>
       <p className="rp-muted">{restaurant.name}</p><p>{restaurant.address||'Agrega la dirección completa para que te encuentren.'}</p>
       <div className="rp-setting"><div><strong>Comercio</strong><small>{restaurant.is_open?'Abierto para recibir pedidos autorizados':'Cerrado temporalmente'}</small></div>
        <button className="rp-btn outline small" disabled={busy} onClick={openToggle}>{restaurant.is_open?'Cerrar':'Abrir'}</button></div>
       <div className="rp-setting"><div><strong>Recoger en tienda</strong><small>{restaurant.pickup_enabled?'Clientes pueden elegir recogida si están autorizados':'Opción de recogida desactivada'}</small></div>
        <button className="rp-btn outline small" disabled={busy} onClick={pickupToggle}>{restaurant.pickup_enabled?'Desactivar':'Activar'}</button></div>
       <p className="rp-legal">Abrir el comercio no sustituye la aprobación administrativa, la verificación del titular ni la conciliación de Stripe.</p>
      </section></div>
     </>}
     {tab==='finanzas'&&<MerchantWallet restaurantId={restaurant.id}
      finance={finance} connect={connect} go={setTab}/>} 
    </>}
   </main>
   <nav className="rp-mobile-tabs" aria-label="Navegación móvil de restaurantes">
    {bottomTabs.map(({id,label,Icon})=>{
      const selected=tab===id||(id==='mas'&&tab==='activacion');
      return <button key={id} className={selected?'selected':''}
       aria-current={selected?'page':undefined} onClick={()=>setTab(id)}
       ><Icon size={21}/><span>{label}</span></button>;
     })}
   </nav>
  </div>
 </div>;
}
function MerchantMenu({restaurant,busy,run}:{restaurant:Restaurant;busy:boolean;
 run:(fn:()=>Promise<unknown>,message:string)=>Promise<boolean>}){
 const [name,setName]=useState(''),[price,setPrice]=useState(''),[stock,setStock]=useState(10);
 const [category,setCategory]=useState('General'),[description,setDescription]=useState('');
 const [search,setSearch]=useState(''),[selectedCategory,setSelectedCategory]=useState('Todos');
 const [editingId,setEditingId]=useState<number|null>(null),[showAddForm,setShowAddForm]=useState(false);
 const categories=['Todos',...Array.from(new Set((restaurant.menu_items??[]).map(i=>i.category||'General')))];
 const shown=(restaurant.menu_items??[]).filter(i=>(selectedCategory==='Todos'||(i.category||'General')===selectedCategory)
  &&(i.name+' '+(i.description??'')).toLocaleLowerCase('es-MX').includes(search.trim().toLocaleLowerCase('es-MX')));
 const nameGood=name.trim().length>=2;
 const priceGood=/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(price)&&Number(price)>0;
 const stockGood=Number.isInteger(stock)&&stock>=0&&stock<=100000;
 async function add(event:FormEvent){
  event.preventDefault();
  if(busy||!nameGood||!priceGood||!stockGood)return;
  const ok=await run(()=>api.ownerAddItem({name:name.trim(),price,stock,category:category.trim()||'General',
   description:description.trim(),is_available:true}),'Producto agregado al catálogo del restaurante.');
  if(ok){setName('');setPrice('');setDescription('');setShowAddForm(false);}
 }
 return <section className="rp-catalog">
  <div className="rp-heading-row rp-catalog-heading">
   <div><h2>Menú</h2></div>
   <div className="rp-catalog-heading-actions"><span className="rp-menu-count">{restaurant.menu_items?.length??0} productos</span>
    <button className="rp-btn primary" type="button" onClick={()=>{setShowAddForm(p=>!p);setEditingId(null);}}>
     <Plus size={17}/>{showAddForm?'Cerrar formulario':'Nuevo producto'}</button></div>
  </div>
  <div className="rp-order-controls rp-menu-controls">
   <label><SearchIcon size={18}/><input aria-label="Buscar productos" placeholder="Buscar por nombre o descripción"
     value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <div className="rp-order-filters" aria-label="Filtrar categorías">
    {categories.map(cat=><button type="button" key={cat} className={selectedCategory===cat?'selected':''}
     aria-pressed={selectedCategory===cat} onClick={()=>setSelectedCategory(cat)}>{cat}</button>)}
   </div>
  </div>
  {showAddForm&&<section className="rp-panel-card rp-menu-new">
   <div className="rp-card-top"><h3>Nuevo producto</h3></div>
   
   <form className="rp-form rp-product-form" onSubmit={e=>void add(e)}>
    <label>Nombre<input required minLength={2} maxLength={150} value={name}
      onChange={e=>setName(e.target.value)} placeholder="Hamburguesa clásica"/></label>
    <label>Precio MXN<input required inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?"
      value={price} onChange={e=>setPrice(e.target.value)} placeholder="89.00"/></label>
    <label>Stock<input required type="number" min={0} max={100000} step={1}
      value={stock} onChange={e=>setStock(Number(e.target.value))}/></label>
    <label>Categoría<input maxLength={100} value={category} onChange={e=>setCategory(e.target.value)}/></label>
    <label className="rp-product-wide">Descripción<textarea value={description} rows={3}
      onChange={e=>setDescription(e.target.value)} placeholder="Ingredientes y detalles"/></label>
    <div className="rp-product-wide rp-product-cta">
     <button className="rp-btn primary" type="submit" disabled={busy||!nameGood||!priceGood||!stockGood}><Plus size={16}/> Publicar producto</button>
     <button className="rp-btn outline" type="button" onClick={()=>setShowAddForm(false)}>Cancelar</button>
    </div>
   </form>
  </section>}
  {shown.length>0?<div className="rp-menu-grid rp-catalog-grid">
   {shown.map(item=><MenuRow key={item.id} item={item} busy={busy} run={run}
    editing={editingId===item.id}
    onEdit={()=>{setEditingId(v=>v===item.id?null:item.id);setShowAddForm(false);}}
    onClose={()=>setEditingId(null)}/>)}
  </div>:<div className="rp-panel-card rp-catalog-empty">
   <h3>{(restaurant.menu_items??[]).length?'Sin coincidencias':'Tu menú está vacío'}</h3>
   <p>{(restaurant.menu_items??[]).length?'Prueba otra búsqueda o categoría.':'Agrega tu primer producto para que aparezca en el catálogo.'}</p>
   {search&&<button className="rp-btn outline small" onClick={()=>{setSearch('');setSelectedCategory('Todos');}}>Limpiar filtros</button>}
  </div>}
 </section>;
}
function MenuRow({item,busy,run,editing,onEdit,onClose}:{item:MenuItem;busy:boolean;
 run:(fn:()=>Promise<unknown>,message:string)=>Promise<boolean>;
 editing:boolean;onEdit:()=>void;onClose:()=>void}){
 const [price,setPrice]=useState(item.price),[stock,setStock]=useState(item.stock);
 const [available,setAvailable]=useState(item.is_available);
 const [productName,setProductName]=useState(item.name),[description,setDescription]=useState(item.description??'');
 const [category,setCategory]=useState(item.category??'General');
 const [allergens,setAllergens]=useState(item.allergens??''),[isCombo,setIsCombo]=useState(item.is_combo??false);
 const [photo,setPhoto]=useState<File|null>(null),[imageBroken,setImageBroken]=useState(false);
 const safePhoto=safeImage(item.image_url);
 useEffect(()=>{setImageBroken(false);},[safePhoto]);
 useEffect(()=>{
  if(editing)return;
  setPrice(item.price);setStock(item.stock);setAvailable(item.is_available);
  setProductName(item.name);setDescription(item.description??'');setCategory(item.category??'General');
  setAllergens(item.allergens??'');setIsCombo(item.is_combo??false);setPhoto(null);
 },[editing,item.id,item.price,item.stock,item.is_available,item.name,item.description,item.category,item.allergens,item.is_combo]);
 const priceValid=/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(price)&&Number(price)>0;
 const stockValid=Number.isInteger(stock)&&stock>=0&&stock<=100000;
 const valid=productName.trim().length>=2&&priceValid&&stockValid;
 async function save(){
  if(busy||!valid)return;
  const ok=await run(()=>api.ownerUpdateItem(item.id,{name:productName.trim(),description:description.trim(),
   category:category.trim()||'General',allergens:allergens.trim(),is_combo:isCombo,price,stock,
   is_available:available}),'Producto actualizado en el servidor.');
  if(ok)onClose();
 }
 async function remove(){
  if(!window.confirm('¿Eliminar '+item.name+' del catálogo? El backend bloqueará la eliminación si está asociado a pedidos históricos.'))return;
  const ok=await run(()=>api.ownerDeleteItem(item.id),'Producto eliminado tras validar historial en el servidor.');
  if(ok)onClose();
 }
 async function upload(){
  if(!photo||busy)return;
  const ok=await run(()=>api.ownerUploadItemPhoto(item.id,photo),'Foto del producto publicada desde el backend.');
  if(ok)setPhoto(null);
 }
 return <article className={'rp-menu-item rp-catalog-item '+(editing?'is-editing':'')} data-product-id={item.id}>
  <div className="rp-catalog-topline">
   {safePhoto&&!imageBroken&&<div className="rp-menu-visual">
    <img src={safePhoto} alt="" loading="lazy" onError={()=>setImageBroken(true)}/>
   </div>}
   <div className="rp-catalog-product">
    <strong>{item.name}</strong><small>{item.category||'General'}</small>
    <b className="rp-catalog-price">{pesos(item.price)}</b>
   </div>
   <div className="rp-catalog-product-actions">
    <span className={'rp-catalog-stock '+(!item.is_available||item.stock===0?'paused':item.stock<10?'low':'')}>
     {!item.is_available?'Pausado':item.stock===0?'Agotado':item.stock<10?'Stock bajo: '+item.stock:'Stock: '+item.stock}</span>
    <label className="flutter-product-toggle">
     <input type="checkbox" role="switch" checked={item.is_available} disabled={busy}
      aria-label={item.name+': disponible para clientes'}
      onChange={event=>{const available=event.target.checked;
       void run(()=>api.ownerUpdateItem(item.id,{is_available:available}),
        'Disponibilidad actualizada en el servidor.');
      }}/>
     <span aria-hidden="true"/>
    </label>
    <button type="button" className="rp-btn outline small" disabled={busy} onClick={onEdit}
      aria-expanded={editing} aria-controls={'rp-product-editor-'+item.id}>
     {editing?'Cerrar':'Editar'}</button>
   </div>
  </div>
  {editing&&<div id={'rp-product-editor-'+item.id} className="rp-catalog-editor">
   <form onSubmit={e=>{e.preventDefault();void save();}} className="rp-catalog-form">
    <div className="rp-menu-inputs">
     <label>Nombre<input maxLength={150} minLength={2} required value={productName}
      onChange={e=>setProductName(e.target.value)}/></label>
     <label>Precio MXN<input value={price} required inputMode="decimal" onChange={e=>setPrice(e.target.value)}/></label>
     <label>Existencias<input type="number" min={0} max={100000} step={1} value={stock}
      onChange={e=>setStock(Number(e.target.value))}/></label>
     <label>Categoría<input value={category} maxLength={100} onChange={e=>setCategory(e.target.value)}/></label>
     <label>Alérgenos<input value={allergens} maxLength={300} onChange={e=>setAllergens(e.target.value)}/></label>
    </div>
    <label className="rp-menu-edit-label">Descripción<textarea value={description} maxLength={1000} rows={3}
     onChange={e=>setDescription(e.target.value)}/></label>
    <div className="rp-menu-actions">
     <label className="rp-cash-check"><input type="checkbox" checked={available}
      onChange={e=>setAvailable(e.target.checked)}/> Disponible</label>
     <label className="rp-cash-check"><input type="checkbox" checked={isCombo}
      onChange={e=>setIsCombo(e.target.checked)}/> Es un combo</label>
    </div>
    <div className="rp-menu-actions rp-catalog-save">
     <button type="submit" className="rp-btn primary small" disabled={!valid||busy}>Guardar cambios</button>
     <button type="button" className="rp-btn outline small" disabled={busy} onClick={onClose}>Cancelar</button>
     <button type="button" className="rp-btn quiet small" disabled={busy} onClick={()=>void remove()}>Eliminar</button>
    </div>
   </form>
   <div className="rp-menu-photo">
    <span className="rp-menu-edit-label">Fotografía del producto</span>
    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={'Foto para '+item.name}
     onChange={e=>setPhoto(e.target.files?.[0]??null)}/>
    <button type="button" className="rp-btn outline small" disabled={!photo||busy}
     onClick={()=>void upload()}>Subir foto</button>
    <small className="rp-muted">Formato JPG, PNG o WEBP · hasta 5 MB.</small>
   </div>
  </div>}
 </article>;
}
