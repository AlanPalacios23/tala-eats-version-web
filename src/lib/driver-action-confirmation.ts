import type {Order} from './types';

/**
 * Only transport/timeout/5xx failures are uncertain: the backend may have
 * committed before the browser received the response. A 4xx is a definitive
 * rejection and must never be turned into a successful delivery by the UI.
 */
export function isUncertainDriverWrite(error:unknown):boolean {
 if(!error||typeof error!=='object'||!('status' in error))return false;
 const status=(error as {status?:unknown}).status;
 return typeof status==='number'&&Number.isInteger(status)&&
  (status===0||status===408||(status>=500&&status<=599));
}

export type DriverConfirmedStage='assigned'|'picked_up'|'on_the_way'|'delivered';
const STAGES:readonly DriverConfirmedStage[]=['assigned','picked_up','on_the_way','delivered'];

/**
 * Read-only confirmation against authenticated GET /driver/mine.
 * Never infer a completed delivery from dashboard stats or browser state.
 * A subsequent, more advanced status is valid (e.g. another device already
 * progressed the same courier's assigned order). Cancellation never passes.
 */
export function hasConfirmedDriverStage(
 orders:unknown,orderId:number,expected:DriverConfirmedStage,
):boolean {
 if(!Number.isSafeInteger(orderId)||orderId<=0||!STAGES.includes(expected)||
    !Array.isArray(orders))return false;
 const current=orders.find((o:unknown):o is Pick<Order,'id'|'status'>=>
  o!==null&&typeof o==='object'&&
  (o as {id?:unknown}).id===orderId&&
  typeof (o as {status?:unknown}).status==='string'
 );
 if(!current)return false;
 const actualIndex=STAGES.indexOf(current.status as DriverConfirmedStage);
 const expectedIndex=STAGES.indexOf(expected);
 return actualIndex>=expectedIndex;
}
