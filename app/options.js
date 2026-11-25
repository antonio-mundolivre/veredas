let saved = null;  // plano salvo
let draft = null;   // rascunho: {main, sec:{enabled,books,mode,n}, pool, secTracks} (só vale depois de "Salvar")
const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const lab = g => `${CHAPTERS[g].pt} ${CHAPTERS[g].chapter}`;
const keyOf = bs => bs.join(",");

// monta um trecho de HTML fixo do próprio código (sem dados de fora) sem usar innerHTML
function setHTML(node, html) { node.replaceChildren(...new DOMParser().parseFromString(html, "text/html").body.childNodes); }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
// texto traduzível com marcação simples: **negrito**, __itálico__, [texto](https://link) e {he:hebraico}; sem innerHTML
function orich(node, text) {
  const out = [], re = /\*\*(.+?)\*\*|__(.+?)__|\[(.+?)\]\((https?:[^)\s]+)\)|\{he:(.+?)\}/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    let e;
    if (m[1] != null) { e = document.createElement("b"); e.textContent = m[1]; }
    else if (m[2] != null) { e = document.createElement("i"); e.textContent = m[2]; }
    else if (m[3] != null) { e = document.createElement("a"); e.textContent = m[3]; e.href = m[4]; e.target = "_blank"; e.rel = "noopener"; }
    else { e = document.createElement("span"); e.lang = "he"; e.dir = "rtl"; e.textContent = m[5]; }
    out.push(e); last = re.lastIndex;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  node.replaceChildren(...out);
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const E = (k, p) => esc(I18N.t(k, p));   // frase já escapada, para montar HTML fixo com setHTML
function setStatus(msg, err) {
  $("status").textContent = msg;
  $("status").className = err ? "err" : "";
}
let saveTimer = null;
// Salva sozinho logo depois de qualquer alteração (o botão "Salvar agora" continua disponível)
function setDirty() {
  setStatus(I18N.t("options.saving"));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save({ auto: true }), 600);
}
const hhmm = () => new Date().toLocaleTimeString(I18N.locale, { hour: "2-digit", minute: "2-digit" });

// ---------- rascunho ----------
function makeDraft(plan) {
  const p = plan ? clone(plan) : { tracks: [] };
  const main = p.tracks.find(t => t.role === "main") || p.tracks[0] || newTrack({ name: I18N.t("options.defaultTrackName"), role: "main" });
  const sec = p.tracks.filter(t => t !== main);
  const pool = {};
  sec.forEach(t => (pool[keyOf(t.books)] = t));
  return {
    main, pool, secTracks: sec,
    sec: {
      enabled: sec.length > 0,
      books: [...new Set(sec.flatMap(t => t.books))].sort((a, b) => a - b),
      // paralelo (um livro por trilha) é o padrão; só vira "sequência" se já existir uma trilha única com vários livros
      mode: sec.length === 1 && sec[0].books.length > 1 ? "sequence" : "parallel",
      n: (sec[0] && sec[0].pace && sec[0].pace.n) || 1
    }
  };
}

// Recria as trilhas secundárias a partir da configuração, reaproveitando o progresso de quem já existia
function rebuildSec() {
  const s = draft.sec;
  if (!s.enabled || !s.books.length) { draft.secTracks = []; return; }
  const groups = s.mode === "parallel" ? s.books.map(b => [b]) : [s.books];
  draft.secTracks = groups.map(g => {
    const key = keyOf(g);
    let t = draft.pool[key];
    if (!t) { t = newTrack({ name: namesOf(g), role: "sec", books: g }); draft.pool[key] = t; }
    t.role = "sec"; t.loop = true; t.name = namesOf(g);
    t.pace = { mode: "perDay", n: s.n };
    return t;
  });
}

function renderAll() {
  renderMain();
  renderSec();
}

// ---------- modelos ----------
function renderTemplates() {
  const box = $("templates");
  box.replaceChildren();
  TEMPLATES.forEach(tpl => {
    const c = el("div", "tpl");
    const use = el("button", "primary", I18N.t("options.useTemplate"));
    use.onclick = () => {
      if ((draft.main.pos > 0 || draft.secTracks.some(t => t.pos > 0)) &&
          !confirm(I18N.t("options.confirmReplacePlan"))) return;
      draft = makeDraft({ tracks: tpl.build() });
      renderAll(); setDirty();
      $("mainSection").scrollIntoView({ behavior: "smooth" });
    };
    c.append(el("h3", "", tpl.name), el("p", "", tpl.desc), use);
    box.append(c);
  });
}

