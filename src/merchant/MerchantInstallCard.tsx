import {useEffect,useState} from 'react';
import {CheckCircle2,Download,Smartphone} from 'lucide-react';

type InstallEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};
const isIosDevice=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
export function isStandaloneDisplay():boolean {
  return window.matchMedia('(display-mode: standalone)').matches||
    Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}
export default function MerchantInstallCard(){
  const [installed,setInstalled]=useState(false);
  const [candidate,setCandidate]=useState<InstallEvent|null>(null);
  const [ios,setIos]=useState(false);
  const [opening,setOpening]=useState(false);
  useEffect(()=>{
    setIos(isIosDevice());
    setInstalled(isStandaloneDisplay());
    const mode=window.matchMedia('(display-mode: standalone)');
    const sync=()=>setInstalled(isStandaloneDisplay());
    const available=(event:Event)=>{
      event.preventDefault();
      setCandidate(event as InstallEvent);
    };
    const done=()=>{setInstalled(true);setCandidate(null);};
    mode.addEventListener('change',sync);
    window.addEventListener('beforeinstallprompt',available);
    window.addEventListener('appinstalled',done);
    return()=>{
      mode.removeEventListener('change',sync);
      window.removeEventListener('beforeinstallprompt',available);
      window.removeEventListener('appinstalled',done);
    };
  },[]);
  const install=async()=>{
    if(!candidate||opening)return;
    setOpening(true);
    const offer=candidate;
    setCandidate(null);
    try{
      await offer.prompt();
      await offer.userChoice.catch(()=>null);
    }finally{setOpening(false);}
  };
  return <section className="merchant-install-card" aria-label="Instalar Tala Eats Restaurante">
    <span className="merchant-install-icon"><Smartphone size={20}/></span>
    <div className="merchant-install-copy"><h2>En tu pantalla de inicio</h2>
      <p>{installed?'Tala Eats Restaurante se está usando como aplicación instalada.':
        candidate?'Accede a tus pedidos desde la pantalla de inicio, sin abrir el navegador.':
        ios?'En Safari, toca Compartir y luego «Agregar a pantalla de inicio».':
        'En Chrome o Edge, abre el menú del navegador y selecciona «Instalar aplicación», si está disponible.'}</p>
    </div>
    {installed?<span className="merchant-install-ready"><CheckCircle2 size={16}/> Instalada</span>:
      candidate?<button type="button" className="merchant-install-button" onClick={()=>void install()} disabled={opening}>
        <Download size={16}/>{opening?'Abriendo…':'Instalar'}
      </button>:null}
  </section>;
}
