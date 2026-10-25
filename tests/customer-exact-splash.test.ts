import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/CustomerOnboarding.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/main.css',import.meta.url),'utf8');
describe('User-supplied precise 728x1536 first splash',()=>{
 it('renders the source artwork (not a newly invented food photo)',()=>{
  expect(source).toContain('src="/branding/splash-exacto-728x1536.webp"');
  expect(source).toContain('width="728" height="1536"');
  expect(source).toContain('customer-splash-art');
  expect(source).toContain('splashArtFailed');
 });
 it('uses accessible actual circular orange button to advance, not a baked-in arrow',()=>{
  expect(source).toContain('aria-label="Siguiente pantalla"');
  expect(source).toContain('onClick={()=>setStage(\'welcome\')}');
  expect(source).toContain('className="customer-splash-next"');
  expect(css).toContain('.customer-splash-next{');
  expect(css).toContain('border-radius:50%');
 });
 it('does not automatically dismiss the first artwork after five seconds',()=>{
  expect(source).not.toContain('starting.current');
  expect(source).not.toContain('setTimeout(()=>setStage(\'welcome\')');
 });
 it('uses the SAME source in the transient loading screen and interactive splash',()=>{
  const boot=readFileSync(new URL('../src/components/CustomerLaunch.tsx',import.meta.url),'utf8');
  expect(boot).toContain('/branding/splash-exacto-728x1536.webp');
  expect(boot).not.toContain('/branding/tala-script-gradient.svg');
  expect(css).toContain('.customer-launch-exact-art');
 });
 it('replaces crowded second welcome with exact tacos photo, not old extra logo/text/white Continue bar',()=>{
  expect(source).toContain('src="/branding/onboarding-comida-tu-ciudad-729x1536.webp"');
  expect(source).toContain('width="729" height="1536"');
  expect(source).toContain("onClick={()=>setStage('methods')}");
  expect(source).toContain('aria-label="Avanzar desde Comida de tu ciudad"');
  expect(source).not.toContain('<h1>Bienvenido<br/>a Tala Eats</h1>');
  expect(source).not.toContain('className="customer-onboarding-cta glass"');
 });
 it('uses precisely the same circular button class for both screens',()=>{
  const arrowMarkup=(source.match(/className="customer-splash-next"/g)||[]).length;
  expect(arrowMarkup).toBe(2);
  expect(css).toContain('.customer-splash-next{');
 });
 it('never draws fake mobile status bars and respects phone viewport constraints',()=>{
  expect(css).toContain('object-fit:cover');
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(css).toContain('overscroll-behavior:none');
  expect(css).toContain('.customer-splash-exact::before');
 });
});
