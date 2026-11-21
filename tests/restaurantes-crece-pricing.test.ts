import {describe,expect,it} from 'vitest';
import {CRECE_PRICING,creceMoney,crecePricePreview} from '../src/merchant/crecePricing';

describe('Crece — financial transparency in exact integer centavos',()=>{
 it('matches current standard 17% seller / 7% customer example',()=>{
  const q=crecePricePreview('250.00');
  expect(q).not.toBeNull();
  expect(q!.itemSubtotalMinor).toBe(25000n);
  expect(q!.merchantCommissionMinor).toBe(4250n);
  expect(q!.merchantBeforeAdjustmentsMinor).toBe(20750n);
  expect(q!.customerServiceMinor).toBe(1750n);
  expect(q!.customerBeforeDeliveryMinor).toBe(26750n);
  expect(CRECE_PRICING.tipCommissionBps).toBe(0n);
 });
 it('does not cap the 7% service fee and uses M1 half-up centavo rounding',()=>{
  const fiveHundred=crecePricePreview('500');
  expect(fiveHundred?.customerServiceMinor).toBe(3500n);
  expect(fiveHundred?.merchantCommissionMinor).toBe(8500n);
  const rounding=crecePricePreview('10.03');
  expect(rounding?.itemSubtotalMinor).toBe(1003n);
  expect(rounding?.merchantCommissionMinor).toBe(171n);
  expect(rounding?.customerServiceMinor).toBe(70n);
 });
 it('rejects invalid, negative, scientific, fractional overprecision and enormous inputs',()=>{
  for(const raw of ['', '0', '0.00', '-1', '1e10', '1.001', '1,000',
    '1,50', '000100', '1000000', 'Infinity', 'NaN', '<script>']){
   expect(crecePricePreview(raw),String(raw)).toBeNull();
  }
  expect(crecePricePreview(null)).toBeNull();
 });
 it('allows small amounts and bounded large amounts without floating point drift',()=>{
  const small=crecePricePreview('0.01');
  expect(small?.itemSubtotalMinor).toBe(1n);
  expect(small?.customerServiceMinor).toBe(0n);
  const large=crecePricePreview('999999.99');
  expect(large).not.toBeNull();
  expect(large!.customerServiceMinor).toBe(7000000n);
  expect(creceMoney(large!.customerBeforeDeliveryMinor)).toContain('1,069,999.99');
 });
 it('does not allow arbitrary unsafe amounts to be formatted',()=>{
  expect(()=>creceMoney(-1n)).toThrow('CRECE_MONEY_RANGE_INVALID');
  expect(()=>creceMoney(201_000_000n)).toThrow('CRECE_MONEY_RANGE_INVALID');
 });
});
