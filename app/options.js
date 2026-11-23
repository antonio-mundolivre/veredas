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
function setStatus(msg, err) {
  $("status").textContent = msg;
  $("status").className = err ? "err" : "";
}
let saveTimer = null;
// Salva sozinho logo depois de qualquer alteração (o botão "Salvar agora" continua disponível)
function setDirty() {
  setStatus("Salvando…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save({ auto: true }), 600);
}
const hhmm = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ---------- rascunho ----------
function makeDraft(plan) {
  const p = plan ? clone(plan) : { tracks: [] };
  const main = p.tracks.find(t => t.role === "main") || p.tracks[0] || newTrack({ name: "Bíblia", role: "main" });
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
    const use = el("button", "primary", "Usar este plano");
    use.onclick = () => {
      if ((draft.main.pos > 0 || draft.secTracks.some(t => t.pos > 0)) &&
          !confirm("Substituir o plano atual por este modelo? O progresso atual será perdido ao salvar.")) return;
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
    posEl.textContent = !chs.length ? "—" : t.pos >= chs.length ? "trilha concluída" : `${lab(chs[t.pos])} (${t.pos + 1} de ${chs.length})`;
  };
  const fillChaps = () => {
    chapSel.replaceChildren();
    if (!bookSel.options.length) return;
    for (let c = 1; c <= BOOKS[+bookSel.value][2]; c++) chapSel.add(new Option("Cap. " + c, c));
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
    if (idx >= 0) { t.pos = idx; text(); setDirty(); if (after) after(); }
  };
  fill();
  return fill;
}

const POSITION_HTML = `
  <div class="trow"><span>Próximo capítulo a ler:</span><b class="f-pos"></b></div>
  <div class="trow"><select class="f-book"></select><select class="f-chap"></select><button class="f-setpos">Definir posição</button></div>`;

// ---------- trilha principal ----------
function renderMain() {
  const t = draft.main;
  const box = $("main");
  box.replaceChildren();
  const wrap = el("div", "track");
  setHTML(wrap, `
    <label>Nome da trilha <input class="f-name" maxlength="40"></label>
    <label>O que ler <select class="f-scope"></select></label>
    <div class="books" hidden></div>
    <label class="f-orderrow">Ordem de leitura
      <select class="f-order">
        <option value="canon">Canônica (do primeiro ao último livro)</option>
        <option value="parallel">Antigo e Novo Testamento em paralelo (intercalados)</option>
      </select></label>
    <fieldset class="pace"><legend>Ritmo</legend>
      <label class="inl"><input type="radio" class="f-mode-perday"> <input type="number" class="f-n" min="1" max="50"> capítulo(s) por dia</label>
      <label class="inl"><input type="radio" class="f-mode-finish"> Terminar em <input type="number" class="f-num" min="1" max="999">
        <select class="f-unit"><option value="d">dias</option><option value="m">meses</option><option value="y">anos</option></select></label>
      <div class="f-preview"></div>
    </fieldset>
    <label class="inl"><input type="checkbox" class="f-loop"> Ao terminar, recomeçar do início (loop)</label>
    <div class="trow"><span>Dias de leitura:</span><span class="f-days trow"></span></div>
    ${POSITION_HTML}
    <div class="trow"><button class="f-reset">Reiniciar trilha</button></div>`);
  box.append(wrap);
  const q = s => wrap.querySelector(s);

  q(".f-name").value = t.name;
  q(".f-name").oninput = e => { t.name = e.target.value; setDirty(); };

  // escopo
  const sel = q(".f-scope");
  SCOPE_PRESETS.forEach(p => sel.add(new Option(p.label, p.id)));
  sel.add(new Option("Personalizado (escolher livros)", "custom"));
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
    if (t.pos > 0 && !confirm("Mudar a ordem reinicia a trilha no primeiro capítulo. Continuar?")) { e.target.value = t.order; return; }
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
  WEEK_NAMES.forEach((nm, d) => {
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
    if (!t.weekdays.length) { out.textContent = "Marque pelo menos um dia de leitura."; return; }
    if (t.pace.mode === "finishIn") {
      const end = addDays(todayStr(), t.pace.days - 1);
      const sched = scheduledDaysBetween(t, todayStr(), end);
      out.textContent = `≈ ${(rem / Math.max(1, sched)).toFixed(1).replace(".", ",")} capítulos por dia de leitura (${rem} capítulos em ${sched} dias). Término até ${fmtDate(end)}.`;
    } else if (t.loop) {
      out.textContent = `Um ciclo completo (${chs.length} capítulos) leva ≈ ${Math.ceil(chs.length / t.pace.n)} dias de leitura.`;
    } else {
      const est = finishEstimate(t);
      out.textContent = est ? `Previsão de término: ${fmtDate(est)}.` : "";
    }
  }

  q(".f-reset").onclick = () => {
    if (!confirm(`Reiniciar a trilha "${t.name}" do começo?`)) return;
    t.pos = 0; t.cycles = 0; t.history = []; t.todayDone = 0;
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
    <label class="inl"><input type="checkbox" class="s-on"> Ler também uma trilha secundária</label>
    <div class="s-body" hidden>
      <div class="chips">Atalhos:
        <button class="s-chip" data-b="18">Salmos</button>
        <button class="s-chip" data-b="19">Provérbios</button>
        <button class="s-chip" data-b="18,19">Salmos e Provérbios</button>
      </div>
      <div class="books"></div>
      <label class="s-moderow">Como ler os livros escolhidos
        <select class="s-mode">
          <option value="parallel">Em paralelo: cada livro no seu ritmo (ex.: 1 Salmo + 1 Provérbio por dia)</option>
          <option value="sequence">Em sequência: um livro depois do outro (ex.: Salmos 1 a 150, depois Provérbios 1 a 31)</option>
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
  q(".s-unit").textContent = s.books.length > 1 && s.mode === "parallel" ? "capítulo(s) por dia de cada livro" : "capítulo(s) por dia";
  q(".s-n").onchange = e => {
    s.n = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
    e.target.value = s.n;
    rebuildSec(); updSecPreview(); setDirty();
  };

  function updSecPreview() {
    q(".s-prev").textContent = draft.secTracks.map(t => {
      const len = trackChapters(t).length;
      return `${t.name}: ciclo de ${len} capítulos em ≈ ${Math.ceil(len / s.n)} dias de leitura`;
    }).join(" · ");
  }
  updSecPreview();

  // posição de cada trilha secundária
  const list = q(".s-tracks");
  draft.secTracks.forEach(t => {
    const row = el("div", "sectrack");
    setHTML(row, `<h4></h4>${POSITION_HTML}<div class="trow"><button class="f-reset">Reiniciar</button></div>`);
    row.querySelector("h4").textContent = t.name + (t.cycles ? ` · ciclo ${t.cycles + 1}` : "");
    const fill = mountPosition(t, row);
    row.querySelector(".f-reset").onclick = () => {
      if (!confirm(`Reiniciar "${t.name}" do começo?`)) return;
      t.pos = 0; t.cycles = 0; t.history = []; t.todayDone = 0;
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
  if (!main.name.trim()) main.name = "Bíblia";
  if (!main.books.length) return fail("Trilha principal: escolha pelo menos um livro.");
  if (!main.weekdays.length) return fail("Trilha principal: marque pelo menos um dia de leitura.");
  if (draft.sec.enabled && !draft.sec.books.length) return fail("Trilha secundária: escolha pelo menos um livro.");

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
    return fail("Não foi possível salvar: " + (e.message || e));
  }
  saved = plan;
  if (opts.auto) {
    // salvamento automático: não recria a tela (o cursor não pode sair do campo em que você está digitando)
    setStatus("Salvo automaticamente ✓ " + hhmm());
    return;
  }
  draft = makeDraft(plan);
  renderAll();
  setStatus("Plano salvo ✓ " + hhmm());
}


// ---------- textos offline ----------
const fmtMB = b => (b / 1048576).toFixed(1).replace(".", ",") + " MB";
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
    statusEl.textContent = total ? `Baixando… ${Math.round(got / total * 100)}%` : `Baixando… ${fmtMB(got)}`;
  });
}

async function renderOffline() {
  const box = $("offlineList");
  box.replaceChildren();
  for (const v of VERSIONS) {
    const st = await localStatus(v);
    const row = el("div", "offrow");
    const status = el("div", "offstatus" + (st ? " ok" : ""),
      st ? `Offline ✓ · ≈ ${fmtMB(st.bytes)} · ${st.verses.toLocaleString("pt-BR")} versículos${st.from === "importada" ? " · importada" : ""}`
         : v.bundled ? "Incluída na extensão ✓ · funciona sem internet"
         : (v.json ? "Não baixada" : "Não baixada (só por importação de arquivo)"));
    const btns = el("div", "offbtns");
    const run = fn => async () => {
      try { await fn(); } catch (e) { status.textContent = e.message || String(e); status.className = "offstatus err"; return; }
      renderOffline();
    };
    if (v.json && !st) btns.append(btn("Baixar", run(() => downloadWithProgress(v, status))));
    if (st || v.bundled) {
      btns.append(btn("Exportar", run(async () => {
        const blob = new Blob([JSON.stringify(await buildPackage(v))], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${packOf(v)}.biblia.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      })));
    }
    if (!v.bundled) btns.append(btn("Importar…", () => { importTarget = v; $("fileIn").value = ""; $("fileIn").click(); }));
    if (st) btns.append(btn("Remover", run(async () => {
      if (confirm(`Remover o texto offline de ${v.short}? Você poderá baixá-lo de novo depois.`)) await removeLocal(packOf(v));
    })));
    row.append(el("div", "offname", v.label + (v.third ? " · texto de terceiros" : "")), status, btns);
    box.append(row);
  }
}
function btn(label, fn) { const b = el("button", "", label); b.onclick = fn; return b; }

async function initOffline() {
  $("offlineOnly").checked = !!(await chrome.storage.local.get("offlineOnly")).offlineOnly;
  $("offlineOnly").onchange = e => { chrome.storage.local.set({ offlineOnly: e.target.checked }); setStatus(e.target.checked ? "Somente textos baixados ✓" : "Internet liberada para leitura ✓"); };
  $("dlAll").onclick = async () => {
    for (const v of VERSIONS.filter(x => x.json && !x.bundled)) {
      if (await localStatus(v)) continue;
      setOffMsg(`Baixando ${v.short}…`);
      try { await downloadPack(v); } catch (e) { setOffMsg(`${v.short}: ${e.message}`, true); await renderOffline(); return; }
    }
    setOffMsg("Todas as versões disponíveis estão baixadas ✓");
    renderOffline();
  };
  $("importNew").onclick = () => { importTarget = null; $("fileIn").value = ""; $("fileIn").click(); };
  $("fileIn").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const { ver, meta } = await importPackageText(await f.text(), importTarget);
      fillVersionSelect();
      setOffMsg(`Importado: ${ver.label} (${meta.verses.toLocaleString("pt-BR")} versículos) ✓`);
    } catch (err) { setOffMsg("Não foi possível importar: " + (err.message || err), true); }
    importTarget = null;
    renderOffline();
  };
  await renderOffline();
}

// ---------- geral ----------
async function initGeneral() {
  VERSIONS.forEach(v => $("gversion").add(new Option(v.label, v.id)));
  $("gversion").value = (await loadVersion()).id;
  $("gversion").onchange = e => { saveVersion(e.target.value); setStatus("Versão salva ✓"); };

  $("sync").checked = await syncEnabled();
  $("sync").onchange = async e => {
    const want = e.target.checked;
    try {
      if (want) {
        let keepRemote = false;
        if (await hasRemotePlan()) {
          if (!confirm("Já existe um plano sincronizado na sua conta do Chrome. Usá-lo neste computador? (O plano local será substituído.)")) throw new Error("Sincronização não ativada.");
          keepRemote = true;
        }
        await enableSync(keepRemote);
      } else {
        await disableSync();
      }
      saved = await loadPlan();
      draft = makeDraft(saved);
      renderAll();
      setStatus(want ? "Sincronização ligada ✓" : "Sincronização desligada");
    } catch (err) {
      e.target.checked = !want;
      setStatus(err.message || String(err), true);
    }
  };

  $("clearSelah").onclick = async () => {
    if (!confirm("Apagar todas as pausas (Selá) marcadas?")) return;
    await Selah.clearAll(); setStatus("Pausas apagadas ✓");
  };
  $("resetAll").onclick = async () => {
    if (!confirm("Zerar o progresso de todas as trilhas?")) return;
    [draft.main, ...draft.secTracks].forEach(t => { t.pos = 0; t.cycles = 0; t.history = []; t.todayDone = 0; });
    await save();
  };
}

async function init() {
  await loadCustomVersions();
  saved = await loadPlan();
  draft = makeDraft(saved);
  renderTemplates();
  renderAll();
  await initGeneral();
  await initOffline();
  $("save").onclick = save;
  chrome.storage.onChanged.addListener(changes => {
    if (changes.version) $("gversion").value = changes.version.newValue;
  });
  const flush = () => { if (saveTimer) save({ auto: true }); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  $("ver").textContent = "Extensão v" + chrome.runtime.getManifest().version;
}
init();