// ---------- seletor de posição (usado nas duas trilhas) ----------
function mountPosition(t, root, after) {
  const bookSel = root.querySelector(".f-book"), chapSel = root.querySelector(".f-chap"), posEl = root.querySelector(".f-pos");
  const text = () => {
    const chs = trackChapters(t);
    posEl.textContent = !chs.length ? "—" : t.pos >= chs.length ? I18N.t("options.trackDone") : I18N.t("options.posText", { label: lab(chs[t.pos]), pos: t.pos + 1, total: chs.length });
  };
  const fillChaps = () => {
    chapSel.replaceChildren();
    if (!bookSel.options.length) return;
    for (let c = 1; c <= BOOKS[+bookSel.value][2]; c++) chapSel.add(new Option(I18N.t("options.chapShort", { n: c }), c));
  };
  const fill = () => {
    bookSel.replaceChildren();
    t.books.forEach(bi => bookSel.add(new Option(BOOKS[bi][0], bi)));
    const chs = trackChapters(t);
    const cur = chs[t.pos] !== undefined ? CHAPTERS[chs[t.pos]] : null;
    if (cur) bookSel.value = cur.book;
    fillChaps();
    if (cur) chapSel.value = cur.chapter;
    text();
  };
  bookSel.onchange = fillChaps;
  root.querySelector(".f-setpos").onclick = () => {
    const chs = trackChapters(t);
    const idx = chs.findIndex(g => CHAPTERS[g].book === +bookSel.value && CHAPTERS[g].chapter === +chapSel.value);
    if (idx >= 0) { t.pos = idx; t.holes = []; text(); setDirty(); if (after) after(); }
  };
  fill();
  return fill;
}

const positionHTML = () => `
  <div class="trow"><span>${E("options.nextToRead")}</span><b class="f-pos"></b></div>
  <div class="trow"><select class="f-book"></select><select class="f-chap"></select><button class="f-setpos">${E("options.setPos")}</button></div>`;

