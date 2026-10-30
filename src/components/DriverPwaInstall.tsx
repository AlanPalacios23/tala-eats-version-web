import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDownToLine,CheckCircle2,Share2,Smartphone,X} from 'lucide-react';
import {useLocation} from 'react-router-dom';
import {PREVIEW_READONLY} from '../lib/preview';
import {
 DRIVER_INSTALL_DISMISSED_KEY,DRIVER_INSTALL_HELP_EVENT,
 DRIVER_INSTALL_PROMPT_DELAY_MS,DRIVER_INSTALL_SNOOZE_DAYS,
 driverInstallEligible,driverInstallPlatform,driverInstallSnoozed,driverPwaInstalled,
} from '../lib/driver-install';
import type {DriverInstallPlatform} from '../lib/driver-install';
import '../styles/driver-install.css';

type InstallChoice={outcome:'accepted'|'dismissed'};
interface DeferredDriverInstall extends Event {
 prompt():Promise<void>;
 userChoice?:Promise<InstallChoice>;
}
type IOSNavigator=Navigator&{standalone?:boolean};
const platform:DriverInstallPlatform=typeof navigator==='undefined'?'other':driverInstallPlatform(navigator.userAgent);

function isInstalled():boolean {
 if(typeof window==='undefined')return false;
 return driverPwaInstalled(
  Boolean(window.matchMedia?.('(display-mode: standalone)').matches)||
   Boolean(window.matchMedia?.('(display-mode: fullscreen)').matches),
  (navigator as IOSNavigator).standalone===true,
 );
}
function snoozed():boolean {
 try{return driverInstallSnoozed(localStorage.getItem(DRIVER_INSTALL_DISMISSED_KEY),Date.now());}
 catch{return false;}
}
function snooze():void {
 try{localStorage.setItem(DRIVER_INSTALL_DISMISSED_KEY,
  String(Date.now()+DRIVER_INSTALL_SNOOZE_DAYS*86400000));}
 catch{/* Private browsing may disable storage: this remains optional. */}
}
/** Browsers control installation. Android Chromium can show its native dialog;
 * iOS does not expose beforeinstallprompt and requires Share > Add to Home Screen.
 */
