/* Veredas: guarda o app no aparelho para abrir sem internet. */
const CACHE = "veredas-2.5";
const FILES = ["./", "bible-data.js", "bibles/blivre.json", "culto.css", "culto.html", "culto.js", "icons/app-180.png", "icons/app-192.png", "icons/app-512.png", "icons/icon128.png", "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/maskable-512.png", "index.html", "manifest.webmanifest", "options.css", "options.html", "options.js", "pager.js", "popup.css", "popup.js", "reader.css", "reader.html", "reader.js", "source.js", "state.js", "web-shim.js", "web.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith("veredas-")).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;   // downloads de outras origens passam direto
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r)));
});
