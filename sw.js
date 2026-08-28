/* Offline shell. Bump CACHE on every deploy or installed users stay frozen
   on the old build - the failure mode I flagged in v0.2. */
const CACHE='actor-os-pwa-v1_4_0';
const SHELL=['./','./index.html','./performer_camera_v08.js','./sides.js','./pdf.js','./reader.js','./camera_instrument_v07.js',
             './manifest.webmanifest','./icon-192.png','./icon-512.png',
             './gauntlet/PHYSICAL_DEVICE_GAUNTLET.html','./gauntlet/gauntlet_core.js'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // network first so a deploy lands; cache is the fallback when offline
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
