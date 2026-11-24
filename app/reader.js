const $ = s => document.querySelector(s);
const PREFS_DEFAULT = { size: 18, theme: "light", width: 32, mode: "flow", align: "justify" };
let alignRefresh = () => {};
let prefs = { ...PREFS_DEFAULT };
let plan = null;
let version = VERSIONS[0];
const sections = []; // {tid, i, el, body, markBtn, note, done, src}

const label = c => `${c.pt} ${c.chapter}`;
const trackOf = id => plan && plan.tracks.find(t => t.id === id);

// ---------- preferências ----------
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
  document.body.dataset.align = prefs.align;
  alignRefresh();
  Pager.layout();
  $("#width").value = String(prefs.width);
  $("#mode").value = prefs.mode;
  document.querySelectorAll("[data-theme-btn]").forEach(b => b.classList.toggle("active", b.dataset.themeBtn === prefs.theme));
}

function bindToolbar() {
  $("#sizeDown").onclick = () => { prefs.size = Math.max(14, prefs.size - 2); applyPrefs(); savePrefs(); };
  $("#sizeUp").onclick = () => { prefs.size = Math.min(44, prefs.size + 2); applyPrefs(); savePrefs(); };
  document.querySelectorAll("[data-theme-btn]").forEach(b => b.onclick = () => { prefs.theme = b.dataset.themeBtn; applyPrefs(); savePrefs(); });
  VERSIONS.forEach(v => $("#version").add(new Option(v.label, v.id)));
  $("#version").onchange = async e => {
    Narrator.stop();
    version = VERSIONS.find(v => v.id === e.target.value) || VERSIONS[0];
    await saveVersion(version.id);
    await Promise.all(sections.map(loadSection));
  };
  $("#width").onchange = e => { prefs.width = +e.target.value; applyPrefs(); savePrefs(); };
  $("#mode").onchange = e => { prefs.mode = e.target.value; applyPrefs(); savePrefs(); };
  alignRefresh = Pager.buildAlign($("#alignGroup"), () => prefs.align, v => { prefs.align = v; applyPrefs(); savePrefs(); });
  alignRefresh();
}

// ---------- seções ----------
function addSection(tid, i) {
  const c = CHAPTERS[i];
  if (!c) return null;
  const el = document.createElement("section");
  el.className = "chapter";
  for (const [tag, cls] of [["div", "kicker"], ["h1", ""], ["div", "body"]]) { const n = document.createElement(tag); if (cls) n.className = cls; el.append(n); }
  const act = document.createElement("div"); act.className = "actions";
  const mk = document.createElement("button"); mk.className = "mark"; mk.hidden = true;
  const nt = document.createElement("span"); nt.className = "note";
  act.append(mk, nt); el.append(act);
  el.querySelector("h1").textContent = label(c);
  const sec = {
    tid, i, el, done: false, src: "",
    body: el.querySelector(".body"),
    markBtn: el.querySelector(".mark"),
    note: el.querySelector(".note")
  };
  sec.markBtn.onclick = () => onMark(sec);
  $("#content").appendChild(el);
  sections.push(sec);
  decorate(sec);
  return sec;
}

function decorate(sec) {
  const t = trackOf(sec.tid);
  sec.el.querySelector(".kicker").textContent =
    [t ? t.name : "", version.short, sec.src ? "fonte: " + sec.src : ""].filter(Boolean).join(" · ");
  setCredit();
}

function setCredit() { const c = $("#credit"); if (c) c.textContent = version.credit || (version.third ? I18N.t("reader.credit.third") : ""); }

async function loadSection(sec) {
  sec.src = "";
  decorate(sec);
  { const p = document.createElement("p"); p.className = "status"; p.textContent = I18N.t("reader.loading"); sec.body.replaceChildren(p); }
  try {
    const { verses, source } = await fetchVerses(CHAPTERS[sec.i], version);
    await Selah.ready;
    renderVerses(sec, verses);
    sec.src = source;
    decorate(sec);
  } catch (e) {
    renderError(sec, e);
  }
}

function renderVerses(sec, verses) {
  const wrap = document.createElement("div");
  wrap.className = "verses";
  for (const v of verses) {
    if (!v.text) continue;   // versículo omitido nesta edição (ex.: Lc 17:36 na WEB)
    if (v.heading) {
      const h = document.createElement("h2");
      h.textContent = v.heading;
      wrap.append(h);
    }
    const sp = document.createElement("span");
    sp.className = "v" + (v.brk ? " brk" : "");
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = v.n;
    Selah.fill(sp, n, v, version.id + "|g" + sec.i);
    wrap.append(sp);
  }
  sec.body.replaceChildren(wrap);
}

