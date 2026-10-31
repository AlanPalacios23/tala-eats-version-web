import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 linkedDriverTicketOrderId,verifiedDriverSupportCapability
} from '../src/lib/driver-support-capability';

const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=file('src/lib/api.ts');
const form=file('src/components/DriverSupportForm.tsx');
const workflow=file('src/components/DriverPwaWorkflow.tsx');
const history=file('src/components/DriverSupportHistory.tsx');

describe('RC153 driver linked support is fail-closed and server-authorised',()=>{
 it('rejects absent, stale, partial or non-boolean capability responses',()=>{
  expect(verifiedDriverSupportCapability(null)).toBeNull();
  expect(verifiedDriverSupportCapability({})).toBeNull();
  expect(verifiedDriverSupportCapability([])).toBeNull();
  expect(verifiedDriverSupportCapability({driver_ticket_enabled:true})).toBeNull();
  expect(verifiedDriverSupportCapability({driver_ticket_enabled:'true',driver_order_link_supported:true})).toBeNull();
  expect(verifiedDriverSupportCapability({driver_ticket_enabled:true,driver_order_link_supported:false})).toBeNull();
  expect(verifiedDriverSupportCapability({driver_ticket_enabled:true,driver_order_link_supported:true}))
   .toEqual({driver_ticket_enabled:true,driver_order_link_supported:true});
 });
 it('only links a positive integer active order ID after support is confirmed',()=>{
  expect(linkedDriverTicketOrderId(72,true)).toBe(72);
  expect(linkedDriverTicketOrderId(72,false)).toBeNull();
  expect(linkedDriverTicketOrderId(0,true)).toBeNull();
  expect(linkedDriverTicketOrderId(-1,true)).toBeNull();
  expect(linkedDriverTicketOrderId(7.5,true)).toBeNull();
  expect(linkedDriverTicketOrderId('72',true)).toBeNull();
  expect(linkedDriverTicketOrderId(null,true)).toBeNull();
 });
 it('does not write without authenticated capability, operator flag, network and valid input',()=>{
  expect(workflow).toContain("VITE_DRIVER_SUPPORT_ENABLED==='true'");
  expect(api).toContain("driverSupportCapabilities: () => request<unknown>('/platform/support/capabilities')");
  expect(form).toContain("api.driverSupportCapabilities().then(value=>");
  expect(form).toContain("verifiedDriverSupportCapability(value)!==null");
  expect(form).toContain('if(inFlight.current||busy||!allowed||!valid)return;');
  expect(form).toContain('const linkedOrderId=linkedDriverTicketOrderId(activeOrderId,allowed)');
  expect(form).toContain('api.createSupportTicket(category,description.trim(),linkedOrderId)');
  expect(form).toContain('result.user_id!==accountId||result.order_id!==linkedOrderId');
  expect(form).toContain('Soporte vinculado a pedidos no autorizado en este servidor');
  expect(form).not.toContain('api.driverStatus(');
  expect(form).not.toContain('api.driverComplete(');
  expect(form).not.toContain('localStorage');
 });
 it('exposes no other user tickets, confirms only the server-linked order',()=>{
  expect(form).toContain("key={ticketId??'initial'} accountId={accountId}");
  expect(form).toContain("capability&&<DriverSupportHistory");
  expect(history).toContain("item.user_id===accountId");
  expect(history).toContain("const visibleRows=rows.filter(item=>item.user_id===accountId)");
  expect(workflow).toContain('key={session.user?.id??"unknown"} activeOrderId=');
  expect(form).toContain('Ticket #{ticketId} confirmado por el servidor');
  expect(form).toContain('servicios de emergencia');
 });
});
