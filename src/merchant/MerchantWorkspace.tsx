import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  BarChart3, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  Coffee, Inbox, LayoutDashboard, MapPin, PackageCheck, Plus, RefreshCw,
  Search, Settings2, ShoppingBag, SlidersHorizontal, Store, UtensilsCrossed,
  WifiOff, X
} from 'lucide-react';
import { api, pesos, safeImage } from '../lib/api';
import type { MenuItem, Order, Restaurant } from '../lib/types';
import './merchant.css';

type Section = 'pedidos' | 'menu' | 'rendimiento' | 'negocio';
type OrderFilter = 'activos' | 'nuevos' | 'historial' | 'todos';
type OwnerAnalytics = {orders: number; delivered: number; gross_sales: number; inventory_low: number};
type StatusAction = 'confirmed' | 'preparing' | 'ready';
const ACTIVE = new Set(['received', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'on_the_way']);
const STATUS_LABEL: Record<string, string> = {
  received: 'Nuevo', confirmed: 'Aceptado', preparing: 'En preparación',
  ready: 'Listo para recoger', assigned: 'Repartidor asignado',
  picked_up: 'Recogido', on_the_way: 'En camino', delivered: 'Entregado',
  cancelled: 'Cancelado', awaiting_payment: 'Pago pendiente'
};
const NAV: {id: Section; label: string; icon: typeof ClipboardList}[] = [
  {id:'pedidos',label:'Pedidos',icon:ClipboardList},
  {id:'menu',label:'Menú',icon:UtensilsCrossed},
  {id:'rendimiento',label:'Rendimiento',icon:BarChart3},
  {id:'negocio',label:'Mi negocio',icon:Settings2}
];
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
function MenuRow({item,onSaved}:{item:MenuItem;onSaved:()=>Promise<void>}) {
  const [price,setPrice]=useState(String(item.price));
  const [stock,setStock]=useState(item.stock);
  const [available,setAvailable]=useState(item.is_available);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);},[item.id,item.price,item.stock,item.is_available]);
  const dirty=price!==String(item.price)||stock!==item.stock||available!==item.is_available;
  const valid=Number.isFinite(Number(price))&&Number(price)>=0&&/^\d+(\.\d{1,2})?$/.test(price)&&Number.isSafeInteger(stock)&&stock>=0;
  const save=async()=>{
    if(!dirty||!valid||saving)return;
    setSaving(true);setNotice('');
    try {await api.ownerUpdateItem(item.id,{price,stock,is_available:available});await onSaved();setNotice('Cambios guardados');}
    catch(e){setNotice(errorMessage(e));}finally{setSaving(false);}
  };
  const img=safeImage(item.image_url);
  return <article className="merchant-product">
    <div className="merchant-product-image">{img?<img src={img} loading="lazy" alt={item.name}/>:<Coffee size={25} aria-hidden="true"/>}</div>
    <div className="merchant-product-body">
      <div className="merchant-product-heading"><div><small>{item.category||'General'}</small><h3>{item.name}</h3></div><label className="merchant-toggle-label"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/><span>{available?'Disponible':'Oculto'}</span></label></div>
      <div className="merchant-product-controls">
        <label>Precio (MXN)<input aria-label={'Precio de '+item.name} inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} /></label>
        <label>Existencias<input aria-label={'Stock de '+item.name} type="number" min="0" step="1" value={stock} onChange={e=>setStock(Number(e.target.value))}/></label>
        <button type="button" className="merchant-small-button" disabled={!dirty||!valid||saving} onClick={()=>void save()}>{saving?'Guardando…':'Guardar'}</button>
      </div>
      {notice&&<p className="merchant-inline-note" role="status">{notice}</p>}
    </div>
  </article>;
}

