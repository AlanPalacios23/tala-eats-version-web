import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const src=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=src('../src/components/RestaurantApp.tsx');
const more=src('../src/components/RestaurantParity.tsx');

describe('Restaurantes Web: auditoría de fallos de producción sin escrituras LIVE',()=>{
 it('never claims a successful operation if refreshing its server snapshot failed',()=>{
  expect(app).toContain('const refresh=useCallback(async():Promise<boolean>=>{');
  expect(app).toContain('const verified=await refresh();');
  expect(app).toContain('if(!verified){');
  expect(app).toContain('La operación fue enviada, pero no pudimos verificar');
  expect(app).toContain('setNotice(message);');
  expect(app).not.toContain('setNotice(message);await refresh();return true;');
 });
 it('removes stale order identity, finances and active flags after a backend error',()=>{
  expect(app).toContain('currentRestaurantId.current=null;');
  expect(app).toContain('setRestaurant(null);setOrders([]);setStats(null);setFinance(null);setConnect(null)');
  expect(app).toContain('setPins({});setCashConfirmed({});setLastSync(null);setNotice(\'\');');
  expect(app).toContain('setSyncHealthy(false);');
 });
 it('isolates native view form state by restaurant identity',()=>{
  for(const component of ['MerchantMore','MerchantMenu','MerchantKitchen','MerchantWallet'])
   expect(app).toContain('<'+component+' key={restaurant.id}');
 });
 it('saves cleared address and GPS explicitly, not as an invisible no-op',()=>{
  expect(more).toContain('address:address.trim()');
  expect(more).toContain('{lat:null,lng:null}');
  expect(more).toContain('¿Quitar el punto GPS del restaurante?');
  expect(more).toContain('setLocationError(\'Verifica el nombre, la dirección');
 });
 it('resets uploaded photo selection to allow choosing the same file again',()=>{
  expect(more).toContain('coverInput.current.value=\'\'');
  expect(app).toContain('photoInput.current.value=\'\'');
 });
});
