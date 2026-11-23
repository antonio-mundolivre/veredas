// Passagens: abre passagens avulsas (livro, capítulo, versículos) em poucos cliques ou digitando.
// Cada passagem vira um cartão; dá para abrir várias e remover as que não servem.
const $ = s => document.querySelector(s);
const PREFS_DEFAULT = { size: 22, theme: "light", width: 32, mode: "lines", view: "single", align: "left" };
let alignRefresh = () => {};
let prefs = { ...PREFS_DEFAULT };
let version = VERSIONS[0];
let step = "book";                // book | chapter | verse
let cur = { book: null, chapter: null };
let items = [];                   // [{id, book, chapter, s, e, showAll}]
let activeId = null;              // cartão que o seletor de versículos está ajustando
let awaitingEnd = false;          // 1º versículo tocado, esperando o último
let lastRemoved = null;           // para "Desfazer"
const mem = new Map();            // "versão:capítulo" -> {g, verses, source}
const els = new Map();            // id -> elemento do cartão
const errs = new Map();           // id -> erro de carregamento

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const uid = () => Math.random().toString(36).slice(2, 9);
const gIndex = (b, c) => CHAPTERS.findIndex(x => x.book === b && x.chapter === c);
const itemRef = it => `${BOOKS[it.book][0]} ${it.chapter}` + (it.s ? `:${it.s}${it.e && it.e !== it.s ? "–" + it.e : ""}` : "");
const activeItem = () => items.find(i => i.id === activeId) || null;
const keyFor = (it, ver = version) => ver.id + ":" + gIndex(it.book, it.chapter);
const persist = () => chrome.storage.local.set({ cultoList: items, cultoActive: activeId });

// ---------- ícones (traço simples, herdam a cor do texto) ----------
const ICONS = {
  book:   ["M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z", "M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"],
  plus:   ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M12 18v-6", "M9 15h6"],
  save:   ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"],
  folder: ["M3 19V6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v2", "M3 19l2.5-8.5a1 1 0 0 1 1-.7H21l-2.6 8.5a1 1 0 0 1-1 .7H3z"],
  grid:   ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"]
};
function icon(name, size = 20) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  ICONS[name].forEach(d => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); svg.append(p); });
  return svg;
}

// ---------- diagrama dos livros ----------
// (os nomes são chaves de idioma, resolvidas com t() na hora de desenhar)
const BOOK_TREE = [
  { name: "culto.tree.at", cls: "at", groups: [["culto.tree.pentateuch", 0, 4], ["culto.tree.historical", 5, 16], ["culto.tree.poetic", 17, 21], ["culto.tree.majorProphets", 22, 26], ["culto.tree.minorProphets", 27, 38]] },
  { name: "culto.tree.nt", cls: "nt", groups: [["culto.tree.gospels", 39, 42], ["culto.tree.acts", 43, 43], ["culto.tree.paul", 44, 56], ["culto.tree.general", 57, 64], ["culto.tree.prophecy", 65, 65]] }
];

// ---------- livros: nomes, siglas e apelidos (de todos os idiomas: dá para digitar em qualquer um) ----------
const ALIASES = BOOKS.map(() => new Set());
const NAME_KEYS = BOOKS.map(() => new Set());
BOOKS.forEach((b, i) => {
  ALIASES[i].add(norm(b[3]));
  for (const L of Object.values(BOOK_LANG)) {
    NAME_KEYS[i].add(norm(L.names[i])); ALIASES[i].add(norm(L.names[i])); ALIASES[i].add(norm(L.abbr[i]));
    for (const x of (L.extra && L.extra[b[3]]) || []) ALIASES[i].add(norm(x));
  }
});

function resolveBook(token) {
  const raw = token.trim().toLowerCase().replace(/\s+/g, "");
  // 1º: nomes, siglas e apelidos do idioma atual, exatamente como digitados ("jn" = John em inglês, Jonas em português)
  const L = BOOK_LANG[I18N.lang] || BOOK_LANG.pt;
  const curExact = BOOKS.findIndex((b, i) => [L.names[i], L.abbr[i], ...((L.extra || {})[b[3]] || [])].some(x => x.toLowerCase().replace(/\s+/g, "") === raw));
  if (curExact >= 0) return { ok: curExact };
  const exactSlug = BOOKS.findIndex(b => b[3] === raw);   // "jo" = João, "jó" = Jó
  if (exactSlug >= 0) return { ok: exactSlug };
  const tn = norm(token);
  if (!tn) return { none: true };
  const exact = BOOKS.findIndex((_, i) => ALIASES[i].has(tn));
  if (exact >= 0) return { ok: exact };
  if (tn.length >= 2) {
    const pref = BOOKS.map((b, i) => i).filter(i => [...NAME_KEYS[i]].some(n => n.startsWith(tn)));
    if (pref.length === 1) return { ok: pref[0] };
    if (pref.length > 1) return { many: pref };
  }
  return { none: true };
}

