const CACHE="junjun-math-v12-build007-maximum-teaching-r1";
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

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const isRuntimeFile=/\/(?:index\.html|v12-[^/]+\.js|courses\.js|sw\.js)$/.test(url.pathname);
  if(isRuntimeFile){
    event.respondWith(
      fetch(event.request,{cache:"no-store"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
