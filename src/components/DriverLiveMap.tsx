import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as LeafletMap,LayerGroup} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/driver-live-map.css';
import '../styles/driver-offer-choice-rc149.css';
import '../styles/driver-offer-stability-rc150.css';
import {AlertCircle,ArrowLeft,ArrowRight,Bike,CheckCircle2,ChevronDown,ChevronUp,Compass,LocateFixed,MapPin,Power,RefreshCw,ShieldCheck,WifiOff,X} from 'lucide-react';
import {api,pesos} from '../lib/api';
import {DriverOfferAttention} from './DriverOfferAttention';
import type {Order,Restaurant} from '../lib/types';
import {
 availableMapOffers,driverOfferMarkers,straightLineKm,validLivePosition
} from '../lib/driver-live-map';
import type {DriverMapPoint} from '../lib/driver-live-map';
import {canSortOffersByProximity,driverOfferPickupDirectionsHref,selectedDriverOffer,sortDriverOffers} from '../lib/driver-offer-choice';
import type {DriverOfferOrder} from '../lib/driver-offer-choice';

export interface DriverLiveMapProps{
 offers:readonly Order[];
 eligible:boolean;
 offline:boolean;
 busy:boolean;
 refreshing:boolean;
 offersError:boolean;
 onAccept:(order:Order)=>void;
 onRefresh:()=>void;
 onClose:()=>void;
 onGoOffline:()=>void;
 errorMessage?:string;
}

const tiles='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const motionAllowed=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Opt-in foreground map: never caches coordinates, location history, or
 * private order payloads. External map tiles see a viewport, not our API data.
 * Server dispatch/acceptance rules are authoritative. */