// ---------- trilha principal ----------
function renderMain() {
  const t = draft.main;
  const box = $("main");
  box.replaceChildren();
  const wrap = el("div", "track");
  setHTML(wrap, `
    <label>${E("options.trackName")} <input class="f-name" maxlength="40"></label>
    <label>${E("options.whatToRead")} <select class="f-scope"></select></label>
    <div class="books" hidden></div>
    <label class="f-orderrow">${E("options.order")}
      <select class="f-order">
        <option value="canon">${E("options.orderCanon")}</option>
        <option value="parallel">${E("options.orderParallel")}</option>
      </select></label>
    <fieldset class="pace"><legend>${E("options.pace")}</legend>
      <label class="inl"><input type="radio" class="f-mode-perday"> <input type="number" class="f-n" min="1" max="50"> ${E("options.chPerDay")}</label>
      <label class="inl"><input type="radio" class="f-mode-finish"> ${E("options.finishIn")} <input type="number" class="f-num" min="1" max="999">
        <select class="f-unit"><option value="d">${E("options.unitDays")}</option><option value="m">${E("options.unitMonths")}</option><option value="y">${E("options.unitYears")}</option></select></label>
      <div class="f-preview"></div>
    </fieldset>
    <label class="inl"><input type="checkbox" class="f-loop"> ${E("options.loop")}</label>
    <div class="trow"><span>${E("options.readDays")}</span><span class="f-days trow"></span></div>
    ${positionHTML()}
    <div class="trow"><button class="f-reset">${E("options.resetTrack")}</button></div>`);
  box.append(wrap);
  const q = s => wrap.querySelector(s);

  q(".f-name").value = t.name;
  q(".f-name").oninput = e => { t.name = e.target.value; setDirty(); };

  // escopo
  const sel = q(".f-scope");
  SCOPE_PRESETS.forEach(p => sel.add(new Option(p.label, p.id)));
  sel.add(new Option(I18N.t("options.scopeCustom"), "custom"));
  const preset = SCOPE_PRESETS.find(p => p.books.join() === t.books.join());
  sel.value = t._custom || !preset ? "custom" : preset.id;
  sel.onchange = () => {
    if (sel.value === "custom") t._custom = true;
    else { t._custom = false; t.books = SCOPE_PRESETS.find(p => p.id === sel.value).books.slice(); t.pos = 0; }
    setDirty(); renderMain();
  };

  // ordem (só quando há os dois testamentos)
  const both = t.books.some(b => b < 39) && t.books.some(b => b >= 39);
  q(".f-orderrow").hidden = !both;
  q(".f-order").value = t.order || "canon";
  q(".f-order").onchange = e => {
    if (t.pos > 0 && !confirm(I18N.t("options.confirmOrder"))) { e.target.value = t.order; return; }
    t.order = e.target.value; t.pos = 0;
    fillPos(); updPreview(); setDirty();
  };

  const fillPos = mountPosition(t, wrap, () => updPreview());

  // livros personalizados
  const booksBox = q(".books");
  if (sel.value === "custom") {
    booksBox.hidden = false;
    BOOKS.forEach((b, bi) => {
      const l = el("label", "bk");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = t.books.includes(bi);
      cb.onchange = () => {
        const set = new Set(t.books);
        cb.checked ? set.add(bi) : set.delete(bi);
        t.books = [...set].sort((a, c) => a - c);
        const len = trackChapters(t).length;
        if (t.pos > len) t.pos = len;
        setDirty(); renderMain();
      };
      l.append(cb, " " + b[0]);
      booksBox.append(l);
    });
  }

  // ritmo
  const rP = q(".f-mode-perday"), rF = q(".f-mode-finish"), nIn = q(".f-n"), numIn = q(".f-num"), unitSel = q(".f-unit"), loopCb = q(".f-loop");
  rP.name = rF.name = "mode-main";
  const p = t.pace;
  rP.checked = p.mode === "perDay"; rF.checked = p.mode === "finishIn";
  nIn.value = p.n || 1; numIn.value = p.num || 1; unitSel.value = p.unit || "y";
  loopCb.checked = t.loop; loopCb.disabled = rF.checked;
  const readPace = () => {
    const n = Math.min(50, Math.max(1, parseInt(nIn.value) || 1));
    const num = Math.max(1, parseInt(numIn.value) || 1), unit = unitSel.value, days = num * UNIT_DAYS[unit];
    t.pace = { mode: rF.checked ? "finishIn" : "perDay", n, num, unit, days, end: addDays(todayStr(), days - 1) };
    if (rF.checked) { t.loop = false; loopCb.checked = false; } else t.loop = loopCb.checked;
    loopCb.disabled = rF.checked;
    updPreview(); setDirty();
  };
  [rP, rF, nIn, numIn, unitSel, loopCb].forEach(x => (x.onchange = readPace));

  // dias da semana (valem também para a trilha secundária)
  WEEK_ALL.forEach(d => { const nm = weekName(d);
    const l = el("label", "dow");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = t.weekdays.includes(d);
    cb.onchange = () => { t.weekdays = WEEK_ALL.filter(x => (x === d ? cb.checked : t.weekdays.includes(x))); updPreview(); setDirty(); };
    l.append(cb, " " + nm);
    q(".f-days").append(l);
  });

  function updPreview() {
    const chs = trackChapters(t), rem = Math.max(0, chs.length - t.pos), out = q(".f-preview");
    if (!t.weekdays.length) { out.textContent = I18N.t("options.markADay"); return; }
    if (t.pace.mode === "finishIn") {
      const end = addDays(todayStr(), t.pace.days - 1);
      const sched = scheduledDaysBetween(t, todayStr(), end);
      out.textContent = I18N.t("options.previewFinish", { perDay: (rem / Math.max(1, sched)).toLocaleString(I18N.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), rem, sched, end: fmtDate(end) });
    } else if (t.loop) {
      out.textContent = I18N.t("options.previewLoop", { len: chs.length, days: Math.ceil(chs.length / t.pace.n) });
    } else {
      const est = finishEstimate(t);
      out.textContent = est ? I18N.t("options.previewEnd", { date: fmtDate(est) }) : "";
    }
  }

  q(".f-reset").onclick = () => {
    if (!confirm(I18N.t("options.confirmResetTrack", { name: t.name }))) return;
    t.pos = 0; t.cycles = 0; t.history = []; t.holes = []; t.todayDone = 0; t.todayExtra = 0;
    fillPos(); updPreview(); setDirty();
  };
  updPreview();
}

