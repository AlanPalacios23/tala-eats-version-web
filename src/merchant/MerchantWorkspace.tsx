import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  BarChart3, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  BellRing, Coffee, Columns3, Inbox, LayoutDashboard, List, MapPin, PackageCheck, Plus, Printer, ReceiptText, RefreshCw,
  Search, Settings2, ShoppingBag, SlidersHorizontal, Store, UtensilsCrossed,
  Wallet, WifiOff, X
} from 'lucide-react';
import { api, pesos, safeImage } from '../lib/api';
import type { MenuItem, Order, Restaurant } from '../lib/types';
import MerchantWallet from './MerchantWallet';
import './merchant.css';

type Section = 'pedidos' | 'menu' | 'rendimiento' | 'wallet' | 'negocio';
type OrderFilter = 'activos' | 'nuevos' | 'preparando' | 'listos' | 'historial' | 'todos';
type MenuFilter = 'todos' | 'disponibles' | 'bajo' | 'agotados' | 'pausados';
type OwnerAnalytics = {orders: number; delivered: number; gross_sales: number; inventory_low: number};
type StatusAction = 'confirmed' | 'preparing' | 'ready';
const ACTIVE = new Set(['received', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'on_the_way']);
export function orderPaymentConfirmed(order:Pick<Order,'payment_method'|'payment_status'>):boolean {
  // El backend exige cobro confirmado antes de aceptar/preparar pedidos Stripe.
  return order.payment_method!=='stripe'||order.payment_status==='paid';
}
const STATUS_LABEL: Record<string, string> = {
  received: 'Nuevo', confirmed: 'Aceptado', preparing: 'En preparación',
  ready: 'Listo para recoger', assigned: 'Repartidor asignado',
  picked_up: 'Recogido', on_the_way: 'En camino', delivered: 'Entregado',
  cancelled: 'Cancelado', awaiting_payment: 'Pago pendiente'
};
const KITCHEN_STEPS = [
  {id:'received',label:'Recibido'},
  {id:'confirmed',label:'Aceptado'},
  {id:'preparing',label:'En preparación'},
  {id:'ready',label:'Listo'}
] as const;
export function kitchenStepIndex(status:string):number {
  const step=KITCHEN_STEPS.findIndex(item=>item.id===status);
  if(step>=0)return step;
  return ['assigned','picked_up','on_the_way','delivered'].includes(status)?3:-1;
}
const NAV: {id: Section; label: string; mobileLabel: string; icon: typeof ClipboardList}[] = [
  {id:'pedidos',label:'Pedidos',mobileLabel:'Pedidos',icon:ClipboardList},
  {id:'menu',label:'Menú',mobileLabel:'Menú',icon:UtensilsCrossed},
  {id:'rendimiento',label:'Rendimiento',mobileLabel:'Datos',icon:BarChart3},
  {id:'wallet',label:'Wallet',mobileLabel:'Wallet',icon:Wallet},
  {id:'negocio',label:'Mi negocio',mobileLabel:'Negocio',icon:Settings2}
];
export function elapsedOrderTime(date:string, now:number):string {
  const created=new Date(date).getTime();
  if(!Number.isFinite(created)||created>now+60_000)return 'Tiempo no disponible';
  const mins=Math.max(0,Math.floor((now-created)/60000));
  if(mins<1)return 'Hace menos de 1 min';
  if(mins<60)return `Hace ${mins} min`;
  const hours=Math.floor(mins/60);
  if(hours<24)return `Hace ${hours} h ${mins%60} min`;
  return `Hace ${Math.floor(hours/24)} d`;
}
export function filterMerchantMenu(items: MenuItem[], query: string, status: MenuFilter, category: string): MenuItem[] {
  const search=query.trim().toLocaleLowerCase('es-MX');
  return items.filter(item=>{
    const text=(item.name+' '+(item.category||'')+' '+(item.description||'')).toLocaleLowerCase('es-MX');
    const stock=Number(item.stock);
    const matchStatus=status==='todos'||(status==='disponibles'&&item.is_available&&stock>0)||(status==='bajo'&&stock<=5)||(status==='agotados'&&stock===0)||(status==='pausados'&&!item.is_available);
    return matchStatus&&(!category||(item.category||'General')===category)&&(!search||text.includes(search));
  });
}
export function historicalDeliveryRate(total: number, delivered: number): number | null {
  if(!Number.isFinite(total)||!Number.isFinite(delivered)||total<=0||delivered<0)return null;
  return Math.max(0,Math.min(100,Math.round(delivered/total*100)));
}
const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'No pudimos consultar el servidor.';
const orderTime = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? 'Hora no disponible' : new Intl.DateTimeFormat('es-MX', {dateStyle:'medium',timeStyle:'short'}).format(d);
};
function ScreenEmpty({icon, title, children}:{icon: ReactNode;title:string;children:ReactNode}) {
  return <div className="merchant-empty"><span className="merchant-empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p></div>;
}
function Metric({label,value,note,icon}:{label:string;value:string|number;note:string;icon:ReactNode}) {
  return <div className="merchant-metric"><div className="merchant-metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function MenuRow({item,onSaved,online}:{item:MenuItem;onSaved:()=>Promise<void>;online:boolean}) {
  const [price,setPrice]=useState(String(item.price));
  const [stock,setStock]=useState(item.stock);
  const [available,setAvailable]=useState(item.is_available);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(false);
  const [notice,setNotice]=useState('');
  const rowWriteLock=useRef(false);
  const dirty=price!==String(item.price)||stock!==item.stock||available!==item.is_available;
  useEffect(()=>{
    // Los GET periódicos no borran los cambios de un producto que el usuario edita.
    if(editing||saving||rowWriteLock.current)return;
    setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);
  },[item.id,item.price,item.stock,item.is_available,editing,saving]);
  const valid=Number.isFinite(Number(price))&&Number(price)>=0&&/^\d+(\.\d{1,2})?$/.test(price)&&Number.isSafeInteger(stock)&&stock>=0;
  const save=async()=>{
    if(!dirty||!valid||rowWriteLock.current||!online)return;
    rowWriteLock.current=true;setSaving(true);setNotice('');
    try {
      await api.ownerUpdateItem(item.id,{price,stock,is_available:available});
      setEditing(false);
      await onSaved();setNotice('Cambios guardados');
    }catch(e){setNotice(errorMessage(e));}finally{rowWriteLock.current=false;setSaving(false);}
  };
  const quickAvailability=async()=>{
    if(rowWriteLock.current||!online)return;
    if(dirty){setNotice('Guarda primero los cambios pendientes.');return;}
    rowWriteLock.current=true;setSaving(true);setNotice('');
    try{await api.ownerUpdateItem(item.id,{is_available:!item.is_available});await onSaved();setNotice(item.is_available?'Producto pausado':'Producto disponible');}
    catch(e){setNotice(errorMessage(e));}finally{rowWriteLock.current=false;setSaving(false);}
  };
  const undo=()=>{if(saving)return;setEditing(false);setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);setNotice('Cambios descartados');};
  const img=safeImage(item.image_url);
  return <article className="merchant-product">
    <div className="merchant-product-image">{img?<img src={img} loading="lazy" alt={item.name}/>:<Coffee size={25} aria-hidden="true"/>}</div>
    <div className="merchant-product-body">
      <div className="merchant-product-heading"><div><small>{item.category||'General'}</small><h3>{item.name}</h3><span className={'merchant-stock-indicator '+(item.stock<=5?'low':'')}>{item.stock===0?'Sin existencias':item.stock<=5?'Pocas existencias':'En inventario'}</span></div><label className="merchant-toggle-label"><input type="checkbox" checked={available} onChange={e=>{setEditing(true);setAvailable(e.target.checked)}}/><span>{available?'Disponible':'Oculto'}</span></label></div>
      <div className="merchant-product-controls">
        <label>Precio (MXN)<input aria-label={'Precio de '+item.name} inputMode="decimal" value={price} onChange={e=>{setEditing(true);setPrice(e.target.value)}} /></label>
        <label>Existencias<input aria-label={'Stock de '+item.name} type="number" min="0" step="1" value={stock} onChange={e=>{setEditing(true);setStock(Number(e.target.value))}}/></label>
        <button type="button" className="merchant-small-button" disabled={!dirty||!valid||saving||!online} onClick={()=>void save()} >{saving?'Guardando…':'Guardar cambios'}</button><button type="button" className="merchant-quick-button" disabled={saving||dirty||!online} onClick={()=>void quickAvailability()}>{item.is_available?'Pausar producto':'Reactivar producto'}</button>{dirty&&<button className="merchant-discard-button" type="button" disabled={saving} onClick={undo}>Deshacer</button>}
      </div>
      {notice&&<p className="merchant-inline-note" role="status">{notice}</p>}
    </div>
  </article>;
}

