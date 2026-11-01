import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {orderPaymentConfirmed,reconcileMerchantStatus} from '../src/merchant/MerchantWorkspace';
import type {Order} from '../src/lib/types';

const source=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const order=(status:string):Order=>({
  id:71,restaurant_id:4,status,order_type:'delivery',
  payment_method:'stripe',payment_status:'paid',total:'190.00',
  created_at:'2026-10-31T22:00:00Z',items:[{name_snapshot:'Hamburguesa',quantity:1,unit_price:'190.00'}]
});

describe('RC170 · módulo 1: pedidos y reconciliación segura',()=>{
  it('distingue una transición confirmada de un pedido que sigue igual',()=>{
    expect(reconcileMerchantStatus([order('confirmed')],71,'received','confirmed')).toBe('applied');
    expect(reconcileMerchantStatus([order('received')],71,'received','confirmed')).toBe('unchanged');
  });
  it('no atribuye al comercio el estado nuevo de otro operador y no inventa pedidos ausentes',()=>{
    expect(reconcileMerchantStatus([order('preparing')],71,'received','confirmed')).toBe('changed');
    expect(reconcileMerchantStatus([order('delivered')],71,'received','confirmed')).toBe('changed');
    expect(reconcileMerchantStatus([],71,'received','confirmed')).toBe('missing');
    expect(reconcileMerchantStatus([order('confirmed')],72,'received','confirmed')).toBe('missing');
  });
  it('permite efectivo pendiente pero bloquea cobros revertidos o fallidos',()=>{
    expect(orderPaymentConfirmed({payment_method:'cash',payment_status:'pending'})).toBe(true);
    expect(orderPaymentConfirmed({payment_method:'cash',payment_status:'paid'})).toBe(true);
    for(const status of ['failed','cancelled','canceled','refunded']){
      expect(orderPaymentConfirmed({payment_method:'cash',payment_status:status})).toBe(false);
    }
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'pending'})).toBe(false);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'paid'})).toBe(true);
  });
  it('consulta nuevamente por GET tras un PATCH incierto, sin repetirlo automáticamente',()=>{
    expect(source).toContain('const checked=await api.ownerOrders()');
    expect(source).toContain('const outcome=reconcileMerchantStatus(checked,id,current.status,status)');
    expect(source).toContain("if(outcome==='missing')throw");
    expect(source).toContain("if(outcome==='applied')");
    expect(source).toContain("else if(outcome==='unchanged')");
    expect(source).toContain('setLastSync(null)');
    expect(source).toContain('No repitas la acción todavía');
    expect(source).toContain("orders:'No se pudo verificar el resultado de la última acción.'");
    expect(source).not.toContain("api.ownerUpdateStatus(id,status);\n      await api.ownerUpdateStatus");
  });
});