export default function MerchantWorkspace(){
  const [section,setSection]=useState<Section>('pedidos');
  const [filter,setFilter]=useState<OrderFilter>('activos');
  const [search,setSearch]=useState('');
  const [menuSearch,setMenuSearch]=useState('');
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
  const [addOpen,setAddOpen]=useState(false);
  const [newName,setNewName]=useState('');
  const [newPrice,setNewPrice]=useState('');
  const [newStock,setNewStock]=useState(20);
  const [newCategory,setNewCategory]=useState('General');
  const [newDescription,setNewDescription]=useState('');

  const refresh=useCallback(async (quiet=false) => {
    if(!quiet)setRefreshing(true);
    const [r,o,a]=await Promise.allSettled([api.ownerRestaurant(),api.ownerOrders(),api.ownerAnalytics()]);
    const nextErrors: {restaurant?:string;orders?:string;analytics?:string}={};
    if(r.status==='fulfilled')setRestaurant(r.value);else nextErrors.restaurant=errorMessage(r.reason);
    if(o.status==='fulfilled')setOrders(o.value);else nextErrors.orders=errorMessage(o.reason);
    if(a.status==='fulfilled')setAnalytics(a.value);else nextErrors.analytics=errorMessage(a.reason);
    setErrors(nextErrors);setLoading(false);setRefreshing(false);
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    // Consultas solamente: nunca hace cambios comerciales de manera automática.
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible'&&section==='pedidos')void refresh(true);},30000);
    return()=>window.clearInterval(timer);
  },[refresh,section]);

  const newCount=orders.filter(o=>o.status==='received').length;
  const activeCount=orders.filter(o=>ACTIVE.has(o.status)).length;
  const stockLow=restaurant?.menu_items?.filter(p=>p.stock<=5).length??0;
  const filteredOrders=useMemo(()=>{
    const text=search.trim().toLocaleLowerCase('es-MX');
    return orders.filter(o=>{
      const byStatus=filter==='todos'||(filter==='nuevos'&&o.status==='received')||(filter==='activos'&&ACTIVE.has(o.status))||(filter==='historial'&&!ACTIVE.has(o.status));
      const bySearch=!text||String(o.id).includes(text)||(o.items??[]).some(i=>i.name_snapshot.toLocaleLowerCase('es-MX').includes(text));
      return byStatus&&bySearch;
    }).sort((a,b)=>{
      const rank=(s:string)=>s==='received'?0:s==='confirmed'?1:s==='preparing'?2:s==='ready'?3:4;
      return rank(a.status)-rank(b.status)||new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
    });
  },[orders,filter,search]);
  const products=useMemo(()=> (restaurant?.menu_items??[]).filter(p=>(p.name+' '+(p.category||'')).toLocaleLowerCase('es-MX').includes(menuSearch.trim().toLocaleLowerCase('es-MX'))),[restaurant,menuSearch]);

  const changeStatus=async(id:number,status:StatusAction)=>{
    if(busyOrder!==null)return;
    setBusyOrder(id);setNotice('');
    try{await api.ownerUpdateStatus(id,status);await refresh(true);setNotice('Pedido #'+id+' actualizado correctamente.');}
    catch(e){setNotice('Pedido #'+id+': '+errorMessage(e));}
    finally{setBusyOrder(null);}
  };
  const toggleStore=async()=>{
    if(!restaurant||savingStore)return;
    setSavingStore(true);setNotice('');
    try{await api.ownerUpdateRestaurant({is_open:!restaurant.is_open});await refresh(true);setNotice('Disponibilidad actualizada en el servidor.');}
    catch(e){setNotice(errorMessage(e));}
    finally{setSavingStore(false);}
  };
  const addProduct=async(e:FormEvent)=>{
    e.preventDefault();if(submitting)return;
    const price=Number(newPrice);
    if(!newName.trim()||!Number.isFinite(price)||price<0||!/^\d+(\.\d{1,2})?$/.test(newPrice)||!Number.isSafeInteger(newStock)||newStock<0){setNotice('Revisa el nombre, precio y existencias.');return;}
    setSubmitting(true);setNotice('');
    try{
      await api.ownerAddItem({name:newName.trim(),price:newPrice,stock:newStock,description:newDescription.trim(),category:newCategory.trim()||'General',is_available:true});
      setNewName('');setNewPrice('');setNewStock(20);setNewCategory('General');setNewDescription('');setAddOpen(false);
      await refresh(true);setNotice('Producto agregado correctamente.');
    }catch(e){setNotice(errorMessage(e));}finally{setSubmitting(false);}
  };

  return <div className="merchant-shell">
    <aside className="merchant-sidebar" aria-label="Panel de navegación del restaurante">
      <div className="merchant-logo"><span className="merchant-logo-mark"><Store size={22}/></span><span>Tala <b>Eats</b><small>NEGOCIOS</small></span></div>
      <div className="merchant-sidebar-label">ESPACIO DE TRABAJO</div>
      <nav className="merchant-nav" aria-label="Secciones del restaurante">{NAV.map(n=><button type="button" key={n.id} className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={20} strokeWidth={2}/>{n.label}{n.id==='pedidos'&&newCount>0&&<span className="merchant-nav-count">{newCount}</span>}</button>)}</nav>
      <div className="merchant-sidebar-spacer"/>
      <div className="merchant-sidebar-store"><div className="merchant-sidebar-avatar"><Store size={20}/></div><div><strong>{restaurant?.name||'Mi comercio'}</strong><small>{restaurant?.is_open?'Abierto':'Cerrado'}</small></div></div>
    </aside>
    <div className="merchant-workspace">
      <header className="merchant-toolbar">
        <div className="merchant-mobile-logo">Tala <b>Eats</b> <span>Negocios</span></div>
        <div className="merchant-breadcrumb">Panel de restaurante <ChevronRight size={14}/><strong>{NAV.find(n=>n.id===section)?.label}</strong></div>
        <div className="merchant-toolbar-actions">
          {restaurant&&<span className={'merchant-open-pill '+(restaurant.is_open?'is-open':'')}><span className="merchant-status-dot"/>{restaurant.is_open?'Abierto':'Cerrado'}</span>}
          <button className="merchant-refresh" type="button" disabled={refreshing} onClick={()=>void refresh()} aria-label="Actualizar datos" title="Actualizar datos"><RefreshCw size={18} className={refreshing?'merchant-spin':''}/></button>
        </div>
      </header>
      <main className="merchant-content">
        {loading?<div className="merchant-loading"><RefreshCw className="merchant-spin" size={22}/> Consultando tu negocio…</div>:<>
          {errors.restaurant&&<div className="merchant-feedback error" role="alert"><WifiOff size={18}/><span>No fue posible cargar el comercio: {errors.restaurant}</span><button onClick={()=>void refresh()}>Reintentar</button></div>}
          {notice&&<div className="merchant-feedback" role="status"><CheckCircle2 size={18}/>{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
          {section==='pedidos'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">CENTRO DE OPERACIONES</span><h1>Gestión de pedidos</h1><p>Todo lo que necesitas para recibir, preparar y entregar cada pedido.</p></div>{newCount>0&&<span className="merchant-attention"><span className="merchant-attention-dot"/>{newCount} {newCount===1?'pedido nuevo':'pedidos nuevos'}</span>}</div>
            <div className="merchant-overview">
              <Metric label="Pedidos nuevos" value={newCount} note="Por aceptar" icon={<Inbox size={20}/>}/>
              <Metric label="En proceso" value={activeCount} note="En la operación" icon={<Clock3 size={20}/>}/>
              <Metric label="Entregados" value={analytics?.delivered??'—'} note="Histórico del servidor" icon={<PackageCheck size={20}/>}/>
              <Metric label="Ventas entregadas" value={analytics?pesos(analytics.gross_sales):'—'} note="Histórico del servidor" icon={<BarChart3 size={20}/>}/>
            </div>
            {errors.orders&&<div className="merchant-feedback error" role="alert">Error al consultar pedidos: {errors.orders}</div>}
            <div className="merchant-section-header"><div><h2>Pedidos</h2><p>Actualización automática cada 30 segundos mientras esta sección está visible.</p></div><span className="merchant-order-count">{filteredOrders.length} resultados</span></div>
            <div className="merchant-filters">
              <div className="merchant-chips" aria-label="Filtrar pedidos">{([['activos','En curso'],['nuevos','Nuevos'],['historial','Historial'],['todos','Todos']] as const).map(([id,label])=><button key={id} type="button" className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{id==='nuevos'&&newCount>0&&<span>{newCount}</span>}</button>)}</div>
              <label className="merchant-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido o producto" aria-label="Buscar pedidos"/></label>
            </div>
            {!errors.orders&&(filteredOrders.length===0?<ScreenEmpty icon={<ClipboardList size={30}/>} title="No hay pedidos en esta vista">{search?'Prueba con otra búsqueda.':'Los pedidos que coincidan con el filtro aparecerán aquí.'}</ScreenEmpty>:<div className="merchant-order-grid">{filteredOrders.map(o=>{
              const next:StatusAction|null=o.status==='received'?'confirmed':o.status==='confirmed'?'preparing':o.status==='preparing'?'ready':null;
              const label=next==='confirmed'?'Aceptar pedido':next==='preparing'?'Iniciar preparación':next==='ready'?'Marcar como listo':'';
              return <article className={'merchant-order-card '+(o.status==='received'?'is-new':'')} key={o.id}>
                <div className="merchant-order-header"><div><span className="merchant-order-id">PEDIDO #{o.id}</span><small>{orderTime(o.created_at)}</small></div><span className={'merchant-order-status state-'+o.status}>{STATUS_LABEL[o.status]||o.status}</span></div>
                <div className="merchant-order-total"><strong>{pesos(o.total)}</strong><span>{o.order_type==='pickup'?'Para recoger':'Entrega a domicilio'}</span></div>
                <div className="merchant-order-items">{o.items?.length?o.items.map((i,index)=><div key={i.id??index}><span className="merchant-qty">{i.quantity}×</span><span>{i.name_snapshot}</span></div>):<span className="merchant-secondary">Sin detalle de productos disponible</span>}</div>
                <div className="merchant-order-foot"><span><ShoppingBag size={15}/>{o.payment_method==='cash'?'Efectivo':'Tarjeta'} · {o.payment_status||'Estado de pago no disponible'}</span>{o.address&&<span><MapPin size={15}/>{o.address}</span>}</div>
                {next?<button type="button" className="merchant-order-action" disabled={busyOrder!==null} onClick={()=>void changeStatus(o.id,next)}>{busyOrder===o.id?'Actualizando…':label}<ChevronRight size={18}/></button>:<div className="merchant-order-wait"><CheckCircle2 size={17}/>{o.status==='ready'?'Listo. Esperando recolección':o.status==='delivered'?'Pedido completado':o.status==='cancelled'?'Pedido cancelado':'Consulta el avance del pedido'}</div>}
              </article>;
            })}</div>)}
          </>}
          {section==='menu'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">CATÁLOGO</span><h1>Menú y productos</h1><p>Actualiza precios, existencias y disponibilidad sin salir de esta pantalla.</p></div><button className="merchant-main-button" onClick={()=>setAddOpen(v=>!v)}><Plus size={19}/>{addOpen?'Cerrar formulario':'Agregar producto'}</button></div>
            <div className="merchant-menu-info"><span><UtensilsCrossed size={18}/>{restaurant?.menu_items?.length??0} productos</span><span><SlidersHorizontal size={18}/>{stockLow} con 5 unidades o menos</span></div>
            {addOpen&&<form onSubmit={e=>void addProduct(e)} className="merchant-add-form"><h2>Nuevo producto</h2><div className="merchant-add-grid"><label>Nombre<input required maxLength={150} minLength={2} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre del producto"/></label><label>Categoría<input maxLength={80} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="General"/></label><label>Precio (MXN)<input required value={newPrice} onChange={e=>setNewPrice(e.target.value)} inputMode="decimal" placeholder="89.00"/></label><label>Existencias<input required type="number" min="0" step="1" value={newStock} onChange={e=>setNewStock(Number(e.target.value))}/></label><label className="merchant-add-full">Descripción<input maxLength={500} value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Opcional"/></label></div><div className="merchant-add-actions"><button className="merchant-small-button" disabled={submitting}>{submitting?'Agregando…':'Guardar producto'}</button><button type="button" className="merchant-neutral-button" onClick={()=>setAddOpen(false)}>Cancelar</button></div></form>}
            <div className="merchant-menu-toolbar"><h2>Productos publicados</h2><label className="merchant-search"><Search size={18}/><input placeholder="Buscar en el menú" aria-label="Buscar productos" value={menuSearch} onChange={e=>setMenuSearch(e.target.value)}/></label></div>
            {products.length?<div className="merchant-product-list">{products.map(item=><MenuRow key={item.id} item={item} onSaved={()=>refresh(true)}/>)}</div>:<ScreenEmpty icon={<UtensilsCrossed size={30}/>} title="No se encontraron productos">{menuSearch?'Cambia tu búsqueda.':'Agrega tu primer producto para comenzar.'}</ScreenEmpty>}
          </>}
          {section==='rendimiento'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">DATOS DEL NEGOCIO</span><h1>Rendimiento</h1><p>Indicadores históricos del backend. No son ventas estimadas ni cifras del día.</p></div></div>
            {errors.analytics&&<div className="merchant-feedback error" role="alert">Métricas no disponibles: {errors.analytics}</div>}
            <div className="merchant-overview"><Metric label="Total de pedidos" value={analytics?.orders??'—'} note="Histórico" icon={<ClipboardList size={20}/>}/><Metric label="Entregados" value={analytics?.delivered??'—'} note="Histórico" icon={<Check size={20}/>}/><Metric label="Ventas entregadas" value={analytics?pesos(analytics.gross_sales):'—'} note="Cifra del backend" icon={<BarChart3 size={20}/>}/><Metric label="Inventario bajo" value={analytics?.inventory_low??'—'} note="Cifra del backend" icon={<ShoppingBag size={20}/>}/></div>
            <div className="merchant-info-panel"><LayoutDashboard size={24}/><div><h3>Información conectada a tu comercio</h3><p>Estas cifras se actualizan desde la API de Tala Eats. Los reportes financieros detallados, pagos y liquidaciones requieren endpoints verificados adicionales; no se muestran saldos inventados.</p></div></div>
          </>}
          {section==='negocio'&&<>
            <div className="merchant-page-heading"><div><span className="merchant-kicker">CONFIGURACIÓN</span><h1>Mi negocio</h1><p>Controla tu disponibilidad y consulta la información verificada del comercio.</p></div></div>
            <div className="merchant-settings-grid"><section className="merchant-setting-card"><span className="merchant-setting-icon"><Store size={23}/></span><h2>{restaurant?.name||'Mi comercio'}</h2><p><MapPin size={16}/>{restaurant?.address||'Dirección sin publicar'}</p><div className="merchant-setting-row"><span>Verificación</span><strong>{restaurant?.verification_status||'Sin información'}</strong></div><div className="merchant-setting-row"><span>Pedidos para recoger</span><strong>{restaurant?.pickup_enabled?'Habilitados':'Deshabilitados'}</strong></div></section>
              <section className="merchant-setting-card"><span className="merchant-setting-icon"><Clock3 size={23}/></span><h2>Disponibilidad</h2><p>El estado se confirma con el backend al guardar.</p><div className={'merchant-availability '+(restaurant?.is_open?'is-open':'')}><span className="merchant-status-dot"/><strong>{restaurant?.is_open?'Tu negocio está abierto':'Tu negocio está cerrado'}</strong></div><button className="merchant-main-button" disabled={savingStore||!restaurant} onClick={()=>void toggleStore()}>{savingStore?'Guardando…':restaurant?.is_open?'Cerrar temporalmente':'Abrir comercio'}<ChevronRight size={17}/></button><small>Para abrir, el servidor puede exigir verificación del comercio. Esta acción no modifica métodos de pago ni permisos financieros.</small></section></div>
          </>}
        </>}
      </main>
    </div>
    <nav className="merchant-mobile-nav" aria-label="Navegación inferior del restaurante">{NAV.map(n=><button key={n.id} type="button" className={section===n.id?'active':''} aria-current={section===n.id?'page':undefined} onClick={()=>setSection(n.id)}><n.icon size={21}/><span>{n.label}</span>{n.id==='pedidos'&&newCount>0&&<i>{newCount}</i>}</button>)}</nav>
  </div>;
}
