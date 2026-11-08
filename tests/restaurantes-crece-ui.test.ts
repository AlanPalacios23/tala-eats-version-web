import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import CrecePublic from '../src/merchant/CrecePublic';
import MerchantCrece from '../src/merchant/MerchantCrece';
import CreceCalculator from '../src/merchant/CreceCalculator';

describe('Tala Eats Crece visible merchant screens',()=>{
 it('public affiliation offer has five pillars, truthful fees and no fake onboarding form',()=>{
  const html=renderToStaticMarkup(createElement(CrecePublic,{onBack:()=>{}}));
  expect(html).toContain('Tu negocio tiene mucho por crecer');
  expect(html).toContain('Tala Eats Crece');
  expect(html).toContain('17%');
  expect(html).toContain('no almacena solicitudes');
  expect(html).not.toContain('<form');
  expect(html).toContain('Menú');
  expect(html).toContain('Todo claro, desde el primer día');
  expect((html.match(/<details/g)??[])).toHaveLength(8);
  expect(html).toContain('Comisión al comercio');

 });
 it('private dashboard does not manufacture QR or claimed metrics without verified inputs',()=>{
  const html=renderToStaticMarkup(createElement(MerchantCrece,{
   restaurant:null,metrics:null,onNavigate:()=>{}
  }));
  expect(html).toContain('El enlace y QR todavía no están disponibles');
  expect(html).toContain('Los indicadores no están confirmados por la API');
  expect(html).toContain('Fundadores');
  expect(html).not.toContain('Enlace copiado');
 });
 it('calculator displays 17pct and 7pct as distinct non-payment values',()=>{
  const html=renderToStaticMarkup(createElement(CreceCalculator));
  expect(html).toContain('Importe del comercio antes de ajustes');
  expect(html).toContain('207.50');
  expect(html).toContain('17.50');
  expect(html).toContain('267.50');
  expect(html).toContain('no cotización ni saldo bancario');
 });
});
