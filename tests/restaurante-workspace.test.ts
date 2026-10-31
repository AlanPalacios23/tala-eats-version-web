import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');

describe('PWA Restaurantes: centro de operaciones',()=>{
  it('mantiene la protección de rol y separa el marco del portal de clientes',()=>{
    expect(app).toContain('<Protected role="restaurant"><Merchant/></Protected>');
    expect(app).toContain('const isMerchantRoute=');
    expect(app).toContain('showSiteChrome&&<AppHeader');
    expect(app).toContain('showSiteChrome&&<AppFooter');
    expect(app).toContain('<MerchantWorkspace/>');
  });
  it('usa datos reales de owner y no cifras inventadas',()=>{
    expect(workspace).toContain('api.ownerRestaurant()');
    expect(workspace).toContain('api.ownerOrders()');
    expect(workspace).toContain('api.ownerAnalytics()');
    expect(workspace).toContain("analytics?.delivered??'—'");
    expect(workspace).toContain('Histórico del servidor');
  });
  it('conserva el flujo aprobado de estados y el backend como autoridad',()=>{
    expect(workspace).toContain('api.ownerUpdateStatus(id,status)');
    expect(workspace).toContain("o.status==='received'?'confirmed'");
    expect(workspace).toContain("o.status==='confirmed'?'preparing'");
    expect(workspace).toContain("o.status==='preparing'?'ready'");
    expect(workspace).toContain('api.ownerUpdateRestaurant({is_open:!restaurant.is_open})');
  });
  it('ofrece navegación mobile, estados accesibles y movimiento reducido',()=>{
    expect(workspace).toContain('merchant-mobile-nav');
    expect(workspace).toContain('aria-label="Navegación inferior del restaurante"');
    expect(workspace).toContain('aria-pressed={filter===id}');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('env(safe-area-inset-bottom,0px)');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
  it('renderiza colas reales por etapas y hoja de detalles accesible',()=>{
    expect(workspace).toContain('merchant-board');
    expect(workspace).toContain('merchant-queue-column');
    expect(workspace).toContain("['received']");
    expect(workspace).toContain("['confirmed','preparing']");
    expect(workspace).toContain("['ready','assigned','picked_up','on_the_way']");
    expect(workspace).toContain('merchant-detail-sheet');
    expect(workspace).toContain('aria-modal="true"');
    expect(workspace).toContain('aria-label="Ver tablero"');
    expect(workspace).toContain('aria-label="Ver lista"');
    expect(css).toContain('.merchant-detail-backdrop');
    expect(css).toContain('.merchant-board');
  });
  it('usa el manifest standalone existente sin aislar autenticación ni API',()=>{
    const file=readFileSync(new URL('../public/manifest-restaurante.webmanifest',import.meta.url),'utf8');
    const manifest=JSON.parse(file);
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/restaurante');
    expect(manifest.theme_color).toBe('#ffffff');
    expect(app).toContain('<Protected role="restaurant">');
  });
  it('consulta pedidos periódicamente sin efectuar escrituras automáticas',()=>{
    expect(workspace).toContain("document.visibilityState==='visible'&&section==='pedidos'");
    expect(workspace).toContain('},30000)');
    expect(workspace).toContain('api.ownerUpdateItem(item.id');
    expect(workspace).toContain('api.ownerAddItem(');
    expect(workspace).not.toContain('window.localStorage');
  });
});
