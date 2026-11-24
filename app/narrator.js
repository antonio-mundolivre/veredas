// Narrador: lê o texto em voz alta com a voz do aparelho (speechSynthesis), versículo a versículo.
// Destaca o versículo, vira a página, respeita as pausas Selá e, nas Passagens, segue para o próximo capítulo.
const Narrator = (() => {
  const KEY = "narr";
  const DEF = { rate: 1, voices: {}, auto: true, selah: true, nums: false };
  const REGION = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE" };
  const supported = typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
  const SVG = {
    play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>', stop: '<path d="M6 6h12v12H6z"/>',
    prev: '<path d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/>', next: '<path d="M15.5 5H18v14h-2.5zM4 5l10.5 7L4 19z"/>',
    spk: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const icon = n => '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' + SVG[n] + "</svg>";

  let cfg = { ...DEF }, o = null, segs = [], i = 0, playing = false, active = false, tok = 0, timer = 0, cur = null;
  const $ = id => document.getElementById(id);

  const ready = (async () => {
    try { const r = await chrome.storage.local.get(KEY); if (r[KEY]) cfg = { ...DEF, ...r[KEY] }; } catch (e) { /* padrão */ }
    try { chrome.storage.onChanged.addListener(c => { if (c[KEY]) { cfg = { ...DEF, ...(c[KEY].newValue || {}) }; if ($("narrRate")) $("narrRate").value = String(cfg.rate); } }); } catch (e) {}
  })();

  // ---- vozes ----
  function voices() {
    if (!supported) return Promise.resolve([]);
    return new Promise(ok => {
      const now = speechSynthesis.getVoices();
      if (now.length) return ok(now);
      let done = false; const fin = () => { if (!done) { done = true; ok(speechSynthesis.getVoices()); } };
      speechSynthesis.addEventListener("voiceschanged", fin, { once: true });
      setTimeout(fin, 1500);
    });
  }
  const base = l => String(l || "").replace("_", "-").slice(0, 2).toLowerCase();
  function pickVoice(list, lang) {
    const b = base(lang), mine = list.filter(v => base(v.lang) === b);
    if (!mine.length) return null;
    const saved = mine.find(v => v.voiceURI === (cfg.voices || {})[b]);
    if (saved) return saved;
    const score = v => (v.lang.replace("_", "-") === REGION[b] ? 4 : 0) + (v.localService ? 2 : 0) + (/premium|enhanced|aprimorad|erweitert|améliorée|mejorada/i.test(v.name) ? 1 : 0);
    return mine.slice().sort((x, y) => score(y) - score(x))[0];
  }

  // ---- texto do capítulo em trechos ----
  function chunk(text) {
    const out = []; let acc = "";
    for (const part of text.split(/(?<=[.!?;:…])\s+/)) {
      if (acc && (acc + " " + part).length > 220) { out.push(acc); acc = part; } else acc = acc ? acc + " " + part : part;
    }
    if (acc) out.push(acc);
    return out.length ? out : [text];
  }
  function collect() {
    const root = o.root(); if (!root) return [];
    const list = [];
    root.querySelectorAll(".v").forEach(v => {
      if (v.classList.contains("dim") || !v.offsetParent) return;
      const vt = v.querySelector(".vt"); if (!vt) return;
      const nEl = v.querySelector(".n"), num = nEl ? nEl.textContent.trim() : "";
      let buf = "", first = true; const push = (sel) => {
        const t = buf.replace(/\s+/g, " ").trim(); buf = "";
        if (t) { list.push({ v, text: (first && cfg.nums && num ? num + ". " : "") + t, selahAfter: sel, num }); first = false; }
        else if (sel && list.length && list[list.length - 1].v === v) list[list.length - 1].selahAfter = true;
      };
      vt.childNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains("selah")) push(true); else buf += n.textContent; });
      push(false);
    });
    return list;
  }
  function inView(el) {
    const pr = o.viewport().getBoundingClientRect(), r = el.getClientRects()[0];
    return !!r && r.right > pr.left + 2 && r.left < pr.right - 2;
  }
  function startIndex() { const k = segs.findIndex(s => inView(s.v)); return k < 0 ? 0 : k; }

  // ---- falar ----
  function mark(on) {
    if (cur) cur.classList.remove("narr");
    cur = on || null;
    if (cur) cur.classList.add("narr");
  }
  function info() {
    const s = segs[i]; if (!s || !$("narrInfo")) return;
    const h = s.v.closest(".chapter, .card"), h1 = h && h.querySelector("h1");
    $("narrInfo").textContent = (h1 ? h1.textContent + (s.num ? ":" + s.num : "") : s.num) || "";
  }
  function setBtn() {
    const b = $("narrBtn"); if (!b) return;
    const on = active && playing;
    b.innerHTML = icon(on ? "pause" : active ? "play" : "spk");
    const k = on ? "narr.pause" : active ? "narr.resume" : "narr.listen";
    b.title = I18N.t(k); b.setAttribute("aria-label", I18N.t(k)); b.classList.toggle("on", active);
  }
  function showBar(on) {
    const bar = $("narrbar"); if (!bar) return;
    if (bar.hidden === !on) return;
    bar.hidden = !on;
    if (typeof Pager !== "undefined") Pager.layout();
  }
  function say(i0) {
    const my = tok; const s = segs[i0];
    if (!s) return finish();
    mark(s.v); info();
    if (!inView(s.v) && typeof Pager !== "undefined") Pager.reveal(s.v);
    voices().then(list => {
      if (my !== tok) return;
      const voice = pickVoice(list, o.lang());
      if (!voice && !list.length) { fail("narr.noVoice"); return; }
      const parts = chunk(s.text);
      const speak = k => {
        if (my !== tok) return;
        if (k >= parts.length) {
          const wait = s.selahAfter && cfg.selah ? Math.round(3000 / Math.max(.6, cfg.rate)) : 0;
          timer = setTimeout(() => { if (my === tok) { i = i0 + 1; say(i); } }, wait);
          return;
        }
        const u = new SpeechSynthesisUtterance(parts[k]);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = REGION[base(o.lang())] || o.lang();
        u.rate = cfg.rate;
        u.onend = () => speak(k + 1);
        u.onerror = e => { if (my !== tok || e.error === "canceled" || e.error === "interrupted") return; fail("narr.error"); };
        speechSynthesis.speak(u);
      };
      speak(0);
    });
  }
  async function finish() {
    const my = tok;
    let more = false;
    try { more = o.advance ? await o.advance() : false; } catch (e) { more = false; }
    if (my !== tok) return;
    if (!more) return stop();
    segs = collect(); i = 0;
    if (!segs.length) return stop();
    say(0);
  }
  function fail(key) {
    const msg = I18N.t(key); stop();
    if (o.notify) o.notify(msg); else if ($("narrInfo")) $("narrInfo").textContent = msg;
  }

  function cancelSpeech() { tok++; clearTimeout(timer); if (supported) speechSynthesis.cancel(); }
  function start() {
    if (!supported) { if (o.notify) o.notify(I18N.t("narr.noSupport")); return; }
    segs = collect(); if (!segs.length) return;
    i = startIndex(); active = true; playing = true;
    if (typeof Wake !== "undefined") Wake.hold(true);   // a leitura em voz alta para quando a tela apaga (iPhone)
    showBar(true); setBtn(); say(i);
  }
  function pause() { if (!active) return; playing = false; cancelSpeech(); setBtn(); }
  function resume() { if (!active) return; playing = true; setBtn(); setTimeout(() => say(i), 60); }
  function stop() {
    cancelSpeech(); active = false; playing = false; segs = []; mark(null);
    if (typeof Wake !== "undefined") Wake.hold(false);
    showBar(false); setBtn();
  }
  function jump(d) {
    if (!active || !segs.length) return;
    const v0 = segs[i] && segs[i].v; let k = i;
    if (d > 0) { while (k < segs.length && segs[k].v === v0) k++; if (k >= segs.length) return; }
    else {
      const sameStart = segs.findIndex(s => s.v === v0);
      if (i > sameStart) k = sameStart;            // 1º toque: volta ao início do versículo atual
      else { k = Math.max(0, sameStart - 1); const pv = segs[k].v; while (k > 0 && segs[k - 1].v === pv) k--; }
    }
    cancelSpeech(); i = k;
    if (playing) setTimeout(() => say(i), 60); else { mark(segs[i].v); info(); }
  }
  function toggle() { if (!active) start(); else if (playing) pause(); else resume(); }

  // ---- ligação com a página ----
  // opções: root() -> elemento com os versículos; viewport() -> área visível; lang() -> "pt"/"en"...; advance() -> Promise<bool>; notify(msg)
  function attach(opts) {
    o = opts;
    const b = $("narrBtn"); if (!b) return;
    b.hidden = !supported; setBtn();
    b.onclick = toggle;
    const set = (id, ic, key, fn) => { const e = $(id); if (!e) return; e.innerHTML = icon(ic); e.title = I18N.t(key); e.setAttribute("aria-label", I18N.t(key)); e.onclick = fn; };
    set("narrPrev", "prev", "narr.prev", () => jump(-1));
    set("narrNext", "next", "narr.next", () => jump(1));
    set("narrStop", "stop", "narr.stop", stop);
    const r = $("narrRate");
    if (r) { r.title = I18N.t("narr.speed"); r.setAttribute("aria-label", I18N.t("narr.speed")); r.value = String(cfg.rate);
      r.onchange = () => { cfg.rate = +r.value; try { chrome.storage.local.set({ [KEY]: cfg }); } catch (e) {} if (playing) { cancelSpeech(); setTimeout(() => say(i), 60); } }; }
    document.addEventListener("keydown", e => { if (e.key === "Escape" && active && !document.querySelector(".pickov:not([hidden])")) stop(); });
    window.addEventListener("pagehide", () => { if (supported) speechSynthesis.cancel(); });
  }
  const isActive = () => active;
  const settings = () => cfg;
  const save = patch => { cfg = { ...cfg, ...patch }; return chrome.storage.local.set({ [KEY]: cfg }); };
  function sample(lang, text) {
    if (!supported) return;
    speechSynthesis.cancel();
    voices().then(list => {
      const v = pickVoice(list, lang), u = new SpeechSynthesisUtterance(text);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = REGION[base(lang)] || lang;
      u.rate = cfg.rate; speechSynthesis.speak(u);
    });
  }
  return { ready, attach, start, stop, pause, resume, toggle, isActive, voices, settings, save, sample, supported, pickVoice };
})();
