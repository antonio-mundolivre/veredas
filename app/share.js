// Compartilhar passagens: monta a mensagem (WhatsApp e e-mail) e um link que o destinatário abre no Veredas.
// O link leva só as referências (livro, capítulo, versículos e versão), não o texto: fica curto e o texto vem da Bíblia do próprio app.
const Share = (() => {
  const WEB_BASE = "https://antonio-mundolivre.github.io/veredas/app/";   // endereço do app na web (GitHub Pages)
  const PARAM = "p";
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).replace(/\d/g, d => SUP[+d]);

  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

  // Link curto: 1 byte de formato, 1 da versão e 4 bytes por passagem (livro, capítulo, 1º e último versículo), em base64url.
  // Três passagens ficam com ~20 caracteres de código. Os links antigos (JSON) continuam sendo aceitos.
  const VER_IDS = ["blivre", "bkj", "acf", "arc", "aa", "nvi", "web", "rvg", "lsg", "l1912"];   // só crescer, nunca reordenar
  const toB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  function encode(list, verId) {
    const vi = VER_IDS.indexOf(verId), bytes = [2, vi < 0 ? 255 : vi];
    list.forEach(x => { const whole = !x.s || x.showAll; bytes.push(x.book, x.chapter, whole ? 0 : x.s, whole ? 0 : (x.e || x.s)); });
    return toB64(bytes);
  }
  const url = code => WEB_BASE + "culto.html#" + PARAM + "=" + code;

  function decodeV2(c) {
    const by = fromB64(c);
    if (by[0] !== 2 || (by.length - 2) % 4 || by.length < 6) return null;
    const ver = by[1] === 255 ? null : VER_IDS[by[1]] || null, items = [];
    for (let k = 2; k < by.length; k += 4) {
      const [book, chapter, s, e] = [by[k], by[k + 1], by[k + 2], by[k + 3]];
      if (!BOOKS[book] || !(chapter >= 1 && chapter <= BOOKS[book][2])) continue;
      items.push({ book, chapter, s: s || null, e: s ? (e || s) : null, showAll: false });
    }
    return items.length ? { ver, items } : null;
  }
  function decodeV1(c) {
    const o = JSON.parse(b64d(c));
    if (!o || o.v !== 1 || !Array.isArray(o.i)) return null;
    const items = [];
    for (const r of o.i) {
      const book = BOOKS.findIndex(b => b[3] === r[0]);
      if (book < 0 || !(r[1] >= 1 && r[1] <= BOOKS[book][2])) continue;
      items.push({ book, chapter: r[1], s: r[2] || null, e: r[2] ? (r[3] || r[2]) : null, showAll: !!r[4] });
    }
    return items.length ? { ver: o.ver, items } : null;
  }
  // aceita link completo, "#p=código" ou só o código
  function decode(text) {
    if (!text) return null;
    let c = String(text).trim();
    const m = c.match(/[#?&]p=([A-Za-z0-9_-]+)/);
    if (m) c = m[1];
    if (!/^[A-Za-z0-9_-]{6,}$/.test(c)) return null;
    try { return c.startsWith("eyJ") ? decodeV1(c) : decodeV2(c); } catch (e) { return null; }
  }
  const fromLocation = () => decode(location.hash);

  // ---- texto das mensagens ----
  // blocos: [{ref, ver, verses:[{n, text}]}]
  const T = I18N.t;
  function render(kind, blocks, link, budget) {
    const wa = kind === "wa";
    const rule = wa ? "▬▬▬▬▬▬▬▬▬▬▬▬▬▬" : "════════════════════";
    const thin = wa ? rule : "────────────────────";
    const head = wa ? `📖 *Veredas* · ${T("share.title")}\n${rule}\n` : `📖 VEREDAS · ${T("share.title").toUpperCase()}\n${rule}\n`;
    const foot = `\n${thin}\n🔗 ${T("share.open")}:\n${link}`;
    let left = budget - head.length - foot.length - 80, out = "", cut = false, listed = [];
    blocks.forEach((b, bi) => {
      if (cut) { listed.push(b.ref); return; }
      const title = wa ? `\n✝️ *${b.ref}* _(${b.ver})_\n` : `\n▌${b.ref} · ${b.ver}\n`;
      let body = "", used = 0;
      for (const v of b.verses) {
        const line = (wa ? `${sup(v.n)} ${v.text}` : `  ${sup(v.n)} ${v.text}`) + "\n";
        if (used + line.length + title.length > left && (used > 0 || bi > 0)) { body += wa ? "_…_\n" : "  …\n"; cut = true; break; }
        body += line; used += line.length;
      }
      out += title + body; left -= title.length + used;
    });
    if (listed.length) out += `\n${T("share.also")} ${listed.join(" · ")}\n`;
    return { text: head + out + foot, truncated: cut };
  }
  // e-mail formatado (HTML com estilos na própria tag, o que os programas de e-mail aceitam): copiado para a área de transferência
  const esc = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function html(blocks, link) {
    const ACC = "#7a5c30", INK = "#27231c", MUTE = "#8a8272", PAPER = "#fbf9f4", BAND = "#f1ece0";
    const serif = "Georgia,'Times New Roman',serif", sans = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
    const cards = blocks.map(b => {
      const vs = b.verses.map(v => `<span style="font-family:${sans};font-size:11px;font-weight:bold;color:${ACC};vertical-align:super;padding-right:3px">${v.n}</span>${esc(v.text)}`).join(" ");
      return `<tr><td style="padding:0 24px 16px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:1px solid #e5dfd0;border-left:5px solid ${ACC};border-radius:8px"><tr><td style="padding:16px 18px">`
        + `<div style="font-family:${sans};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTE};padding-bottom:4px">${esc(b.ver)}</div>`
        + `<div style="font-family:${serif};font-size:22px;font-weight:bold;color:${INK};padding-bottom:10px">${esc(b.ref)}</div>`
        + `<div style="font-family:${serif};font-size:17px;line-height:1.7;color:${INK}">${vs}</div></td></tr></table></td></tr>`;
    }).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e5dfd0;border-radius:10px"><tr><td style="background:${ACC};padding:18px 24px;border-radius:10px 10px 0 0">`
      + `<div style="font-family:${sans};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ecdfc6">Veredas</div>`
      + `<div style="font-family:${serif};font-size:24px;color:#ffffff;padding-top:2px">${esc(T("share.title"))}</div></td></tr>`
      + `<tr><td style="height:18px;line-height:18px;font-size:1px">&nbsp;</td></tr>${cards}`
      + `<tr><td style="padding:4px 24px 24px 24px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:${ACC};color:#ffffff;font-family:${sans};font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:8px">${esc(T("share.open"))}</a>`
      + `<div style="font-family:${sans};font-size:12px;color:${MUTE};padding-top:10px;word-break:break-all"><a href="${esc(link)}" style="color:${MUTE}">${esc(link)}</a></div></td></tr></table>`;
  }
  const subject = blocks => T("share.mailSubject", { refs: blocks.slice(0, 3).map(b => b.ref).join(", ") + (blocks.length > 3 ? " +" + (blocks.length - 3) : "") });
  const waLink = text => "https://wa.me/?text=" + encodeURIComponent(text);
  const mailLink = (subj, text) => "mailto:?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(text);

  return { encode, decode, url, fromLocation, render, html, subject, waLink, mailLink, WEB_BASE };
})();