export default function MerchantWorkspace(){
  const [section,setSection]=useState<Section>('pedidos');
  useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});},[section]);
  const [filter,setFilter]=useState<OrderFilter>('activos');
  const [orderView,setOrderView]=useState<'board'|'list'>('board');
  const [selectedOrderId,setSelectedOrderId]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [menuSearch,setMenuSearch]=useState('');
  const [menuFilter,setMenuFilter]=useState<MenuFilter>('todos');
  const [menuCategory,setMenuCategory]=useState('');
  const [freshOrderIds,setFreshOrderIds]=useState<number[]>([]);
  const [restaurant,setRestaurant]=useState<Restaurant|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [analytics,setAnalytics]=useState<OwnerAnalytics|null>(null);
  const [errors,setErrors]=useState<{restaurant?:string;orders?:string;analytics?:string}>({});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busyOrder,setBusyOrder]=useState<number|null>(null);
  const [savingStore,setSavingStore]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [notice,setNotice]=useState('');
  const [noticeError,setNoticeError]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [newName,setNewName]=useState('');
  const [newPrice,setNewPrice]=useState('');
  const [newStock,setNewStock]=useState(20);
  const [newCategory,setNewCategory]=useState('General');
  const [newDescription,setNewDescription]=useState('');
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
  const [clock,setClock]=useState(()=>Date.now());
  const readGeneration=useRef(0);
  const knownReceivedIds=useRef<Set<number>|null>(null);
  const readInFlight=useRef(false);
  const mutationInFlight=useRef(false);
  const detailRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(selectedOrderId===null)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const sheet=detailRef.current;
    const originalOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    sheet?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar detalles"]')?.focus();
    const close=(e:KeyboardEvent)=>{
      if(e.key==='Escape')setSelectedOrderId(null);
      if(e.key!=='Tab'||!sheet)return;
      const focusable=Array.from(sheet.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)'));
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',close);
    return()=>{window.removeEventListener('keydown',close);document.body.style.overflow=originalOverflow;previous?.focus();};
  },[selectedOrderId]);
  useEffect(()=>{
    const tick=window.setInterval(()=>setClock(Date.now()),30000);
    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    return()=>{window.clearInterval(tick);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};
  },[]);

  const refresh=useCallback(async (quiet=false) => {
    // Sin peticiones duplicadas ni lecturas que compitan con escrituras.
    if(quiet&&(readInFlight.current||mutationInFlight.current))return;
    const generation=++readGeneration.current;
    readInFlight.current=true;
    if(!quiet)setRefreshing(true);
    try {
      const [r,o,a]=await Promise.allSettled([api.ownerRestaurant(),api.ownerOrders(),api.ownerAnalytics()]);
      if(generation!==readGeneration.current)return;
      const nextErrors: {restaurant?:string;orders?:string;analytics?:string}={};
      if(r.status==='fulfilled')setRestaurant(r.value);else nextErrors.restaurant=errorMessage(r.reason);
      if(o.status==='fulfilled'){
        const receivedIds=o.value.filter(order=>order.status==='received').map(order=>order.id);
        if(knownReceivedIds.current===null)knownReceivedIds.current=new Set(receivedIds);
        else {
          const arriving=receivedIds.filter(id=>!knownReceivedIds.current?.has(id));
          receivedIds.forEach(id=>knownReceivedIds.current?.add(id));
          if(arriving.length)setFreshOrderIds(prev=>Array.from(new Set([...prev,...arriving])));
        }
        setOrders(o.value);setLastSync(new Date());
      }else nextErrors.orders=errorMessage(o.reason);
      if(a.status==='fulfilled')setAnalytics(a.value);else nextErrors.analytics=errorMessage(a.reason);
      setErrors(nextErrors);
    }finally {
      if(generation===readGeneration.current){readInFlight.current=false;setLoading(false);setRefreshing(false);}
    }
  },[]);
  useEffect(()=>{void refresh();return()=>{readGeneration.current++;readInFlight.current=false;};},[refresh]);
  useEffect(()=>{
    // Solo GET en primer plano, jamás escrituras automáticas.
    const timer=window.setInterval(()=>{if(navigator.onLine&&document.visibilityState==='visible'&&section==='pedidos')void refresh(true);},30000);
    const onVisible=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refresh(true);};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[refresh,section]);

  const newCount=orders.filter(o=>o.status==='received').length;
  const activeCount=orders.filter(o=>ACTIVE.has(o.status)).length;
  const stockLow=restaurant?.menu_items?.filter(p=>p.stock<=5).length??0;
  const activeFreshOrders=freshOrderIds.filter(id=>orders.some(o=>o.id===id&&o.status==='received'));
  const categories=useMemo(()=>Array.from(new Set((restaurant?.menu_items??[]).map(p=>p.category||'General'))).sort((a,b)=>a.localeCompare(b,'es-MX')),[restaurant]);
  const deliveredRate=analytics?historicalDeliveryRate(analytics.orders,analytics.delivered):null;
  const filteredOrders=useMemo(()=>{
    const text=search.trim().toLocaleLowerCase('es-MX');
    return orders.filter(o=>{
      const byStatus=filter==='todos'||(filter==='nuevos'&&o.status==='received')||(filter==='preparando'&&['confirmed','preparing'].includes(o.status))||(filter==='listos'&&['ready','assigned','picked_up','on_the_way'].includes(o.status))||(filter==='activos'&&ACTIVE.has(o.status))||(filter==='historial'&&!ACTIVE.has(o.status));
      const bySearch=!text||String(o.id).includes(text)||(o.items??[]).some(i=>i.name_snapshot.toLocaleLowerCase('es-MX').includes(text));
      return byStatus&&bySearch;
    }).sort((a,b)=>{
      const rank=(s:string)=>s==='received'?0:s==='confirmed'?1:s==='preparing'?2:s==='ready'?3:4;
      return rank(a.status)-rank(b.status)||new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
    });
  },[orders,filter,search]);
  const selectedOrder=selectedOrderId===null?null:orders.find(o=>o.id===selectedOrderId)??null;
  const boardAllowed=filter==='activos'&&!search.trim()&&orderView==='board';
  const products=useMemo(()=>filterMerchantMenu(restaurant?.menu_items??[],menuSearch,menuFilter,menuCategory),[restaurant,menuSearch,menuFilter,menuCategory]);

  const changeStatus=async(id:number,status:StatusAction)=>{
    if(mutationInFlight.current||!navigator.onLine)return;
    const current=orders.find(order=>order.id===id);
    if(!current||!orderPaymentConfirmed(current)){
      setNoticeError(true);setNotice('Es necesario confirmar el cobro con Stripe antes de cambiar el estado.');
      return;
    }
    mutationInFlight.current=true;readGeneration.current++;readInFlight.current=false;setRefreshing(false);
    setBusyOrder(id);setNotice('');setNoticeError(false);
    try{
      const updated=await api.ownerUpdateStatus(id,status);
      // El resultado de la mutación confirmada es la fuente de verdad si el GET posterior falla.
      if(updated?.id===id&&updated.status===status)setOrders(prev=>prev.map(order=>order.id===id?{...order,...updated}:order));
      await refresh(false);
      setNotice('Pedido #'+id+' actualizado correctamente.');
    }catch(e){setNoticeError(true);setNotice('Pedido #'+id+': '+errorMessage(e));}
    finally{setBusyOrder(null);mutationInFlight.current=false;}
  };
  const toggleStore=async()=>{
    if(!restaurant||mutationInFlight.current||!navigator.onLine)return;
    mutationInFlight.current=true;readGeneration.current++;readInFlight.current=false;setRefreshing(false);
    setSavingStore(true);setNotice('');setNoticeError(false);
    try{
      const updated=await api.ownerUpdateRestaurant({is_open:!restaurant.is_open});
      if(updated?.id===restaurant.id)setRestaurant(updated);
      await refresh(false);setNotice('Disponibilidad actualizada en el servidor.');
    }catch(e){setNoticeError(true);setNotice(errorMessage(e));}
    finally{setSavingStore(false);mutationInFlight.current=false;}
  };
  const addProduct=async(e:FormEvent)=>{
    e.preventDefault();if(mutationInFlight.current||!navigator.onLine)return;
    const price=Number(newPrice);
    if(!newName.trim()||!Number.isFinite(price)||price<0||!/^\d+(\.\d{1,2})?$/.test(newPrice)||!Number.isSafeInteger(newStock)||newStock<0){setNotice('Revisa el nombre, precio y existencias.');return;}
    mutationInFlight.current=true;readGeneration.current++;readInFlight.current=false;setRefreshing(false);
    setSubmitting(true);setNotice('');setNoticeError(false);
    try{
      await api.ownerAddItem({name:newName.trim(),price:newPrice,stock:newStock,description:newDescription.trim(),category:newCategory.trim()||'General',is_available:true});
      setNewName('');setNewPrice('');setNewStock(20);setNewCategory('General');setNewDescription('');setAddOpen(false);
      await refresh(false);setNotice('Producto agregado correctamente.');
    }catch(e){setNoticeError(true);setNotice(errorMessage(e));}finally{setSubmitting(false);mutationInFlight.current=false;}
  };

  // Un solo diseño de tarjeta para tablero, lista y móvil. Sin duplicar acciones.
  const renderOrder=(o:Order)=>{
    const awaitingStripePayment=!orderPaymentConfirmed(o);
    const next:StatusAction|null=o.status==='received'?'confirmed':o.status==='confirmed'?'preparing':o.status==='preparing'?'ready':null;
    const label=next==='confirmed'?'Aceptar pedido':next==='preparing'?'Iniciar preparación':next==='ready'?'Marcar como listo':'';
    return <article className={'merchant-order-card '+(o.status==='received'?'is-new':'')} key={o.id}>
      <div className="merchant-order-header"><div><span className="merchant-order-id">#{o.id}</span><small>{orderTime(o.created_at)}</small><span className="merchant-age" title="Tiempo desde la creación del pedido"><Clock3 size={13}/>{elapsedOrderTime(o.created_at,clock)}</span></div><span className={'merchant-order-status state-'+o.status}>{STATUS_LABEL[o.status]||o.status}</span></div>
      <div className="merchant-order-type"><span className="merchant-order-type-icon">{o.order_type==='pickup'?<ShoppingBag size={17}/>:<MapPin size={17}/>}</span><span>{o.order_type==='pickup'?'Recoger en tienda':'Entrega a domicilio'}</span><strong>{pesos(o.total)}</strong></div>
      <div className="merchant-order-items">{o.items?.length?o.items.map((i,index)=><div key={i.id??index}><span className="merchant-qty">{i.quantity}×</span><span>{i.name_snapshot}</span></div>):<span className="merchant-secondary">Sin detalle de productos disponible</span>}</div>
      <div className="merchant-order-foot"><span><ReceiptText size={15}/>{o.payment_method==='cash'?'Efectivo':'Tarjeta'} · {o.payment_status||'Estado de pago no disponible'}</span></div>
      <div className="merchant-card-actions">
        <button type="button" className="merchant-detail-button" onClick={()=>setSelectedOrderId(o.id)}>Ver detalles <ChevronRight size={16}/></button>
        {next?<button type="button" className="merchant-order-action" disabled={busyOrder!==null||Boolean(errors.orders)||!online||awaitingStripePayment} title={awaitingStripePayment?'El cobro con Stripe aún no está confirmado':undefined} onClick={()=>void changeStatus(o.id,next)}>{busyOrder===o.id?'Actualizando…':awaitingStripePayment?'Esperando cobro':label}<ChevronRight size={17}/></button>:<div className="merchant-order-wait"><CheckCircle2 size={16}/>{o.status==='ready'?'Esperando recogida':o.status==='delivered'?'Finalizado':o.status==='cancelled'?'Cancelado':'En seguimiento'}</div>}
      </div>
    </article>;
  };
  const queues=[
    {id:'nuevos',title:'Nuevos',subtitle:'Por aceptar',statuses:['received'],count:newCount},
    {id:'preparando',title:'En preparación',subtitle:'Pedidos activos en cocina',statuses:['confirmed','preparing'],count:orders.filter(o=>['confirmed','preparing'].includes(o.status)).length},
    {id:'listos',title:'Listos',subtitle:'Esperando recogida o entrega',statuses:['ready','assigned','picked_up','on_the_way'],count:orders.filter(o=>['ready','assigned','picked_up','on_the_way'].includes(o.status)).length}
  ];

  return <div className="merchant-shell">
    <aside className="merchant-sidebar" aria-label="Panel de navegación del restaurante">
      <div className="merchant-logo"><span className="merchant-logo-mark"><Store size={22}/></span><span>Tala <b>Eats</b><small>RESTAURANTES</small></span></div>
      <div className="merchant-sidebar-label">ESPACIO DE TRABAJO</div>
      <nav className="merchant-nav" aria-label="Secciones del restaurante">{NAV.map(n=><button type="button" key={n.id} className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={20} strokeWidth={2}/>{n.label}{n.id==='pedidos'&&newCount>0&&<span className="merchant-nav-count">{newCount}</span>}</button>)}</nav>
      <div className="merchant-sidebar-spacer"/>
      <div className="merchant-sidebar-store"><div className="merchant-sidebar-avatar"><Store size={20}/></div><div><strong>{restaurant?.name||'Mi comercio'}</strong><small>{restaurant?.is_open?'Abierto':'Cerrado'}</small></div></div>
    </aside>
    <div className="merchant-workspace">
      <header className="merchant-toolbar">
        <div className="merchant-mobile-logo"><span className="merchant-mobile-symbol"><Store size={19}/></span><span>Tala <b>Eats</b> <small>Restaurantes</small></span></div>
        <div className="merchant-breadcrumb">Panel de restaurante <ChevronRight size={14}/><strong>{NAV.find(n=>n.id===section)?.label}</strong></div>
        <div className="merchant-toolbar-actions"><span className={"merchant-connection "+(online?"connected":"offline")} title={online?"Conexión de red disponible":"Sin conexión"}><span/>{online?"Conectado":"Sin conexión"}</span>
          {restaurant&&<button type="button" onClick={()=>setSection('negocio')} className={'merchant-open-pill '+(restaurant.is_open?'is-open':'')} aria-label="Ver disponibilidad y ajustes del comercio"><span className="merchant-status-dot"/>{restaurant.is_open?'Abierto':'Cerrado'}</button>}
          <button className="merchant-refresh" type="button" disabled={refreshing} onClick={()=>void refresh()} aria-label="Actualizar datos" title="Actualizar datos"><RefreshCw size={18} className={refreshing?'merchant-spin':''}/></button>
        </div>
      </header>
      <div className="merchant-content">
        {loading?<div className="merchant-skeleton" role="status" aria-label="Cargando información del restaurante">
          <div className="merchant-skeleton-header"><div className="merchant-skeleton-line big"/><div className="merchant-skeleton-line short"/></div>
          <div className="merchant-skeleton-metrics">{[0,1,2,3].map(n=><div className="merchant-skeleton-panel" key={n}><div className="merchant-skeleton-line medium"/><div className="merchant-skeleton-line big"/></div>)}</div>
          <div className="merchant-skeleton-line medium"/><div className="merchant-skeleton-cards">{[0,1,2].map(n=><div className="merchant-skeleton-panel tall" key={n}><div className="merchant-skeleton-line medium"/><div className="merchant-skeleton-line short"/><div className="merchant-skeleton-line big"/></div>)}</div>
          <span className="merchant-sr-only">Consultando tu negocio…</span>
        </div>:<>
          {!online&&<div className="merchant-feedback error" role="alert"><WifiOff size={18}/> Sin conexión: los datos pueden estar desactualizados y no se permiten cambios hasta volver a conectar.</div>}
          {activeFreshOrders.length>0&&<div className="merchant-arrival" role="status" aria-live="polite">
            <div className="merchant-arrival-icon"><BellRing size={20}/></div>
            <div><strong>{activeFreshOrders.length===1?'Llegó un nuevo pedido':`Llegaron ${activeFreshOrders.length} pedidos nuevos`}</strong><span>Hay pedidos pendientes de aceptar.</span></div>
            <button type="button" className="merchant-arrival-open" onClick={()=>{setSection('pedidos');setFilter('nuevos');setOrderView('list');setFreshOrderIds([])}}>Ver pedidos <ChevronRight size={17}/></button>
            <button type="button" className="merchant-arrival-close" aria-label="Descartar aviso de pedidos nuevos" onClick={()=>setFreshOrderIds([])}><X size={18}/></button>
          </div>}
          {errors.restaurant&&<div className="merchant-feedback error" role="alert"><WifiOff size={18}/><span>No fue posible cargar el comercio: {errors.restaurant}</span><button onClick={()=>void refresh()}>Reintentar</button></div>}
          {notice&&<div className={'merchant-feedback '+(noticeError?'error':'')} role={noticeError?'alert':'status'}>{noticeError?<WifiOff size={18}/>:<CheckCircle2 size={18}/>}<span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
          {section==='pedidos'&&<>
            <div className="merchant-page-heading merchant-orders-title">
              <div><span className="merchant-kicker">ORDENES EN TIEMPO REAL</span><h1>Pedidos</h1><p>Controla la recepción, la cocina y las entregas desde un solo lugar.</p></div>
              {newCount>0&&<button type="button" className="merchant-attention" onClick={()=>{setFilter('nuevos');setOrderView('list')}}><span className="merchant-attention-dot"/>{newCount} {newCount===1?'pedido nuevo':'pedidos nuevos'}<ChevronRight size={16}/></button>}
            </div>
            <div className="merchant-overview merchant-ops-overview">
              <Metric label="Por aceptar" value={newCount} note="Nuevos pedidos" icon={<Inbox size={20}/>}/>
              <Metric label="En operación" value={activeCount} note="Pedidos activos" icon={<Clock3 size={20}/>}/>
              <Metric label="Finalizados" value={analytics?.delivered??'—'} note="Histórico" icon={<PackageCheck size={20}/>}/>
              <Metric label="Ventas entregadas" value={analytics?pesos(analytics.gross_sales):'—'} note="Histórico" icon={<BarChart3 size={20}/>}/>
            </div>
            <div className="merchant-queue-heading"><div><h2>Cola de pedidos</h2><p>{lastSync?'Actualizado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(lastSync):'Esperando sincronización'} · consultas cada 30 s con la pantalla visible.</p></div><div className="merchant-view-switch" aria-label="Presentación de pedidos"><button type="button" title="Tablero" aria-label="Ver tablero" aria-pressed={orderView==='board'} className={orderView==='board'?'active':''} onClick={()=>{setOrderView('board');setFilter('activos');setSearch('')}}><Columns3 size={18}/></button><button type="button" title="Lista" aria-label="Ver lista" aria-pressed={orderView==='list'} className={orderView==='list'?'active':''} onClick={()=>setOrderView('list')}><List size={18}/></button></div></div>
            {errors.orders&&<div className="merchant-feedback error" role="alert">No se pudo actualizar la cola de pedidos: {errors.orders}<button type="button" onClick={()=>void refresh()}>Reintentar</button></div>}
            <div className="merchant-filters">
              <div className="merchant-chips" aria-label="Filtrar pedidos">{([['activos','En curso'],['nuevos','Nuevos'],['preparando','En preparación'],['listos','Listos'],['historial','Historial'],['todos','Todos']] as const).map(([id,label])=><button key={id} type="button" className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{id==='nuevos'&&newCount>0&&<span>{newCount}</span>}</button>)}</div>
              <label className="merchant-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número o producto" aria-label="Buscar pedidos"/></label>
            </div>
            {!errors.orders&&(boardAllowed?
              <div className="merchant-board" aria-label="Tablero de pedidos por etapas">{queues.map(q=><section className="merchant-queue-column" key={q.id}>
                <div className="merchant-column-title"><div className={'merchant-column-indicator '+q.id}/><h3>{q.title}</h3><span className="merchant-column-counter">{q.count}</span></div><p>{q.subtitle}</p>
                <div className="merchant-column-cards">{filteredOrders.filter(o=>q.statuses.includes(o.status)).length?filteredOrders.filter(o=>q.statuses.includes(o.status)).map(renderOrder):<div className="merchant-board-empty"><CheckCircle2 size={24}/><span>Sin pedidos aquí</span></div>}</div>
              </section>)}</div>:
              (filteredOrders.length===0?<ScreenEmpty icon={<ClipboardList size={30}/>} title="No hay pedidos en esta vista">{search?'Prueba con otra búsqueda.':'Los pedidos que coincidan con el filtro aparecerán aquí.'}</ScreenEmpty>:<div className="merchant-order-grid">{filteredOrders.map(renderOrder)}</div>))}
          </>}
          {section==='menu'&&<>
            {!online&&<div className="merchant-feedback error" role="status">Recupera la conexión antes de editar el menú.</div>}
            <div className="merchant-page-heading"><div><span className="merchant-kicker">CATÁLOGO</span><h1>Menú y productos</h1><p>Actualiza precios, existencias y disponibilidad sin salir de esta pantalla.</p></div><button className="merchant-main-button" onClick={()=>setAddOpen(v=>!v)}><Plus size={19}/>{addOpen?'Cerrar formulario':'Agregar producto'}</button></div>
            <div className="merchant-menu-info"><span><UtensilsCrossed size={18}/>{restaurant?.menu_items?.length??0} productos</span><span><SlidersHorizontal size={18}/>{stockLow} con 5 unidades o menos</span></div>
            {addOpen&&<form onSubmit={e=>void addProduct(e)} className="merchant-add-form"><h2>Nuevo producto</h2><div className="merchant-add-grid"><label>Nombre<input required maxLength={150} minLength={2} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre del producto"/></label><label>Categoría<input maxLength={80} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="General"/></label><label>Precio (MXN)<input required value={newPrice} onChange={e=>setNewPrice(e.target.value)} inputMode="decimal" placeholder="89.00"/></label><label>Existencias<input required type="number" min="0" step="1" value={newStock} onChange={e=>setNewStock(Number(e.target.value))}/></label><label className="merchant-add-full">Descripción<input maxLength={500} value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Opcional"/></label></div><div className="merchant-add-actions"><button className="merchant-small-button" disabled={submitting||!online}>{submitting?'Agregando…':'Guardar producto'}</button><button type="button" className="merchant-neutral-button" onClick={()=>setAddOpen(false)}>Cancelar</button></div></form>}
            <div className="merchant-menu-toolbar"><div><h2>Productos publicados</h2><p>{products.length} de {restaurant?.menu_items?.length??0} productos</p></div><label className="merchant-search"><Search size={18}/><input placeholder="Buscar en el menú" aria-label="Buscar productos" value={menuSearch} onChange={e=>setMenuSearch(e.target.value)}/></label></div>
            <div className="merchant-menu-filterbar">
              <div className="merchant-menu-filters" aria-label="Estado de productos">{([['todos','Todos'],['disponibles','Disponibles'],['bajo','Stock bajo'],['agotados','Agotados'],['pausados','Pausados']] as const).map(([id,label])=><button type="button" key={id} className={menuFilter===id?'active':''} aria-pressed={menuFilter===id} onClick={()=>setMenuFilter(id)}>{label}</button>)}</div>
              <label className="merchant-category-select"><span>Categoría</span><select aria-label="Filtrar categoría" value={menuCategory} onChange={e=>setMenuCategory(e.target.value)}><option value="">Todas</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></label>
            </div>
            {products.length?<div className="merchant-product-list">{products.map(item=><MenuRow key={item.id} item={item} online={online} onSaved={()=>refresh(false)}/>)}</div>:<ScreenEmpty icon={<UtensilsCrossed size={30}/>} title="No se encontraron productos"><button type="button" className="merchant-clear-filters" onClick={()=>{setMenuSearch('');setMenuFilter('todos');setMenuCategory('')}}>Restablecer filtros</button></ScreenEmpty>}
          </>}
          {section==='rendimiento'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">DATOS DEL NEGOCIO</span><h1>Rendimiento</h1><p>Indicadores históricos del backend. No son ventas estimadas ni cifras del día.</p></div></div>
            {errors.analytics&&<div className="merchant-feedback error" role="alert">Métricas no disponibles: {errors.analytics}</div>}
            <div className="merchant-overview"><Metric label="Total de pedidos" value={analytics?.orders??'—'} note="Histórico" icon={<ClipboardList size={20}/>}/><Metric label="Entregados" value={analytics?.delivered??'—'} note="Histórico" icon={<Check size={20}/>}/><Metric label="Ventas entregadas" value={analytics?pesos(analytics.gross_sales):'—'} note="Cifra del backend" icon={<BarChart3 size={20}/>}/><Metric label="Inventario bajo" value={analytics?.inventory_low??'—'} note="Cifra del backend" icon={<ShoppingBag size={20}/>}/></div>
            <div className="merchant-insights">
              <section className="merchant-insight-card">
                <div className="merchant-insight-top"><div><small>EFECTIVIDAD HISTÓRICA</small><h2>Pedidos entregados</h2></div><span className="merchant-insight-number">{deliveredRate===null?'—':deliveredRate+'%'}</span></div>
                <div className="merchant-progress-track" role="progressbar" aria-label="Porcentaje histórico de pedidos entregados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={deliveredRate??undefined}><div style={{width:(deliveredRate??0)+'%'}}/></div>
                <p>{deliveredRate===null?'No hay suficientes pedidos históricos para calcular esta proporción.':`${analytics?.delivered} de ${analytics?.orders} pedidos históricos registrados como entregados.`}</p>
              </section>
              <section className="merchant-insight-card"><div className="merchant-insight-top"><div><small>CONTROL DE INVENTARIO</small><h2>Productos por revisar</h2></div><span className="merchant-insight-number">{stockLow}</span></div>
                <p>Productos con 5 unidades o menos, calculados del catálogo actual.</p>
                <button type="button" className="merchant-insight-button" onClick={()=>{setSection('menu');setMenuFilter('bajo');setMenuSearch('');setMenuCategory('')}}>Revisar existencias <ChevronRight size={17}/></button>
              </section>
            </div>
            <button className="merchant-wallet-route" type="button" onClick={()=>setSection('wallet')}><Wallet size={19}/> Consultar wallet y liquidaciones <ChevronRight size={17}/></button>
            <div className="merchant-info-panel"><LayoutDashboard size={24}/><div><h3>Información conectada a tu comercio</h3><p>Estas cifras se actualizan desde la API de Tala Eats. Los reportes financieros detallados, pagos y liquidaciones requieren endpoints verificados adicionales; no se muestran saldos inventados.</p></div></div>
          </>}
          {section==='wallet'&&<MerchantWallet key={restaurant?.id??'no-restaurant'} restaurantId={restaurant?.id??null}/>}
          {section==='negocio'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">CONFIGURACIÓN</span><h1>Mi negocio</h1><p>Controla tu disponibilidad y consulta la información verificada del comercio.</p></div></div>
            <section className="merchant-store-hero">
              {restaurant?.cover_image_url&&safeImage(restaurant.cover_image_url)&&<img className="merchant-store-cover" src={safeImage(restaurant.cover_image_url)||undefined} alt="" loading="lazy"/>}
              <div className="merchant-store-hero-shade"/>
              <div className="merchant-store-hero-content">
                <span className="merchant-store-hero-kicker"><Store size={15}/> TU ESTABLECIMIENTO</span>
                <h2>{restaurant?.name||'Mi comercio'}</h2>
                <p>{restaurant?.cuisine||'Comercio local'}{restaurant?.address?' · '+restaurant.address:''}</p>
                <span className={'merchant-store-state '+(restaurant?.is_open?'open':'')}><span/>{restaurant?.is_open?'Aceptando pedidos según configuración':'Comercio cerrado'}</span>
              </div>
              <button type="button" className="merchant-store-hero-action" onClick={()=>setSection('menu')}>Gestionar productos <ChevronRight size={18}/></button>
            </section>
            <div className="merchant-settings-grid"><section className="merchant-setting-card"><span className="merchant-setting-icon"><Store size={23}/></span><h2>{restaurant?.name||'Mi comercio'}</h2><p><MapPin size={16}/>{restaurant?.address||'Dirección sin publicar'}</p><div className="merchant-setting-row"><span>Verificación</span><strong>{restaurant?.verification_status||'Sin información'}</strong></div><div className="merchant-setting-row"><span>Pedidos para recoger</span><strong>{restaurant?.pickup_enabled?'Habilitados':'Deshabilitados'}</strong></div></section>
              <section className="merchant-setting-card"><span className="merchant-setting-icon"><Clock3 size={23}/></span><h2>Disponibilidad</h2><p>El estado se confirma con el backend al guardar.</p><div className={'merchant-availability '+(restaurant?.is_open?'is-open':'')}><span className="merchant-status-dot"/><strong>{restaurant?.is_open?'Tu negocio está abierto':'Tu negocio está cerrado'}</strong></div><button className="merchant-main-button" disabled={savingStore||!restaurant||!online} onClick={()=>void toggleStore()}>{savingStore?'Guardando…':restaurant?.is_open?'Cerrar temporalmente':'Abrir comercio'}<ChevronRight size={17}/></button><small>Para abrir, el servidor puede exigir verificación del comercio. Esta acción no modifica métodos de pago ni permisos financieros.</small></section></div>
          </>}
        </>}
      </div>
    </div>
    {selectedOrder&&<div className="merchant-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedOrderId(null)}}>
      <section ref={detailRef} className="merchant-detail-sheet" role="dialog" aria-modal="true" aria-label={'Detalles del pedido #'+selectedOrder.id} aria-describedby="merchant-detail-help">
        <header className="merchant-detail-header"><div><small>DETALLE DEL PEDIDO</small><h2>Pedido #{selectedOrder.id}</h2></div><button type="button" autoFocus aria-label="Cerrar detalles" onClick={()=>setSelectedOrderId(null)}><X size={22}/></button></header>
        <div className="merchant-detail-scroll"><div className="merchant-detail-intro"><span className={'merchant-order-status state-'+selectedOrder.status}>{STATUS_LABEL[selectedOrder.status]||selectedOrder.status}</span><span>{orderTime(selectedOrder.created_at)} · {elapsedOrderTime(selectedOrder.created_at,clock)}</span></div>
          <div className="merchant-detail-info"><span><ShoppingBag size={17}/>{selectedOrder.order_type==='pickup'?'Recoger en tienda':'Entrega a domicilio'}</span><span><ReceiptText size={17}/>{selectedOrder.payment_method==='cash'?'Efectivo':'Tarjeta'} · {selectedOrder.payment_status||'Sin datos del pago'}</span>{selectedOrder.address&&<span><MapPin size={17}/>{selectedOrder.address}</span>}</div>
          {kitchenStepIndex(selectedOrder.status)>=0&&<div className="merchant-kitchen-tracker" aria-label="Estado de preparación del pedido">
            {KITCHEN_STEPS.map((step,i)=><div key={step.id} className={'merchant-kitchen-step '+(i<=kitchenStepIndex(selectedOrder.status)?'done ':'')+(i===kitchenStepIndex(selectedOrder.status)?'current':'')}>
              <span className="merchant-kitchen-step-dot">{i<kitchenStepIndex(selectedOrder.status)?<Check size={13}/>:i+1}</span>
              <span>{step.label}</span>
            </div>)}
          </div>}
          <h3>Productos del pedido</h3><div className="merchant-detail-lines">{(selectedOrder.items??[]).map((item,i)=><div key={item.id??i}><span className="merchant-detail-item-qty">{item.quantity}×</span><strong>{item.name_snapshot}</strong><span>{pesos(Number(item.unit_price)*item.quantity)}</span></div>)}</div>
          <div className="merchant-detail-total"><span>Total del pedido</span><strong>{pesos(selectedOrder.total)}</strong></div>
          <p className="merchant-detail-hint" id="merchant-detail-help">La información se obtiene del servidor. Los tiempos de preparación y la asignación del repartidor dependen del backend.</p>
        </div>
        <div className="merchant-detail-actions"><button type="button" className="merchant-print-button" onClick={()=>window.print()} aria-label="Imprimir comanda del pedido"><Printer size={17}/> Imprimir comanda</button>{selectedOrder.status==='received'&&<button type="button" disabled={busyOrder!==null||Boolean(errors.orders)||!online||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'confirmed')}>Aceptar pedido <ChevronRight size={17}/></button>}{selectedOrder.status==='confirmed'&&<button type="button" disabled={busyOrder!==null||Boolean(errors.orders)||!online||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'preparing')}>Iniciar preparación <ChevronRight size={17}/></button>}{selectedOrder.status==='preparing'&&<button type="button" disabled={busyOrder!==null||Boolean(errors.orders)||!online||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'ready')}>Marcar como listo <ChevronRight size={17}/></button>}</div>
      </section>
    </div>}
    <nav className="merchant-mobile-nav" aria-label="Navegación inferior del restaurante">{NAV.map(n=><button key={n.id} type="button" className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={21}/><span>{n.mobileLabel}</span>{n.id==='pedidos'&&newCount>0&&<i>{newCount}</i>}</button>)}</nav>
  </div>;
}
