/** Driver-specific domain is used ONLY after a complete deployment, DNS,
 * HTTPS and same-origin authentication check. Before that keep working
 * /repartidor route in the existing portal unchanged.
 */
const TRUSTED_DRIVER='repartidores-talaeats.alan-palacios-dev.com';
export const DRIVER_DOMAIN='https://'+TRUSTED_DRIVER;
export function driverPortalDestination(raw:unknown):string{
 if(typeof raw!=='string'||!raw.trim())return '/repartidor';
 try{
  const url=new URL(raw);
  if(url.protocol==='https:'&&url.hostname===TRUSTED_DRIVER&&
   (url.port===''||url.port==='443')&&url.pathname==='/repartidor'&&
   !url.username&&!url.password&&!url.search&&!url.hash)return url.href;
 }catch{/* no new origin without explicit approved config */}
 return '/repartidor';
}
export function driverDomainIsIndependent(hostname:string):boolean{return hostname===TRUSTED_DRIVER;}