// ---------- trilha secundária ----------
function renderSec() {
  const s = draft.sec;
  const box = $("sec");
  box.replaceChildren();
  const wrap = el("div", "track");
  setHTML(wrap, `
    <label class="inl"><input type="checkbox" class="s-on"> ${E("options.secOn")}</label>
    <div class="s-body" hidden>
      <div class="chips">${E("options.shortcuts")}
        <button class="s-chip" data-b="18">${esc(BOOKS[18][0])}</button>
        <button class="s-chip" data-b="19">${esc(BOOKS[19][0])}</button>
        <button class="s-chip" data-b="18,19">${E("options.chipBoth", { a: BOOKS[18][0], b: BOOKS[19][0] })}</button>
      </div>
      <div class="books"></div>
      <label class="s-moderow">${E("options.secHow")}
        <select class="s-mode">
          <option value="parallel">${E("options.secParallel")}</option>
          <option value="sequence">${E("options.secSequence")}</option>
        </select></label>
      <label class="inl"><input type="number" class="s-n" min="1" max="20"> <span class="s-unit"></span></label>
      <div class="f-preview s-prev"></div>
      <div class="s-tracks"></div>
    </div>`);
  box.append(wrap);
  const q = x => wrap.querySelector(x);

  const on = q(".s-on");
  on.checked = s.enabled;
  q(".s-body").hidden = !s.enabled;
  on.onchange = () => {
    s.enabled = on.checked;
    if (s.enabled && !s.books.length) s.books = [18];
    rebuildSec(); setDirty(); renderSec();
  };
  if (!s.enabled) return;

  // livros
  const booksBox = q(".books");
  BOOKS.forEach((b, bi) => {
    const l = el("label", "bk");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = s.books.includes(bi);
    cb.onchange = () => {
      const set = new Set(s.books);
      cb.checked ? set.add(bi) : set.delete(bi);
      s.books = [...set].sort((a, c) => a - c);
      rebuildSec(); setDirty(); renderSec();
    };
    l.append(cb, " " + b[0]);
    booksBox.append(l);
  });
  wrap.querySelectorAll(".s-chip").forEach(btn => btn.onclick = () => {
    s.books = btn.dataset.b.split(",").map(Number);
    rebuildSec(); setDirty(); renderSec();
  });

  // modo (só com mais de um livro) e quantidade por dia
  q(".s-moderow").hidden = s.books.length < 2;
  q(".s-mode").value = s.mode;
  q(".s-mode").onchange = e => { s.mode = e.target.value; rebuildSec(); setDirty(); renderSec(); };
  q(".s-n").value = s.n;
  q(".s-unit").textContent = s.books.length > 1 && s.mode === "parallel" ? I18N.t("options.chPerDayEach") : I18N.t("options.chPerDay");
  q(".s-n").onchange = e => {
    s.n = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
    e.target.value = s.n;
    rebuildSec(); updSecPreview(); setDirty();
  };

  function updSecPreview() {
    q(".s-prev").textContent = draft.secTracks.map(t => {
      const len = trackChapters(t).length;
      return I18N.t("options.secPreview", { name: t.name, len, days: Math.ceil(len / s.n) });
    }).join(" · ");
  }
  updSecPreview();

  // posição de cada trilha secundária
  const list = q(".s-tracks");
  draft.secTracks.forEach(t => {
    const row = el("div", "sectrack");
    setHTML(row, `<h4></h4>${positionHTML()}<div class="trow"><button class="f-reset">${E("options.reset")}</button></div>`);
    row.querySelector("h4").textContent = t.name + (t.cycles ? I18N.t("options.cycleSuffix", { n: t.cycles + 1 }) : "");
    const fill = mountPosition(t, row);
    row.querySelector(".f-reset").onclick = () => {
      if (!confirm(I18N.t("options.confirmReset", { name: t.name }))) return;
      t.pos = 0; t.cycles = 0; t.history = []; t.holes = []; t.todayDone = 0; t.todayExtra = 0;
      fill(); setDirty();
    };
    list.append(row);
  });
}

