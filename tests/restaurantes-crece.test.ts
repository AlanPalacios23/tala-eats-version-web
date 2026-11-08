import {describe,expect,it} from 'vitest';
import {
 CRECE_BENEFITS,CRECE_PILLARS,FOUNDERS_OFFER,creceAdvice,storefrontLink,
 verifiedPublicStorefront,merchantProfileChecklist
} from '../src/merchant/creceContracts';

describe('Tala Eats Crece — contract',()=>{
 it('has unique benefit IDs, five pillars and no speculative benefits marked as operational',()=>{
  expect(CRECE_PILLARS).toHaveLength(5);
  expect(CRECE_BENEFITS.length).toBeGreaterThanOrEqual(25);
  expect(new Set(CRECE_BENEFITS.map(b=>b.id)).size).toBe(CRECE_BENEFITS.length);
  for(const b of CRECE_BENEFITS){
   expect(CRECE_PILLARS.some(p=>p.id===b.pillar)).toBe(true);
   expect([1,2,3]).toContain(b.phase);
   expect(['disponible','asistido','planeado']).toContain(b.state);
  }
  for(const key of ['fidelidad','cupones','programados','sucursales','empresas']){
   expect(CRECE_BENEFITS.find(b=>b.id===key)?.state).toBe('planeado');
  }
 });
 it('preserves approved commercial policy and honest pilot limits',()=>{
  expect(FOUNDERS_OFFER.capacity).toBe(10);
  expect(FOUNDERS_OFFER.merchantCommissionBps).toBe(1700);
  expect(FOUNDERS_OFFER.customerServiceBps).toBe(700);
  expect(FOUNDERS_OFFER.monthlyFeeMinor).toBe(0);
  expect(FOUNDERS_OFFER.mandatoryExclusivity).toBe(false);
  expect(FOUNDERS_OFFER.guaranteedSales).toBe(false);
 });
 it('never fabricates metrics and refuses invalid historic totals',()=>{
  expect(creceAdvice(null)).toEqual([]);
  expect(creceAdvice({orders:2,delivered:4,inventory_low:0})).toEqual([]);
  expect(creceAdvice({orders:NaN,delivered:0,inventory_low:0})).toEqual([]);
  expect(creceAdvice({orders:0,delivered:0,inventory_low:0}).map(x=>x.id)).toEqual(['primeros']);
  expect(creceAdvice({orders:20,delivered:10,inventory_low:3}).map(x=>x.id)).toEqual(['stock','pedidos']);
  expect(creceAdvice({orders:10,delivered:10,inventory_low:0}).map(x=>x.id)).toEqual(['consistencia']);
 });
 it('never trusts a private merchant ID or domain without BOTH public API confirmations',()=>{
  const owner={id:42};
  const list=[{id:42,name:'Comercio autorizado'}];
  const detail={id:42,name:'Comercio autorizado'};
  expect(verifiedPublicStorefront(owner,list,detail)).toBe(true);
  expect(verifiedPublicStorefront(owner,list,{id:43,name:'Otro'})).toBe(false);
  expect(verifiedPublicStorefront(owner,[{id:43}],detail)).toBe(false);
  expect(verifiedPublicStorefront(owner,[],detail)).toBe(false);
  expect(verifiedPublicStorefront(owner,list,{id:42,name:''})).toBe(false);
  expect(verifiedPublicStorefront(null,list,detail)).toBe(false);
  expect(verifiedPublicStorefront(owner,{data:list},detail)).toBe(false);
  expect(verifiedPublicStorefront(owner,list,'42')).toBe(false);
 });
 it('profile checklist only uses actual merchant catalog fields and verified publication',()=>{
  expect(merchantProfileChecklist(null,false)).toEqual([]);
  const owner={
    id:42,name:'Mi restaurante',address:'Tala, Jalisco',
    cover_image_url:'https://cdn.example.mx/foto.jpg',
    menu_items:[{is_available:true,stock:15}]
  };
  const first=merchantProfileChecklist(owner,false);
  expect(first).toHaveLength(5);
  expect(first.map(x=>x.done)).toEqual([true,true,true,true,false]);
  expect(merchantProfileChecklist(owner,true).every(x=>x.done)).toBe(true);
  expect(merchantProfileChecklist({
    ...owner,menu_items:[{is_available:true,stock:0}],
    cover_image_url:null,address:''
  },false).filter(x=>x.done).map(x=>x.id)).toEqual(['profile']);
 });
 it('only builds a store QR destination from verified HTTPS origin and integer ID',()=>{
  expect(storefrontLink(12,'https://clientes.example.mx/')).toBe('https://clientes.example.mx/comercio/12');
  expect(storefrontLink(3,'https://clientes.example.mx/v1/')).toBeNull();
  expect(storefrontLink(3,'http://clientes.example.mx/')).toBeNull();
  expect(storefrontLink(3,'https://evil:secret@clientes.example.mx/')).toBeNull();
  expect(storefrontLink(3,'https://clientes.example.mx/?token=abc')).toBeNull();
  expect(storefrontLink(3,'javascript:alert(1)')).toBeNull();
  expect(storefrontLink(0,'https://clientes.example.mx')).toBeNull();
  expect(storefrontLink('3','https://clientes.example.mx')).toBeNull();
  expect(storefrontLink(9,undefined)).toBeNull();
 });
});
