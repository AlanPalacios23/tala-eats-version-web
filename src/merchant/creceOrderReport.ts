/** Read-only merchant order archive for Tala Eats Crece.
 * Existing owner API, no commercial mutation, no customer PII in output.
 * Pagination is bounded: never claim a partial/unstable view is a ledger.
 */
import type {Order} from '../lib/types';

export const CRECE_REPORT_PAGE_SIZE=100;
export const CRECE_REPORT_PAGE_LIMIT=20;
export type CreceOrderReport=Readonly<{
 orders:readonly Order[];
 pagesRead:number;
 truncated:boolean;
}>;

function invalid(code:string):never{
 throw new Error(code);
}
function validOrder(row:unknown,storeId:number):row is Order{
 if(!row||typeof row!=='object'||Array.isArray(row))return false;
 const order=row as Record<string,unknown>;
 if(!Number.isSafeInteger(order.id)||Number(order.id)<=0||
   order.restaurant_id!==storeId||
   typeof order.created_at!=='string'||
   !Number.isFinite(Date.parse(order.created_at))||
   typeof order.status!=='string'||!order.status.trim()||
   !['pickup','delivery'].includes(String(order.order_type))||
   !['cash','stripe'].includes(String(order.payment_method))||
   typeof order.payment_status!=='string'||
   (typeof order.total!=='string'&&typeof order.total!=='number')||
   !Number.isFinite(Number(order.total))||
   Number(order.total)<0)return false;
 const items=order.items;
 return items==null||(Array.isArray(items)&&items.every(item=>
  item&&typeof item==='object'&&
  typeof item.name_snapshot==='string'&&
  Number.isSafeInteger(item.quantity)&&item.quantity>=0
 ));
}

export async function fetchCreceOrderReport(input:{
 storeId:number;
 fetchPage:(offset:number,limit:number,signal?:AbortSignal)=>Promise<unknown>;
 signal?:AbortSignal;
 maxPages?:number;
 onProgress?:(pagesRead:number,count:number)=>void;
}):Promise<CreceOrderReport>{
 if(!Number.isSafeInteger(input.storeId)||input.storeId<=0)
  return invalid('CRECE_REPORT_STORE_INVALID');
 const maxPages=input.maxPages??CRECE_REPORT_PAGE_LIMIT;
 if(!Number.isSafeInteger(maxPages)||maxPages<1||
  maxPages>CRECE_REPORT_PAGE_LIMIT)
  return invalid('CRECE_REPORT_LIMIT_INVALID');
 const orders:Order[]=[];
 const seen=new Set<number>();
 for(let page=0;page<maxPages;page++){
  if(input.signal?.aborted)
   return invalid('CRECE_REPORT_CANCELLED');
  const next=await input.fetchPage(
   page*CRECE_REPORT_PAGE_SIZE,CRECE_REPORT_PAGE_SIZE,input.signal);
  if(input.signal?.aborted)
   return invalid('CRECE_REPORT_CANCELLED');
  if(!Array.isArray(next)||next.length>CRECE_REPORT_PAGE_SIZE||
   !next.every(row=>validOrder(row,input.storeId)))
   return invalid('CRECE_REPORT_RESPONSE_INVALID');
  for(const row of next as Order[]){
   if(seen.has(row.id))
    return invalid('CRECE_REPORT_PAGES_OVERLAP');
   seen.add(row.id);
   orders.push(row);
  }
  input.onProgress?.(page+1,orders.length);
  if(next.length<CRECE_REPORT_PAGE_SIZE)
   return {orders,pagesRead:page+1,truncated:false};
 }
 return {orders,pagesRead:maxPages,truncated:true};
}
