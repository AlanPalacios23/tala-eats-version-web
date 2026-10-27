import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

// Guards for merchant production operations. All these assertions are independent
// of LIVE credentials, financial writes and the browser rendering snapshots.
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../src/components/RestaurantApp.tsx');
const wallet=read('../src/components/MerchantWallet.tsx');
const kitchen=read('../src/components/RestaurantParity.tsx');

describe('Restaurant web release: fail-closed operations and consistent UX',()=>{
 it('rejects other restaurant orders and invalidates previous merchant financial data',()=>{
  expect(app).toContain("o.some(order=>order.restaurant_id!==r.id)");
  expect(app).toContain("currentRestaurantId.current!==r.id");
  expect(app).toContain("setStats(null);setFinance(null);setConnect(null)");
  expect(app).toContain("setPins({});setCashConfirmed({})");
  expect(wallet).toContain("earnings?.restaurant_id===restaurantId");
  expect(wallet).toContain("finance?.restaurant_id===restaurantId");
  expect(wallet).toContain("verifiedFinance.payouts.map");
 });
 it('does not silently erase the reason for a failed write after refreshing',()=>{
  expect(app).toContain("await refresh();setError(reason);return false");
  expect(app).not.toContain("setError(e instanceof Error?e.message:'La operación no pudo confirmarse en el servidor.');await refresh()");
 });
 it('never truncates selected legal documents silently or traps the user in loading',()=>{
  expect(app).toContain('if(files.length>3)');
  expect(app).toContain('Selecciona como máximo 3 documentos.');
  expect(app).not.toContain("Array.from(e.target.files??[]).slice(0,3)");
  expect(app).toContain('Reintentar consulta');
  expect(app).toContain("if(!Array.isArray(data))");
 });
 it('prevents competing availability editors and clarifies cash delivery',()=>{
  expect(app).toContain('role="switch" checked={item.is_available} disabled={busy||editing}');
  expect(app).toContain("o.order_type==='pickup'?'Efectivo · cobro al recoger':'Efectivo · cobro en entrega'");
  expect(kitchen).toContain("o.order_type==='pickup'?'Efectivo · cobrar al recoger':'Efectivo · cobro en entrega'");
  expect(app).toContain('Descripción<textarea maxLength={1000}');
 });
 it('keeps bank withdrawal execution entirely on the server',()=>{
  expect(wallet).toContain('Saldo retirable confirmado');
  expect(wallet).toContain('No se ha creado ninguna solicitud');
  expect(wallet).not.toMatch(/api\.[A-Za-z]*(Withdraw|Transfer|Payout)/);
 });
});
