const VERSION="f06ceb24c92b9705";
const ASSETS={"app.js": "6d0b3cd9dd6cb36cf0732c17c61d24dac50ef741c3904f9f2844ca24b903290d", "background.webp": "5fcaa41e0e9dbee79ff11b59f13a9b13c079698d9bdd63df25ffca53cd5f7046", "engine.js": "ab376f8046f21ca142a51562c7d0c4d54a2cd43b885c793b7eda90cc39969138", "icons/apple-touch-icon.png": "318fa0a2cf425e19fb68b65fd102917d1e7b41fc1a534d25bac4268e14c9034e", "icons/icon-192.png": "c3d8eda8d565a6f1fb6190b4b29951dc6a925a56bc93a192b67cc98afec2458b", "icons/icon-512.png": "82498ec88bb2d12c8d72d75d7ccaddafb7345c5f17efa6a0460b6a31599e4e8f", "index.html": "7e8f84920806ccf8972eace5c229c4256e390ea42924e2fa26bec545bf4b92df", "manifest.webmanifest": "15a06bf9b25cf451593adf9e78d61d922efabc5d2473069c47accaca6ab020bc", "optimal-worker.js": "1718bb9d11b7c7b4273418b4d487ca5ceadc27aac6b7b81017e1708230014bd9", "optimal.js": "c185eeac831314cbdb4fffa791b969fd7e87112422ea2a9e18fb477255bc2b46", "pwa.js": "f92d25a49343021aba7b149acca19fb71a6378af87309b70be92cee7fc1ee5e6", "style.css": "3a0860fce658be3a6710844b31d6fab4d9cfe516f446007d00ee07694a4c61b5"};
const CACHE='prism-pour-'+VERSION;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  // Verify every file before this worker becomes installable. Partial or mixed
  // deployments leave the previous complete offline release untouched.
  await Promise.all(Object.entries(ASSETS).map(async([path,hash])=>{
   // Static hosting may canonicalize /index.html to the scope root. Fetch the
   // shell from that canonical URL so a normal redirect cannot abort the
   // service-worker install and leave the installed app without an offline UI.
   const url=new URL(path==='index.html'?'./':path,self.registration.scope);
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok||response.redirected)throw Error('Incomplete update');
   const bytes=await response.clone().arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==hash)throw Error('Mixed release');
   await cache.put(url,response);
  }));
 }catch(e){await caches.delete(CACHE);throw e}
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Retain old releases for tabs still running them; never touch player storage.
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const relative=url.pathname.slice(scope.pathname.length);
 if(relative==='sw.js'||relative==='version.json')return;
 const path=event.request.mode==='navigate'?'index.html':relative;
 if(!(path in ASSETS))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const saved=await cache.match(new URL(path==='index.html'?'./':path,scope));
  return saved||fetch(event.request);
 })());
});
