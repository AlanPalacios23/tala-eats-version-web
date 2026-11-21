import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {describe,expect,it,vi} from 'vitest';

const context=vi.hoisted(()=>({role:'customer' as 'customer'|'restaurant'|'guest'}));
vi.mock('../src/lib/session',()=>({
 useSession:()=>({
  loading:false,
  user:context.role==='guest'?null:{
   id:1,role:context.role,name:'Usuario',email:'prueba@example.test'
  },
  logout:async()=>{},
  login:async()=>{}
 })
}));
import MerchantStandalone from '../src/merchant/MerchantStandalone';

const render=(url:string)=>renderToStaticMarkup(
 createElement(MemoryRouter,{initialEntries:[url]},
  createElement(MerchantStandalone)
 )
);
describe('Crece public route and merchant role boundary',()=>{
 it('public benefit page is accessible to guests and customers without revealing merchant tools',()=>{
  for(const role of ['guest','customer','restaurant'] as const){
   context.role=role;
   const html=render('/?vista=crece');
   expect(html).toContain('Tu negocio tiene mucho por crecer');
   expect(html).toContain('Todo claro, desde el primer día');
   expect(html).not.toContain('Esta cuenta no es de restaurante');
   expect(html).not.toContain('Cargando información del restaurante');
  }
 });
 it('nonmerchant session cannot access the private commerce workspace',()=>{
  context.role='customer';
  const html=render('/');
  expect(html).toContain('Esta cuenta no es de restaurante');
  expect(html).not.toContain('Administrar productos');
 });
 it('guest login shows Crece discovery, not a fake registration form',()=>{
  context.role='guest';
  const html=render('/');
  expect(html).toContain('Conoce Tala Eats Crece');
  expect(html).toContain('Entrar a mi negocio');
 });
});