function renderError(sec, e) {
  const box = document.createElement("div");
  box.className = "error";
  const msg = document.createElement("div");
  msg.textContent = e.message || String(e);
  const retry = document.createElement("button");
  retry.textContent = I18N.t("reader.retry");
  retry.style.marginTop = "8px";
  retry.onclick = () => loadSection(sec);
  box.append(msg, retry);
  if (e.debug) {
    const d = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = I18N.t("reader.techDetails");
    const pre = document.createElement("pre");
    pre.textContent = e.debug;
    const copy = document.createElement("button");
    copy.textContent = I18N.t("reader.copyDiag");
    copy.onclick = () => navigator.clipboard.writeText((e.message || "") + "\n\n" + e.debug);
    d.append(s, pre, copy);
    box.append(d);
  }
  sec.body.replaceChildren(box);
}

// ---------- marcar como lido ----------
async function onMark(sec) {
  const r = await markTrackRead(sec.tid, sec.i);
  if (r.ok) {
    sec.done = true;
    const t = r.track;
    const chs = trackChapters(t);
    sec.note.textContent = !t.loop && t.pos >= chs.length
      ? I18N.t("reader.finished")
      : I18N.t("reader.nextLabel", { ref: label(CHAPTERS[chs[t.pos]]) });
  }
  await refreshButtons();
}

async function refreshButtons() {
  plan = await loadPlan();
  for (const sec of sections) {
    const t = trackOf(sec.tid);
    if (!t) continue; // capítulo avulso (sem trilha): sem botão
    const b = sec.markBtn;
    b.hidden = false;
    if (sec.done) {
      b.textContent = I18N.t("reader.read");
      b.disabled = true;
      b.classList.add("done");
      continue;
    }
    const chs = trackChapters(t);
    const isCurrent = t.pos < chs.length && chs[t.pos] === sec.i;
    b.textContent = I18N.t("reader.markRead");
    b.disabled = !isCurrent;
    b.title = isCurrent ? "" : I18N.t("reader.notNext");
    decorate(sec);
  }
}

// ---------- continuar lendo ----------
function updateNextButton() {
  const last = sections[sections.length - 1];
  Pager.hooks.next = last && last.i + 1 < CHAPTERS.length ? loadNextChapter : null;
  Pager.refreshBar();
}
async function loadNextChapter() {
  const last = sections[sections.length - 1];
  const sec = last && addSection("", last.i + 1);
  if (!sec) return;
  updateNextButton();
  Pager.reveal(sec.el);
  await loadSection(sec);
}

// ---------- início ----------
// Troca o conteúdo da janela pelos capítulos pedidos (a janela é sempre a mesma)
function openItems(items) {
  $("#content").replaceChildren();
  sections.length = 0;
  if (!items.length) items = [{ tid: "", i: 0 }];
  items.forEach(it => addSection(it.tid, it.i));
  chrome.storage.local.set({ readerItems: items });   // para voltar do culto para a mesma leitura
  document.title = sections.map(s => label(CHAPTERS[s.i])).join(" · ") + " — Veredas · " + version.short;
  updateNextButton();
  Pager.reset();
  return Promise.all(sections.map(loadSection)).then(refreshButtons);
}

(async function init() {
  await I18N.ready;
  I18N.apply();
  await loadCustomVersions();
  await loadPrefs();
  Pager.init();
  Narrator.attach({ root: () => $("#content"), viewport: () => $("#pager"), lang: () => version.lang || "pt", notify: m => { const e = $("#pageinfo"); if (e) e.textContent = m; } });
  Dict.attach({ root: () => $("#content"), lang: () => version.lang || "pt", notify: m => { const e = $("#pageinfo"); if (e) e.textContent = m; } });
  applyPrefs();
  bindToolbar();
  $("#goCulto").onclick = () => { location.href = chrome.runtime.getURL("culto.html"); };
  version = await loadVersion();
  $("#version").value = version.id;
  plan = await loadPlan();
  let items = parseItems(new URLSearchParams(location.search).get("items"));
  if (!items.length) {
    const { readerItems } = await chrome.storage.local.get("readerItems");
    items = parseItems((readerItems || []).map(x => `${x.tid || "x"}:${x.i}`).join(","));
  }
  if (!items.length) items = todayItems(plan);
  await openItems(items);
  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (msg && msg.type === "win-show") {
      chrome.windows.getCurrent().then(w => {
        send({ ok: true, windowId: w.id });
        if (msg.view === "culto") location.href = chrome.runtime.getURL("culto.html");
      });
      if (msg.view === "reader") loadPlan().then(p => { plan = p; return openItems((msg.items || []).filter(x => CHAPTERS[x.i])); });
      return true; // resposta assíncrona
    }
  });
  chrome.storage.onChanged.addListener(changes => {
    if (changes[PLAN_KEY]) refreshButtons();
    if (changes.version) {
      const v = VERSIONS.find(x => x.id === changes.version.newValue);
      if (v && v.id !== version.id) { version = v; $("#version").value = v.id; Promise.all(sections.map(loadSection)); }
    }
    if (changes.prefs) { prefs = { ...PREFS_DEFAULT, ...(changes.prefs.newValue || {}) }; applyPrefs(); }
  });
})();
