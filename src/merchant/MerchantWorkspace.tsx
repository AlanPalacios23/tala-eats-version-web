import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {
  BarChart3, Check, CheckCircle2, Sprout, ChevronDown, ChevronRight, ClipboardList, Clock3,
  BellRing, Coffee, Columns3, FileDown, List, MapPin, Plus, Printer, ReceiptText, RefreshCw,
  Search, Settings2, ShoppingBag, Store, UtensilsCrossed, LogOut,
  Wallet, WifiOff, X
} from 'lucide-react';
import { api, pesos, safeImage } from '../lib/api';
import {useSession} from '../lib/session';
import type { MenuItem, Order, Restaurant } from '../lib/types';
import MerchantWallet from './MerchantWallet';
import MerchantInstallCard from './MerchantInstallCard';
import MerchantUpdateBanner from './MerchantUpdateBanner';
import MerchantCrece from './MerchantCrece';
import './merchant.css';

type Section = 'pedidos' | 'menu' | 'rendimiento' | 'wallet' | 'negocio' | 'crece';
export const isMerchantSection = (value:string|null):value is Section =>
  value==='pedidos'||value==='menu'||value==='rendimiento'||value==='wallet'||value==='negocio'||value==='crece';
type OrderFilter = 'activos' | 'nuevos' | 'preparando' | 'listos' | 'historial' | 'todos';
type MenuFilter = 'todos' | 'disponibles' | 'bajo' | 'agotados' | 'pausados';
type OwnerAnalytics = {orders: number; delivered: number; gross_sales: number; inventory_low: number};
type StatusAction = 'confirmed' | 'preparing' | 'ready';
const ACTIVE = new Set(['received', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'on_the_way']);
export function orderPaymentConfirmed(order:Pick<Order,'payment_method'|'payment_status'>):boolean {
  // El backend exige cobro confirmado antes de aceptar/preparar pedidos Stripe.
  // Las respuestas de red no tienen tipos garantizados en runtime: fallar cerrado.
  return order.payment_method==='cash'||
    (order.payment_method==='stripe'&&order.payment_status==='paid');
}
export const merchantPaymentLabel=(method:string):string =>
  method==='cash'?'Efectivo':method==='stripe'?'Tarjeta':'Pago por verificar';
