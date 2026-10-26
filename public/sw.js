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
 if (req.method !== 'GET') return;
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


/* Push payloads are sent from the backend worker, never synthesized by JS
   timers. The notification click navigates ONLY within the same PWA origin. */
function safePushRoute(raw){
 try{
  const url=new URL(typeof raw==='string'?raw:'/notificaciones',self.location.origin);
  if(url.origin!==self.location.origin)return '/notificaciones';
  if(url.pathname==='/notificaciones')return url.pathname;
  if(/^\/pedidos\/[1-9][0-9]{0,11}$/.test(url.pathname))return url.pathname;
  return '/notificaciones';
 }catch{return '/notificaciones';}
}
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let body={};
  try{body=event.data?event.data.json():{};}catch{body={};}
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const title=typeof body.title==='string'?body.title.slice(0,90):'Tala Eats';
  const message=typeof body.body==='string'?body.body.slice(0,240):'Tienes una actualización en tu cuenta.';
  const url=safePushRoute(body.url);
  await self.registration.showNotification(title,{
   body:message,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',
   tag:typeof body.tag==='string'?body.tag.slice(0,90):undefined,
   data:{url},renotify:false
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=safePushRoute(event.notification.data?.url);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   try{
    if(new URL(client.url).origin===self.location.origin){
     await client.navigate(url);
     await client.focus();
     return;
    }
   }catch{/* Best effort; fall back to a new PWA window. */}
  }
  await self.clients.openWindow(url);
 })());
});
