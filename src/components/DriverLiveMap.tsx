import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as LeafletMap,LayerGroup} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/driver-live-map.css';
import {Bike,CheckCircle2,Compass,LocateFixed,MapPin,RefreshCw,ShieldCheck,WifiOff,X} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {Order,Restaurant} from '../lib/types';
import {
 availableMapOffers,driverOfferMarkers,straightLineKm,validLivePosition
} from '../lib/driver-live-map';
import type {DriverMapPoint} from '../lib/driver-live-map';

export interface DriverLiveMapProps{
 offers:readonly Order[];
 eligible:boolean;
 offline:boolean;
 busy:boolean;
 offersError:boolean;
 onAccept:(order:Order)=>void;
 onRefresh:()=>void;
}

const tiles='https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Opt-in foreground map: never caches coordinates, location history, or
 * private order payloads. External map tiles see a viewport, not our API data.
 * Server dispatch/acceptance rules are authoritative. */
export function DriverLiveMap({offers,eligible,offline,busy,offersError,onAccept,onRefresh}:DriverLiveMapProps){
 const target=useRef<HTMLDivElement>(null);
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

 const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline),[offers,dismissed,eligible,offline]);
 const markers=useMemo(()=>driverOfferMarkers(readyOffers,catalog),[readyOffers,catalog]);
 const center=position??markers[0]?.point??null;
 const selected=readyOffers.find(o=>o.id===selectedId)??readyOffers[0]??null;
 const selectedMarker=markers.find(m=>m.order.id===selected?.id);
 const hasOffers=offers.length>0;

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
      setGpsError('Esperando una ubicación GPS precisa y reciente.');return;
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
    setSelectedId(marker.order.id);
    setFollow(false);
   }).addTo(group);
  }
  if(follow&&position)map.setView([position.lat,position.lng],map.getZoom(),{animate:true});
 },[position,markers,selected?.id,follow,loaded]);

 function centerMe(){
  if(!position)return;
  setFollow(true);
  mapRef.current?.setView([position.lat,position.lng],15,{animate:true});
 }
 function focusOffer(order:Order){
  setSelectedId(order.id);
  const location=markers.find(m=>m.order.id===order.id);
  if(location){setFollow(false);mapRef.current?.setView([location.point.lat,location.point.lng],15,{animate:true});}
 }
 return <section className="dm-shell" aria-label="Mapa de reparto en vivo" data-driver-live-map="true">
  <div className="dm-topline">
   <div><span className="dm-eyebrow"><span className="dm-live-dot"/> EN LÍNEA · MAPA EN VIVO</span>
    <h2>Tu zona de reparto</h2></div>
   <span className="dm-counter">{eligible?readyOffers.length:0} {readyOffers.length===1?'oferta':'ofertas'}</span>
  </div>
  <div className="dm-map-wrap">
   {hasCenter&&<div className="dm-canvas" ref={target} role="application" aria-label="Mapa interactivo de tu ubicación y puntos de recogida"/>}
   {!hasCenter&&<div className="dm-map-placeholder">
    <MapPin size={30}/><strong>Preparando mapa de tu zona</strong>
    <span>{gpsError||'Esperando GPS o coordenadas verificadas de un comercio…'}</span>
   </div>}
   {loaded&&position&&<button type="button" className="dm-recenter" onClick={centerMe} aria-label="Centrar mapa en mi ubicación"><LocateFixed size={21}/></button>}
   <div className="dm-map-info"><Compass size={14}/> {position?'GPS activo · Solo mientras usas la app':'Ubicación pendiente'}</div>
   {(mapError||gpsError)&&<div className="dm-map-warning" role="status"><WifiOff size={15}/>{mapError||gpsError}</div>}
  </div>
  <div className="dm-offer-panel">
   <div className="dm-offer-header"><strong>Pedidos disponibles</strong>
    <button type="button" aria-label="Actualizar ofertas" disabled={busy||offline} onClick={onRefresh}><RefreshCw size={18}/> Actualizar</button></div>
   {!eligible&&<div className="dm-notice"><ShieldCheck size={19}/> Las nuevas asignaciones todavía no están autorizadas por el servidor. Puedes ver tu ubicación sin aceptar pedidos.</div>}
   {offersError&&<p className="dm-notice" role="status">No se pudieron consultar los pedidos. Intenta actualizar.</p>}
   {offline&&<p className="dm-notice" role="status">Sin conexión. No se pueden aceptar pedidos.</p>}
   {eligible&&selected&&<article className="dm-offer" aria-label={'Oferta '+selected.id}>
    <div className="dm-offer-row"><span className="dm-order">PEDIDO #{selected.id}</span>
     <strong className="dm-earning">{selected.driver_earning!=null?pesos(selected.driver_earning):'Ganancia pendiente'}</strong></div>
    <strong className="dm-store">{selectedMarker?.name||'Comercio #'+selected.restaurant_id}</strong>
    <div className="dm-offer-meta"><span><Bike size={16}/> {selected.payment_method==='cash'?'Efectivo':'Tarjeta'}</span>
     <span><MapPin size={16}/>{selectedMarker?(position?straightLineKm(position,selectedMarker.point).toFixed(1)+' km en línea recta':'Punto de recogida en mapa'):'Ubicación no disponible'}</span></div>
    <div className="dm-actions">
     <button type="button" className="dm-accept" disabled={busy||offline} onClick={()=>onAccept(selected)}><CheckCircle2 size={18}/> Aceptar pedido</button>
     <button type="button" className="dm-dismiss" disabled={busy} onClick={()=>{
      setDismissed(old=>new Set([...old,selected.id]));setSelectedId(null);
     }}><X size={17}/> Descartar</button>
    </div>
    <p className="dm-privacy">Descartar solo oculta esta oferta en esta sesión; no la rechaza en el servidor.</p>
   </article>}
   {eligible&&readyOffers.length>1&&<div className="dm-offer-strip" aria-label="Otras ofertas">
    {readyOffers.filter(o=>o.id!==selected?.id).slice(0,5).map(o=>
     <button type="button" key={o.id} onClick={()=>focusOffer(o)} className="dm-mini-offer">Pedido #{o.id} <span>{o.driver_earning!=null?pesos(o.driver_earning):'Ver oferta'}</span></button>)}
   </div>}
   {eligible&&!readyOffers.length&&<div className="dm-none"><Bike size={21}/>{offers.length>0?'Descartaste las ofertas visibles.':'No hay pedidos disponibles en este momento.'}
    {dismissed.size>0&&<button type="button" onClick={()=>{setDismissed(new Set());setSelectedId(null);}}>Volver a mostrar</button>}
   </div>}
   <p className="dm-footer"><ShieldCheck size={15}/> La asignación se confirma con el backend. Mapa externo: <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>.</p>
  </div>
 </section>;
}