export function merchantPaymentStatusLabel(status:string|null|undefined):string {
  const labels:Record<string,string>={
    paid:'Pagado',pending:'Pendiente',failed:'Rechazado',
    refunded:'Reembolsado',partially_refunded:'Reembolso parcial',
    cancelled:'Cancelado',canceled:'Cancelado',awaiting_payment:'Pendiente'
  };
  return typeof status==='string'?labels[status.toLowerCase()]||'Sin confirmar':'Sin confirmar';
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
  {id:'negocio',label:'Mi negocio',mobileLabel:'Negocio',icon:Settings2},
  {id:'crece',label:'Tala Eats Crece',mobileLabel:'Crece',icon:Sprout}
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
// Los tipos TypeScript no validan JSON de producción. La API puede responder
// 200 con datos parciales; nunca permitir que un payload defectuoso rompa la cola.
export function isMerchantOrderList(value:unknown):value is Order[] {
  if(!Array.isArray(value))return false;
  return value.every(entry=>{
    if(!entry||typeof entry!=='object')return false;
    const order=entry as Record<string,unknown>;
    if(!Number.isSafeInteger(order.id)||Number(order.id)<=0||
      typeof order.status!=='string'||typeof order.created_at!=='string'||
      !['pickup','delivery'].includes(String(order.order_type))||
      typeof order.payment_method!=='string'||
      (typeof order.total!=='string'&&typeof order.total!=='number')||
      !Number.isFinite(Number(order.total)))return false;
    const items=order.items;
    return items==null||(Array.isArray(items)&&items.every(item=>
      item&&typeof item==='object'&&typeof item.name_snapshot==='string'&&
      Number.isFinite(Number(item.quantity))&&Number(item.quantity)>=0
    ));
  });
}
export function isOrderSnapshotFresh(lastSync:Date|null,now:number,online:boolean,hasError:boolean):boolean {
  return online&&!hasError&&!!lastSync&&Number.isFinite(lastSync.getTime())&&
    now>=lastSync.getTime()&&now-lastSync.getTime()<120_000;
}
export function exportOrderSummaryCsv(orders:Order[]):string {
  // Reporte acotado a la vista cargada; no exporta direcciones, PIN ni datos personales.
  const escapeCell=(value:unknown):string=>{
    const text=String(value??'');
    // Mitigar inyección de fórmulas en hojas de cálculo, incluso con prefijos invisibles.
    const safe=/^[\s\t\r\n]*[=+@-]/.test(text)?"'"+text:text;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  const rows=[['Pedido','Fecha','Estado','Entrega','Pago','Estado pago','Artículos','Total MXN'],...orders.map(o=>[
    o.id,o.created_at,o.status,o.order_type,o.payment_method,o.payment_status,
    (o.items??[]).reduce((n,i)=>n+Math.max(0,Number(i.quantity)||0),0),o.total
  ])];
  return '\uFEFF'+rows.map(row=>row.map(escapeCell).join(',')).join('\r\n')+'\r\n';
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
function MenuRow({item,onSaved,online,onWriteStart,onWriteEnd,onDirtyChange,locked}:{
  item:MenuItem;onSaved:(updated:MenuItem)=>Promise<void>;online:boolean;
  onWriteStart:()=>boolean;onWriteEnd:()=>void;onDirtyChange:(id:number,dirty:boolean)=>void;locked:boolean
}) {
  const [price,setPrice]=useState(String(item.price));
  const [stock,setStock]=useState(item.stock);
  const [available,setAvailable]=useState(item.is_available);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [notice,setNotice]=useState('');
  const rowWriteLock=useRef(false);
  const dirty=price!==String(item.price)||stock!==item.stock||available!==item.is_available;
  useEffect(()=>{
    onDirtyChange(item.id,dirty);
    return()=>onDirtyChange(item.id,false);
  },[item.id,dirty,onDirtyChange]);
  useEffect(()=>{
    // Los GET periódicos no borran los cambios de un producto que el usuario edita.
    if(editing||saving||rowWriteLock.current)return;
    setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);
  },[item.id,item.price,item.stock,item.is_available,editing,saving]);
  const valid=Number.isFinite(Number(price))&&Number(price)>=0&&/^\d+(\.\d{1,2})?$/.test(price)&&Number.isSafeInteger(stock)&&stock>=0;
  const save=async()=>{
    if(!dirty||!valid||rowWriteLock.current||locked||!online||!onWriteStart())return;
    rowWriteLock.current=true;setSaving(true);setNotice('');
    try {
      const updated=await api.ownerUpdateItem(item.id,{price,stock,is_available:available});
      await onSaved(updated);setEditing(false);setExpanded(false);setNotice('Cambios guardados');
    }catch(e){setNotice(errorMessage(e));}finally{rowWriteLock.current=false;setSaving(false);onWriteEnd();}
  };
  const quickAvailability=async()=>{
    if(rowWriteLock.current||locked||!online)return;
    if(dirty){setNotice('Guarda primero los cambios pendientes.');return;}
    if(!onWriteStart())return;
    rowWriteLock.current=true;setSaving(true);setNotice('');
    try{
      const updated=await api.ownerUpdateItem(item.id,{is_available:!item.is_available});
      await onSaved(updated);setExpanded(false);setNotice(item.is_available?'Producto pausado':'Producto disponible');
    }catch(e){setNotice(errorMessage(e));}finally{rowWriteLock.current=false;setSaving(false);onWriteEnd();}
  };
  const undo=()=>{if(saving)return;setEditing(false);setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);setNotice('Cambios descartados');};
  const img=safeImage(item.image_url);
  return <article className={'merchant-product '+(expanded?'is-expanded':'')}>
    <div className="merchant-product-image">{img?<img src={img} loading="lazy" alt={item.name}/>:<Coffee size={25} aria-hidden="true"/>}</div>
    <div className="merchant-product-body">
      <div className="merchant-product-topline">
        <div className="merchant-product-name">
          <h3>{item.name}</h3>
          <p>{item.category||'General'} <span aria-hidden="true">·</span> {item.is_available?'Disponible':'Pausado'}</p>
        </div>
        <div className="merchant-product-facts">
          <strong>{pesos(item.price)}</strong>
          <span className={'merchant-stock-indicator '+(item.stock<=5?'low':'')}>{item.stock===0?'Agotado':item.stock<=5?`${item.stock} disponibles`:`${item.stock} en stock`}</span>
        </div>
        <button type="button" className="merchant-product-edit" aria-expanded={expanded} aria-controls={'merchant-product-edit-'+item.id}
          disabled={saving||locked} onClick={()=>{
            if(expanded&&dirty){setNotice('Guarda o deshaz los cambios antes de cerrar.');return;}
            if(expanded){setEditing(false);setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);}
            setExpanded(v=>!v);
          }}>
          {expanded?'Cerrar':'Editar'} <ChevronDown size={16} aria-hidden="true"/>
        </button>
      </div>
      <div className="merchant-product-edit-panel" id={'merchant-product-edit-'+item.id} hidden={!expanded}>
        <div className="merchant-product-controls">
          <label>Precio (MXN)<input aria-label={'Precio de '+item.name} inputMode="decimal" value={price} onChange={e=>{setEditing(true);setPrice(e.target.value)}} /></label>
          <label>Existencias<input aria-label={'Stock de '+item.name} type="number" min="0" step="1" value={stock} onChange={e=>{setEditing(true);setStock(Number(e.target.value))}}/></label>
          <label className="merchant-toggle-label"><input type="checkbox" checked={available} onChange={e=>{setEditing(true);setAvailable(e.target.checked)}}/><span>{available?'Disponible':'Pausado'}</span></label>
        </div>
        <div className="merchant-product-edit-actions">
          <button type="button" className="merchant-small-button" disabled={!dirty||!valid||saving||locked||!online} onClick={()=>void save()} >{saving?'Guardando…':'Guardar cambios'}</button>
          <button type="button" className="merchant-quick-button" disabled={saving||locked||dirty||!online} onClick={()=>void quickAvailability()}>{item.is_available?'Pausar producto':'Reactivar producto'}</button>
          {dirty&&<button className="merchant-discard-button" type="button" disabled={saving||locked} onClick={undo}>Deshacer</button>}
        </div>
      </div>
      {notice&&<p className="merchant-inline-note" role="status">{notice}</p>}
    </div>
  </article>;
}

