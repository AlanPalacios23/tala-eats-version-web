/** Finanzas del RESTAURANTE: datos de servidor, nunca un wallet de cliente.
 * Si el contrato falta o es inconsistente, no dibujar cantidades monetarias. */
export type FinancialPayout = {id:number; amount:string;status:string;period_start?:string;period_end?:string};
export type RestaurantFinance = {
  restaurant_id:number; gross_food_sales:string|null; commission:string|null;
  net_payable:string|null; orders:number|null; commercial_plan:string|null;
  payouts:FinancialPayout[];
};
export type WithdrawalBalance = {
  currency:'MXN';eligible_cents:number;already_requested_cents:number;
  provider_available_cents:number;withdrawable_cents:number;hold_days:number;
  source:'delivered_paid_stripe_connect_transfers_only';
  bank:{status:string;bank_name?:string;last4?:string};
  reconciling:boolean; server_allows_requests:boolean;
  limits?:{minimum_cents:number;per_request_cents:number;daily_remaining_cents:number};
};
export type WithdrawalHistory = {id:number;amount_cents:number;currency:'MXN';status:string;created_at:string};
export type ConnectSummary = {status:string;bank:{status:string};can_withdraw:boolean;notice?:string};
const record=(value:unknown):Record<string,unknown>|null =>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const nonnegativeInt=(value:unknown):number|null =>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const positiveInt=(value:unknown):number|null => {
  const n=nonnegativeInt(value);return n!==null&&n>0?n:null;
};
export const verifiedMxn=(value:unknown):string|null => {
  if(typeof value!=='string'||!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value))return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?value:null;
};
export const verifiedCents=(value:unknown):number|null=>nonnegativeInt(value);
export function parseRestaurantFinance(raw:unknown,restaurantId:number):RestaurantFinance|null{
  const r=record(raw);
  if(!r||r.restaurant_id!==restaurantId)return null;
  if(r.payouts!==undefined&&!Array.isArray(r.payouts))return null;
  const source=Array.isArray(r.payouts)?r.payouts:[];
  const payouts:FinancialPayout[]=source.flatMap(item=>{
    const v=record(item);
    if(!v)return [];
    const id=positiveInt(v.id),amount=verifiedMxn(v.amount);
    if(id===null||amount===null||typeof v.status!=='string')return [];
    return [{id,amount,status:v.status,period_start:typeof v.period_start==='string'?v.period_start:undefined,period_end:typeof v.period_end==='string'?v.period_end:undefined}];
  });
  // Un registro malformado invalida la colección; no se ocultan pagos anteriores.
  if(source.length!==payouts.length)return null;
  return {
    restaurant_id:restaurantId,
    gross_food_sales:verifiedMxn(r.gross_food_sales),
    commission:verifiedMxn(r.commission),
    net_payable:verifiedMxn(r.net_payable),
    orders:nonnegativeInt(r.orders),
    commercial_plan:typeof r.commercial_plan==='string'?r.commercial_plan:null,
    payouts
  };
}
export function parseWithdrawalBalance(raw:unknown):WithdrawalBalance|null{
  const r=record(raw);
  if(!r||r.currency!=='MXN'||r.source!=='delivered_paid_stripe_connect_transfers_only')return null;
  const eligible=nonnegativeInt(r.eligible_cents),reserved=nonnegativeInt(r.already_requested_cents);
  const provider=nonnegativeInt(r.provider_available_cents),withdrawable=nonnegativeInt(r.withdrawable_cents);
  const days=nonnegativeInt(r.hold_days),bank=record(r.bank),limits=record(r.limits);
  if(eligible===null||reserved===null||provider===null||withdrawable===null||days===null||
      !bank||typeof bank.status!=='string'||typeof r.server_allows_requests!=='boolean'||
      typeof r.reconciling!=='boolean'||withdrawable>eligible||withdrawable>provider||reserved>eligible||
      withdrawable>eligible-reserved)return null;
  const min=limits?nonnegativeInt(limits.minimum_cents):null;
  const max=limits?nonnegativeInt(limits.per_request_cents):null;
  const daily=limits?nonnegativeInt(limits.daily_remaining_cents):null;
  // Si el backend afirma permiso, la propia respuesta debe ser coherente.
  if(r.server_allows_requests&&(
    r.reconciling||bank.status!=='verified'||withdrawable<100||
    min===null||max===null||daily===null||daily<min
  ))return null;
  return {
    currency:'MXN',eligible_cents:eligible,already_requested_cents:reserved,
    provider_available_cents:provider,withdrawable_cents:withdrawable,hold_days:days,
    source:'delivered_paid_stripe_connect_transfers_only',
    bank:{
      status:bank.status,
      bank_name:typeof bank.bank_name==='string'?bank.bank_name.slice(0,60):undefined,
      last4:typeof bank.last4==='string'&&/^\d{4}$/.test(bank.last4)?bank.last4:undefined
    },
    reconciling:r.reconciling,server_allows_requests:r.server_allows_requests,
    limits:min!==null&&max!==null&&daily!==null?{minimum_cents:min,per_request_cents:max,daily_remaining_cents:daily}:undefined
  };
}
export function parseWithdrawalHistory(raw:unknown):WithdrawalHistory[]|null{
  if(!Array.isArray(raw))return null;
  const rows:WithdrawalHistory[]=[];
  const ids=new Set<number>();
  for(const item of raw.slice(0,50)){
    const r=record(item);
    if(!r||r.currency!=='MXN'||typeof r.status!=='string'||typeof r.created_at!=='string')return null;
    const id=positiveInt(r.id),amount=positiveInt(r.amount_cents);
    if(id===null||amount===null||ids.has(id)||!Number.isFinite(new Date(r.created_at).getTime()))return null;
    ids.add(id);
    rows.push({id,amount_cents:amount,currency:'MXN',status:r.status,created_at:r.created_at});
  }
  return rows;
}
export function parseConnectSummary(raw:unknown):ConnectSummary|null{
  const r=record(raw);if(!r||typeof r.status!=='string')return null;
  const bank=record(r.bank);
  if(!bank||typeof bank.status!=='string'||typeof r.can_withdraw!=='boolean')return null;
  return {status:r.status,bank:{status:bank.status},can_withdraw:r.can_withdraw,
    notice:typeof r.notice==='string'?r.notice.slice(0,300):undefined};
}
export function formatVerifiedMxn(value:string|null|undefined):string {
  if(verifiedMxn(value)===null)return 'No disponible';
  return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value));
}
export function formatVerifiedCents(value:number|null|undefined):string {
  if(verifiedCents(value)===null)return 'No disponible';
  return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value!/100);
}
