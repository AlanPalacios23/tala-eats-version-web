import {useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {AlertCircle,ArrowRight,Bike,CheckCircle2,ClipboardCopy,CreditCard,LockKeyhole,RefreshCw,ShoppingBag,Store,Wallet} from 'lucide-react';
import {ApiError,request} from '../lib/api';
import {useSession} from '../lib/session';
import './rehearsal.css';

type DemoStatus='new'|'placed'|'accepted'|'preparing'|'ready'|'assigned'|
 'picked_up'|'on_the_way'|'delivered'|'cancelled';
type Action='place'|'accept'|'prepare'|'ready'|'assign'|'pickup'|'depart'|'deliver'|'cancel';
type Money={
 subtotal_minor:number;service_minor:number;shipping_minor:number;
 total_minor:number;merchant_minor:number;driver_minor:number;platform_minor:number;
 merchant_demo_wallet_minor:number;driver_demo_wallet_minor:number;
};
type DemoRoom={
 id:string;adminId:number;customerId:number;restaurantId:number;driverId:number;
 status:DemoStatus;productName:string|null;quantity:number;unitPriceMinor:number;
 paymentMethod:'cash_demo'|'card_demo'|null;
 demo_only:true;payment_charged:false;withdrawable:false;
 delivery_pin?:string;money:Money;
};
const statusLabels:Record<DemoStatus,string>={
 new:'Esperando pedido de ensayo',
 placed:'Pedido recibido',
 accepted:'Restaurante aceptó',
 preparing:'Preparando pedido',
 ready:'Listo para recoger',
 assigned:'Repartidor asignado',
 picked_up:'Pedido recogido',
 on_the_way:'En camino',
 delivered:'Entrega confirmada con PIN',
 cancelled:'Ensayo cancelado',
};
const steps:readonly {when:DemoStatus;actor:'restaurant'|'driver';action:Action;label:string}[]=[
 {when:'placed',actor:'restaurant',action:'accept',label:'Aceptar pedido'},
 {when:'accepted',actor:'restaurant',action:'prepare',label:'Comenzar preparación'},
 {when:'preparing',actor:'restaurant',action:'ready',label:'Marcar como listo'},
 {when:'ready',actor:'driver',action:'assign',label:'Aceptar entrega'},
 {when:'assigned',actor:'driver',action:'pickup',label:'Confirmar recogida'},
 {when:'picked_up',actor:'driver',action:'depart',label:'Salir a entregar'},
];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const money=(cents:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
function errorText(err:unknown){
 if(err instanceof ApiError&&err.status===404)
  return 'No existe este ensayo o ya terminó su vigencia de una hora.';
 if(err instanceof ApiError&&err.status===503)
  return 'El modo ensayo todavía no está habilitado en el backend. No se intentó ningún cobro.';
 return err instanceof Error?err.message:'No se pudo actualizar el ensayo.';
}
export function RehearsalFlow(){
 const session=useSession(),user=session.user;
 const [query,setQuery]=useSearchParams();
 const [roomId,setRoomId]=useState(()=>query.get('session')??'');
 const [room,setRoom]=useState<DemoRoom|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [ids,setIds]=useState({customer:'',restaurant:'',driver:''});
 const [product,setProduct]=useState('Producto de prueba');
 const [price,setPrice]=useState('100.00'),[qty,setQty]=useState(1);
 const [method,setMethod]=useState<'cash_demo'|'card_demo'>('cash_demo');
 const [pin,setPin]=useState('');

 const load=useCallback(async(id:string,quiet=false)=>{
  const candidate=id.trim().toLowerCase();
  if(!uuid.test(candidate)){if(!quiet)setError('Ingresa un ID de ensayo válido.');return;}
  if(!quiet)setLoading(true);
  try{
   const next=await request<DemoRoom>('/demo/sessions/'+encodeURIComponent(candidate));
   if(!next.demo_only||next.payment_charged||next.withdrawable)
    throw new Error('Este servidor no devolvió una sesión de simulación segura.');
   setRoom(next);
   setError('');
  }catch(err){if(!quiet){setRoom(null);setError(errorText(err));}}
  finally{if(!quiet)setLoading(false);}
 },[]);
 useEffect(()=>{const candidate=query.get('session')??'';if(candidate&&uuid.test(candidate))void load(candidate);},[query,load]);
 useEffect(()=>{
  if(!room||['delivered','cancelled'].includes(room.status))return;
  const timer=window.setInterval(()=>{void load(room.id,true);},6500);
  return()=>window.clearInterval(timer);
 },[room?.id,room?.status,load]);

 const actor=room&&user?
  user.id===room.customerId?'customer':
  user.id===room.restaurantId?'restaurant':
  user.id===room.driverId?'driver':
  user.id===room.adminId?'admin':'other':'other';
 const nextStep=steps.find(x=>x.when===room?.status&&x.actor===actor);
 const create=async()=>{
  if(!user||user.role!=='admin')return;
  setBusy(true);setError('');setNotice('');
  try{
   const created=await request<DemoRoom>('/demo/sessions',{
    method:'POST',body:JSON.stringify({
     customer_user_id:Number(ids.customer),
     restaurant_user_id:Number(ids.restaurant),
     driver_user_id:Number(ids.driver),
    }),
   });
   setRoom(created);setRoomId(created.id);setQuery({session:created.id});
   setNotice('Ensayo creado. Comparte únicamente el identificador con los participantes autorizados.');
  }catch(err){setError(errorText(err));}
  finally{setBusy(false);}
 };
 const act=async(action:Action)=>{
  if(!room||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const body:Record<string,unknown>={action};
   if(action==='place'){
    const minor=Math.round(Number(price)*100);
    if(!Number.isSafeInteger(minor)||minor<100||minor>50000||
      !Number.isSafeInteger(qty)||qty<1||qty>10){
     throw new Error('Introduce un precio de ensayo de $1 a $500 y entre 1 y 10 unidades.');
    }
    Object.assign(body,{product_name:product.trim(),unit_price_minor:minor,
     quantity:qty,payment_method:method});
   }
   if(action==='deliver')body.pin=pin.trim();
   const next=await request<DemoRoom>('/demo/sessions/'+room.id+'/action',
    {method:'POST',body:JSON.stringify(body)});
   setRoom(next);
   if(action==='deliver')setPin('');
   setNotice('Estado de ensayo confirmado por el servidor. No se realizó ningún cobro.');
  }catch(err){setError(errorText(err));}
  finally{setBusy(false);}
 };
 const join=()=>{
  const candidate=roomId.trim().toLowerCase();
  if(!uuid.test(candidate)){setError('Copia el ID completo de la sesión.');return;}
  setQuery({session:candidate});
  void load(candidate);
 };
 const copy=()=>{
  if(!room)return;
  void navigator.clipboard.writeText(room.id).then(
   ()=>setNotice('Identificador copiado.'),
   ()=>setNotice('Selecciona y copia el identificador mostrado.')
  );
 };
 return <div className="rehearsal-page">
  <div className="rehearsal-container">
   <div className="rehearsal-eyebrow"><LockKeyhole size={15}/> TALA EATS · ENSAYO PRIVADO</div>
   <header className="rehearsal-heading">
    <div><h1>Prueba de entrega</h1>
     <p>Cliente, restaurante y repartidor conectados a un mismo pedido de demostración.</p></div>
    <div className="rehearsal-demo-tag">SIMULACIÓN · SIN CARGOS</div>
   </header>
   <div className="rehearsal-alert"><AlertCircle size={19}/><span>Esta prueba no crea pedidos comerciales, no cobra tarjetas y no mueve dinero a Stripe. Todos los saldos son simulados y no retirables.</span></div>
   {!room&&<section className="rehearsal-card">
    <h2>Entrar a un ensayo</h2><p>Usa el identificador de la sesión creada por ADMIN.</p>
    <div className="rehearsal-inline"><input value={roomId} onChange={e=>setRoomId(e.target.value)}
      placeholder="ID de la sesión" aria-label="Identificador del ensayo" autoCapitalize="off"/>
     <button disabled={loading} onClick={join}>{loading?'Abriendo…':'Entrar'} <ArrowRight size={17}/></button></div>
   </section>}
   {!room&&user?.role==='admin'&&<section className="rehearsal-card">
    <h2>Crear prueba privada</h2>
    <p>ADMIN con 2FA elige tres cuentas activas. No requieren verificación comercial ni Stripe Connect.</p>
    <div className="rehearsal-triple">
     <label>Usuario cliente<input type="number" min="1" value={ids.customer} onChange={e=>setIds(v=>({...v,customer:e.target.value}))} placeholder="ID cliente"/></label>
     <label>Usuario restaurante<input type="number" min="1" value={ids.restaurant} onChange={e=>setIds(v=>({...v,restaurant:e.target.value}))} placeholder="ID restaurante"/></label>
     <label>Usuario repartidor<input type="number" min="1" value={ids.driver} onChange={e=>setIds(v=>({...v,driver:e.target.value}))} placeholder="ID repartidor"/></label>
    </div>
    <button disabled={busy} onClick={()=>void create()} className="rehearsal-primary">Crear ensayo <ArrowRight size={17}/></button>
   </section>}
   {room&&<div className="rehearsal-stack">
    <section className="rehearsal-card">
     <div className="rehearsal-row">
      <div><div className="rehearsal-caption">ESTADO DEL PEDIDO DEMO</div><h2>{statusLabels[room.status]}</h2></div>
      <CheckCircle2 size={25} className="rehearsal-accent"/>
     </div>
     <div className="rehearsal-muted">Identificador del ensayo</div>
     <div className="rehearsal-inline"><code className="rehearsal-id">{room.id}</code><button className="rehearsal-secondary" onClick={copy}><ClipboardCopy size={16}/> Copiar</button></div>
     <div className="rehearsal-row rehearsal-members">
      <span><ShoppingBag size={17}/> Cliente {actor==='customer'?'· Tu cuenta':''}</span>
      <span><Store size={17}/> Restaurante {actor==='restaurant'?'· Tu cuenta':''}</span>
      <span><Bike size={17}/> Repartidor {actor==='driver'?'· Tu cuenta':''}</span>
     </div>
     <button className="rehearsal-link" disabled={loading} onClick={()=>void load(room.id)}>
       <RefreshCw size={16}/> Actualizar pedido
     </button>
    </section>
    {actor==='customer'&&room.status==='new'&&<section className="rehearsal-card">
     <h2><ShoppingBag size={20}/> Seleccionar producto de prueba</h2>
     <label>Producto<input maxLength={100} value={product} onChange={e=>setProduct(e.target.value)}/></label>
     <div className="rehearsal-triple">
      <label>Precio simulado (MXN)<input type="number" min="1" max="500" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>Cantidad<input type="number" min="1" max="10" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
      <label>Modalidad<select value={method} onChange={e=>setMethod(e.target.value as 'cash_demo'|'card_demo')}>
       <option value="cash_demo">Efectivo simulado</option><option value="card_demo">Tarjeta simulada (sin Stripe)</option></select></label>
     </div>
     <button className="rehearsal-primary" disabled={busy} onClick={()=>void act('place')}>Enviar pedido DEMO <ArrowRight size={17}/></button>
    </section>}
    {room.productName&&<section className="rehearsal-card">
     <h2>Resumen del ensayo</h2>
     <div className="rehearsal-row"><span>{room.quantity} × {room.productName}</span><b>{money(room.money.subtotal_minor)}</b></div>
     <div className="rehearsal-row"><span>Envío simulado</span><span>{money(room.money.shipping_minor)}</span></div>
     <div className="rehearsal-row"><span>Tarifa de servicio simulada</span><span>{money(room.money.service_minor)}</span></div>
     <div className="rehearsal-row rehearsal-total"><b>Total DEMO</b><b>{money(room.money.total_minor)}</b></div>
     <p className="rehearsal-muted">{room.paymentMethod==='card_demo'?'Tarjeta de ensayo: ningún cargo, ninguna transacción Stripe.':'Efectivo de ensayo: no se recibe dinero real.'}</p>
    </section>}
    {nextStep&&<section className="rehearsal-card">
     <h2>{actor==='restaurant'?'Acciones del restaurante':'Acciones del repartidor'}</h2>
     <button className="rehearsal-primary" disabled={busy} onClick={()=>void act(nextStep.action)}>{nextStep.label} <ArrowRight size={17}/></button>
    </section>}
    {actor==='customer'&&room.status!=='new'&&room.status!=='cancelled'&&room.status!=='delivered'&&
      <section className="rehearsal-card"><h2><LockKeyhole size={20}/> PIN de entrega demo</h2><p>Solo el cliente puede ver este PIN. Comunícalo al repartidor al recibir el pedido de ensayo.</p><strong className="rehearsal-pin">{room.delivery_pin}</strong></section>}
    {actor==='driver'&&room.status==='on_the_way'&&<section className="rehearsal-card">
     <h2>Confirmar entrega con PIN</h2><label>PIN proporcionado por el cliente<input type="text" inputMode="numeric" pattern="[0-9]{4}"
      value={pin} maxLength={4} autoComplete="off" onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="0000"/></label>
     <button className="rehearsal-primary" disabled={busy||!/^[0-9]{4}$/.test(pin)} onClick={()=>void act('deliver')}>Entregar pedido DEMO</button>
    </section>}
    <section className="rehearsal-card">
     <h2><Wallet size={20}/> Wallet de ensayo</h2>
     <div className="rehearsal-wallet">
      <div><span>Restaurante · demo</span><strong>{money(room.money.merchant_demo_wallet_minor)}</strong></div>
      <div><span>Repartidor · demo</span><strong>{money(room.money.driver_demo_wallet_minor)}</strong></div>
     </div><p className="rehearsal-muted">Disponible para retirar: $0.00 · No hay fondos reales ni transferencias.</p>
    </section>
    {actor==='admin'&&room.status!=='delivered'&&room.status!=='cancelled'&&
     <button className="rehearsal-danger" disabled={busy} onClick={()=>void act('cancel')}>Cancelar ensayo</button>}
   </div>}
   {error&&<p className="rehearsal-error" role="alert"><AlertCircle size={18}/>{error}</p>}
   {notice&&<p className="rehearsal-notice" role="status"><CheckCircle2 size={17}/>{notice}</p>}
   <div className="rehearsal-disclaimer"><CreditCard size={16}/> Ensayo de interfaz y estados. Los pagos reales con Stripe y la autorización de comercios permanecen independientes.</div>
  </div>
 </div>;
}