export function DriverPwaInstallNotice(){
 const {pathname}=useLocation();
 const [installed,setInstalled]=useState(isInstalled);
 const [open,setOpen]=useState(false);
 const [help,setHelp]=useState(false);
 const [canPrompt,setCanPrompt]=useState(false);
 const [busy,setBusy]=useState(false);
 const deferred=useRef<DeferredDriverInstall|null>(null);
 const alreadyOffered=useRef(false);
 const [temporarilyDismissed,setTemporarilyDismissed]=useState(false);

 useEffect(()=>{
  if(PREVIEW_READONLY)return;
  const onPrompt=(raw:Event)=>{
   raw.preventDefault();
   deferred.current=raw as DeferredDriverInstall;
   setCanPrompt(true);
  };
  const onInstalled=()=>{
   deferred.current=null;
   setInstalled(true);
   setCanPrompt(false);
   setOpen(false);
  };
  const onDisplay=()=>{if(isInstalled())onInstalled();};
  const media=window.matchMedia?.('(display-mode: standalone)');
  const full=window.matchMedia?.('(display-mode: fullscreen)');
  window.addEventListener('beforeinstallprompt',onPrompt);
  window.addEventListener('appinstalled',onInstalled);
  media?.addEventListener?.('change',onDisplay);
  full?.addEventListener?.('change',onDisplay);
  return()=>{
   window.removeEventListener('beforeinstallprompt',onPrompt);
   window.removeEventListener('appinstalled',onInstalled);
   media?.removeEventListener?.('change',onDisplay);
   full?.removeEventListener?.('change',onDisplay);
  };
 },[]);
 const eligible=driverInstallEligible(pathname,platform,installed,PREVIEW_READONLY);
 useEffect(()=>{
  if(!eligible||alreadyOffered.current||temporarilyDismissed||snoozed())return;
  const timer=window.setTimeout(()=>{
   if(isInstalled())return;
   alreadyOffered.current=true;
   setOpen(true);
  },DRIVER_INSTALL_PROMPT_DELAY_MS);
  return()=>window.clearTimeout(timer);
 },[eligible,temporarilyDismissed]);

 const showHelp=useCallback(()=>{
  if(PREVIEW_READONLY||isInstalled())return;
  setOpen(true);
  setHelp(true);
 },[]);
 useEffect(()=>{
  window.addEventListener(DRIVER_INSTALL_HELP_EVENT,showHelp);
  return()=>window.removeEventListener(DRIVER_INSTALL_HELP_EVENT,showHelp);
 },[showHelp]);
 const close=()=>{setOpen(false);setHelp(false);setTemporarilyDismissed(true);snooze();};
 async function install(){
  // Must call prompt() directly from the click gesture, never from a timer.
  const event=deferred.current;
  if(!event||platform!=='android'){
   setHelp(true);return;
  }
  deferred.current=null;
  setCanPrompt(false);
  setBusy(true);
  try{
   await event.prompt();
   const choice=await event.userChoice;
   if(choice?.outcome==='accepted'){
    setOpen(false);
    setTemporarilyDismissed(true);
   }else{
    // Browser refusal is not an install success. Offer supported manual steps.
    setHelp(true);
   }
  }catch{setHelp(true);}
  finally{setBusy(false);}
 }
 if(!eligible||!open)return null;
 return <aside className="di-notice" role="region" aria-label="Instalar Tala Eats Repartidor">
  <div className="di-heading">
   <img src="/branding/tala-eats-repartidor-icon-192.png" alt="" width="46" height="46"/>
   <div><span className="di-eyebrow">TALA EATS · REPARTIDORES</span>
    <strong><Smartphone size={17} aria-hidden="true"/> Llévala como una app</strong></div>
   <button type="button" className="di-close" aria-label="Cerrar invitación de instalación" onClick={close}><X size={19}/></button>
  </div>
  <p>Accede a tus entregas desde la pantalla de inicio, con una experiencia de pantalla completa.</p>
  {help&&<div className="di-steps" role="status">
   {platform==='ios'?<>
    <Share2 size={19} aria-hidden="true"/>
    <span>En Safari toca <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>, activa <b>Abrir como app web</b> (si aparece) y pulsa <b>Añadir</b>. iOS necesita tu confirmación.</span>
   </>:<>
    <ArrowDownToLine size={19} aria-hidden="true"/>
    <span>Abre el menú del navegador (⋮) y pulsa <b>Instalar aplicación</b> o <b>Añadir a pantalla principal</b>. Si Chrome muestra el aviso nativo, confírmalo.</span>
   </>}
  </div>}
  <div className="di-actions">
   <button type="button" className="di-install" disabled={busy} onClick={()=>void install()}>
    {canPrompt&&platform==='android'?<><ArrowDownToLine size={18}/> {busy?'Abriendo…':'Instalar en Android'}</>:
     help?<><CheckCircle2 size={18}/> Entendido</>:<><Share2 size={18}/> {platform==='ios'?'Instalar en iPhone':'Cómo instalar'}</>}
   </button>
   <button type="button" className="di-later" onClick={close}>Ahora no</button>
  </div>
 </aside>;
}
/** Always-available entry point after closing the one-time welcome notice. */
export function DriverPwaInstallButton(){
 const [installed,setInstalled]=useState(isInstalled);
 useEffect(()=>{
  const onInstalled=()=>setInstalled(true);
  window.addEventListener('appinstalled',onInstalled);
  return()=>window.removeEventListener('appinstalled',onInstalled);
 },[]);
 if(PREVIEW_READONLY||installed||platform==='other')return null;
 return <button type="button" className="di-reopen"
  onClick={()=>window.dispatchEvent(new Event(DRIVER_INSTALL_HELP_EVENT))}>
  <ArrowDownToLine size={17}/> Instalar aplicación
 </button>;
}
