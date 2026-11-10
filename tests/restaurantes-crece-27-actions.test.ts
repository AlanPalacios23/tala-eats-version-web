import {describe,expect,it} from 'vitest';
import {CRECE_BENEFITS} from '../src/merchant/creceContracts';
import {CRECE_ACTIONS,creceDraftText,officialAssistanceLink,
 unassignedCreceActions} from '../src/merchant/creceTools';

describe('Tala Eats Crece RC174: 27 benefit actions',()=>{
 it('every existing benefit has an intentional, non-inert action and one canonical ID',()=>{
  expect(CRECE_BENEFITS).toHaveLength(27);
  expect(unassignedCreceActions()).toEqual([]);
  expect(new Set(CRECE_BENEFITS.map(x=>x.id)).size).toBe(27);
  for(const item of CRECE_BENEFITS){
   const action=CRECE_ACTIONS[item.id];
   expect(action?.label.length,item.id).toBeGreaterThan(5);
   expect(['navigate','section','assisted','share','draft']).toContain(action.kind);
   if(item.state==='planeado')expect(action.kind).toBe('draft');
  }
 });
 it('official assistance is optional and never invented without configured phone',()=>{
  expect(officialAssistanceLink(undefined,'fotos','Comedor Tala')).toBeNull();
  expect(officialAssistanceLink('5213312345678','inventario','Comedor Tala')).toBeNull();
  expect(officialAssistanceLink('https://wa.me/1','fotos','Comedor Tala')).toBeNull();
  const link=officialAssistanceLink('5213312345678','fotos','Comedor Tala');
  expect(link).toContain('wa.me/5213312345678');
  expect(decodeURIComponent(link??'')).toContain('Fotografías de productos');
  expect(decodeURIComponent(link??'')).toContain('requiere confirmación');
 });
 it('future features and launch kit yield usable local drafts but NEVER a real checkout promise',()=>{
  for(const id of ['kit','cupones','temporadas','programados','combos',
   'sucursales','fidelidad','empresas','calidad']){
   const text=creceDraftText({
    benefitId:id,storeName:'Restaurante Antojitos',storeId:92,
    menu:[{id:1,restaurant_id:92,name:'Torta ahogada',
     price:'89.00',stock:12,is_available:true}]
   });
   expect(text).toContain('Comercio: Restaurante Antojitos');
   expect(text).toContain('NO PUBLICADO');
   expect(text).toContain('Torta ahogada');
   expect(text).not.toContain('Plaza aprobada');
  }
 });
 it('only exposes verified store URL in the kit; invalid IDs do not export',()=>{
  expect(creceDraftText({
   benefitId:'kit',storeName:'Tortas de Tala',storeId:1
  })).toContain('Enlace público no verificado');
  expect(creceDraftText({
   benefitId:'kit',storeName:'Tortas de Tala',storeId:1,
   storefrontUrl:'https://clientes.test/comercio/1'
  })).toContain('https://clientes.test/comercio/1');
  expect(creceDraftText({
   benefitId:'kit',storeName:'Tortas de Tala',storeId:0
  })).toBeNull();
  expect(creceDraftText({
   benefitId:'pedidos',storeName:'Tortas de Tala',storeId:1
  })).toBeNull();
 });
});
