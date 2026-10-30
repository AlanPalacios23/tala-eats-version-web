import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {
 ArrowLeft,ArrowRight,AlertTriangle,ChefHat,ClipboardList,Clock3,
 MapPin,PackageCheck,RefreshCw,Settings2,Wallet,Edit3,ChevronRight,Info,X,ShieldCheck,
 ShoppingBag,Store,Users
} from 'lucide-react';
import {api,pesos,safeImage} from '../lib/api';
import {DriverIdentity} from './DriverIdentity';
import type {MerchantFinance} from '../lib/api';
import {nextMerchantState} from '../lib/restaurant-state';
import {kitchenOrders,orderElapsedLabel,kitchenOrderTypeLabel} from '../lib/merchant-kitchen';
import type {MerchantConnectStatus,MerchantTab} from '../lib/restaurant-state';
import type {Order,Restaurant} from '../lib/types';
import '../styles/restaurant-parity.css';

type MerchantAction=(fn:()=>Promise<unknown>,message:string)=>Promise<boolean>;
type Stats={orders:number;delivered:number;gross_sales:number;inventory_low:number};
export type MerchantExperienceProps={
 restaurant:Restaurant;orders:Order[];stats:Stats|null;finance:MerchantFinance|null;
 connect:MerchantConnectStatus|null;busy:boolean;run:MerchantAction;
 go:(tab:MerchantTab)=>void;
 onSignOut?:()=>Promise<void>;
 onRefresh?:()=>Promise<boolean>;
 accountName?:string;accountEmail?:string;accountTwoFactorEnabled?:boolean;
};
function CardTitle({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
 return <div className="rm-title"><span className="rp-eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>;
}
export function MerchantOverview({restaurant,orders,stats,busy,run,go}:MerchantExperienceProps){
 const live=orders.filter(o=>!['cancelled','delivered'].includes(o.status));
 const incoming=live.filter(o=>o.status==='received');
 const ready=live.filter(o=>o.status==='ready');
 const lowStock=(restaurant.menu_items??[]).filter(i=>i.is_available&&i.stock>0&&i.stock<=10);
 const soldOut=(restaurant.menu_items??[]).filter(i=>i.stock===0||!i.is_available);
 const notPaid=live.filter(i=>i.payment_method==='stripe'&&i.payment_status!=='paid');
 const attention=[
  {label:'Pedidos nuevos',count:incoming.length,detail:'Por aceptar y preparar',tab:'pedidos' as MerchantTab},
  {label:'Pedidos listos',count:ready.length,detail:'Esperando recogida o despacho autorizado',tab:'pedidos' as MerchantTab},
  {label:'Stock bajo',count:lowStock.length,detail:'Productos con menos de 10 unidades',tab:'menu' as MerchantTab},
  {label:'Productos agotados o pausados',count:soldOut.length,detail:'Revisar disponibilidad del menú',tab:'menu' as MerchantTab},
 ];
 return <div className="rm-experience">
  <section className="rm-mobile-home flutter-home" aria-label="Inicio rápido del restaurante">
   <header className="flutter-store-heading"><div className="flutter-store-thumb">{safeImage(restaurant.cover_image_url)?
    <img src={safeImage(restaurant.cover_image_url)??undefined} alt="" loading="lazy"/>:<Store size={24}/>}</div>
    <div><span>Tu negocio</span><h2>{restaurant.name}</h2></div></header>
   <section className={'flutter-open-card '+(restaurant.is_open?'is-open':'')} aria-label="Estado del restaurante">
    <span className="flutter-open-dot" aria-hidden="true"/>
    <div><strong>{restaurant.is_open?'Abierto':'Cerrado'}</strong>
     <small>{restaurant.is_open?'Recibiendo pedidos':'Pedidos nuevos en pausa'}</small></div>
    <label className="flutter-switch"><input type="checkbox" checked={restaurant.is_open} disabled={busy}
     aria-label="Recibir pedidos nuevos" onChange={event=>{
      if(!event.target.checked&&!window.confirm('¿Pausar pedidos? Los pedidos activos no se afectan.'))return;
      void run(()=>api.ownerUpdateRestaurant({is_open:event.target.checked}),
       event.target.checked?'Restaurante abierto.':'Pedidos pausados.');
     }}/><span aria-hidden="true"/></label>
   </section>
   <h3 className="flutter-section-heading">Requiere atención</h3>
   <section className="flutter-attention" aria-label="Pendientes de atención">
    {incoming.length===0&&ready.length===0&&lowStock.length===0&&soldOut.length===0?
     <p className="flutter-all-clear">Todo al día</p>:<>
     {incoming.length>0&&<button type="button" onClick={()=>go('pedidos')}><span>Pedidos nuevos</span><b>{incoming.length}</b><ArrowRight size={17}/></button>}
     {ready.length>0&&<button type="button" onClick={()=>go('pedidos')}><span>Pedidos listos</span><b>{ready.length}</b><ArrowRight size={17}/></button>}
     {lowStock.length>0&&<button type="button" onClick={()=>go('menu')}><span>Stock bajo</span><b>{lowStock.length}</b><ArrowRight size={17}/></button>}
     {soldOut.length>0&&<button type="button" onClick={()=>go('menu')}><span>Agotados o pausados</span><b>{soldOut.length}</b><ArrowRight size={17}/></button>}
    </>}
   </section>
   {notPaid.length>0&&<p className="rm-mobile-payment-warning" role="status"><AlertTriangle size={16}/>{notPaid.length} pago(s) sin conciliar; no preparar.</p>}
   <button type="button" className="flutter-kitchen-entry" onClick={()=>go('cocina')}>
    <span className="flutter-kitchen-symbol"><ChefHat size={23}/></span>
    <span className="flutter-kitchen-copy"><strong>Modo cocina</strong>
     <small>{incoming.length} nuevos · {live.filter(o=>o.status==='confirmed'||o.status==='preparing').length} en preparación · {ready.length} listos</small></span>
    <ArrowRight size={19}/>
   </button>
   <div className="flutter-section-row"><h3 className="flutter-section-heading">En curso</h3>
    {live.length>0&&<button type="button" onClick={()=>go('pedidos')}>Ver pedidos</button>}</div>
   <div className="flutter-current-orders">
    {live.length===0?<p>No hay pedidos en curso</p>:live.slice(0,5).map(o=>
     <button key={o.id} type="button" onClick={()=>go('pedidos')}>
      <span><b>#{o.id}</b><small>{o.items?.map(i=>i.name_snapshot).slice(0,2).join(', ')||'Pedido'}</small></span>
      <strong>{pesos(o.total)}</strong></button>)}
   </div>
   <h3 className="flutter-section-heading">Resumen</h3>
   <div className="flutter-summary"><div><span>Pedidos activos</span><strong>{live.length}</strong></div>
    <div><span>Entregados registrados</span><strong>{stats?.delivered??'—'}</strong></div></div>
  </section>
  <div className="rm-desktop-home">
  <div className="rm-heading-row"><CardTitle eyebrow="CENTRO DE OPERACIONES" title="Así va tu restaurante" description="Estado real del comercio y los pedidos recuperados del servidor."/>
   <span className={'rp-open-badge '+(restaurant.is_open?'open':'closed')}><span/>{restaurant.is_open?'Abierto':'Cerrado'}</span>
  </div>
  <div className="rm-metrics">
   <div><span>Pedidos activos</span><strong>{live.length}</strong><small>Sin incluir completados</small></div>
   <div><span>Pedidos nuevos</span><strong>{incoming.length}</strong><small>Esperando aceptación</small></div>
   <div><span>Entregados</span><strong>{stats?.delivered??'—'}</strong><small>Dato del backend</small></div>
   <div><span>Stock bajo</span><strong>{stats?.inventory_low??lowStock.length}</strong><small>Revisar existencias</small></div>
  </div>
  <section className="rm-status-card">
   <div><Store size={26}/><div><h3>{restaurant.is_open?'Estás recibiendo pedidos autorizados':'Tu negocio está cerrado'}</h3>
    <p>{restaurant.is_open?'La disponibilidad sigue condicionada por la verificación y los pagos del servidor.':'Activa tu negocio cuando tu cuenta y la operación estén preparadas.'}</p>
   </div></div>
   <button disabled={busy} className="rp-btn outline" onClick={()=>{if(restaurant.is_open&&!window.confirm('¿Pausar nuevos pedidos?'))return;void run(()=>api.ownerUpdateRestaurant({is_open:!restaurant.is_open}),restaurant.is_open?'Restaurante cerrado.':'Restaurante abierto según el backend.');}}>{restaurant.is_open?'Pausar pedidos':'Abrir restaurante'}</button>
  </section>
  {notPaid.length>0&&<div className="rm-alert"><AlertTriangle size={18}/> Hay {notPaid.length} pedidos con tarjeta aún sin conciliación. No pueden prepararse ni cobrarse nuevamente desde este panel.</div>}
  <div className="rm-duo">
   <section className="rp-panel-card"><h3>Requieren tu atención</h3><div className="rm-attention">
    {attention.map(item=><button key={item.label} onClick={()=>go(item.tab)}>
     <div><strong>{item.label}</strong><small>{item.detail}</small></div><b>{item.count}</b><ArrowRight size={15}/></button>)}
   </div></section>
   <section className="rp-panel-card"><h3>Accesos rápidos</h3><div className="rm-quick">
    <button onClick={()=>go('cocina')}><ChefHat size={20}/><span>Modo cocina</span><ArrowRight size={16}/></button>
    <button onClick={()=>go('pedidos')}><ShoppingBag size={20}/><span>Gestionar pedidos</span><ArrowRight size={16}/></button>
    <button onClick={()=>go('menu')}><ClipboardList size={20}/><span>Actualizar menú</span><ArrowRight size={16}/></button>
    <button onClick={()=>go('mas')}><Settings2 size={20}/><span>Configuración</span><ArrowRight size={16}/></button>
   </div></section>
  </div>
  </div>
 </div>;
}
export function MerchantKitchen({orders,busy,run,go,onRefresh}:MerchantExperienceProps){
 // Flutter v0.7.6: three KDS lanes. Confirmed and preparing are the same
 // operational column; on narrow screens only the selected column is visible.
 const lanes=[
  {id:'received',label:'Nuevos',states:['received']},
  {id:'kitchen',label:'Preparando',states:['confirmed','preparing']},
  {id:'ready',label:'Listos',states:['ready']}
 ] as const;
 type LaneId=(typeof lanes)[number]['id'];
 const [selectedLane,setSelectedLane]=useState<LaneId>('received');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{
  const tick=()=>{if(document.visibilityState==='visible')setNow(Date.now());};
  const interval=window.setInterval(tick,30000);
  document.addEventListener('visibilitychange',tick);
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',tick);};
 },[]);
 const allActive=kitchenOrders(orders);
 const inProgress=allActive.filter(o=>o.status==='confirmed'||o.status==='preparing');
 const oldest=inProgress.reduce<Order|null>((prev,o)=>{
  const t=Date.parse(o.created_at);
  return Number.isFinite(t)&&(!prev||t<Date.parse(prev.created_at))?o:prev;
 },null);
 const subtitle=oldest?'Más antiguo en cocina: '+orderElapsedLabel(oldest.created_at,now):'Sin pedidos en preparación';
 const timeLabel=new Date(now).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'});
 return <div className="rm-experience rm-kitchen">
  <header className="flutter-kds-header">
   <button type="button" onClick={()=>go('inicio')} aria-label="Volver a Inicio"><ArrowLeft size={20}/></button>
   <div className="flutter-kds-title"><h2>Cocina</h2><small>{subtitle}</small></div>
   <time className="flutter-kds-clock" aria-label={'Hora actual '+timeLabel}>{timeLabel}</time>
   <button type="button" className="flutter-kds-refresh" aria-label="Actualizar Cocina"
    disabled={busy||!onRefresh} onClick={()=>void onRefresh?.()}><RefreshCw size={20}/></button>
  </header>
  <nav className="flutter-kds-lane-tabs" aria-label="Carriles de Cocina">
   {lanes.map(lane=>{
    const count=allActive.filter(o=>(lane.states as readonly string[]).includes(o.status)).length;
    return <button key={lane.id} type="button" className={selectedLane===lane.id?'selected':''}
     aria-pressed={selectedLane===lane.id} onClick={()=>setSelectedLane(lane.id)}>
     <span className={'rm-lane-dot '+lane.id}/><span>{lane.label}</span><b>{count}</b>
    </button>;
   })}
  </nav>
  {allActive.length===0&&<div className="rm-kitchen-empty-state">
   <PackageCheck size={36}/><h3>Todo al día en cocina</h3>
   <p>Cuando llegue un pedido autorizado aparecerá aquí sin tener que recargar la aplicación.</p>
  </div>}
  {allActive.length>0&&<div className="rm-kitchen-grid">{lanes.map(lane=>{
    const list=allActive.filter(o=>(lane.states as readonly string[]).includes(o.status));
    return <section className={'rm-kitchen-lane '+(selectedLane===lane.id?'is-selected ':'')+
     (list.length===0?'rm-kitchen-lane-empty':'')} key={lane.id}
     data-kds-lane={lane.id} aria-label={lane.label}>
     <header><span className={'rm-lane-dot '+lane.id}/><strong>{lane.label}</strong><b>{list.length}</b></header>
     {list.length===0?<div className="rm-kitchen-empty"><PackageCheck size={25}/> Sin comandas</div>:list.map(o=>{
      const next=nextMerchantState(o);
      const paymentPending=o.payment_method==='stripe'&&o.payment_status!=='paid';
      return <article className="rm-ticket" key={o.id}>
       <div className="rm-ticket-top">
        <strong>Pedido #{o.id}</strong>
        <span className="rm-ticket-elapsed" title="Tiempo transcurrido desde la creación del pedido"><Clock3 size={13}/>{orderElapsedLabel(o.created_at,now)}</span>
       </div>
       <div className="rm-ticket-meta">
        <span className={'rm-ticket-type '+(o.order_type==='pickup'?'pickup':'')}>{kitchenOrderTypeLabel(o.order_type)}</span>
        <b>{pesos(o.total)}</b>
       </div>
       <div className="rm-ticket-items">{(o.items??[]).map((i,n)=><p key={n}><strong>{i.quantity}×</strong> {i.name_snapshot}</p>)}</div>
       <span className={'rm-payment-indicator '+(paymentPending?'pending':'')}>
        {o.payment_method==='cash'?
          (o.order_type==='pickup'?'Efectivo · cobrar al recoger':'Efectivo · cobro en entrega'):
          paymentPending?'Tarjeta · pendiente de conciliación':'Tarjeta · pago confirmado'}
       </span>
       <DriverIdentity order={o}/>
       {paymentPending&&<div className="rm-ticket-warning"><AlertTriangle size={15}/> Sin pago conciliado. No preparar ni volver a cobrar.</div>}
       {next&&<button disabled={busy} className="rp-btn primary small"
        onClick={()=>void run(()=>api.ownerUpdateStatus(o.id,next),'Pedido #'+o.id+' actualizado en el servidor.')}>
        {next==='confirmed'?'Aceptar pedido':next==='preparing'?'Iniciar preparación':'Marcar listo'} <ArrowRight size={15}/></button>}
       {lane.id==='ready'&&o.order_type==='pickup'&&<button className="rp-btn outline small" onClick={()=>go('pedidos')}>
        Confirmar recogida con PIN <ArrowRight size={15}/></button>}
       {lane.id==='ready'&&o.order_type==='delivery'&&<span className="rm-kitchen-delivery-note">Esperando reparto autorizado. No confirmar la entrega desde cocina.</span>}
       {lane.id==='ready'&&o.order_type!=='pickup'&&o.order_type!=='delivery'&&<span className="rm-kitchen-delivery-note">Modalidad pendiente de confirmar en el servidor.</span>}
      </article>;
     })}</section>;
   })}</div>}
  <p className="rm-kitchen-footnote">Los tiempos indican antigüedad, no un plazo prometido de entrega. Los cobros, PIN y asignación de repartidor se validan fuera de este tablero por el backend LIVE.</p>
 </div>;
}
type Staff={id:number;user_id:number;name:string;email:string;role:'manager'|'cashier'|'kitchen'|'owner'|string};
function MerchantTeam({restaurantId,busy,run}: {restaurantId:number;busy:boolean;run:MerchantAction}){
 const [employees,setEmployees]=useState<Staff[]|null>(null),[error,setError]=useState('');
 const [email,setEmail]=useState(''),[role,setRole]=useState<'manager'|'cashier'|'kitchen'>('cashier');
 const refresh=useCallback(async()=>{try{setEmployees(await api.ownerEmployees());setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar el equipo.');}},[restaurantId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function add(event:FormEvent){event.preventDefault();if(busy)return;
   if(!window.confirm('Asociar '+email.trim()+' como '+role+' al restaurante actual? Esta persona debe tener una cuenta existente.'))return;
   const ok=await run(()=>api.ownerInviteEmployee(email.trim(),role),'Miembro actualizado en el servidor.');
   if(ok){setEmail('');await refresh();}
 }
 return <section className="rp-panel-card" aria-labelledby="rm-team-title"><h3 id="rm-team-title"><Users size={19}/> Equipo y permisos</h3>
  <p className="rp-muted">Agrega solo usuarios que ya tienen cuenta en Tala Eats. El backend valida los permisos de administración.</p>
  {error&&<p className="rm-error" role="alert">{error}</p>}
  <div className="rm-team-list">{employees===null?'Consultando integrantes…':employees.length===0?'Sin empleados asociados.':employees.map(m=><div key={m.id}><span><strong>{m.name}</strong><small>{m.email}</small></span><b>{m.role}</b></div>)}</div>
  <form onSubmit={e=>void add(e)} className="rm-team-form">
   <label>Correo de la persona<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="persona@correo.com"/></label>
   <label>Permiso<select value={role} onChange={e=>setRole(e.target.value as 'manager'|'cashier'|'kitchen')}><option value="cashier">Caja</option><option value="kitchen">Cocina</option><option value="manager">Gerencia</option></select></label>
   <button className="rp-btn primary" disabled={busy||!email.includes('@')}>Agregar empleado</button>
  </form>
 </section>;
}
export function MerchantMore({restaurant,connect,busy,run,go,onSignOut,accountName,accountEmail,accountTwoFactorEnabled}:MerchantExperienceProps){
 const profileRef=useRef<HTMLDetailsElement>(null),teamRef=useRef<HTMLDetailsElement>(null);
 const openSection=(ref:{current:HTMLDetailsElement|null})=>{
  if(!ref.current)return;
  ref.current.open=true;ref.current.scrollIntoView({behavior:'smooth',block:'start'});
 };
 const [name,setName]=useState(restaurant.name),[description,setDescription]=useState(restaurant.description??'');
 const [cuisine,setCuisine]=useState(restaurant.cuisine??''),[eta,setEta]=useState(restaurant.eta_min??30);
 const [address,setAddress]=useState(restaurant.address??'');
 const [lat,setLat]=useState(restaurant.lat==null?'':String(restaurant.lat)),[lng,setLng]=useState(restaurant.lng==null?'':String(restaurant.lng));
 const [locationError,setLocationError]=useState('');
 const [cover,setCover]=useState<File|null>(null),[uploadBusy,setUploadBusy]=useState(false);
 const coverInput=useRef<HTMLInputElement>(null);
 const [aboutOpen,setAboutOpen]=useState(false);
 const aboutRef=useRef<HTMLElement>(null),aboutTrigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!aboutOpen)return;
  const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  aboutRef.current?.querySelector<HTMLButtonElement>('.rm-about-close')?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setAboutOpen(false);return;}
   if(event.key!=='Tab')return;
   const buttons=Array.from(aboutRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
   const first=buttons[0],last=buttons[buttons.length-1];
   if(!first||!last)return;
   if(!aboutRef.current?.contains(document.activeElement)){event.preventDefault();first.focus();}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{
   document.removeEventListener('keydown',onKey);
   document.body.style.overflow=previousOverflow;
   const target=aboutTrigger.current?.isConnected?aboutTrigger.current:before;
   if(target?.isConnected)target.focus({preventScroll:true});
  };
 },[aboutOpen]);
 useEffect(()=>{setName(restaurant.name);setDescription(restaurant.description??'');setCuisine(restaurant.cuisine??'');setEta(restaurant.eta_min??30);setAddress(restaurant.address??'');setLat(restaurant.lat==null?'':String(restaurant.lat));setLng(restaurant.lng==null?'':String(restaurant.lng));},[restaurant.id,restaurant.name,restaurant.description,restaurant.cuisine,restaurant.eta_min,restaurant.address,restaurant.lat,restaurant.lng]);
 function captureLocation(){
  setLocationError('');
  if(!navigator.geolocation){setLocationError('Este navegador no permite obtener ubicación. Puedes capturar las coordenadas manualmente.');return;}
  if(!window.confirm('Usa esta función solo si estás físicamente en el negocio. ¿Solicitar ubicación del dispositivo?'))return;
  navigator.geolocation.getCurrentPosition(
   pos=>{setLat(pos.coords.latitude.toFixed(6));setLng(pos.coords.longitude.toFixed(6));setLocationError('Revisa las coordenadas antes de guardarlas en el servidor.');},
   ()=>setLocationError('No fue posible obtener el GPS. Revisa los permisos o captura las coordenadas manualmente.'),
   {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
 }
 async function saveProfile(e:FormEvent){
   e.preventDefault();
   if(name.trim().length<2||!Number.isInteger(eta)||eta<5||eta>180||
    (address.trim().length>0&&address.trim().length<5)){
    setLocationError('Verifica el nombre, la dirección y un tiempo de preparación entre 5 y 180 minutos.');
    return;
   }
   const hasLat=lat.trim()!=='';const hasLng=lng.trim()!=='';
   const latitude=Number(lat),longitude=Number(lng);
   if(hasLat!==hasLng||hasLat&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -90||latitude>90||longitude< -180||longitude>180)){
    setLocationError('Escribe una latitud y longitud válidas, juntas.');return;
   }
   const locationChanged=lat!==(restaurant.lat==null?'':String(restaurant.lat))||
    lng!==(restaurant.lng==null?'':String(restaurant.lng));
   if(locationChanged){
    const warning=hasLat?
     '¿Confirmas que este punto GPS corresponde exactamente a la puerta del restaurante? Afectará futuras cotizaciones de domicilio.':
     '¿Quitar el punto GPS del restaurante? La entrega a domicilio puede quedar suspendida hasta configurar uno nuevo.';
    if(!window.confirm(warning))return;
   }
   const updated={name:name.trim(),description:description.trim(),cuisine:cuisine.trim(),eta_min:eta,
    address:address.trim()};
   const locationPatch=locationChanged?(hasLat?{lat:latitude,lng:longitude}:{lat:null,lng:null}):{};
   const ok=await run(()=>api.ownerUpdateRestaurant({...updated,...locationPatch}),'Perfil actualizado desde el backend.');
   if(ok)setLocationError('');
  }
  async function uploadCover(){
  if(!cover||busy||uploadBusy)return;
  setUploadBusy(true);
  try{const ok=await run(()=>api.ownerUploadCover(cover),'Foto de portada publicada por el backend.');
   if(ok){setCover(null);if(coverInput.current)coverInput.current.value='';}
  }finally{setUploadBusy(false);}
 }
 return <div className="rm-experience">
  <div className="rm-heading-row"><h2>Más</h2></div>
  <section className="rm-flutter-identity" aria-label="Perfil de tu restaurante">
   <div className="rm-flutter-cover">{safeImage(restaurant.cover_image_url)?
    <img src={safeImage(restaurant.cover_image_url)??undefined} alt={'Foto de '+restaurant.name} loading="lazy"/>:
    <Store size={34} aria-hidden="true"/>}</div>
   <div className="rm-flutter-identity-body">
    <div><h3>{restaurant.name}</h3><p>{restaurant.cuisine||'Restaurante'}</p>
     {restaurant.description&&<p className="rm-flutter-description">{restaurant.description}</p>}
     <span className={'rm-flutter-open '+(restaurant.is_open?'open':'')}>{restaurant.is_open?'Abierto':'Cerrado'}</span>
    </div>
    <button type="button" className="rp-btn outline small" onClick={()=>openSection(profileRef)}>
     <Edit3 size={16}/> Editar</button>
   </div>
  </section>
  <div className="rm-flutter-settings" aria-label="Opciones del restaurante">
   <h3>Operación</h3>
   <div className="rm-flutter-settings-group">
    <button type="button" onClick={()=>go('cocina')}><ChefHat size={21}/>
     <span><strong>Modo cocina</strong><small>Comandas en pantalla completa</small></span><ChevronRight size={18}/></button>
    <button type="button" onClick={()=>openSection(profileRef)}><MapPin size={21}/>
     <span><strong>Ubicación del establecimiento</strong><small>Dirección y punto GPS para calcular envíos</small></span><ChevronRight size={18}/></button>
    <div className="rm-flutter-switch-row"><PackageCheck size={21}/>
     <span><strong>Recoger en tienda</strong><small>{restaurant.pickup_enabled?'Activo':'Inactivo'}</small></span>
     <button type="button" className="rp-btn outline small" disabled={busy}
      onClick={()=>void run(()=>api.ownerUpdateRestaurant({pickup_enabled:!restaurant.pickup_enabled}),'Recogida actualizada.')}>
      {restaurant.pickup_enabled?'Desactivar':'Activar'}</button></div>
    <button type="button" onClick={()=>openSection(profileRef)}><Settings2 size={21}/>
     <span><strong>Preparación y entrega</strong><small>{restaurant.eta_min??30} min de preparación · envío calculado por Tala Eats</small></span><ChevronRight size={18}/></button>
   </div>
   <h3>Pagos</h3>
   <div className="rm-flutter-settings-group">
    <button type="button" onClick={()=>go('finanzas')}><Wallet size={21}/>
     <span><strong>Retiros y cuenta bancaria</strong><small>Wallet, ganancias y movimientos</small></span><ChevronRight size={18}/></button>
    <button type="button" onClick={()=>go('activacion')}><RefreshCw size={21}/>
     <span><strong>Activación de pagos</strong><small>{connect?.owner_approved?'Consultar Stripe Connect':'Requisitos pendientes'}</small></span><ChevronRight size={18}/></button>
   </div>
   <h3>Equipo</h3>
   <div className="rm-flutter-settings-group">
    <button type="button" onClick={()=>openSection(teamRef)}><Users size={21}/>
     <span><strong>Equipo y permisos</strong><small>Gerentes, caja y cocina</small></span><ChevronRight size={18}/></button>
   </div>
   <h3>Cuenta</h3>
   <div className="rm-flutter-settings-group rm-flutter-account">
    <div><Users size={20}/><span><strong>{accountName||'Propietario'}</strong>
     <small>{accountEmail||'Cuenta de restaurante'}</small></span></div>
    {accountTwoFactorEnabled&&<div><ShieldCheck size={20}/><span><strong>Verificación en dos pasos</strong>
     <small>Activa en tu cuenta</small></span></div>}
    <button type="button" ref={aboutTrigger} onClick={()=>setAboutOpen(true)}><Info size={20}/><span>
     <strong>Acerca de la app</strong>
     <small>Versión web · Tala Eats Restaurante</small></span><ChevronRight size={18}/></button>
   </div>
  </div>
  <div className="rm-mobile-more-shortcuts">
   <button type="button" aria-label="Abrir Wallet" onClick={()=>go('finanzas')}><span><strong>Wallet</strong></span></button>
   <button type="button" onClick={()=>go('activacion')}><span><strong>Activación</strong>{!connect?.owner_approved&&<small>Pendiente</small>}</span></button>
  </div>
  <div className="rm-duo rm-more-duo">
   <details ref={profileRef} className="rp-panel-card rm-more-profile" data-merchant-accordion="profile">
    <summary><strong>Perfil del negocio</strong><ArrowRight size={16}/></summary>
    <form onSubmit={e=>void saveProfile(e)} className="rm-settings-form">
     <label>Nombre<input value={name} required minLength={2} maxLength={150} onChange={e=>setName(e.target.value)}/></label>
     <label>Tipo de comida<input maxLength={100} value={cuisine} onChange={e=>setCuisine(e.target.value)} placeholder="Mexicana, hamburguesas, tacos…"/></label>
     <label>Descripción<textarea maxLength={1000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
     <label>Tiempo estimado de preparación (min)<input type="number" min={5} max={180} step={1} value={eta} onChange={e=>setEta(Number(e.target.value))}/></label>
     <label>Dirección del establecimiento<input maxLength={300} value={address} onChange={e=>setAddress(e.target.value)}/></label>
     <div className="rm-location-fields">
      <label>Latitud<input type="number" step="any" min={-90} max={90} placeholder="20.65" value={lat} onChange={e=>setLat(e.target.value)}/></label>
      <label>Longitud<input type="number" step="any" min={-180} max={180} placeholder="-103.70" value={lng} onChange={e=>setLng(e.target.value)}/></label>
     </div>
     <button type="button" className="rp-btn outline small" onClick={captureLocation}><MapPin size={17}/> Usar ubicación del dispositivo</button>
     {locationError&&<p className="rp-legal" role="status">{locationError}</p>}
     <p className="rp-legal"><MapPin size={15}/> Verifica el punto físicamente. La dirección no sustituye el GPS; cotizaciones y entregas siguen bajo control del backend.</p>
     <button className="rp-btn primary" disabled={busy||!Number.isInteger(eta)||eta<5||eta>180||name.trim().length<2}>Guardar perfil</button>
    </form>
    <div className="rm-cover-uploader"><strong>Foto de portada</strong>
     {safeImage(restaurant.cover_image_url)&&<img className="rm-cover-preview" src={safeImage(restaurant.cover_image_url)??undefined} alt={'Portada de '+restaurant.name} loading="lazy"/>}
     <p>Sube una foto original del negocio para el catálogo, verificada y almacenada en el backend.</p>
     <input ref={coverInput} aria-label="Foto de portada" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCover(e.target.files?.[0]??null)}/>
     <button className="rp-btn outline small" disabled={!cover||busy||uploadBusy} onClick={()=>void uploadCover()}>Publicar portada</button>
    </div>
   </details>
   <div className="rm-more-column">
    <section className="rp-panel-card"><h3>Operación</h3>
     <div className="rp-setting"><div><strong>Recibir nuevos pedidos</strong><small>{restaurant.is_open?'Abierto':'Cerrado'}</small></div><button className="rp-btn outline small" disabled={busy} onClick={()=>{if(restaurant.is_open&&!window.confirm('¿Pausar pedidos nuevos?'))return;void run(()=>api.ownerUpdateRestaurant({is_open:!restaurant.is_open}),'Disponibilidad actualizada.');}}>{restaurant.is_open?'Pausar':'Abrir'}</button></div>
     <div className="rp-setting"><div><strong>Recoger en tienda</strong><small>{restaurant.pickup_enabled?'Activo':'Inactivo'}</small></div><button className="rp-btn outline small" disabled={busy} onClick={()=>void run(()=>api.ownerUpdateRestaurant({pickup_enabled:!restaurant.pickup_enabled}),'Recogida actualizada.')}>{restaurant.pickup_enabled?'Desactivar':'Activar'}</button></div>
    <details className="rm-technical-note"><summary>Sobre las entregas</summary>
     <p>El reparto a domicilio LIVE requiere un flujo de conductor certificado por separado.</p>
    </details>
     
    </section>
   </div>
  </div>
  <details ref={teamRef} className="rm-team-fold" data-merchant-accordion="team">
   <summary><strong>Equipo</strong><ArrowRight size={16}/></summary>
   <MerchantTeam restaurantId={restaurant.id} busy={busy} run={run}/>
  </details>
  {aboutOpen&&<div className="rm-about-backdrop" onClick={()=>setAboutOpen(false)}>
   <section ref={aboutRef} className="rm-about-sheet" role="dialog" aria-modal="true"
    aria-labelledby="rm-about-title" aria-describedby="rm-about-description"
    onClick={e=>e.stopPropagation()}>
    <button type="button" className="rm-about-close" aria-label="Cerrar información de la aplicación"
     onClick={()=>setAboutOpen(false)}><X size={20}/></button>
    <div className="rm-about-mark"><Store size={34}/></div>
    <h3 id="rm-about-title">Tala Eats Restaurante</h3>
    <p id="rm-about-description">Panel para restaurantes · Versión Web</p>
    <p className="rm-about-detail">La aplicación usa tu cuenta de comercio y las operaciones requieren autorización del servidor.</p>
    <button type="button" className="rp-btn primary" onClick={()=>setAboutOpen(false)}>Entendido</button>
   </section>
  </div>}
  {onSignOut&&<button type="button" className="flutter-signout" disabled={busy}
   onClick={()=>{if(window.confirm('¿Cerrar sesión? Para volver a administrar el negocio necesitarás iniciar sesión.'))void onSignOut();}}>
   Cerrar sesión
  </button>}
 </div>;
}

