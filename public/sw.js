// Tala Eats PWA customer-ready SW: offline app shell ONLY. Financial, auth,
// order, address and merchant APIs are NEVER intercepted or persisted here.
const CACHE='tala-eats-shell-v4';
const SHELL=['/offline.html','/icons/icon-192.png','/icons/icon-512.png','/branding/tala-script-gradient.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||
    url.pathname.startsWith('/__')||url.pathname.includes('/payments/'))return;
 // Page navigation stays online-first so a newly published web release loads.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));
  return;
 }
 // Brand/onboarding image filenames are stable across releases: network first
 // prevents old images from being frozen in previously installed PWAs.
 if(url.pathname.startsWith('/branding/')){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){
    const clone=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,clone)));
   }
   return response;
  }).catch(()=>caches.match(req)));
  return;
 }
 // Vite JS/CSS are fingerprinted /assets/ so cache-first is safe.
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')){
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){
    const clone=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,clone)));
   }
   return response;
  })));
 }
});