export function DriverLiveMap({offers,eligible,offline,busy,refreshing,offersError,onAccept,onRefresh,onClose,onGoOffline,errorMessage}:DriverLiveMapProps){
 const target=useRef<HTMLDivElement>(null);
 const dialogRef=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const touchStart=useRef<number|null>(null);
 const mapRef=useRef<LeafletMap|null>(null);
 const leafletRef=useRef<typeof import('leaflet')|null>(null);
 const layerRef=useRef<LayerGroup|null>(null);
 const [position,setPosition]=useState<DriverMapPoint|null>(null);
 const [gpsError,setGpsError]=useState('');
 const [mapError,setMapError]=useState('');
 const [catalog,setCatalog]=useState<Restaurant[]>([]);
 const [dismissed,setDismissed]=useState<Set<number>>(()=>new Set());
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const [follow,setFollow]=useState(true);
 const [loaded,setLoaded]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const [offerOrder,setOfferOrder]=useState<DriverOfferOrder>('received');

 const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline),[offers,dismissed,eligible,offline]);
 const markers=useMemo(()=>driverOfferMarkers(readyOffers,catalog),[readyOffers,catalog]);
 const canSortNearby=canSortOffersByProximity(position,markers);
 const effectiveOfferOrder=offerOrder==='nearby'&&!canSortNearby?'received':offerOrder;
 const sortedOffers=useMemo(()=>sortDriverOffers(readyOffers,effectiveOfferOrder,markers,position),[readyOffers,effectiveOfferOrder,markers,position]);
 const center=position??markers[0]?.point??null;
 const selected=selectedDriverOffer(sortedOffers,selectedId);
 const selectedMarker=markers.find(m=>m.order.id===selected?.id)??null;
 const pickupDirectionsHref=driverOfferPickupDirectionsHref(selectedMarker);
 const hasOffers=offers.length>0;
 const offerCount=readyOffers.length;
 const isOfferVisible=Boolean(eligible&&selected&&!offline);
 // A newly arrived authorised offer automatically raises its action sheet.
 // On smaller phones this keeps the Accept action reachable without swiping.
 useEffect(()=>{setExpanded(Boolean(selected));},[selected?.id]);

 // Keep the full-screen operational surface accessible and prevent background
 // scrolling; the existing home and bottom tabs remain intact underneath.
 useEffect(()=>{
  const previous=document.activeElement;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  const keys=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();return;}
   if(event.key!=='Tab')return;
   const root=dialogRef.current;
   if(!root)return;
   const controls=Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
   )).filter(element=>element.getClientRects().length>0);
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keys);
  return()=>{
   document.removeEventListener('keydown',keys);
   document.body.style.overflow=oldOverflow;
   if(previous instanceof HTMLElement)previous.focus();
  };
 },[onClose]);

 // Resize after bottom-sheet expansion and on screen rotation, preserving
 // map gestures and preventing blank Leaflet tiles on iOS PWA.
 useEffect(()=>{
  const canvas=target.current;
  if(!canvas||typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(()=>mapRef.current?.invalidateSize({pan:false}));
  observer.observe(canvas);
  return()=>observer.disconnect();
 },[loaded]);

  // Only catalogue locations of existing server-authorized offers.
 useEffect(()=>{
  if(!hasOffers||!eligible||offline){setCatalog([]);return;}
  let alive=true;
  void api.restaurants().then(data=>{
   if(alive&&Array.isArray(data))setCatalog(data);
  }).catch(()=>{if(alive)setCatalog([]);});
  return()=>{alive=false;};
 },[hasOffers,eligible,offline]);

 // GPS runs in foreground ONLY; original 45s heartbeat keeps Redis current.
 // Watching the map does not generate extra location writes to the backend.
 useEffect(()=>{
  if(offline||!navigator.geolocation||!window.isSecureContext){
   setPosition(null);setGpsError('El mapa necesita conexión HTTPS, Internet y permiso de ubicación.');
   return;
  }
  let watchId:number|null=null;
  const stop=()=>{if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}};
  const start=()=>{
   stop();setPosition(null);
   if(document.visibilityState!=='visible')return;
   watchId=navigator.geolocation.watchPosition(
    p=>{
     const {latitude:lat,longitude:lng,accuracy}=p.coords;
     if(!validLivePosition(lat,lng,accuracy,p.timestamp,Date.now())){
      setGpsError('Esperando una ubicación GPS precisa y reciente.');setPosition(null);return;
     }
     setGpsError('');setPosition({lat,lng});
    },
    e=>{setGpsError(e.code===1?'Autoriza el GPS para mostrar tu ubicación.':'No pudimos obtener GPS reciente.');setPosition(null);},
    {enableHighAccuracy:true,maximumAge:0,timeout:20000},
   );
  };
  document.addEventListener('visibilitychange',start);
  start();
  return()=>{stop();document.removeEventListener('visibilitychange',start);};
 },[offline]);

 // Load the mapping engine only when a real point exists. Never display a
 // made-up courier marker or fetch streets from a fabricated center.
 const hasCenter=Boolean(center);
 useEffect(()=>{
  if(!hasCenter||mapRef.current||!target.current)return;
  let disposed=false;
  void import('leaflet').then(L=>{
   if(disposed||!target.current||!center)return;
   leafletRef.current=L;
   const map=L.map(target.current,{
    zoomControl:false,attributionControl:false,scrollWheelZoom:false,
    zoomSnap:.5,preferCanvas:true
   }).setView([center.lat,center.lng],14);
   mapRef.current=map;
   const layer=L.layerGroup().addTo(map);
   layerRef.current=layer;
   // OSM tile policy requires an Origin Referer. The private PWA retains
   // no-referrer for API and other requests; override only tile <img> requests.
   const tileLayer=L.tileLayer(tiles,{
    maxZoom:18,minZoom:11,detectRetina:false,
    attribution:'© OpenStreetMap contributors',
    updateWhenIdle:true,keepBuffer:1,
    // Leaflet applies this BEFORE setting tile.src, preserving privacy on
    // other requests while satisfying the OSM tile usage policy.
    referrerPolicy:'strict-origin-when-cross-origin',
   });
   tileLayer.on('tileerror',()=>setMapError('No se pudieron cargar algunas calles. Las ofertas siguen disponibles.'));
   tileLayer.addTo(map);
   L.control.attribution({position:'topright',prefix:false}).addTo(map);
   map.on('dragstart',()=>setFollow(false));
   setLoaded(true);
   window.setTimeout(()=>{if(!disposed)map.invalidateSize();},120);
  }).catch(()=>{if(!disposed)setMapError('El mapa no se pudo iniciar. Usa las tarjetas para elegir un pedido.');});
  return()=>{disposed=true;mapRef.current?.remove();mapRef.current=null;layerRef.current=null;leafletRef.current=null;setLoaded(false);};
 // Mount once when first point arrives; subsequent GPS fixes move existing map.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[hasCenter]);

 useEffect(()=>{
  const L=leafletRef.current,map=mapRef.current,group=layerRef.current;
  if(!L||!map||!group)return;
  group.clearLayers();
  if(position){
   L.circleMarker([position.lat,position.lng],{
    radius:9,weight:3,color:'#fff',fillColor:'#2779db',fillOpacity:1
   }).bindTooltip('Tu ubicación GPS').addTo(group);
   L.circle([position.lat,position.lng],{
    radius:28,color:'#4d90ff',weight:1,fillColor:'#4d90ff',fillOpacity:.08
   }).addTo(group);
  }
  for(const marker of markers){
   const chosen=marker.order.id===selected?.id;
   L.circleMarker([marker.point.lat,marker.point.lng],{
    radius:chosen?15:12,weight:3,color:'#fff',fillColor:'#ff682e',fillOpacity:1
   }).bindTooltip('Pedido #'+marker.order.id).on('click',()=>{
    openOffer(marker.order.id);
   }).addTo(group);
  }
  if(follow&&position){
   map.setView([position.lat,position.lng],map.getZoom(),{animate:false});
   // Leave the blue courier dot above the bottom sheet, never hidden behind it.
   map.panBy([0,Math.min(130,Math.round(window.innerHeight*.12))],{animate:false});
  }
 },[position,markers,selected?.id,follow,loaded]);

 function openOffer(id:number){
  const offer=readyOffers.find(o=>o.id===id);
  if(!offer)return;
  setSelectedId(id);
  setExpanded(true);
  setFollow(false);
  const marker=markers.find(m=>m.order.id===id);
  if(marker){
   const map=mapRef.current;
   if(map){
    const offset=[0,Math.min(140,Math.round(window.innerHeight*.16))] as [number,number];
    if(motionAllowed()){
     map.once('moveend',()=>map.panBy(offset,{animate:true}));
     map.flyTo([marker.point.lat,marker.point.lng],15,{duration:.55});
    }else{
     map.setView([marker.point.lat,marker.point.lng],15,{animate:false});
     map.panBy(offset,{animate:false});
    }
   }
  }
 }
 function showOfferPoints(){
  const map=mapRef.current,L=leafletRef.current;
  if(!map||!L)return;
  const points=markers.map(m=>[m.point.lat,m.point.lng] as [number,number]);
  if(position)points.push([position.lat,position.lng]);
  if(!points.length)return;
  setFollow(false);
  if(points.length===1){
   if(motionAllowed())map.flyTo(points[0],15,{duration:.5});
   else map.setView(points[0],15,{animate:false});
   return;
  }
  map.fitBounds(L.latLngBounds(points),{
   paddingTopLeft:[36,140],paddingBottomRight:[36,250],maxZoom:15,animate:motionAllowed()
  });
 }
 function touchEnd(y:number){
  if(touchStart.current===null)return;
  const delta=y-touchStart.current;
  touchStart.current=null;
  if(delta< -45)setExpanded(true);
  else if(delta>45)setExpanded(false);
 }
 function centerMe(){
  if(!position)return;
  setFollow(true);
  const map=mapRef.current;
  if(map){
   const animate=motionAllowed();
   map.setView([position.lat,position.lng],15,{animate});
   map.panBy([0,Math.min(130,Math.round(window.innerHeight*.12))],{animate});
  }
 }
 function focusOffer(order:Order){openOffer(order.id);}
 return <section ref={dialogRef} className="dm-shell dm-immersive" role="dialog" aria-modal="true"
  aria-label="Modo repartidor en línea, mapa a pantalla completa" data-driver-live-map="true"
  data-map-mode="immersive" data-sheet={expanded?'expanded':'peek'}>
  <div className="dm-map-wrap">
   {hasCenter&&<div className="dm-canvas" ref={target} role="application" aria-label="Mapa interactivo de tu ubicación GPS y puntos de recogida verificados"/>}
   {!hasCenter&&<div className="dm-map-placeholder">
    <div className="dm-waiting-orbit"><MapPin size={29}/></div>
    <strong>Buscando tu ubicación</strong>
    <span>{gpsError||'Esperando GPS preciso o coordenadas verificadas del comercio…'}</span>
   </div>}
   {(mapError||gpsError)&&<div className="dm-map-warning" role="status"><WifiOff size={15}/>{mapError||gpsError}</div>}
  </div>

  <header className="dm-floating-header">
   <div className="dm-header-row">
    <button ref={closeRef} type="button" className="dm-round-button dm-back" onClick={onClose} aria-label="Volver al inicio sin desconectarte"><ArrowLeft size={22}/></button>
    <div className={'dm-online-pill'+(offline?' is-disconnected':'')} aria-live="polite" title={offline?'Conexión no disponible en este dispositivo':'Disponibilidad confirmada previamente por el servidor'}><span className="dm-live-dot"/> {offline?'SIN RED':'EN LÍNEA'}</div>
    <span className="dm-counter" aria-live="polite">{eligible?offerCount:0} {offerCount===1?'oferta':'ofertas'}</span>
   </div>
   <div className="dm-location-pill"><Compass size={15}/>
    {position?'GPS activo · Ubicación reciente':gpsError?'GPS pendiente':'Obteniendo GPS…'}
   </div>
  </header>

  <div className="dm-map-tools">
   {markers.length>0&&<button type="button" className="dm-round-button" onClick={showOfferPoints}
      title="Ver todos los puntos de recogida" aria-label="Ver todos los pedidos en el mapa"><MapPin size={20}/></button>}
   <button type="button" className="dm-round-button" disabled={!position} onClick={centerMe}
     title="Mi ubicación" aria-label="Centrar mapa en mi ubicación"><LocateFixed size={22}/></button>
   <button type="button" className="dm-round-button dm-refresh-button" onClick={onRefresh}
     disabled={busy||offline||refreshing} aria-busy={refreshing}
     title={refreshing?'Actualizando pedidos…':'Actualizar pedidos'}
     aria-label={refreshing?'Actualizando los pedidos disponibles':'Actualizar los pedidos disponibles'}>
     <RefreshCw size={19} className={refreshing?'dm-refresh-icon is-refreshing':undefined}/></button>
  </div>

  <section className="dm-offer-panel" aria-label="Panel inferior de pedidos disponibles">
   <button type="button" className="dm-sheet-grab" aria-label={expanded?'Contraer panel de pedidos':'Ampliar panel de pedidos'}
      aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}
      onTouchStart={e=>{touchStart.current=e.touches[0]?.clientY??null;}}
      onTouchEnd={e=>touchEnd(e.changedTouches[0]?.clientY??0)}>
     <span className="dm-grab-line"/>{expanded?<ChevronDown size={18}/>:<ChevronUp size={18}/>}
   </button>
   <div className="dm-panel-body">
    <div className="dm-offer-header">
     <div className="dm-panel-heading">
      <span className="dm-overline">{eligible?'EN BUSCA DE ENTREGAS':'ESPERANDO AUTORIZACIÓN'}</span>
      <h2>{isOfferVisible?'Nueva oportunidad':eligible?'Explorando tu zona':'Estás conectado'}</h2>
     </div>
     {eligible&&<span className="dm-panel-count">{offerCount} {offerCount===1?'disponible':'disponibles'}</span>}
    </div>
    <DriverOfferAttention offers={readyOffers} eligible={eligible} offline={offline} onFocusOffer={openOffer}/>
    {!eligible&&<div className="dm-notice"><ShieldCheck size={20}/><div><strong>Tu mapa está listo</strong>
      <span>El servidor todavía no autoriza nuevas asignaciones. Puedes seguir viendo tu ubicación.</span></div></div>}
    {errorMessage&&<div className="dm-warning-line" role="alert"><AlertCircle size={17}/> {errorMessage}</div>}
    {offersError&&<div className="dm-warning-line" role="status"><WifiOff size={17}/> No se pudieron actualizar las ofertas. <button type="button" disabled={busy||offline||refreshing} onClick={onRefresh}>Reintentar</button></div>}
    {offline&&<div className="dm-warning-line" role="status"><WifiOff size={17}/> Sin Internet. No puedes aceptar pedidos.</div>}
    {eligible&&sortedOffers.length>1&&<div className="dm-offer-sort" role="group" aria-label="Ordenar pedidos disponibles">
     <span className="dm-offer-sort-caption">Ordenar</span>
     {([{key:'received',label:'Recibidos'},{key:'earnings',label:'Ganancia'},{key:'nearby',label:'Cercanía'}] as const).map(item=>
      <button key={item.key} type="button" className={'dm-offer-sort-option'+(effectiveOfferOrder===item.key?' is-selected':'')}
       aria-pressed={effectiveOfferOrder===item.key}
       disabled={item.key==='nearby'&&!canSortNearby}
       title={item.key==='nearby'?'Distancia en línea recta a la recogida, requiere GPS y ubicación pública':undefined}
       onClick={()=>{
        if(item.key==='nearby'&&!canSortNearby)return;
        const next=sortDriverOffers(readyOffers,item.key,markers,position);
        setOfferOrder(item.key);
        setSelectedId(next[0]?.id??null);
       }}>{item.label}</button>)}
     {(!canSortNearby||effectiveOfferOrder==='nearby')&&<small className="dm-offer-sort-note">
      {canSortNearby?'Cercanía calcula solo distancia en línea recta, no tiempo de viaje.':'Para ordenar por cercanía necesitas GPS y ubicaciones públicas de los comercios.'}
     </small>}
    </div>}
    {eligible&&selected&&<article className="dm-offer" aria-label={'Oferta '+selected.id}>
     <div className="dm-offer-row">
      <span className="dm-order">PEDIDO #{selected.id}</span>
      <span className="dm-pickup-chip"><MapPin size={13}/> Recogida</span>
     </div>
     <div className="dm-offer-primary"><div><span className="dm-label">RECOGER EN</span>
       <strong className="dm-store">{selectedMarker?.name||'Comercio #'+selected.restaurant_id}</strong></div>
       <div className="dm-earning-block"><span className="dm-label">GANANCIA</span>
        <strong className="dm-earning">{selected.driver_earning!=null?pesos(selected.driver_earning):'Por confirmar'}</strong></div>
     </div>
     <div className="dm-offer-meta">
      <span><Bike size={16}/>{selected.payment_method==='cash'?'Pago en efectivo':'Pago con tarjeta'}</span>
      <span><MapPin size={16}/>{selectedMarker?(position?straightLineKm(position,selectedMarker.point).toFixed(1)+' km en línea recta':'Recogida en mapa'):'Ubicación no disponible'}</span>
     </div>
     {pickupDirectionsHref&&<a className="dm-pickup-directions"
      href={pickupDirectionsHref} target="_blank" rel="noopener noreferrer"
      aria-label={'Ver indicaciones al comercio para el pedido '+selected.id}>
      <MapPin size={15} aria-hidden="true"/> Ver recogida en el mapa <ArrowRight size={15} aria-hidden="true"/>
    </a>}
    <div className="dm-actions">
      <button type="button" className="dm-accept" disabled={busy||offline}
       onClick={()=>onAccept(selected)}><CheckCircle2 size={19}/> {busy?'Confirmando…':'Aceptar pedido'} <ArrowRight size={18}/></button>
      <button type="button" className="dm-dismiss" disabled={busy} onClick={()=>{
       setDismissed(old=>new Set([...old,selected.id]));setSelectedId(null);
      }} aria-label={'Descartar oferta '+selected.id}><X size={18}/> Descartar</button>
     </div>
     <p className="dm-privacy">Descartar solo oculta la oferta en esta sesión; no la rechaza en el servidor.</p>
    </article>}
    {eligible&&sortedOffers.length>1&&<div className="dm-offer-strip" aria-label="Cambiar de oferta">
     {sortedOffers.filter(o=>o.id!==selected?.id).slice(0,8).map(o=>
      <button type="button" key={o.id} onClick={()=>focusOffer(o)}
       className="dm-mini-offer"><span>#{o.id}</span> <strong>{o.driver_earning!=null?pesos(o.driver_earning):'Ver pedido'}</strong><ArrowRight size={15}/></button>)}
    </div>}
    {eligible&&!offline&&!readyOffers.length&&<div className="dm-none">
      <span className="dm-radar-icon"><Bike size={21}/></span>
      <div><strong>{dismissed.size&&offers.length?'Ofertas ocultas':'Buscando pedidos cerca de ti'}</strong>
       <span>{dismissed.size&&offers.length?'Puedes recuperar las ofertas descartadas.':'Cuando haya pedidos autorizados, aparecerán aquí y sobre el mapa.'}</span></div>
      {dismissed.size>0&&<button type="button" onClick={()=>{setDismissed(new Set());setSelectedId(null);}}>Mostrar</button>}
    </div>}
    {expanded&&<div className="dm-details">
      <div><ShieldCheck size={16}/> La asignación solo se completa cuando el backend la confirma.</div>
      <button type="button" className="dm-go-offline" disabled={busy||offline}
        onClick={onGoOffline}><Power size={17}/> Desconectarme</button>
      <small>Mapa externo de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>. Solo GPS en primer plano.</small>
    </div>}
    {!expanded&&<button type="button" className="dm-expand-hint" onClick={()=>setExpanded(true)}>
      Ver detalles y opciones <ChevronUp size={15}/></button>}
   </div>
  </section>
 </section>;
}
