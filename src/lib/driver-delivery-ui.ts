import type {Order} from './types';

/** Never reuse dashboard.recent as Order records: its payload has a different contract. */
export function driverDeliveredOrders(mine:readonly Order[]):Order[]{
 return mine.filter(o=>o.status==='delivered');
}
export function sanitizeDeliveryPin(value:string):string{
 return value.replace(/\D/g,'').slice(0,4);
}
export function isDeliveryPinReady(value:string):boolean{
 return /^[0-9]{4}$/.test(value);
}
export function cashCollectionRequired(order:Pick<Order,'payment_method'>):boolean{
 return order.payment_method==='cash';
}
export function canSubmitDelivery(order:Pick<Order,'payment_method'|'status'>,pin:string,cashAcknowledged:boolean):boolean{
 return order.status==='on_the_way'&&isDeliveryPinReady(pin)&&
  (!cashCollectionRequired(order)||cashAcknowledged);
}
export function safeDriverMapLink(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const text=value.trim();
 if(!text||text.length>280||/[\u0000-\u001f\u007f]/.test(text))return null;
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(text);
}
export type DriverDetail={
 id:number;
 restaurant?:{id:number;name:string;address?:string;lat?:number;lng?:number};
 customer?:{address?:string};
 earning?:number;
 total?:number;
};
export type DriverDashboardPayload={
 user?:{id?:number;name?:string;phone?:string;avatar_url?:string|null};
 active?:DriverDetail|null;
 today?:{earnings:number;deliveries:number;distance_km:number;average_earning:number};
 last_7_days?:Array<{date:string;earnings:number;deliveries:number}>;
 acceptance_rate?:number;
};
export function trustedActiveDriverDetail(dashboard:DriverDashboardPayload|null, order:Order|null):DriverDetail|null{
 const detail=dashboard?.active;
 return order&&detail&&Number.isSafeInteger(detail.id)&&detail.id===order.id&&
  detail.restaurant?.id===order.restaurant_id?detail:null;
}