// ---------- salvar ----------
async function save(opts = {}) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const fail = msg => setStatus(msg, true);
  rebuildSec();
  const main = clone(draft.main);
  const secs = clone(draft.secTracks);
  delete main._custom;
  main.role = "main";
  if (!main.name.trim()) main.name = I18N.t("options.defaultTrackName");
  if (!main.books.length) return fail(I18N.t("options.errMainBooks"));
  if (!main.weekdays.length) return fail(I18N.t("options.errMainDays"));
  if (draft.sec.enabled && !draft.sec.books.length) return fail(I18N.t("options.errSecBooks"));

  const orig = saved && saved.tracks.find(o => o.id === main.id);
  if (main.pace.mode === "finishIn" && !(orig && orig.pace.mode === "finishIn" && orig.pace.days === main.pace.days)) {
    main.pace.end = addDays(todayStr(), main.pace.days - 1);
  }
  if (main.pace.mode === "finishIn") main.loop = false;
  const mlen = trackChapters(main).length;
  if (main.pos > mlen) main.pos = mlen;
  if (main.loop && main.pos >= mlen) main.pos = 0;

  secs.forEach(t => {
    t.role = "sec"; t.loop = true;
    t.weekdays = main.weekdays.slice();
    const len = trackChapters(t).length;
    if (t.pos >= len) t.pos = 0;
  });

  const plan = { v: 3, tracks: [main, ...secs] };
  try {
    await savePlan(plan);
  } catch (e) {
    return fail(I18N.t("options.errSave", { msg: e.message || e }));
  }
  saved = plan;
  if (opts.auto) {
    // salvamento automático: não recria a tela (o cursor não pode sair do campo em que você está digitando)
    setStatus(I18N.t("options.savedAuto", { time: hhmm() }));
    return;
  }
  draft = makeDraft(plan);
  renderAll();
  setStatus(I18N.t("options.saved", { time: hhmm() }));
}


// ---------- textos offline ----------
const fmtMB = b => (b / 1048576).toLocaleString(I18N.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MB";
let importTarget = null;
function setOffMsg(t, err) { const m = $("offMsg"); m.textContent = t || ""; m.style.color = err ? "#b00020" : ""; }

function fillVersionSelect() {
  const sel = $("gversion"), cur = sel.value;
  sel.replaceChildren();
  VERSIONS.forEach(v => sel.add(new Option(v.label, v.id)));
  if (cur) sel.value = cur;
}

async function downloadWithProgress(v, statusEl) {
  await downloadPack(v, (got, total) => {
    statusEl.textContent = total ? I18N.t("options.downloadingPct", { pct: Math.round(got / total * 100) }) : I18N.t("options.downloadingMB", { mb: fmtMB(got) });
  });
}

async function renderOffline() {
  const box = $("offlineList");
  box.replaceChildren();
  for (const v of VERSIONS) {
    const st = await localStatus(v);
    const row = el("div", "offrow");
    const status = el("div", "offstatus" + (st ? " ok" : ""),
      st ? I18N.t("options.offHave", { mb: fmtMB(st.bytes), verses: st.verses.toLocaleString(I18N.locale), imp: st.from === "importada" ? I18N.t("options.offImported") : "" })
         : v.bundled ? I18N.t("options.offBundled")
         : (v.json ? I18N.t("options.offNone") : I18N.t("options.offNoneImport")));
    const btns = el("div", "offbtns");
    const run = fn => async () => {
      try { await fn(); } catch (e) { status.textContent = e.message || String(e); status.className = "offstatus err"; return; }
      renderOffline();
    };
    if (v.json && !st) btns.append(btn(I18N.t("options.download"), run(() => downloadWithProgress(v, status))));
    if (st || v.bundled) {
      btns.append(btn(I18N.t("options.export"), run(async () => {
        const blob = new Blob([JSON.stringify(await buildPackage(v))], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${packOf(v)}.biblia.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      })));
    }
    if (!v.bundled) btns.append(btn(I18N.t("options.import"), () => { importTarget = v; $("fileIn").value = ""; $("fileIn").click(); }));
    if (st) btns.append(btn(I18N.t("options.remove"), run(async () => {
      if (confirm(I18N.t("options.confirmRemove", { short: v.short }))) await removeLocal(packOf(v));
    })));
    row.append(el("div", "offname", v.label + (v.third ? I18N.t("options.thirdSuffix") : "")), status, btns);
    box.append(row);
  }
}
function btn(label, fn) { const b = el("button", "", label); b.onclick = fn; return b; }

async function initOffline() {
  $("keepAwake").checked = (await chrome.storage.local.get("keepAwake")).keepAwake !== false;
  $("keepAwake").onchange = e => { chrome.storage.local.set({ keepAwake: e.target.checked }); setStatus(I18N.t(e.target.checked ? "options.keepAwakeOn" : "options.keepAwakeOff")); };
  $("offlineOnly").checked = !!(await chrome.storage.local.get("offlineOnly")).offlineOnly;
  $("offlineOnly").onchange = e => { chrome.storage.local.set({ offlineOnly: e.target.checked }); setStatus(e.target.checked ? I18N.t("options.offOnlyOn") : I18N.t("options.offOnlyOff")); };
  $("dlAll").onclick = async () => {
    for (const v of VERSIONS.filter(x => x.json && !x.bundled)) {
      if (await localStatus(v)) continue;
      setOffMsg(I18N.t("options.downloadingShort", { short: v.short }));
      try { await downloadPack(v); } catch (e) { setOffMsg(I18N.t("options.shortError", { short: v.short, msg: e.message }), true); await renderOffline(); return; }
    }
    setOffMsg(I18N.t("options.allDownloaded"));
    renderOffline();
  };
  $("importNew").onclick = () => { importTarget = null; $("fileIn").value = ""; $("fileIn").click(); };
  $("fileIn").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const { ver, meta } = await importPackageText(await f.text(), importTarget);
      fillVersionSelect();
      setOffMsg(I18N.t("options.imported", { label: ver.label, verses: meta.verses.toLocaleString(I18N.locale) }));
    } catch (err) { setOffMsg(I18N.t("options.errImport", { msg: err.message || err }), true); }
    importTarget = null;
    renderOffline();
  };
  await renderOffline();
}

