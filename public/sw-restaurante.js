/* Dedicated merchant origin. Cache ONLY public shell art, NEVER users, orders,
 * authentication, sensitive onboarding, admin or financial data. */
const CACHE='tala-restaurantes-shell-v2';
const ASSETS=['/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys
  .filter(k=>k.startsWith('tala-restaurantes-shell-')&&k!==CACHE)
  .map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin/')||
  url.pathname.startsWith('/restaurante/')||url.pathname==='/restaurante'||
  req.mode==='navigate')return;
 // Only immutable, public JS/CSS/icons/open-source fonts may be cached. No HTML, no personal data.
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')||
  url.pathname.startsWith('/fonts/restaurante/')){
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){
    const clone=response.clone();
    event.waitUntil(caches.open(CACHE).then(c=>c.put(req,clone)));
   }
   return response;
  })));
 }
});
