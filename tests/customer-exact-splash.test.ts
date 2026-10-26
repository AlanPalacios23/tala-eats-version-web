import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
 it('uses exact real third food photo and its accessible clickable arrow hotspot',()=>{
  expect(source).toContain('src="/branding/onboarding-un-antojo-864x1536.jpg"');
  expect(source).toContain('width="864" height="1536"');
  expect(source).toContain('foodArtFailed');
  expect(source).toContain('className="customer-photo-hotspot customer-food-hotspot" to="/acceso" state={{from}}');
  expect(source).not.toContain('src="/branding/onboarding-rapido-seguro-864x1536.jpg"');
  expect(css).toContain('.customer-food-hotspot{');
 });
 it('uses actual React credential inputs over exact user email and password photos',()=>{
  expect(source).toContain('/branding/auth-continua-correo-864x1536.jpg');
  expect(source).toContain('/branding/auth-contrasena-729x1536.jpg');
  expect(source).toContain('customer-photo-auth-form');
  expect(source).toContain("type={step===0?'email':visible?'text':'password'}");
  expect(source).toContain('onChange={e=>change(e.target.value)}');
  expect(source).toContain('onSubmit={e=>void next(e)}');
  expect(source).toContain("onClick={switchMode}");
  expect(source).toContain('disabled={!valid||busy}');
  expect(source).toContain('onError={()=>setAuthArtFailed(true)}');
  expect(css).toContain('.customer-photo-field input');
  expect(css).toContain('.customer-photo-auth.stage-password .customer-photo-field');
 });
 it('never substitutes or recompresses the three original user JPEGs',()=>{
  const sources=[
   ['onboarding-un-antojo-864x1536.jpg','105f48692d4a6f8d7f97539a4cf3a70cd0d1359ea3fd74117ef8bb8a5d6dc467',350870],
   ['auth-continua-correo-864x1536.jpg','cda451a040e39149cae1180bba396db08995dce2b8b65879e9d9a97dd8d12c05',216742],
   ['auth-contrasena-729x1536.jpg','f188855e75afa63973e78317d6198ac14b0e5a310be99e2c242f351d4d2570ed',135780],
  ] as const;
  for(const [name,sha,bytes] of sources){
   const img=readFileSync(new URL('../public/branding/'+name,import.meta.url));
   expect(img.byteLength).toBe(bytes);
   expect(img.subarray(0,3).toString('hex')).toBe('ffd8ff');
   expect(createHash('sha256').update(img).digest('hex')).toBe(sha);
  }
 });
 it('never draws fake mobile status bars and respects phone viewport constraints',()=>{
  expect(css).toContain('object-fit:cover');
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(css).toContain('overscroll-behavior:none');
  expect(css).toContain('.customer-splash-exact::before');
 });
});
