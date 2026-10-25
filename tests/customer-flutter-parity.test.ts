import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const pages=read('../src/customer/CustomerExperience.tsx');
const css=read('../src/customer/customer.css');
const app=read('../src/App.tsx');
const main=read('../src/main.tsx');
const api=read('../src/lib/api.ts');

describe('Usuarios Flutter visual parity / web PWA',()=>{
 it('uses genuine Flutter Home hierarchy, not the promotional web hero',()=>{
   for (const label of ['Comprar en', 'Hola, ', '¿Qué se te antoja hoy?',
                        'Buscar restaurantes o comida…', 'Restaurantes y comercios']) {
     expect(pages).toContain(label);
   }
   expect(app).toContain('path="/clientes" element={<CustomerHome/>}');
   expect(app).toContain('path="/buscar" element={<CustomerSearch/>}');
   expect(app).not.toContain('path="/clientes" element={<Home/>}');
 });
 it('replicates Flutter premium dock: four tabs and selected orange pill',()=>{
   for (const label of ["name:'Inicio'","name:'Buscar'","name:'Pedidos'","name:'Cuenta'"]) {
      expect(pages).toContain(label);
   }
   expect(css).toContain('.te-customer-dock-item.active .te-customer-dock-icon');
   expect(css).toContain('background:#ffe9df');
   expect(css).toContain('height:68px');
 });
 it('keeps actual API, hides unknown ratings and missing ETA rather than inventing data',()=>{
   expect(pages).toContain('api.restaurants()');
   expect(pages).toContain("Number.isFinite(parsed) && parsed > 0 && parsed <= 5");
   expect(pages).toContain("shop.eta_min>0");
   expect(pages).toContain('shop.pickup_enabled===true');
   expect(pages).toContain('Aún no hay comercios disponibles');
   expect(pages).toContain('No pudimos cargar los comercios');
   expect(api).toContain("const BASE = '/api/v1'");
   expect(api).toContain("credentials: 'include'");
   expect(pages).not.toContain('api.placeCashPickup');
 });
 it('preserves role isolation, PWA identity and responsive typography',()=>{
   expect(app).toContain('!isGateway&&!isCustomer&&<AppHeader');
   expect(app).toContain('isCustomerTab&&<CustomerDock/>');
   expect(app).toContain('Protected role="restaurant"');
   expect(app).toContain('Protected role="driver"');
   expect(main).toContain("path === '/buscar'");
   expect(css).toContain('aspect-ratio:16/9');
   expect(css).toContain('@media(max-width:360px)');
   expect(css).toContain('@media(prefers-reduced-motion:reduce)');
   expect(css).toContain('.te-customer-search-field:focus-within');
 });
});
