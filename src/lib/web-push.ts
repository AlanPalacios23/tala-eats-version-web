import {ApiError,request} from './api';
import {PREVIEW_READONLY} from './preview';

export interface WebPushConfig {enabled:boolean;public_key:string|null}
export interface WebPushRecord {id:number;userId:number}
export const PUSH_RECORD_KEY='tala-eats-pwa-push-subscription-v1';
let inMemoryRecord:WebPushRecord|null=null;
export function validVapidPublicKey(value:unknown):value is string {
 if(typeof value!=='string'||!/^[-_A-Za-z0-9]{86,88}$/.test(value))return false;
 try{return vapidToBytes(value).length===65;}catch{return false;}
}
export function vapidToBytes(key:string):Uint8Array {
 const raw=key.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(raw.padEnd(Math.ceil(raw.length/4)*4,'='));
 const data=Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
 if(data.length!==65||data[0]!==4)throw new Error('Clave pública Web Push inválida.');
 return data;
}
function decodeRecord():WebPushRecord|null {
 try{
  const raw=localStorage.getItem(PUSH_RECORD_KEY);
  if(!raw)return inMemoryRecord;
  const row:unknown=JSON.parse(raw);
  if(!row||typeof row!=='object')return null;
  const parsed=row as Record<string,unknown>;
  return Number.isSafeInteger(parsed.id)&&Number(parsed.id)>0&&Number.isSafeInteger(parsed.userId)&&Number(parsed.userId)>0
   ?{id:Number(parsed.id),userId:Number(parsed.userId)}:null;
 }catch{return inMemoryRecord;}
}
function saveRecord(record:WebPushRecord|null):void {
 inMemoryRecord=record;
 try{
  if(record)localStorage.setItem(PUSH_RECORD_KEY,JSON.stringify(record));
  else localStorage.removeItem(PUSH_RECORD_KEY);
 }catch{/* Keep browser's permission state intact; user can retry later. */}
}
export function supportsWebPush():boolean {
 return typeof window!=='undefined'&&window.isSecureContext&&
 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
}
export function webPushPermission():NotificationPermission|'unsupported' {
 if(!supportsWebPush())return 'unsupported';
 return Notification.permission;
}
export async function getWebPushConfig():Promise<WebPushConfig> {
 if(PREVIEW_READONLY)throw new Error('Las notificaciones reales no están disponibles en vista previa.');
 const raw=await request<WebPushConfig>('/v11/push/config');
 if(!raw||raw.enabled!==true||!validVapidPublicKey(raw.public_key))
  throw new Error('El servidor todavía no tiene Web Push VAPID habilitado. No se solicitarán permisos.');
 return raw;
}
function subscriptionPayload(sub:PushSubscription) {
 const json=sub.toJSON();
 const endpoint=String(json.endpoint||'');
 const p256dh=String(json.keys?.p256dh||''),auth=String(json.keys?.auth||'');
 if(!endpoint.startsWith('https://')||endpoint.length>1200||!p256dh||!auth)
  throw new Error('El navegador no devolvió una suscripción push válida.');
 return {endpoint,p256dh,auth,platform:'web',device_label:'Tala Eats PWA'};
}
async function registration():Promise<ServiceWorkerRegistration> {
 const found=await navigator.serviceWorker.getRegistration('/');
 return found??navigator.serviceWorker.register('/sw.js',{scope:'/'});
}
export async function enableWebPush(userId:number,config:WebPushConfig):Promise<void> {
 if(!Number.isSafeInteger(userId)||userId<=0)throw new Error('Inicia sesión para activar las notificaciones.');
 if(!supportsWebPush())throw new Error('Instala Tala Eats o usa un navegador compatible con notificaciones push.');
 // UI has already verified capability; permission MUST be requested in the
 // direct click handler (not after any network await).
 if(config.enabled!==true||!validVapidPublicKey(config.public_key))
  throw new Error('El backend no confirmó la configuración Web Push.');
 if(Notification.permission==='denied')throw new Error('Las notificaciones están bloqueadas en los ajustes del navegador.');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')throw new Error('No se concedió permiso para notificaciones.');
 const sw=await registration();
 const stale=decodeRecord();
 if(stale&&stale.userId!==userId){
  // Switching customer account on a shared browser: invalidate locally first.
  await sw.pushManager.getSubscription().then(sub=>sub?.unsubscribe());
  saveRecord(null);
 }
 let sub=await sw.pushManager.getSubscription();
 if(sub){
  // Recreate if the active key differs from the backend's confirmed key.
  const expected=vapidToBytes(config.public_key!);
  const actual=sub.options.applicationServerKey?new Uint8Array(sub.options.applicationServerKey):null;
  if(!actual||actual.length!==expected.length||actual.some((v,i)=>v!==expected[i])){
   await sub.unsubscribe();sub=null;
  }
 }
 if(!sub)sub=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidToBytes(config.public_key!) as BufferSource});
 try{
  const reply=await request<{id:number;active:boolean}>('/v11/push/subscriptions',{method:'POST',body:JSON.stringify(subscriptionPayload(sub))});
  if(!reply||!Number.isSafeInteger(reply.id)||reply.id<=0||reply.active!==true)
   throw new Error('El servidor no confirmó el registro de notificaciones.');
  saveRecord({id:reply.id,userId});
 }catch(e){
  // Fail closed, never call this active when backend registration failed.
  await sub.unsubscribe().catch(()=>false);saveRecord(null);
  if(e instanceof ApiError&&[404,405,501].includes(e.status))
   throw new Error('El backend Node.js aún no ofrece registro Web Push para la PWA.');
  throw e;
 }
}
export async function disableWebPush(userId:number):Promise<void> {
 const record=decodeRecord();
 let remoteError:unknown;
 if(record&&record.userId===userId){
  try{await request<void>(`/v11/push/subscriptions/${record.id}`,{method:'DELETE'});}
  catch(e){remoteError=e;}
 }
 let localError:unknown;
 try{
  if('serviceWorker'in navigator){
   const reg=await navigator.serviceWorker.getRegistration('/');
   const sub=await reg?.pushManager.getSubscription();
   if(sub&&!(await sub.unsubscribe()))throw new Error('El navegador no confirmó la desactivación.');
  }
 }catch(e){localError=e;}
 saveRecord(null);
 if(localError)throw localError;
 if(remoteError)throw new Error('Se desactivaron los avisos del navegador, pero el servidor no confirmó la baja. Revisa tu cuenta más tarde.');
}
export function webPushRecordForUser(userId:number):boolean {
 const row=decodeRecord();return row?.userId===userId;
}
export async function isWebPushEnabledForUser(userId:number):Promise<boolean> {
 if(!webPushRecordForUser(userId)||!supportsWebPush()||Notification.permission!=='granted')return false;
 const reg=await navigator.serviceWorker.getRegistration('/');
 return Boolean(await reg?.pushManager.getSubscription());
}
/** A shared-browser account switch must never inherit another user's push. */
export async function clearForeignWebPush(currentUserId:number):Promise<void> {
 if(!supportsWebPush())return;
 const record=decodeRecord();
 if(record?.userId===currentUserId)return;
 try{
  const reg=await navigator.serviceWorker.getRegistration('/');
  const subscription=await reg?.pushManager.getSubscription();
  if(subscription)await subscription.unsubscribe();
 }catch{/* Browser may block access; never request permission here. */}
 saveRecord(null);
}

/** Called before logout, not silently on page load. */
export async function revokeWebPushBeforeLogout(userId:number):Promise<void> {
 try{await disableWebPush(userId);}
 catch{
  // Even with blocked localStorage, always attempt to revoke the local browser
  // subscription. Backend must clean up any expired endpoint (HTTP 410).
 }
}
