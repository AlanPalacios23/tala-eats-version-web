import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeDriverPlate,driverPlateIsValid,maskedDriverPlate} from '../src/lib/driver-registration';
import {api} from '../src/lib/api';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../src/App.tsx');
const pwa=read('../src/components/DriverPwaWorkflow.tsx');
const signup=read('../src/components/DriverRegistration.tsx');
const styles=read('../src/styles/driver-flutter.css');
afterEach(()=>vi.unstubAllGlobals());

describe('RC9.8 Driver Flutter parity and real onboarding',()=>{
 it('matches Flutter four-tab navigation, no customer checkout in driver shell',()=>{
  for(const t of ["key:'inicio',label:'Inicio'","key:'entregas',label:'Entregas'",
    "key:'ganancias',label:'Ganancias'","key:'perfil',label:'Perfil'"])expect(pwa).toContain(t);
  expect(pwa).toContain('df-bottom-nav');
  expect(pwa).toContain('api.driverDashboard()');
  expect(pwa).toContain('api.driverPresenceReadiness()');
  expect(pwa).toContain("const actionOptIn=import.meta.env.VITE_DRIVER_ACTIONS_ENABLED==='true'");
  expect(styles).toContain('--df-orange:#ff5a1f');
  expect(styles).toContain('--df-bg:#f8f7f5');
  expect(app).toContain('path="/repartidor/acceso"');
  expect(app).toContain('path="/repartidor/registro"');
  expect(app).toContain('<Protected role="driver"><Driver/></Protected>');
 });
 it('requires genuine plate for motorcycle and car but no plate for bicycle',()=>{
  expect(normalizeDriverPlate('ab-c 123x')).toBe('AB-C 123X');
  expect(driverPlateIsValid('Motocicleta','ABC-1234')).toBe(true);
  expect(driverPlateIsValid('Automóvil','ABC 1234')).toBe(true);
  expect(driverPlateIsValid('Motocicleta','')).toBe(false);
  expect(driverPlateIsValid('Automóvil','?')).toBe(false);
  expect(driverPlateIsValid('Bicicleta','')).toBe(true);
  expect(maskedDriverPlate('ABC-1234')).toBe('•••• 34');
  expect(signup).toContain("driverPlateIsValid(vehicle,normalized)");
  expect(signup).toContain('api.driverOnboardingCapabilities()');
  expect(signup).toContain('!cap||busy');
 });
 it('submits plate with vehicle only to genuine server-side application and never approves account itself',async()=>{
  const calls:Array<{path:string;method:string;body:Record<string,unknown>}>= [];
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
   const path=String(input).replace('/api/v1','');
   const method=init?.method??'GET';
   const body=init?.body?JSON.parse(String(init.body)):{};
   calls.push({path,method,body});
   const output=path==='/operations/onboarding-capabilities'?
     {driver_plate_supported:true,driver_documents_supported:true,driver_admin_approval_required:true}:
     {id:23,entity_type:'driver',status:'pending'};
   return new Response(JSON.stringify(output),{status:method==='POST'?201:200,headers:{'content-type':'application/json'}});
  }));
  const capabilities=await api.driverOnboardingCapabilities();
  expect(capabilities.driver_plate_supported).toBe(true);
  const application=await api.driverOnboardingSubmit('Motocicleta','ABC-1234',[]);
  expect(application.status).toBe('pending');
  expect(calls[0].path).toBe('/operations/onboarding-capabilities');
  expect(calls[1]).toEqual({path:'/operations/onboarding',method:'POST',body:{
   entity_type:'driver',business_name:'',tax_id:'',vehicle:'Motocicleta',plate:'ABC-1234',payout_account_ref:'',documents:[]}});
  expect(calls.some(c=>c.path.includes('driver/availability')||c.path.includes('stripe'))).toBe(false);
 });
 it('does not fake wallet, delivery PIN, payout or documents status',()=>{
  expect(pwa).toContain('Retiro no disponible');
  expect(pwa).toContain("dashboard?.today?");
  expect(pwa).toContain('api.driverComplete(o.id,pin[o.id]');
  expect(pwa).toContain('driverCanProgressExistingDelivery');
  expect(signup).toContain("application.status!=='pending'");
  expect(signup).toContain('await session.logout()');
 });
});
