import type {Order} from './types';
/** Pure, deterministic notification gate: no phantom alerts on initial hydration. */
export function newlyReceivedOrderIds(previous:ReadonlySet<number>|null,orders:readonly Order[]):number[]{
 if(previous===null)return [];
 return orders.filter(o=>o.status==='received'&&!previous.has(o.id)).map(o=>o.id);
}
export function receivedOrderIds(orders:readonly Order[]):Set<number>{
 return new Set(orders.filter(o=>o.status==='received').map(o=>o.id));
}
