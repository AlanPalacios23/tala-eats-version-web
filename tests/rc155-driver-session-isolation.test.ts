import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflow=read('src/components/DriverPwaWorkflow.tsx');
const notifications=read('src/components/DriverOfferAttention.tsx');
const support=read('src/components/DriverSupportForm.tsx');
const cash=read('src/components/CashHandoffV2.tsx');
const finance=read('src/components/FinanceWeeklyPreview.tsx');
const map=read('src/components/DriverLiveMap.tsx');

describe('RC155: account-scoped Repartidores PWA state',()=>{
 it('remounts the entire courier workflow on user-id change instead of only ticket and wallet children',()=>{
  expect(workflow).toContain('export function DriverPwaWorkflow(){');
  expect(workflow).toContain('return <DriverPwaWorkflowSession key={session.user?.id??\'signed-out\'}/>');
  expect(workflow).toContain('function DriverPwaWorkflowSession(){');
  expect(workflow).toContain('const session=useSession();');
 });
 it('the keyed subtree owns private PIN, cash checkboxes, map and ticket state',()=>{
  const start=workflow.indexOf('function DriverPwaWorkflowSession(){');
  expect(start).toBeGreaterThan(0);
  const scope=workflow.slice(start);
  for(const code of [
   "const [pin,setPin]=useState<Record<number,string>>({});",
   "const [cashReceived,setCashReceived]=useState<Record<number,boolean>>({});",
   "const [available,setAvailable]=useState<Order[]>([]);",
   "const [mine,setMine]=useState<Order[]>([]);",
   "const [readiness,setReadiness]=useState<DriverPresenceReadiness|null>(null);",
   "const [dashboard,setDashboard]=useState<DriverDash|null>(null);",
   "const [mapOpen,setMapOpen]=useState(false);",
   "const [sheet,setSheet]=",
   "<DriverSupportForm key={session.user?.id??\"unknown\"}",
   "<FinanceWeeklyPreview key={session.user?.id??\"unknown\"}"
  ])expect(scope).toContain(code);
 });
 it('unmount invalidates stale asynchronous user-specific polling and GPS UI responses',()=>{
  expect(workflow).toContain('const version=++refreshVersion.current');
  expect(workflow).toContain('if(!mounted.current||version!==refreshVersion.current)return');
  expect(workflow).toContain('mounted.current=false;refreshVersion.current++;window.clearInterval(interval);');
  expect(workflow).toContain('if(mounted.current){setReadiness(next);');
  expect(workflow).toContain("if(data.user?.id!==session.user?.id)throw new Error('Resumen no autorizado')");
  expect(workflow).toContain('const operationsBlocked=browserOffline||busy');
 });
 it('prevents cross-account customer exposure via map, notifications, support and finance',()=>{
  expect(map).toContain('const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)');
  expect(notifications).toContain('const [enabled,setEnabled]=useState(false)');
  expect(support).toContain('result.user_id!==accountId||result.order_id!==linkedOrderId');
  expect(support).toContain('const [capability,setCapability]=useState(false)');
  expect(finance).toContain('},[kind,restaurantId,actorId]);');
  expect(cash).not.toContain('STRIPE_SECRET_KEY');
 });
});
