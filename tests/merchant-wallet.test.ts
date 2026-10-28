import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {merchantEarningTotals,merchantWithdrawalEnabled,safeMinor} from '../src/lib/merchant-wallet';
import type {MerchantEarnings} from '../src/lib/api';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const earning:MerchantEarnings={
 restaurant_id:11,currency:'MXN',unit:'centavos',
 earnings_by_status:[{state:'held',total_minor:'12500',orders:'2'},{state:'reserved',total_minor:'3000',orders:'1'}],
 physical_cash_due_to_platform:[],transfer_not_executed:true
};
describe('Tala Eats restaurant Wallet: no simulated bank withdrawals',()=>{
 it('shows only validated server allocation totals, never bank balance',()=>{
  expect(merchantEarningTotals(earning)).toEqual({registeredMinor:15500,rows:[
   {state:'held',amountMinor:12500,orders:2},{state:'reserved',amountMinor:3000,orders:1}
  ]});
  expect(merchantWithdrawalEnabled(earning)).toBe(false);
 });
 it('rejects malformed and unsafe monetary data, not make up zero',()=>{
  expect(safeMinor('')).toBeNull();
  expect(safeMinor('01')).toBeNull();
  expect(safeMinor('-1200')).toBeNull();
  expect(safeMinor('2e9')).toBeNull();
  expect(safeMinor('9007199254740991')).toBeNull();
  expect(merchantEarningTotals({...earning,currency:'USD'} as unknown as MerchantEarnings)).toBeNull();
  expect(merchantEarningTotals({...earning,earnings_by_status:[{state:'held',total_minor:'not a number',orders:'1'}]})).toBeNull();
  expect(merchantEarningTotals(null)).toBeNull();
  expect(merchantWithdrawalEnabled(null)).toBe(false);
 });
 it('uses read-only Node owner earnings; no payout or transfer POST in UI',()=>{
  const api=read('../src/lib/api.ts');
  const wallet=read('../src/components/MerchantWallet.tsx');
  expect(api).toContain('/owner/finance/earnings/');
  expect(wallet).toContain('Retirar ganancias');
  expect(wallet).toContain('Los retiros bancarios aún no están habilitados');
  expect(wallet).toContain('No iniciada');
  expect(wallet).not.toMatch(/api\.[A-Za-z]*(Withdraw|Transfer|Payout)/);
  expect(wallet).not.toContain('stripe.transfers.create');
   // Do not present stale balances from another restaurant or retry.
   expect(wallet).toContain('requestId.current');
   expect(wallet).toContain('thisRequest===requestId.current');
   expect(wallet).toContain('merchantEarningTotals(data)===null');
   expect(wallet).toContain('aria-describedby="mw-modal-description"');
   expect(wallet).toContain("event.key!=='Tab'");
   expect(wallet).toContain('target.focus({preventScroll:true})');
 });
 it('mobile navigation retains 5 one-touch destinations with Wallet under Más',()=>{
  const app=read('../src/components/RestaurantApp.tsx');
  const more=read('../src/components/RestaurantParity.tsx');
  const styles=read('../src/styles/restaurant-mobile-wallet.css');
  expect(app).toContain("{id:'finanzas',label:'Wallet'");
  expect(app).toContain('MerchantWallet');
  expect(more).toContain('Abrir Wallet');
  expect(more).toContain('rm-mobile-more-shortcuts');
  expect(styles).toContain('@media(max-width:360px)');
  expect(styles).toContain('.rm-mobile-home');
  expect(styles).toContain('.rm-mobile-more-shortcuts');
 });
});
