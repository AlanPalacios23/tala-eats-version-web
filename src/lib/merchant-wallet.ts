/** RESTAURANTES WALLET | Node LIVE currently reports EARNINGS ONLY.
 * Never re-label held allocations or net_payable as cash available to withdraw.
 * Transfers and bank payouts require a separate explicit server authorization.
 */
export type MerchantEarningState={state:string;total_minor:string;orders:string};
export type MerchantEarnings={
 restaurant_id:number;currency:'MXN';unit:'centavos';
 earnings_by_status:MerchantEarningState[];
 physical_cash_due_to_platform:Array<{status:string;due_minor:string;orders:string}>;
 transfer_not_executed:true;
};
export function safeMinor(raw:unknown):number|null{
 if(typeof raw!=='string'||!/^(?:0|[1-9]\d{0,12})$/.test(raw))return null;
 const n=Number(raw);return Number.isSafeInteger(n)?n:null;
}
export function merchantEarningTotals(snapshot:MerchantEarnings|null){
 if(!snapshot||snapshot.currency!=='MXN'||snapshot.unit!=='centavos'||
  snapshot.transfer_not_executed!==true||!Array.isArray(snapshot.earnings_by_status))
  return null;
 const rows=snapshot.earnings_by_status;
 if(rows.some(row=>safeMinor(row.total_minor)===null||!row.state||safeMinor(row.orders)===null))
  return null;
 const all=rows.reduce((sum,row)=>sum+(safeMinor(row.total_minor)??0),0);
 if(!Number.isSafeInteger(all))return null;
 return {registeredMinor:all,rows:rows.map(row=>({
  state:row.state,amountMinor:safeMinor(row.total_minor)!,orders:safeMinor(row.orders)!
 }))};
}
export function merchantWithdrawalEnabled(_snapshot:MerchantEarnings|null):false{
 // There is NO POST merchant withdrawal endpoint in deployed Node LIVE.
 // Never authorize a money transfer based on Connect flags or sales totals.
 return false;
}
