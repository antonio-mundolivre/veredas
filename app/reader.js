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
let endBox = null;   // as opções do fim da leitura: ficam depois do último capítulo
function addSection(tid, i) {
  const c = CHAPTERS[i];
  if (!c) return null;
  const el = document.createElement("section");
  el.className = "chapter";
  for (const [tag, cls] of [["div", "kicker"], ["h1", ""], ["div", "body"]]) { const n = document.createElement(tag); if (cls) n.className = cls; el.append(n); }
  el.querySelector("h1").textContent = label(c);
  const sec = { tid, i, el, done: false, src: "", body: el.querySelector(".body") };
  $("#content").insertBefore(el, endBox);   // endBox null = no fim
  sections.push(sec);
  decorate(sec);
  return sec;
}

// Opções do fim da leitura (só de trilhas): aparecem uma vez, depois do último capítulo da seleção
function buildEnd() {
  const mk = (cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "choice " + cls; b.hidden = true; b.onclick = fn; return b; };
  endBox = document.createElement("div"); endBox.className = "actions endwrap";
  const row = document.createElement("div"); row.className = "endchoice"; row.title = I18N.t("reader.endHint");
  endBox.btnChap = mk("primary", () => advance("chapter"));
  endBox.btnTrack = mk("", () => advance("track"));
  endBox.btnDone = mk("", () => advance("done"));
  endBox.note = document.createElement("div"); endBox.note.className = "note";
  row.append(endBox.btnChap, endBox.btnTrack, endBox.btnDone);
  endBox.append(row, endBox.note);
  $("#content").append(endBox);
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

// ---------- fim da leitura: continuar, próxima trilha ou encerrar o dia ----------
// Os capítulos escolhidos aparecem juntos, em páginas; as opções só vêm depois da última página.
// Qualquer opção marca como lidos os capítulos que estavam na tela.
const lastRef = g => { const ab = I18N.abbr(), c = CHAPTERS[g]; return `${(ab && ab[c.book]) || c.pt} ${c.chapter}`; };   // nome abreviado
const curTid = () => (sections[0] && sections[0].tid) || "";

function nextTrackOf(tid) {
  const k = plan ? plan.tracks.findIndex(t => t.id === tid) : -1;
  for (let j = k + 1; k >= 0 && j < plan.tracks.length; j++) if (trackStatus(plan.tracks[j]).state === "todo") return plan.tracks[j];
  return null;
}

// próximo capítulo da fila que ainda não está na tela
function nextToShow(t) {
  for (let k = 0; k < 400; k++) {
    const g = queueAt(t, k);
    if (g === undefined) return undefined;
    if (!sections.some(s => s.i === g)) return g;
  }
  return undefined;
}

async function markShown() {
  for (const sec of sections) {
    if (sec.done || !sec.tid) continue;
    await markTrackRead(sec.tid, sec.i);   // se já estava lido (ou não é o da vez), não marca de novo
    sec.done = true;
  }
  plan = await loadPlan();
}

async function advance(kind) {
  const tid = curTid();
  [endBox.btnChap, endBox.btnTrack, endBox.btnDone].forEach(b => b.disabled = true);
  await markShown();
  const t = trackOf(tid);
  if (kind === "chapter" && t) {
    const g = nextToShow(t);
    if (g !== undefined) {   // acrescenta o próximo capítulo ao que está sendo lido
      const sec = addSection(tid, g);
      chrome.storage.local.set({ readerItems: sections.map(s => ({ tid: s.tid, i: s.i })) });
      await loadSection(sec);
      await refreshButtons();
      Pager.reveal(sec.el);
      return;
    }
  } else if (kind === "track") {
    const nt = nextTrackOf(tid);
    if (nt) return openItems(trackStatus(nt).items.map(i => ({ tid: nt.id, i })));
  }
  return showDayEnd();
}

// tela de encerramento: resumo do dia
function showDayEnd() {
  Narrator.stop();
  sections.length = 0; endBox = null;
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const el = mk("section", "chapter dayend");
  const badge = mk("div", "de-badge");
  badge.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const cards = mk("div", "de-cards");
  let total = 0;
  (plan ? plan.tracks : []).forEach(t => {
    const chs = trackChapters(t);
    const gs = [...new Set(t.history.filter(x => isToday(x) && x.c === t.cycles && chs[x.p] !== undefined).map(x => chs[x.p]))];
    if (!gs.length) return;
    total += gs.length;
    const card = mk("div", "de-card");
    const top = mk("div", "de-top"); top.append(mk("span", "de-name", t.name), mk("span", "de-count", I18N.t("reader.dayChapters", { n: gs.length })));
    const chips = mk("div", "de-chips"); gs.forEach(g => chips.append(mk("span", "de-chip", lastRef(g))));
    card.append(top, chips);
    const pct = chs.length ? Math.min(100, Math.round(t.pos / chs.length * 100)) : 0;
    const bar = mk("div", "de-bar"); const fill = mk("div"); fill.style.width = pct + "%"; bar.append(fill);
    const foot = mk("div", "de-foot");
    const nx = queueAt(t, 0, chs);
    foot.append(mk("span", "", I18N.t("reader.dayProgress", { pct })), mk("span", "", nx !== undefined ? I18N.t("reader.dayNext", { ref: lastRef(nx) }) : I18N.t("reader.finished")));
    card.append(bar, foot); cards.append(card);
  });
  const date = new Date().toLocaleDateString(I18N.locale, { weekday: "long", day: "numeric", month: "long" });
  el.append(badge, mk("h2", "de-title", I18N.t("reader.dayDone")), mk("p", "de-sub", date + (total ? " · " + I18N.t("reader.dayChapters", { n: total }) : "")));
  if (cards.children.length) el.append(cards);
  el.append(mk("p", "de-blessing", I18N.t("reader.dayDoneText")));
  const act = mk("div", "de-act");
  const close = mk("button", "choice primary", I18N.t("reader.closeWindow")); close.type = "button";
  close.onclick = () => { if (document.documentElement.classList.contains("web")) { location.href = "index.html"; return; } window.close(); };   // no app web volta ao início; na extensão fecha a janela
  act.append(close); el.append(act);
  $("#content").replaceChildren(el);
  chrome.storage.local.set({ readerItems: [] });
  document.title = I18N.t("reader.dayDone") + " — Veredas";
  Pager.hooks.next = null; Pager.refreshBar(); Pager.reset();
}

// botões do fim: mostram para onde cada escolha leva
async function refreshButtons() {
  plan = await loadPlan();
  const t = trackOf(curTid());
  if (!t || !endBox) return;
  [endBox.btnChap, endBox.btnTrack, endBox.btnDone].forEach(b => { b.disabled = false; });
  const g = nextToShow(t);
  endBox.btnChap.hidden = g === undefined;
  if (g !== undefined) endBox.btnChap.textContent = I18N.t("reader.nextChapter", { ref: lastRef(g) });
  const nt = nextTrackOf(t.id);
  endBox.btnTrack.hidden = !nt;
  if (nt) endBox.btnTrack.textContent = I18N.t("reader.nextTrack", { ref: lastRef(trackStatus(nt).items[0]) });
  endBox.btnDone.hidden = false;
  endBox.btnDone.textContent = I18N.t("reader.finishDay");
  endBox.note.textContent = g === undefined && !t.loop ? I18N.t("reader.finished") : "";
  sections.forEach(decorate);
}

// ---------- continuar lendo ----------
function updateNextButton() {
  const last = sections[sections.length - 1];
  Pager.hooks.next = last && !last.tid && last.i + 1 < CHAPTERS.length ? loadNextChapter : null;   // em trilha, quem avança é o fim do capítulo
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
// Troca o conteúdo da janela pelos capítulos pedidos (a janela é sempre a mesma). Vale a trilha do primeiro item,
// com todos os seus capítulos, um depois do outro; as outras trilhas vêm pelo "próxima trilha" do fim da leitura.
function openItems(items) {
  Narrator.stop();
  $("#content").replaceChildren();
  sections.length = 0; endBox = null;
  const first = items[0] || { tid: "", i: 0 };
  const list = first.tid ? items.filter(x => x.tid === first.tid) : [first];
  list.forEach(it => addSection(it.tid, it.i));
  if (first.tid) buildEnd();
  chrome.storage.local.set({ readerItems: list });   // para voltar do culto para a mesma leitura
  document.title = label(CHAPTERS[first.i]) + (list.length > 1 ? " +" + (list.length - 1) : "") + " — Veredas · " + version.short;
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
  if (!items.length) { const t = plan && plan.tracks.find(x => queueAt(x, 0) !== undefined); if (t) items = [{ tid: t.id, i: queueAt(t, 0) }]; }   // tudo lido hoje: abre o próximo capítulo da primeira trilha
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
