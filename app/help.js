// Tela de Ajuda: seções recolhíveis, índice e pesquisa por contexto (ignora acentos e maiúsculas, destaca o que achou).
const IDS = ["start", "plan", "setup", "cards", "today", "extras", "reader", "passages", "narr", "dict", "selah", "bibles", "general", "phone", "privacy"];
const $ = s => document.querySelector(s);
const secs = [];   // { id, el (details), title, body (div), tNode, text (texto da seção sem acentos) }

// letras sem acento e em minúsculas, mantendo o mesmo comprimento do texto original (para marcar o trecho certo)
const fold = s => Array.from(s).map(ch => { const d = ch.normalize("NFD")[0]; return (d || ch).toLowerCase(); }).join("");

// texto da ajuda -> HTML seguro: parágrafos separados por linha em branco, listas com "- " e **negrito**
function render(text, into) {
  const bold = (parent, s) => s.split("**").forEach((part, i) => { if (i % 2) { const b = document.createElement("b"); b.textContent = part; parent.append(b); } else parent.append(document.createTextNode(part)); });
  text.split("\n\n").forEach(block => {
    const lines = block.split("\n");
    if (lines.every(l => l.startsWith("- "))) {
      const ul = document.createElement("ul");
      lines.forEach(l => { const li = document.createElement("li"); bold(li, l.slice(2)); ul.append(li); });
      into.append(ul);
    } else if (lines[0].startsWith("- ")) {   // lista que segue um trecho solto
      const ul = document.createElement("ul");
      lines.forEach(l => { const li = document.createElement("li"); bold(li, l.replace(/^- /, "")); ul.append(li); });
      into.append(ul);
    } else { const p = document.createElement("p"); bold(p, lines.join(" ")); into.append(p); }
  });
}

function build() {
  const box = $("#sections"), toc = $("#toc");
  box.replaceChildren(); toc.replaceChildren(); secs.length = 0;
  IDS.forEach(id => {
    const d = document.createElement("details"); d.id = "s-" + id;
    const sm = document.createElement("summary"); const title = I18N.t(`help.${id}.t`); sm.textContent = title;
    const body = document.createElement("div"); body.className = "body"; render(I18N.t(`help.${id}.b`), body);
    d.append(sm, body); box.append(d);
    const a = document.createElement("a"); a.href = "#s-" + id; a.textContent = title;
    a.onclick = e => { e.preventDefault(); $("#tocbox").open = false; d.hidden = false; d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); };
    toc.append(a);
    secs.push({ id, el: d, title, body, sm, a, text: fold(title + " " + body.textContent) });
  });
  if (secs[0]) secs[0].el.open = true;
}

function clearMarks(root) {
  root.querySelectorAll("mark").forEach(m => { m.replaceWith(document.createTextNode(m.textContent)); });
  root.normalize();
}
function mark(root, words) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(node => {
    const f = fold(node.nodeValue), hits = [];
    words.forEach(w => { for (let i = f.indexOf(w); i >= 0; i = f.indexOf(w, i + w.length)) hits.push([i, i + w.length]); });
    if (!hits.length) return;
    hits.sort((a, b) => a[0] - b[0]);
    const merged = []; hits.forEach(h => { const l = merged[merged.length - 1]; if (l && h[0] <= l[1]) l[1] = Math.max(l[1], h[1]); else merged.push(h.slice()); });
    const frag = document.createDocumentFragment(); let pos = 0; const s = node.nodeValue;
    merged.forEach(([a, b]) => { if (a > pos) frag.append(s.slice(pos, a)); const m = document.createElement("mark"); m.textContent = s.slice(a, b); frag.append(m); pos = b; });
    if (pos < s.length) frag.append(s.slice(pos));
    node.replaceWith(frag);
  });
}

let allOpen = false;
function setToggle() { $("#toggleAll").textContent = I18N.t(allOpen ? "help.collapse" : "help.expand"); }
function search() {
  const raw = $("#q").value.trim(), words = fold(raw).split(/\s+/).filter(w => w.length > 0);
  $("#clear").hidden = !raw;
  secs.forEach(s => { clearMarks(s.el); });
  if (!words.length) {
    secs.forEach(s => { s.el.hidden = false; s.a.hidden = false; });
    $("#tocbox").hidden = false; $("#intro").hidden = false; $("#none").hidden = true; $("#count").textContent = "";
    return;
  }
  let found = 0;
  secs.forEach(s => {
    const ok = words.every(w => s.text.includes(w));   // todas as palavras precisam estar na seção
    s.el.hidden = !ok; s.a.hidden = !ok;
    if (ok) { found++; s.el.open = true; mark(s.el, words); }
  });
  $("#tocbox").hidden = true; $("#intro").hidden = true;
  $("#none").hidden = found > 0;
  $("#count").textContent = found ? I18N.t("help.results", { n: found }) : "";
  const first = $("mark"); if (first) first.scrollIntoView({ block: "center" });
}

(async function init() {
  await I18N.ready; I18N.apply();
  document.title = I18N.t("help.title");
  build(); setToggle();
  let t = 0; $("#q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(search, 120); });
  $("#clear").onclick = () => { $("#q").value = ""; search(); $("#q").focus(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#q").value) { $("#q").value = ""; search(); } });
  $("#toggleAll").onclick = () => { allOpen = !allOpen; secs.forEach(s => { if (!s.el.hidden) s.el.open = allOpen; }); setToggle(); };
  $("#home").onclick = () => { location.href = "index.html"; };   // só aparece no app web
  if (location.hash.startsWith("#s-")) { const d = document.getElementById(location.hash.slice(1)); if (d) { d.open = true; d.scrollIntoView(); } }
})();
