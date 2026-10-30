import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('src/components/DriverPwaWorkflow.tsx');
const map=read('src/components/DriverLiveMap.tsx');
const css=read('src/styles/driver-trip-rc148.css');
const journey=read('src/lib/driver-journey-ux.ts');
const profile=workflow.split("{tab==='perfil'&&<>")[1]?.split("{(error||message)&&")[0]??'';

describe('RC148: regresar a la entrega y actualizar el mapa sin cambios bruscos',()=>{
 it('mantiene acceso persistente a la entrega real desde otras pestañas',()=>{
  expect(workflow).toContain("const active=mine.find(deliveryInProgress)??null;");
  expect(workflow).toContain('const activeStage=driverJourneyStage(active?.status);');
  expect(workflow).toContain("{active&&tab!=='inicio'&&activeStage&&<button type=\"button\"");
  expect(workflow).toContain("aria-label={'Volver al seguimiento del pedido '+active.id}");
  expect(workflow).toContain("onClick={()=>onTab('inicio')}");
  expect(workflow).toContain('className="df-active-trip-return"');
  expect(workflow).toContain('activeStage.title');
  expect(workflow).toContain("label:'Inicio'");
  expect(workflow).toContain("label:'Entregas'");
  expect(workflow).toContain("label:'Ganancias'");
  expect(profile).toContain('df-avatar-edit');
  expect(journey).toContain("case 'assigned':");
  expect(journey).toContain("case 'picked_up':");
  expect(journey).toContain("case 'on_the_way':");
 });
 it('devuelve el foco al cerrar PIN manualmente sin guardarlo en el dispositivo',()=>{
  expect(workflow).toContain('const proofReturnFocus=useRef<HTMLElement|null>(null)');
  expect(workflow).toContain('proofReturnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null');
  expect(workflow).toContain('if(previous?.isConnected)previous.focus()');
  expect(workflow).toContain('},[proofSheet]);');
  expect(workflow).toContain('setPin({});');
  expect(workflow).toContain("document.body.style.overflow='hidden'");
  expect(workflow).toContain('aria-modal="true" aria-labelledby="df-proof-title"');
 });
 it('muestra estado de actualización real en mapa y bloquea doble refresh',()=>{
  expect(workflow).toContain('refreshing={refreshing}');
  expect(map).toContain('refreshing:boolean;');
  expect(map).toContain('disabled={busy||offline||refreshing} aria-busy={refreshing}');
  expect(map).toContain("refreshing?'Actualizando pedidos…':'Actualizar pedidos'");
  expect(map).toContain("className={refreshing?'dm-refresh-icon is-refreshing':undefined}");
  expect(map).toContain('onClick={onRefresh}');
  expect(map).toContain("offline?'SIN RED':'EN LÍNEA'");
 });
 it('solo estiliza repartidor y conserva accesibilidad en pantallas pequeñas',()=>{
  expect(workflow).toContain("import '../styles/driver-trip-rc148.css'");
  expect(css).toContain('.df-app .df-active-trip-return');
  expect(css).toContain('.dm-immersive .dm-refresh-button[aria-busy="true"]');
  expect(css).toContain('.df-app .df-active-trip-return:focus-visible');
  expect(css).toContain('@media(max-width:350px)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).toContain('.dm-immersive .dm-refresh-icon.is-refreshing{animation:none!important}');
  expect(css).not.toContain('.customer');
  expect(css).not.toContain('.restaurant');
 });
 it('preserva acciones autorizadas del backend; sin botones simulados de cobro',()=>{
  expect(workflow).toContain('api.driverAccept(order.id)');
  expect(workflow).toContain("api.driverStatus(active.id,'picked_up')");
  expect(workflow).toContain("api.driverStatus(active.id,'on_the_way')");
  expect(workflow).toContain('api.driverComplete(order.id');
  expect(workflow).toContain('api.driverPresenceReadiness()');
  expect(workflow).not.toContain('mockDriverOrders');
  expect(map).not.toContain('api.driverReject(');
 });
});
