// Plano de leitura: trilhas, progresso, ritmo, migração e sincronização.
// Leitura baseada no que falta: o "capítulo de hoje" é sempre o próximo não lido.

const WEEK_ALL = [0, 1, 2, 3, 4, 5, 6];
const weekName = d => I18N.t("state.week." + d);
const MAX_TRACKS = 8;
const UNIT_DAYS = { d: 1, m: 30, y: 365 };
const PLAN_KEY = "plan";
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

const SCOPE_PRESETS = [
  { id: "all", get label() { return I18N.t("state.scope.all"); },                          books: range(0, 65) },
  { id: "ot", get label() { return I18N.t("state.scope.ot"); },                    books: range(0, 38) },
  { id: "nt", get label() { return I18N.t("state.scope.nt"); },                      books: range(39, 65) },
  { id: "pentateuch", get label() { return I18N.t("state.scope.pentateuch"); },  books: range(0, 4) },
  { id: "history", get label() { return I18N.t("state.scope.history"); },           books: range(5, 16) },
  { id: "poetry", get label() { return I18N.t("state.scope.poetry"); },             books: range(17, 21) },
  { id: "prophets", get label() { return I18N.t("state.scope.prophets"); },        books: range(22, 38) },
  { id: "gospels", get label() { return I18N.t("state.scope.gospels"); },                           books: range(39, 42) },
  { id: "epistles", get label() { return I18N.t("state.scope.epistles"); },             books: range(44, 64) },
  { id: "psalms", get label() { return I18N.t("state.scope.psalms"); },                               books: [18] },
  { id: "proverbs", get label() { return I18N.t("state.scope.proverbs"); },                           books: [19] },
];

// ---------- datas ----------
const todayStr = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD (fuso local)
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
const fmtDate = s => parseDate(s).toLocaleDateString(I18N.locale, { day: "2-digit", month: "2-digit", year: "numeric" });
const dow = s => parseDate(s).getDay();

// ---------- trilhas ----------
const _chCache = new Map();
function trackChapters(t) {
  const key = t.books.join(",") + "|" + (t.order || "canon");
  if (!_chCache.has(key)) {
    const set = new Set(t.books);
    const base = CHAPTERS.map((c, i) => (set.has(c.book) ? i : -1)).filter(i => i >= 0);
    let list = base;
    if (t.order === "parallel") {
      // intercala Antigo e Novo Testamento proporcionalmente, para terminarem juntos
      const ot = base.filter(i => CHAPTERS[i].book < 39), nt = base.filter(i => CHAPTERS[i].book >= 39);
      if (ot.length && nt.length) {
        list = [...ot.map((g, k) => [(k + 0.5) / ot.length, 0, g]), ...nt.map((g, k) => [(k + 0.5) / nt.length, 1, g])]
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
      }
    }
    _chCache.set(key, list);
  }
  return _chCache.get(key);
}

function newTrack(o = {}) {
  return {
    id: o.id || "t" + Math.random().toString(36).slice(2, 8),
    name: o.name || I18N.t("state.trackDefault"),
    role: o.role || "main",   // "main" = trilha principal, "sec" = secundária (sempre em loop)
    order: o.order || "canon", // "canon" ou "parallel" (Antigo e Novo Testamento intercalados)
    books: (o.books || range(0, 65)).slice().sort((a, b) => a - b),
    pace: o.pace || { mode: "perDay", n: 1 },
    loop: !!o.loop,
    weekdays: o.weekdays ? o.weekdays.slice() : WEEK_ALL.slice(),
    pos: o.pos || 0,          // posição dentro da trilha (0 = primeiro capítulo)
    cycles: 0,                // ciclos completos (trilhas em loop)
    todayDate: "", todayDone: 0,
    todayExtra: 0,            // capítulos extras escolhidos para hoje (só vale com todayDate = hoje)
    todayQuota: 0,            // programação própria de um "novo hoje" (0 = segue o plano; só vale com todayDate = hoje)
    holes: [],                // posições já lidas que o usuário desmarcou para reler (ficam no começo da fila)
    history: []               // [{d, p, c, z?}] capítulos lidos, do mais antigo ao mais novo (últimos 12); z = de um "hoje" já encerrado
  };
}

function finishInPace(days) {
  const unit = days % 365 === 0 ? "y" : days % 30 === 0 ? "m" : "d";
  const num = unit === "y" ? days / 365 : unit === "m" ? days / 30 : days;
  return { mode: "finishIn", days, num, unit, end: addDays(todayStr(), days - 1) };
}

