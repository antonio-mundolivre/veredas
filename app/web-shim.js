/* Veredas (web/PWA): imita o mínimo de chrome.* que o app usa, para rodar no Safari do iPhone sem mudar o código. */
(function () {
  if (window.chrome && chrome.storage && chrome.runtime && chrome.runtime.id) return; // dentro da extensão: não faz nada
  const DB = "veredas", ST = "kv";
  let dbp;
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction(ST, mode), s = t.objectStore(ST); let out;
      Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => ok(out); t.onerror = t.onabort = () => no(t.error);
    });
  };
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const listeners = new Set();
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("veredas") : null;
  const fire = ch => listeners.forEach(f => { try { f(ch, "local"); } catch (e) { console.error(e); } });
  if (bc) bc.onmessage = e => fire(e.data);

  function area(prefix) {
    const K = k => prefix + k;
    const allKeys = async s => (await req(s.getAllKeys())).filter(k => String(k).startsWith(prefix));
    return {
      async get(keys) {
        return tx("readonly", async s => {
          const out = {};
          let list, defs = {};
          if (keys == null) list = (await allKeys(s)).map(k => k.slice(prefix.length));
          else if (typeof keys === "string") list = [keys];
          else if (Array.isArray(keys)) list = keys;
          else { defs = keys; list = Object.keys(keys); }
          for (const k of list) {
            const v = await req(s.get(K(k)));
            if (v !== undefined) out[k] = v; else if (k in defs) out[k] = defs[k];
          }
          return out;
        });
      },
      async set(obj) {
        const ch = {};
        await tx("readwrite", async s => {
          for (const [k, v] of Object.entries(obj)) {
            const old = await req(s.get(K(k)));
            s.put(v === undefined ? null : v, K(k));
            ch[k] = { oldValue: old, newValue: v };
          }
        });
        fire(ch); bc && bc.postMessage(ch);
      },
      async remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys], ch = {};
        await tx("readwrite", async s => {
          for (const k of list) { const old = await req(s.get(K(k))); if (old !== undefined) ch[k] = { oldValue: old }; s.delete(K(k)); }
        });
        fire(ch); bc && bc.postMessage(ch);
      },
      async clear() {
        const ch = {};
        await tx("readwrite", async s => { for (const k of await allKeys(s)) { ch[k.slice(prefix.length)] = {}; s.delete(k); } });
        fire(ch); bc && bc.postMessage(ch);
      },
      async getBytesInUse(keys) {
        const r = await this.get(keys);
        return Object.values(r).reduce((n, v) => n + JSON.stringify(v).length, 0);
      }
    };
  }
  const local = area("l:"), sync = area("s:");
  const noWin = () => Promise.reject(new Error("sem janelas na web"));
  const manifest = { version: "2.5", name: "Veredas" };
  window.chrome = {
    storage: { local, sync, onChanged: { addListener: f => listeners.add(f), removeListener: f => listeners.delete(f) } },
    runtime: {
      id: "web",
      getURL: p => new URL(p, document.baseURI).href,
      getManifest: () => manifest,
      sendMessage: noWin,
      onMessage: { addListener() {} },
      openOptionsPage: () => { location.href = "options.html"; }
    },
    windows: {
      create: o => { location.href = o.url; return Promise.resolve({}); },
      get: noWin, update: noWin, getCurrent: noWin
    }
  };

  // pede ao iOS que não apague os dados do app quando faltar espaço
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

  // service worker: deixa o app (e a Bíblia Livre) funcionando sem internet
  if ("serviceWorker" in navigator && location.protocol !== "file:")
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  document.documentElement.classList.add("web");
  addEventListener("DOMContentLoaded", () => {
    const page = (location.pathname.split("/").pop() || "index.html");
    // botão Início nas telas de leitura
    const nav = document.querySelector(".toolbar .nav");
    if (nav) {
      const b = document.createElement("button"); b.textContent = "Início"; b.className = "homeBtn";
      b.onclick = () => { location.href = "index.html"; };
      nav.prepend(b);
      // no celular, a barra de ajustes fica recolhida
      const tb = document.querySelector(".toolbar");
      const more = document.createElement("div"); more.className = "tbmore";   // ajustes: no celular abrem por cima do texto, sem mexer no layout
      [...tb.children].forEach(c => { if (c !== nav && !c.classList.contains("brand")) more.append(c); });
      tb.append(more);
      const t = document.createElement("button"); t.className = "tbToggle"; t.textContent = "Aa ▾"; t.setAttribute("aria-label", "Ajustes de leitura");
      t.onclick = () => { const o = tb.classList.toggle("open"); t.textContent = o ? "Aa ▴" : "Aa ▾"; };
      tb.append(t);
    }
    if (page === "options.html") {
      const h = document.querySelector("main h1");
      if (h) { const a = document.createElement("button"); a.textContent = "‹ Início"; a.onclick = () => { location.href = "index.html"; }; a.style.marginBottom = "10px"; h.before(a); }
      const sy = document.getElementById("sync"); if (sy) sy.closest("label").hidden = true;
    }
    // virar página com o dedo (deslizar na horizontal)
    const pg = document.getElementById("pager");
    if (pg) {
      let x0, y0, t0;
      pg.addEventListener("touchstart", e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
      pg.addEventListener("touchend", e => {
        if (x0 == null) return;
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        if (Date.now() - t0 < 700 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
          document.getElementById(dx < 0 ? "next" : "prev").click();
      }, { passive: true });
    }
  });
})();
