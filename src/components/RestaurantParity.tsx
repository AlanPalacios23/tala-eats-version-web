import {useCallback,useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {
 ArrowRight,AlertTriangle,CheckCircle2,ChefHat,ClipboardList,Clock3,
 CreditCard,MapPin,PackageCheck,Settings2,ShieldCheck,
 ShoppingBag,Store,Users,Wallet
} from 'lucide-react';
import {api,pesos,safeImage} from '../lib/api';
import type {MerchantFinance} from '../lib/api';
import {nextMerchantState} from '../lib/restaurant-state';
import {kitchenOrders,orderElapsedLabel,kitchenOrderTypeLabel} from '../lib/merchant-kitchen';
import type {KitchenOrderFilter} from '../lib/merchant-kitchen';
import type {MerchantConnectStatus,MerchantTab} from '../lib/restaurant-state';
import type {Order,Restaurant} from '../lib/types';
import '../styles/restaurant-parity.css';

type MerchantAction=(fn:()=>Promise<unknown>,message:string)=>Promise<boolean>;
type Stats={orders:number;delivered:number;gross_sales:number;inventory_low:number};
export type MerchantExperienceProps={
 restaurant:Restaurant;orders:Order[];stats:Stats|null;finance:MerchantFinance|null;
 connect:MerchantConnectStatus|null;busy:boolean;run:MerchantAction;
 go:(tab:MerchantTab)=>void;
};
function CardTitle({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
 return <div className="rm-title"><span className="rp-eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>;
}
export function MerchantOverview({restaurant,orders,stats,busy,run,go}:MerchantExperienceProps){
 const live=orders.filter(o=>!['cancelled','delivered'].includes(o.status));
 const incoming=live.filter(o=>o.status==='received');
 const ready=live.filter(o=>o.status==='ready');
 const lowStock=(restaurant.menu_items??[]).filter(i=>i.is_available&&i.stock>0&&i.stock<10);
 const soldOut=(restaurant.menu_items??[]).filter(i=>i.stock===0||!i.is_available);
 const notPaid=live.filter(i=>i.payment_method==='stripe'&&i.payment_status!=='paid');
 const attention=[
  {label:'Pedidos nuevos',count:incoming.length,detail:'Por aceptar y preparar',tab:'pedidos' as MerchantTab},
  {label:'Pedidos listos',count:ready.length,detail:'Esperando recogida o despacho autorizado',tab:'pedidos' as MerchantTab},
  {label:'Stock bajo',count:lowStock.length,detail:'Productos con menos de 10 unidades',tab:'menu' as MerchantTab},
  {label:'Productos agotados o pausados',count:soldOut.length,detail:'Revisar disponibilidad del menú',tab:'menu' as MerchantTab},
 ];
 return <div className="rm-experience">
  <section className="rm-mobile-home" aria-label="Inicio rápido del restaurante">
   <div className="rm-mobile-home-header">
    <div><span>HOY EN TU NEGOCIO</span><h2>Inicio</h2></div>
    <span className={'rm-mobile-business-status '+(restaurant.is_open?'open':'')}>{restaurant.is_open?'Abierto':'Cerrado'}</span>
   </div>
   <button className="rm-mobile-primary-task" onClick={()=>go('pedidos')}>
    <span><small>Pedidos nuevos</small><strong>{incoming.length}</strong><em>{incoming.length?'Por aceptar':'Todo al día'}</em></span>
    <ArrowRight size={22}/>
   </button>
   <div className="rm-mobile-tasks">
    <button onClick={()=>go('cocina')}><ChefHat size={19}/><span><b>{live.filter(o=>o.status==='confirmed'||o.status==='preparing').length}</b><small>En cocina</small></span><ArrowRight size={16}/></button>
    <button onClick={()=>go('pedidos')}><PackageCheck size={19}/><span><b>{ready.length}</b><small>Listos</small></span><ArrowRight size={16}/></button>
   </div>
   {notPaid.length>0&&<p className="rm-mobile-payment-warning"><AlertTriangle size={17}/>{notPaid.length} pago(s) pendientes de verificar. No preparar.</p>}
   {lowStock.length>0&&<button className="rm-mobile-stock" onClick={()=>go('menu')}>Stock bajo · {lowStock.length} producto(s)<ArrowRight size={17}/></button>}
   <button className="rm-mobile-open-toggle" disabled={busy}
    onClick={()=>{if(restaurant.is_open&&!window.confirm('¿Pausar nuevos pedidos?'))return;
      void run(()=>api.ownerUpdateRestaurant({is_open:!restaurant.is_open}),
        restaurant.is_open?'Restaurante cerrado.':'Restaurante abierto según el backend.');}}>
    <span>{restaurant.is_open?'Pausar nuevos pedidos':'Abrir restaurante'}</span><ArrowRight size={18}/>
   </button>
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
export function MerchantKitchen({orders,busy,run,go}:MerchantExperienceProps){
 const lanes=[{id:'received',label:'Por aceptar'},{id:'confirmed',label:'Confirmados'},{id:'preparing',label:'En preparación'},{id:'ready',label:'Listos'}] as const;
 const [expanded,setExpanded]=useState(true);
 const [mode,setMode]=useState<KitchenOrderFilter>('all');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{
  // Clock is for elapsed time since the server placed an order; never an ETA.
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')setNow(Date.now());},30000);
  return()=>window.clearInterval(interval);
 },[]);
 const allActive=kitchenOrders(orders);
 const visible=kitchenOrders(orders,mode);
 const filters=([
  {id:'all',label:'Todas',count:allActive.length},
  {id:'pickup',label:'Recoger en tienda',count:allActive.filter(o=>o.order_type==='pickup').length},
  {id:'delivery',label:'A domicilio',count:allActive.filter(o=>o.order_type==='delivery').length}
 ] as const);
 return <div className="rm-experience rm-kitchen">
  <div className="rm-heading-row">
   <CardTitle eyebrow="MODO COCINA · KDS" title="Comandas en preparación"
    description="Vista priorizada por hora de creación, con pedidos y pagos confirmados por el servidor."/>
   <button type="button" className="rp-btn outline small" onClick={()=>setExpanded(p=>!p)}
    aria-pressed={!expanded}>{expanded?'Vista compacta':'Vista ampliada'}</button>
  </div>
  <section className="rm-kitchen-toolbar" aria-label="Filtrar comandas por modalidad">
   <div className="rm-kitchen-filter-pills">{filters.map(filter=><button type="button" key={filter.id}
    aria-pressed={mode===filter.id} className={mode===filter.id?'selected':''}
    onClick={()=>setMode(filter.id)}>{filter.label}<b>{filter.count}</b></button>)}</div>
   <span><Clock3 size={16}/> {visible.length} comandas · Actualización automática cada 20 s cuando esta vista está abierta</span>
  </section>
  {allActive.length===0&&<div className="rm-kitchen-empty-state">
   <PackageCheck size={36}/><h3>Todo al día en cocina</h3>
   <p>Cuando llegue un pedido autorizado aparecerá aquí sin tener que recargar la aplicación.</p>
  </div>}
  {allActive.length>0&&visible.length===0&&<div className="rm-kitchen-empty-state">
   <PackageCheck size={32}/><h3>Sin comandas en esta modalidad</h3>
   <p>Prueba la pestaña Todas para revisar el resto de tus pedidos.</p>
  </div>}
  {visible.length>0&&<div className={'rm-kitchen-grid '+(expanded?'':'compact')}>{lanes.map(lane=>{
    const list=visible.filter(o=>o.status===lane.id);
    return <section className={'rm-kitchen-lane '+(list.length===0?'rm-kitchen-lane-empty':'')} key={lane.id} aria-label={lane.label}>
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
        {o.payment_method==='cash'?'Efectivo · confirmar al recoger':paymentPending?'Tarjeta · pendiente de conciliación':'Tarjeta · pago confirmado'}
       </span>
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
export function MerchantMore({restaurant,connect,finance,busy,run,go}:MerchantExperienceProps){
 const [name,setName]=useState(restaurant.name),[description,setDescription]=useState(restaurant.description??'');
 const [cuisine,setCuisine]=useState(restaurant.cuisine??''),[eta,setEta]=useState(restaurant.eta_min??30);
 const [address,setAddress]=useState(restaurant.address??'');
 const [lat,setLat]=useState(restaurant.lat==null?'':String(restaurant.lat)),[lng,setLng]=useState(restaurant.lng==null?'':String(restaurant.lng));
 const [locationError,setLocationError]=useState('');
 const [cover,setCover]=useState<File|null>(null),[uploadBusy,setUploadBusy]=useState(false);
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
  e.preventDefault();if(name.trim().length<2||address.trim().length>0&&address.trim().length<5)return;
  const hasLat=lat.trim()!=='';const hasLng=lng.trim()!=='';
  const latitude=Number(lat),longitude=Number(lng);
  if(hasLat!==hasLng||hasLat&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -90||latitude>90||longitude< -180||longitude>180)){
   setLocationError('Escribe una latitud y longitud válidas, juntas.');return;
  }
  const locationChanged=lat!==(restaurant.lat==null?'':String(restaurant.lat))||lng!==(restaurant.lng==null?'':String(restaurant.lng));
  if(locationChanged&&hasLat&&!window.confirm('¿Confirmas que este punto GPS corresponde exactamente a la puerta del restaurante? Afectará las futuras cotizaciones de domicilio cuando estén habilitadas.'))return;
  const updated={name:name.trim(),description:description.trim(),cuisine:cuisine.trim(),eta_min:eta,...(address.trim()?{address:address.trim()}:{})};
  await run(()=>api.ownerUpdateRestaurant({...updated,...(locationChanged&&hasLat?{lat:latitude,lng:longitude}:{})}),'Perfil actualizado desde el backend.');
 }
 async function uploadCover(){
  if(!cover||busy||uploadBusy)return;
  setUploadBusy(true);
  try{const ok=await run(()=>api.ownerUploadCover(cover),'Foto de portada publicada por el backend.');
   if(ok)setCover(null);
  }finally{setUploadBusy(false);}
 }
 return <div className="rm-experience">
  <div className="rm-heading-row"><CardTitle eyebrow="CONFIGURACIÓN DEL COMERCIO" title="Más y ajustes" description="Actualiza la información del negocio, organiza a tu equipo y revisa tu cuenta."/>
   <button className="rp-btn outline small" onClick={()=>go('activacion')}><ShieldCheck size={16}/> Ver activación</button></div>
  <div className="rm-mobile-more-shortcuts">
   <button type="button" onClick={()=>go('finanzas')}><Wallet size={21}/><span><strong>Wallet</strong><small>Ganancias y retiros</small></span><ArrowRight size={18}/></button>
   <button type="button" onClick={()=>go('activacion')}><ShieldCheck size={21}/><span><strong>Activación</strong><small>Verificación del comercio</small></span><ArrowRight size={18}/></button>
  </div>
  <div className="rm-duo rm-more-duo">
   <section className="rp-panel-card"><h3><Store size={19}/> Perfil del restaurante</h3>
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
     <input aria-label="Foto de portada" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setCover(e.target.files?.[0]??null)}/>
     <button className="rp-btn outline small" disabled={!cover||busy||uploadBusy} onClick={()=>void uploadCover()}>Publicar portada</button>
    </div>
   </section>
   <div className="rm-more-column">
    <section className="rp-panel-card"><h3><Settings2 size={19}/> Preparación y entrega</h3>
     <div className="rp-setting"><div><strong>Recibir nuevos pedidos</strong><small>{restaurant.is_open?'Abierto':'Cerrado'}</small></div><button className="rp-btn outline small" disabled={busy} onClick={()=>{if(restaurant.is_open&&!window.confirm('¿Pausar pedidos nuevos?'))return;void run(()=>api.ownerUpdateRestaurant({is_open:!restaurant.is_open}),'Disponibilidad actualizada.');}}>{restaurant.is_open?'Pausar':'Abrir'}</button></div>
     <div className="rp-setting"><div><strong>Recoger en tienda</strong><small>{restaurant.pickup_enabled?'Activo':'Inactivo'}</small></div><button className="rp-btn outline small" disabled={busy} onClick={()=>void run(()=>api.ownerUpdateRestaurant({pickup_enabled:!restaurant.pickup_enabled}),'Recogida actualizada.')}>{restaurant.pickup_enabled?'Desactivar':'Activar'}</button></div>
     <p className="rp-legal">El reparto a domicilio LIVE requiere un flujo de conductor certificado por separado.</p>
    </section>
    <section className="rp-panel-card"><h3><Wallet size={19}/> Retiros y cuenta bancaria</h3>
     <p className="rp-muted">Saldo contable del comercio: {finance?pesos(finance.net_payable):'No disponible'}. No representa un saldo bancario disponible para retirar.</p>
     <div className="rm-connect-status">{connect?.owner_approved?<><CheckCircle2 size={18}/> Cuenta Connect reconocida por el titular.</>:<><AlertTriangle size={18}/> Falta confirmación de la cuenta Connect.</>}</div>
     <button className="rp-btn outline" onClick={()=>go('finanzas')}><Wallet size={17}/> Abrir Wallet <ArrowRight size={16}/></button>
     <p className="rp-legal">No se solicitan retiros ni transferencias automáticas desde esta vista hasta que estén habilitados y conciliados por el backend LIVE.</p>
    </section>
   </div>
  </div>
  <MerchantTeam restaurantId={restaurant.id} busy={busy} run={run}/>
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
