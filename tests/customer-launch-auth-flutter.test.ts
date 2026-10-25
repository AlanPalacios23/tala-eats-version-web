import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const startup=read('../src/customer/CustomerStartup.tsx');
const splash=read('../src/customer/customer-startup.css');
const auth=read('../src/customer/CustomerAuth.tsx');
const authCss=read('../src/customer/customer-auth.css');
const brandIcon=read('../public/icons/delivery_dining_rounded.svg');
const app=read('../src/App.tsx');
const api=read('../src/lib/api.ts');
const main=read('../src/main.tsx');
const manifest=JSON.parse(read('../public/manifest-clientes.webmanifest'));

describe('Flutter Usuarios PWA original startup & auth parity',()=>{
 it('startup matches 1100ms minimum concurrent to session initialization and 420ms fade',()=>{
  expect(startup).toContain('window.setTimeout(()=>setMinimumElapsed(true),1100)');
  expect(startup).toContain('minimumElapsed||loading');
  expect(startup).toContain('reduced?0:420');
  expect(startup).toContain('role="status" aria-label="Iniciando Tala Eats"');
  expect(startup).toContain('te-launch-exit');
  expect(startup).toContain("if(!user&&!isPublic)return <Navigate to=\"/acceso\" replace");
  expect(app).toContain('<Route element={<CustomerStartup/>}>');
  expect(app).toContain('path="/clientes" element={<CustomerHome/>}');
  expect(app).toContain('path="/acceso" element={<CustomerAuth/>}');
 });
 it('splash copies Flutter original texts, white warm backdrop, tile and interval sequencing',()=>{
  expect(startup).toContain('delivery_dining_rounded.svg');
  expect(auth).toContain('delivery_dining_rounded.svg');
  expect(brandIcon).toContain('viewBox="0 0 24 24"');
  expect(brandIcon).toContain('fill="#ffffff"');
  expect(splash).not.toContain('fonts.googleapis.com/icon?family=Material');
  expect(startup).toContain('Tu comida favorita, más cerca.');
  expect(splash).toContain('width:88px;height:88px');
  expect(splash).toContain('background:linear-gradient(180deg,#fff4ec');
  expect(splash).toContain('animation:te-launch-mark 682ms');
  expect(splash).toContain('animation:te-launch-words 693ms');
  expect(splash).toContain('242ms both');
  expect(splash).toContain('animation:te-launch-loader-in 440ms');
  expect(splash).toContain('660ms both');
  expect(splash).toContain('@media (prefers-reduced-motion:reduce)');
  expect(manifest.background_color.toLowerCase()).toBe('#fffaf6');
  expect(manifest.theme_color.toLowerCase()).toBe('#fffaf6');
 });
 it('Login and signup use exact Flutter welcoming headings and validation',()=>{
  for(const label of ['Bienvenido de vuelta','Pide lo que se te antoje y sigue tu pedido en tiempo real.',
    'Crea tu cuenta','Un minuto y quedas listo para pedir en Tala Eats.',
    'Confirma tus datos','Revisa que tu correo sea correcto.',
    '8+ caracteres','Mayúscula','Minúscula','Número','Continuar','Crear cuenta y entrar'])expect(auth).toContain(label);
  expect(auth).toContain('¿Aún no tienes cuenta?');
  expect(auth).toContain('Acepto los Términos y el Aviso de privacidad.');
  expect(auth).toContain("password!==confirm");
  expect(auth).toContain("!accepted");
  expect(authCss).toContain('.te-auth-password-rules');
  expect(authCss).toContain('240ms');
  expect(auth).toContain('te-auth-floating-label');
  expect(authCss).toContain('.te-auth-input.has-value .te-auth-floating-label');
  expect(authCss).toContain('background:#ce3c0a;min-height:54px');
 });
 it('Forgot and reset call real network endpoints only after explicit actions',()=>{
  expect(auth).toContain('await api.forgotPassword(email.trim())');
  expect(auth).toContain('await api.resetPassword(resetToken,password)');
  expect(api).toContain("'/auth/password/forgot'");
  expect(api).toContain("'/auth/password/reset'");
  expect(auth).toContain('Si la cuenta existe, recibirás un enlace seguro.');
  expect(auth).toContain("if(!resetToken)");
  expect(auth).not.toContain('setTimeout(createAccount');
  expect(app).toContain('path="/restablecer" element={<CustomerAuth/>}');
 });
 it('customer auth and documents are routed without changing portal and other apps',()=>{
  expect(app).toContain('path="/" element={<PortalLanding/>}');
  expect(app).toContain('path="/restaurante" element={<Protected role="restaurant">');
  expect(app).toContain('path="/repartidor" element={<Protected role="driver">');
  expect(app).toContain('path="/terminos" element={<CustomerLegal/>}');
  expect(app).toContain('path="/privacidad" element={<CustomerLegal/>}');
  expect(main).toContain("path === '/acceso'");
  expect(main).toContain("path === '/restablecer'");
  expect(main).toContain("path === '/terminos'");
  expect(main).toContain("path === '/privacidad'");
  expect(startup).toContain("user.role==='driver'?");
 });
});
