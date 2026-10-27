import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,RefreshCw,X} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {MerchantEarnings,MerchantFinance} from '../lib/api';
import type {Order} from '../lib/types';
import {MerchantFinanceActivity} from './RestaurantParity';
import {merchantEarningTotals,merchantWithdrawalEnabled} from '../lib/merchant-wallet';
import type {MerchantConnectStatus,MerchantTab} from '../lib/restaurant-state';
import '../styles/restaurant-mobile-wallet.css';

type Props={
 restaurantId:number;finance:MerchantFinance|null;connect:MerchantConnectStatus|null;
 orders:Order[];go:(tab:MerchantTab)=>void;
};
const money=(minor:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(minor/100);
const statusLabel=(state:string):string=>({
 held:'En revisión',reserved:'Reservadas',pending:'Pendientes',
 approved:'Aprobadas',settled:'Liquidadas',transferred:'Transferidas'
} as Record<string,string>)[state]??'Registro: '+state.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,40);
export function MerchantWallet({restaurantId,finance,connect,orders,go}:Props){
 const [earnings,setEarnings]=useState<MerchantEarnings|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [withdrawOpen,setWithdrawOpen]=useState(false);
 const requestId=useRef(0);
 const withdrawalTrigger=useRef<HTMLButtonElement>(null);
 const withdrawalDialog=useRef<HTMLElement>(null);
 const refresh=useCallback(async()=>{
  // Never retain a previous business's balance or accept superseded requests.
  const thisRequest=++requestId.current;
  setEarnings(null);setLoading(true);setError('');
  try{
   const data=await api.ownerEarnings(restaurantId);
   if(data.restaurant_id!==restaurantId||data.currency!=='MXN'||
      data.unit!=='centavos'||data.transfer_not_executed!==true||
      merchantEarningTotals(data)===null)
    throw new Error('La información de ganancias no coincide con el comercio o no está validada.');
   if(thisRequest===requestId.current)setEarnings(data);
  }catch(e){
   if(thisRequest===requestId.current){
    setEarnings(null);
    setError(e instanceof Error?e.message:'No fue posible consultar las ganancias.');
   }
  }finally{if(thisRequest===requestId.current)setLoading(false);}
 },[restaurantId]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>()=>{requestId.current+=1;},[]);
 useEffect(()=>{
  if(!withdrawOpen)return;
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  withdrawalDialog.current?.querySelector<HTMLButtonElement>('.mw-modal-close')?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    event.preventDefault();setWithdrawOpen(false);return;
   }
   if(event.key!=='Tab')return;
   // A bank-related dialog must not allow keyboard actions behind the sheet.
   const buttons=Array.from(withdrawalDialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
   const first=buttons[0],last=buttons[buttons.length-1];
   if(!first||!last)return;
   if(!withdrawalDialog.current?.contains(document.activeElement)){
    event.preventDefault();first.focus();
   }else if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();first.focus();
   }
  };
  document.addEventListener('keydown',onKey);
  return()=>{
   document.removeEventListener('keydown',onKey);
   document.body.style.overflow=previousOverflow;
   const target=withdrawalTrigger.current?.isConnected?withdrawalTrigger.current:previouslyFocused;
   if(target?.isConnected)target.focus({preventScroll:true});
  };
 },[withdrawOpen]);
 // Render guards run before effects: never display the previous restaurant's
 // financial snapshot, even for one frame when the merchant identity changes.
 const currentEarnings=earnings?.restaurant_id===restaurantId?earnings:null;
 const verifiedFinance=finance?.restaurant_id===restaurantId?finance:null;
 const totals=merchantEarningTotals(currentEarnings);
 const enabled=merchantWithdrawalEnabled(currentEarnings);
 const connected=Boolean(connect?.owner_approved&&connect?.transfers_active&&
  connect?.payouts_enabled&&connect?.details_submitted);
 return <div className="mw-screen" data-merchant-wallet="true">
  <header className="mw-heading">
   <div><h2>Wallet</h2><p>Ventas e ingreso de tu restaurante</p></div>
   <button type="button" className="mw-refresh" aria-label="Actualizar Wallet"
    onClick={()=>void refresh()} disabled={loading}><RefreshCw size={19}/></button>
  </header>
  <section className="mw-balance" aria-labelledby="mw-balance-title">
   
   <p id="mw-balance-title">Ventas registradas · histórico</p>
   <strong aria-label="Ventas históricas registradas en el servidor">{verifiedFinance?pesos(verifiedFinance.gross_food_sales):'—'}</strong>
   <div className="mw-net-line"><span>Ingreso neto contable</span>
    <strong>{verifiedFinance?pesos(verifiedFinance.net_payable):'—'}</strong></div>
   <span className="mw-balance-note">Disponible para retirar: saldo pendiente de verificación. Las ventas no equivalen a dinero retirable.</span>
   <button ref={withdrawalTrigger} type="button" className="mw-withdraw" onClick={()=>setWithdrawOpen(true)}
    aria-haspopup="dialog" aria-label="Retirar ganancias, consultar disponibilidad">
    Retirar ganancias</button>
  </section>
  <section className="mw-summary" aria-label="Ganancias del comercio">
   <div>
    <span>Ganancias registradas</span>
    <strong>{loading?'Consultando…':totals?money(totals.registeredMinor):'—'}</strong>
    <small>Según el servidor</small>
   </div>
   <div>
    <span>Comisiones registradas</span>
    <strong>{verifiedFinance?pesos(verifiedFinance.commission):'—'}</strong>
    <small>Según el servidor · no es un retiro</small>
   </div>
  </section>
  {error&&<div className="mw-notice" role="alert">{error}</div>}
  {!connected&&<button type="button" className="mw-connect" onClick={()=>go('activacion')}>
   <span><strong>Activar cuenta de pagos</strong></span><ArrowRight size={16}/>
  </button>}
  <section className="mw-activity">
   <div className="mw-activity-heading"><h3>Movimientos</h3></div>
   {loading?<p className="mw-empty" role="status">Consultando movimientos…</p>:
    totals&&totals.rows.length>0?
    <div className="mw-entries">{totals.rows.map(row=><div key={row.state} className="mw-entry">
     
     <span className="mw-entry-copy"><strong>{statusLabel(row.state)}</strong><small>{row.orders} pedido(s) registrados</small></span>
     <b>{money(row.amountMinor)}</b>
    </div>)}</div>:
    <p className="mw-empty">No hay ganancias verificadas disponibles en esta consulta.</p>}
   {verifiedFinance?.payouts?.length?<>
    <h4>Liquidaciones reportadas</h4>
    <div className="mw-entries">{verifiedFinance.payouts.map(p=><div className="mw-entry" key={p.id}>
     
     <span className="mw-entry-copy"><strong>Registro #{p.id}</strong><small>Estado: {p.status}</small></span>
     <b>{pesos(p.amount)}</b>
    </div>)}</div>
   </>:null}
  </section>
  <MerchantFinanceActivity orders={orders}/>
  
  {withdrawOpen&&<div className="mw-modal-backdrop" onClick={()=>setWithdrawOpen(false)}>
   <section ref={withdrawalDialog} className="mw-modal" role="dialog" aria-modal="true"
    aria-labelledby="mw-modal-title" aria-describedby="mw-modal-description" onClick={e=>e.stopPropagation()}>
    <button className="mw-modal-close" type="button" aria-label="Cerrar información de retiro"
     onClick={()=>setWithdrawOpen(false)}><X size={21}/></button>
    
    <h3 id="mw-modal-title">Retirar ganancias</h3>
    <p id="mw-modal-description">{enabled?'Confirma el retiro con el servidor.':
     'Los retiros bancarios aún no están habilitados en Tala Eats Restaurantes.'}</p>
    <div className="mw-modal-facts">
     <span>Saldo retirable confirmado <strong>No disponible</strong></span>
     <span>Transferencia bancaria <strong>No iniciada</strong></span>
    </div>
    <p className="mw-modal-detail">Por seguridad, Wallet no permite enviar dinero hasta que el backend LIVE valide el saldo, la cuenta de destino y la autorización de retiro. No se ha creado ninguna solicitud ni efectuado un cargo.</p>
    <button className="mw-modal-done" type="button" onClick={()=>setWithdrawOpen(false)}>Entendido</button>
    {!connected&&<button className="mw-modal-link" type="button" onClick={()=>{setWithdrawOpen(false);go('activacion');}}>Ver activación de Stripe Connect <ArrowRight size={16}/></button>}
   </section>
  </div>}
 </div>;
}
