import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { filterMerchantMenu, historicalDeliveryRate, kitchenStepIndex } from '../src/merchant/MerchantWorkspace';
import type { MenuItem } from '../src/lib/types';

const source = readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const css = readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');

const base={restaurant_id:1,description:'',price:'85.00',image_url:null};
const items: MenuItem[]=[
  {...base,id:11,name:'Torta de res',category:'Comida',is_available:true,stock:12},
  {...base,id:12,name:'Tacos pastor',category:'Comida',is_available:true,stock:3},
  {...base,id:13,name:'Agua fresca',category:'Bebidas',is_available:false,stock:9},
  {...base,id:14,name:'Refresco',category:'Bebidas',is_available:true,stock:0}
];

describe('PWA Restaurante RC160 · interfaz operativa refinada',()=>{
  it('filtra catálogo por estado, texto y categoría sin consultas nuevas',()=>{
    expect(filterMerchantMenu(items,'','todos','')).toHaveLength(4);
    expect(filterMerchantMenu(items,'','disponibles','').map(x=>x.id)).toEqual([11,12]);
    expect(filterMerchantMenu(items,'','bajo','').map(x=>x.id)).toEqual([12,14]);
    expect(filterMerchantMenu(items,'','agotados','').map(x=>x.id)).toEqual([14]);
    expect(filterMerchantMenu(items,'','pausados','').map(x=>x.id)).toEqual([13]);
    expect(filterMerchantMenu(items,'tACo','todos','Comida').map(x=>x.id)).toEqual([12]);
    expect(filterMerchantMenu(items,'','todos','Bebidas').map(x=>x.id)).toEqual([13,14]);
  });
  it('calcula el rendimiento usando exclusivamente agregados históricos',()=>{
    expect(historicalDeliveryRate(100,83)).toBe(83);
    expect(historicalDeliveryRate(3,2)).toBe(67);
    expect(historicalDeliveryRate(0,0)).toBeNull();
    expect(historicalDeliveryRate(10,-1)).toBeNull();
    expect(historicalDeliveryRate(Number.NaN,0)).toBeNull();
    expect(historicalDeliveryRate(5,8)).toBe(100);
  });
  it('muestra la etapa de cocina real y no afirma que un pedido cancelado se completó',()=>{
    expect(kitchenStepIndex('received')).toBe(0);
    expect(kitchenStepIndex('confirmed')).toBe(1);
    expect(kitchenStepIndex('preparing')).toBe(2);
    expect(kitchenStepIndex('ready')).toBe(3);
    expect(kitchenStepIndex('assigned')).toBe(3);
    expect(kitchenStepIndex('delivered')).toBe(3);
    expect(kitchenStepIndex('cancelled')).toBe(-1);
    expect(kitchenStepIndex('awaiting_payment')).toBe(-1);
  });
  it('avisa solo de pedidos nuevos tras la primera carga y sin reproducir sonidos automáticamente',()=>{
    expect(source).toContain('knownReceivedIds.current===null');
    expect(source).toContain("order.status==='received'");
    expect(source).toContain('arriving.length');
    expect(source).toContain('merchant-arrival');
    expect(source).toContain("setFreshOrderIds([])");
    expect(source).not.toContain('new Audio(');
    expect(source).not.toContain('Notification.requestPermission');
  });
  it('combina skeleton, movimiento breve y respeta preferencias accesibles',()=>{
    expect(css).toContain('@keyframes merchant-stagger');
    expect(css).toContain('.merchant-arrival');
    expect(css).toContain('.merchant-menu-filterbar');
    expect(css).toContain('.merchant-store-hero');
    expect(css).toContain('.merchant-kitchen-tracker');
    expect(css).toContain('.merchant-skeleton-line');
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(css).toContain('env(safe-area-inset-bottom,0px)');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('merchant-sr-only');
    expect(source).toContain('safeImage(restaurant.cover_image_url)');
  });
});