// "jo 1:2-4", "jo1:2-4", "sl 23", "1co 13.4-7", "joão 3 16"
function parseQuery(q) {
  const m = q.trim().match(/^((?:[1-3]\s*)?[^\d\s:.,;–—-]+(?:\s+[^\d\s:.,;–—-]+)*?)\s*(\d+)?(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/);
  if (!m) return null;
  return { book: m[1], chapter: m[2] ? +m[2] : null, vs: m[3] ? +m[3] : null, ve: m[4] ? +m[4] : null };
}

// ---------- preferências (compartilhadas com o leitor) ----------
async function loadPrefs() {
  const { prefs: p } = await chrome.storage.local.get("prefs");
  prefs = { ...PREFS_DEFAULT, ...(p || {}) };
}
const savePrefs = () => chrome.storage.local.set({ prefs });
function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.style.setProperty("--size", prefs.size + "px");
  document.documentElement.style.setProperty("--width", prefs.width + "em");
  document.body.dataset.mode = prefs.mode;
  document.body.dataset.view = prefs.view;
  document.body.dataset.align = prefs.align;
  alignRefresh();
  Pager.layout();
  $("#allView").checked = prefs.view === "all";
  $("#width").value = String(prefs.width);
  $("#mode").value = prefs.mode;
  document.querySelectorAll("[data-theme-btn]").forEach(b => b.classList.toggle("active", b.dataset.themeBtn === prefs.theme));
}

// ---------- abas: um botão por trecho aberto (com ✕ para remover) ----------
// mover uma passagem para outra posição (arrastando a aba ou com Alt + setas)
function moveItem(id, to) {
  const from = items.findIndex(i => i.id === id);
  if (from < 0) return;
  to = Math.max(0, Math.min(items.length - 1, to));
  if (to === from) return;
  items.splice(to, 0, items.splice(from, 1)[0]);
  items.forEach(it => { const e = els.get(it.id); if (e) $("#content").append(e); });   // mesma ordem nos cartões
  persist();
  renderTabs();
  Pager.layout();
}

function renderTabs() {
  const box = $("#tabs");
  box.replaceChildren();
  let dragId = null;
  items.forEach((it, idx) => {
    const tab = document.createElement("span");
    tab.className = "tab" + (it.id === activeId ? " active" : "");
    tab.draggable = true;
    tab.title = t("culto.tab.drag");
    const label = btn(itemRef(it), "tl", () => { setActive(it.id); const el = els.get(it.id); if (document.body.dataset.view === "single") Pager.reset(); else Pager.reveal(el); }, t("culto.tab.show"));
    label.onkeydown = e => {
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        moveItem(it.id, idx + (e.key === "ArrowLeft" ? -1 : 1));
        const nb = [...box.querySelectorAll(".tab")][items.findIndex(i => i.id === it.id)];
        nb && nb.querySelector(".tl").focus();
      }
    };
    const mvL = btn("‹", "mv", () => moveItem(it.id, idx - 1), t("culto.tab.moveLeft"));
    const mvR = btn("›", "mv", () => moveItem(it.id, idx + 1), t("culto.tab.moveRight"));
    mvL.disabled = idx === 0; mvR.disabled = idx === items.length - 1;
    tab.append(mvL, label, mvR, btn("✕", "tx", () => removeItem(it.id), t("culto.tab.remove")));
    const clear = () => box.querySelectorAll(".tab").forEach(x => x.classList.remove("drop-before", "drop-after"));
    tab.addEventListener("dragstart", e => { dragId = it.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); tab.classList.add("dragging"); });
    tab.addEventListener("dragend", () => { dragId = null; tab.classList.remove("dragging"); clear(); });
    tab.addEventListener("dragover", e => {
      if (!dragId || dragId === it.id) return;
      e.preventDefault();
      const r = tab.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      clear(); tab.classList.add(after ? "drop-after" : "drop-before");
    });
    tab.addEventListener("drop", e => {
      if (!dragId || dragId === it.id) return;
      e.preventDefault();
      const r = tab.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      const from = items.findIndex(i => i.id === dragId);
      let to = items.findIndex(i => i.id === it.id) + (after ? 1 : 0);
      if (from < to) to--;
      clear(); moveItem(dragId, to);
    });
    box.append(tab);
  });
  syncNext();
}

