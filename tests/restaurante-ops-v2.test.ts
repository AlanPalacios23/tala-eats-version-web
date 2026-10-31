import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { elapsedOrderTime } from '../src/merchant/MerchantWorkspace';

const source=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');

describe('Restaurantes RC159 · operación segura y experiencia nativa',()=>{
  it('calcula únicamente el tiempo transcurrido y no inventa una ETA',()=>{
    const now=Date.parse('2026-10-31T22:00:00Z');
    expect(elapsedOrderTime('2026-10-31T22:00:00Z',now)).toBe('Hace menos de 1 min');
    expect(elapsedOrderTime('2026-10-31T21:52:00Z',now)).toBe('Hace 8 min');
    expect(elapsedOrderTime('2026-10-31T20:45:00Z',now)).toBe('Hace 1 h 15 min');
    expect(elapsedOrderTime('2026-10-30T22:00:00Z',now)).toBe('Hace 1 d');
    expect(elapsedOrderTime('invalid-date',now)).toBe('Tiempo no disponible');
    expect(elapsedOrderTime('2026-11-01T00:00:00Z',now)).toBe('Tiempo no disponible');
  });
  it('no apila lecturas automáticas ni permite que resultados antiguos pisen escrituras',()=>{
    expect(source).toContain('if(quiet&&(readInFlight.current||mutationInFlight.current))return;');
    expect(source).toContain('generation!==readGeneration.current');
    expect(source).toContain('readGeneration.current++');
    expect(source).toContain("document.visibilityState==='visible'");
    expect(source).toContain('document.addEventListener(\'visibilitychange\'');
    expect(source).toContain('await refresh(false)');
    expect(source).not.toContain('localStorage');
  });
  it('solo cambia disponibilidad de productos con la ruta actual y muestra stock verificado',()=>{
    expect(source).toContain('async()=>{');
    expect(source).toContain('quickAvailability');
    expect(source).toContain('api.ownerUpdateItem(item.id,{is_available:!item.is_available})');
    expect(source).toContain("item.stock===0?'Sin existencias'");
    expect(source).toContain('Guarda primero los cambios pendientes');
    expect(styles).toContain('.merchant-stock-indicator.low');
  });
  it('permite imprimir la comanda local sin insertar endpoints falsos',()=>{
    expect(source).toContain('window.print()');
    expect(source).toContain('Imprimir comanda');
    expect(styles).toContain('@media print');
    expect(styles).toContain('.merchant-detail-backdrop');
    expect(source).not.toContain('/owner/orders/print');
  });
  it('mantiene el modal accesible en móviles y protege la pantalla ante desconexión',()=>{
    expect(source).toContain("if(e.key==='Escape')");
    expect(source).toContain("if(e.key!=='Tab'");
    expect(source).toContain("document.body.style.overflow='hidden'");
    expect(source).toContain("window.addEventListener('offline'");
    expect(source).toContain('!navigator.onLine');
    expect(styles).toContain('env(safe-area-inset-bottom,0px)');
  });
});
