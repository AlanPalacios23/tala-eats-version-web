import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/components/DriverPwaWorkflow.tsx');
const registration=read('src/components/DriverRegistration.tsx');
const styles=read('src/styles/driver-flutter.css');

describe('RC141 Repartidores PWA: native experience without bypassing backend',()=>{
 it('shows available orders on Home only when dispatch is approved and no delivery is active',()=>{
  // RC142 replaced the two static Home cards with a live, server-gated map.
  expect(app).toContain("{online&&<DriverLiveMap");
  expect(app).toContain("eligible={actions&&!active}");
  expect(app).toContain("offers={active?[]:available}");
  expect(app).toContain("api.driverAccept(order.id)");
  expect(app).toContain("driverActionsAvailable(readiness,actionOptIn)");
  expect(app).toContain("driverCanProgressExistingDelivery(readiness,actionOptIn)");
  expect(app).toContain("canSubmitDelivery(order,pin[order.id]??'',cashReceived[order.id]===true)");
  expect(app).not.toContain('mockDriverOffers');
 });
 it('keeps meaningful operation errors across background refresh and GPS heartbeat',()=>{
  expect(app).not.toContain("setMine(jobs);setAvailable([]);setOffersError(false);setError('')");
  expect(app).toContain("setError(old=>old||failure(e))");
  expect(app).toContain("setReadiness(next); /* GPS success must not erase unrelated failed writes. */");
  expect(app).toContain("window.addEventListener('offline',updateConnection)");
  expect(app).toContain("window.addEventListener('online',updateConnection)");
  expect(app).toContain("onClick={()=>void manualRefresh()}");
  expect(app).toContain("if(document.visibilityState==='visible'");
 });
 it('native sheets remain keyboard accessible; no PIN or proof stored on device',()=>{
  expect(app).toContain("profileSheetClose.current?.focus()");
  expect(app).toContain("event.key==='Escape'");
  expect(app).toContain("event.key==='Tab'");
  expect(app).toContain("proofInput.current?.focus()");
  expect(app).toContain("document.body.style.overflow='hidden'");
  expect(app).toContain("aria-modal=\"true\"");
  expect(app).not.toContain('localStorage.setItem');
 });
 it('validates selected documents before submission and revokes photo previews',()=>{
  expect(registration).toContain('const issue=onboardingSelectionError(next)');
  expect(registration).toContain("setDocuments([]);e.currentTarget.value='';setError(issue)");
  expect(registration).toContain('URL.createObjectURL(file)');
  expect(registration).toContain('URL.revokeObjectURL(item.url)');
  expect(registration).toContain('prepareOnboardingDocuments(documents)');
  expect(registration).toContain('api.driverOnboardingDocument(file)');
  expect(registration).toContain('<DriverDocumentPreviews files={documents}/>');
 });
 it('isolates animations to driver styles and respects reduced motion and safe areas',()=>{
  expect(styles).toContain('.df-home-offers');
  expect(styles).toContain('.df-network-banner');
  expect(styles).toContain('df-screen-arrive');
  expect(styles).toContain('df-sheet-enter');
  expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
  expect(styles).toContain('env(safe-area-inset-bottom)');
 });
});
