import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const source=read('../src/merchant/MerchantWorkspace.tsx');
const css=read('../src/merchant/merchant.css');
const api=read('../src/lib/api.ts');

describe('RC168 · visual premium y navegación móvil sin ruido',()=>{
  it('muestra cinco secciones reales en cinco columnas, incluso en 320dp',()=>{
    const items=[...source.matchAll(/\{id:'(pedidos|menu|rendimiento|wallet|negocio)',label:/g)];
    expect(items.map(m=>m[1])).toEqual(['pedidos','menu','rendimiento','wallet','negocio']);
    expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))!important');
    expect(css).toContain('@media (max-width:360px)');
    expect(css).toContain('@media (min-width:981px) and (max-width:1280px)');
    expect(css).toContain('@media (min-width:761px) and (max-width:980px)');
    expect(css).toContain('.merchant-board-empty svg{display:none}');
    expect(css).toContain('min-width:0;width:100%;font-size:10px');
    expect(css).toContain('env(safe-area-inset-bottom,0px)');
    expect(source).toContain('aria-label="Navegación inferior del restaurante"');
  });
  it('proporciona búsqueda compacta y borrado accesible sin anidar botones dentro de un label',()=>{
    expect(source).toContain('<div className="merchant-search"><Search size={18} aria-hidden="true"/><input type="search" value={search}');
    expect(source).toContain('<div className="merchant-search"><Search size={18} aria-hidden="true"/><input type="search" placeholder="Buscar en el menú"');
    expect(source).toContain('aria-label="Limpiar búsqueda de pedidos"');
    expect(source).toContain('aria-label="Limpiar búsqueda de productos"');
    expect(source).toContain("onClick={()=>setSearch('')}");
    expect(source).toContain("onClick={()=>setMenuSearch('')}");
    expect(css).toContain('.merchant-search-clear');
    expect(css).toContain('.merchant-search input::-webkit-search-cancel-button{display:none}');
  });
  it('muestra pagos en etiquetas discretas y no presenta Stripe pendiente como confirmado',()=>{
    expect(source).toContain("merchantPaymentStatusLabel(o.payment_status)");
    expect(source).toContain("o.payment_method==='stripe'&&o.payment_status!=='paid'?'is-pending':''");
    expect(source).toContain('merchant-payment-state');
    expect(css).toContain('.merchant-order-foot>span>.merchant-payment-state.is-pending');
    expect(source).toContain('const awaitingStripePayment=!orderPaymentConfirmed(o)');
    expect(source).toContain('!ordersFresh||menuMutating||awaitingStripePayment');
  });
  it('mantiene jerarquía ligera, accesibilidad táctil y reduce motion',()=>{
    expect(css).toContain('/* RC168 · Restaurant calm UI polish');
    expect(css).toContain('.merchant-order-card.is-new{border-color:#edccaf');
    expect(css).toContain('.merchant-product-edit[aria-expanded="true"]');
    expect(css).toContain('.merchant-product-edit-panel[hidden]{display:none!important}');
    expect(css).toContain('.merchant-mobile-nav button:focus-visible');
    expect(css).toContain('.merchant-search-clear:focus-visible');
    expect(css).toContain('@media (hover:none)');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('min-height:44px');
  });
  it('preserva pedidos, Wallet solo lectura y misma API productiva',()=>{
    expect(source).toContain('api.ownerOrders()');
    expect(source).toContain('api.ownerUpdateStatus(id,status)');
    expect(source).toContain('api.ownerUpdateItem(item.id,{price,stock,is_available:available})');
    expect(source).toContain('<MerchantWallet key={restaurant?.id??\'no-restaurant\'}');
    expect(api).toContain("const BASE = '/api/v1'");
    expect(api).not.toContain('merchantRequestWithdrawal');
  });
});