// ---------- selo: a versão atual está no aparelho? ----------
async function updateBadge() {
  const cr = $("#credit"); if (cr) cr.textContent = version.credit || (version.third ? t("culto.credit.third") : "");
  const [st0, off] = [await localStatus(version), await isOfflineOnly()];
  const st = st0 || (version.bundled ? { verses: 1 } : null);
  const b = $("#offbadge");
  b.className = "badge " + (st ? "ok" : "warn");
  b.textContent = st ? t("culto.badge.ok") : off ? t("culto.badge.notDownloaded") : t("culto.badge.needsNet");
  b.title = st ? t("culto.badge.okTip")
              : t("culto.badge.warnTip");
}

// ---------- dados ----------
async function ensureData(it, ver) {
  const key = keyFor(it, ver);
  if (mem.has(key)) return mem.get(key);
  const r = await fetchVerses(CHAPTERS[gIndex(it.book, it.chapter)], ver);
  const d = { g: gIndex(it.book, it.chapter), verses: r.verses, source: r.source };
  mem.set(key, d);
  return d;
}
function clampItem(it, d) {
  if (it.s == null) return;
  const max = d.verses.length;
  it.s = Math.min(it.s, max);
  it.e = Math.min(Math.max(it.e ?? it.s, it.s), max);
}
async function loadCard(it) {
  const ver = version;
  errs.delete(it.id);
  try { clampItem(it, await ensureData(it, ver)); await Selah.ready; }
  catch (e) { errs.set(it.id, e); }
  if (ver !== version || !items.includes(it)) return;
  redrawCard(it.id);
  renderTabs();
  if (it.id === activeId) renderPicker();
}

// ---------- cartões ----------
function btn(label, cls, onclick, title) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  if (title) b.title = title;
  b.onclick = onclick;
  return b;
}

function renderCard(it) {
  const d = mem.get(keyFor(it));
  const err = errs.get(it.id);
  const range = it.s != null;
  const sec = document.createElement("section");
  sec.className = "chapter card" + (it.id === activeId ? " active" : "");
  sec.dataset.id = it.id;
  sec.onclick = e => { if (!e.target.closest("button,a") && activeId !== it.id) setActive(it.id); };

  const top = document.createElement("div");
  top.className = "cardtop";
  const kicker = document.createElement("div");
  kicker.className = "kicker";
  kicker.textContent = [version.short, d ? t("culto.card.source", { s: d.source }) : ""].filter(Boolean).join(" · ");
  top.append(kicker);
  const g = gIndex(it.book, it.chapter);
  const prev = btn("◀", "", () => moveChapter(it, -1), t("culto.card.prevChapter"));
  const next = btn("▶", "", () => moveChapter(it, 1), t("culto.card.nextChapter"));
  prev.disabled = g <= 0;
  next.disabled = g >= CHAPTERS.length - 1;
  const vb = btn("", "ico", () => { setActive(it.id); openPicker("edit", "verse"); }, t("culto.card.pickVerses"));
  vb.setAttribute("aria-label", t("culto.card.pickVersesAria")); vb.append(icon("grid", 16));
  top.append(vb, prev, next);
  if (range) top.append(btn(it.showAll ? t("culto.card.onlyRange") : t("culto.card.showChapter"), "", () => { it.showAll = !it.showAll; redrawCard(it.id); persist(); }));
  top.append(btn("✕", "x", () => removeItem(it.id), t("culto.card.remove")));

  const h1 = document.createElement("h1");
  h1.textContent = itemRef(it);
  sec.append(top, h1);

  if (err) {
    const box = document.createElement("div");
    box.className = "error";
    box.textContent = err.message || String(err);
    box.append(document.createElement("br"), btn(t("culto.card.retry"), "", () => loadCard(it)));
    sec.append(box);
  } else if (!d) {
    const p = document.createElement("p");
    p.className = "status";
    p.textContent = t("culto.card.loading");
    sec.append(p);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "verses";
    let firstHl = null;
    d.verses.forEach(v => {
      const inR = range && v.n >= it.s && v.n <= it.e;
      if (!v.text) return;   // versículo omitido nesta edição
      if (range && !it.showAll && !inR) return;
      if (v.heading && (!range || it.showAll)) { const hh = document.createElement("h2"); hh.textContent = v.heading; wrap.append(hh); }
      const sp = document.createElement("span");
      sp.className = "v" + (v.brk ? " brk" : "") + (range && it.showAll ? (inR ? " hl" : " dim") : "");
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = v.n;
      Selah.fill(sp, n, v, version.id + "|g" + gIndex(it.book, it.chapter));
      wrap.append(sp);
      if (inR && !firstHl) firstHl = sp;
    });
    sec.append(wrap);
    if (it.showAll && firstHl) sec._firstHl = firstHl;
  }
  return sec;
}

