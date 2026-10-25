import type { PaymentOptions } from './types';
import { amountInCents } from './mobile-parity';
export interface PricingPolicy {
 version:'1.5.2'|'1.6.2';rate:number;baseDeliveryCents:number;
 capCents:number|null;includedKm:number|null;perKmCents:number|null;
}
function decimals(v:unknown):number|null{
 if((typeof v!=='string'&&typeof v!=='number')||String(v).trim()==='')return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}
function toCents(v:number):number{return Math.round((v+Number.EPSILON)*100);}
export function extractServerPricing(methods:PaymentOptions|null|undefined):PricingPolicy|null{
 if(!methods)return null;
 const version=methods.commercial_pricing_version;
 if(version!=='1.5.2'&&version!=='1.6.2')return null;
 const rate=decimals(methods.service_fee_rate),base=decimals(methods.delivery_base_fee);
 if(rate===null||rate<0||rate>.25||base===null||base<0||base>10000)return null;
 let capCents:number|null=null,includedKm:number|null=null,perKmCents:number|null=null;
 if(version==='1.6.2'){
  const cap=decimals(methods.service_fee_cap),km=decimals(methods.delivery_included_km),extra=decimals(methods.delivery_additional_per_km);
  if(cap===null||cap<0||cap>10000||km===null||km<0||km>100||extra===null||extra<0||extra>1000)return null;
  capCents=toCents(cap);includedKm=km;perKmCents=toCents(extra);
 }
 return {version,rate,baseDeliveryCents:toCents(base),capCents,includedKm,perKmCents};
}
export interface ReferenceBreakdown {
 subtotal:number; serviceFee:number|null; deliveryBase:number|null;
 tip:number; total:number|null; rateLabel:string; note:string;
}
export function referenceBreakdown(subtotalValue:number,options:PaymentOptions|null|undefined,delivery:boolean,tipValue:string,hasCoupon:boolean,plus=false):ReferenceBreakdown {
 const subtotalCents=amountInCents(subtotalValue);
 const policy=extractServerPricing(options);
 const tipCents=delivery?amountInCents(tipValue):0;
 if(subtotalCents===null||subtotalCents<0||tipCents===null||tipCents<0||tipCents>1000000)
  throw new Error('Importes de referencia inválidos');
 const serviceCents=policy===null?null:Math.min(policy.capCents??Number.MAX_SAFE_INTEGER,Math.round(subtotalCents*policy.rate));
 const shippingCents=!delivery?0:policy?.baseDeliveryCents??null;
 const totalCents=serviceCents===null||shippingCents===null?null:
  subtotalCents+serviceCents+shippingCents+tipCents;
 return {subtotal:subtotalCents/100,serviceFee:serviceCents===null?null:serviceCents/100,
  deliveryBase:shippingCents===null?null:shippingCents/100,tip:tipCents/100,
  total:totalCents===null?null:totalCents/100,rateLabel:policy?'Tarifa de servicio ('+(policy.rate*100).toLocaleString('es-MX',{maximumFractionDigits:1})+'%)':'Tarifa de servicio',
  note:!policy?'Sin política de precios verificada por el servidor; no se estiman tarifas.':
   hasCoupon||plus?'Referencia antes de cupones y beneficios Plus; el servidor confirma el descuento y total.':
   delivery?'Importe de referencia con el envío BASE; puede aumentar por distancia GPS. No es cotización definitiva.':
   'Referencia preliminar; el servidor recalcula los importes antes de registrar el pedido.'};
}
