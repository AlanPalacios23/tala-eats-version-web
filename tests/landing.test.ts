import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEGAL_LINKS } from '../src/lib/legal-links';

const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/main.css',import.meta.url),'utf8');
const portal=source.split('function PortalLanding(){')[1]?.split('function RestaurantEntry(){')[0]??'';
const portalFooter=portal.split('<footer className="gateway-footer"')[1]?.split('</footer>')[0]??'';

describe('portada / del portal Tala Eats: exactamente tres apps y dos links legales',()=>{
 it('conserva las rutas de aplicaciones y no afecta /iniciar ni /clientes',()=>{
  expect(source).toContain('path="/" element={<PortalLanding/>}');
  expect(source).toContain('path="/iniciar" element={<CustomerEntry/>}');
  expect(source).toContain('path="/clientes" element={<CustomerGate><CustomerHome market={market} onSelectMarket={selectMarket}/></CustomerGate>}');
  expect(portal).toContain("path:'/iniciar',number:'01'");
  expect(portal).toContain("path:'/restaurante',number:'02'");
  expect(portal).toContain("path:'/repartidor',number:'03'");
  expect(source).toContain('path="/restaurante" element={<RestaurantEntry/>}');
  expect(source).toContain("if(user?.role==='restaurant')return <RestaurantWorkspace/>");
  expect(source).toContain('path="/repartidor" element={<Protected role="driver">');
 });
 it('mantiene solo el nombre Tala Eats arriba, en su posición original',()=>{
  expect(portal).toContain('className="gateway gateway-minimal"');
  expect(portal).toContain('<header className="gateway-header"');
  expect(portal).toContain('className="gateway-brand"');
  for(const removed of ['gateway-header-actions','gateway-menu','gateway-login','gateway-signup','gateway-heading','gateway-kicker','gateway-tagline','gateway-choose','gateway-menu-toggle']){
   expect(portal).not.toContain(removed);
  }
  expect(portal.match(/className="gateway-brand"/g)).toHaveLength(1);
 });
 it('conserva tres enlaces interactivos a Usuarios, Restaurantes y Repartidores',()=>{
  for(const name of ["title:'Pedir comida'","title:'Restaurantes'","title:'Repartidores'"]){
   expect(portal).toContain(name);
  }
  expect(portal).toContain('className="gateway-portal"');
  expect(portal).toContain('restaurantPortalDestination(import.meta.env.VITE_RESTAURANT_APP_URL)');
  expect(portal).toContain('aria-label="Acceso a las aplicaciones de Tala Eats"');
 });
 it('muestra exactamente dos enlaces finales, a términos y eliminación de cuenta',()=>{
  expect(portalFooter.match(/<a href=/g)).toHaveLength(2);
  expect(portalFooter).toContain('href={LEGAL_LINKS.terms}');
  expect(portalFooter).toContain('Términos y condiciones');
  expect(portalFooter).toContain('href={LEGAL_LINKS.deletion}');
  expect(portalFooter).toContain('Eliminación de cuenta');
  expect(portalFooter).not.toContain('gateway-footer-brand');
  expect(portalFooter).not.toContain('Mi cuenta');
  expect(portalFooter).not.toContain('InstallPWA');
  expect(LEGAL_LINKS.terms).toBe('https://web-talaeats.alan-palacios-dev.com/legal/terminos.html');
  expect(LEGAL_LINKS.deletion).toBe('https://talaeats.alan-palacios-dev.com/eliminar-cuenta');
 });
 it('es negra, adaptable y accesible por teclado',()=>{
  expect(css).toContain('.gateway{background:#080808');
  expect(css).toContain('.gateway.gateway-minimal .gateway-main');
  expect(css).toContain('.gateway.gateway-minimal .gateway-footer');
  expect(css).toContain('.gateway.gateway-minimal .gateway-footer a:focus-visible');
  expect(css).toContain('@media(max-width:600px)');
  expect(css).toContain('.gateway-portal:focus-visible');
 });
});