function redrawCard(id) {
  const it = items.find(i => i.id === id), old = els.get(id);
  if (!it || !old) return;
  const nw = renderCard(it);
  old.replaceWith(nw);
  els.set(id, nw);
  if (nw._firstHl) Pager.reveal(nw._firstHl);
  syncNext();
}

function updateEmpty() {
  let e = $("#emptyHint");
  if (!items.length) {
    if (!e) {
      e = document.createElement("p");
      e.id = "emptyHint";
      e.className = "empty-hint";
      e.textContent = t("culto.empty.hint");
      $("#content").append(e);
    }
  } else if (e) e.remove();
}

function setActive(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  if (pickMode === "new") closePicker();
  activeId = id;
  awaitingEnd = false;
  cur = { book: it.book, chapter: it.chapter };
  step = "verse";
  els.forEach((el, k) => el.classList.toggle("active", k === id));
  renderPicker();
  renderTabs();
  persist();
}

function addItem(book, chapter, s = null, e = null) {
  const it = { id: uid(), book, chapter, s, e: s != null ? (e ?? s) : null, showAll: false };
  items.push(it);
  activeId = it.id;
  awaitingEnd = false;
  cur = { book, chapter };
  step = "verse";
  updateEmpty();
  const el = renderCard(it);
  $("#content").append(el);
  els.set(it.id, el);
  els.forEach((x, k) => x.classList.toggle("active", k === it.id));
  Pager.reveal(el);
  renderPicker();
  persist();
  renderTabs();
  return loadCard(it).then(() => { persist(); return it; });
}

function removeItem(id) {
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return;
  const it = items[idx];
  lastRemoved = { it, idx };
  items.splice(idx, 1);
  els.get(id)?.remove();
  els.delete(id);
  if (activeId === id) {
    const nb = items[idx] || items[idx - 1] || null;
    activeId = nb ? nb.id : null;
    if (nb) { cur = { book: nb.book, chapter: nb.chapter }; step = "verse"; } else step = "book";
    els.forEach((x, k) => x.classList.toggle("active", k === activeId));
  }
  updateEmpty();
  renderPicker();
  renderTabs();
  persist();
  msg(t("culto.msg.removed", { ref: itemRef(it) }), false, [{ label: t("culto.msg.undo"), fn: undoRemove }]);
}

function undoRemove() {
  if (!lastRemoved) return;
  const { it, idx } = lastRemoved;
  lastRemoved = null;
  items.splice(Math.min(idx, items.length), 0, it);
  activeId = it.id;
  const el = renderCard(it);
  const after = items[idx + 1] ? els.get(items[idx + 1].id) : null;
  after ? after.before(el) : $("#content").append(el);
  els.set(it.id, el);
  updateEmpty();
  setActive(it.id);
  Pager.reveal(el);
  msg("");
  loadCard(it);
}

// troca a lista inteira de passagens (Novo, Ler, restauração); devolve o que havia antes para o "Desfazer"
function setList(list, activeHint) {
  items = (list || [])
    .filter(x => Number.isInteger(x.book) && BOOKS[x.book] && x.chapter >= 1 && x.chapter <= BOOKS[x.book][2])
    .map(x => ({ id: x.id || uid(), book: x.book, chapter: x.chapter, s: x.s || null, e: x.s ? (x.e || x.s) : null, showAll: !!x.showAll }));
  els.forEach(el => el.remove());
  els.clear(); errs.clear();
  awaitingEnd = false; lastRemoved = null;
  activeId = items.find(i => i.id === activeHint) ? activeHint : (items.length ? items[items.length - 1].id : null);
  if (activeItem()) { cur = { book: activeItem().book, chapter: activeItem().chapter }; step = "verse"; } else step = "book";
  items.forEach(it => { const el = renderCard(it); $("#content").append(el); els.set(it.id, el); });
  els.forEach((x, k) => x.classList.toggle("active", k === activeId));
  updateEmpty();
  renderPicker();
  renderTabs();
  persist();
  Pager.reset();
  items.forEach(loadCard);
}
const snapshot = () => items.map(({ book, chapter, s, e, showAll }) => ({ book, chapter, s, e, showAll }));

