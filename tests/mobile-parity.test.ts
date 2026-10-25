import { describe, expect, it } from 'vitest';
import { amountInCents, foldSearch, pickupCashAllowed, quoteChanged, quoteIsUsable, MOBILE_MOTION } from '../src/lib/mobile-parity';
describe('Usuarios Mobile parity: checkout protection',()=>{
 it('uses integer cents, not float approximations',()=>{expect(amountInCents('39.20')).toBe(3920);expect(amountInCents('39.201')).toBeNull();expect(amountInCents(-1)).toBeNull();});
 it('rejects invalid and misleading quotes',()=>{expect(quoteIsUsable({total:'99.90',currency:'MXN',inventory_reserved:false})).toBe(true);expect(quoteIsUsable({total:'99.90',inventory_reserved:true})).toBe(false);expect(quoteIsUsable({total:'99.90',currency:'USD'})).toBe(false);});
 it('requires explicit authorization from payment methods',()=>{expect(pickupCashAllowed({methods:[{id:'cash',enabled:true}],pickup_checkout_supported:true})).toBe(true);expect(pickupCashAllowed({methods:[{id:'cash',enabled:true}],pickup_checkout_supported:false})).toBe(false);expect(pickupCashAllowed({methods:[]})).toBe(false);});
 it('detects changed server quote requiring a new confirmation',()=>{expect(quoteChanged({total:'107.00',service_fee:'7.00'},{total:'108.00',service_fee:'8.00'})).toBe(true);expect(quoteChanged({total:'107.00'},{total:107})).toBe(false);});
 it('searches independent of accents and mobile motion stays pinned',()=>{expect(foldSearch('  TÁCOS  ')).toBe('tacos');expect(MOBILE_MOTION.micro).toBe(140);expect(MOBILE_MOTION.page).toBe(320);});
});
