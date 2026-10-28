/* Independent Driver origin: only immutable public assets; NO order data,
 * authentication, location, payments, onboarding, banking or HTML is cached.
 */
const CACHE='tala-repartidor-public-v1';
const ICONS=['/branding/tala-eats-driver-official.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ICONS)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys
  .filter(k=>k.startsWith('tala-repartidor-public-')&&k!==CACHE)
  .map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin||req.mode==='navigate'||u.pathname.startsWith('/api/')||
    u.pathname.startsWith('/repartidor')||u.pathname.includes('/payments')||
    u.pathname.includes('/withdrawals'))return;
 if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/branding/')){
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));
   }
   return response;
  })));
 }
});
