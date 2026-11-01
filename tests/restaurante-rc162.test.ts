import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {orderPaymentConfirmed} from '../src/merchant/MerchantWorkspace';

const workspace=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const wallet=readFileSync(new URL('../src/merchant/MerchantWallet.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');
const financeApi=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');

describe('RC162 · operaciones con datos verdaderos, sin sobrescribir borradores',()=>{
  it('bloquea todos los pedidos Stripe sin pago confirmado y no bloquea efectivo',()=>{
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'paid'})).toBe(true);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'pending'})).toBe(false);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'failed'})).toBe(false);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:''})).toBe(false);
    expect(orderPaymentConfirmed({payment_method:'cash',payment_status:'pending'})).toBe(true);
  });
  it('valida tanto la tarjeta como la hoja de pedido antes de activar mutaciones',()=>{
    expect(workspace).toContain("const awaitingStripePayment=!orderPaymentConfirmed(o)");
    expect(workspace).toContain('awaitingStripePayment?\'Esperando cobro\':label');
    expect(workspace).toContain("if(!orderPaymentConfirmed(current))");
    expect(workspace).toContain("if(current.status!==expected[status])");
    expect(workspace).toContain("!orderPaymentConfirmed(selectedOrder)");
    expect(workspace).toContain("const updated=await api.ownerUpdateStatus(id,status)");
    expect(workspace).toContain('setOrders(prev=>prev.map');
    expect(workspace).toContain('noticeError?\'alert\':\'status\'');
  });
  it('mantiene los cambios del menú en curso ante GET periódicos y permite descartarlos',()=>{
    expect(workspace).toContain('if(editing||saving||rowWriteLock.current)return');
    expect(workspace).toContain('setEditing(true)');
    expect(workspace).toContain('const undo=()=>');
    expect(workspace).toContain('Cambios descartados');
    expect(workspace).toContain('onClick={undo}>Deshacer');
    expect(workspace).toContain('await api.ownerUpdateItem(item.id,{price,stock,is_available:available})');
    expect(css).toContain('.merchant-discard-button');
  });
  it('descarta instantáneamente saldos previos mientras refresca el wallet',()=>{
    expect(wallet).toContain('const version=++generation.current');
    expect(wallet).toContain('setData(EMPTY)');
    expect(wallet).toContain('setErrors({})');
    expect(wallet).toContain('setUpdatedAt(null)');
    expect(wallet).toContain('setLoading(true)');
    expect(wallet).toContain('if(version!==generation.current)return');
    expect(wallet).toContain('setLoading(false);setUpdating(false)');
    expect(wallet).toContain('generation.current++');
    expect(workspace).toContain("<MerchantWallet key={restaurant?.id??'no-restaurant'}");
    expect(wallet).not.toContain('merchantRequestWithdrawal(');
    expect(financeApi).not.toContain('merchantRequestWithdrawal:');
  });
  it('ofrece una navegación táctil clara y reduce movimiento por accesibilidad',()=>{
    for(const label of ["mobileLabel:'Pedidos'","mobileLabel:'Menú'","mobileLabel:'Datos'","mobileLabel:'Wallet'","mobileLabel:'Negocio'"])expect(workspace).toContain(label);
    expect(workspace).toContain('<span>{n.mobileLabel}</span>');
    expect(css).toContain('.merchant-mobile-nav');
    expect(css).toContain('backdrop-filter');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
