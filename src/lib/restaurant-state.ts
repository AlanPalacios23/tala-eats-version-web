import type {Order,Restaurant} from './types';
import type {MerchantApplication} from './api';

export type MerchantTab='inicio'|'pedidos'|'cocina'|'menu'|'finanzas'|'activacion'|'mas';
export type MerchantConnectStatus={
 owner_approved:boolean;transfers_active:boolean;
 payouts_enabled:boolean;details_submitted:boolean;ready?:boolean;
};
export function latestRestaurantApplication(items:MerchantApplication[]|null):MerchantApplication|null{
 return (items??[]).filter(a=>a.entity_type==='restaurant')
   .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0]??null;
}
export function merchantConnectSteps(restaurant:Restaurant,connect:MerchantConnectStatus|null){
 return [
  {id:'verified',label:'Negocio verificado',complete:restaurant.verification_status==='verified'},
  {id:'pickup',label:'Recogida activada',complete:restaurant.pickup_enabled===true},
  {id:'mapped',label:'Cuenta Stripe Connect vinculada',complete:connect!==null},
  {id:'consent',label:'Titularidad confirmada por el propietario',complete:connect?.owner_approved===true},
  {id:'details',label:'Identidad y pagos habilitados en Stripe',complete:Boolean(connect?.owner_approved&&
    connect?.details_submitted&&connect?.transfers_active&&connect?.payouts_enabled)},
 ] as const;
}
export function canOwnerPrepare(order:Order){
 return order.payment_method==='cash' ||
   (order.payment_method==='stripe'&&order.payment_status==='paid');
}
export function nextMerchantState(order:Order):'confirmed'|'preparing'|'ready'|null{
 if(!canOwnerPrepare(order))return null;
 if(order.status==='received')return 'confirmed';
 if(order.status==='confirmed')return 'preparing';
 if(order.status==='preparing')return 'ready';
 return null;
}
export function canHandoffPickup(order:Order,pin:string,cashAcknowledged:boolean){
 return order.order_type==='pickup'&&order.status==='ready'&&/^\d{4}$/.test(pin)&&
   (order.payment_method==='cash'?cashAcknowledged&&order.payment_status==='pending':
    order.payment_method==='stripe'&&order.payment_status==='paid');
}
export function merchantStateLabel(status:string){
 const labels:Record<string,string>={
  awaiting_payment:'Esperando pago',received:'Nuevo pedido',confirmed:'Aceptado',
  preparing:'En preparación',ready:'Listo para recoger',delivered:'Entregado',
  cancelled:'Cancelado',rejected:'Rechazada',pending:'En revisión',
  needs_info:'Requiere información',approved:'Aprobada',suspended:'Suspendida',
 };
 return labels[status]??status;
}
