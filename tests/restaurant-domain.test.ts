import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {restaurantPortalDestination,mainTalaEatsPortalHref,isDedicatedRestaurantDomain} from '../src/lib/restaurant-host';
const src=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
describe('Merchant isolated domain security + routing',()=>{
 it('defaults to existing merchant path until a verified domain is actively configured',()=>{
  for(const value of ['',undefined,null,'http://restaurantes-talaeats.alan-palacios-dev.com/restaurante','https://evil.test/restaurante','https://restaurantes-talaeats.alan-palacios-dev.com.evil.test/restaurante','https://restaurantes-talaeats.alan-palacios-dev.com/clientes','https://restaurantes-talaeats.alan-palacios-dev.com/restaurante?data=x'])expect(restaurantPortalDestination(value)).toBe('/restaurante');
  expect(restaurantPortalDestination('https://restaurantes-talaeats.alan-palacios-dev.com/restaurante')).toBe('https://restaurantes-talaeats.alan-palacios-dev.com/restaurante');
 });
 it('merchant back button resolves to existing safe Tala Eats gateway not own / redirect',()=>{
  expect(mainTalaEatsPortalHref('restaurantes-talaeats.alan-palacios-dev.com')).toBe('https://web-talaeats.alan-palacios-dev.com/');
  expect(mainTalaEatsPortalHref('web-talaeats.alan-palacios-dev.com')).toBe('/');
  expect(isDedicatedRestaurantDomain('restaurantes-talaeats.alan-palacios-dev.com')).toBe(true);
  expect(isDedicatedRestaurantDomain('web-talaeats.alan-palacios-dev.com')).toBe(false);
 });
 it('selector preserves opt-in routing, and business app never uses customer splash',()=>{
  const app=src('../src/App.tsx');
  const welcome=src('../src/components/RestaurantWelcome.tsx');
  expect(app).toContain("restaurantPortalDestination(import.meta.env.VITE_RESTAURANT_APP_URL)");
  expect(welcome).toContain('mainTalaEatsPortalHref(window.location.hostname)');
  expect(app).toContain('<Route path="/restaurante" element={<RestaurantEntry/>}/>');
 });
 it('isolated Nginx never proxies to old customer shell or staging',()=>{
  const nginx=src('../deploy/nginx-restaurantes-isolated-server.conf');
  expect(nginx).toContain('listen 127.0.0.1:18197;');
  expect(nginx).toContain('server_name restaurantes-talaeats.alan-palacios-dev.com;');
  expect(nginx).toContain('proxy_pass http://127.0.0.1:18190;');
  expect(nginx).toContain('location ^~ /restaurante/');
  expect(nginx).toContain('try_files $uri /restaurantes.html;');
  expect(nginx).toContain('location = /sw-restaurante.js');
  expect(nginx).toContain('location = /sw.js { return 404; }');
  expect(nginx).toContain('return 302 /restaurante;');
  expect(nginx).not.toContain('api-stage-talaeats');
  expect(nginx).not.toContain('127.0.0.1:18195');
 });
});