const secTrack = (books, n = 1) => newTrack({ name: namesOf(books), role: "sec", books, pace: { mode: "perDay", n }, loop: true });
const namesOf = bs => {
  const n = bs.map(b => BOOKS[b][0]);
  return n.length > 1 ? n.slice(0, -1).join(", ") + I18N.t("state.and") + n[n.length - 1] : (n[0] || I18N.t("state.trackDefault"));
};

const TEMPLATES = [
  { id: "mine", get name() { return I18N.t("state.tpl.mine.name"); },
    get desc() { return I18N.t("state.tpl.mine.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.bible"), pace: { mode: "perDay", n: 1 } }), secTrack([18])] },
  { id: "y1", get name() { return I18N.t("state.tpl.y1.name"); },
    get desc() { return I18N.t("state.tpl.y1.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.y1"), pace: finishInPace(365) })] },
  { id: "y2", get name() { return I18N.t("state.tpl.y2.name"); },
    get desc() { return I18N.t("state.tpl.y2.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.y2"), pace: finishInPace(730) })] },
  { id: "par", get name() { return I18N.t("state.tpl.par.name"); },
    get desc() { return I18N.t("state.tpl.par.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.par"), order: "parallel", pace: finishInPace(365) })] },
  { id: "nt90", get name() { return I18N.t("state.tpl.nt90.name"); },
    get desc() { return I18N.t("state.tpl.nt90.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.nt"), books: range(39, 65), pace: finishInPace(90) })] },
  { id: "yps", get name() { return I18N.t("state.tpl.yps.name"); },
    get desc() { return I18N.t("state.tpl.yps.desc"); },
    build: () => [newTrack({ name: I18N.t("state.trackName.y1"), pace: finishInPace(365) }), secTrack([18]), secTrack([19])] },
];

// ---------- ritmo ----------
const isScheduled = (t, s) => !t.weekdays || t.weekdays.includes(dow(s));
function scheduledDaysBetween(t, from, to) {
  let n = 0, cur = from;
  for (let i = 0; i < 4000 && cur <= to; i++) { if (isScheduled(t, cur)) n++; cur = addDays(cur, 1); }
  return n;
}

// leitura registrada no "hoje" em andamento (entradas z são de um hoje que o usuário encerrou)
const isToday = h => h.d === todayStr() && !h.z;

// Fila de leitura: primeiro os capítulos reabertos (holes), depois a partir de pos.
// Devolve o índice global do capítulo na posição k da fila (ou undefined se acabou).
function queueAt(t, k, chs = trackChapters(t)) {
  const h = t.holes || [];
  if (k < h.length) return chs[h[k]];
  let p = t.pos + (k - h.length);
  if (p >= chs.length) { if (!t.loop || !chs.length) return undefined; p %= chs.length; }
  return chs[p];
}
const queueSize = (t, len) => (t.holes || []).length + (t.loop ? len : Math.max(0, len - t.pos));

// Situação da trilha hoje: quanto ler, o que falta, em que estado está.
function trackStatus(t) {
  const chs = trackChapters(t), len = chs.length, today = todayStr();
  const holes = (t.holes || []).length;
  const done = t.todayDate === today ? t.todayDone : 0;
  const extra = t.todayDate === today ? (t.todayExtra || 0) : 0;
  const finished = !t.loop && t.pos >= len && holes === 0;
  let quota = 0, overdue = false;
  const own = t.todayDate === today ? (t.todayQuota || 0) : 0;        // programação própria deste "novo hoje"
  if (!finished && len > 0 && own > 0) quota = own;
  else if (!finished && len > 0 && isScheduled(t, today)) {
    if (t.pace.mode === "perDay") quota = t.pace.n;
    else {
      const remStart = len - t.pos + holes + done;       // o que faltava ao começar o dia
      const left = scheduledDaysBetween(t, today, t.pace.end);
      if (left > 0) quota = Math.ceil(remStart / left);   // recalcula sobre o que falta
      else { overdue = true; quota = Math.min(remStart, Math.max(1, Math.ceil(len / Math.max(1, t.pace.days)))); }
    }
  }
  const total = quota + extra;                            // leitura de hoje = prevista + extras
  const remaining = finished || !len ? 0 : Math.max(0, Math.min(total - done, queueSize(t, len)));
  const items = [];
  for (let k = 0; k < remaining; k++) { const g = queueAt(t, k, chs); if (g === undefined) break; items.push(g); }
  const planned = Math.min(remaining, Math.max(0, quota - done));   // dos pendentes, quantos são os programados (o resto são extras escolhidos)
  const state = finished ? "finished" : total === 0 ? "rest" : remaining === 0 ? "done" : "todo";
  return { chs, len, done, quota, extra, total, remaining, planned, items, state, overdue, finished };
}

