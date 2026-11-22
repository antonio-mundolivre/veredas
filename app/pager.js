// Leitura em páginas (sem rolagem): o texto é dividido em colunas do tamanho da janela e cada "página" é uma coluna.
// Usado pelo leitor do plano e pelo acompanhamento de culto. Também esconde o cursor do mouse quando fica parado.
const Pager = (() => {
  const GAP = 48;
  const hooks = { next: null };       // chamado ao tentar avançar na última página (ex.: carregar o próximo capítulo)
  let main, box, prevB, nextB, info;
  let page = 0, pages = 1, W = 0, step = 1, raf = 0, wheelAt = 0, snapT = 0;

  const clamp = p => Math.max(0, Math.min(pages - 1, p));
  const rectOf = e => { const r = e.getClientRects(); return r.length ? r[0] : null; };

  function pageOf(e) {
    const r = rectOf(e); if (!r) return null;
    const abs = r.left - main.getBoundingClientRect().left + main.scrollLeft;
    return clamp(Math.floor((abs + 2) / step));
  }
  // primeiro elemento visível na página atual (âncora para não perder o lugar ao redimensionar)
  function firstOnPage() {
    const mr = main.getBoundingClientRect();
    for (const e of main.querySelectorAll(".v, h1, h2, .kicker, .actions, .cardtop, .passage-head, .error, .status, .empty-hint")) {
      const r = rectOf(e); if (!r) continue;
      const x = r.left - mr.left;
      if (x >= -1 && x < mr.width - 1) return e;
    }
    return null;
  }

  function updateBar() {
    const last = page >= pages - 1;
    info.textContent = `Página ${page + 1} de ${pages}`;
    prevB.disabled = page <= 0;
    nextB.textContent = last && hooks.next ? "Próximo capítulo ›" : "Próxima ›";
    nextB.disabled = last && !hooks.next;
  }
  function goTo(p) {
    page = clamp(p);
    main.scrollLeft = page * step;
    updateBar();
  }

  function layoutNow(keep = true) {
    if (!main) return;
    const anchor = keep ? firstOnPage() : null;
    const cs = getComputedStyle(box);
    const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const innerW = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    main.style.width = "auto";
    const maxW = parseFloat(getComputedStyle(main).maxWidth);
    W = Math.max(120, Math.floor(Math.min(innerW, isNaN(maxW) ? innerW : maxW)));
    main.style.width = W + "px";
    main.style.height = Math.max(120, Math.floor(h)) + "px";
    main.style.columnGap = GAP + "px";
    main.style.columnWidth = (W - 0.5) + "px";
    step = W + GAP;
    // conta as páginas pelo que realmente está desenhado (o scrollWidth pode vir velho no Safari do iPhone)
    main.scrollLeft = 0;
    let wide = main.scrollWidth;
    try {
      const rg = document.createRange(); rg.selectNodeContents(main);
      const rr = rg.getBoundingClientRect();
      if (rr.width > 0) wide = Math.min(wide, Math.ceil(rr.right - main.getBoundingClientRect().left));
    } catch (e) { /* usa o scrollWidth */ }
    pages = Math.max(1, Math.round((wide + GAP) / step));
    let p = page;
    if (anchor) { const q = pageOf(anchor); if (q !== null) p = q; }
    goTo(p);
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => layoutNow()); };

  function next() { if (page < pages - 1) goTo(page + 1); else if (hooks.next) hooks.next(); }
  function prev() { goTo(page - 1); }

  // mostra a página que contém o elemento
  function reveal(e) {
    if (!main || !e) return;
    layoutNow();
    const p = pageOf(e);
    if (p !== null) goTo(p);
    setTimeout(() => { layoutNow(); const q = pageOf(e); if (q !== null) goTo(q); }, 150);   // segunda passada, quando o navegador já assentou o layout
  }
  function reset() { page = 0; layoutNow(false); goTo(0); }

  function buildAlign(group, get, set) {
    const defs = { left: [14, 10, 14, 8], center: [14, 8, 12, 6], right: [14, 8, 14, 6], justify: [14, 14, 14, 14] };
    const mk = (v, title) => {
      const b = document.createElement("button");
      b.title = title; b.dataset.align = v; b.setAttribute("aria-label", title);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "16"); svg.setAttribute("height", "14"); svg.setAttribute("viewBox", "0 0 16 14");
      [1, 4.5, 8, 11.5].forEach((y, i) => {
        const w = defs[v][i], x = v === "right" ? 16 - w : v === "center" ? (16 - w) / 2 : 0;
        const l = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        l.setAttribute("x", x); l.setAttribute("y", y); l.setAttribute("width", w); l.setAttribute("height", "1.6"); l.setAttribute("rx", ".8");
        l.setAttribute("fill", "currentColor"); svg.append(l);
      });
      b.append(svg);
      b.onclick = () => set(v);
      return b;
    };
    group.replaceChildren(mk("left", "Alinhar à esquerda"), mk("center", "Centralizar"), mk("right", "Alinhar à direita"), mk("justify", "Justificar nas duas margens"));
    return () => group.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.align === get()));
  }

  function init() {
    main = document.getElementById("content");
    box = document.getElementById("pager");
    prevB = document.getElementById("prev"); nextB = document.getElementById("next"); info = document.getElementById("pageinfo");
    prevB.onclick = prev; nextB.onclick = next;

    new ResizeObserver(schedule).observe(box);
    new MutationObserver(schedule).observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden"] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

    // se algo rolar a coluna por conta própria (foco, scrollIntoView), volta para o limite de uma página
    main.addEventListener("scroll", () => {
      clearTimeout(snapT);
      snapT = setTimeout(() => { const p = clamp(Math.round(main.scrollLeft / step)); if (Math.abs(main.scrollLeft - p * step) > 1 || p !== page) goTo(p); }, 80);
    });
    box.addEventListener("wheel", e => {
      if (!e.deltaY || e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now(); if (now - wheelAt < 350) return;
      wheelAt = now;
      e.deltaY > 0 ? next() : prev();
    }, { passive: false });
    document.addEventListener("keydown", e => {
      if (e.altKey || e.ctrlKey || e.metaKey || document.body.classList.contains("picking")) return;
      const t = e.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      const k = e.key;
      if (k === "PageDown" || (!typing && (k === "ArrowRight" || (k === " " && !e.shiftKey)))) { e.preventDefault(); next(); }
      else if (k === "PageUp" || (!typing && (k === "ArrowLeft" || (k === " " && e.shiftKey)))) { e.preventDefault(); prev(); }
      else if (!typing && k === "Home") { e.preventDefault(); goTo(0); }
      else if (!typing && k === "End") { e.preventDefault(); goTo(pages - 1); }
    });

    // cursor some depois de um tempinho sem mexer o mouse
    const root = document.documentElement; let idleT = 0;
    const wake = () => { root.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => root.classList.add("idle"), 2500); };
    document.addEventListener("mousemove", e => { if (e.movementX || e.movementY) wake(); });
    document.addEventListener("mousedown", wake);
    document.addEventListener("wheel", wake, { passive: true });
    wake();
    layoutNow(false);
  }

  return { init, layout: schedule, layoutNow, reveal, reset, next, prev, goTo, hooks, buildAlign, refreshBar: () => updateBar(), get page() { return page; }, get pages() { return pages; } };
})();
