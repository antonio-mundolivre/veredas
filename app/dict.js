// Dicionários: modo "Dicionário" (toque numa palavra do texto abre o verbete) e gerenciamento dos pacotes.
// Pacote de dicionário v1 (veja PACOTE-DE-DICIONARIO.md): { format:"dicionario-pacote", version:1, id, name, lang, license, credit,
//   entries:[[cabeça, definição, [sinônimos], [referências]], ...] }.
// Os dicionários que vêm no app ficam em dicts/ (dicts/index.json lista os disponíveis); os importados ficam no armazenamento do app.
const Dict = (() => {
  const PK = "dictPrefs", MK = "dictMeta", ON = "dictMode", FK = "dictFont", MAXHITS = 6, GAP = 28;
  // fontes do cartão: só as do próprio aparelho (nada é baixado); o app usa a mais próxima da lista que existir
  const FONTS = [
    { id: "palatino", stack: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif' },
    { id: "georgia", stack: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
    { id: "charter", stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
    { id: "moderna", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
    { id: "humanista", stack: '"Gill Sans", "Gill Sans MT", Optima, Candara, "Trebuchet MS", "Segoe UI", sans-serif' },
    { id: "verdana", stack: 'Verdana, Tahoma, "DejaVu Sans", sans-serif' }
  ];
  let fontId = "palatino";
  let prefs = { def: "biblico", off: {} }, meta = {}, builtin = [];
  let root = () => null, langOf = () => "pt", notify = () => {}, mode = false, card = null, btn = null, attached = false;
  const idx = {};                                   // cache: id -> índice carregado (ou, nos fragmentados, id|letra)
  const l2 = s => String(s || "pt").slice(0, 2).toLowerCase();
  const T = (k, p) => I18N.t(k, p);

  // ---------- normalização (mesma regra do tools/dict-figueiredo.py) ----------
  const strip = s => String(s ?? "").toLowerCase().replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe")
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/[’'`]/g, "").replace(/[^\p{L}\p{N}\- ]/gu, " ").replace(/\s+/g, " ").trim();
  // grafia antiga: ph→f, th→t, y→i, ct/pt→t, rh→r, chr/chl→c, sc inicial→c, consoantes dobradas simples (exceto rr, ss)
  const fold = s => strip(s).replace(/ph/g, "f").replace(/th/g, "t").replace(/y/g, "i").replace(/ct/g, "t").replace(/pt/g, "t").replace(/rh/g, "r").replace(/ch(?=[rl])/g, "c").replace(/^sc(?=[ei])/, "c").replace(/([bcdfgklmnptz])\1/g, "$1");
  const shardOf = k => { const c = fold(k)[0] || "_"; return /[a-z]/.test(c) ? c : "_"; };

  // formas de base prováveis (singular, masculino, infinitivo...); só valem quando a palavra exata não está no dicionário
  const RULES = {
    pt: [["oes", "ao"], ["aes", "ao"], ["aos", "ao"], ["ais", "al"], ["eis", "el"], ["ois", "ol"], ["uis", "ul"], ["ns", "m"], ["res", "r"], ["zes", "z"], ["is", "il"], ["s", ""],
      ["mente", ""], ["issimo", "o"], ["issima", "o"], ["ora", "or"], ["esa", "es"], ["ona", "ao"], ["a", "o"],
      ["aram", "ar"], ["avam", "ar"], ["ava", "ar"], ["ando", "ar"], ["ados", "ar"], ["adas", "ar"], ["ado", "ar"], ["ada", "ar"], ["ou", "ar"], ["amos", "ar"], ["am", "ar"], ["ei", "ar"], ["ar", "ar"],
      ["eram", "er"], ["iam", "er"], ["ia", "er"], ["endo", "er"], ["idos", "er"], ["idas", "er"], ["ido", "er"], ["ida", "er"], ["eu", "er"], ["em", "er"],
      ["iram", "ir"], ["indo", "ir"], ["iu", "ir"], ["e", "ar"], ["e", "er"], ["o", "ar"], ["o", "er"], ["o", "ir"]],
    en: [["ies", "y"], ["es", ""], ["s", ""], ["ed", ""], ["ed", "e"], ["ing", ""], ["ing", "e"], ["ly", ""]],
    es: [["es", ""], ["s", ""], ["a", "o"], ["ando", "ar"], ["iendo", "er"], ["ado", "ar"], ["ido", "er"], ["o", "ar"]],
    fr: [["s", ""], ["x", ""], ["es", ""], ["e", ""], ["ent", "er"], ["ait", "er"], ["a", "er"]],
    de: [["en", ""], ["e", ""], ["er", ""], ["es", ""], ["n", ""], ["s", ""], ["te", "en"], ["t", "en"]]
  };
  function forms(word, lang) {
    const w = strip(word), rules = RULES[l2(lang)] || RULES.pt, out = [w], seen = new Set(out);
    const step = k => { for (const [suf, rep] of rules) if (k.endsWith(suf) && k.length - suf.length >= 2) { const c = k.slice(0, k.length - suf.length) + rep; if (!seen.has(c)) { seen.add(c); out.push(c); } } };
    const base = out.slice(); base.forEach(step);                // 1ª rodada
    out.slice(1, 12).forEach(step);                              // 2ª rodada (plural + feminino, p.ex.)
    if (w.includes("-")) w.split("-").filter(p => p.length > 2).forEach(p => { if (!seen.has(p)) { seen.add(p); out.push(p); } });
    return out.slice(0, 40);
  }

  // ---------- pacotes ----------
  function normEntry(e) {
    if (Array.isArray(e)) return [String(e[0] ?? "").trim(), String(e[1] ?? "").trim(), (e[2] || []).map(String), (e[3] || []).map(String)];
    if (e && typeof e === "object") {
      const g = (...ks) => { for (const k of ks) if (e[k] != null) return e[k]; return ""; };
      const arr = x => (Array.isArray(x) ? x : String(x || "").split(/[;|]/)).map(s => String(s).trim()).filter(Boolean);
      return [String(g("h", "head", "headword", "termo", "word", "palavra")).trim(), String(g("d", "def", "definition", "definicao", "definição", "text")).trim(), arr(g("a", "aliases", "sinonimos")), arr(g("r", "refs", "referencias"))];
    }
    return null;
  }
  function normPack(j) {
    if (!j || typeof j !== "object") throw new Error(T("dict.badFormat"));
    let list = j.entries ?? j.verbetes;
    if (!Array.isArray(list) && list && typeof list === "object") list = Object.entries(list).map(([h, d]) => [h, typeof d === "string" ? d : (d && d.d) || ""]);
    if (!Array.isArray(list) && !j.format && !j.entries && !Array.isArray(j)) list = Object.entries(j).map(([h, d]) => [h, typeof d === "string" ? d : ""]);
    if (Array.isArray(j) && !list) list = j;
    const entries = (list || []).map(normEntry).filter(e => e && e[0] && e[1]);
    if (!entries.length) throw new Error(T("dict.badFormat"));
    return entries;
  }
  function buildIndex(entries) {
    const by = new Map(), fb = new Map();
    const add = (m, k, i) => { if (!k) return; const a = m.get(k); if (a) { if (a[a.length - 1] !== i) a.push(i); } else m.set(k, [i]); };
    entries.forEach((e, i) => { [e[0], ...(e[2] || [])].forEach(h => { add(by, strip(h), i); add(fb, fold(h), i); }); });
    return { entries, by, fb };
  }
  async function fetchJson(path) {
    const r = await fetch(chrome.runtime.getURL("dicts/" + path));
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function openIndex(d, keys) {                // devolve lista de índices a consultar
    if (!d.builtin) {
      if (!idx[d.id]) { const s = (await chrome.storage.local.get("dict_" + d.id))["dict_" + d.id]; idx[d.id] = buildIndex(Array.isArray(s) ? s : []); }
      return [idx[d.id]];
    }
    if (d.shards) {
      const letters = [...new Set(keys.map(shardOf))], out = [];
      for (const L of letters) {
        const key = d.id + "|" + L;
        if (!idx[key]) { try { idx[key] = buildIndex(normPack(await fetchJson(d.shards.replace("{k}", L)))); } catch (e) { idx[key] = buildIndex([]); } }
        out.push(idx[key]);
      }
      return out;
    }
    if (!idx[d.id]) idx[d.id] = buildIndex(normPack(await fetchJson(d.file)));
    return [idx[d.id]];
  }
  function match(ixs, keys) {
    const take = (get, ks) => {
      for (let n = 0; n < ks.length; n++) {
        const found = [];
        for (const ix of ixs) { const a = get(ix, ks[n]); if (a) a.forEach(i => { const e = ix.entries[i]; if (!found.includes(e)) found.push(e); }); }
        if (found.length) return { hits: found.slice(0, MAXHITS), n };
      }
      return { hits: [], n: -1 };
    };
    let r = take((ix, k) => ix.by.get(k), keys);
    if (r.hits.length) return { hits: r.hits, via: r.n === 0 ? "exact" : "form" };
    r = take((ix, k) => ix.fb.get(fold(k)), keys);
    return { hits: r.hits, via: "old" };
  }

  // ---------- configuração ----------
  const ready = (async () => {
    try {
      const r = await chrome.storage.local.get([PK, MK, ON, FK]);
      if (r[PK] && typeof r[PK] === "object") prefs = { def: r[PK].def || "biblico", off: r[PK].off || {} };
      if (r[MK] && typeof r[MK] === "object") meta = r[MK];
      mode = !!r[ON];
      if (FONTS.some(f => f.id === r[FK])) fontId = r[FK];
    } catch (e) { /* sem armazenamento */ }
    applyFont();
    try { builtin = ((await fetchJson("index.json")).dicts || []).map(b => ({ ...b, builtin: true })); } catch (e) { builtin = []; }
  })();
  const savePrefs = () => chrome.storage.local.set({ [PK]: prefs });
  function applyFont() { const f = FONTS.find(x => x.id === fontId) || FONTS[0]; document.documentElement.style.setProperty("--dcfont", f.stack); }
  async function setFont(id) { await ready; if (!FONTS.some(f => f.id === id)) return; fontId = id; applyFont(); try { await chrome.storage.local.set({ [FK]: id }); } catch (e) { /* ok */ } }

  async function list() {
    await ready;
    const all = [...builtin, ...Object.keys(meta).map(id => ({ id, ...meta[id], builtin: false }))];
    const def = all.some(d => d.id === prefs.def) ? prefs.def : (all[0] && all[0].id);
    return all.map(d => ({ ...d, enabled: !prefs.off[d.id], isDefault: d.id === def }));
  }
  async function setDefault(id) { await ready; prefs.def = id; delete prefs.off[id]; await savePrefs(); }
  async function setEnabled(id, on) { await ready; if (on) delete prefs.off[id]; else prefs.off[id] = true; await savePrefs(); }
  async function importText(text) {
    await ready;
    let j; try { j = JSON.parse(text); } catch (e) { throw new Error(T("dict.badJson")); }
    const entries = normPack(j);
    const id = String((j && (j.id || j.name)) || "importado").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "importado";
    if (builtin.some(b => b.id === id)) throw new Error(T("dict.idTaken", { id }));
    await chrome.storage.local.set({ ["dict_" + id]: entries });
    meta[id] = { name: String((j && j.name) || id), lang: l2((j && (j.lang || j.language)) || "pt"), count: entries.length, license: String((j && j.license) || ""), credit: String((j && j.credit) || ""), at: Date.now() };
    await chrome.storage.local.set({ [MK]: meta });
    delete idx[id];
    return { id, ...meta[id] };
  }
  async function remove(id) {
    await ready;
    if (!meta[id]) return;
    delete meta[id]; delete idx[id]; delete prefs.off[id];
    await chrome.storage.local.remove("dict_" + id);
    await chrome.storage.local.set({ [MK]: meta });
    if (prefs.def === id) { prefs.def = "biblico"; }
    await savePrefs();
  }
  // dicionários ativos para o idioma do texto, o padrão primeiro
  async function active(lang) {
    const L = l2(lang);
    return (await list()).filter(d => d.enabled && l2(d.lang) === L).sort((a, b) => (b.isDefault - a.isDefault));
  }

  async function lookup(word, lang) {
    const keys = forms(word, lang), out = [];
    for (const d of await active(lang)) {
      let ixs; try { ixs = await openIndex(d, keys); } catch (e) { continue; }
      const m = match(ixs, keys);
      if (m.hits.length) out.push({ dict: d, hits: m.hits, via: m.via });
    }
    return out;
  }

  // ---------- cartão ----------
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  let cur = null;                                   // painel (dicionário) visível no cartão: { pane, page, pages, nav, prev, next, label }
  const maxBody = () => Math.max(110, Math.min(Math.round(innerHeight * 0.26), 240));
  function paginate(c) {                            // texto maior que o espaço vira páginas (colunas deslizadas), sem rolagem
    const p = c.pane;
    p.classList.remove("paged"); p.style.height = p.style.columnWidth = p.style.columnGap = p.style.width = ""; p.scrollLeft = 0;
    c.page = 0; c.pages = 1;
    const w = p.clientWidth;
    if (w > 0 && p.offsetHeight > maxBody() + 2) {
      p.classList.add("paged"); p.style.width = w + "px"; p.style.height = maxBody() + "px"; p.style.columnWidth = w + "px"; p.style.columnGap = GAP + "px";
      c.pages = Math.max(1, Math.round((p.scrollWidth + GAP) / (w + GAP)));
    }
    paintNav(c);
  }
  function paintNav(c) {
    c.nav.hidden = c.pages <= 1;
    c.label.textContent = (c.page + 1) + " / " + c.pages;
    c.prev.disabled = c.page <= 0; c.next.disabled = c.page >= c.pages - 1;
  }
  function turn(d) {
    if (!cur || cur.pages <= 1) return false;
    const n = Math.max(0, Math.min(cur.pages - 1, cur.page + d));
    if (n === cur.page) return true;
    cur.page = n; cur.pane.scrollLeft = n * (cur.pane.clientWidth + GAP); paintNav(cur);
    return true;
  }
  function ensureCard() {
    if (card) return card;
    card = el("div", "dictcard"); card.hidden = true; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", T("dict.title"));
    document.body.append(card);
    document.addEventListener("keydown", e => {
      if (card.hidden) return;
      if (e.key === "Escape") { closeCard(); return; }
      const d = e.key === "ArrowRight" || e.key === "PageDown" ? 1 : e.key === "ArrowLeft" || e.key === "PageUp" ? -1 : 0;
      if (d && cur && cur.pages > 1) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); turn(d); }   // as setas viram as páginas do cartão
    }, true);
    document.addEventListener("click", e => { if (!card.hidden && !card.contains(e.target) && !(btn && btn.contains(e.target)) && !(e.target.closest && e.target.closest("#content .vt") && mode)) closeCard(); }, true);
    let sx = 0, sy = 0;                              // deslizar o dedo vira a página
    card.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    card.addEventListener("touchend", e => { const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1); }, { passive: true });
    window.addEventListener("resize", () => { if (!card.hidden && cur) paginate(cur); });
    return card;
  }
  function closeCard() { if (card) card.hidden = true; cur = null; }
  async function show(word, rect) {
    ensureCard();
    const lang = langOf(), res = await lookup(word, lang), act = await active(lang);
    card.replaceChildren(); cur = null;
    const x = el("button", "dc-x", "×");   // a palavra aparece uma vez só: no título do verbete
    x.type = "button"; x.setAttribute("aria-label", T("dict.close")); x.onclick = closeCard;
    card.append(x);
    let after = null;
    if (!act.length) {
      card.append(el("p", "dc-msg", T("dict.noDict", { lang: l2(lang).toUpperCase() })));
      const a = el("a", "dc-link", T("dict.openOpts")); a.href = chrome.runtime.getURL("options.html#biblias"); a.target = "_blank"; a.rel = "noopener";
      card.append(a);
    } else if (!res.length) {
      card.append(el("p", "dc-msg", T("dict.noEntry", { w: word })));
      card.append(el("p", "dc-foot", act.map(d => d.name).join(" · ")));
    } else {
      const body = el("div", "dc-body"), tabs = el("div", "dc-tabs", "");
      const nav = el("div", "dc-nav"), prev = el("button", "dc-pg", "‹"), next = el("button", "dc-pg", "›"), label = el("span", "dc-pgno", "");
      prev.type = next.type = "button"; prev.setAttribute("aria-label", T("dict.prevPage")); next.setAttribute("aria-label", T("dict.nextPage"));
      nav.append(prev, label, next); nav.hidden = true;
      const foot = el("div", "dc-foot", "");
      const panes = res.map(r => {
        const pane = el("div", "dc-pane");
        r.hits.forEach(h => {
          const e = el("div", "dc-entry");
          e.append(el("h4", "", h[0]));
          if (r.via !== "exact" && strip(h[0]) !== strip(word)) e.append(el("div", "dc-via", r.via === "old" ? T("dict.viaOld") : T("dict.viaForm", { w: word })));
          e.append(el("p", "dc-def", h[1]));
          if (h[3] && h[3].length) { const rf = el("div", "dc-refs"); rf.append(el("span", "dc-reflbl", T("dict.refs") + " "), ...h[3].map(s => el("span", "dc-ref", s))); e.append(rf); }
          pane.append(e);
        });
        return pane;
      });
      const state = panes.map(p => ({ pane: p, page: 0, pages: 1, nav, prev, next, label }));
      const pick = i => {
        panes.forEach((p, k) => { p.hidden = k !== i; });
        [...tabs.children].forEach((b, k) => { b.classList.toggle("on", k === i); b.setAttribute("aria-selected", k === i); });
        foot.textContent = res[i].dict.name + (res[i].dict.license ? " · " + res[i].dict.license : "");
        cur = state[i]; paginate(cur);
      };
      prev.onclick = () => turn(-1); next.onclick = () => turn(1);
      if (res.length > 1) res.forEach((r, i) => { const b = el("button", "dc-tab", r.dict.short || r.dict.name); b.type = "button"; b.setAttribute("role", "tab"); b.onclick = () => pick(i); tabs.append(b); });
      if (res.length > 1) {
        tabs.hidden = true; card.append(tabs);
        const more = el("button", "dc-more", T("dict.alsoIn", { names: res.slice(1).map(r => r.dict.short || r.dict.name).join(", ") }));
        more.type = "button"; more.onclick = () => { tabs.hidden = false; more.hidden = true; pick(1); };
        body.append(...panes);
        after = [more];
      } else body.append(...panes);
      card.append(body, nav, ...(after || []), foot);
      after = () => pick(0);                         // só depois de o cartão aparecer há largura para medir as páginas
    }
    card.classList.toggle("top", !!rect && rect.top > innerHeight * 0.5);
    card.hidden = false;
    if (typeof after === "function") after();
  }

  // ---------- palavra tocada ----------
  const caretAt = (x, y) => {
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, off: p.offset }; }
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r && { node: r.startContainer, off: r.startOffset }; }
    return null;
  };
  const isL = ch => !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
  function wordAt(x, y) {
    const c = caretAt(x, y);
    if (!c || !c.node || c.node.nodeType !== 3 || (c.node.parentElement && c.node.parentElement.closest(".selah"))) return null;
    const t = c.node.nodeValue; let a = Math.min(c.off, t.length), b = a;
    const inner = i => isL(t[i]) || (/[-’']/.test(t[i] || "") && isL(t[i - 1]) && isL(t[i + 1]));
    if (!(a < t.length && inner(a)) && a > 0 && inner(a - 1)) { b = a = a - 1; }       // cursor logo depois da palavra
    while (a > 0 && inner(a - 1)) a--;
    while (b < t.length && inner(b)) b++;
    const w = t.slice(a, b);
    if (!w || !/\p{L}/u.test(w)) return null;
    const r = document.createRange(); r.setStart(c.node, a); r.setEnd(c.node, b);
    return { word: w, rect: r.getBoundingClientRect() };
  }

  // ---------- modo Dicionário ----------
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/><circle cx="16" cy="9.5" r="2"/><path d="M17.5 11l1.7 1.7"/></svg>';
  function paint() {
    document.body.classList.toggle("dictmode", mode);
    if (btn) { btn.classList.toggle("on", mode); btn.setAttribute("aria-pressed", String(mode)); }
  }
  async function setMode(on, quiet) {
    mode = !!on; paint();
    if (!mode) closeCard();
    try { await chrome.storage.local.set({ [ON]: mode }); } catch (e) { /* ok */ }
    if (mode && !quiet) notify(T("dict.hintOn"));
  }
  function onClick(e) {
    if (!mode) return;
    const r = root() || document.getElementById("content");
    if (!r || !e.target.closest || !e.target.closest("#content")) return;
    if (e.target.closest("button,a,select,input")) return;
    if (!e.target.closest(".vt") && !e.target.closest(".selah")) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();      // o toque simples do Selá não deve agir neste modo
    const w = wordAt(e.clientX, e.clientY);
    if (w) show(w.word, w.rect); else closeCard();
  }
  // opts: { root: () => elemento, lang: () => "pt", notify: msg => void, button: "#dictBtn" }
  async function attach(opts = {}) {
    root = opts.root || root; langOf = opts.lang || langOf; notify = opts.notify || notify;
    await Promise.all([ready, I18N.ready]);
    btn = document.querySelector(opts.button || "#dictBtn");
    if (btn) { btn.innerHTML = ICON; btn.title = T("dict.btn"); btn.setAttribute("aria-label", T("dict.btn")); btn.onclick = () => setMode(!mode); btn.hidden = false; }
    if (!attached) { attached = true; document.addEventListener("click", onClick, true); }
    paint();
    try { chrome.storage.onChanged.addListener(ch => { if (ch[ON] && !!ch[ON].newValue !== mode) { mode = !!ch[ON].newValue; paint(); } if (ch[FK] && FONTS.some(f => f.id === ch[FK].newValue)) { fontId = ch[FK].newValue; applyFont(); } }); } catch (e) { /* ok */ }
  }

  return { ready, attach, fonts: FONTS, getFont: () => fontId, setFont, applyFont, list, setDefault, setEnabled, importText, remove, active, lookup, setMode, closeCard, strip, fold, forms, shardOf, get mode() { return mode; } };
})();
