import {useCallback,useEffect,useState} from 'react';
import {ArrowRight,ArrowDownToLine,CheckCircle2,Clock3,Info,RefreshCw,ShieldCheck,Wallet, X} from 'lucide-react';
import {api,pesos} from '../lib/api';
import type {MerchantEarnings,MerchantFinance} from '../lib/api';
import {merchantEarningTotals,merchantWithdrawalEnabled} from '../lib/merchant-wallet';
import type {MerchantConnectStatus,MerchantTab} from '../lib/restaurant-state';
import '../styles/restaurant-mobile-wallet.css';

type Props={
 restaurantId:number;finance:MerchantFinance|null;connect:MerchantConnectStatus|null;
 go:(tab:MerchantTab)=>void;
};
const money=(minor:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(minor/100);
const statusLabel=(state:string):string=>({
 held:'En revisión',reserved:'Reservadas',pending:'Pendientes',
 approved:'Aprobadas',settled:'Liquidadas',transferred:'Transferidas'
} as Record<string,string>)[state]??'Registro: '+state.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,40);
export function MerchantWallet({restaurantId,finance,connect,go}:Props){
 const [earnings,setEarnings]=useState<MerchantEarnings|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [withdrawOpen,setWithdrawOpen]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const data=await api.ownerEarnings(restaurantId);
   if(data.restaurant_id!==restaurantId||data.currency!=='MXN'||
      data.unit!=='centavos'||data.transfer_not_executed!==true)
    throw new Error('La información de ganancias no coincide con el comercio.');
   setEarnings(data);
  }catch(e){
   setEarnings(null);
   setError(e instanceof Error?e.message:'No fue posible consultar las ganancias.');
  }finally{setLoading(false);}
 },[restaurantId]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!withdrawOpen)return;
  const onEsc=(event:KeyboardEvent)=>{if(event.key==='Escape')setWithdrawOpen(false);};
  document.addEventListener('keydown',onEsc);
  return()=>document.removeEventListener('keydown',onEsc);
 },[withdrawOpen]);
 const totals=merchantEarningTotals(earnings);
 const enabled=merchantWithdrawalEnabled(earnings);
 const connected=Boolean(connect?.owner_approved&&connect?.transfers_active&&
  connect?.payouts_enabled&&connect?.details_submitted);
 return <div className="mw-screen" data-merchant-wallet="true">
  <header className="mw-heading">
   <div><span className="mw-overline">MI COMERCIO</span><h2>Wallet</h2></div>
   <button type="button" className="mw-refresh" aria-label="Actualizar Wallet"
    onClick={()=>void refresh()} disabled={loading}><RefreshCw size={19}/></button>
  </header>
  <section className="mw-balance" aria-labelledby="mw-balance-title">
   <span className="mw-balance-mark"><Wallet size={18}/> TALA EATS WALLET</span>
   <p id="mw-balance-title">Disponible para retirar</p>
   <strong aria-label="Saldo disponible aún no certificado">—</strong>
   <span className="mw-balance-note"><ShieldCheck size={15}/> El backend aún no certifica un saldo retirable.</span>
   <button type="button" className="mw-withdraw" onClick={()=>setWithdrawOpen(true)}
    aria-haspopup="dialog" aria-label="Retirar ganancias, consultar disponibilidad">
    <ArrowDownToLine size={19}/> Retirar ganancias <ArrowRight size={17}/></button>
  </section>
  <section className="mw-summary" aria-label="Ganancias del comercio">
   <div>
    <span>Ganancias registradas</span>
    <strong>{loading?'Consultando…':totals?money(totals.registeredMinor):'—'}</strong>
    <small>Asignaciones reportadas, no saldo bancario.</small>
   </div>
   <div>
    <span>Neto contable</span>
    <strong>{finance?pesos(finance.net_payable):'—'}</strong>
    <small>No significa fondos disponibles.</small>
   </div>
  </section>
  {error&&<div className="mw-notice" role="alert"><Info size={17}/>{error}</div>}
  {!connected&&<button type="button" className="mw-connect" onClick={()=>go('activacion')}>
   <ShieldCheck size={19}/><span><strong>Completa tu cuenta de pagos</strong><small>Verifica titularidad y requisitos de Stripe Connect.</small></span><ArrowRight size={17}/>
  </button>}
  <section className="mw-activity">
   <div className="mw-activity-heading"><h3>Movimientos</h3><span>Registros del servidor</span></div>
   {loading?<p className="mw-empty" role="status"><RefreshCw size={16}/> Consultando movimientos…</p>:
    totals&&totals.rows.length>0?
    <div className="mw-entries">{totals.rows.map(row=><div key={row.state} className="mw-entry">
     <span className="mw-entry-icon"><Clock3 size={18}/></span>
     <span className="mw-entry-copy"><strong>{statusLabel(row.state)}</strong><small>{row.orders} pedido(s) registrados</small></span>
     <b>{money(row.amountMinor)}</b>
    </div>)}</div>:
    <p className="mw-empty">No hay ganancias verificadas disponibles en esta consulta.</p>}
   {finance?.payouts?.length?<>
    <h4>Liquidaciones reportadas</h4>
    <div className="mw-entries">{finance.payouts.map(p=><div className="mw-entry" key={p.id}>
     <span className="mw-entry-icon"><CheckCircle2 size={18}/></span>
     <span className="mw-entry-copy"><strong>Registro #{p.id}</strong><small>Estado: {p.status}</small></span>
     <b>{pesos(p.amount)}</b>
    </div>)}</div>
   </>:null}
  </section>
  <p className="mw-disclaimer">Las ventas, las asignaciones retenidas y los cobros en efectivo no son automáticamente dinero disponible para retirar. Los saldos y transferencias bancarias necesitan conciliación real del servidor.</p>
  {withdrawOpen&&<div className="mw-modal-backdrop" onClick={()=>setWithdrawOpen(false)}>
   <section className="mw-modal" role="dialog" aria-modal="true"
    aria-labelledby="mw-modal-title" onClick={e=>e.stopPropagation()}>
    <button className="mw-modal-close" type="button" aria-label="Cerrar información de retiro"
     onClick={()=>setWithdrawOpen(false)}><X size={21}/></button>
    <span className="mw-modal-icon"><ArrowDownToLine size={25}/></span>
    <h3 id="mw-modal-title">Retirar ganancias</h3>
    <p>{enabled?'Confirma el retiro con el servidor.':
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
