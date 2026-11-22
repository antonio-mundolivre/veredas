let plan = null;
const openIds = new Set(); // cartões com "Próximos capítulos" aberto
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

function card(t) {
  const st = trackStatus(t);
  const next = nextChapters(t, 1)[0];
  const c = el("section", "card");

  const head = el("div", "cardhead");
  const meta = t.loop ? `Ciclo ${t.cycles + 1} · ${Math.min(t.pos + 1, st.len)} de ${st.len}`
    : st.finished ? `${st.len} de ${st.len}` : `Cap. ${t.pos + 1} de ${st.len}`;
  head.append(el("span", "label", t.name), el("span", "small", meta));

  let ref, info;
  if (st.state === "finished") { ref = "Trilha concluída 🎉"; info = `${st.len} capítulos lidos`; }
  else if (st.state === "rest") { ref = "Dia de descanso"; info = `Próximo: ${lab(next)}`; }
  else if (st.state === "done") { ref = "Hoje concluído ✓"; info = `Próximo: ${lab(next)}`; }
  else { ref = formatRefs(st.items); info = `Hoje: ${st.done} de ${st.quota} lidos`; }

  const bar = el("div", "bar");
  const fill = el("div");
  fill.style.width = (st.len ? (st.finished ? 100 : t.pos / st.len * 100) : 0) + "%";
  bar.append(fill);

  const open = el("button", "", st.state === "todo" ? "Abrir" : "Ler adiante");
  const mark = el("button", "primary", st.state === "todo" ? "✓ Marcar lido" : "✓ Marcar o próximo");
  open.disabled = mark.disabled = st.finished || next === undefined;
  open.onclick = () => openReader(asItems(t.id, st.state === "todo" ? st.items : [next]));
  mark.onclick = async () => { await markTrackRead(t.id, next, 1); await refresh(); };
  const row = el("div", "row");
  row.append(open, mark);

  const links = el("div", "links");
  if (st.remaining > 1) {
    const all = el("button", "link", `Marcar todos (${st.remaining})`);
    all.onclick = async () => { await markTrackRead(t.id, next, st.remaining); await refresh(); };
    links.append(all);
  }
  if (t.history.length) {
    const undo = el("button", "link", "Desfazer último");
    undo.onclick = async () => { await undoTrack(t.id); await refresh(); };
    links.append(undo);
  }

  c.append(head, el("div", "ref", ref), el("div", "small", info), bar, row, links, el("div", "small", paceText(t) + (t.books.length > 1 && t.role === "sec" ? " · em sequência: " + t.books.map(b => BOOKS[b][0]).join(" → ") : "")));

  const list = nextChapters(t, 5);
  if (list.length) {
    const det = el("details");
    det.open = openIds.has(t.id);
    det.ontoggle = () => (det.open ? openIds.add(t.id) : openIds.delete(t.id));
    det.append(el("summary", "", "Próximos capítulos"));
    const ul = el("ul");
    list.forEach((g, k) => {
      const li = el("li");
      const a = el("a", "", lab(g));
      a.onclick = () => openReader(asItems(t.id, [g]));
      li.append(a, el("span", "small", k === 0 ? "próximo" : `+${k}`));
      ul.append(li);
    });
    const openN = el("button", "", `Abrir os próximos ${list.length}`);
    openN.onclick = () => openReader(asItems(t.id, list));
    det.append(ul, openN);
    c.append(det);
  }
  return c;
}

function render() {
  const has = !!plan && plan.tracks.length > 0;
  $("empty").hidden = has;
  $("openToday").hidden = !has;
  const box = $("cards");
  box.replaceChildren();
  if (has) plan.tracks.forEach(t => box.append(card(t)));
}

function openToday() {
  openReader(todayItems(plan));
}

async function init() {
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
