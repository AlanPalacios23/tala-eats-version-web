import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
describe('landing TALA EATS', () => {
 it('separa portada y catálogo sin perder las rutas originales', () => {
  expect(source).toContain('path="/" element={<PortalLanding/>}');
  expect(source).toContain('path="/clientes" element={<CustomerHome/>}');
  expect(source).toContain('path="/restaurante" element={<Protected role="restaurant">');
  expect(source).toContain('path="/repartidor" element={<Protected role="driver">');
 });
 it('ofrece tres accesos reales y menú accesible', () => {
  expect(source).toContain("title:'Pedir comida'");
  expect(source).toContain("title:'Restaurantes'");
  expect(source).toContain("title:'Repartidores'");
  expect(source).toContain('aria-expanded={menuOpen}');
  expect(source).toContain("state={{create:true,from:'/clientes'}}");
 });
 it('es una portada negra adaptable con estados de foco', () => {
  expect(css).toContain('.gateway{background:#080808');
  expect(css).toContain('.gateway-portal:focus-visible');
  expect(css).toContain('@media(max-width:600px)');
 });
});
