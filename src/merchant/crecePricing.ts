/** Informative merchant-pricing example. Not a checkout, Stripe estimate,
 * balance, invoice or contract: the backend always decides payable amounts.
 * This deliberately mirrors M1's integer-centavo half-up basis points.
 */
export const CRECE_PRICING=Object.freeze({
 merchantCommissionBps:1700n,
 customerServiceBps:700n,
 tipCommissionBps:0n,
 version:'crece-estimator-v1'
});
export type CrecePricePreview=Readonly<{
 itemSubtotalMinor:bigint;merchantCommissionMinor:bigint;
 merchantBeforeAdjustmentsMinor:bigint;customerServiceMinor:bigint;
 customerBeforeDeliveryMinor:bigint
}>;
export function crecePricePreview(raw:unknown):CrecePricePreview|null{
 if(typeof raw!=='string')return null;
 const input=raw.trim();
 const match=/^(0|[1-9]\d{0,5})(?:\.(\d{1,2}))?$/.exec(input);
 if(!match)return null;
 const minor=BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0')||'00');
 if(minor<=0n)return null;
 const bps=(value:bigint,rate:bigint)=>(value*rate+5000n)/10000n;
 const commission=bps(minor,CRECE_PRICING.merchantCommissionBps);
 const service=bps(minor,CRECE_PRICING.customerServiceBps);
 return Object.freeze({
  itemSubtotalMinor:minor,
  merchantCommissionMinor:commission,
  merchantBeforeAdjustmentsMinor:minor-commission,
  customerServiceMinor:service,
  customerBeforeDeliveryMinor:minor+service
 });
}
export function creceMoney(minor:bigint):string{
 if(minor<0n||minor>100_000_000n)throw Error('CRECE_MONEY_RANGE_INVALID');
 return new Intl.NumberFormat('es-MX',{
  style:'currency',currency:'MXN',minimumFractionDigits:2,
  maximumFractionDigits:2
 }).format(Number(minor)/100);
}
