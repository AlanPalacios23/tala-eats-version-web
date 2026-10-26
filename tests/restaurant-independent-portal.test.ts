import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../src/App.tsx');
const landing=read('../src/components/RestaurantWelcome.tsx');
const css=read('../src/styles/restaurant-welcome.css');
const login=read('../src/components/RestaurantApp.tsx');
const boot=read('../src/main.tsx');
describe('Independent Tala Eats Restaurantes entry',()=>{
 it('selector routes Restaurante to its own entry, never to Pedir comida',()=>{
  expect(app).toContain("title:'Pedir comida'");
  expect(app).toContain("path:'/iniciar'");
  expect(app).toContain("title:'Restaurantes'");
  expect(app).toContain("path:'/restaurante'");
  expect(app).toContain('<Route path="/restaurante" element={<RestaurantEntry/>}/>');
  expect(app).not.toContain('<Route path="/restaurante" element={<CustomerEntry/>}/>');
 });
 it('renders a dedicated business welcome for anonymous and customer users',()=>{
  expect(app).toContain('function RestaurantEntry()');
  expect(app).toContain("if(user?.role==='restaurant')return <RestaurantWorkspace/>");
  expect(app).toContain('return <RestaurantWelcome existingCustomer={user?.role===\'customer\'}/>');
  expect(app).toContain('location.pathname.startsWith(\'/admin/\')');
  expect(landing).toContain('data-restaurant-welcome="true"');
  expect(landing).toContain('Sin entrar a la app de clientes');
  expect(landing).toContain('VISTA ILUSTRATIVA');
  expect(landing).toContain('No son pedidos reales');
 });
 it('register button opens merchant register form, not the customer signup',()=>{
  expect(landing).toContain("'/restaurante/acceso?mode=register'");
  expect(landing).toContain("'/restaurante/alta'");
  expect(login).toContain("new URLSearchParams(window.location.search).get('mode')==='register'");
  expect(login).toContain("await api.restaurantOnboardingSubmit");
 });
 it('merchant startup removes customer-only artwork and picks merchant manifest',()=>{
  expect(boot).toContain("document.getElementById('tala-first-paint')?.remove()");
  expect(boot).toContain("restaurante(?:\\/|$)");
  expect(boot).toContain('/manifest-restaurante.webmanifest');
 });
 it('responsive merchant screen has separate design scope and accessible layouts',()=>{
  expect(css).toContain('.rb-welcome{');
  expect(css).toContain('@media(max-width:800px)');
  expect(css).toContain('@media(max-width:520px)');
  expect(css).toContain('.rb-skip-link:focus');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).not.toContain('.customer-shell');
  expect(landing).toContain('aria-labelledby="rb-activation-title"');
 });
});
