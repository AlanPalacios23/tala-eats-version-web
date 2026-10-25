import {describe,expect,it} from 'vitest';
import {validateAvatar} from '../src/lib/customer-avatar';
import {readFileSync} from 'node:fs';

describe('Flutter-style profile avatar and privacy P0 regression',()=>{
 it('accepts only small genuine JPEG/PNG/WebP image signatures',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  const jpeg=new Uint8Array([255,216,255,224,0,2,1]);
  const webp=new Uint8Array([82,73,70,70,12,0,0,0,87,69,66,80,0]);
  await expect(validateAvatar(new File([png],'avatar.png',{type:'image/png'}))).resolves.toBeUndefined();
  await expect(validateAvatar(new File([jpeg],'avatar.jpg',{type:'image/jpeg'}))).resolves.toBeUndefined();
  await expect(validateAvatar(new File([webp],'avatar.webp',{type:'image/webp'}))).resolves.toBeUndefined();
  await expect(validateAvatar(new File([jpeg],'unsafe.png',{type:'image/png'}))).rejects.toThrow('imagen válida');
  await expect(validateAvatar(new File(['<svg onload=alert(1)>'],'bad.svg',{type:'image/svg+xml'}))).rejects.toThrow('JPG');
  await expect(validateAvatar(new File([new Uint8Array(2*1024*1024+1)],'large.jpg',{type:'image/jpeg'}))).rejects.toThrow('2 MB');
 });
 it('ports exact Flutter privacy request and opt-in endpoints, never immediate delete',()=>{
  const api=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
  expect(api).toContain("'/v11/privacy/preferences'");
  expect(api).toContain("'/v9/privacy'");
  expect(api).toContain('request_type:requestType');
  expect(api).toContain('personalization_opt_in:boolean;analytics_opt_in:boolean;marketing_opt_in:boolean');
  expect(api).not.toContain("request('/auth/me',json('DELETE')");
 });
 it('links privacy and account deletion to already published Cloudflare Tunnel pages',()=>{
  const account=readFileSync(new URL('../src/components/CustomerAccount.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  expect(account).toContain('LEGAL_LINKS.terms');
  expect(account).toContain('LEGAL_LINKS.privacy');
  expect(account).toContain('LEGAL_LINKS.deletion');
  expect(account).toContain('target="_blank" rel="noopener noreferrer"');
  expect(app).not.toContain('<CustomerLegal');
  expect(app).not.toContain('<CustomerPrivacy');
 });
 it('removes orders toolbar refresh while retaining error recovery',()=>{
  const orders=readFileSync(new URL('../src/components/CustomerOrders.tsx',import.meta.url),'utf8');
  expect(orders).toContain('<div className="mobile-orders-heading"><h1>Pedidos</h1></div>');
  expect(orders).not.toContain('aria-label="Actualizar pedidos"');
  expect(orders).toContain('onClick={refresh}>Reintentar');
 });
});
