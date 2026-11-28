// Imagem das passagens para redes sociais (Instagram, Facebook…): o mesmo visual do e-mail formatado
// (faixa do Veredas, cartões com borda marrom) desenhado num canvas de 1080 × 1350 (retrato 4:5, o maior que o
// Instagram mostra inteiro no feed). Embaixo vai um QR code com o link das passagens no Veredas, porque no Instagram
// os links da legenda não abrem. Texto longo vira mais de uma imagem (carrossel), cada uma com o QR.
const SocialImg = (() => {
  const W = 1080, H = 1350, PAD = 64, HEAD = 176, FOOT = 262;
  const ACC = "#7a5c30", INK = "#27231c", MUTE = "#8a8272", PAPER = "#f3eee3", CARD = "#fbf9f4", LINE = "#e2dbcb", PALE = "#ecdfc6";
  const SERIF = "Georgia, 'Times New Roman', 'Noto Serif', serif", SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  const MAXPAGES = 10;
  const T = (k, p) => I18N.t(k, p);
  const SIZES = [58, 52, 47, 43, 40, 37];   // tamanho da letra dos versículos: o maior que couber numa imagem só
  const PAGED = 38;                          // quando não cabe, divide em várias imagens com este tamanho

  // ---- medidas ----
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fitText(c, text, maxW) {   // corta com reticências o que não cabe numa linha
    if (c.measureText(text).width <= maxW) return text;
    let s = text; while (s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s.trimEnd() + "…";
  }
  // quebra os versículos de um cartão em linhas; cada linha é uma lista de pedaços {t, sup}
  function wrap(c, block, S, maxW) {
    const one = block.verses.length === 1;
    const fontV = `${S}px ${SERIF}`, fontN = `bold ${Math.round(S * 0.52)}px ${SANS}`;
    const words = [];
    block.verses.forEach((v, i) => {
      const text = String(v.text || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      if (!one) words.push({ t: String(v.n), sup: true, gap: i > 0 });
      const ws = (one ? T("share.quote", { t: text }) : text).split(" ");
      ws.forEach((w, k) => words.push({ t: w, sup: false, glue: !one && k === 0 }));
    });
    c.font = fontV; const sp = c.measureText(" ").width;
    const width = w => { c.font = w.sup ? fontN : fontV; return c.measureText(w.t).width; };
    const lines = []; let line = [], x = 0;
    for (const w of words) {
      const ww = width(w), lead = line.length ? (w.glue ? S * 0.24 : sp) : 0;
      if (line.length && x + lead + ww > maxW) {
        // o número do versículo não fica sozinho no fim da linha
        const carry = line.length > 1 && line[line.length - 1].sup ? [line.pop()] : [];
        lines.push(line); line = carry; x = carry.length ? width(carry[0]) : 0;
        if (carry.length) { line.push(w); x += S * 0.24 + ww; continue; }
        line = [w]; x = ww; continue;
      }
      line.push(w); x += lead + ww;
    }
    if (line.length) lines.push(line);
    return { lines, fontV, fontN, sp, lh: Math.round(S * 1.5), S };
  }
  const refH = S => Math.round(Math.max(44, S * 0.9)) + 18;
  const cardPad = S => Math.round(S * 0.7);

  // ---- montagem das páginas ----
  // cada página: lista de pedaços de cartão {b, w, from, to, cont}
  function heightOf(w, n, S) { return cardPad(S) * 2 + refH(S) + n * w.lh; }
  function paginate(c, blocks, S, maxW, avail, gap) {
    const pl = blocks.map(b => ({ b, w: wrap(c, b, S, maxW) })), pages = [[]]; let used = 0;
    for (const { b, w } of pl) {
      let i = 0;
      while (i < w.lines.length) {
        const room = avail - used - (pages[pages.length - 1].length ? gap : 0);
        const fit = Math.floor((room - cardPad(S) * 2 - refH(S)) / w.lh);
        const rest = w.lines.length - i;
        const empty = !pages[pages.length - 1].length;
        if (fit >= Math.min(rest, 2) || empty) {   // cabe pelo menos 2 linhas (ou o resto) nesta página
          const n = Math.max(1, Math.min(fit, rest));
          pages[pages.length - 1].push({ b, w, from: i, to: i + n, cont: i > 0 });
          used += (pages[pages.length - 1].length > 1 ? gap : 0) + heightOf(w, n, S); i += n;
        }
        if (i < w.lines.length) { pages.push([]); used = 0; }
      }
    }
    return pages.filter(p => p.length);
  }
  function layout(c, blocks) {
    const avail = H - HEAD - FOOT - 2 * 44;
    for (const S of SIZES) {
      const inner = W - PAD * 2 - 24 - 2 * cardPad(S);
      const p = paginate(c, blocks, S, inner, avail, 28);
      if (p.length === 1) return { S, pages: p };
    }
    const inner = W - PAD * 2 - 24 - 2 * cardPad(PAGED);
    return { S: PAGED, pages: paginate(c, blocks, PAGED, inner, avail, 28) };
  }

  // ---- desenho ----
  function drawHeader(c, page, total) {
    c.fillStyle = ACC; c.fillRect(0, 0, W, HEAD);
    c.fillStyle = PALE; c.font = `600 26px ${SANS}`; c.textBaseline = "alphabetic";
    if ("letterSpacing" in c) c.letterSpacing = "6px";
    c.fillText("VEREDAS", PAD, 68);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    c.fillStyle = "#ffffff"; c.font = `bold 60px ${SERIF}`;
    c.fillText(fitText(c, T("share.title"), W - PAD * 2 - 120), PAD, 136);
    if (total > 1) { c.font = `600 28px ${SANS}`; c.fillStyle = PALE; c.textAlign = "right"; c.fillText(`${page} / ${total}`, W - PAD, 136); c.textAlign = "left"; }
  }
  function drawFooter(c, qr, link) {
    const y0 = H - FOOT;
    c.fillStyle = "#ebe4d4"; c.fillRect(0, y0, W, FOOT);
    c.fillStyle = ACC; c.fillRect(0, y0, W, 4);
    // QR com margem branca (zona de silêncio de 4 módulos)
    const n = qr.length, box = 196, q = 4, mod = Math.floor(box / (n + 2 * q)), size = mod * (n + 2 * q);
    const qx = PAD, qy = y0 + Math.round((FOOT - size) / 2) + 2;
    c.fillStyle = "#ffffff"; rr(c, qx - 6, qy - 6, size + 12, size + 12, 14); c.fill();
    c.fillStyle = "#111111";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr[r][k]) c.fillRect(qx + (k + q) * mod, qy + (r + q) * mod, mod, mod);
    const tx = qx + size + 44, tw = W - PAD - tx;
    c.fillStyle = INK; c.font = `bold 40px ${SERIF}`; c.fillText(fitText(c, T("share.open"), tw), tx, y0 + 98);
    c.fillStyle = MUTE; c.font = `28px ${SANS}`; c.fillText(fitText(c, T("social.scan"), tw), tx, y0 + 146);
    c.fillStyle = ACC; c.font = `600 26px ${SANS}`;
    const host = link.replace(/^https?:\/\//, "").replace(/\/app\/.*$/, "");
    c.fillText(fitText(c, host, tw), tx, y0 + 192);
  }
  function drawCard(c, part, S, x, y) {
    const { b, w, from, to, cont } = part, pad = cardPad(S), n = to - from, h = heightOf(w, n, S), cw = W - PAD * 2;
    c.fillStyle = CARD; rr(c, x, y, cw, h, 20); c.fill();
    c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
    c.save(); rr(c, x, y, cw, h, 20); c.clip(); c.fillStyle = ACC; c.fillRect(x, y, 12, h); c.restore();
    const ix = x + 12 + pad, iw = cw - 12 - pad * 2;
    // título: referência e versão
    const rs = Math.round(Math.max(44, S * 0.9));
    c.textBaseline = "alphabetic";
    c.font = `bold ${rs}px ${SERIF}`; c.fillStyle = INK;
    const ref = cont ? b.ref + " " + T("social.cont") : b.ref;
    const refText = fitText(c, ref, iw - 160); c.fillText(refText, ix, y + pad + rs * 0.82);
    const rw = c.measureText(refText).width;
    c.font = `600 ${Math.round(rs * 0.5)}px ${SANS}`; c.fillStyle = MUTE;
    if ("letterSpacing" in c) c.letterSpacing = "2px";
    c.fillText(b.ver, ix + rw + 18, y + pad + rs * 0.82);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    // versículos
    let ly = y + pad + refH(S) + w.lh * 0.78;
    for (let li = from; li < to; li++) {
      let lx = ix;
      w.lines[li].forEach((tok, k) => {
        if (k > 0) lx += tok.glue ? S * 0.24 : (tok.sup && !tok.gap ? 0 : w.sp);
        if (tok.sup) { c.font = w.fontN; c.fillStyle = ACC; c.fillText(tok.t, lx, ly - S * 0.36); }
        else { c.font = w.fontV; c.fillStyle = INK; c.fillText(tok.t, lx, ly); }
        lx += c.measureText(tok.t).width;
      });
      ly += w.lh;
    }
    return h;
  }

  // blocks: [{ref, ver, verses:[{n,text}]}]; devolve Promise<Blob[]> (PNG)
  async function render(blocks, link) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    let { S, pages } = layout(c, blocks);
    let cut = false;
    if (pages.length > MAXPAGES) { pages = pages.slice(0, MAXPAGES); cut = true; }
    const qr = QR.matrix(link, "M"), out = [];
    for (let i = 0; i < pages.length; i++) {
      c.clearRect(0, 0, W, H);
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      drawHeader(c, i + 1, pages.length);
      const hs = pages[i].map(p => heightOf(p.w, p.to - p.from, S));
      const total = hs.reduce((a, b) => a + b, 0) + 28 * (hs.length - 1);
      const top = HEAD + 44, avail = H - HEAD - FOOT - 2 * 44;
      let y = top + Math.max(0, Math.round((avail - total) / 2));   // conteúdo curto fica no meio
      pages[i].forEach((p, k) => { y += drawCard(c, p, S, PAD, y) + 28; });
      if (cut && i === pages.length - 1) { c.fillStyle = MUTE; c.font = `italic 30px ${SERIF}`; c.textAlign = "right"; c.fillText(T("social.more"), W - PAD, H - FOOT - 18); c.textAlign = "left"; }
      drawFooter(c, qr, link);
      out.push(await new Promise(ok => cv.toBlob(ok, "image/png")));
    }
    return out;
  }
  return { render, W, H };
})();
