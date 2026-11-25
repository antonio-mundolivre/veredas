/* Veredas: guarda o app no aparelho para abrir sem internet. */
const CACHE = "veredas-3.5.10-84ee661d";
const FILES = ["./", "bible-data.js", "bibles/blivre.json", "culto.css", "culto.html", "culto.js", "dict.css", "dict.js", "dicts/biblico.json", "dicts/index.json", "help.css", "help.html", "help.js", "i18n.js", "icons/app-1024.png", "icons/app-180.png", "icons/app-192.png", "icons/app-512.png", "icons/favicon-32.png", "icons/icon128.png", "icons/icon16.png", "icons/icon256.png", "icons/icon32.png", "icons/icon48.png", "icons/icon64.png", "icons/icon96.png", "icons/maskable-512.png", "index.html", "lang/books.js", "lang/de.js", "lang/en.js", "lang/es.js", "lang/fr.js", "lang/pt.js", "manifest.webmanifest", "narrator.js", "options.css", "options.html", "options.js", "pager.js", "popup.css", "popup.js", "reader.css", "reader.html", "reader.js", "selah.js", "share.js", "source.js", "state.js", "wake.js", "web-shim.js", "web.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith("veredas-")).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;   // downloads de outras origens passam direto
  // abre na hora com o que está guardado e, com internet, atualiza o guardado para a próxima abertura
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  }));
});
