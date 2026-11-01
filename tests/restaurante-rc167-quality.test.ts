import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {isOrderSnapshotFresh,orderPaymentConfirmed,merchantPaymentLabel} from '../src/merchant/MerchantWorkspace';
import type {Order} from '../src/lib/types';

const source=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');

describe('RC167 · diseño consistente y seguridad operacional',()=>{
  it('falla cerrado para métodos de pago desconocidos y conserva efectivo permitido',()=>{
    expect(orderPaymentConfirmed({payment_method:'cash',payment_status:'pending'})).toBe(true);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'paid'})).toBe(true);
    expect(orderPaymentConfirmed({payment_method:'stripe',payment_status:'pending'})).toBe(false);
    for(const method of ['', 'wallet', 'mercadopago', 'invalid', null, undefined]){
      expect(orderPaymentConfirmed({payment_method:method as Order['payment_method'],payment_status:'paid'})).toBe(false);
    }
    expect(merchantPaymentLabel('cash')).toBe('Efectivo');
    expect(merchantPaymentLabel('stripe')).toBe('Tarjeta');
    expect(merchantPaymentLabel('other')).toBe('Pago por verificar');
    expect(source).toContain("o.payment_method==='stripe'?'Esperando cobro':'Pago no verificado'");
  });
  it('el reloj real bloquea mutaciones y exportación aunque el reloj visual no avance',()=>{
    const now=Date.UTC(2026,10,1,3,34,0);
    expect(isOrderSnapshotFresh(new Date(now-119_000),now,true,false)).toBe(true);
    expect(isOrderSnapshotFresh(new Date(now-120_001),now,true,false)).toBe(false);
    expect(isOrderSnapshotFresh(new Date(now-119_000),now,false,false)).toBe(false);
    expect(source).toContain('isOrderSnapshotFresh(lastSync,Date.now(),navigator.onLine,Boolean(errors.orders))');
    expect(source).toContain('La cola de pedidos necesita sincronizarse antes de continuar.');
    expect(source).toContain('El servidor no confirmó el nuevo estado. Sincroniza antes de intentar otra vez.');
    expect(source).toContain('updated?.id!==id||updated.status!==status');
  });
  it('mantiene las ediciones locales hasta guardar o deshacer, incluso al tocar otra pestaña',()=>{
    expect(source).toContain('const dirtyMenuRows=useRef(new Set<number>())');
    expect(source).toContain('const addDraftPending=useRef(false)');
    expect(source).toContain("if(section==='menu'&&(dirtyMenuRows.current.size>0||addDraftPending.current))");
    expect(source).toContain('Guarda o deshaz los cambios del menú antes de cambiar de sección.');
    expect(source).toContain('onDirtyChange(item.id,dirty)');
    expect(source).toContain('return()=>onDirtyChange(item.id,false)');
    expect(source).toContain('onDirtyChange={markMenuDirty}');
    expect(source).toContain('if(expanded){setEditing(false);setPrice(String(item.price));setStock(item.stock);setAvailable(item.is_available);}');
    expect(source).toContain("next.delete('order')");
  });
  it('espera a Safari antes de liberar el objeto de exportación CSV',()=>{
    expect(source).toContain("window.setTimeout(()=>URL.revokeObjectURL(url),30_000)");
  });
});
