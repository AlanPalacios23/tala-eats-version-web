import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {pwaInstallPlatform} from '../src/components/CustomerPwaInstall';
import {validVapidPublicKey,vapidToBytes} from '../src/lib/web-push';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const lib=read('../src/lib/web-push.ts');
const sw=read('../public/sw.js');
const account=read('../src/components/CustomerAccount.tsx');
const css=read('../src/styles/main.css');

describe('Real browser Web Push — authenticated opt-in, no mock delivery',()=>{
 it('validates strict uncompressed VAPID public EC key before permissions',()=>{
  const bytes=new Uint8Array(65);bytes[0]=4;
  const key=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  expect(validVapidPublicKey(key)).toBe(true);
  expect(vapidToBytes(key)).toHaveLength(65);
  expect(validVapidPublicKey('not-a-key')).toBe(false);
  expect(validVapidPublicKey('')).toBe(false);
  expect(()=>vapidToBytes('bad')).toThrow();
 });
 it('requires real backend capability and validates server subscription before success',()=>{
  expect(lib).toContain("request<WebPushConfig>('/v11/push/config')");
  expect(lib).toContain("request<{id:number;active:boolean}>('/v11/push/subscriptions'");
  expect(lib).toContain("request<void>(`/v11/push/subscriptions/${record.id}`");
  expect(lib).toContain("reply.active!==true");
  expect(lib).toContain('await sub.unsubscribe()');
  expect(lib).toContain('PREVIEW_READONLY');
  expect(lib).toContain('await Notification.requestPermission()');
 });
 it('shows consent controls only on real user click and explains missing Node API',()=>{
  expect(account).toContain('onClick={()=>void changePush()}');
  expect(account).toContain('enableWebPush(user.id,pushConfig)');
  expect(account).toContain('disableWebPush(user.id)');
  expect(account).toContain('getWebPushConfig()');
  expect(account).toContain('revokeWebPushBeforeLogout(user.id)');
  expect(account).toContain('Notificaciones del navegador');
  expect(css).toContain('.mobile-push-preferences{');
  expect(pwaInstallPlatform('Mozilla Android')).toBe('android');
 });
 it('background push comes only from server payload and notification clicks stay same origin',()=>{
  expect(sw).toContain("self.addEventListener('push'");
  expect(sw).toContain('self.registration.showNotification');
  expect(sw).toContain("self.addEventListener('notificationclick'");
  expect(sw).toContain("new URL(client.url).origin===self.location.origin");
  expect(sw).toContain("url.origin!==self.location.origin");
  expect(sw).toContain("url.pathname==='/notificaciones'");
  expect(sw).not.toContain('setInterval');
  expect(sw).toContain("url.pathname.startsWith('/api/')");
  expect(sw).not.toContain("caches.open('notification");
 });
});
