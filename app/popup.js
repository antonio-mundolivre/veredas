let plan = null;
const openIds = new Set(); // cartões com I18N.t("popup.nextChapters") aberto
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
  const meta = t.loop ? I18N.t("popup.cycle", { cycle: t.cycles + 1, pos: Math.min(t.pos + 1, st.len), len: st.len })
    : st.finished ? I18N.t("popup.ofTotal", { len: st.len }) : I18N.t("popup.chapN", { pos: t.pos + 1, len: st.len });
  head.append(el("span", "label", t.name), el("span", "small", meta));

  let ref, info;
  if (st.state === "finished") { ref = I18N.t("popup.finished"); info = I18N.t("popup.chaptersRead", { len: st.len }); }
  else if (st.state === "rest") { ref = I18N.t("popup.rest"); info = I18N.t("popup.nextLabel", { ref: lab(next) }); }
  else if (st.state === "done") { ref = I18N.t("popup.doneToday"); info = I18N.t("popup.nextLabel", { ref: lab(next) }); }
  else { ref = formatRefs(st.items); info = I18N.t("popup.today", { done: st.done, quota: st.quota }); }

  const bar = el("div", "bar");
  const fill = el("div");
  fill.style.width = (st.len ? (st.finished ? 100 : t.pos / st.len * 100) : 0) + "%";
  bar.append(fill);

  const open = el("button", "", st.state === "todo" ? I18N.t("popup.open") : I18N.t("popup.readAhead"));
  const mark = el("button", "primary", st.state === "todo" ? I18N.t("popup.markRead") : I18N.t("popup.markNext"));
  open.disabled = mark.disabled = st.finished || next === undefined;
  open.onclick = () => openReader(asItems(t.id, st.state === "todo" ? st.items : [next]));
  mark.onclick = async () => { await markTrackRead(t.id, next, 1); await refresh(); };
  const row = el("div", "row");
  row.append(open, mark);

  const links = el("div", "links");
  if (st.remaining > 1) {
    const all = el("button", "link", I18N.t("popup.markAll", { n: st.remaining }));
    all.onclick = async () => { await markTrackRead(t.id, next, st.remaining); await refresh(); };
    links.append(all);
  }
  if (t.history.length) {
    const undo = el("button", "link", I18N.t("popup.undo"));
    undo.onclick = async () => { await undoTrack(t.id); await refresh(); };
    links.append(undo);
  }

  c.append(head, el("div", "ref", ref), el("div", "small", info), bar, row, links, el("div", "small", paceText(t) + (t.books.length > 1 && t.role === "sec" ? I18N.t("popup.inSequence") + t.books.map(b => BOOKS[b][0]).join(" → ") : "")));

  const list = nextChapters(t, 5);
  if (list.length) {
    const det = el("details");
    det.open = openIds.has(t.id);
    det.ontoggle = () => (det.open ? openIds.add(t.id) : openIds.delete(t.id));
    det.append(el("summary", "", I18N.t("popup.nextChapters")));
    const ul = el("ul");
    list.forEach((g, k) => {
      const li = el("li");
      const a = el("a", "", lab(g));
      a.onclick = () => openReader(asItems(t.id, [g]));
      li.append(a, el("span", "small", k === 0 ? I18N.t("popup.nextTag") : `+${k}`));
      ul.append(li);
    });
    const openN = el("button", "", I18N.t("popup.openNext", { n: list.length }));
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
