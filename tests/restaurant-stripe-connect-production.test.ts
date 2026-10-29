import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {checkedOwnerConnectStatus,merchantConnectStage,trustedStripeConnectLink} from '../src/lib/merchant-connect';
import type {MerchantConnectStatus} from '../src/lib/restaurant-state';

const good:MerchantConnectStatus={owner_approved:true,transfers_active:true,payouts_enabled:true,details_submitted:true,ready:true};
describe('Restaurantes Web: Stripe Connect production readiness (no LIVE calls)',()=>{
 it('requires each boolean and rejects a foreign restaurant or invalid status',()=>{
  expect(checkedOwnerConnectStatus({...good,restaurant_id:8},8)).toEqual(good);
  expect(()=>checkedOwnerConnectStatus({...good,restaurant_id:9},8)).toThrow(/no corresponde/);
  expect(()=>checkedOwnerConnectStatus({...good,owner_approved:'true'},8)).toThrow(/incompleta/);
  expect(()=>checkedOwnerConnectStatus({...good,ready:'yes'},8)).toThrow(/inválido/);
  expect(()=>checkedOwnerConnectStatus(null,8)).toThrow();
  expect(()=>checkedOwnerConnectStatus(good,0)).toThrow();
 });
 it('never describes account as ready until owner consent and server ready are true',()=>{
  expect(merchantConnectStage(null)).toBe('unlinked');
  expect(merchantConnectStage({...good,owner_approved:false})).toBe('owner');
  expect(merchantConnectStage({...good,details_submitted:false})).toBe('stripe');
  expect(merchantConnectStage({...good,transfers_active:false})).toBe('stripe');
  expect(merchantConnectStage({...good,payouts_enabled:false})).toBe('stripe');
  expect(merchantConnectStage({...good,ready:false})).toBe('review');
  expect(merchantConnectStage({...good,ready:undefined})).toBe('review');
  expect(merchantConnectStage(good)).toBe('ready');
 });
 it('allows only an unexpired one-time link with an exact Stripe Connect HTTPS origin',()=>{
  const now=1800000000000;
  const valid='https://connect.stripe.com/setup/s/a-tala-eats-onboarding-token';
  expect(trustedStripeConnectLink({url:valid,expires_at:1800001800},now)).toBe(valid);
  for(const url of [
   'http://connect.stripe.com/setup/s/x',
   'https://connect.stripe.com.evil.example/setup/s/x',
   'https://evil.example/setup/s/x',
   'https://hacker@connect.stripe.com/setup/s/x',
   'https://connect.stripe.com:4433/setup/s/x',
   'https://connect.stripe.com/',
   'https://connect.stripe.com/setup//evil',
   'https://connect.stripe.com/setup/s/x#fragment',
  ])expect(()=>trustedStripeConnectLink({url,expires_at:1800001800},now)).toThrow();
  expect(()=>trustedStripeConnectLink({url:valid,expires_at:1799999999},now)).toThrow(/expiró/);
  expect(()=>trustedStripeConnectLink({url:valid,expires_at:1800000010},now)).toThrow(/expiró/);
  expect(()=>trustedStripeConnectLink({url:valid,expires_at:'1800001800'},now)).toThrow(/expiró/);
 });
 it('needs explicit owner approval and never creates a Stripe account or payout in browser',()=>{
  const app=readFileSync(new URL('../src/components/RestaurantApp.tsx',import.meta.url),'utf8');
  expect(app).toContain('ownerConnectAcknowledged');
  expect(app).toContain('disabled={busy||!syncHealthy||!ownerConnectAcknowledged||!connectTotpReady||PREVIEW_READONLY}');
  expect(app).toContain("if(result?.owner_confirmed!==true)");
  expect(app).toContain('checkedOwnerConnectStatus(c.value,r.id)');
  expect(app).toContain('trustedStripeConnectLink(result)');
  expect(app).toContain("window.location.assign(url)");
  expect(app).not.toContain('sk_live_');
  expect(app).not.toContain('stripe.accounts.create');
  expect(app).not.toContain('api.ownerTransfer');
  expect(app).toContain('Las transferencias automáticas no se activan desde esta aplicación');
 });
});
