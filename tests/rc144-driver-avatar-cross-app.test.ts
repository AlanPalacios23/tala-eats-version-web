import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {trustedDriverAvatarUrl} from '../src/lib/driver-avatar';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/components/DriverPwaWorkflow.tsx');
const api=read('src/lib/api.ts');
const types=read('src/lib/types.ts');
const customer=read('src/components/CustomerOrders.tsx');
const restaurant=read('src/components/RestaurantParity.tsx');
const restaurantOrders=read('src/components/RestaurantApp.tsx');
const identity=read('src/components/DriverIdentity.tsx');
const css=read('src/styles/driver-avatar-rc144.css');
const key='a'.repeat(40);
describe('RC144 persistent courier profile image',()=>{
 it('only renders same-origin, unguessable immutable backend photos',()=>{
  expect(trustedDriverAvatarUrl('/api/v1/driver/avatar/'+key+'.webp')).toBe('/api/v1/driver/avatar/'+key+'.webp');
  for(const bad of ['https://evil.example/image.webp','//evil.example','javascript:alert(1)',
   '/api/v1/driver/avatar/'+key+'.svg','/api/v1/driver/avatar/../../etc/passwd',
   '/api/v1/driver/avatar/'+key+'.webp?x=1','/api/v1/uploads/onboarding-document/u99-123.jpg'])
   expect(trustedDriverAvatarUrl(bad)).toBeNull();
 });
 it('upload uses same-origin raw POST, not local-only storage or arbitrary URLs',()=>{
  expect(api).toContain("const route='/driver/avatar'");
  expect(api).toContain("method:'POST',credentials:'include',cache:'no-store'");
  expect(api).toContain("'Content-Type':blob.type");
  expect(api).toContain('trustedDriverAvatarUrl(data?.avatar_url)');
  expect(api).toContain('driverUploadAvatar: (blob:Blob) => uploadDriverAvatar(blob)');
  expect(api).not.toContain('localStorage.setItem');
 });
 it('driver profile UI supports uploading, changing, error and avatar propagation',()=>{
  expect(app).toContain('prepareDriverAvatar(file)');
  expect(app).toContain('await api.driverUploadAvatar(safeBlob)');
  expect(app).toContain('setUploadedAvatar({userId:actorId!,url:updated.avatar_url})');
  expect(app).toContain('uploadedAvatar?.userId===session.user?.id');
  expect(app).toContain('dashboard?.user?.id===session.user?.id');
  expect(app).toContain("avatarUrl?'Cambiar foto':'Subir foto'");
  expect(app).toContain("accept=\"image/jpeg,image/png,image/webp,image/heic,image/heif\"");
  expect(app).toContain('role="alert" className="df-avatar-error"');
  expect(app).toContain('referrerPolicy="no-referrer"');
  expect(css).toContain('.df-avatar img');
 });
 it('customer and restaurant see assigned driver identity only',()=>{
  expect(customer).toContain('<DriverIdentity order={order}/>');
  expect(restaurant).toContain('<DriverIdentity order={o}/>');
  expect(restaurantOrders).toContain("const inTransit=orders.filter(o=>o.order_type==='delivery'");
  expect(restaurantOrders).toContain('<DriverIdentity order={o}/>');
  expect(types).toContain('driver_info?:{id:number;name:string;avatar_url?:string|null');
  expect(identity).toContain("order.order_type!=='delivery'");
  expect(identity).toContain("['assigned','picked_up','on_the_way','delivered']");
  expect(identity).toContain('trustedDriverAvatarUrl(d.avatar_url)');
  expect(identity).not.toContain('phone');
  expect(identity).not.toContain('localStorage');
 });
 it('does not change cash/Stripe, backend dispatch, or driver PIN',()=>{
  expect(app).toContain("guardedAction(()=>api.driverAccept(order.id)");
  expect(app).toContain("api.driverComplete(order.id,pin[order.id]??'')");
  expect(identity).not.toContain('payment');
 });
});
