const VERSION="313ebd1c1539bb89";
const ASSETS={"app.js": "e719d37f7c3afa8475c4479d1e0df62786f8eb1c8e2f399e60dbe574996093a6", "background.webp": "5fcaa41e0e9dbee79ff11b59f13a9b13c079698d9bdd63df25ffca53cd5f7046", "engine.js": "ab376f8046f21ca142a51562c7d0c4d54a2cd43b885c793b7eda90cc39969138", "icons/apple-touch-icon.png": "318fa0a2cf425e19fb68b65fd102917d1e7b41fc1a534d25bac4268e14c9034e", "icons/icon-192.png": "c3d8eda8d565a6f1fb6190b4b29951dc6a925a56bc93a192b67cc98afec2458b", "icons/icon-512.png": "82498ec88bb2d12c8d72d75d7ccaddafb7345c5f17efa6a0460b6a31599e4e8f", "index.html": "11b5d97e921ad56cd696ab8a51ded1e241c99d3d2e632aecd38c932a9d0dd5b0", "manifest.webmanifest": "15a06bf9b25cf451593adf9e78d61d922efabc5d2473069c47accaca6ab020bc", "optimal-worker.js": "1718bb9d11b7c7b4273418b4d487ca5ceadc27aac6b7b81017e1708230014bd9", "optimal.js": "433d9c71f6381fd08aa5f450a2cae984a82ecb0b02404678feb174101c81d92b", "pwa.js": "f92d25a49343021aba7b149acca19fb71a6378af87309b70be92cee7fc1ee5e6", "style.css": "a7460c3a416d806eaac5177cc73314eb70696b1f6f53aea6e7274beed9e1724e"};
const CACHE='prism-pour-'+VERSION;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  // Verify every file before this worker becomes installable. Partial or mixed
  // deployments leave the previous complete offline release untouched.
  await Promise.all(Object.entries(ASSETS).map(async([path,hash])=>{
   const url=new URL(path,self.registration.scope);
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
  const saved=await cache.match(new URL(path,scope));
  return saved||fetch(event.request);
 })());
});