export default function MerchantWorkspace(){
  const {logout}=useSession();
  // Las pestañas usan el historial nativo del navegador: Android Atrás,
  // gesto Atrás de iOS y enlaces compartibles navegan a la sección correcta.
  const [searchParams,setSearchParams]=useSearchParams();
  const navigate=useNavigate();
  const dirtyMenuRows=useRef(new Set<number>());
  const addDraftPending=useRef(false);
  const markMenuDirty=useCallback((id:number,dirty:boolean)=>{
    if(dirty)dirtyMenuRows.current.add(id);else dirtyMenuRows.current.delete(id);
  },[]);
  const candidate=searchParams.get('tab');
  const section:Section=isMerchantSection(candidate)?candidate:'pedidos';
  const setSection=useCallback((target:Section)=>{
    if(target===section)return;
    if(section==='menu'&&(dirtyMenuRows.current.size>0||addDraftPending.current)){
      setNoticeError(true);
      setNotice('Guarda o deshaz los cambios del menú antes de cambiar de sección.');
      if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
      window.scrollTo({top:0,behavior:'auto'});
      return;
    }
    setSearchParams(previous=>{
      const next=new URLSearchParams(previous);
      if(target==='pedidos')next.delete('tab');else next.set('tab',target);
      next.delete('order');
      return next;
    },{preventScrollReset:true});
  },[section,setSearchParams]);
  const [keyboardVisible,setKeyboardVisible]=useState(false);
  useEffect(()=>{
    // visualViewport distingue el teclado virtual del cambio de orientación.
    const viewport=window.visualViewport;
    if(!viewport)return;
    let baseHeight=Math.max(window.innerHeight,viewport.height);
    let width=viewport.width;
    const update=()=>{
      const focused=document.activeElement;
      const editable=focused instanceof HTMLInputElement||
        focused instanceof HTMLTextAreaElement||
        focused instanceof HTMLSelectElement||
        (focused instanceof HTMLElement&&focused.isContentEditable);
      // Chrome Android puede reducir también innerHeight. Recordar el alto previo
      // al teclado en lugar de depender solo de la diferencia de viewports.
      if(Math.abs(viewport.width-width)>40){
        width=viewport.width;
        baseHeight=Math.max(window.innerHeight,viewport.height);
      }
      if(!editable)baseHeight=Math.max(window.innerHeight,viewport.height);
      const covered=Math.max(
        window.innerHeight-viewport.height-viewport.offsetTop,
        baseHeight-viewport.height-viewport.offsetTop
      );
      setKeyboardVisible(Boolean(editable&&covered>140));
    };
    viewport.addEventListener('resize',update);
    viewport.addEventListener('scroll',update);
    document.addEventListener('focusin',update);
    document.addEventListener('focusout',update);
    return()=>{
      viewport.removeEventListener('resize',update);
      viewport.removeEventListener('scroll',update);
      document.removeEventListener('focusin',update);
      document.removeEventListener('focusout',update);
    };
  },[]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});},[section]);
  const [filter,setFilter]=useState<OrderFilter>('activos');
  const [orderView,setOrderView]=useState<'board'|'list'>('board');
  // El detalle es otra entrada del historial para que Atrás cierre la hoja,
  // en lugar de abandonar la app con un pedido abierto.
  const rawOrderId=searchParams.get('order');
  const selectedOrderId=rawOrderId&&/^[1-9]\d{0,12}$/.test(rawOrderId)&&
    Number.isSafeInteger(Number(rawOrderId))?Number(rawOrderId):null;
  const openedSheetHere=useRef(false);
  const setSelectedOrderId=useCallback((id:number|null)=>{
    if(id===null&&selectedOrderId!==null&&openedSheetHere.current){
      openedSheetHere.current=false;
      navigate(-1);
      return;
    }
    if(id!==null)openedSheetHere.current=true;
    setSearchParams(previous=>{
      const next=new URLSearchParams(previous);
      if(id===null)next.delete('order');else next.set('order',String(id));
      return next;
    },{replace:id===null,preventScrollReset:true});
  },[navigate,selectedOrderId,setSearchParams]);
  useEffect(()=>{if(selectedOrderId===null)openedSheetHere.current=false;},[selectedOrderId]);
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
  const [loggingOut,setLoggingOut]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [notice,setNotice]=useState('');
  const [noticeError,setNoticeError]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [newName,setNewName]=useState('');
  const [newPrice,setNewPrice]=useState('');
  const [newStock,setNewStock]=useState(20);
  const [newCategory,setNewCategory]=useState('General');
  const [newDescription,setNewDescription]=useState('');
  useEffect(()=>{
    addDraftPending.current=addOpen&&(newName.trim()!==''||newPrice.trim()!==''||
      newStock!==20||newCategory!=='General'||newDescription.trim()!=='');
  },[addOpen,newName,newPrice,newStock,newCategory,newDescription]);
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
  const [clock,setClock]=useState(()=>Date.now());
  const [menuMutating,setMenuMutating]=useState(false);
  const readGeneration=useRef(0);
  const knownReceivedIds=useRef<Set<number>|null>(null);
  const readInFlight=useRef(false);
  const mutationInFlight=useRef(false);
  const menuMutationInFlight=useRef(false);
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
  },[selectedOrderId,setSelectedOrderId]);
  useEffect(()=>{
    const tick=window.setInterval(()=>setClock(Date.now()),30000);
    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    return()=>{window.clearInterval(tick);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};
  },[]);

  const refresh=useCallback(async (quiet=false) => {
    // Sin peticiones duplicadas ni lecturas que compitan con escrituras.
    if(quiet&&(readInFlight.current||mutationInFlight.current||menuMutationInFlight.current))return;
    const generation=++readGeneration.current;
    readInFlight.current=true;
    if(!quiet)setRefreshing(true);
    try {
      const [r,o,a]=await Promise.allSettled([api.ownerRestaurant(),api.ownerOrders(),api.ownerAnalytics()]);
      if(generation!==readGeneration.current)return;
      const nextErrors: {restaurant?:string;orders?:string;analytics?:string}={};
      if(r.status==='fulfilled')setRestaurant(r.value);else nextErrors.restaurant=errorMessage(r.reason);
      if(o.status==='fulfilled'&&isMerchantOrderList(o.value)){
        const receivedIds=o.value.filter(order=>order.status==='received').map(order=>order.id);
        if(knownReceivedIds.current===null)knownReceivedIds.current=new Set(receivedIds);
        else {
          const arriving=receivedIds.filter(id=>!knownReceivedIds.current?.has(id));
          receivedIds.forEach(id=>knownReceivedIds.current?.add(id));
          if(arriving.length)setFreshOrderIds(prev=>Array.from(new Set([...prev,...arriving])));
        }
        const confirmedAt=new Date();setOrders(o.value);setLastSync(confirmedAt);setClock(confirmedAt.getTime());
      }else nextErrors.orders=o.status==='rejected'?errorMessage(o.reason):
        'Respuesta de pedidos incompleta. No se permiten cambios hasta sincronizar datos válidos.';
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
    const onReconnect=()=>{if(document.visibilityState==='visible')void refresh(true);};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('online',onReconnect);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',onReconnect);};
  },[refresh,section]);

  const ordersFresh=isOrderSnapshotFresh(lastSync,clock,online,Boolean(errors.orders));
  const beginMenuMutation=()=>{
    if(menuMutationInFlight.current||mutationInFlight.current||!navigator.onLine)return false;
    menuMutationInFlight.current=true;setMenuMutating(true);
    readGeneration.current++;readInFlight.current=false;setRefreshing(false);
    return true;
  };
  const endMenuMutation=()=>{menuMutationInFlight.current=false;setMenuMutating(false);};
  const downloadOrders=()=>{
    if(!isOrderSnapshotFresh(lastSync,Date.now(),navigator.onLine,Boolean(errors.orders))||filteredOrders.length===0)return;
    const csv=exportOrderSummaryCsv(filteredOrders);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='tala-eats-pedidos-vista-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);link.click();link.remove();
    // Safari/iOS puede cancelar descargas si se revoca inmediatamente.
    window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
  };

  const exitMerchant=async()=>{
    if(loggingOut||mutationInFlight.current||menuMutationInFlight.current||
      dirtyMenuRows.current.size>0||addDraftPending.current){
      setNoticeError(true);
      setNotice('Finaliza operaciones y guarda o deshaz tus cambios antes de cerrar sesión.');
      return;
    }
    setLoggingOut(true);
    try{await logout();}
    catch(e){setNoticeError(true);setNotice(errorMessage(e));}
    finally{setLoggingOut(false);}
  };

  const newCount=orders.filter(o=>o.status==='received').length;
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
    if(mutationInFlight.current||menuMutationInFlight.current)return;
    // Consultar el reloj REAL justo al pulsar: el reloj de UI puede tener
    // hasta 30 segundos de retraso cuando el teléfono vuelve del background.
    if(!isOrderSnapshotFresh(lastSync,Date.now(),navigator.onLine,Boolean(errors.orders))){
      setNoticeError(true);setNotice('La cola de pedidos necesita sincronizarse antes de continuar.');
      return;
    }
    const current=orders.find(order=>order.id===id);
    if(!current){setNoticeError(true);setNotice('Este pedido ya no está disponible. Actualiza la lista.');return;}
    const expected:Record<StatusAction,string>={confirmed:'received',preparing:'confirmed',ready:'preparing'};
    if(current.status!==expected[status]){
      setNoticeError(true);setNotice('El estado de este pedido cambió. Actualiza antes de continuar.');
      return;
    }
    if(!orderPaymentConfirmed(current)){
      setNoticeError(true);setNotice('El método de pago no está verificado. Para Stripe se requiere un cobro confirmado.');
      return;
    }
    mutationInFlight.current=true;readGeneration.current++;readInFlight.current=false;setRefreshing(false);
    setBusyOrder(id);setNotice('');setNoticeError(false);
    try{
      const updated=await api.ownerUpdateStatus(id,status);
      // El resultado de la mutación confirmada es la fuente de verdad si el GET posterior falla.
      if(updated?.id!==id||updated.status!==status){
        setNoticeError(true);
        setNotice('El servidor no confirmó el nuevo estado. Sincroniza antes de intentar otra vez.');
        await refresh(false);
        return;
      }
      setOrders(prev=>prev.map(order=>order.id===id?{...order,...updated}:order));
      await refresh(false);
      setNotice('Pedido #'+id+' actualizado correctamente.');
    }catch(e){setNoticeError(true);setNotice('Pedido #'+id+': '+errorMessage(e));}
    finally{setBusyOrder(null);mutationInFlight.current=false;}
  };
  const toggleStore=async()=>{
    if(!restaurant||mutationInFlight.current||menuMutationInFlight.current||!navigator.onLine)return;
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
    e.preventDefault();if(mutationInFlight.current||menuMutationInFlight.current||!navigator.onLine)return;
    const price=Number(newPrice);
    if(!newName.trim()||!Number.isFinite(price)||price<0||!/^\d+(\.\d{1,2})?$/.test(newPrice)||!Number.isSafeInteger(newStock)||newStock<0){setNoticeError(true);setNotice('Revisa el nombre, precio y existencias.');return;}
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
      <div className="merchant-order-items">{o.items?.length?<>
        {o.items.slice(0,2).map((i,index)=><div key={i.id??index}><span className="merchant-qty">{i.quantity}×</span><span>{i.name_snapshot}</span></div>)}
        {o.items.length>2&&<span className="merchant-order-more">+{o.items.length-2} productos más · Ver detalle</span>}
      </>:<span className="merchant-secondary">Sin detalle de productos disponible</span>}</div>
      <div className="merchant-order-foot"><span><ReceiptText size={15} aria-hidden="true"/>{merchantPaymentLabel(o.payment_method)} <span className={'merchant-payment-state '+(o.payment_method==='stripe'&&o.payment_status!=='paid'?'is-pending':'')}>{merchantPaymentStatusLabel(o.payment_status)}</span></span></div>
      <div className="merchant-card-actions">
        <button type="button" className="merchant-detail-button" onClick={()=>setSelectedOrderId(o.id)}>Ver detalles <ChevronRight size={16}/></button>
        {next?<button type="button" className="merchant-order-action" disabled={busyOrder!==null||!ordersFresh||menuMutating||awaitingStripePayment} title={!ordersFresh?'Sincroniza pedidos antes de avanzar':awaitingStripePayment?'Es necesario validar el método de pago antes de avanzar':undefined} onClick={()=>void changeStatus(o.id,next)}>{busyOrder===o.id?'Actualizando…':awaitingStripePayment?(o.payment_method==='stripe'?'Esperando cobro':'Pago no verificado'):label}<ChevronRight size={17}/></button>:<div className="merchant-order-wait"><CheckCircle2 size={16}/>{o.status==='ready'?'Esperando recogida':o.status==='delivered'?'Finalizado':o.status==='cancelled'?'Cancelado':'En seguimiento'}</div>}
      </div>
    </article>;
  };
  const queues=[
    {id:'nuevos',title:'Nuevos',subtitle:'Por aceptar',statuses:['received'],count:newCount},
    {id:'preparando',title:'En preparación',subtitle:'Pedidos activos en cocina',statuses:['confirmed','preparing'],count:orders.filter(o=>['confirmed','preparing'].includes(o.status)).length},
    {id:'listos',title:'Listos',subtitle:'Esperando recogida o entrega',statuses:['ready','assigned','picked_up','on_the_way'],count:orders.filter(o=>['ready','assigned','picked_up','on_the_way'].includes(o.status)).length}
  ];

  return <div className={"merchant-shell"+(keyboardVisible?" merchant-keyboard-open":"")}>
    <aside className="merchant-sidebar" aria-label="Panel de navegación del restaurante">
      <div className="merchant-logo"><span className="merchant-logo-mark"><Store size={22}/></span><span>Tala <b>Eats</b><small>RESTAURANTES</small></span></div>
      <nav className="merchant-nav" aria-label="Secciones del restaurante">{NAV.map(n=><button type="button" key={n.id} className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={20} strokeWidth={2}/>{n.label}{n.id==='pedidos'&&newCount>0&&<span className="merchant-nav-count">{newCount}</span>}</button>)}</nav>
      <div className="merchant-sidebar-spacer"/>
      <div className="merchant-sidebar-store"><div className="merchant-sidebar-avatar"><Store size={20}/></div><div><strong>{restaurant?.name||'Mi comercio'}</strong><small>Mi espacio</small></div></div>
    </aside>
    <div className="merchant-workspace">
      <header className="merchant-toolbar">
        <div className="merchant-mobile-logo"><span className="merchant-mobile-symbol"><Store size={19}/></span><span>Tala <b>Eats</b> <small>Restaurantes</small></span></div>
        <div className="merchant-breadcrumb"><strong>{restaurant?.name||'Mi negocio'}</strong><span aria-hidden="true">/</span><span>{NAV.find(n=>n.id===section)?.label}</span></div>
        <div className="merchant-toolbar-actions"><span className={"merchant-connection "+(online?"connected":"offline")} title={online?"Conexión de red disponible":"Sin conexión"}><span/>{online?"Conectado":"Sin conexión"}</span>
          {restaurant&&<button type="button" onClick={()=>setSection('negocio')} className={'merchant-open-pill '+(restaurant.is_open?'is-open':'')} aria-label="Ver disponibilidad y ajustes del comercio"><span className="merchant-status-dot"/>{restaurant.is_open?'Abierto':'Cerrado'}</button>}
          <button className="merchant-refresh" type="button" disabled={refreshing||menuMutating} onClick={()=>void refresh()} aria-label="Actualizar datos" title="Actualizar datos"><RefreshCw size={18} className={refreshing?'merchant-spin':''} aria-hidden="true"/></button>
          <button className="merchant-logout" type="button" disabled={loggingOut} onClick={()=>void exitMerchant()} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} aria-hidden="true"/></button>
        </div>
      </header>
      <div className="merchant-content">
        {loading?<div className="merchant-skeleton" role="status" aria-label="Cargando información del restaurante">
          <div className="merchant-skeleton-header"><div className="merchant-skeleton-line big"/><div className="merchant-skeleton-line short"/></div>
          <div className="merchant-skeleton-line medium"/><div className="merchant-skeleton-cards">{[0,1,2].map(n=><div className="merchant-skeleton-panel tall" key={n}><div className="merchant-skeleton-line medium"/><div className="merchant-skeleton-line short"/><div className="merchant-skeleton-line big"/></div>)}</div>
          <span className="merchant-sr-only">Consultando tu negocio…</span>
        </div>:<>
          <MerchantUpdateBanner locked={busyOrder!==null||menuMutating||savingStore||submitting||refreshing}/>
          {!online&&<div className="merchant-feedback error merchant-offline-alert" role="alert"><WifiOff size={17}/><span>Sin conexión. Los cambios están pausados hasta reconectar.</span></div>}
          {activeFreshOrders.length>0&&<div className="merchant-arrival" role="status" aria-live="polite">
            <div className="merchant-arrival-icon"><BellRing size={18}/></div>
            <div><strong>{activeFreshOrders.length===1?'Nuevo pedido recibido':`${activeFreshOrders.length} pedidos nuevos`}</strong></div>
            <button type="button" className="merchant-arrival-open" onClick={()=>{setSection('pedidos');setFilter('nuevos');setOrderView('list');setFreshOrderIds([])}}>Ver pedidos <ChevronRight size={17}/></button>
            <button type="button" className="merchant-arrival-close" aria-label="Descartar aviso de pedidos nuevos" onClick={()=>setFreshOrderIds([])}><X size={18}/></button>
          </div>}
          {errors.restaurant&&<div className="merchant-feedback error" role="alert"><WifiOff size={18}/><span>No fue posible cargar el comercio: {errors.restaurant}</span><button onClick={()=>void refresh()}>Reintentar</button></div>}
          {notice&&<div className={'merchant-feedback '+(noticeError?'error':'')} role={noticeError?'alert':'status'}>{noticeError?<WifiOff size={18}/>:<CheckCircle2 size={18}/>}<span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
          {section==='pedidos'&&<>
            <div className="merchant-page-heading merchant-orders-title">
              <div><h1>Pedidos</h1><p>Organiza pedidos nuevos, cocina y entregas.</p></div>
              {newCount>0&&activeFreshOrders.length===0&&<button type="button" className="merchant-attention" onClick={()=>{setFilter('nuevos');setOrderView('list')}}><span className="merchant-attention-dot"/>{newCount} {newCount===1?'pedido nuevo':'pedidos nuevos'}<ChevronRight size={16}/></button>}
            </div>
            {restaurant&&!restaurant.is_open&&<div className="merchant-closed-prompt" role="status"><span className="merchant-status-dot"/><div><strong>Tu comercio está cerrado</strong><p>Revisa tu disponibilidad antes de comenzar a recibir nuevos pedidos.</p></div><button type="button" onClick={()=>setSection('negocio')}>Mi negocio <ChevronRight size={15}/></button></div>}
            <div className="merchant-queue-heading"><div><h2>Cola de pedidos <span className={'merchant-sync-pill '+(ordersFresh?'fresh':'stale')} aria-label={ordersFresh?'Pedidos sincronizados':'Pedidos sin sincronización reciente'}><span/>{ordersFresh?'Actualizada':'Sin confirmar'}</span></h2><p>{lastSync?'Última lectura '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(lastSync):'Esperando sincronización'} · actualización automática cada 30 s mientras trabajas aquí.</p></div><div className="merchant-queue-tools"><button type="button" className="merchant-csv-button" disabled={!ordersFresh||!filteredOrders.length} title="Descargar los pedidos visibles, máximo 100 cargados desde la API. Sin direcciones ni PIN." onClick={downloadOrders}><FileDown size={16}/> Exportar vista</button><div className="merchant-view-switch" aria-label="Presentación de pedidos"><button type="button" title="Tablero" aria-label="Ver tablero" aria-pressed={orderView==='board'} className={orderView==='board'?'active':''} onClick={()=>{setOrderView('board');setFilter('activos');setSearch('')}}><Columns3 size={18}/></button><button type="button" title="Lista" aria-label="Ver lista" aria-pressed={orderView==='list'} className={orderView==='list'?'active':''} onClick={()=>setOrderView('list')}><List size={18}/></button></div></div></div>
            {online&&!errors.orders&&!ordersFresh&&<div className="merchant-sync-warning" role="status"><Clock3 size={17}/><span>La última lectura de pedidos ya no es reciente. Las acciones permanecen bloqueadas hasta confirmar información nueva.</span><button type="button" disabled={refreshing||menuMutating} onClick={()=>void refresh()}>Sincronizar</button></div>}
            {errors.orders&&<div className="merchant-feedback error" role="alert">No se pudo actualizar la cola de pedidos: {errors.orders}<button type="button" onClick={()=>void refresh()}>Reintentar</button></div>}
            <div className="merchant-filters">
              <div className="merchant-chips" aria-label="Filtrar pedidos">{([['activos','En curso'],['nuevos','Nuevos'],['preparando','En preparación'],['listos','Listos'],['historial','Historial'],['todos','Todos']] as const).map(([id,label])=><button key={id} type="button" className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{id==='nuevos'&&newCount>0&&<span>{newCount}</span>}</button>)}</div>
              <div className="merchant-search"><Search size={18} aria-hidden="true"/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar número o producto" aria-label="Buscar pedidos"/>{search.length>0&&<button type="button" className="merchant-search-clear" aria-label="Limpiar búsqueda de pedidos" onClick={()=>setSearch('')}><X size={16} aria-hidden="true"/></button>}</div>
            </div>
            {!errors.orders&&(boardAllowed?
              <div className="merchant-board" aria-label="Tablero de pedidos por etapas">{queues.map(q=><section className="merchant-queue-column" key={q.id}>
                <div className="merchant-column-title"><div className={'merchant-column-indicator '+q.id}/><h3>{q.title}</h3><span className="merchant-column-counter">{q.count}</span></div><p>{q.subtitle}</p>
                <div className="merchant-column-cards">{filteredOrders.filter(o=>q.statuses.includes(o.status)).length?filteredOrders.filter(o=>q.statuses.includes(o.status)).map(renderOrder):<div className="merchant-board-empty"><CheckCircle2 size={24}/><span>Sin pedidos aquí</span></div>}</div>
              </section>)}</div>:
              (filteredOrders.length===0?<ScreenEmpty icon={<ClipboardList size={30}/>} title="No hay pedidos en esta vista">{search?'Prueba con otra búsqueda.':'Los pedidos que coincidan con el filtro aparecerán aquí.'}</ScreenEmpty>:<div className="merchant-order-grid">{filteredOrders.map(renderOrder)}</div>))}
          </>}
          {section==='menu'&&<>
            <div className="merchant-page-heading"><div><h1>Menú</h1><p>Productos, precios y disponibilidad.</p></div><button className="merchant-main-button" onClick={()=>setAddOpen(v=>!v)}><Plus size={19}/>{addOpen?'Cerrar formulario':'Agregar producto'}</button></div>
            {addOpen&&<form onSubmit={e=>void addProduct(e)} className="merchant-add-form"><h2>Nuevo producto</h2><div className="merchant-add-grid"><label>Nombre<input required maxLength={150} minLength={2} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre del producto"/></label><label>Categoría<input maxLength={80} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="General"/></label><label>Precio (MXN)<input required value={newPrice} onChange={e=>setNewPrice(e.target.value)} inputMode="decimal" placeholder="89.00"/></label><label>Existencias<input required type="number" min="0" step="1" value={newStock} onChange={e=>setNewStock(Number(e.target.value))}/></label><label className="merchant-add-full">Descripción<input maxLength={500} value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Opcional"/></label></div><div className="merchant-add-actions"><button className="merchant-small-button" disabled={submitting||menuMutating||!online}>{submitting?'Agregando…':'Guardar producto'}</button><button type="button" className="merchant-neutral-button" onClick={()=>setAddOpen(false)}>Cancelar</button></div></form>}
            <div className="merchant-menu-toolbar"><div><h2>Productos <span className="merchant-menu-count">{products.length}</span></h2>{stockLow>0&&<p>{stockLow} requieren revisar existencias</p>}</div><div className="merchant-search"><Search size={18} aria-hidden="true"/><input type="search" placeholder="Buscar en el menú" aria-label="Buscar productos" value={menuSearch} onChange={e=>setMenuSearch(e.target.value)}/>{menuSearch.length>0&&<button type="button" className="merchant-search-clear" aria-label="Limpiar búsqueda de productos" onClick={()=>setMenuSearch('')}><X size={16} aria-hidden="true"/></button>}</div></div>
            <div className="merchant-menu-filterbar">
              <div className="merchant-menu-filters" aria-label="Estado de productos">{([['todos','Todos'],['disponibles','Disponibles'],['bajo','Stock bajo'],['agotados','Agotados'],['pausados','Pausados']] as const).map(([id,label])=><button type="button" key={id} className={menuFilter===id?'active':''} aria-pressed={menuFilter===id} onClick={()=>setMenuFilter(id)}>{label}</button>)}</div>
              {categories.length>1&&<label className="merchant-category-select"><span>Categoría</span><select aria-label="Filtrar categoría" value={menuCategory} onChange={e=>setMenuCategory(e.target.value)}><option value="">Todas</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></label>}
            </div>
            {products.length?<div className="merchant-product-list">{products.map(item=><MenuRow key={item.id} item={item} online={online} onSaved={(updated)=>{setRestaurant(prev=>prev?.menu_items?{...prev,menu_items:prev.menu_items.map(p=>p.id===updated.id?updated:p)}:prev);return refresh(false)}} onWriteStart={beginMenuMutation} onWriteEnd={endMenuMutation} onDirtyChange={markMenuDirty} locked={menuMutating}/>)}</div>:<ScreenEmpty icon={<UtensilsCrossed size={30}/>} title="No se encontraron productos"><button type="button" className="merchant-clear-filters" onClick={()=>{setMenuSearch('');setMenuFilter('todos');setMenuCategory('')}}>Restablecer filtros</button></ScreenEmpty>}
          </>}
          {section==='rendimiento'&&<>
            <div className="merchant-page-heading"><div><h1>Rendimiento</h1><p>Indicadores históricos del comercio.</p></div></div>
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
          </>}
          {section==='wallet'&&<MerchantWallet key={restaurant?.id??'no-restaurant'} restaurantId={restaurant?.id??null}/>}
          {section==='crece'&&<MerchantCrece restaurant={restaurant} metrics={!errors.analytics&&analytics?{orders:analytics.orders,delivered:analytics.delivered,inventory_low:analytics.inventory_low}:null} onNavigate={setSection}/>}
          {section==='negocio'&&<>
            <div className="merchant-page-heading"><div><h1>Mi negocio</h1><p>Disponibilidad e información del comercio.</p></div></div>
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
          </>}
          {/* Mantener montado el listener de instalación desde la pantalla inicial. */}
          <MerchantInstallCard visible={section==='negocio'}/>
          {section==='negocio'&&<>
            <div className="merchant-settings-grid"><section className="merchant-setting-card"><span className="merchant-setting-icon"><Store size={23}/></span><h2>{restaurant?.name||'Mi comercio'}</h2><p><MapPin size={16}/>{restaurant?.address||'Dirección sin publicar'}</p><div className="merchant-setting-row"><span>Verificación</span><strong>{restaurant?.verification_status||'Sin información'}</strong></div><div className="merchant-setting-row"><span>Pedidos para recoger</span><strong>{restaurant?.pickup_enabled?'Habilitados':'Deshabilitados'}</strong></div></section>
              <section className="merchant-setting-card"><span className="merchant-setting-icon"><Clock3 size={23}/></span><h2>Disponibilidad</h2><p>El estado se confirma con el backend al guardar.</p><div className={'merchant-availability '+(restaurant?.is_open?'is-open':'')}><span className="merchant-status-dot"/><strong>{restaurant?.is_open?'Tu negocio está abierto':'Tu negocio está cerrado'}</strong></div><button className="merchant-main-button" disabled={savingStore||menuMutating||!restaurant||!online} onClick={()=>void toggleStore()}>{savingStore?'Guardando…':restaurant?.is_open?'Cerrar temporalmente':'Abrir comercio'}<ChevronRight size={17}/></button><small>Para abrir, el servidor puede exigir verificación del comercio. Esta acción no modifica métodos de pago ni permisos financieros.</small></section></div>
          </>}
        </>}
      </div>
    </div>
    {selectedOrder&&<div className="merchant-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedOrderId(null)}}>
      <section ref={detailRef} className="merchant-detail-sheet" role="dialog" aria-modal="true" aria-label={'Detalles del pedido #'+selectedOrder.id} aria-describedby="merchant-detail-help">
        <header className="merchant-detail-header"><div><small>DETALLE DEL PEDIDO</small><h2>Pedido #{selectedOrder.id}</h2></div><button type="button" autoFocus aria-label="Cerrar detalles" onClick={()=>setSelectedOrderId(null)}><X size={22}/></button></header>
        <div className="merchant-detail-scroll"><div className="merchant-detail-intro"><span className={'merchant-order-status state-'+selectedOrder.status}>{STATUS_LABEL[selectedOrder.status]||selectedOrder.status}</span><span>{orderTime(selectedOrder.created_at)} · {elapsedOrderTime(selectedOrder.created_at,clock)}</span></div>
          <div className="merchant-detail-info"><span><ShoppingBag size={17}/>{selectedOrder.order_type==='pickup'?'Recoger en tienda':'Entrega a domicilio'}</span><span><ReceiptText size={17}/>{merchantPaymentLabel(selectedOrder.payment_method)} · {merchantPaymentStatusLabel(selectedOrder.payment_status)}</span>{selectedOrder.address&&<span><MapPin size={17}/>{selectedOrder.address}</span>}</div>
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
        <div className="merchant-detail-actions"><button type="button" className="merchant-print-button" onClick={()=>window.print()} aria-label="Imprimir comanda del pedido"><Printer size={17}/> Imprimir comanda</button>{selectedOrder.status==='received'&&<button type="button" disabled={busyOrder!==null||!ordersFresh||menuMutating||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'confirmed')}>Aceptar pedido <ChevronRight size={17}/></button>}{selectedOrder.status==='confirmed'&&<button type="button" disabled={busyOrder!==null||!ordersFresh||menuMutating||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'preparing')}>Iniciar preparación <ChevronRight size={17}/></button>}{selectedOrder.status==='preparing'&&<button type="button" disabled={busyOrder!==null||!ordersFresh||menuMutating||!orderPaymentConfirmed(selectedOrder)} className="merchant-order-action" onClick={()=>void changeStatus(selectedOrder.id,'ready')}>Marcar como listo <ChevronRight size={17}/></button>}</div>
      </section>
    </div>}
    <nav className="merchant-mobile-nav" aria-label="Navegación inferior del restaurante">{NAV.map(n=><button key={n.id} type="button" className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={21}/><span>{n.mobileLabel}</span>{n.id==='pedidos'&&newCount>0&&<i>{newCount}</i>}</button>)}</nav>
  </div>;
}
