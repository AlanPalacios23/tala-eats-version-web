import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');
const wallet=readFileSync(new URL('../src/merchant/MerchantWallet.tsx',import.meta.url),'utf8');

describe('RC164 · diseño minimalista y acciones operativas intactas',()=>{
  it('concentra pedidos en la cola real sin repetir métricas financieras en el inicio',()=>{
    expect(ui).toContain('Organiza pedidos nuevos, cocina y entregas.');
    expect(ui).not.toContain('merchant-ops-overview');
    expect(ui).not.toContain('CENTRO DE OPERACIONES</span>');
    expect(ui).toContain('merchant-queue-heading');
    expect(ui).toContain('merchant-order-grid');
    expect(ui).toContain('merchant-board');
    expect(ui).toContain('merchant-sync-pill');
    expect(ui).toContain('!ordersFresh||menuMutating||awaitingStripePayment');
  });
  it('presenta productos compactos y descubre el editor solo bajo demanda',()=>{
    expect(ui).toContain("const [expanded,setExpanded]=useState(false)");
    expect(ui).toContain('merchant-product-topline');
    expect(ui).toContain('merchant-product-facts');
    expect(ui).toContain('aria-expanded={expanded}');
    expect(ui).toContain("id={'merchant-product-edit-'+item.id} hidden={!expanded}");
    expect(ui).toContain("if(expanded&&dirty)");
    expect(ui).toContain('Guarda o deshaz los cambios antes de cerrar.');
    expect(ui).toContain('onClick={undo}>Deshacer');
    expect(ui).toContain("setExpanded(false)");
    expect(ui).toContain('api.ownerUpdateItem(item.id,{price,stock,is_available:available})');
    expect(css).toContain('.merchant-product-edit-panel');
    expect(css).toContain('.merchant-product.is-expanded');
    expect(css).toContain('.merchant-product-edit[aria-expanded="true"]');
  });
  it('conserva todos los flujos críticos sin banners redundantes',()=>{
    expect(ui).toContain("activeFreshOrders.length===0");
    expect(ui).toContain('merchant-arrival');
    expect(ui).not.toContain('merchant-menu-info');
    expect(ui).toContain('categories.length>1');
    expect(ui).not.toContain('merchant-sidebar-label');
    expect(ui).toContain('merchant-store-hero');
    expect(ui).toContain('api.ownerRestaurant()');
    expect(ui).toContain('api.ownerOrders()');
    expect(ui).toContain('api.ownerAnalytics()');
    expect(ui).toContain('window.print()');
    expect(ui).toContain('merchant-detail-sheet');
  });
  it('mantiene wallet, indicadores históricos y seguridad financiera aparte',()=>{
    expect(ui).toContain("section==='rendimiento'");
    expect(ui).toContain('note="Histórico"');
    expect(ui).toContain("section==='wallet'");
    expect(wallet).toContain('server_allows_requests');
    expect(wallet).toContain('No equivale a saldo bancario');
    expect(wallet).not.toContain('merchantRequestWithdrawal(');
    expect(css).toContain('.merchant-wallet-notice');
  });
  it('prioriza espacios, contraste, movimiento reducido y navegación móvil',()=>{
    expect(css).toContain('/* RC164 · Calm workspace:');
    expect(css).toContain('.merchant-product-topline');
    expect(css).toContain('.merchant-menu-count');
    expect(css).toContain('.merchant-arrival{background:#fff');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('env(safe-area-inset-bottom,0px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(ui).toContain('aria-label="Navegación inferior del restaurante"');
  });
});