function newList() {
  if (pickMode) closePicker();
  if (!items.length) { msg(t("culto.msg.alreadyEmpty")); return; }
  const before = snapshot();
  setList([]);
  closePanel();
  msg(t("culto.msg.newList"), false, [{ label: t("culto.msg.undo"), fn: () => { setList(before); msg(""); } }]);
}

// ---------- guardar e ler ----------
// pastas: o que fica guardado é um id estável (cultos, devocionais...), o nome aparece no idioma atual.
// Gravações antigas, que guardavam o nome em português, são convertidas ao ler.
const FOLDERS = ["cultos", "devocionais", "estudos", "outros"];
const LEGACY_FOLDER = { Cultos: "cultos", Devocionais: "devocionais", Estudos: "estudos", Outros: "outros" };
const folderName = id => t("culto.folder." + id);
const folderAbbr = id => t("culto.folder." + id + ".abbr");
const ansiDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getSaved = async () => { const r = await chrome.storage.local.get("cultoSaved"); return Array.isArray(r.cultoSaved) ? r.cultoSaved.map(x => ({ ...x, folder: LEGACY_FOLDER[x.folder] || x.folder })) : []; };
const putSaved = list => chrome.storage.local.set({ cultoSaved: list });
let panelMode = null;

function closePanel() { panelMode = null; $("#panel").hidden = true; $("#panel").replaceChildren(); Pager.layout(); }

function openSavePanel() {
  if (pickMode) closePicker();
  if (panelMode === "save") return closePanel();
  if (!items.length) { msg(t("culto.save.needOne")); return; }
  panelMode = "save";
  const p = $("#panel"); p.hidden = false; p.replaceChildren();
  const row = document.createElement("div"); row.className = "prow";
  const sel = document.createElement("select");
  FOLDERS.forEach(id => sel.add(new Option(folderName(id), id)));
  const name = document.createElement("input"); name.type = "text"; name.maxLength = 60;
  const abbrOf = () => folderAbbr(sel.value);
  const stdName = () => `${abbrOf()} ${ansiDate()}`;
  let edited = false;
  name.value = stdName();
  name.oninput = () => { edited = true; };
  sel.onchange = () => { if (!edited) name.value = stdName(); };
  const ok = btn(t("culto.save.ok"), "primary", async () => {
    const nm = name.value.trim() || stdName();
    const list = await getSaved();
    const i = list.findIndex(x => x.folder === sel.value && x.name === nm);
    const rec = { id: i >= 0 ? list[i].id : uid(), folder: sel.value, name: nm, savedAt: Date.now(), items: snapshot().map(({ book, chapter, s, e }) => ({ book, chapter, s, e })) };
    i >= 0 ? (list[i] = rec) : list.push(rec);
    await putSaved(list);
    closePanel();
    msg(t(i >= 0 ? "culto.save.updated" : "culto.save.saved", { folder: folderName(sel.value), name: nm, count: t("culto.save.count", { n: items.length }) }));
  });
  name.onkeydown = e => { if (e.key === "Enter") ok.click(); if (e.key === "Escape") closePanel(); };
  row.append(el_("span", t("culto.save.folder")), sel, el_("span", t("culto.save.name")), name, ok, btn(t("culto.save.cancel"), "", closePanel));
  p.append(row);
  Pager.layout();
  name.focus(); name.select();
}
const el_ = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };

