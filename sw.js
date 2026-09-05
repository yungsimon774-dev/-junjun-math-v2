const CACHE="junjun-math-v12-build009-stable-audit-r1";
const CORE=[
  "./",
  "./index.html",
  "./v12-style.css",
  "./v12-config.js",
  "./courses.js",
  "./v12-bank-foundation.js",
  "./v12-bank-application.js",
  "./v12-bank-visual.js",
  "./v12-bank-symbol.js",
  "./v12-bank-life.js",
  "./v12-skill-map.js",
  "./v12-store.js",
  "./v12-engine.js",
  "./v12-tutor.js",
  "./v12-app.js",
  "./manifest.json",
  "./icon.svg",
  "./click.wav",
  "./correct.wav",
  "./wrong.wav",
  "./finish.wav"
];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("junjun-math-")&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await caches.match(request,{ignoreSearch:true});
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isRuntimeFile=/\/(?:index\.html|v12-[^/]+\.js|courses\.js|sw\.js)$/.test(url.pathname);
  if(isRuntimeFile){
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
