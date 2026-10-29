/* RC140: surgical compatibility bridge for the currently deployed main PWA.
 * Changes only links to the old /repartidor entry; no API, auth or other routes.
 * The source-level link fix lives in src/App.tsx for the next normal release.
 */
(() => {
  'use strict';
  const DEST='https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso';
  function wasLegacyDriverLink(raw) {
    if (!raw) return false;
    try {
      const u=new URL(raw,window.location.href);
      return u.origin===window.location.origin &&
       (u.pathname==='/repartidor' || u.pathname==='/repartidor/acceso') &&
       !u.search && !u.hash;
    } catch { return false; }
  }
  function retarget(anchor) {
    if (anchor instanceof HTMLAnchorElement && wasLegacyDriverLink(anchor.getAttribute('href'))) {
      anchor.setAttribute('href',DEST);
    }
  }
  function scan(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('a[href]')) retarget(node);
    node.querySelectorAll('a[href]').forEach(retarget);
  }
  // Update actual href values for normal clicks, copy-link and new-tab actions.
  scan(document.documentElement);
  document.addEventListener('DOMContentLoaded',()=>scan(document.documentElement),{once:true});
  new MutationObserver(records=>{
    for(const rec of records) {
      if(rec.type==='attributes') retarget(rec.target);
      else for(const node of rec.addedNodes) scan(node);
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  // React Router may still intercept clicks based on its original to= prop.
  // Capture only these exact links and let the browser navigate externally.
  document.addEventListener('click',event=>{
    const element=event.target instanceof Element?event.target:null;
    const anchor=element?.closest('a[href]');
    if(!anchor) return;
    const href=anchor.getAttribute('href');
    if(href!==DEST && !wasLegacyDriverLink(href)) return;
    if(event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(DEST);
  },true);
})();