async function openReadPanel() {
  if (pickMode) closePicker();
  if (panelMode === "read") return closePanel();
  panelMode = "read";
  const p = $("#panel"); p.hidden = false;
  await drawReadPanel();
}
async function drawReadPanel() {
  const p = $("#panel"); p.replaceChildren();
  const list = await getSaved();
  if (!list.length) { p.append(el_("div", t("culto.read.none"))); p.lastChild.className = "none"; Pager.layout(); return; }
  FOLDERS.forEach(folder => {
    const mine = list.filter(x => x.folder === folder).sort((a, b) => b.savedAt - a.savedAt);
    if (!mine.length) return;
    p.append(el_("h5", folderName(folder)));
    mine.forEach(rec => {
      const r = document.createElement("div"); r.className = "srow";
      const o = btn(rec.name, "nm", () => {
        const before = snapshot();
        setList(rec.items);
        closePanel();
        msg(t("culto.read.opened", { name: rec.name }), false, before.length ? [{ label: t("culto.msg.undo"), fn: () => { setList(before); msg(""); } }] : []);
      }, t("culto.read.openTip"));
      const sm = el_("small", rec.items.map(i => itemRef(i)).join(" · "));
      const del = btn("✕", "tx", async () => {
        if (!confirm(t("culto.read.confirmDelete", { name: rec.name }))) return;
        await putSaved((await getSaved()).filter(x => x.id !== rec.id));
        drawReadPanel();
      }, t("culto.read.deleteTip"));
      r.append(o, sm, del); p.append(r);
    });
  });
  Pager.layout();
}

// no fim da leitura de um capítulo inteiro, o botão "Próxima" vira "Próximo capítulo ›" e a passagem passa a ser o capítulo seguinte
function syncNext() {
  const it = activeItem();
  const whole = it && (!it.s || it.showAll);
  const can = !!whole && prefs.view !== "all" && !!CHAPTERS[gIndex(it.book, it.chapter) + 1];
  Pager.hooks.next = can ? () => moveChapter(it, 1, true) : null;
  Pager.refreshBar();
}

function moveChapter(it, d, fromEnd) {
  const g = gIndex(it.book, it.chapter) + d;
  if (!CHAPTERS[g]) return;
  it.book = CHAPTERS[g].book;
  it.chapter = CHAPTERS[g].chapter;
  it.s = it.e = null;
  it.showAll = false;
  redrawCard(it.id);
  setActive(it.id);
  loadCard(it).then(() => { persist(); if (fromEnd) Pager.reset(); syncNext(); });
  renderTabs();
}

// ---------- seletor: livro → capítulo → versículos ----------
// o seletor cobre a área de leitura enquanto está aberto. Dois modos:
//   "new"  → Nova passagem (livro › capítulo); ao tocar no capítulo a passagem é criada e passa para "edit"
//   "edit" → Ajustar versículos de uma passagem que já existe
let pickMode = null;
function placePicker() {
  const f = $(".finder").getBoundingClientRect(), pb = $(".pagebar").getBoundingClientRect();
  const el = $("#picker");
  el.style.top = Math.round(f.bottom) + "px";
  el.style.bottom = Math.max(0, Math.round(innerHeight - pb.top)) + "px";
}
function openPicker(mode, startStep) {
  pickMode = mode; step = startStep;
  closePanel();
  $("#picker").hidden = false;
  document.body.classList.add("picking");
  placePicker();
  renderPicker();
  $("#picker").scrollTop = 0;
}
function closePicker() {
  pickMode = null;
  $("#picker").hidden = true;
  document.body.classList.remove("picking");
  Pager.layout();
}