// ---------- dicionários ----------
function setDictMsg(msg, err) { const m = $("dictMsg"); m.textContent = msg || ""; m.className = "hint" + (err ? " err" : ""); }
async function renderDict() {
  const box = $("dictList");
  box.replaceChildren();
  const all = await Dict.list();
  if (!all.length) { box.append(el("p", "hint", I18N.t("options.dictNone"))); return; }
  for (const d of all) {
    const row = el("div", "offrow dictrow");
    const name = el("div", "offname", d.name);
    const info = el("div", "offstatus" + (d.enabled ? " ok" : ""),
      [String(d.lang || "").toUpperCase(), I18N.t("options.dictEntries", { n: (d.count || 0).toLocaleString(I18N.locale) }), d.builtin ? I18N.t("options.dictBuiltin") : I18N.t("options.dictImportedTag"), d.credit || d.license || ""].filter(Boolean).join(" · "));
    const ctl = el("div", "offbtns dictctl");
    const on = document.createElement("label"); on.className = "inl";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = d.enabled;
    cb.onchange = async () => { await Dict.setEnabled(d.id, cb.checked); renderDict(); };
    on.append(cb, " ", el("span", "", I18N.t("options.dictActive")));
    const def = document.createElement("label"); def.className = "inl";
    const rb = document.createElement("input"); rb.type = "radio"; rb.name = "dictdef"; rb.checked = d.isDefault;
    rb.onchange = async () => { await Dict.setDefault(d.id); renderDict(); };
    def.append(rb, " ", el("span", "", I18N.t("options.dictDefault")));
    ctl.append(on, def);
    if (!d.builtin) ctl.append(btn(I18N.t("options.dictRemove"), async () => { if (confirm(I18N.t("options.dictConfirmRemove", { name: d.name }))) { await Dict.remove(d.id); renderDict(); } }));
    row.append(name, info, ctl);
    box.append(row);
  }
}
async function initDict() {
  await Dict.ready;
  const fsel = $("dictFont"), fs = $("dictFontSample");
  const paintFont = () => { const f = Dict.fonts.find(x => x.id === Dict.getFont()) || Dict.fonts[0]; fs.style.fontFamily = f.stack; fsel.value = f.id; };
  Dict.fonts.forEach(f => fsel.add(new Option(I18N.t("options.dictFont_" + f.id), f.id)));
  paintFont();
  fsel.onchange = async () => { await Dict.setFont(fsel.value); paintFont(); };
  $("dictImport").onclick = () => { $("dictFile").value = ""; $("dictFile").click(); };
  $("dictFile").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const m = await Dict.importText(await f.text());
      setDictMsg(I18N.t("options.dictImported", { name: m.name, n: m.count.toLocaleString(I18N.locale) }));
    } catch (err) { setDictMsg(I18N.t("options.dictErr", { msg: err.message || err }), true); }
    renderDict();
  };
  await renderDict();
}

