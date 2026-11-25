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
  const nt = document.createElement("span"); nt.className = "note";
  const mkBtn = (cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "choice " + cls; b.hidden = true; b.onclick = fn; return b; };
  let choices = null, btnChap = null, btnTrack = null, btnDone = null;
  if (tid) {   // capítulo de uma trilha: ao terminar, o leitor pergunta o que fazer (e marca como lido ao avançar)
    btnChap = mkBtn("primary", () => advance(sec, "chapter"));
    btnTrack = mkBtn("", () => advance(sec, "track"));
    btnDone = mkBtn("", () => advance(sec, "done"));
    choices = document.createElement("div"); choices.className = "endchoice";
    choices.title = I18N.t("reader.endHint");
    choices.append(btnChap, btnTrack, btnDone);
    act.append(choices);
  }
  act.append(nt); el.append(act);
  el.querySelector("h1").textContent = label(c);
  const sec = {
    tid, i, el, done: false, src: "",
    body: el.querySelector(".body"),
    btnChap, btnTrack, btnDone,
    note: el.querySelector(".note")
  };
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

// ---------- fim do capítulo: próximo capítulo, próxima trilha ou encerrar o dia ----------
// Um capítulo por vez. Ao escolher qualquer opção, o capítulo atual é marcado como lido.
const lastRef = g => { const ab = I18N.abbr(), c = CHAPTERS[g]; return `${(ab && ab[c.book]) || c.pt} ${c.chapter}`; };   // nome abreviado

function nextTrackOf(tid) {
  const k = plan ? plan.tracks.findIndex(t => t.id === tid) : -1;
  for (let j = k + 1; k >= 0 && j < plan.tracks.length; j++) if (trackStatus(plan.tracks[j]).state === "todo") return plan.tracks[j];
  return null;
}

async function advance(sec, kind) {
  [sec.btnChap, sec.btnTrack, sec.btnDone].forEach(b => b && (b.disabled = true));
  await markTrackRead(sec.tid, sec.i);   // se o capítulo já estava lido (ou não é o da vez), não marca de novo
  plan = await loadPlan();
  if (kind === "chapter") {
    const g = trackOf(sec.tid) ? queueAt(trackOf(sec.tid), 0) : undefined;
    if (g !== undefined) return openItems([{ tid: sec.tid, i: g }]);
  } else if (kind === "track") {
    const nt = nextTrackOf(sec.tid);
    if (nt) return openItems([{ tid: nt.id, i: trackStatus(nt).items[0] }]);
  }
  return showDayEnd();
}

// tela de encerramento: resumo do que foi lido hoje
function showDayEnd() {
  Narrator.stop();
  const today = todayStr();
  sections.length = 0;
  const el = document.createElement("section"); el.className = "chapter dayend";
  const h = document.createElement("h1"); h.textContent = I18N.t("reader.dayDone");
  const p = document.createElement("p"); p.className = "dayend-text"; p.textContent = I18N.t("reader.dayDoneText");
  el.append(h, p);
  const ul = document.createElement("ul"); ul.className = "dayend-list";
  (plan ? plan.tracks : []).forEach(t => {
    const chs = trackChapters(t);
    const gs = t.history.filter(x => isToday(x) && x.c === t.cycles && chs[x.p] !== undefined).map(x => chs[x.p]);
    if (!gs.length) return;
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = t.name + ": "; li.append(b, document.createTextNode(formatRefs([...new Set(gs)])));
    ul.append(li);
  });
  if (ul.children.length) el.append(ul);
  const act = document.createElement("div"); act.className = "actions";
  const close = document.createElement("button"); close.type = "button"; close.className = "choice primary"; close.textContent = I18N.t("reader.closeWindow");
  close.onclick = () => { if (document.documentElement.classList.contains("web")) { location.href = "index.html"; return; } window.close(); };   // no app web volta ao início; na extensão fecha a janela
  act.append(close); el.append(act);
  $("#content").replaceChildren(el);
  chrome.storage.local.set({ readerItems: [] });
  document.title = I18N.t("reader.dayDone") + " — Veredas";
  Pager.hooks.next = null; Pager.refreshBar(); Pager.reset();
}

// botões do fim do capítulo: mostram para onde cada escolha leva
async function refreshButtons() {
  plan = await loadPlan();
  for (const sec of sections) {
    const t = trackOf(sec.tid);
    if (!t || !sec.btnChap) continue;   // capítulo avulso (sem trilha): sem botões
    const isHead = queueAt(t, 0) === sec.i;
    const g = queueAt(t, isHead ? 1 : 0);
    sec.btnChap.hidden = g === undefined;
    if (g !== undefined) sec.btnChap.textContent = I18N.t("reader.nextChapter", { ref: lastRef(g) });
    const nt = nextTrackOf(sec.tid);
    sec.btnTrack.hidden = !nt;
    if (nt) sec.btnTrack.textContent = I18N.t("reader.nextTrack", { ref: lastRef(trackStatus(nt).items[0]) });
    sec.btnDone.hidden = false;
    sec.btnDone.textContent = I18N.t("reader.finishDay");
    sec.note.textContent = g === undefined && !t.loop ? I18N.t("reader.finished") : "";
    decorate(sec);
  }
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
// Troca o conteúdo da janela pelo capítulo pedido (a janela é sempre a mesma). Vale só o primeiro item:
// os seguintes vêm do fim do capítulo (próximo capítulo / próxima trilha), na ordem do plano.
function openItems(items) {
  Narrator.stop();
  $("#content").replaceChildren();
  sections.length = 0;
  const first = items[0] || { tid: "", i: 0 };
  addSection(first.tid, first.i);
  chrome.storage.local.set({ readerItems: [first] });   // para voltar do culto para a mesma leitura
  document.title = label(CHAPTERS[first.i]) + " — Veredas · " + version.short;
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
