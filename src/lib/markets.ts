/** Exact market codes from tala-eats-mobile Usuarios 1.0.46 local_markets.dart. */
export const MARKETS=[
 {code:'TALA-JAL',label:'Tala'},
 {code:'CUISILLOS-JAL',label:'Cuisillos'},
 {code:'AMECA-JAL',label:'Ameca'},
 {code:'AHUALULCO-JAL',label:'Ahualulco de Mercado'},
 {code:'TEQUILA-JAL',label:'Tequila'},
 {code:'AMATITAN-JAL',label:'Amatitán'}
] as const;
export type MarketCode=(typeof MARKETS)[number]['code'];
export const PILOT_MARKET:MarketCode='TALA-JAL';
export function isMarketCode(value:string):value is MarketCode{return MARKETS.some(m=>m.code===value);}
export function marketLabel(code:string):string{return MARKETS.find(m=>m.code===code)?.label??'Tala';}
export function verifyMarketPage(code:MarketCode,rows:unknown,seen:Set<number>):void{
 if(!Array.isArray(rows))throw new Error('El catálogo del servidor no es una lista.');
 for(const raw of rows){
  if(!raw||typeof raw!=='object')throw new Error('Catálogo inválido.');
  const row=raw as Record<string,unknown>;
  if(String(row.market_code??'').trim().toUpperCase()!==code)throw new Error('Este servidor todavía no separa los negocios por localidad.');
  const id=Number(row.id);
  if(!Number.isSafeInteger(id)||id<=0||seen.has(id))throw new Error('Catálogo duplicado o comercio sin identificador.');
  seen.add(id);
 }
}
