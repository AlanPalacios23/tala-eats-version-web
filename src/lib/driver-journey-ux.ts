import type {Order} from './types';
import {safeDriverMapLink,trustedActiveDriverDetail} from './driver-delivery-ui';
import type {DriverDashboardPayload} from './driver-delivery-ui';

/** Driver-only presentation; never changes an order or advances a server state. */
export type DriverJourneyStage={step:1|2|3;title:string;hint:string};
export function driverJourneyStage(status:unknown):DriverJourneyStage|null {
 switch(status){
  case 'assigned':return {step:1,title:'Dirígete a recoger',hint:'Recogida en el comercio'};
  case 'picked_up':return {step:2,title:'Pedido recogido',hint:'Continúa hacia el cliente'};
  case 'on_the_way':return {step:3,title:'Entrega en curso',hint:'Confirma con el PIN del cliente'};
  default:return null;
 }
}

/** Opens external driving directions only for a real active order and a
 * server-supplied destination. No GPS is transmitted by this PWA, and no
 * distance, traffic, route or arrival time is guessed.
 */
export function driverJourneyNavigationHref(order:Order|null,dashboard:DriverDashboardPayload|null):string|null{
 const stage=driverJourneyStage(order?.status);
 if(!order||!stage)return null;
 const verified=trustedActiveDriverDetail(dashboard,order);
 const restaurant=(order as Order&{restaurant?:{address?:unknown}}).restaurant;
 const address:unknown=stage.step===1
  ?(verified?.restaurant?.address||restaurant?.address)
  :(order.address||verified?.customer?.address);
 if(!safeDriverMapLink(address))return null;
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((address as string).trim());
}