// Próximos n capítulos da fila (reabertos primeiro)
function nextChapters(t, n, from = 0) {
  const chs = trackChapters(t), out = [];
  for (let k = from; k < from + n; k++) { const g = queueAt(t, k, chs); if (g === undefined) break; out.push(g); }
  return out;
}

// Últimos capítulos lidos antes de hoje (do mais recente), prontos para desmarcar: [{p: posição, g: índice global}]
// Tudo que vem antes de pos e não foi reaberto conta como lido; assim também vale para quem começou a trilha no meio.
function recentRead(t, n = 5) {
  const chs = trackChapters(t), out = [], holes = new Set(t.holes || []);
  const hoje = new Set(t.history.filter(h => isToday(h) && h.c === t.cycles).map(h => h.p));   // esses aparecem em "Hoje"
  for (let p = Math.min(t.pos, chs.length) - 1; p >= 0 && out.length < n; p--) {
    if (holes.has(p) || hoje.has(p)) continue;
    out.push({ p, g: chs[p] });
  }
  return out;
}

// Data prevista de término (trilhas sem loop)
function finishEstimate(t) {
  if (t.loop || !t.weekdays.length) return null;
  const st = trackStatus(t);
  if (st.finished || !st.len) return null;
  if (t.pace.mode === "finishIn") return t.pace.end;
  let rem = st.len - t.pos, day = todayStr(), cap = st.state === "todo" ? st.remaining : 0;
  for (let i = 0; i < 6000; i++) {
    if (i > 0) cap = isScheduled(t, day) ? t.pace.n : 0;
    rem -= cap;
    if (rem <= 0) return day;
    day = addDays(day, 1);
  }
  return null;
}

function paceText(t) {
  let txt;
  if (t.pace.mode === "perDay") {
    const est = finishEstimate(t);
    txt = I18N.t("state.pace.perDay", { n: t.pace.n }) + (est ? I18N.t("state.pace.forecast", { date: fmtDate(est) }) : t.loop ? I18N.t("state.pace.loop") : "");
  } else {
    txt = I18N.t("state.pace.goal", { date: fmtDate(t.pace.end) }) + (trackStatus(t).overdue ? I18N.t("state.pace.overdue") : "");
  }
  if (t.weekdays.length < 7) txt += " · " + t.weekdays.map(weekName).join(", ");
  return txt;
}

// "Gênesis 5–7; Êxodo 1"
function formatRefs(list) {
  const idxs = list.slice().sort((a, b) => a - b); // só para exibir: agrupa capítulos do mesmo livro
  const parts = [];
  for (let i = 0; i < idxs.length;) {
    let j = i;
    while (j + 1 < idxs.length && idxs[j + 1] === idxs[j] + 1 && CHAPTERS[idxs[j + 1]].book === CHAPTERS[idxs[i]].book) j++;
    const a = CHAPTERS[idxs[i]], b = CHAPTERS[idxs[j]];
    parts.push(i === j ? `${a.pt} ${a.chapter}` : `${a.pt} ${a.chapter}–${b.chapter}`);
    i = j + 1;
  }
  return parts.join("; ");
}

// itens passados ao leitor: "idDaTrilha:índiceGlobal,..."  ("x" = sem trilha)
const itemsParam = items => items.map(x => `${x.tid || "x"}:${x.i}`).join(",");
function parseItems(raw) {
  return (raw || "").split(",").filter(Boolean).map(s => {
    const [tid, i] = s.split(":");
    return { tid: tid === "x" ? "" : tid, i: +i };
  }).filter(x => CHAPTERS[x.i]);
}

// capítulos de hoje de todas as trilhas (só o que ainda está pendente; vazio se tudo já foi lido hoje)
function todayItems(plan) {
  const items = [];
  (plan ? plan.tracks : []).forEach(t => { const s = trackStatus(t); if (s.state === "todo") s.items.forEach(i => items.push({ tid: t.id, i })); });
  return items;
}

