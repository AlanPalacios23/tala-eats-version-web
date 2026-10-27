import {useEffect,useRef,useState} from 'react';
import {Bell,BellOff} from 'lucide-react';
import type {Order} from '../lib/types';
import {newlyReceivedOrderIds,receivedOrderIds} from '../lib/restaurant-alerts';
type Props={orders:Order[];live:boolean;onOpenOrders:()=>void};
export function RestaurantOrderAlerts({orders,live,onOpenOrders}:Props){
 const last=useRef<Set<number>|null>(null);
 const audio=useRef<AudioContext|null>(null);
 const [sound,setSound]=useState(false);
 const [notice,setNotice]=useState('');
 const [unsupported,setUnsupported]=useState(false);
 useEffect(()=>{
  if(!live)return;
  const previous=last.current;
  const incoming=newlyReceivedOrderIds(previous,orders);
  last.current=receivedOrderIds(orders);
  if(!incoming.length)return;
  setNotice(incoming.length===1?'Entró un pedido nuevo':'Entraron '+incoming.length+' pedidos nuevos');
  if(sound&&document.visibilityState==='visible'&&audio.current?.state==='running'){
   // Gentle paired chime, only after a user-initiated activation and only
   // for NEW orders after initial hydration. No native notifications or tracking.
   const ctx=audio.current;
   for(const [i,freq] of [660,880].entries()){
    const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime+i*.14;
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.055,now+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.14);
   }
  }
 },[orders,live,sound]);
 useEffect(()=>{
  if(!notice)return;
  const timer=window.setTimeout(()=>setNotice(''),11000);
  return()=>window.clearTimeout(timer);
 },[notice]);
 useEffect(()=>()=>{void audio.current?.close();audio.current=null;},[]);
 async function toggleSound(){
  if(sound){setSound(false);return;}
  if(!window.AudioContext){setUnsupported(true);return;}
  try{
   const ctx=audio.current??new window.AudioContext();
   audio.current=ctx;
   await ctx.resume();
   if(ctx.state==='running'){setSound(true);setUnsupported(false);}
   else setUnsupported(true);
  }catch{setUnsupported(true);}
 }
 return <div className="rp-order-alerts">
  <button type="button" className={'rp-alert-toggle '+(sound?'enabled':'')} onClick={()=>void toggleSound()}
   aria-pressed={sound} aria-label={sound?'Desactivar alertas sonoras':'Activar alertas sonoras'}
   title={sound?'Alertas sonoras activas':'Activar un sonido suave para pedidos nuevos (solo con la app abierta)'}>
   {sound?<Bell size={18}/>:<BellOff size={18}/>}
   <span className="rp-alert-toggle-label">{sound?'Sonido activo':'Sin sonido'}</span>
  </button>
  {notice&&<button className="rp-order-toast" type="button" onClick={()=>{setNotice('');onOpenOrders();}}
   aria-live="polite"><span className="rp-toast-dot"/>{notice}<span className="rp-toast-open">Ver pedidos</span></button>}
  {unsupported&&<div className="rp-alert-error" role="status">Este navegador no permite activar el sonido.</div>}
 </div>;
}
