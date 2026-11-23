// Idiomas do Veredas. Todas as frases da interface ficam em lang/src/<idioma>/*.json e são reunidas em lang/<idioma>.js
// (tools/merge-lang.py). No código: t("chave") ou t("chave", { n: 3 }) com {n} no texto; frases com plural usam as
// chaves "chave.one" e "chave.other". No HTML: data-i18n, data-i18n-title, data-i18n-placeholder, data-i18n-aria-label.
const I18N = (() => {
  const dicts = {};
  const LOCALES = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE" };
  let lang = "pt";
  const add = (l, obj) => { dicts[l] = Object.assign(dicts[l] || {}, obj); };
  const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s);
  function t(key, p) {
    let k = key;
    if (p && typeof p.n === "number") {
      const cat = new Intl.PluralRules(LOCALES[lang] || lang).select(p.n);
      for (const c of [cat, "other"]) if ((dicts[lang] && dicts[lang][key + "." + c] != null) || (dicts.pt && dicts.pt[key + "." + c] != null)) { k = key + "." + c; break; }
    }
    const s = (dicts[lang] && dicts[lang][k] != null) ? dicts[lang][k] : (dicts.pt && dicts.pt[k] != null ? dicts.pt[k] : null);
    if (s == null) { console.warn("i18n: falta a chave", k); return k; }
    return fill(s, p);
  }
  // **negrito** em frases que precisam dele (sem usar innerHTML)
  function rich(node, text) {
    node.replaceChildren(...text.split("**").map((part, i) => {
      if (i % 2) { const b = document.createElement("b"); b.textContent = part; return b; }
      return document.createTextNode(part);
    }));
  }
  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(e => { const s = t(e.dataset.i18n); s.includes("**") ? rich(e, s) : (e.textContent = s); });
    for (const a of ["title", "placeholder", "aria-label"])
      root.querySelectorAll(`[data-i18n-${a}]`).forEach(e => e.setAttribute(a, t(e.getAttribute(`data-i18n-${a}`))));
    if (document.documentElement) document.documentElement.lang = LOCALES[lang] || lang;
  }
  async function init() {
    try {
      const r = await chrome.storage.local.get("lang");
      if (r.lang && dicts[r.lang]) lang = r.lang;
      else {   // primeira vez: usa o idioma do navegador, se houver tradução; senão, português
        const nav = ((chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || "pt").slice(0, 2).toLowerCase();
        if (dicts[nav]) lang = nav;
      }
    } catch (e) { /* fica em português */ }
    applyBooks();
    sortVersions();
    return lang;
  }
  // nomes e siglas dos livros no idioma atual (BOOKS[i][0] e CHAPTERS[].pt são os nomes exibidos)
  function applyBooks() {
    const names = (typeof BOOK_LANG !== "undefined" && BOOK_LANG[lang] ? BOOK_LANG[lang] : BOOK_LANG && BOOK_LANG.pt || {}).names;
    if (!names || typeof BOOKS === "undefined") return;
    BOOKS.forEach((b, i) => { b[0] = names[i]; });
    CHAPTERS.forEach(c => { c.pt = BOOKS[c.book][0]; });
  }
  // versões do idioma da interface primeiro (a ordem original é mantida dentro de cada grupo)
  function sortVersions() {
    if (typeof VERSIONS === "undefined") return;
    const rank = v => (v.lang === lang ? 0 : 1);
    const orig = VERSIONS.map((v, i) => [v, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]);
    VERSIONS.splice(0, VERSIONS.length, ...orig.map(x => x[0]));
  }
  const abbr = () => (BOOK_LANG[lang] || BOOK_LANG.pt).abbr;
  const ready = init();
  return {
    add, t, rich, apply, ready, applyBooks, abbr,
    get lang() { return lang; }, get locale() { return LOCALES[lang] || lang; }, languages: () => Object.keys(dicts),
    async set(l) { if (!dicts[l]) return; lang = l; await chrome.storage.local.set({ lang: l }); applyBooks(); sortVersions(); }
  };
})();
const t = I18N.t;
