// RC165: static shell cache only. Never cache sessions, orders, wallets, auth or Stripe.
const PREFIX='tala-eats-shell-';
const CACHE=PREFIX+'v3';
const SHELL=['/offline.html','/icons/icon-192.png','/icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  // Other PWA portals and unrelated caches on the origin must be preserved.
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if (req.method !== 'GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||
    url.pathname.startsWith('/api/')||
    url.pathname.startsWith('/__')||
    url.pathname.includes('/payments/')||
    url.pathname.includes('/withdrawals/')||
    url.pathname.startsWith('/auth/')||
    url.pathname.startsWith('/stripe/'))return;
  if(req.mode==='navigate'){
    // Financial and private HTML always comes from the network. Offline means
    // an explicit offline page; no old authenticated order snapshots are served.
    event.respondWith(fetch(req).catch(async()=>{
      const cache=await caches.open(CACHE);
      return cache.match('/offline.html');
    }));
    return;
  }
  // Only fingerprinted Vite files and public icons can be cached.
  if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const hit=await cache.match(req);
      if(hit)return hit;
      const res=await fetch(req);
      if(res.ok&&res.type==='basic'){
        await cache.put(req,res.clone());
      }
      return res;
    }));
  }
});
