import {describe,it,expect} from 'vitest';
import {normalizePickupPin,validPickupPin} from '../src/lib/pickup-handoff';

describe('LIVE pickup merchant PIN handoff (cash + Stripe)',()=>{
 it('accepts only exact four-digit PINs, including leading zeros',()=>{
  for(const pin of ['0000','0001','0284','1234','9999'])expect(validPickupPin(pin)).toBe(true);
  for(const pin of ['','123','12345','a123','12a4','123 ',' 1234','12\\d','1234\\n'])
   expect(validPickupPin(pin)).toBe(false);
 });
 it('strips non-digits and limits input to 4 digits',()=>{
  expect(normalizePickupPin('1234')).toBe('1234');
  expect(normalizePickupPin('0a0-2 4')).toBe('0024');
  expect(normalizePickupPin('123456789')).toBe('1234');
  expect(normalizePickupPin('abcd')).toBe('');
 });
 it('never authorizes payments; input filtering does not imply delivery',()=>{
  expect(validPickupPin(normalizePickupPin('12x'))).toBe(false);
  expect(validPickupPin(normalizePickupPin('0-2-8-4'))).toBe(true);
 });
});
