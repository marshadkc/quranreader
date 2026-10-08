// Offline support: the app shell is cached on install; data and fonts are cached as they are used.
const VERSION = "qwr-v13";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/hive.js", "manifest.webmanifest", "data/surahs.json", "icons/icon.svg", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve from cache straight away, and refresh the cache in the background
self.addEventListener("fetch", (e) => {
  // Word meanings from api.quran.com are kept by the app itself for at most 7 days (Quran Foundation's terms), never here
  if (e.request.method !== "GET" || new URL(e.request.url).hostname === "api.quran.com") return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request);
    const net = fetch(e.request).then((res) => { if (res.ok || res.type === "opaque") cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