/** Flutter Finanzas offers Hoy/Semana/Mes. Node /owner/finance is all-time.
 * Show explicitly partial activity (last 200 fetched orders) rather than
 * representing an approximate UI subtotal as an authoritative ledger.
 */
export function MerchantFinanceActivity({orders}:{orders:Order[]}){
 const [period,setPeriod]=useState<'today'|'week'|'month'>('today');
 const tz='America/Mexico_City';
 const localDay=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const today=localDay(new Date());
 const now=Date.now();
 const since=period==='week'?now-7*24*60*60*1000:now-30*24*60*60*1000;
 const sample=orders.filter(o=>{
  if(o.status!=='delivered')return false;
  const timestamp=Date.parse(o.created_at);
  return Number.isFinite(timestamp)&&(period==='today'?localDay(new Date(timestamp))===today:timestamp>=since);
 });
 return <section className="rp-panel-card rm-finance-activity" aria-labelledby="rm-finance-activity-title">
  <div className="rm-heading-row"><div><h3 id="rm-finance-activity-title">Actividad de pedidos consultados</h3><p className="rp-muted">Muestra de hasta 200 pedidos recientes, no es un reporte contable del periodo.</p></div>
   <div className="rp-order-filters" aria-label="Periodo de actividad">
    {([['today','Hoy'],['week','7 días'],['month','30 días']] as const).map(([id,name])=><button key={id} onClick={()=>setPeriod(id)} className={period===id?'selected':''} aria-pressed={period===id}>{name}</button>)}
   </div>
  </div>
  <div className="rm-finance-activity-summary"><span>Entregados encontrados en la muestra</span><strong>{sample.length}</strong></div>
  <div className="rm-team-list">{sample.slice(0,10).map(o=><div key={o.id}>
   <span><strong>Pedido #{o.id}</strong><small>{new Date(o.created_at).toLocaleDateString('es-MX',{timeZone:tz})}</small></span>
   <b>Entregado</b></div>)}
   {sample.length===0&&<p className="rp-muted">No hay pedidos entregados en los registros consultados de este periodo.</p>}
  </div>
  <p className="rp-legal">Los importes oficiales de comisiones, ventas y neto contable se muestran por separado desde /owner/finance. La fecha de pedidos se calcula con zona horaria de Jalisco.</p>
 </section>;
}
