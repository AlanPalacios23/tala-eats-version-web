import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {freshAuthorisedOfferIds,safeDriverPerformanceSummary} from '../src/lib/driver-operations-core';
const text=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=text('src/components/DriverPwaWorkflow.tsx');
const alerts=text('src/components/DriverOfferAttention.tsx');
const support=text('src/components/DriverSupportForm.tsx');
const map=text('src/components/DriverLiveMap.tsx');
const css=text('src/styles/driver-operations-rc151.css');

describe('RC151 · driver real operations and support boundaries',()=>{
 it('notifies only previously unseen server-offer identifiers, not on initial sync',()=>{
  expect(freshAuthorisedOfferIds([11,12],null,true)).toEqual([]);
  expect(freshAuthorisedOfferIds([11,12],new Set([11]),true)).toEqual([12]);
  expect(freshAuthorisedOfferIds([11,12],new Set([11,12]),true)).toEqual([]);
  expect(freshAuthorisedOfferIds([11,12],new Set([11]),false)).toEqual([]);
  expect(freshAuthorisedOfferIds([-1,0,1,1.5],new Set(),true)).toEqual([1]);
  expect(alerts).toContain('const [enabled,setEnabled]=useState(false)');
  expect(alerts).toContain('const [latest,setLatest]=useState<number|null>(null)');
  expect(alerts).toContain('wasEligible.current=active');
  expect(alerts).toContain("if(!continuous||!previous)return");
  expect(alerts).toContain("document.visibilityState==='visible'");
  expect(alerts).toContain("navigator.vibrate?.(90)");
  expect(alerts).not.toContain('Notification.requestPermission(');
  expect(alerts).not.toContain('setInterval(');
  expect(alerts).not.toContain('localStorage');
 });
 it('shows notifications within the existing authorised map offer surface',()=>{
  expect(map).toContain('offers={readyOffers} eligible={eligible} offline={offline}');
  expect(map).toContain("const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)");
  expect(map).toContain('onClick={()=>onAccept(selected)}');
  expect(map).not.toContain('api.driverReject(');
  expect(map).not.toContain('api.driverLocation(');
 });
 it('validates backed seven-day stats and rejects invalid or fabricated performance',()=>{
  expect(safeDriverPerformanceSummary(null)).toBeNull();
  expect(safeDriverPerformanceSummary([])).toBeNull();
  expect(safeDriverPerformanceSummary([{date:'2026-10-30',deliveries:2,earnings:70},{date:'2026-10-29',deliveries:0,earnings:0}]))
   .toEqual({deliveries:2,activeDays:1,days:2});
  expect(safeDriverPerformanceSummary([{date:'2026-10-30',deliveries:-1}])).toBeNull();
  expect(safeDriverPerformanceSummary([{date:'2026-10-30',deliveries:1.5}])).toBeNull();
  expect(safeDriverPerformanceSummary(Array.from({length:8},()=>({date:'2026-10-30',deliveries:1})))).toBeNull();
  expect(safeDriverPerformanceSummary([{date:'today',deliveries:1}])).toBeNull();
  expect(main).toContain('safeDriverPerformanceSummary(dashboard?.last_7_days)');
  expect(main).toContain('no representan saldo disponible para retiro');
  expect(main).toContain('<FinanceWeeklyPreview key={session.user?.id??"unknown"} kind="driver" actorId={session.user?.id}/>');
  expect(main).toContain('<DriverCashHandoff orders={delivered}/>');
 });
 it('uses authenticated support only with explicit driver permission flag; avoids unsafe order binding',()=>{
  expect(main).toContain("const driverSupportEnabled=import.meta.env.VITE_DRIVER_SUPPORT_ENABLED==='true'");
  expect(main).toContain('driverSupportEnabled&&<button');
  expect(main).toContain("driverSupportEnabled?\n      <DriverSupportForm");
  expect(support).toContain('api.createSupportTicket(category,message,null)');
  expect(support).toContain('Number.isSafeInteger(result?.id)');
  expect(support).toContain('setTicketId(result.id)');
  expect(support).toContain('if(inFlight.current||busy||offline||!valid)return;');
  expect(support).toContain('no se vincula automáticamente'); // guard informative notice
  expect(support).not.toContain('localStorage');
  expect(support).not.toContain('api.driverComplete(');
  expect(support).not.toContain('api.driverStatus(');
 });
 it('keeps keyboard access to ticket fields and emergency advice',()=>{
  expect(main).toContain("'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'");
  expect(main).toContain("event.shiftKey&&document.activeElement===first");
  expect(support).toContain('htmlFor="df-support-category"');
  expect(support).toContain('htmlFor="df-support-description"');
  expect(support).toContain('maxLength={1200}');
  expect(support).toContain('servicios de emergencia');
  expect(css).toContain('.df-app .df-driver-support textarea:focus-visible');
  expect(css).toContain('.dm-immersive .dm-attention-toggle');
  expect(css).toContain('@media(max-width:350px)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 });
});
