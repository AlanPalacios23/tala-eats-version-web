import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {exportOrderSummaryCsv,isOrderSnapshotFresh} from '../src/merchant/MerchantWorkspace';
import type {Order} from '../src/lib/types';

const source=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');
const now=Date.UTC(2026,9,31,23,59);

describe('RC163 · centro de operaciones seguro y reportes privados',()=>{
  it('rechaza snapshots de pedidos caducados, fallidos o sin conexión',()=>{
    expect(isOrderSnapshotFresh(null,now,true,false)).toBe(false);
    expect(isOrderSnapshotFresh(new Date(now),now,true,false)).toBe(true);
    expect(isOrderSnapshotFresh(new Date(now-119999),now,true,false)).toBe(true);
    expect(isOrderSnapshotFresh(new Date(now-120000),now,true,false)).toBe(false);
    expect(isOrderSnapshotFresh(new Date(now-1000),now,false,false)).toBe(false);
    expect(isOrderSnapshotFresh(new Date(now-1000),now,true,true)).toBe(false);
    expect(isOrderSnapshotFresh(new Date(now+1000),now,true,false)).toBe(false);
    expect(isOrderSnapshotFresh(new Date('invalid'),now,true,false)).toBe(false);
  });
  it('genera CSV limitado a la vista sin PIN ni dirección y mitiga fórmulas',()=>{
    const sample:Order={
      id:42,restaurant_id:1,status:'received',order_type:'delivery',
      payment_method:'stripe',payment_status:'paid',total:'=HYPERLINK("bad")',
      created_at:'2026-10-31T12:00:00Z',
      address:'DATO_PERSONAL_PRIVADO',delivery_pin:'PIN_SECRETO',
      items:[{name_snapshot:'Producto, reserva',quantity:2,unit_price:'80.00'}]
    };
    const csv=exportOrderSummaryCsv([sample]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Pedido","Fecha","Estado"');
    expect(csv).toContain('"42"');
    expect(csv).toContain('"2"');
    expect(csv).toContain('\'=HYPERLINK');
    expect(csv).not.toContain('DATO_PERSONAL_PRIVADO');
    expect(csv).not.toContain('PIN_SECRETO');
    expect(csv).not.toContain('Producto, reserva');
    expect(exportOrderSummaryCsv([]).split('\r\n').length).toBe(2);
  });
  it('protege acciones de pedidos si la lectura reciente no está confirmada',()=>{
    expect(source).toContain('const ordersFresh=isOrderSnapshotFresh(lastSync,clock,online,Boolean(errors.orders))');
    expect(source).toContain('if(mutationInFlight.current||menuMutationInFlight.current)return;');
    expect(source).toContain('isOrderSnapshotFresh(lastSync,Date.now(),navigator.onLine,Boolean(errors.orders))');
    expect(source).toContain('!ordersFresh||menuMutating||awaitingStripePayment');
    expect(source).toContain('merchant-sync-warning');
    expect(source).toContain('Sincronizar');
    expect(source).toContain("window.addEventListener('online',onReconnect)");
    expect(source).toContain("window.removeEventListener('online',onReconnect)");
  });
  it('coordina escrituras de catálogo antes de aceptar otra mutación',()=>{
    expect(source).toContain('menuMutationInFlight.current=true;setMenuMutating(true)');
    expect(source).toContain('menuMutationInFlight.current=false;setMenuMutating(false)');
    expect(source).toContain('onWriteStart:()=>boolean;onWriteEnd:()=>void;locked:boolean');
    expect(source).toContain('locked||!online||!onWriteStart()');
    expect(source).toContain('const updated=await api.ownerUpdateItem');
    expect(source).toContain('onSaved(updated)');
    expect(source).toContain('setRestaurant(prev=>prev?.menu_items?');
    expect(source).toContain("readGeneration.current++;readInFlight.current=false");
  });
  it('expone exportación acotada y aviso de comercio cerrado sin modificar backend',()=>{
    expect(source).toContain("link.download='tala-eats-pedidos-vista-'");
    expect(source).toContain('onClick={downloadOrders}');
    expect(source).toContain('disabled={!ordersFresh||!filteredOrders.length}');
    expect(source).toContain('merchant-closed-prompt');
    expect(source).toContain("onClick={()=>setSection('negocio')}");
    expect(css).toContain('.merchant-sync-pill.fresh');
    expect(css).toContain('.merchant-csv-button');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
});
