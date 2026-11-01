import {useCallback,useEffect,useRef,useState} from 'react';
import {AlertCircle,ArrowDownToLine,ArrowUpRight,Banknote,CheckCircle2,Clock3,LockKeyhole,RefreshCw,ShieldCheck,Wallet} from 'lucide-react';
import {api,ApiError} from '../lib/api';
import {
  formatVerifiedCents,formatVerifiedMxn,parseConnectSummary,
  parseRestaurantFinance,parseWithdrawalBalance,parseWithdrawalHistory
} from './financeContracts';
import type {ConnectSummary,RestaurantFinance,WithdrawalBalance,WithdrawalHistory} from './financeContracts';

type LoadState = {finance:RestaurantFinance|null;balance:WithdrawalBalance|null;history:WithdrawalHistory[]|null;connect:ConnectSummary|null};
const EMPTY:LoadState={finance:null,balance:null,history:null,connect:null};
const moneyState=(err:unknown):string => {
  if(err instanceof ApiError){
    if(err.status===404||err.status===405)return 'Este endpoint aún no está disponible en el backend conectado.';
    if(err.status===503)return 'Función financiera desactivada o proveedor temporalmente no disponible.';
    if(err.status===401||err.status===403)return 'Tu cuenta no tiene una sesión o permisos válidos para esta consulta.';
    if(err.status===409)return 'La conciliación o verificación del comercio requiere revisión.';
    return 'No se pudo verificar la información financiera con el servidor.';
  }
  return 'No fue posible conectar con el servidor financiero.';
};
const payoutLabels:Record<string,string>={
  reserved:'Reservado',submitted:'Enviado al proveedor',paid:'Pagado (confirmado)',unknown:'Estado por conciliar',
  review_required:'Revisión necesaria',failed:'Fallido',canceled:'Cancelado',pending:'Pendiente',
  completed:'Completado',in_transit:'En tránsito'
};
function financialDate(raw:string|undefined):string{
  if(!raw)return 'Sin fecha';
  const date=new Date(raw);return Number.isNaN(date.getTime())?'Fecha por verificar':
    new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(date);
}
function Value({title,value,caption}:{title:string;value:string;caption:string}){
  return <div className="merchant-wallet-stat"><span>{title}</span><strong>{value}</strong><small>{caption}</small></div>;
}
export default function MerchantWallet({restaurantId}:{restaurantId:number|null}){
  const [data,setData]=useState<LoadState>(EMPTY);
  const [errors,setErrors]=useState<Partial<Record<keyof LoadState,string>>>({});
  const [loading,setLoading]=useState(true);
  const [updating,setUpdating]=useState(false);
  const [updatedAt,setUpdatedAt]=useState<Date|null>(null);
  const generation=useRef(0);
  const refresh=useCallback(async(silent=false)=>{
    if(restaurantId===null){setData(EMPTY);setErrors({finance:'Primero debes tener un restaurante asociado.'});setLoading(false);return;}
    const version=++generation.current;
    if(!silent)setUpdating(true);
    const [finance,balance,history,connect]=await Promise.allSettled([
      api.ownerFinance(),
      api.merchantWithdrawalBalance(restaurantId),
      api.merchantWithdrawalHistory(restaurantId),
      api.merchantConnectStatus(restaurantId)
    ]);
    if(version!==generation.current)return;
    const next:LoadState={
      finance:finance.status==='fulfilled'?parseRestaurantFinance(finance.value,restaurantId):null,
      balance:balance.status==='fulfilled'?parseWithdrawalBalance(balance.value):null,
      history:history.status==='fulfilled'?parseWithdrawalHistory(history.value):null,
      connect:connect.status==='fulfilled'?parseConnectSummary(connect.value):null
    };
    const reasons:Partial<Record<keyof LoadState,string>>={};
    for(const [key,result] of Object.entries({finance,balance,history,connect}) as [keyof LoadState,PromiseSettledResult<unknown>][]) {
      if(result.status==='rejected')reasons[key]=moneyState(result.reason);
      else if(next[key]===null)reasons[key]='El servidor devolvió datos financieros incompletos o incompatibles. No se muestra un saldo estimado.';
    }
    setErrors(reasons);setData(next);setUpdatedAt(new Date());setLoading(false);setUpdating(false);
  },[restaurantId]);
  useEffect(()=>{void refresh(true);return()=>{generation.current++};},[refresh]);

  return <div className="merchant-wallet" aria-label="Wallet de restaurante">
    <div className="merchant-page-heading merchant-wallet-heading"><div>
      <span className="merchant-kicker">FINANZAS DEL COMERCIO</span>
      <h1>Wallet y liquidaciones</h1>
      <p>Información contable y bancaria por separado. Solo se muestran importes confirmados por el servidor.</p>
    </div><button type="button" className="merchant-wallet-refresh" disabled={updating||loading||restaurantId===null} onClick={()=>void refresh()}><RefreshCw size={17} className={updating?'merchant-spin':''}/> Actualizar saldos</button></div>

    <div className="merchant-wallet-notice"><ShieldCheck size={20}/><div><strong>Protección financiera activa</strong>
      <span>Este panel es de consulta. No solicita retiros ni mueve dinero automáticamente. Las ventas no representan fondos bancarios retirables.</span></div></div>

    {loading?<div className="merchant-wallet-skeleton" role="status"><RefreshCw className="merchant-spin" size={19}/> Verificando datos financieros del comercio…</div>:<>
      <section className="merchant-wallet-hero" aria-label="Disponibilidad de fondos">
        <div className="merchant-wallet-hero-top"><span><Wallet size={20}/> Fondos conciliados en Stripe</span><span className={'merchant-wallet-status '+(data.balance?.server_allows_requests&&!data.balance.reconciling&&data.balance.bank.status==='verified'?'verified':'unavailable')}>{data.balance?.server_allows_requests&&!data.balance.reconciling&&data.balance.bank.status==='verified'?<><CheckCircle2 size={14}/> Backend autoriza retiros</>:<><AlertCircle size={14}/> Retiros no autorizados</>}</span></div>
        <strong className="merchant-wallet-main-amount">{data.balance?formatVerifiedCents(data.balance.withdrawable_cents):'—'}</strong>
        <p>{data.balance?'Máximo importe calculado por la API financiera de Stripe. No equivale a una transferencia autorizada ni a dinero ya depositado; consulta más abajo las restricciones.':'No se pueden confirmar fondos de Stripe; nunca se calculan a partir de ventas, pedidos o comisiones.'}</p>
        {data.balance&&<div className="merchant-wallet-balance-meta">
          <span>Elegible: <strong>{formatVerifiedCents(data.balance.eligible_cents)}</strong></span>
          <span>Reservado o solicitado: <strong>{formatVerifiedCents(data.balance.already_requested_cents)}</strong></span>
          <span>Disponible en proveedor: <strong>{formatVerifiedCents(data.balance.provider_available_cents)}</strong></span>
        </div>}
        <div className="merchant-wallet-hero-foot"><span><Clock3 size={15}/> {updatedAt?'Última consulta '+new Intl.DateTimeFormat('es-MX',{timeStyle:'short'}).format(updatedAt):'Sin actualización'}</span><span>{data.balance?.hold_days!==undefined?'Retención mínima: '+data.balance.hold_days+' días':'Sin plazo verificado'}</span></div>
      </section>

      {errors.balance&&<div className="merchant-wallet-inline-warning" role="status"><AlertCircle size={17}/><span><strong>Saldo disponible:</strong> {errors.balance}</span></div>}

      <div className="merchant-wallet-section-heading"><div><h2>Resumen contable</h2><p>Montos históricos del comercio; no son el saldo de Stripe ni dinero para retirar.</p></div></div>
      <div className="merchant-wallet-stats">
        <Value title="Venta de alimentos registrada" value={formatVerifiedMxn(data.finance?.gross_food_sales)} caption="Total histórico reportado"/>
        <Value title="Comisiones registradas" value={formatVerifiedMxn(data.finance?.commission)} caption="Dato contable del servidor"/>
        <Value title="Neto contable registrado" value={formatVerifiedMxn(data.finance?.net_payable)} caption="No equivale a saldo bancario"/>
      </div>
      {errors.finance&&<div className="merchant-wallet-inline-warning" role="status"><AlertCircle size={17}/><span><strong>Contabilidad:</strong> {errors.finance}</span></div>}

      <div className="merchant-wallet-two-col">
        <section className="merchant-wallet-panel"><div className="merchant-wallet-panel-heading"><span className="merchant-wallet-panel-icon"><Banknote size={19}/></span><div><h2>Cuenta bancaria</h2><p>Estado de Stripe Connect</p></div></div>
          <div className="merchant-wallet-detail-row"><span>Cuenta Connect</span><strong>{data.connect?data.connect.status==='verified'?'Verificada':data.connect.status==='not_linked'?'Sin vincular':'En verificación':'No verificada'}</strong></div>
          <div className="merchant-wallet-detail-row"><span>Banco</span><strong>{data.balance?.bank.status==='verified'?data.balance.bank.bank_name||'Verificado':data.balance?.bank.status==='restricted'?'Restringido':data.connect?.bank.status==='verified'?'Vinculado':'No confirmado'}</strong></div>
          {data.balance?.bank.last4&&<div className="merchant-wallet-detail-row"><span>Terminación</span><strong>•••• {data.balance.bank.last4}</strong></div>}
          <div className="merchant-wallet-detail-row"><span>Conciliación pendiente</span><strong>{data.balance?.reconciling?'Sí':data.balance?'No':'Sin confirmar'}</strong></div>
          <p className="merchant-wallet-panel-foot">La vinculación bancaria se gestiona mediante Stripe Connect. Nunca ingreses tu CLABE ni tus códigos de seguridad en esta pantalla.</p>
        </section>
        <section className="merchant-wallet-panel"><div className="merchant-wallet-panel-heading"><span className="merchant-wallet-panel-icon"><LockKeyhole size={19}/></span><div><h2>Retiros</h2><p>Protección por conciliación y autorización</p></div></div>
          <div className="merchant-wallet-detail-row"><span>Permiso del backend</span><strong>{data.balance?.server_allows_requests?'Confirmado por servidor':data.balance?'No autorizado':'No verificado'}</strong></div>
          <div className="merchant-wallet-detail-row"><span>Mínimo por solicitud</span><strong>{data.balance?.limits?formatVerifiedCents(data.balance.limits.minimum_cents):'No disponible'}</strong></div>
          <div className="merchant-wallet-detail-row"><span>Restante diario</span><strong>{data.balance?.limits?formatVerifiedCents(data.balance.limits.daily_remaining_cents):'No disponible'}</strong></div>
          <div className="merchant-wallet-withdraw-disabled"><LockKeyhole size={16}/> Solicitudes de retiro desactivadas en esta PWA hasta verificar backend Node, Stripe TEST y conciliación.</div>
          {errors.connect&&<p className="merchant-wallet-error-inline">{errors.connect}</p>}
        </section>
      </div>

      <div className="merchant-wallet-section-heading"><div><h2>Historial de retiros</h2><p>Solicitudes registradas por la API bancaria, no ventas del restaurante.</p></div><ArrowDownToLine size={20}/></div>
      {data.history?.length?<div className="merchant-wallet-history">{data.history.map(item=><div className="merchant-wallet-history-row" key={item.id}><span className="merchant-wallet-history-icon"><ArrowUpRight size={17}/></span><div><strong>Retiro #{item.id}</strong><small>{financialDate(item.created_at)}</small></div><div className="merchant-wallet-history-right"><strong>{formatVerifiedCents(item.amount_cents)}</strong><small>{payoutLabels[item.status]||'Estado por confirmar'}</small></div></div>)}</div>:
        <div className="merchant-wallet-empty">{data.history?'No hay solicitudes de retiro registradas.':'No fue posible verificar el historial de retiros.'}</div>}
      {errors.history&&<p className="merchant-wallet-error-inline">{errors.history}</p>}

      {data.finance?.payouts.length?<>
        <div className="merchant-wallet-section-heading"><div><h2>Registros contables anteriores</h2><p>Estos registros no prueban por sí solos un pago bancario.</p></div></div>
        <div className="merchant-wallet-history">{data.finance.payouts.map(item=><div className="merchant-wallet-history-row" key={item.id}><span className="merchant-wallet-history-icon"><Banknote size={17}/></span><div><strong>Registro #{item.id}</strong><small>{financialDate(item.period_end||item.period_start)}</small></div><div className="merchant-wallet-history-right"><strong>{formatVerifiedMxn(item.amount)}</strong><small>{payoutLabels[item.status]||'Estado contable: '+item.status}</small></div></div>)}</div>
      </>:null}
    </>}
  </div>;
}
