import type {Order} from './types';
export type KitchenOrderFilter='all'|'pickup'|'delivery';
const ACTIVE_KITCHEN_STATUSES=new Set(['received','confirmed','preparing','ready']);
export function kitchenOrders(orders:readonly Order[],filter:KitchenOrderFilter='all'):Order[]{
 return orders.filter(o=>ACTIVE_KITCHEN_STATUSES.has(o.status)&&
  (filter==='all'||o.order_type===filter))
  .sort((a,b)=>{
   const first=Date.parse(a.created_at),second=Date.parse(b.created_at);
   // Invalid timestamps are last: don't let malformed data reorder the queue first.
   const aTime=Number.isFinite(first)?first:Number.MAX_SAFE_INTEGER;
   const bTime=Number.isFinite(second)?second:Number.MAX_SAFE_INTEGER;
   return aTime-bTime||a.id-b.id;
  });
}
export function minutesSinceOrder(created_at:string,now=Date.now()):number|null{
 const time=Date.parse(created_at);
 if(!Number.isFinite(time)||!Number.isFinite(now))return null;
 return Math.max(0,Math.floor((now-time)/60000));
}
export function orderElapsedLabel(created_at:string,now=Date.now()):string{
 const elapsed=minutesSinceOrder(created_at,now);
 if(elapsed===null)return 'Hora sin confirmar';
 if(elapsed===0)return 'Hace menos de 1 min';
 if(elapsed<60)return 'Hace '+elapsed+' min';
 const hrs=Math.floor(elapsed/60),remaining=elapsed%60;
 return remaining>0?`Hace ${hrs} h ${remaining} min`:`Hace ${hrs} h`;
}
export function kitchenOrderTypeLabel(type:string):string{
 if(type==='pickup')return 'Recoge el cliente';
 if(type==='delivery')return 'Entrega a domicilio';
 return 'Modalidad sin confirmar';
}
