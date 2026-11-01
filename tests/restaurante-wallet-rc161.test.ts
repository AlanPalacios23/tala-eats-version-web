import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
  verifiedMxn,verifiedCents,parseRestaurantFinance,parseWithdrawalBalance,
  parseWithdrawalHistory,parseConnectSummary,formatVerifiedCents,formatVerifiedMxn
} from '../src/merchant/financeContracts';

const wallet=readFileSync(new URL('../src/merchant/MerchantWallet.tsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/merchant/MerchantWorkspace.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/merchant/merchant.css',import.meta.url),'utf8');

const balance={
  currency:'MXN',source:'delivered_paid_stripe_connect_transfers_only',
  eligible_cents:14500,already_requested_cents:4500,provider_available_cents:20000,
  withdrawable_cents:10000,hold_days:3,bank:{status:'verified',bank_name:'Banco de prueba',last4:'4321'},
  reconciling:false,server_allows_requests:false,
  limits:{minimum_cents:100,per_request_cents:10000,daily_remaining_cents:20000}
};

describe('RC161 Restaurante · datos financieros auténticos y lectura segura',()=>{
  it('rechaza importes ambiguos o no verificables en moneda',()=>{
    expect(verifiedMxn('85.75')).toBe('85.75');
    expect(verifiedMxn('0')).toBe('0');
    expect(verifiedMxn('0.00')).toBe('0.00');
    for(const amount of [undefined,null,0,1,'NaN','Infinity','-10.00','1e3','1,000','1.234','01.20',' 15.00','123456789012345.00']){
      expect(verifiedMxn(amount)).toBeNull();
    }
    expect(formatVerifiedMxn(null)).toBe('No disponible');
    expect(formatVerifiedCents(null)).toBe('No disponible');
    expect(formatVerifiedCents(8500)).toContain('85');
    expect(verifiedCents(10.5)).toBeNull();
  });
  it('rechaza saldo de otro restaurante y evita confundir ingresos con fondos retirables',()=>{
    expect(parseRestaurantFinance({restaurant_id:99,gross_food_sales:'1000.00'},7)).toBeNull();
    const data=parseRestaurantFinance({
      restaurant_id:7,gross_food_sales:'1000.00',commission:'150.00',
      net_payable:'850.00',orders:20,payouts:[{id:9,amount:'300.00',status:'pending'}]
    },7);
    expect(data?.net_payable).toBe('850.00');
    expect(data?.payouts[0].status).toBe('pending');
    expect(parseRestaurantFinance({restaurant_id:7,net_payable:'Infinity'},7)?.net_payable).toBeNull();
    expect(wallet).toContain('No equivale a saldo bancario');
    expect(wallet).toContain('nunca se calculan a partir de ventas');
  });
  it('exige moneda MXN, origen verificado y coherencia monetaria entre cantidades',()=>{
    expect(parseWithdrawalBalance(balance)?.withdrawable_cents).toBe(10000);
    expect(parseWithdrawalBalance({...balance,currency:'USD'})).toBeNull();
    expect(parseWithdrawalBalance({...balance,source:'gross_sales'})).toBeNull();
    expect(parseWithdrawalBalance({...balance,withdrawable_cents:15000})).toBeNull();
    expect(parseWithdrawalBalance({...balance,provider_available_cents:100})).toBeNull();
    expect(parseWithdrawalBalance({...balance,already_requested_cents:20000})).toBeNull();
    expect(parseWithdrawalBalance({...balance,withdrawable_cents:'10000'})).toBeNull();
    expect(parseWithdrawalBalance({...balance,server_allows_requests:'true'})).toBeNull();
    expect(parseWithdrawalBalance({...balance,bank:{status:'verified',last4:'1234567890123'}})?.bank.last4).toBeUndefined();
  });
  it('lee historial de retiros sin inventar importes o exponer detalles bancarios',()=>{
    expect(parseWithdrawalHistory([{id:1,amount_cents:9900,currency:'MXN',status:'submitted',created_at:'2026-10-31'}])?.[0].amount_cents).toBe(9900);
    expect(parseWithdrawalHistory([{id:1,amount_cents:-1,currency:'MXN',status:'submitted',created_at:'2026-10-31'}])).toEqual([]);
    expect(parseWithdrawalHistory([{id:1,amount_cents:99,currency:'USD',status:'paid',created_at:'2026-10-31'}])).toEqual([]);
    expect(parseWithdrawalHistory({})).toBeNull();
    expect(parseConnectSummary({status:'verified',bank:{status:'verified'},can_withdraw:false})?.can_withdraw).toBe(false);
  });
  it('expone exclusivamente GET y mantiene bloqueada la solicitud de payout',()=>{
    for(const route of ['/owner/finance','/withdrawals/restaurant/']){
      expect(api).toContain(route);
    }
    expect(wallet).toContain('api.ownerFinance()');
    expect(wallet).toContain('api.merchantWithdrawalBalance(restaurantId)');
    expect(wallet).toContain('api.merchantWithdrawalHistory(restaurantId)');
    expect(wallet).toContain('api.merchantConnectStatus(restaurantId)');
    expect(wallet).not.toContain('merchantRequestWithdrawal(');
    expect(api).not.toContain('merchantRequestWithdrawal:');
    expect(api).not.toContain('ownerWalletAdjust:');
    expect(workspace).toContain("id:'wallet',label:'Wallet'");
    expect(workspace).toContain('<MerchantWallet restaurantId={restaurant?.id??null}/>');
    expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))');
  });
});
