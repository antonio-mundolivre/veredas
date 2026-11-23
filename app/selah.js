// Pausas para meditação (Selá): um toque numa palavra carimba סֶלָה logo depois dela; um toque no carimbo tira.
// As pausas ficam guardadas no aparelho, por versão/capítulo/versículo; o texto original nunca é alterado.
const Selah = (() => {
  const KEY = "selah", MARK = "סֶלָה";
  let data = {}, saveT = 0;
  const ready = (async () => {
    try { const r = await chrome.storage.local.get(KEY); if (r[KEY] && typeof r[KEY] === "object") data = r[KEY]; } catch (e) { /* sem armazenamento */ }
  })();
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => chrome.storage.local.set({ [KEY]: data }), 200); };

  function mark(off) {
    const m = document.createElement("span");
    m.className = "selah"; m.dataset.off = off; m.lang = "he"; m.dir = "rtl";
    m.setAttribute("role", "button"); m.setAttribute("aria-label", "Pausa para meditação (Selá). Toque para tirar.");
    m.textContent = MARK;
    return m;
  }
  function draw(vt) {
    const text = vt._text, offs = [...new Set(data[vt._key] || [])].filter(o => o > 0 && o <= text.length).sort((a, b) => a - b);
    const frag = document.createDocumentFragment();
    let p = 0;
    for (const o of offs) { if (o > p) frag.append(text.slice(p, o)); frag.append(mark(o)); p = o; }
    if (p < text.length) frag.append(text.slice(p));
    vt.replaceChildren(frag);
  }
  // monta o conteúdo de um versículo: número, espaço e o texto (com as pausas guardadas)
  function fill(sp, n, v, key) {
    const vt = document.createElement("span");
    vt.className = "vt"; vt._text = v.text; vt._key = key + "|" + v.n;
    draw(vt);
    sp.append(n, " ", vt, " ");
  }
  function toggle(vt, off) {
    const list = data[vt._key] || [];
    const i = list.indexOf(off);
    if (i >= 0) list.splice(i, 1); else list.push(off);
    if (list.length) data[vt._key] = list; else delete data[vt._key];
    draw(vt); save();
  }
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, off: p.offset }; }
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r && { node: r.startContainer, off: r.startOffset }; }
    return null;
  }
  const textLen = n => (n.nodeType === 3 ? n.nodeValue.length : 0);

  document.addEventListener("click", e => {
    const root = e.target.closest && e.target.closest("#content");
    if (!root || e.detail > 1) return;
    const m = e.target.closest(".selah");
    if (m) { const vt = m.closest(".vt"); if (vt) toggle(vt, +m.dataset.off); return; }
    if (e.target.closest("button,a,select,input,.n")) return;
    const vt = e.target.closest(".vt");
    if (!vt) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.toString().trim()) return;                     // selecionando texto com o mouse: não carimba
    const c = caretAt(e.clientX, e.clientY);
    if (!c || !vt.contains(c.node)) return;
    let pos = 0;
    if (c.node === vt) { for (let k = 0; k < c.off; k++) pos += textLen(vt.childNodes[k]); }
    else {
      if (c.node.parentNode !== vt) return;
      for (const ch of vt.childNodes) { if (ch === c.node) break; pos += textLen(ch); }
      pos += c.off;
    }
    // vai até o fim da palavra tocada
    const t = vt._text, ws = /\s/;
    let i = Math.min(pos, t.length);
    if (!(i > 0 && (i >= t.length || ws.test(t[i])) && !ws.test(t[i - 1]))) while (i < t.length && !ws.test(t[i])) i++;
    if (i > 0) toggle(vt, i);
  });

  const clearAll = async () => { data = {}; clearTimeout(saveT); await chrome.storage.local.remove(KEY); };
  return { ready, fill, clearAll, MARK };
})();
