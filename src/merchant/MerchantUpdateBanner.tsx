import {useEffect,useRef,useState} from 'react';
import {RefreshCw,X} from 'lucide-react';

/**
 * Does not poll private endpoints or silently reload the merchant workspace.
 * A waiting worker becomes active only after a deliberate user action.
 */
export default function MerchantUpdateBanner({locked}:{locked:boolean}){
  const [worker,setWorker]=useState<ServiceWorker|null>(null);
  const [dismissed,setDismissed]=useState(false);
  const [message,setMessage]=useState('');
  const applying=useRef(false);
  useEffect(()=>{
    if(!('serviceWorker' in navigator))return;
    let mounted=true;
    let registration:ServiceWorkerRegistration|null=null;
    let installing:ServiceWorker|null=null;
    const show=()=>{
      if(!mounted||!registration)return;
      // On a first installation there is no previous controlled client.
      if(navigator.serviceWorker.controller&&registration.waiting){
        setWorker(registration.waiting);setDismissed(false);
      }
    };
    const stateChanged=()=>{if(installing?.state==='installed')show();};
    const updateFound=()=>{
      installing?.removeEventListener('statechange',stateChanged);
      installing=registration?.installing??null;
      installing?.addEventListener('statechange',stateChanged);
    };
    const changed=()=>{
      if(applying.current)window.location.reload();
    };
    navigator.serviceWorker.getRegistration('/').then(value=>{
      if(!mounted||!value)return;
      registration=value;
      show();
      registration.addEventListener('updatefound',updateFound);
      updateFound();
    }).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',changed);
    return()=>{
      mounted=false;
      registration?.removeEventListener('updatefound',updateFound);
      installing?.removeEventListener('statechange',stateChanged);
      navigator.serviceWorker.removeEventListener('controllerchange',changed);
    };
  },[]);
  if(!worker||dismissed)return null;
  const approve=()=>{
    if(locked){setMessage('Termina la operación actual antes de actualizar.');return;}
    // Do not throw away unsaved catalog fields or the add-product draft.
    const hasUnsaved=document.querySelector('.merchant-product .merchant-discard-button')!==null||
      document.querySelector('.merchant-add-form')!==null;
    if(hasUnsaved){setMessage('Guarda o descarta los cambios del menú antes de actualizar.');return;}
    applying.current=true;setMessage('Instalando nueva versión…');
    worker.postMessage({type:'MERCHANT_APPROVE_UPDATE'});
  };
  return <div className="merchant-update-banner" role="status" aria-live="polite">
    <RefreshCw size={17} aria-hidden="true"/>
    <div><strong>Actualización disponible</strong>
      <p>{message||'La nueva versión se instalará cuando tú lo decidas. Tus pedidos no se reinician automáticamente.'}</p>
    </div>
    <button type="button" className="merchant-update-approve" onClick={approve} disabled={locked||applying.current}>Actualizar</button>
    <button type="button" className="merchant-update-close" onClick={()=>setDismissed(true)}
      aria-label="Posponer actualización"><X size={17}/></button>
  </div>;
}