// ---------- armazenamento ----------
let _syncFlag = null; // em cache, para gravar na hora (sem esperar leitura) ao fechar a página
async function syncEnabled() {
  if (_syncFlag !== null) return _syncFlag;
  const { syncPlan } = await chrome.storage.local.get("syncPlan");
  return (_syncFlag = !!syncPlan);
}

// Converte o formato antigo (um capítulo + Salmo em loop) para trilhas
async function migrateOld() {
  const old = await chrome.storage.local.get(["chapterIdx", "psalmIdx", "psalmCycles", "history"]);
  if (old.chapterIdx === undefined && old.psalmIdx === undefined) return null;
  const today = todayStr();
  const hist = Array.isArray(old.history) ? old.history : [];
  const ch = hist.filter(h => h.type === "chapter"), ps = hist.filter(h => h.type === "psalm");
  const bible = newTrack({ name: I18N.t("state.trackName.bible"), role: "main", pace: { mode: "perDay", n: 1 }, pos: Math.min(old.chapterIdx || 0, CHAPTERS.length) });
  const psalms = newTrack({ name: "Salmos", role: "sec", books: [18], pace: { mode: "perDay", n: 1 }, loop: true, pos: Math.max(0, (old.psalmIdx || 1) - 1) });
  psalms.cycles = old.psalmCycles || 0;
  bible.todayDate = psalms.todayDate = today;
  bible.todayDone = ch.filter(h => h.date === today).length;
  psalms.todayDone = ps.filter(h => h.date === today).length;
  bible.history = ch.slice(-8).filter(h => typeof h.prev === "number").map(h => ({ d: h.date, p: h.prev, c: 0 }));
  psalms.history = ps.slice(-8).filter(h => h.prev && typeof h.prev === "object").map(h => ({ d: h.date, p: h.prev.idx - 1, c: h.prev.cycles }));
  return { v: 2, tracks: [bible, psalms] };
}

// Planos antigos não tinham papel: a primeira trilha é a principal, as demais são secundárias.
function normalizePlan(p) {
  if (!p || !Array.isArray(p.tracks)) return p;
  p.tracks.forEach((t, i) => {
    if (!t.role) t.role = i === 0 ? "main" : "sec";
    if (!t.order) t.order = "canon";
    t.history = Array.isArray(t.history) ? t.history : [];
    t.todayExtra = t.todayExtra > 0 ? Math.floor(t.todayExtra) : 0;
    t.todayQuota = t.todayQuota > 0 ? Math.floor(t.todayQuota) : 0;
    t.holes = [...new Set(Array.isArray(t.holes) ? t.holes : [])].filter(h => Number.isInteger(h) && h >= 0 && h < t.pos).sort((a, b) => a - b);
  });
  p.tracks.sort((a, b) => (a.role === "main" ? 0 : 1) - (b.role === "main" ? 0 : 1));
  return p;
}

async function loadPlan() {
  const useSync = await syncEnabled();
  let { [PLAN_KEY]: plan } = await (useSync ? chrome.storage.sync : chrome.storage.local).get(PLAN_KEY);
  if (!plan && useSync) ({ [PLAN_KEY]: plan } = await chrome.storage.local.get(PLAN_KEY));
  if (!plan) {
    plan = await migrateOld();
    if (plan) await savePlan(plan);
  }
  return normalizePlan(plan) || null;
}

function savePlan(plan) {
  if (_syncFlag !== null) return (_syncFlag ? chrome.storage.sync : chrome.storage.local).set({ [PLAN_KEY]: plan });
  return syncEnabled().then(useSync => (useSync ? chrome.storage.sync : chrome.storage.local).set({ [PLAN_KEY]: plan }));
}

async function hasRemotePlan() {
  const { [PLAN_KEY]: p } = await chrome.storage.sync.get(PLAN_KEY);
  return !!p;
}
async function enableSync(keepRemote) {
  if (!keepRemote) {
    const { [PLAN_KEY]: local } = await chrome.storage.local.get(PLAN_KEY);
    if (local) await chrome.storage.sync.set({ [PLAN_KEY]: local });
  }
  await chrome.storage.local.set({ syncPlan: true });
  _syncFlag = true;
}
async function disableSync() {
  const { [PLAN_KEY]: remote } = await chrome.storage.sync.get(PLAN_KEY);
  if (remote) await chrome.storage.local.set({ [PLAN_KEY]: remote });
  await chrome.storage.local.set({ syncPlan: false });
  _syncFlag = false;
}

