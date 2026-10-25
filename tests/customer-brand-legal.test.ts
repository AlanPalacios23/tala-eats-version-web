import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {LEGAL_LINKS} from '../src/lib/legal-links';
const text=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('premium Flutter Users branding / legal public links and no user 2FA',()=>{
 it('removes two factor code inputs from customer UI without disabling server admin MFA',()=>{
  const ui=text('../src/components/CustomerOnboarding.tsx');
  for(const secret of ['Código 2FA','Código de 6 dígitos','setOtp(','inputMode="numeric"','autoComplete="one-time-code"'])
   expect(ui).not.toContain(secret);
  expect(ui).toContain('login(email.trim(),password)');
  expect(ui).toContain('type={isPassword&&!visible?');
 });
 it('uses the ORIGINAL user-supplied brush script logo, not Georgia Tala/EATS substitute',()=>{
  const svg=text('../public/branding/tala-script-gradient.svg');
  const ui=text('../src/components/CustomerOnboarding.tsx');
  const html=text('../index.html');
  const launch=text('../src/components/CustomerLaunch.tsx');
  expect(svg).toContain('aria-label="Tala Eats"');
  expect(svg).toContain('<linearGradient');
  expect(ui).toContain('/branding/tala-script-gradient.svg');
  expect(launch).toContain('/branding/tala-script-gradient.svg');
  expect(html).toContain('/branding/tala-script-gradient.svg');
 });
 it('premium welcome/methods use already verified SAME-ORIGIN public restaurant imagery',()=>{
  const css=text('../src/styles/main.css');
  expect(css).toContain('/api/v1/uploads/catalog/r1-4YiKcP7oVyQdLwDAWJP8y3yiE1O-wA6h.jpg');
  expect(css).toContain('/api/v1/uploads/catalog/r1-p1-fp-ow0ULDj24aM6vkfKWfZAwElFJyXDq.jpg');
  expect(css).toContain('.customer-cta-label{text-align:center');
  expect(css).toContain('.customer-auth-next>svg{position:absolute');
 });
 it('uses original public Cloudflare pages without rendering legacy legal panels',()=>{
  const account=text('../src/components/CustomerAccount.tsx');
  const main=text('../src/App.tsx');
  const signup=text('../src/components/CustomerOnboarding.tsx');
  expect(LEGAL_LINKS.privacy).toBe('https://talaeats.alan-palacios-dev.com/privacidad');
  expect(LEGAL_LINKS.deletion).toBe('https://talaeats.alan-palacios-dev.com/eliminar-cuenta');
  expect(account).toContain('LEGAL_LINKS.deletion');
  expect(signup).toContain('href={LEGAL_LINKS.terms}');
  expect(main).not.toContain('<CustomerLegal');
  expect(main).not.toContain('<CustomerPrivacy');
  expect(existsSync(new URL('../src/components/CustomerLegal.tsx',import.meta.url))).toBe(false);
 });
});
