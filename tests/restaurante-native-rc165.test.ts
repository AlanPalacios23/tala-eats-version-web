import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {isMerchantSection} from '../src/merchant/MerchantWorkspace';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const workspace=read('../src/merchant/MerchantWorkspace.tsx');
const install=read('../src/merchant/MerchantInstallCard.tsx');
const css=read('../src/merchant/merchant.css');
const head=read('../index.html');
const main=read('../src/main.tsx');
const manifest=JSON.parse(read('../public/manifest-restaurante.webmanifest'));
const sw=read('../public/sw.js');

describe('RC165 · Restaurante Android/iOS, sin alterar cobros ni rol',()=>{
  it('mantiene un único PWA standalone con accesos directos reales',()=>{
    expect(manifest.id).toBe('/app-restaurante');
    expect(manifest.start_url).toBe('/restaurante');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.theme_color).toBe('#ffffff');
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.shortcuts.map((x:{url:string})=>x.url)).toEqual([
      '/restaurante','/restaurante?tab=menu','/restaurante?tab=wallet'
    ]);
    expect(manifest.shortcuts.every((x:{url:string})=>x.url.startsWith('/restaurante'))).toBe(true);
    expect(head).toContain('viewport-fit=cover');
    expect(head).toContain('apple-mobile-web-app-capable');
    expect(head).toContain('mobile-web-app-capable');
    expect(head).toContain('apple-mobile-web-app-title');
    expect(main).toContain("merchant?'Tala Negocios':'Tala Eats'");
    expect(main).toContain("merchant?'#ffffff':'#080808'");
  });
  it('hace que el botón Atrás recorra pestañas y cierre el detalle antes de abandonar',()=>{
    for(const tab of ['pedidos','menu','rendimiento','wallet','negocio'])expect(isMerchantSection(tab)).toBe(true);
    expect(isMerchantSection(null)).toBe(false);
    expect(isMerchantSection('cuentas')).toBe(false);
    expect(workspace).toContain('const [searchParams,setSearchParams]=useSearchParams()');
    expect(workspace).toContain("searchParams.get('tab')");
    expect(workspace).toContain("searchParams.get('order')");
    expect(workspace).toContain("if(target==='pedidos')next.delete('tab')");
    expect(workspace).toContain("navigate(-1)");
    expect(workspace).toContain("if(id===null)next.delete('order')");
    expect(workspace).toContain("aria-modal=\"true\"");
    expect(workspace).toContain("if(e.key==='Escape')");
    expect(workspace).toContain("document.body.style.overflow='hidden'");
  });
  it('evita que el teclado tape navegación e inputs en iOS',()=>{
    expect(workspace).toContain('window.visualViewport');
    expect(workspace).toContain("viewport.addEventListener('resize',update)");
    expect(workspace).toContain("document.addEventListener('focusin',update)");
    expect(workspace).toContain('covered>140');
    expect(workspace).toContain('merchant-keyboard-open');
    expect(css).toContain('.merchant-shell.merchant-keyboard-open .merchant-mobile-nav{display:none!important}');
    expect(css).toContain('font-size:16px!important');
    expect(css).toContain('env(safe-area-inset-top,0px)');
    expect(css).toContain('env(safe-area-inset-bottom,0px)');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('touch-action:manipulation');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
  it('instala solo con el aviso permitido por Android y explica el camino de Safari',()=>{
    expect(install).toContain('beforeinstallprompt');
    expect(install).toContain('event.preventDefault()');
    expect(install).toContain('appinstalled');
    expect(install).toContain("display-mode: standalone");
    expect(install).toContain('standalone?:boolean');
    expect(install).toContain('Agregar a pantalla de inicio');
    expect(install).toContain('Instalar aplicación');
    expect(install).toContain('await offer.prompt()');
    expect(install).toContain('candidate?');
    expect(workspace).toContain('<MerchantInstallCard/>');
    expect(css).toContain('.merchant-install-card');
  });
  it('almacena solo estáticos y no borra caches de otras PWA',()=>{
    expect(sw).toContain("const PREFIX='tala-eats-shell-'");
    expect(sw).toContain('key.startsWith(PREFIX)');
    expect(sw).toContain('key!==CACHE');
    expect(sw).toContain("if (req.method !== 'GET')".replace('if (req','if(req'));
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain("url.pathname.includes('/withdrawals/')");
    expect(sw).toContain("url.pathname.startsWith('/auth/')");
    expect(sw).toContain("url.pathname.startsWith('/stripe/')");
    expect(sw).toContain("req.mode==='navigate'");
    expect(sw).toContain("cache.match('/offline.html')");
    expect(sw).toContain("url.pathname.startsWith('/assets/')");
    expect(sw).not.toContain("cache.put(req, res.clone())"); // only approved static responses are cached
  });
});