// ---------- geral ----------
async function initGeneral() {
  const FLAGS = {
    pt: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2 27.5 10 15 18 2.5 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.7 9.2q4.6-1.2 8.7 1.4" stroke="#fff" stroke-width=".9" fill="none"/>',
    en: '<rect width="30" height="20" fill="#fff"/><g fill="#b22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.16" width="30" height="1.54"/><rect y="9.24" width="30" height="1.54"/><rect y="12.32" width="30" height="1.54"/><rect y="15.4" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="12" height="10.8" fill="#3c3b6e"/><g fill="#fff"><circle cx="2" cy="2" r=".7"/><circle cx="5" cy="2" r=".7"/><circle cx="8" cy="2" r=".7"/><circle cx="10.5" cy="2" r=".7"/><circle cx="3.5" cy="4.6" r=".7"/><circle cx="6.5" cy="4.6" r=".7"/><circle cx="9.5" cy="4.6" r=".7"/><circle cx="2" cy="7.2" r=".7"/><circle cx="5" cy="7.2" r=".7"/><circle cx="8" cy="7.2" r=".7"/><circle cx="10.5" cy="7.2" r=".7"/></g>',
    es: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
    fr: '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#0055a4"/><rect x="20" width="10" height="20" fill="#ef4135"/>',
    de: '<rect width="30" height="20" fill="#ffce00"/><rect width="30" height="13.4" fill="#dd0000"/><rect width="30" height="6.7" fill="#000"/>'
  };
  const box = $("glang");
  I18N.languages().forEach(l => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "langbtn"; b.dataset.lang = l;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(l === I18N.lang));
    b.classList.toggle("on", l === I18N.lang);
    b.innerHTML = '<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">' + (FLAGS[l] || "") + "</svg>";
    const s = document.createElement("span"); s.textContent = I18N.t("lang.name." + l); b.appendChild(s);
    b.onclick = async () => {
      if (l === I18N.lang || box.dataset.busy) return;
      box.dataset.busy = "1";   // um toque só: trava os botões e mostra já a escolha enquanto grava e recarrega
      box.querySelectorAll(".langbtn").forEach(x => { x.classList.toggle("on", x === b); x.disabled = true; });
      try { sessionStorage.setItem("optScroll", String(window.scrollY)); } catch (x) {}
      await I18N.set(l); location.reload();
    };
    box.appendChild(b);
  });
  VERSIONS.forEach(v => $("gversion").add(new Option(v.label, v.id)));
  $("gversion").value = (await loadVersion()).id;
  $("gversion").onchange = e => { saveVersion(e.target.value); setStatus(I18N.t("options.versionSaved")); };

  $("sync").checked = await syncEnabled();
  $("sync").onchange = async e => {
    const want = e.target.checked;
    try {
      if (want) {
        let keepRemote = false;
        if (await hasRemotePlan()) {
          if (!confirm(I18N.t("options.confirmUseRemote"))) throw new Error(I18N.t("options.syncNotEnabled"));
          keepRemote = true;
        }
        await enableSync(keepRemote);
      } else {
        await disableSync();
      }
      saved = await loadPlan();
      draft = makeDraft(saved);
      renderAll();
      setStatus(want ? I18N.t("options.syncOn") : I18N.t("options.syncOff"));
    } catch (err) {
      e.target.checked = !want;
      setStatus(err.message || String(err), true);
    }
  };

  $("clearSelah").onclick = async () => {
    if (!confirm(I18N.t("options.confirmClearSelah"))) return;
    await Selah.clearAll(); setStatus(I18N.t("options.selahCleared"));
  };
  $("resetAll").onclick = async () => {
    if (!confirm(I18N.t("options.confirmResetAll"))) return;
    [draft.main, ...draft.secTracks].forEach(t => { t.pos = 0; t.cycles = 0; t.history = []; t.holes = []; t.todayDone = 0; t.todayExtra = 0; });
    await save();
  };
}

function applyI18n() {
  I18N.apply();
  document.querySelectorAll("[data-orich]").forEach(e => orich(e, I18N.t(e.dataset.orich)));
}

