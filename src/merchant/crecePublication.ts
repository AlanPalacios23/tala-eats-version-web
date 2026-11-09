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
/** Scannable print material: >=4-module quiet zone and high-resolution PNG.
 * Preview can still be shown at 220 CSS pixels without losing export detail.
 */
export const CRECE_QR_PNG=Object.freeze({
 width:1024,margin:4,errorCorrectionLevel:'Q' as const
});

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

/** A checked QR is a short-lived claim about live public availability.
 * A session that goes offline, changes merchant, or starts a refresh may
 * NEVER continue offering a previously-verified QR to share.
 */
export const CRECE_PUBLIC_REVALIDATE_MS=90_000;
export type StorePublication=Readonly<{
 id:number|null;status:'idle'|'checking'|'confirmed'|'not-public'|'limit'|'error'|'offline';
 revision:number;
}>;
export function mayShareStorefront(input:{
 publication:StorePublication;storeId:unknown;
 revision:number;online:boolean
}):boolean{
 const {publication,storeId,revision,online}=input;
 return online&&Number.isSafeInteger(storeId)&&Number(storeId)>0&&
  publication.id===storeId&&publication.revision===revision&&
  publication.status==='confirmed';
}
