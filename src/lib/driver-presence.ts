/**
 * Tala Eats PWA driver presence in RC9.5 LIVE.
 * Browser GPS is permitted only while the authenticated portal is in use.
 * A persisted 'online' flag is NOT proof of an available courier.
 */
export interface DriverPresenceReadiness{
 environment:'production'|'staging';
 presence_enabled:boolean;
 admin_verified:boolean;
 online:boolean;
 fresh_gps:boolean;
 ready_for_dispatch:boolean;
 live_delivery_checkout_enabled:boolean;
 live_stripe_delivery_enabled:boolean;
}
export const DRIVER_GPS_HEARTBEAT_MS=45000; // below Redis TTL 120 seconds
export function verifiedOnlinePresence(p:DriverPresenceReadiness|null):boolean{
 return Boolean(p?.presence_enabled&&p.admin_verified&&p.online&&p.fresh_gps);
}
/**
 * For LIVE production the compiled frontend build flag is NOT an authority.
 * The authenticated backend has to approve dispatch itself, after checking
 * financial release, courier verification, fresh GPS and valid order tender.
 */
export function driverActionsAvailable(p:DriverPresenceReadiness|null,uiEnabled:boolean):boolean{
 return Boolean((uiEnabled||p?.environment==='production')&&
   verifiedOnlinePresence(p)&&p?.ready_for_dispatch===true);
}
/**
 * An already assigned delivery can finish pickup/on-way/PIN while GPS has
 * temporarily expired. This NEVER grants a NEW order claim. Production
 * additionally needs its own released server delivery capabilities; staging
 * keeps its explicit UI opt-in. Server verifies PIN, driver ID and ledger.
 */
export function driverCanProgressExistingDelivery(
 p:DriverPresenceReadiness|null,uiEnabled:boolean):boolean{
 if(!p?.presence_enabled||!p.admin_verified||!p.online)return false;
 if(p.environment==='production')
   return p.live_delivery_checkout_enabled===true;
 return uiEnabled&&p.environment==='staging';
}
export interface BrowserDriverPosition {lat:number;lng:number}
export function validDriverCoordinates(value:BrowserDriverPosition):boolean{
 return Number.isFinite(value.lat)&&Math.abs(value.lat)<=90&&
  Number.isFinite(value.lng)&&Math.abs(value.lng)<=180;
}
export async function currentDriverPosition(
 geolocation:Pick<Geolocation,'getCurrentPosition'>|undefined=
   typeof navigator==='undefined'?undefined:navigator.geolocation
):Promise<BrowserDriverPosition>{
 if(!geolocation)throw new Error('Este navegador no tiene ubicación GPS disponible.');
 if(typeof window!=='undefined'&&!window.isSecureContext)
  throw new Error('La ubicación solo está disponible desde una conexión HTTPS segura.');
 return await new Promise<BrowserDriverPosition>((resolve,reject)=>{
  geolocation.getCurrentPosition(
   position=>{
    const current={lat:position.coords.latitude,lng:position.coords.longitude};
    if(!validDriverCoordinates(current)){reject(new Error('El GPS devolvió coordenadas inválidas.'));return;}
    if(!Number.isFinite(position.coords.accuracy)||position.coords.accuracy>150){
     reject(new Error('La ubicación es poco precisa. Activa GPS de alta precisión.'));return;
    }
    if(!Number.isFinite(position.timestamp)||Date.now()-position.timestamp>60000||
       position.timestamp>Date.now()+10000){
     reject(new Error('La ubicación GPS está desactualizada.'));return;
    }
    resolve(current);
   },
   error=>reject(new Error(error.code===1?
    'Autoriza la ubicación en el navegador para conectarte como repartidor.':
    'No se pudo obtener GPS vigente. Activa ubicación y vuelve a intentar.')),
   {enableHighAccuracy:true,maximumAge:0,timeout:12000},
  );
 });
}