async function initNarr() {
  await Narrator.ready;
  if (!Narrator.supported) { $("narrBox").textContent = I18N.t("options.narrNone"); return; }
  const c = Narrator.settings(), out = $("narrRateOut");
  const fmt = v => (+v).toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", I18N.lang === "en" ? "." : ",") + "×";
  $("narrRate").value = c.rate; out.textContent = fmt(c.rate);
  $("narrRate").oninput = e => { out.textContent = fmt(e.target.value); };
  $("narrRate").onchange = e => Narrator.save({ rate: +e.target.value });
  [["narrAuto", "auto"], ["narrSelah", "selah"], ["narrNums", "nums"]].forEach(([id, k]) => { $(id).checked = !!c[k]; $(id).onchange = e => Narrator.save({ [k]: e.target.checked }); });
  const list = await Narrator.voices(), box = $("narrVoices");
  I18N.languages().forEach(l => {
    const mine = list.filter(v => v.lang.replace("_", "-").slice(0, 2).toLowerCase() === l);
    const lab = document.createElement("label"); lab.className = "field";
    const sp = document.createElement("span"); sp.textContent = I18N.t("options.narrVoiceFor", { lang: I18N.t("lang.name." + l) });
    const sel = document.createElement("select");
    if (!mine.length) { sel.add(new Option(I18N.t("options.narrNoVoices"), "")); sel.disabled = true; }
    else {
      sel.add(new Option(I18N.t("options.narrVoiceAuto"), ""));
      mine.sort((a, b) => (b.localService - a.localService) || a.name.localeCompare(b.name))
          .forEach(v => sel.add(new Option(v.name + " (" + v.lang + ")" + (v.localService ? "" : I18N.t("options.narrOnline")), v.voiceURI)));
      sel.value = (Narrator.settings().voices || {})[l] || "";
      sel.onchange = () => Narrator.save({ voices: { ...(Narrator.settings().voices || {}), [l]: sel.value } });
    }
    lab.append(sp, sel); box.append(lab);
  });
  $("narrTest").onclick = () => Narrator.sample(I18N.lang, I18N.t("options.narrSample"));
}

const TABS = ["plano", "biblias", "geral", "sobre"];
function showTab(name, opts) {
  if (!TABS.includes(name)) name = "plano";
  document.querySelectorAll("section[data-tab]").forEach(s => { s.hidden = s.dataset.tab !== name; });
  document.querySelectorAll("#tabs [data-go]").forEach(b => {
    const on = b.dataset.go === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    if (on && opts && opts.scrollTab) b.scrollIntoView({ block: "nearest", inline: "center" });
  });
  try { localStorage.setItem("optTab", name); } catch (x) { /* sem storage */ }
}
function tabFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return null;
  if (TABS.includes(id)) return id;
  const el = document.getElementById(id);
  const s = el && el.closest("[data-tab]");
  return s ? s.dataset.tab : null;
}
function initTabs() {
  let start = tabFromHash();
  if (!start) { try { start = localStorage.getItem("optTab"); } catch (x) { /* */ } }
  showTab(start, { scrollTab: true });
  document.querySelectorAll("#tabs [data-go]").forEach(b => {
    b.onclick = () => {
      showTab(b.dataset.go, { scrollTab: true });
      history.replaceState(null, "", "#" + b.dataset.go);
      window.scrollTo(0, 0);
    };
  });
  window.addEventListener("hashchange", () => { const n = tabFromHash(); if (n) showTab(n, { scrollTab: true }); });
}

async function init() {
  await I18N.ready;
  applyI18n();
  await loadCustomVersions();
  saved = await loadPlan();
  draft = makeDraft(saved);
  renderTemplates();
  renderAll();
  await initGeneral();
  await initOffline();
  initTabs();
  initNarr();
  initDict();
  $("save").onclick = save;
  chrome.storage.onChanged.addListener(changes => {
    if (changes.version) $("gversion").value = changes.version.newValue;
  });
  const flush = () => { if (saveTimer) save({ auto: true }); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  $("ver").textContent = I18N.t("options.extVersion", { v: chrome.runtime.getManifest().version });
  try {
    const y = sessionStorage.getItem("optScroll");
    if (y != null) { sessionStorage.removeItem("optScroll"); window.scrollTo(0, +y); requestAnimationFrame(() => window.scrollTo(0, +y)); }
  } catch (x) { /* sem sessionStorage */ }
}
init();
