import { describe,expect,it } from 'vitest';
import { MARKETS, PILOT_MARKET, isMarketCode, marketLabel, verifyMarketPage } from '../src/lib/markets';
describe('Flutter Usuarios 1.0.46 market isolation',()=>{
 it('uses the same exact markets as local_markets.dart',()=>{
  expect(PILOT_MARKET).toBe('TALA-JAL');
  expect(MARKETS.map(m=>m.code)).toEqual(['TALA-JAL','CUISILLOS-JAL','AMECA-JAL','AHUALULCO-JAL','TEQUILA-JAL','AMATITAN-JAL']);
  expect(marketLabel('AHUALULCO-JAL')).toBe('Ahualulco de Mercado');
  expect(isMarketCode('UNKNOWN')).toBe(false);
 });
 it('rejects legacy servers that omit market_code',()=>{
  expect(()=>verifyMarketPage(PILOT_MARKET,[{id:1,name:'Negocio'}],new Set())).toThrow(/separa/);
 });
 it('rejects mismatched city or duplicate restaurant ids',()=>{
  expect(()=>verifyMarketPage(PILOT_MARKET,[{id:1,market_code:'AMECA-JAL'}],new Set())).toThrow(/localidad/);
  expect(()=>verifyMarketPage(PILOT_MARKET,[{id:1,market_code:PILOT_MARKET},{id:1,market_code:PILOT_MARKET}],new Set())).toThrow(/duplicado/);
 });
 it('accepts market-scoped results across pages',()=>{
  const seen=new Set<number>();
  verifyMarketPage(PILOT_MARKET,[{id:1,market_code:PILOT_MARKET}],seen);
  verifyMarketPage(PILOT_MARKET,[{id:2,market_code:PILOT_MARKET}],seen);
  expect([...seen]).toEqual([1,2]);
 });
});
