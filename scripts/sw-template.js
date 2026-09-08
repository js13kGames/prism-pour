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
