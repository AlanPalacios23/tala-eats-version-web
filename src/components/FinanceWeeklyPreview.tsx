import {useEffect,useState} from 'react';
import {api,type WeeklyWalletStatement} from '../lib/api';

type Props={kind:'restaurant'|'driver';restaurantId?:number};
const financeEnabled=import.meta.env.VITE_FINANCE_WALLET_V2_ENABLED==='true';
const numberMoney=(raw:string)=>{
 if(!/^\d{1,16}$/.test(raw)||BigInt(raw)>9_000_000_000_000n)return '—';
 return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'})
  .format(Number(raw)/100);
};

/** Read-only, never advertises an available balance or banking settlement. */
export function FinanceWeeklyPreview({kind,restaurantId}:Props){
 const [data,setData]=useState<WeeklyWalletStatement|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!financeEnabled)return;
  let current=true;
  setData(null);setError('');setLoading(true);
  const load=kind==='driver'?api.driverWeeklyWallet():
   restaurantId&&Number.isSafeInteger(restaurantId)?
    api.ownerWeeklyWallet(restaurantId):Promise.reject(new Error('Restaurante no válido'));
  void load.then(value=>{
   if(!current)return;
   if(value.currency!=='MXN'||value.unit!=='centavos'||
      value.kind!==kind||
      value.payee_id!==(kind==='restaurant'?restaurantId:value.payee_id)||
      value.withdrawable_cents!=='0'||value.bank_payout_confirmed!==false||
      value.release_approved!==false)
    throw new Error('Los importes no pasaron la validación del servidor.');
   setData(value);
  }).catch(e=>{
   if(current)setError(e instanceof Error?e.message:'Consulta semanal no disponible.');
  }).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[kind,restaurantId]);
 if(!financeEnabled)return null;
 return <section aria-label="Corte semanal del servidor" style={{
  border:'1px solid var(--border,#e8e8e8)',borderRadius:18,
  padding:16,margin:'12px 0',background:'var(--surface,#fff)',color:'inherit'
 }}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
   <h3 style={{fontSize:16,margin:0}}>Corte semanal</h3>
   <small style={{opacity:.7}}>Solo lectura</small>
  </div>
  {loading&&<p role="status">Consultando movimientos del servidor…</p>}
  {error&&<p role="alert">No se pudo validar el estado semanal: {error}</p>}
  {data&&<>
   <p style={{fontSize:12,opacity:.78,margin:'8px 0'}}>
    Semana que inicia {data.period_start} · MXN
   </p>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
    <div><small>Devengo registrado</small><strong style={{display:'block',fontSize:19}}>
     {numberMoney(data.recorded_earnings_cents)}</strong></div>
    <div><small>Pendiente de revisión</small><strong style={{display:'block',fontSize:19}}>
     {numberMoney(data.pending_allocation_cents)}</strong></div>
    {kind==='driver'?
     <div><small>Efectivo bajo custodia, NO es salario</small>
      <strong style={{display:'block'}}>{numberMoney(data.cash_in_driver_custody_cents)}</strong></div>:
     <div><small>Efectivo registrado en caja, sin conciliar</small>
      <strong style={{display:'block'}}>{numberMoney(data.cash_in_merchant_custody_unverified_cents)}</strong></div>}
    <div><small>Disponible para retiro confirmado</small>
     <strong style={{display:'block'}}>{numberMoney(data.withdrawable_cents)}</strong></div>
   </div>
   <p style={{fontSize:12,opacity:.7,margin:'12px 0 0'}}>
    Preliminar: solo asignaciones ya registradas. No confirma depósitos bancarios,
    liquidaciones ni facturas fiscales.
   </p>
   {data.items.length>0&&<details style={{marginTop:12}}>
    <summary>Ver {data.items.length} movimiento(s) registrados</summary>
    <div style={{display:'grid',gap:8,marginTop:8}}>
     {data.items.slice(0,12).map(x=><div key={x.order_id} style={{
      display:'flex',justifyContent:'space-between',gap:8,fontSize:13
     }}><span>Pedido #{x.order_id} · {x.payment_method==='cash'?'Efectivo':'Tarjeta'}
      <small style={{display:'block',opacity:.65}}>{x.allocation_state}</small></span>
      <strong>{numberMoney(x.earned_cents)}</strong></div>)}
    </div>
    {data.items.length>12&&<small>Mostrando los 12 más recientes.</small>}
   </details>}
  </>}
 </section>;
}
