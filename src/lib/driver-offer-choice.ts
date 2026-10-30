import type {Order} from './types';
import {safeMapPoint,straightLineKm} from './driver-live-map';
import type {DriverMapPoint,DriverOfferMarker} from './driver-live-map';

/** Visual sorting only. Source remains the server-authorised offer array.
 * Never persists preferences, GPS, customer locations, or offer details.
 */
export type DriverOfferOrder='received'|'earnings'|'nearby';

function safeEarning(value:unknown):number|null{
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const text=String(value).trim();
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text))return null;
 const earning=Number(text);
 return Number.isFinite(earning)&&earning>=0?earning:null;
}

export function canSortOffersByProximity(
 position:DriverMapPoint|null,
 markers:readonly DriverOfferMarker[],
):boolean{
 return Boolean(position&&safeMapPoint(position.lat,position.lng)&&markers.length>0);
}

/** Missing earnings or verified pickup coordinates are ALWAYS last,
 * with original incoming order as tie-breaker. Straight-line comparison,
 * not road distance, travel duration, or a location disclosure.
 */
export function sortDriverOffers(
 offers:readonly Order[],
 order:DriverOfferOrder,
 markers:readonly DriverOfferMarker[],
 position:DriverMapPoint|null,
):Order[]{
 const copy=offers.map((item,index)=>({item,index}));
 if(order==='received'||(order==='nearby'&&!canSortOffersByProximity(position,markers)))
  return copy.map(x=>x.item);
 const pickup=new Map(markers.map(m=>[m.order.id,m.point]));
 const metric=(item:Order):number|null=>{
  if(order==='earnings')return safeEarning(item.driver_earning);
  if(!position)return null;
  const point=pickup.get(item.id);
  return point?straightLineKm(position,point):null;
 };
 const scored=copy.map(x=>({...x,metric:metric(x.item)}));
 scored.sort((a,b)=>{
  if(a.metric===null)return b.metric===null?a.index-b.index:1;
  if(b.metric===null)return -1;
  const difference=order==='earnings'?b.metric-a.metric:a.metric-b.metric;
  return difference||a.index-b.index;
 });
 return scored.map(x=>x.item);
}

/** A rider's chosen offer stays selected as GPS updates rearrange nearby offers.
 * If the server removes that offer, fall back to the first still-authorised one.
 */
export function selectedDriverOffer(offers:readonly Order[],selectedId:number|null):Order|null {
 return offers.find(o=>o.id===selectedId)??offers[0]??null;
}

/** Opt-in directions use only authorised public merchant coordinates.
 * Never puts the customer's address or the courier GPS into the outbound URL.
 */
export function driverOfferPickupDirectionsHref(marker:DriverOfferMarker|null):string|null {
 if(!marker)return null;
 const point=safeMapPoint(marker.point.lat,marker.point.lng);
 if(!point)return null;
 return 'https://www.google.com/maps/dir/?api=1&destination='+
  encodeURIComponent(point.lat+','+point.lng);
}
