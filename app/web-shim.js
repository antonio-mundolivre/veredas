/* Veredas (web/PWA): imita o mínimo de chrome.* que o app usa, para rodar no Safari do iPhone sem mudar o código. */
(function () {
  if (window.chrome && chrome.storage && chrome.runtime && chrome.runtime.id) return; // dentro da extensão: não faz nada
  const DB = "veredas", ST = "kv";
  let dbp;
  // a conexão com o IndexedDB pode falhar ou ser fechada pelo iOS (ao voltar de segundo plano, por exemplo): recomeça do zero
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => { const d = r.result; d.onclose = d.onversionchange = () => { dbp = null; try { d.close(); } catch (e) {} }; ok(d); };
    r.onerror = () => { dbp = null; no(r.error); };
    r.onblocked = () => { dbp = null; };
  }));
  // fn só pode usar a transação de forma síncrona (sem await dentro dela): no Safari/iOS a transação fecha sozinha
  // quando o código espera por uma Promise, e o put seguinte falha sem avisar (a gravação se perdia de vez em quando).
  const tx1 = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, no) => {
      let t, s, out, err;
      try { t = d.transaction(ST, mode); s = t.objectStore(ST); } catch (e) { dbp = null; no(e); return; }
      try { out = fn(s); } catch (e) { err = e; try { t.abort(); } catch (x) {} }
      t.oncomplete = () => ok(out); t.onerror = t.onabort = () => no(err || t.error);
    });
  };
  const tx = async (mode, fn) => {
    for (let i = 0; ; i++) {
      try { return await tx1(mode, fn); }
      catch (e) { if (i >= 2) throw e; dbp = null; await new Promise(r => setTimeout(r, 120 * (i + 1))); }   // tenta de novo (2x)
    }
  };
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const listeners = new Set();
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("veredas") : null;
  const fire = ch => listeners.forEach(f => { try { f(ch, "local"); } catch (e) { console.error(e); } });
  if (bc) bc.onmessage = e => fire(e.data);

  function area(prefix) {
    const K = k => prefix + k;
    const keysOf = () => tx("readonly", s => req(s.getAllKeys())).then(ks => ks.filter(k => String(k).startsWith(prefix)));
    const getMany = async list => {   // leitura: pedidos em paralelo dentro de uma única transação
      const rs = await tx("readonly", s => Promise.all(list.map(k => req(s.get(K(k))))));
      return rs;
    };
    return {
      async get(keys) {
        let list, defs = {};
        if (keys == null) list = (await keysOf()).map(k => k.slice(prefix.length));
        else if (typeof keys === "string") list = [keys];
        else if (Array.isArray(keys)) list = keys;
        else { defs = keys; list = Object.keys(keys); }
        const vals = await getMany(list), out = {};
        list.forEach((k, i) => { if (vals[i] !== undefined) out[k] = vals[i]; else if (k in defs) out[k] = defs[k]; });
        return out;
      },
      async set(obj) {
        const ks = Object.keys(obj), olds = await getMany(ks), ch = {};
        await tx("readwrite", s => { ks.forEach(k => s.put(obj[k] === undefined ? null : obj[k], K(k))); });
        ks.forEach((k, i) => { ch[k] = { oldValue: olds[i], newValue: obj[k] }; });
        fire(ch); bc && bc.postMessage(ch);
      },
      async remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys], ch = {}, olds = await getMany(list);
        await tx("readwrite", s => { list.forEach(k => s.delete(K(k))); });
        list.forEach((k, i) => { if (olds[i] !== undefined) ch[k] = { oldValue: olds[i] }; });
        fire(ch); bc && bc.postMessage(ch);
      },
      async clear() {
        const ks = await keysOf(), ch = {};
        await tx("readwrite", s => { ks.forEach(k => { ch[k.slice(prefix.length)] = {}; s.delete(k); }); });
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
  const manifest = { version: "3.5.16", name: "Veredas" };
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
      const b = document.createElement("button"); b.textContent = "Início"; b.dataset.i18n = "web.home"; b.className = "homeBtn";
      b.onclick = () => { location.href = "index.html"; };
      nav.prepend(b);
      // no celular, a barra de ajustes fica recolhida
      const tb = document.querySelector(".toolbar");
      const more = document.createElement("div"); more.className = "tbmore";   // ajustes: no celular abrem por cima do texto, sem mexer no layout
      [...tb.children].forEach(c => { if (c !== nav && !c.classList.contains("brand")) more.append(c); });
      tb.append(more);
      const t = document.createElement("button"); t.className = "tbToggle"; t.textContent = "Aa ▾"; t.setAttribute("aria-label", "Ajustes de leitura"); t.dataset.i18nAriaLabel = "web.adjust";
      t.onclick = () => { const o = tb.classList.toggle("open"); t.textContent = o ? "Aa ▴" : "Aa ▾"; };
      tb.append(t);
    }
    if (page === "options.html") {
      const h = document.querySelector("main h1");
      if (h) { const a = document.createElement("button"); a.innerHTML = '‹ <span data-i18n="web.home">Início</span>'; a.onclick = () => { location.href = "index.html"; }; a.style.marginBottom = "10px"; h.before(a); }
      const sy = document.getElementById("sync"); if (sy) sy.closest("label").hidden = true;
    }
    if (window.I18N) I18N.ready.then(() => I18N.apply());   // traduz os botões criados aqui
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
