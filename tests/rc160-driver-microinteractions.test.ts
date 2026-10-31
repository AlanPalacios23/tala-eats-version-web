import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const code=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=code('src/components/DriverPwaWorkflow.tsx');
const map=code('src/components/DriverLiveMap.tsx');
const style=code('src/styles/driver-motion-rc160.css');

describe('RC160 — Tala Eats courier visual motion, no misleading activity',()=>{
 it('loads final visual layer only in the courier workflow and keeps its selectors scoped',()=>{
  expect(home).toContain("import '../styles/driver-motion-rc160.css'");
  expect(style).toContain('.df-app{');
  expect(style).toContain('.dm-immersive{');
  expect(style).not.toMatch(/(^|\n)\s*(?:body|html|\*)\s*\{/);
  expect(style).not.toContain('.customer-');
  expect(style).not.toContain('.restaurant-');
  expect(style).not.toContain('url(');
  expect(style).not.toContain('position:fixed');
 });
 it('animates verified availability, not an assumed operational approval',()=>{
  expect(style).toContain('.df-app .df-availability.is-online');
  expect(style).toContain('.df-app .df-status-dot.active');
  expect(style).toContain('@keyframes df160-online-breath');
  expect(map).toContain("offline?'SIN RED':'EN LÍNEA'");
  expect(style).toContain('.dm-immersive .dm-online-pill.is-disconnected');
  expect(style).toContain('.dm-immersive .dm-online-pill.is-disconnected .dm-live-dot');
  expect(style).toContain('animation:none;');
  expect(home).toContain('const actions=driverActionsAvailable(readiness,actionOptIn)');
  expect(home).toContain("const reachable=verifiedOnlinePresence(readiness);");
 });
 it('visual feedback is tied to actual server-authorised offers and real merchant map markers',()=>{
  expect(map).toContain("const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)");
  expect(map).toContain("const markers=useMemo(()=>driverOfferMarkers(readyOffers,catalog)");
  expect(map).toContain("className:chosen?'dm-map-marker-selected':'dm-map-marker'");
  expect(map).toContain('<article key={selected.id} className="dm-offer"');
  expect(style).toContain('.dm-immersive .dm-map-marker-selected');
  expect(style).toContain('@keyframes dm160-card-reveal');
  expect(map).toContain('onClick={()=>onAccept(selected)}');
  expect(map).not.toContain('mockDriverOffers');
  expect(map).not.toContain('api.driverReject(');
 });
 it('preserves action guards, delivery proof and account isolation',()=>{
  expect(home).toContain('disabled={homeAction.disabled} onClick={homeAction.press}');
  expect(home).toContain("return <DriverPwaWorkflowSession key={session.user?.id??'signed-out'}/>");
  expect(home).toContain('canSubmitDelivery(active,pin[active.id]??');
  expect(home).toContain('api.driverComplete(order.id');
  expect(home).not.toContain('STRIPE_SECRET_KEY');
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('customer.address');
 });
 it('honors reduced motion and makes no infinite animations of cards, menus or financial values',()=>{
  expect(style).toContain('@media(prefers-reduced-motion:reduce)');
  expect(style).toContain('.dm-immersive .dm-map-marker-selected');
  expect(style).toContain('.df-app .df-floating-status');
  expect(style).toContain('animation:none!important');
  expect(style).toContain('transition:none!important');
  expect(style).toContain('transform:none!important');
  expect(style).toContain('@media(max-width:370px)');
  expect(style).toContain('@media(hover:hover) and (pointer:fine)');
  expect(style).toContain('@keyframes dm160-options-in');
  expect(style).toContain('@keyframes df160-details-reveal');
  expect(style).not.toMatch(/\.dm-offer\s*\{[^}]*infinite/s);
  expect(style).not.toMatch(/\.df-week-bar[^}]*infinite/s);
 });
});
