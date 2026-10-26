import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {previewRequestAllowed} from '../src/lib/preview';

const conf=readFileSync(new URL('../deploy/nginx-preview-server.conf',import.meta.url),'utf8');
const unit=readFileSync(new URL('../deploy/talaeats-web-preview.service',import.meta.url),'utf8');
const script=readFileSync(new URL('../deploy/kali-review-preview.sh',import.meta.url),'utf8');

describe('isolated Kali read-only Web review gate',()=>{
 it('blocks every financial, merchant, driver and customer write even on a forged UI request',()=>{
  for(const path of ['/orders','/orders/quote','/orders/delivery-quote','/payments/stripe/orders/1/payment-intent','/owner/orders/1/status','/driver/orders/1/accept','/platform/rewards/redeem','/auth/register','/auth/me','/platform/orders/1/chat']){
   for(const method of ['POST','PATCH','PUT','DELETE'])expect(previewRequestAllowed(path,method,true)).toBe(false);
  }
 });
 it('allows existing login/logout and only GET reads',()=>{
  expect(previewRequestAllowed('/auth/login','POST',true)).toBe(true);
  expect(previewRequestAllowed('/auth/logout','POST',true)).toBe(true);
  expect(previewRequestAllowed('/auth/register','POST',true)).toBe(false);
  expect(previewRequestAllowed('/orders/mine','GET',true)).toBe(true);
  expect(previewRequestAllowed('/platform/wallet','HEAD',true)).toBe(true);
  expect(previewRequestAllowed('/orders','POST',false)).toBe(true);
 });
 it('restricts preview nginx to localhost and no generic POST passthrough',()=>{
  expect(conf).toContain('listen 127.0.0.1:18196;');
  expect(conf).toContain('limit_except GET { deny all; }');
  expect(conf).toContain('location = /api/v1/auth/login');
  expect(conf).toContain('location = /api/v1/auth/logout');
  expect(conf).toContain('location = /sw.js { return 404; }');
  expect(conf).toContain('noindex, nofollow, noarchive');
  expect(conf).not.toContain('listen 0.0.0.0:18196;');
  expect(conf).not.toContain('proxy_pass http://127.0.0.1:18195');
 });
 it('keeps preview service, releases and rollback separate from the live frontend',()=>{
  expect(unit).toContain('User=www-data');
  expect(unit).toContain('NoNewPrivileges=true');
  expect(script).toContain('/srv/talaeats-web-preview');
  expect(script).toContain('I_APPROVE_READONLY_PREVIEW_ONLY');
  expect(script).toContain('PREVIEW_PLAN=PASS_READ_ONLY');
  expect(script).not.toContain('systemctl reload nginx');
  expect(script).not.toContain('pm2 restart');
  expect(script).not.toContain('cloudflared tunnel');
 });
});