function renderPicker() {
  if (!pickMode) return;
  const box = $("#picker");
  const a = activeItem();
  if (pickMode === "edit" && !a) { closePicker(); return; }
  const inn = document.createElement("div"); inn.className = "pickin";
  const head = document.createElement("div"); head.className = "pkh";
  const title = document.createElement("h2");
  const sp = document.createElement("span"); sp.className = "sp";
  const close = btn("✕", "", closePicker, t("culto.pick.closeTip"));

  if (pickMode === "new" && step === "book") {
    title.textContent = t("culto.pick.newBook");
    head.append(title, sp, close); inn.append(head);
    const diag = document.createElement("div"); diag.className = "bdiag";
    const bt = document.createElement("div"); bt.className = "bt"; bt.textContent = t("culto.pick.bibleTitle");
    diag.append(bt);
    const tst = document.createElement("div"); tst.className = "tst";
    BOOK_TREE.forEach(tr => {
      const tb = document.createElement("div"); tb.className = "t " + tr.cls;
      const h = document.createElement("h3"); const n = document.createElement("span");
      h.append(t(tr.name), n); n.textContent = t("culto.pick.booksCount", { n: tr.groups.reduce((x, g) => x + g[2] - g[1] + 1, 0) });
      const gs = document.createElement("div"); gs.className = "gs";
      tr.groups.forEach(([gt, a0, b0]) => {
        const sg = document.createElement("div"); sg.className = "sg";
        const h4 = document.createElement("h4"); h4.textContent = t(gt);
        const bs = document.createElement("div"); bs.className = "bs";
        for (let i = a0; i <= b0; i++) {
          const b = btn("", "bk", () => { cur = { book: i, chapter: null }; step = "chapter"; renderPicker(); }, BOOKS[i][0]);
          const ab = document.createElement("b"); ab.textContent = I18N.abbr()[i];
          const nm = document.createElement("small"); nm.textContent = BOOKS[i][0];
          b.append(ab, nm); bs.append(b);
        }
        sg.append(h4, bs); gs.append(sg);
      });
      tb.append(h, gs); tst.append(tb);
    });
    diag.append(tst); inn.append(diag);
    box.replaceChildren(inn);
    return;
  }

  if (pickMode === "new") {          // step === "chapter"
    title.textContent = t("culto.pick.newBookName", { book: BOOKS[cur.book][0] });
    const hint = document.createElement("span"); hint.className = "hint";
    hint.textContent = t("culto.pick.tapChapter");
    head.append(btn(t("culto.pick.backBooks"), "", () => { step = "book"; renderPicker(); }), title, hint, sp, close); inn.append(head);
    const g = document.createElement("div"); g.className = "grid nums";
    for (let c = 1; c <= BOOKS[cur.book][2]; c++) g.append(btn(String(c), "", () => { pickMode = "edit"; addItem(cur.book, c); }));
    inn.append(g);
    box.replaceChildren(inn);
    return;
  }

  // pickMode === "edit": ajusta os versículos da passagem ativa
  title.textContent = t("culto.pick.editTitle", { book: BOOKS[a.book][0], chapter: a.chapter });
  const hint = document.createElement("span"); hint.className = "hint";
  hint.textContent = t("culto.pick.editHint");
  head.append(title, hint, sp,
    btn(t("culto.pick.wholeChapter"), a.s == null ? "on" : "", () => { a.s = a.e = null; a.showAll = false; awaitingEnd = false; redrawCard(a.id); renderTabs(); persist(); closePicker(); }),
    btn(t("culto.pick.done"), "primary", closePicker), close);
  inn.append(head);
  const d = mem.get(keyFor(a));
  if (d) {
    const g = document.createElement("div"); g.className = "grid nums";
    d.verses.forEach(v => {
      const inRange = a.s != null && v.n >= a.s && v.n <= a.e;
      const edge = a.s != null && (v.n === a.s || v.n === a.e);
      g.append(btn(String(v.n), edge ? "on" : inRange ? "in" : "", () => pickVerse(v.n)));
    });
    inn.append(g);
  } else { const w = document.createElement("p"); w.className = "hint"; w.textContent = t("culto.pick.loadingVerses"); inn.append(w); }
  box.replaceChildren(inn);
}
function pickVerse(n) {
  const a = activeItem();
  if (!a) return;
  if (!awaitingEnd || a.s == null) {
    a.s = a.e = n;                                   // 1º toque: mostra só este versículo
    awaitingEnd = true;
  } else {
    const s = Math.min(a.s, n), e = Math.max(a.s, n); // 2º toque fecha o trecho
    a.s = s; a.e = e;
    awaitingEnd = false;
    closePicker();
  }
  redrawCard(a.id);
  renderPicker();
  persist();
  renderTabs();
}

// ---------- busca digitada ----------
function msg(text, err, chips) {
  const m = $("#qmsg");
  m.className = "qmsg" + (err ? " err" : "");
  m.textContent = text || "";
  (chips || []).forEach(c => m.append(btn(c.label, "chip", c.fn)));
}
function submitQuery() {
  const q = $("#q").value;
  if (!q.trim()) return;
  const p = parseQuery(q);
  if (!p) return msg(t("culto.q.unclear"), true);
  const r = resolveBook(p.book);
  if (r.none) return msg(t("culto.q.notFound", { book: p.book }), true);
  if (r.many) return msg(t("culto.q.which"), false, r.many.map(i => ({
    label: BOOKS[i][0],
    fn: () => { $("#q").value = BOOKS[i][3] + (p.chapter ? " " + p.chapter + (p.vs ? ":" + p.vs + (p.ve ? "-" + p.ve : "") : "") : ""); submitQuery(); }
  })));
  const book = r.ok;
  msg("");
  if (!p.chapter) { cur = { book, chapter: null }; openPicker("new", "chapter"); return; }
  if (p.chapter < 1 || p.chapter > BOOKS[book][2]) return msg(t("culto.q.chapters", { book: BOOKS[book][0], n: BOOKS[book][2] }), true);
  closePicker();
  addItem(book, p.chapter, p.vs, p.ve).then(it => {
    const d = mem.get(keyFor(it));
    if (d && p.vs && p.vs > d.verses.length) msg(t("culto.q.verses", { book: BOOKS[book][0], chapter: p.chapter, n: d.verses.length }), true);
  });
  $("#q").select();
}

