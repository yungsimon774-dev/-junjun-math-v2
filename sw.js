const RELEASE='120170';
const CACHE='junjun-math-release-'+RELEASE;
const COMPLETE=new URL('./__release_complete__',self.registration.scope).href;
const digest=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const response=await fetch('./release-manifest.json?v='+RELEASE,{cache:'no-store'});
  if(!response.ok)throw new Error('Release manifest unavailable');
  const manifest=await response.json();
  if(manifest.release!==RELEASE||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Wrong release manifest');
  const verified=await Promise.all(manifest.files.map(async file=>{
    if(!/^[a-zA-Z0-9_.-]+$/.test(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Invalid release file');
    const url=new URL('./'+file.path,self.registration.scope);
    const fetched=await fetch(url.href+'?v='+RELEASE,{cache:'no-store'});
    if(!fetched.ok||await digest(await fetched.clone().arrayBuffer())!==file.sha256)throw new Error('Incomplete or mixed release: '+file.path);
    return {url:url.href,response:fetched};
  }));
  const cache=await caches.open(CACHE);
  await Promise.all(verified.map(file=>cache.put(file.url,file.response)));
  await cache.put(COMPLETE,new Response(RELEASE));
})()));
// Existing tabs keep their worker and cache; an update is adopted on navigation.
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:'OFFLINE_READY',release:RELEASE}));
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  if(url.searchParams.has('v')&&url.searchParams.get('v')!==RELEASE)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const complete=await cache.match(COMPLETE);
    if(complete){
      if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope).href)||fetch(event.request);
      const canonical=new URL(url.href);canonical.search='';canonical.hash='';
      const hit=await cache.match(canonical.href);if(hit)return hit;
    }
    return fetch(event.request);
  })());
});
