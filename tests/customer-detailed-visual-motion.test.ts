import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const ui=read('../src/customer/CustomerExperience.tsx');
const panels=read('../src/customer/CustomerPanels.tsx');
const css=read('../src/customer/customer-more.css');
const app=read('../src/App.tsx');
const auth=read('../src/customer/CustomerAuth.tsx');
const startup=read('../src/customer/CustomerStartup.tsx');
describe('Flutter Usuarios detailed visual and motion parity',()=>{
 it('brings Flutter 140/200/300/320/420ms motion and honors reduce motion',()=>{
   expect(css).toContain('140ms cubic-bezier');
   expect(css).toContain('200ms ease');
   expect(css).toContain('300ms cubic-bezier');
   expect(css).toContain('320ms cubic-bezier');
   expect(css).toContain('420ms cubic-bezier');
   expect(css).toContain('@media(prefers-reduced-motion:reduce)');
   expect(css).toContain('te-heart-pop');
   expect(ui).toContain("Math.min(index,7)*45+'ms'");
 });
 it('implements restaurant Flutter header, menu categories and real backend gating',()=>{
   expect(app).toContain('te-commerce-hero');
   expect(app).toContain('te-commerce-categories');
   expect(app).toContain('te-commerce-dishes');
   expect(app).toContain('!r.is_open||!r.pickup_enabled||!product.is_available||product.stock<=0');
   expect(app).toContain('safeImage(product.image_url)');
   expect(css).toContain('.te-commerce-content');
   expect(css).toContain('border-radius:24px 24px 0 0');
 });
 it('ports auth scaffold while keeping login and signup API untouched',()=>{
   expect(auth).toContain('te-customer-auth te-motion-page');
   expect(auth).toContain('await session.register(name.trim(),email.trim(),password)');
   expect(auth).toContain('await session.login(email.trim(),password,otp)');
   expect(auth).toContain("type={showPassword?'text':'password'}");
   expect(css).toContain('background:linear-gradient(180deg,#fff4ec');
   expect(css).toContain('.te-auth-glow');
 });
 it('shows order timelines and customer account without inventing wallet backend',()=>{
   expect(panels).toContain('api.myOrders()');
   expect(panels).toContain('te-order-steps');
   expect(panels).toContain('PIN de entrega');
   expect(panels).toContain('Consulta de saldo y puntos: no disponible');
   expect(panels).toContain('localStorage.getItem');
   expect(panels).not.toContain('api.placeCashPickup');
 });
 it('keeps live stripe/checkout logic in original route and isolates other roles',()=>{
   expect(app).toContain('api.placeCashPickup');
   expect(app).toContain('api.byReference');
   expect(app).toContain('disabled={busy||!canCheckout}');
   expect(app).toContain('path="/restaurante" element={<Protected role="restaurant">');
   expect(app).toContain('path="/repartidor" element={<Protected role="driver">');
   expect(app).toContain('isCustomerTab&&<CustomerDock/>');
 });
});
