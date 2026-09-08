const CACHE_NAME="drive-memo-v3-shell-31";
const APP_SHELL=["./","./index.html","./content.js?v=20260908-1","./sync.js?v=20260908-2","./outline.js?v=20260908-2","./journal.js?v=20260906-11","./ui.js?v=20260908-2","./config.js","./manifest.webmanifest","./icon-192.png","./icon-512.png","./apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;const freshRequest=new Request(e.request,{cache:"no-store"});e.respondWith(fetch(freshRequest).then(r=>{const cp=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