// ---------- marcar como lido / desmarcar ----------
// Marca como lidos os próximos "count" capítulos da fila da trilha (reabertos primeiro).
// expected: índice global do capítulo que deve ser o primeiro da fila (evita marcar o errado).
async function markTrackRead(tid, expected, count = 1) {
  const plan = await loadPlan();
  const t = plan && plan.tracks.find(x => x.id === tid);
  if (!t) return { ok: false, plan, track: null };
  const chs = trackChapters(t);
  if (!chs.length || (expected != null && queueAt(t, 0, chs) !== expected) || queueAt(t, 0, chs) === undefined) return { ok: false, plan, track: t };
  const today = todayStr();
  if (t.todayDate !== today) { t.todayDate = today; t.todayDone = 0; t.todayExtra = 0; t.todayQuota = 0; }
  for (let k = 0; k < count; k++) {
    if (queueAt(t, 0, chs) === undefined) break;
    if (t.holes.length) {
      t.history.push({ d: today, p: t.holes.shift(), c: t.cycles });
      t.todayDone++;   // reler um capítulo reaberto conta como leitura do dia
    } else {
      t.history.push({ d: today, p: t.pos, c: t.cycles });
      t.pos++; t.todayDone++;
      if (t.pos >= chs.length && t.loop) { t.pos = 0; t.cycles++; t.holes = []; }
    }
  }
  t.history = t.history.slice(-12);
  await savePlan(plan);
  return { ok: true, plan, track: t };
}

// Desmarca um capítulo já lido (posição p na trilha): ele volta para a fila e passa a ser o primeiro a ler.
// Se foi lido hoje, volta a ser pendente de hoje.
async function unmarkChapter(tid, p) {
  const plan = await loadPlan();
  const t = plan && plan.tracks.find(x => x.id === tid);
  if (!t || !(p >= 0 && p < t.pos) || t.holes.includes(p)) return { ok: false, plan, track: t || null };
  const today = todayStr();
  if (t.todayDate !== today) { t.todayDate = today; t.todayDone = 0; t.todayExtra = 0; t.todayQuota = 0; }
  let k = -1;
  for (let i = t.history.length - 1; i >= 0; i--) if (t.history[i].p === p && t.history[i].c === t.cycles) { k = i; break; }
  if (k >= 0) {
    const h = t.history.splice(k, 1)[0];
    if (isToday(h) && t.todayDone > 0) t.todayDone--;
  }
  t.holes = [...t.holes, p].sort((a, b) => a - b);
  await savePlan(plan);
  return { ok: true, plan, track: t };
}

// "Concluído hoje" desmarcado: começa um novo "hoje" na trilha. quota = programação própria deste novo hoje
// (0 ou omitida = segue o plano normal).
async function reopenDay(tid, quota = 0) {
  const plan = await loadPlan();
  const t = plan && plan.tracks.find(x => x.id === tid);
  if (!t) return { ok: false, plan, track: null };
  const today = todayStr();
  t.history.forEach(h => { if (h.d === today) h.z = 1; });   // o que foi lido antes fica no passado
  t.todayDate = today; t.todayDone = 0; t.todayExtra = 0; t.todayQuota = quota > 0 ? Math.floor(quota) : 0;
  await savePlan(plan);
  return { ok: true, plan, track: t };
}

// Define quantos capítulos extras ficam na leitura de hoje (delta relativo ao que já está pendente)
async function addTodayExtra(tid, delta) {
  const plan = await loadPlan();
  const t = plan && plan.tracks.find(x => x.id === tid);
  if (!t) return { ok: false, plan, track: null };
  const today = todayStr();
  if (t.todayDate !== today) { t.todayDate = today; t.todayDone = 0; t.todayExtra = 0; t.todayQuota = 0; }
  t.todayExtra = Math.max(0, (t.todayExtra || 0) + delta);
  await savePlan(plan);
  return { ok: true, plan, track: t };
}

// ---------- versões importadas pelo usuário ----------
async function loadCustomVersions() {
  const { customVersions } = await chrome.storage.local.get("customVersions");
  (customVersions || []).forEach(v => {
    if (!VERSIONS.some(x => x.id === v.id)) VERSIONS.push({ id: v.id, short: v.short, label: v.label + " (importada)", json: null, site: null, custom: true });
  });
}

// ---------- versão da Bíblia (BKJ é a padrão) ----------
async function loadVersion() {
  await loadCustomVersions();
  const { version } = await chrome.storage.local.get("version");
  return VERSIONS.find(v => v.id === version) || VERSIONS[0];
}
const saveVersion = id => chrome.storage.local.set({ version: id });
