let plan = null;
const $ = id => document.getElementById(id);
const lab = g => `${CHAPTERS[g].pt} ${CHAPTERS[g].chapter}`;
const asItems = (tid, idxs) => idxs.map(i => ({ tid, i }));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Janela única para tudo (plano e culto): se ela já estiver aberta, é reaproveitada e trazida para a frente;
// só é criada uma janela nova quando não existe nenhuma.
async function showWindow(view, items) {
  try {
    const r = await chrome.runtime.sendMessage({ type: "win-show", view, items });
    if (r && r.ok) {
      const w = await chrome.windows.get(r.windowId);
      await chrome.windows.update(r.windowId, w.state === "minimized" ? { state: "normal", focused: true } : { focused: true });
      return;
    }
  } catch (e) { /* nenhuma janela aberta: cria uma */ }
  const url = view === "culto" ? "culto.html" : "reader.html?" + new URLSearchParams({ items: itemsParam(items || []) });
  chrome.windows.create({
    url: chrome.runtime.getURL(url), type: "popup", width: 1000,
    height: Math.min(screen.availHeight || 1000, 1100)
  });
}
function openReader(items) {
  if (items.length) showWindow("reader", items);
}

async function refresh() { plan = await loadPlan(); render(); }

// "Gn 4": nome abreviado no idioma atual
const short = g => { const ab = I18N.abbr(); const c = CHAPTERS[g]; return `${(ab && ab[c.book]) || c.pt} ${c.chapter}`; };

// caixinha em forma de etiqueta: kind = "read" (lido), "todo" (previsto para hoje), "extra" (extra de hoje), "cand" (candidato a extra), "past" (lido antes)
function chip(g, checked, kind, onChange, tip) {
  const l = el("label", "chip " + kind);
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = checked;
  cb.onchange = async () => { cb.disabled = true; await onChange(cb.checked); await refresh(); };
  l.append(cb, el("span", "", short(g)));
  if (tip) l.title = tip;
  return l;
}
function section(title, hint) {
  const s = el("div", "sect");
  s.append(el("div", "sect-title", title));
  if (hint) s.append(el("div", "sect-hint", hint));
  return s;
}

function card(t) {
  const st = trackStatus(t);
  const head0 = queueAt(t, 0, st.chs);
  const done = st.state === "done";
  const c = el("section", "card" + (st.state === "finished" ? " finished" : "") + (done ? " isdone" : ""));

  const head = el("div", "cardhead");
  const meta = t.loop ? I18N.t("popup.cycle", { cycle: t.cycles + 1, pos: Math.min(t.pos + 1, st.len), len: st.len })
    : st.finished ? I18N.t("popup.ofTotal", { len: st.len }) : I18N.t("popup.chapN", { pos: Math.min(t.pos + 1, st.len), len: st.len });
  head.append(el("span", "label", t.name), el("span", "small", meta));
  c.append(head);

  if (st.state === "finished") { c.append(el("div", "ref", I18N.t("popup.finished")), el("div", "small", I18N.t("popup.chaptersRead", { len: st.len }))); }
  else if (st.state === "rest") { c.append(el("div", "ref", I18N.t("popup.rest")), el("div", "small", head0 !== undefined ? I18N.t("popup.nextLabel", { ref: lab(head0) }) : "")); }
  else if (done) {
    // dia concluído: só uma marca discreta; desmarcar reabre a leitura (os próximos capítulos, seguindo a programação)
    const row = el("div", "daydone");
    const l = el("label", "chip read small-chip");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true;
    cb.onchange = async () => { cb.disabled = true; await reopenDay(t.id); await refresh(); };
    l.append(cb, el("span", "", I18N.t("popup.dayDone")));
    l.title = I18N.t("popup.tipDayDone");
    row.append(l);
    if (head0 !== undefined) row.append(el("span", "small", I18N.t("popup.nextLabel", { ref: short(head0) })));
    c.append(row);
  } else c.append(el("div", "ref", formatRefs(st.items)), el("div", "small", I18N.t("popup.today", { done: st.done, quota: st.total })));

  const bar = el("div", "bar"), fill = el("div");
  fill.style.width = (st.len ? (st.finished ? 100 : Math.min(100, t.pos / st.len * 100)) : 0) + "%";
  bar.append(fill); c.append(bar);

  if (!st.finished && !done) {
    // (o que está programado para hoje já aparece no alto do card; aqui só se escolhem extras)
    // ---- Extras de hoje: os já incluídos (marcados) e os próximos candidatos
    const extras = st.items.slice(st.planned);
    const cands = nextChapters(t, 3, st.remaining);
    if (extras.length || cands.length) {
      const s = section(I18N.t("popup.sectExtras"), I18N.t("popup.extrasHint"));
      const row = el("div", "chips");
      extras.forEach((g, i) => row.append(chip(g, true, "extra", () => addTodayExtra(t.id, -(extras.length - i)))));
      cands.forEach((g, j) => row.append(chip(g, false, "cand", () => addTodayExtra(t.id, j + 1))));
      s.append(row); c.append(s);
    }
  }

  // ---- Últimos lidos: desmarque para ler de novo (voltam para o começo da fila)
  const rec = recentRead(t, 5);
  if (rec.length) {
    const s = section(I18N.t("popup.sectRecent"), I18N.t("popup.recentHint"));
    const row = el("div", "chips");
    rec.forEach(r => row.append(chip(r.g, true, "past", () => unmarkChapter(t.id, r.p))));
    s.append(row); c.append(s);
  }

  if (!done && !st.finished) {
    const read = el("button", "primary wide", I18N.t("popup.read"));
    read.disabled = head0 === undefined;
    read.onclick = () => openReader(asItems(t.id, st.state === "todo" ? st.items : [head0]));   // todos os capítulos escolhidos para hoje, em sequência
    c.append(read);
  }
  c.append(el("div", "small pace", paceText(t) + (t.books.length > 1 && t.role === "sec" ? I18N.t("popup.inSequence") + t.books.map(b => BOOKS[b][0]).join(" → ") : "")));
  return c;
}

function render() {
  const has = !!plan && plan.tracks.length > 0;
  $("empty").hidden = has;
  $("openToday").hidden = !has;
  $("openToday").disabled = !has || todayItems(plan).length === 0;   // tudo concluído hoje: nada a abrir
  $("openToday").title = $("openToday").disabled ? I18N.t("popup.allDone") : "";
  const box = $("cards");
  box.replaceChildren();
  if (has) plan.tracks.forEach(t => box.append(card(t)));
}

function openToday() {
  openReader(todayItems(plan));
}

async function init() {
  await I18N.ready;
  I18N.apply();
  await loadCustomVersions();
  VERSIONS.forEach(v => $("version").add(new Option(v.label, v.id)));
  $("version").value = (await loadVersion()).id;
  $("version").onchange = e => saveVersion(e.target.value);
  $("openOptions").onclick = $("startSetup").onclick = () => chrome.runtime.openOptionsPage();
  $("openToday").onclick = openToday;
  $("openCulto").onclick = () => showWindow("culto");
  await refresh();
  // mantém o popup sincronizado quando o leitor ou a página de opções alteram o plano
  chrome.storage.onChanged.addListener(changes => {
    if (changes[PLAN_KEY]) refresh();
    if (changes.version) $("version").value = changes.version.newValue;
  });
}
init();
