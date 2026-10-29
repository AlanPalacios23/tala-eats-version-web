/** RC139: one official driver PWA. The HTTPS origin and the independent
 * same-origin LIVE backend were verified on Kali before enabling this.
 * Never use untrusted environment variables to construct a redirect.
 */
const TRUSTED_DRIVER='repartidores-talaeats.alan-palacios-dev.com';
export const DRIVER_DOMAIN='https://'+TRUSTED_DRIVER;
export function driverPortalDestination():string{
 return DRIVER_DOMAIN+'/repartidor';
}
/** Map only known legacy routes. Unexpected paths fall back to the driver home;
 * never append arbitrary query strings, fragments or external destinations.
 */
export function canonicalDriverRoute(pathname:string):string{
 const suffix=pathname==='/repartidor/acceso'?'/acceso':
  pathname==='/repartidor/registro'?'/registro':'';
 return driverPortalDestination()+suffix;
}
export function driverDomainIsIndependent(hostname:string):boolean{return hostname===TRUSTED_DRIVER;}
