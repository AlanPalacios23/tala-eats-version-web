import {useState} from 'react';
import {api} from '../lib/api';
import type {Order} from '../lib/types';

const enabled=import.meta.env.VITE_CASH_HANDOFF_V2_ENABLED==='true';
const validId=(v:string)=>/^[1-9][0-9]{0,9}$/.test(v);
const money=(v:string)=>{
 if(!/^\d{1,16}$/.test(v))return '—';
 return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'})
  .format(Number(v)/100);
};

export function DriverCashHandoff({orders}:{orders:Order[]}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState<{order_id:number;amount_cents:string;code:string;valid_for_minutes:number}|null>(null);
 if(!enabled)return null;
 const candidates=orders.filter(o=>o.order_type==='delivery'&&o.payment_method==='cash'&&o.status==='delivered');
 async function initiate(id:number){
  if(busy||receipt)return;
  setBusy(true);setError('');
  try{
   const result=await api.driverCashHandoffStart(id);
   if(result.order_id!==id||result.bank_settlement_verified!==false||
      !/^[0-9a-f]{20}$/.test(result.code)||!/^\d{1,16}$/.test(result.amount_cents))
    throw new Error('No se pudo validar el acuse del servidor.');
   setReceipt(result);
  }catch(e){setError(e instanceof Error?e.message:'No fue posible iniciar el acuse.');}
  finally{setBusy(false);}
 }
 return <section className="df-surface" aria-label="Entrega de efectivo al restaurante" style={{padding:16,margin:'12px 0'}}>
  <h2 style={{fontSize:17,margin:0}}>Entregar efectivo al comercio</h2>
  <p style={{fontSize:13}}>El importe completo se entrega al restaurante. No es tu sueldo ni dinero retirable.
   El dueño confirmará su recepción con un código. No hay depósito bancario automático.</p>
  {receipt?<>
   <p>Pedido #{receipt.order_id} · <strong>{money(receipt.amount_cents)}</strong></p>
   <p><strong>Código de entrega:</strong> <code style={{fontSize:16,overflowWrap:'anywhere'}}>{receipt.code}</code></p>
   <p style={{fontSize:12}}>Muéstralo únicamente al dueño mientras entregas físicamente todo el efectivo.
    Expira en {receipt.valid_for_minutes} minutos. Si se pierde, contacta a soporte; no repitas cobros.</p>
  </>:
   candidates.length?candidates.slice(0,8).map(o=><button
    key={o.id} type="button" disabled={busy}
    style={{display:'block',width:'100%',padding:12,marginTop:8,
      borderRadius:10,border:'1px solid #ddd',textAlign:'left',background:'transparent',color:'inherit'}}
    onClick={()=>void initiate(o.id)}>
    Iniciar acuse de efectivo · Pedido #{o.id}
   </button>):<p style={{fontSize:13}}>No hay entregas en efectivo para procesar.</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}

export function MerchantCashHandoff(){
 const [order,setOrder]=useState('');
 const [amount,setAmount]=useState('');
 const [code,setCode]=useState('');
 const [received,setReceived]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 if(!enabled)return null;
 async function confirm(){
  if(busy||!received||!validId(order)||!/^[0-9a-f]{20}$/.test(code)||
    !/^[1-9][0-9]{0,7}\.\d{2}$/.test(amount))return;
  setBusy(true);setError('');setMessage('');
  try{
   const cents=(BigInt(amount.split('.')[0])*100n+
    BigInt(amount.split('.')[1])).toString();
   const result=await api.ownerCashHandoffConfirm(Number(order),code,cents);
   if(result.order_id!==Number(order)||result.amount_cents!==cents||
      result.bank_settlement_verified!==false||result.driver_pay_executed!==false||
      result.state!=='confirmed_merchant_physical_receipt')
    throw new Error('No se pudo comprobar el acuse del backend.');
   setMessage('Recepción física registrada para el pedido #'+order+
    '. El efectivo sigue sin estar conciliado con el banco.');
   setOrder('');setAmount('');setCode('');setReceived(false);
  }catch(e){setError(e instanceof Error?e.message:'No se confirmó el acuse.');}
  finally{setBusy(false);}
 }
 const canSubmit=validId(order)&&/^[0-9a-f]{20}$/.test(code)&&
  /^[1-9][0-9]{0,7}\.\d{2}$/.test(amount)&&received&&!busy;
 return <section aria-label="Recibir efectivo del repartidor" style={{
  border:'1px solid #ddd',borderRadius:16,padding:16,margin:'12px 0'
 }}>
  <h3 style={{marginTop:0,fontSize:16}}>Recibir efectivo de reparto</h3>
  <p style={{fontSize:13}}>Confirma solo el dinero que realmente hayas contado y recibido del repartidor.
   No autoriza retiros ni certifica depósitos bancarios.</p>
  <div style={{display:'grid',gap:10}}>
   <label>Pedido
    <input value={order} inputMode="numeric" onChange={e=>setOrder(e.target.value)}
     placeholder="Número de pedido" style={{width:'100%',padding:11,borderRadius:8}}/>
   </label>
   <label>Importe íntegro recibido (MXN)
    <input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}
     placeholder="253.00" style={{width:'100%',padding:11,borderRadius:8}}/>
   </label>
   <label>Código que presenta el repartidor
    <input value={code} onChange={e=>setCode(e.target.value.toLowerCase())}
     placeholder="20 caracteres" autoComplete="off" style={{width:'100%',padding:11,borderRadius:8}}/>
   </label>
   <label style={{display:'flex',alignItems:'start',gap:8,fontSize:13}}>
    <input type="checkbox" checked={received} onChange={e=>setReceived(e.target.checked)}/>
    Confirmo que recibí físicamente el importe completo del pedido y que coincide con el efectivo contado.
   </label>
   <button type="button" disabled={!canSubmit} onClick={()=>void confirm()}
    style={{padding:12,borderRadius:10}}>Confirmar recepción física</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
