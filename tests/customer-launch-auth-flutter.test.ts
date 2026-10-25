import { describe,expect,it } from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const startup=read('../src/customer/CustomerStartup.tsx');
const splash=read('../src/customer/customer-startup.css');
const journey=read('../src/customer/CustomerJourney.tsx');
const journeyCss=read('../src/customer/customer-journey.css');
const step=read('../src/customer/CustomerStepAuth.tsx');
const stepCss=read('../src/customer/customer-step-auth.css');
const auth=read('../src/customer/CustomerAuth.tsx');
const app=read('../src/App.tsx');
const main=read('../src/main.tsx');
const manifest=JSON.parse(read('../public/manifest-clientes.webmanifest'));

describe('Latest Flutter Usuarios v1.0.46 startup/auth parity',()=>{
 it('matches the real 5-second launch/620ms switch of Mobile branch, not main',()=>{
  expect(startup).toContain('window.setTimeout(()=>setMinimumElapsed(true),5000)');
  expect(startup).toContain('if(!minimumElapsed||loading)return;');
  expect(startup).toContain('reduced?0:620');
  expect(startup).toContain("'/landing/tala_eats_original_wordmark.png'".replaceAll("'","\"").slice(1,-1));
  expect(startup).toContain('Pide, disfruta y repite.');
  expect(startup).toContain('to="/bienvenida"');
  expect(splash).toContain('background:#fff');
  expect(splash).toContain('te-launch-original-wordmark 766.5ms');
  expect(splash).toContain('te-launch-latest-exit 620ms');
  expect(splash).toContain('@media(prefers-reduced-motion:reduce)');
  expect(manifest.background_color.toLowerCase()).toBe('#fffaf6');
 });
 it('ports original two photo surfaces, correct copy and glass button with no replacements',()=>{
  expect(journey).toContain('food_tala.webp');
  expect(journey).toContain('food_fiesta.webp');
  expect(journey).toContain('tala_eats_wordmark_transparent.png');
  expect(journey).toContain('Bienvenido');
  expect(journey).toContain('Tus platillos favoritos,');
  expect(journey).toContain('Un antojo,');
  expect(journey).toContain('Continuar con tu correo');
  expect(journeyCss).toContain('backdrop-filter:blur(20px)');
  expect(journeyCss).toContain('height:64px');
 });
 it('uses real Flutter 2-step login and 4-step signup, not obsolete auth form',()=>{
  expect(step).toContain("type Mode='signIn'|'signUp'");
  expect(step).toContain("const signupTitles=");
  expect(step).toContain("mode==='signUp'?3:1");
  expect(step).toContain('Ingresa tu correo');
  expect(step).toContain('¿Cuál es tu apellido?');
  expect(step).toContain('Crea tu contraseña');
  expect(step).toContain("first.trim()+' '+last.trim()");
  expect(step).toContain('await session.login(email.trim(),password)');
  expect(step).toContain('await session.register');
  expect(stepCss).toContain('width:62px;height:62px');
  expect(stepCss).toContain('background:#fff');
 });
 it('retains the dual legal consent bottom sheet and real password recovery',()=>{
  expect(step).toContain("role=\"dialog\" aria-modal=\"true\"");
  expect(step).toContain('!terms||!privacy');
  expect(step).toContain('Acepto los Términos y Condiciones de TALA EATS.');
  expect(step).toContain('Acepto el Aviso de Privacidad.');
  expect(step).toContain('to="/recuperar"');
  expect(auth).toContain("location.pathname==='/recuperar'?'forgot'");
 });
 it('retains PWA role isolation, sign-in routes, and no payment change',()=>{
  for(const route of ['/clientes','/bienvenida','/metodos','/acceso','/recuperar','/restablecer'])
   expect(app).toContain('path="'+route+'"');
  expect(app).toContain('path="/restaurante" element={<Protected role="restaurant">');
  expect(app).toContain('path="/repartidor" element={<Protected role="driver">');
  expect(app).toContain('path="/" element={<PortalLanding/>}');
  expect(main).toContain("path === '/bienvenida'");
  expect(main).toContain("path === '/metodos'");
  expect(step).not.toContain('stripe');
 });
});
