// Compartilhar passagens: monta a mensagem (WhatsApp e e-mail) e um link que o destinatário abre no Veredas.
// O link leva só as referências (livro, capítulo, versículos e versão), não o texto: fica curto e o texto vem da Bíblia do próprio app.
const Share = (() => {
  const WEB_BASE = "https://antonio-mundolivre.github.io/veredas/app/";   // endereço do app na web (GitHub Pages)
  const PARAM = "p";
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).replace(/\d/g, d => SUP[+d]);

  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

  // lista [{book (índice), chapter, s, e, showAll}] + id da versão -> código curto
  function encode(list, verId) {
    const i = list.map(x => [BOOKS[x.book][3], x.chapter, x.s || 0, x.e || 0, x.showAll ? 1 : 0]);
    return b64e(JSON.stringify({ v: 1, ver: verId, i }));
  }
  const url = code => WEB_BASE + "culto.html#" + PARAM + "=" + code;

  // aceita link completo, "#p=código" ou só o código
  function decode(text) {
    if (!text) return null;
    let c = String(text).trim();
    const m = c.match(/[#?&]p=([A-Za-z0-9_-]+)/);
    if (m) c = m[1];
    if (!/^[A-Za-z0-9_-]{8,}$/.test(c)) return null;
    try {
      const o = JSON.parse(b64d(c));
      if (!o || o.v !== 1 || !Array.isArray(o.i)) return null;
      const items = [];
      for (const r of o.i) {
        const book = BOOKS.findIndex(b => b[3] === r[0]);
        if (book < 0 || !(r[1] >= 1 && r[1] <= BOOKS[book][2])) continue;
        items.push({ book, chapter: r[1], s: r[2] || null, e: r[2] ? (r[3] || r[2]) : null, showAll: !!r[4] });
      }
      return items.length ? { ver: o.ver, items } : null;
    } catch (e) { return null; }
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
  const subject = blocks => T("share.mailSubject", { refs: blocks.slice(0, 3).map(b => b.ref).join(", ") + (blocks.length > 3 ? " +" + (blocks.length - 3) : "") });
  const waLink = text => "https://wa.me/?text=" + encodeURIComponent(text);
  const mailLink = (subj, text) => "mailto:?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(text);

  return { encode, decode, url, fromLocation, render, subject, waLink, mailLink, WEB_BASE };
})();
