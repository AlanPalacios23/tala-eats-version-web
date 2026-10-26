import {useEffect,useRef,useState} from 'react';
import {ArrowDownToLine,Check,Share2,Smartphone,X} from 'lucide-react';
import {useLocation} from 'react-router-dom';
import {PREVIEW_READONLY} from '../lib/preview';

/** A friendly, non-push first-visit reminder; browsers retain control of PWA installation. */
export const CUSTOMER_PWA_INSTALL_NOTICE_KEY='tala-eats-customer-pwa-install-seen-v1';
export const CUSTOMER_PWA_HELP_EVENT='tala-eats-open-install-help';
const PROMPT_DELAY_MS=1200;
type InstallOutcome={outcome:'accepted'|'dismissed';platform?:string};
interface DeferredInstallEvent extends Event {
 prompt():Promise<InstallOutcome|void>;
 userChoice?:Promise<InstallOutcome>;
}
type AppleNavigator=Navigator&{standalone?:boolean};
export function isCustomerInstallRoute(path:string):boolean {
 return ['/iniciar','/clientes','/buscar','/acceso'].includes(path);
}
export function isInstalledPwa(mq:boolean,standalone:boolean):boolean{return mq||standalone;}
export function pwaInstallPlatform(agent:string):'ios'|'android'|'other' {
 if(/iPad|iPhone|iPod/i.test(agent)||/Macintosh/i.test(agent)&&/Mobile/i.test(agent))return 'ios';
 if(/Android/i.test(agent))return 'android';
 return 'other';
}
function localSeen():boolean {
 try{return window.localStorage.getItem(CUSTOMER_PWA_INSTALL_NOTICE_KEY)==='seen';}
 catch{return false;}
}
function markSeen():void {
 try{window.localStorage.setItem(CUSTOMER_PWA_INSTALL_NOTICE_KEY,'seen');}
 catch{/* Restricted storage: the current session still suppresses repeats. */}
}
function installedInBrowser():boolean {
 return isInstalledPwa(window.matchMedia?.('(display-mode: standalone)').matches??false,(navigator as AppleNavigator).standalone===true);
}
export function CustomerPwaInstallNotice(){
 const {pathname}=useLocation();
 const [open,setOpen]=useState(false),[help,setHelp]=useState(false);
 const [canPrompt,setCanPrompt]=useState(false),[installed,setInstalled]=useState(()=>typeof window!=='undefined'&&installedInBrowser());
 const [platform]=useState(()=>typeof navigator==='undefined'?'other':pwaInstallPlatform(navigator.userAgent));
 const [busy,setBusy]=useState(false);
 const alreadyOffered=useRef(false),promptEvent=useRef<DeferredInstallEvent|null>(null);
 const eligible=isCustomerInstallRoute(pathname);
 useEffect(()=>{
  if(PREVIEW_READONLY)return;
  const onPrompt=(event:Event)=>{
   event.preventDefault();
   promptEvent.current=event as DeferredInstallEvent;
   setCanPrompt(true);
  };
  const onInstalled=()=>{
   promptEvent.current=null;setCanPrompt(false);setInstalled(true);
   setOpen(false);markSeen();
  };
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  const media=window.matchMedia?.('(display-mode: standalone)');
  const change=()=>{if(installedInBrowser())onInstalled();};
  media?.addEventListener?.('change',change);
  return()=>{
   window.removeEventListener('beforeinstallprompt',onPrompt);
   window.removeEventListener('appinstalled',onInstalled);
   media?.removeEventListener?.('change',change);
  };
 },[]);
 useEffect(()=>{
  if(PREVIEW_READONLY||installed||!eligible||alreadyOffered.current||localSeen())return;
  // Show after initial onboarding paint, not over the first animation frame.
  const timer=window.setTimeout(()=>{
   if(installedInBrowser())return;
   alreadyOffered.current=true;markSeen();setOpen(true);
  },PROMPT_DELAY_MS);
  return()=>window.clearTimeout(timer);
 },[eligible,installed]);
 useEffect(()=>{
  if(PREVIEW_READONLY)return;
  const showHelp=()=>{
   if(installedInBrowser())return;
   setOpen(true);setHelp(true);
  };
  window.addEventListener(CUSTOMER_PWA_HELP_EVENT,showHelp);
  return()=>window.removeEventListener(CUSTOMER_PWA_HELP_EVENT,showHelp);
 },[]);
 const close=()=>{setOpen(false);markSeen();};
 async function install(){
  const event=promptEvent.current;
  if(!event){setHelp(true);return;}
  promptEvent.current=null;setCanPrompt(false);
  setBusy(true);
  try{
   const result=await event.prompt();
   const choice=result&&'outcome'in result?result:event.userChoice?await event.userChoice:undefined;
   if(choice?.outcome==='accepted'){markSeen();setOpen(false);}
   else setHelp(true);
  }catch{setHelp(true);}
  finally{setBusy(false);}
 }
 if(PREVIEW_READONLY||installed||!open||!eligible)return null;
 return <aside className="customer-pwa-install-notice" aria-label="Instala la aplicación de Tala Eats">
  <img className="customer-pwa-install-icon" src="/icons/icon-192.png" alt="" width="54" height="54"/>
  <div className="customer-pwa-install-copy">
   <strong><Smartphone size={18} aria-hidden="true"/> Instala Tala Eats</strong>
   <p>Ten Pedir comida en tu pantalla de inicio y ábrela como una app, sin entrar al navegador.</p>
   {help&&<p className="customer-pwa-install-steps" role="status">
    {platform==='ios'?<><Share2 size={17} aria-hidden="true"/> En Safari toca <b>Compartir</b> y elige <b>Añadir a pantalla de inicio</b>; después confirma <b>Añadir</b>.</>:
     platform==='android'?'Abre el menú del navegador (⋮) y selecciona «Instalar aplicación» o «Añadir a pantalla principal».':
     'Busca «Instalar aplicación» en la barra de direcciones o en el menú del navegador.'}
   </p>}
   <div className="customer-pwa-install-actions">
    <button type="button" className="customer-pwa-install-primary" disabled={busy} onClick={()=>void install()}>
     {canPrompt?<><ArrowDownToLine size={16}/> {busy?'Abriendo instalación…':'Instalar ahora'}</>:
      help?<><Check size={16}/> Entendido</>:<><ArrowDownToLine size={16}/> {platform==='ios'?'Cómo instalar en iPhone':'Cómo instalar'}</>}
    </button>
    <button type="button" className="customer-pwa-install-later" onClick={close}>Ahora no</button>
   </div>
  </div>
  <button type="button" className="customer-pwa-install-close" onClick={close} aria-label="Cerrar aviso de instalación"><X size={18}/></button>
 </aside>;
}
export function CustomerPwaInstallMenuButton(){
 const [installed,setInstalled]=useState(()=>typeof window!=='undefined'&&installedInBrowser());
 useEffect(()=>{
  const onInstalled=()=>setInstalled(true);
  window.addEventListener('appinstalled',onInstalled);
  return()=>window.removeEventListener('appinstalled',onInstalled);
 },[]);
 if(PREVIEW_READONLY||installed)return null;
 return <button type="button" className="text-button install" onClick={()=>window.dispatchEvent(new Event(CUSTOMER_PWA_HELP_EVENT))}>Instalar PWA</button>;
}
