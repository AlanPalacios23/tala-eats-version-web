/**
 * Public-store verification for printed/shareable merchant QR.
 *
 * /restaurants lists are paginated. Looking only at the first 100 excludes
 * legitimate merchants once Tala Eats grows. We verify the public detail AND
 * the public listing for the same numeric ID, with a hard scan budget.
 *
 * A truncated catalog never becomes an unverified "yes". The caller may
 * display a limit message and escalate to a dedicated backend lookup later.
 * This is a visibility check, not financial onboarding authorization.
 */
import {verifiedPublicStorefront} from './creceContracts';

export type PublicationResult='confirmed'|'not-public'|'limit';
export const PUBLIC_STORE_PAGE_SIZE=100;
export const PUBLIC_STORE_MAX_PAGES=12;

export async function checkPublicStorefront(input:{
 storeId:number;
 fetchPage:(offset:number,limit:number,signal?:AbortSignal)=>Promise<unknown>;
 fetchDetail:(id:number,signal?:AbortSignal)=>Promise<unknown>;
 signal?:AbortSignal;
 maxPages?:number;
}):Promise<PublicationResult>{
 const {storeId,fetchPage,fetchDetail,signal}=input;
 if(!Number.isSafeInteger(storeId)||storeId<=0)
  return 'not-public';
 const maxPages=input.maxPages??PUBLIC_STORE_MAX_PAGES;
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>PUBLIC_STORE_MAX_PAGES)
  throw Error('CRECE_PUBLIC_PAGE_BUDGET_INVALID');
 const detail=await fetchDetail(storeId,signal);
 if(!detail||typeof detail!=='object'||Array.isArray(detail)||
    (detail as {id?:unknown}).id!==storeId||
    typeof (detail as {name?:unknown}).name!=='string'||
    !(detail as {name:string}).name.trim())
  return 'not-public';
 for(let page=0;page<maxPages;page++){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const batch=await fetchPage(page*PUBLIC_STORE_PAGE_SIZE,PUBLIC_STORE_PAGE_SIZE,signal);
  if(!Array.isArray(batch)||batch.length>PUBLIC_STORE_PAGE_SIZE)
   throw Error('CRECE_PUBLIC_CATALOG_INVALID');
  if(verifiedPublicStorefront({id:storeId},batch,detail))
   return 'confirmed';
  if(batch.length<PUBLIC_STORE_PAGE_SIZE)return 'not-public';
 }
 return 'limit';
}
