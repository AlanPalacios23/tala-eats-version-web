import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {driverTicketStatusLabel,verifiedTicketReply} from '../src/lib/driver-support-presentation';

const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const form=file('src/components/DriverSupportForm.tsx');
const history=file('src/components/DriverSupportHistory.tsx');
const api=file('src/lib/api.ts');
const css=file('src/styles/driver-operational-rc152.css');

describe('RC154 · Resiliencia de soporte y respuestas de seguimiento',()=>{
 it('presenta únicamente estados de ticket reconocidos sin afirmar una resolución inventada',()=>{
  expect(driverTicketStatusLabel('open')).toBe('Abierto');
  expect(driverTicketStatusLabel('in_progress')).toBe('En revisión');
  expect(driverTicketStatusLabel('resolved')).toBe('Atendido');
  expect(driverTicketStatusLabel('closed')).toBe('Cerrado');
  expect(driverTicketStatusLabel('other')).toBe('Registrado');
  expect(driverTicketStatusLabel(null)).toBe('Registrado');
 });
 it('solo presenta respuestas textuales verificables y de longitud acotada',()=>{
  expect(verifiedTicketReply('  En revisión  ')).toBe('En revisión');
  expect(verifiedTicketReply('')).toBeNull();
  expect(verifiedTicketReply('    ')).toBeNull();
  expect(verifiedTicketReply('x'.repeat(1201))).toBeNull();
  expect(verifiedTicketReply(null)).toBeNull();
  expect(verifiedTicketReply({html:'<div>'})).toBeNull();
  expect(history).toContain('verifiedTicketReply(item.admin_reply)');
  expect(history).toContain('driverTicketStatusLabel(item.status)');
  expect(history).toContain('item.user_id===accountId');
  expect(history).toContain('const visibleRows=rows.filter(item=>item.user_id===accountId)');
 });
 it('allows manually retrying capability check after temporary network or backend failure',()=>{
  expect(form).toContain('const [verifyRevision,setVerifyRevision]=useState(0)');
  expect(form).toContain('},[accountId,offline,verifyRevision]);');
  expect(form).toContain('setVerifyRevision(v=>v+1)');
  expect(form).toContain('if(inFlight.current||busy||!allowed||!valid)return;');
  expect(form).toContain("api.driverSupportCapabilities().then(value=>");
  expect(form).toContain('setCapability(verifiedDriverSupportCapability(value)!==null)');
  expect(form).toContain('Comprobar otra vez');
 });
 it('confirms the submitted order rather than a potentially newer active delivery',()=>{
  expect(form).toContain('const [confirmedOrderId,setConfirmedOrderId]=useState<number|null>(null)');
  expect(form).toContain('setConfirmedOrderId(linkedOrderId)');
  expect(form).toContain("result.user_id!==accountId||result.order_id!==linkedOrderId");
  expect(form).toContain("confirmedOrderId?' y vinculado a entrega #'+confirmedOrderId:''");
  expect(form).toContain('revisa Mis reportes antes de repetir la solicitud');
  expect(form).not.toContain('localStorage');
  expect(form).not.toContain('api.driverComplete(');
  expect(form).not.toContain('api.driverStatus(');
 });
 it('uses only account-bound server history, with accessible mobile controls',()=>{
  expect(api).toContain('admin_reply?:string');
  expect(api).toContain('responded_at?:string|null');
  expect(form).toContain('capability&&<DriverSupportHistory');
  expect(css).toContain('.df-app .df-support-recheck');
  expect(css).toContain('min-height:44px');
  expect(css).toContain('.df-app .df-driver-ticket-reply');
  expect(css).toContain(':focus-visible');
 });
});
