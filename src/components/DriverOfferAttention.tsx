import {useEffect,useRef,useState} from 'react';
import {Bell,BellOff,CheckCircle2,X} from 'lucide-react';
import type {Order} from '../lib/types';
import '../styles/driver-operations-rc151.css';

type Props={offers:readonly Order[];eligible:boolean;offline:boolean};
/** Foreground-only, explicit opt-in. Does NOT claim background push or wake iOS.
 * Notifications originate only from freshly fetched backend-authorised offers.
 */
export function DriverOfferAttention({offers,eligible,offline}:Props){
 const [enabled,setEnabled]=useState(false);
 const [latest,setLatest]=useState<number|null>(null);
 const seen=useRef<Set<number>|null>(null);
 const currentIds=offers.filter(o=>Number.isSafeInteger(o.id)&&o.id>0).map(o=>o.id);
 const idsKey=currentIds.join(',');

 useEffect(()=>{
  const ids=new Set(currentIds);
  const previous=seen.current;
  seen.current=ids;
  if(!eligible||offline){
   setLatest(old=>old===null?old:null);
   return;
  }
  if(!previous)return; // never alert for offers already present on first load
  if(!enabled)return;
  const fresh=currentIds.find(id=>!previous.has(id));
  if(fresh===undefined)return;
  setLatest(fresh);
  if(document.visibilityState==='visible'){
   try{navigator.vibrate?.(90);}catch{/* optional on supported devices */}
  }
 // idsKey ensures background refreshes with identical IDs cannot retrigger.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[idsKey,eligible,offline,enabled]);

 const toggle=()=>{
  // Turning on notifications considers existing offers already seen.
  seen.current=new Set(currentIds);
  setLatest(null);
  setEnabled(old=>!old);
 };
 return <div className="dm-attention-wrap" aria-label="Avisos de nuevas ofertas">
  <div className="dm-attention-control">
   <span className="dm-attention-copy">{enabled?<Bell size={16} aria-hidden="true"/>:<BellOff size={16} aria-hidden="true"/>}
    <span><strong>Avisos de ofertas</strong><small>Solo con la app abierta · vibración si tu equipo la permite</small></span>
   </span>
   <button type="button" className={'dm-attention-toggle'+(enabled?' is-on':'')}
    aria-pressed={enabled} onClick={toggle}>{enabled?'Activados':'Activar'}</button>
  </div>
  {latest!==null&&enabled&&eligible&&!offline&&<div className="dm-attention-new" role="status" aria-live="polite">
   <CheckCircle2 size={18} aria-hidden="true"/>
   <span>Hay una nueva oferta autorizada: pedido #{latest}. Consulta sus datos antes de aceptar.</span>
   <button type="button" onClick={()=>setLatest(null)} aria-label="Cerrar aviso de nueva oferta"><X size={16}/></button>
  </div>}
 </div>;
}
