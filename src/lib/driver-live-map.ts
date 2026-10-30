import type {Order,Restaurant} from './types';
import {validDriverCoordinates} from './driver-presence';

export type DriverMapPoint={lat:number;lng:number};
export interface DriverOfferMarker{order:Order;point:DriverMapPoint;name:string;source:'offer'|'catalog'}
type OfferRestaurant={name?:unknown;lat?:unknown;lng?:unknown};

export function safeMapPoint(lat:unknown,lng:unknown):DriverMapPoint|null{
 if(typeof lat!=='number'||typeof lng!=='number')return null;
 if(!validDriverCoordinates({lat,lng})||(lat===0&&lng===0))return null;
 return {lat,lng};
}
/** Map ONLY a merchant's public verified coordinates, never a customer's
 * address or the courier's location into an offer's pickup marker. */
export function driverOfferMarker(order:Order,catalog:readonly Restaurant[]):DriverOfferMarker|null{
 if(!Number.isSafeInteger(order.id)||order.id<=0||
    !Number.isSafeInteger(order.restaurant_id)||order.restaurant_id<=0)return null;
 const extra=order as Order&{restaurant?:OfferRestaurant};
 const fromOffer=extra.restaurant;
 const fromCatalog=catalog.find(r=>r.id===order.restaurant_id);
 const embedded=safeMapPoint(fromOffer?.lat,fromOffer?.lng);
 const publicCoordinates=safeMapPoint(fromCatalog?.lat,fromCatalog?.lng);
 const point=embedded??publicCoordinates;
 if(!point)return null;
 const label=fromOffer?.name;
 const name=typeof label==='string'&&label.trim().length>0&&label.length<=100?
  label.trim():typeof fromCatalog?.name==='string'&&fromCatalog.name.trim()?
   fromCatalog.name.trim().slice(0,100):'Comercio';
 return {order,point,name,source:embedded?'offer':'catalog'};
}
export function driverOfferMarkers(orders:readonly Order[],catalog:readonly Restaurant[]):DriverOfferMarker[]{
 return orders.map(o=>driverOfferMarker(o,catalog)).filter((x):x is DriverOfferMarker=>x!==null);
}
export function availableMapOffers(offers:readonly Order[],dismissed:ReadonlySet<number>,eligible:boolean):Order[]{
 return eligible?offers.filter(o=>Number.isSafeInteger(o.id)&&o.id>0&&!dismissed.has(o.id)):[];
}
/** Geodesic straight-line distance only; never a promised route or ETA. */
export function straightLineKm(a:DriverMapPoint,b:DriverMapPoint):number{
 const r=6371;
 const toRad=(x:number)=>x*Math.PI/180;
 const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
 const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
 return r*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));
}
export function validLivePosition(lat:number,lng:number,accuracy:number,timestamp:number,now:number):boolean{
 return Boolean(safeMapPoint(lat,lng)&&Number.isFinite(accuracy)&&accuracy<=150&&
  Number.isFinite(timestamp)&&now-timestamp<=60000&&timestamp<=now+10000);
}
