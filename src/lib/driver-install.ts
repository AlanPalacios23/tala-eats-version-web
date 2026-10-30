/** Driver-only PWA install state. No session, location or financial data here. */
export type DriverInstallPlatform='ios'|'android'|'other';
export const DRIVER_INSTALL_DISMISSED_KEY='tala-eats-driver-install-dismissed-until-v1';
export const DRIVER_INSTALL_HELP_EVENT='tala-eats-driver-open-install-help';
export const DRIVER_INSTALL_PROMPT_DELAY_MS=1600;
export const DRIVER_INSTALL_SNOOZE_DAYS=7;

export function driverInstallPlatform(agent:string,maxTouchPoints=0):DriverInstallPlatform {
 if(/iPad|iPhone|iPod/i.test(agent)||/Macintosh/i.test(agent)&&(maxTouchPoints>1||/Mobile/i.test(agent)))return 'ios';
 if(/Android/i.test(agent))return 'android';
 return 'other';
}
export function driverPwaInstalled(displayStandalone:boolean,iosStandalone:boolean):boolean{
 return displayStandalone||iosStandalone;
}
export function driverInstallSnoozed(until:unknown,now:number):boolean{
 const value=typeof until==='string'?Number(until):NaN;
 return Number.isFinite(value)&&value>now&&value<now+366*24*60*60*1000;
}
export function driverInstallEligible(path:string,platform:DriverInstallPlatform,installed:boolean,preview:boolean):boolean{
 return !installed&&!preview&&platform!=='other'&&
  (path==='/repartidor'||path==='/repartidor/acceso'||path==='/repartidor/registro');
}