// ---------- início ----------
function reloadAll() {
  items.forEach(it => { errs.delete(it.id); redrawCard(it.id); });
  items.forEach(loadCard);
}

(async function init() {
  await I18N.ready;
  I18N.apply();
  document.title = t("culto.title");
  await loadPrefs();
  version = await loadVersion();
  VERSIONS.forEach(v => $("#version").add(new Option(v.label, v.id)));
  $("#version").value = version.id;
  Pager.init();
  applyPrefs();

  $("#version").onchange = async e => {
    version = VERSIONS.find(v => v.id === e.target.value) || VERSIONS[0];
    await saveVersion(version.id);
    reloadAll();
    updateBadge();
  };
  $("#sizeDown").onclick = () => { prefs.size = Math.max(14, prefs.size - 2); applyPrefs(); savePrefs(); };
  $("#sizeUp").onclick = () => { prefs.size = Math.min(44, prefs.size + 2); applyPrefs(); savePrefs(); };
  document.querySelectorAll("[data-theme-btn]").forEach(b => b.onclick = () => { prefs.theme = b.dataset.themeBtn; applyPrefs(); savePrefs(); });
  $("#width").onchange = e => { prefs.width = +e.target.value; applyPrefs(); savePrefs(); };
  $("#mode").onchange = e => { prefs.mode = e.target.value; applyPrefs(); savePrefs(); };
  $("#allView").onchange = e => {
    prefs.view = e.target.checked ? "all" : "single";
    applyPrefs(); savePrefs();
    Pager.reveal(els.get(activeId));
    syncNext();
  };
  alignRefresh = Pager.buildAlign($("#alignGroup"), () => prefs.align, v => { prefs.align = v; applyPrefs(); savePrefs(); });
  alignRefresh();
  [["booksBtn", "book"], ["newBtn", "plus"], ["saveBtn", "save"], ["readBtn", "folder"]].forEach(([id, ic]) => { $("#" + id).replaceChildren(icon(ic)); });
  $("#booksBtn").onclick = () => (pickMode === "new" ? closePicker() : openPicker("new", "book"));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && pickMode) closePicker(); });
  new ResizeObserver(() => { if (pickMode) placePicker(); }).observe($(".finder"));
  window.addEventListener("resize", () => { if (pickMode) placePicker(); });
  $("#newBtn").onclick = newList;
  $("#saveBtn").onclick = openSavePanel;
  $("#readBtn").onclick = openReadPanel;
  $("#q").addEventListener("keydown", e => {
    if (e.key === "Enter") submitQuery();
    if (e.key === "Escape") { $("#q").value = ""; msg(""); }
  });
  $("#q").addEventListener("input", () => msg(""));

  // janela única: o popup pede para esta janela vir para a frente (ou mostrar a leitura do plano)
  $("#goReader").onclick = () => { location.href = chrome.runtime.getURL("reader.html"); };
  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (msg && msg.type === "win-show") {
      chrome.windows.getCurrent().then(w => {
        send({ ok: true, windowId: w.id });
        if (msg.view === "reader") {
          const q = new URLSearchParams({ items: itemsParam(msg.items || []) });
          location.href = chrome.runtime.getURL("reader.html?" + q);
        } else setTimeout(() => $("#q").focus(), 150);
      });
      return true;
    }
  });

  // mudanças feitas em outra janela (configurações, leitor): versão e aparência
  chrome.storage.onChanged.addListener(changes => {
    if (changes.version) {
      const v = VERSIONS.find(x => x.id === changes.version.newValue);
      if (v && v.id !== version.id) { version = v; $("#version").value = v.id; reloadAll(); updateBadge(); }
    }
    if (changes.bibleMeta || changes.offlineOnly) updateBadge();
    if (changes.prefs) { prefs = { ...PREFS_DEFAULT, ...(changes.prefs.newValue || {}) }; applyPrefs(); }
  });


  // restaura os trechos da última vez
  const saved = await chrome.storage.local.get(["cultoList", "cultoActive"]);
  setList(Array.isArray(saved.cultoList) ? saved.cultoList : [], saved.cultoActive);
  updateBadge();
  $("#q").focus();
})();
