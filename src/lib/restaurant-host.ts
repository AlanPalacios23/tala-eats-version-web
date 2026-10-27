/** Merchant public domain is opt-in at BUILD time.
 * An inactive/new Cloudflare hostname must never break the existing /restaurante
 * route on the current Tala Eats gateway.
 */
const PINNED_MERCHANT_HOST='restaurantes-talaeats.alan-palacios-dev.com';
const PINNED_PORTAL_HOST='web-talaeats.alan-palacios-dev.com';
export function restaurantPortalDestination(configured:unknown):string{
 if(typeof configured!=='string'||!configured.trim())return '/restaurante';
 try{
  const parsed=new URL(configured);
  if(parsed.protocol==='https:'&&parsed.hostname===PINNED_MERCHANT_HOST&&
   (parsed.port===''||parsed.port==='443')&&parsed.pathname==='/restaurante'&&
   !parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash)return parsed.href;
 }catch{/* Reject malformed or unapproved routing config. */}
 return '/restaurante';
}
export function mainTalaEatsPortalHref(hostname:string):string{
 return hostname===PINNED_MERCHANT_HOST?'https://'+PINNED_PORTAL_HOST+'/':'/';
}
export function isDedicatedRestaurantDomain(hostname:string):boolean{
 return hostname===PINNED_MERCHANT_HOST;
}
