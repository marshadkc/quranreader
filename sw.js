// Offline support: the app shell is cached on install; data and fonts are cached as they are used.
const VERSION = "qwr-v17";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/hive.js", "manifest.webmanifest", "data/surahs.json", "icons/icon.svg", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  // "reload" skips the browser's own HTTP cache, which can still hold the previous version for a few minutes
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// The app's own pages, code and styles come from the network first, so an update shows on the next load;
// the cached copy is used only offline. Data and fonts are served from the cache and refreshed in the background.
self.addEventListener("fetch", (e) => {
  // Word meanings from api.quran.com are kept by the app itself for at most 7 days (Quran Foundation's terms), never here
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname === "api.quran.com") return;
  const shell = url.origin === location.origin && !url.pathname.includes("/data/") && !url.pathname.includes("/icons/");
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: shell });
    const net = fetch(shell ? new Request(url.href, { cache: "no-cache" }) : e.request)
      .then((res) => { if (res.ok || res.type === "opaque") cache.put(e.request, res.clone()); return res; })
      .catch(() => hit);
    return shell ? net.then((res) => res || hit) : hit || net;
  }));
});
