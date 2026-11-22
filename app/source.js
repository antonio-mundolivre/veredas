// Textos da Bíblia: guardados no aparelho para uso sem internet.
// Ordem de busca: 1) cópia local (baixada ou importada)  2) pacote embutido na extensão (bibles/<id>.json)
//                 3) download do GitHub, pedido pelo usuário (só se a internet estiver liberada).
const GITHUB_BASE = "https://raw.githubusercontent.com/MaatheusGois/bible/main/versions/pt-br/";
const _mem = {};
const packKey = pack => "bible_" + pack;

const cleanVerse = s => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const toList = x => Array.isArray(x) ? x
  : (x && typeof x === "object" ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]) : []);

function normChapter(c) {
  const vs = Array.isArray(c) ? c : (c && (c.verses ?? c.versiculos ?? c.vs)) ?? c;
  return toList(vs).map(v => typeof v === "string" ? cleanVerse(v) : cleanVerse(v && (v.text ?? v.texto ?? "")));
}
function normBook(b) {
  const ch = Array.isArray(b) ? b : (b && (b.chapters ?? b.capitulos)) ?? b;
  return toList(ch).map(normChapter);
}
// Aceita vários formatos comuns: [{chapters:[[...]]}], {books:[...]}, {livro:{cap:{verso:texto}}}...
// Os livros são identificados pela posição (ordem canônica de 66 livros).
function normalizeBible(j) {
  const books = Array.isArray(j) ? j : toList(j && j.books ? j.books : j);
  if (books.length < 66) throw new Error(`Formato não reconhecido (${books.length} livros encontrados).`);
  const norm = books.slice(0, 66).map(normBook);
  const bad = norm.findIndex((b, i) => b.length !== BOOKS[i][2]);
  if (bad >= 0) throw new Error(`Estrutura inesperada: ${BOOKS[bad][0]} tem ${norm[bad].length} capítulos (esperado ${BOOKS[bad][2]}).`);
  return norm;
}
// Pacote padrão do ecossistema (veja PACOTE-DE-TEXTO.md) ou qualquer formato aceito acima
function normalizePackage(j) {
  if (j && j.format === "biblia-pacote") {
    if (!Array.isArray(j.books) || j.books.length !== 66) throw new Error("Pacote inválido: esperado 66 livros.");
    const norm = j.books.map(b => (b.chapters || []).map(ch => ch.map(cleanVerse)));
    const bad = norm.findIndex((b, i) => b.length !== BOOKS[i][2]);
    if (bad >= 0) throw new Error(`Pacote inválido: ${BOOKS[bad][0]} tem ${norm[bad].length} capítulos (esperado ${BOOKS[bad][2]}).`);
    return norm;
  }
  return normalizeBible(j);
}

// ---------- armazenamento local ----------
function statsOf(norm) {
  let verses = 0, chapters = 0;
  norm.forEach(b => b.forEach(c => { chapters++; verses += c.length; }));
  return { verses, chapters, bytes: JSON.stringify(norm).length };
}
async function getAllMeta() {
  return (await chrome.storage.local.get("bibleMeta")).bibleMeta || {};
}
async function writeMeta(pack, norm, from) {
  const meta = await getAllMeta();
  meta[pack] = { ...statsOf(norm), at: Date.now(), from };
  await chrome.storage.local.set({ bibleMeta: meta });
  return meta[pack];
}
async function saveLocal(pack, norm, from) {
  await chrome.storage.local.set({ [packKey(pack)]: norm });
  _mem[pack] = norm;
  return writeMeta(pack, norm, from);
}
async function removeLocal(pack) {
  await chrome.storage.local.remove(packKey(pack));
  const meta = await getAllMeta();
  delete meta[pack];
  await chrome.storage.local.set({ bibleMeta: meta });
  delete _mem[pack];
}
// Situação da versão neste aparelho: null (não baixada) ou {verses, chapters, bytes, at, from}
async function localStatus(ver) {
  const pack = packOf(ver);
  const meta = (await getAllMeta())[pack];
  if (meta) return meta;
  if (!(await chrome.storage.local.getBytesInUse(packKey(pack)))) return null; // sem cópia
  const norm = (await chrome.storage.local.get(packKey(pack)))[packKey(pack)];     // cópia de versões antigas da extensão
  return norm ? writeMeta(pack, norm, "cache") : null;
}
async function isOfflineOnly() {
  const { offlineOnly } = await chrome.storage.local.get("offlineOnly");
  return !!offlineOnly || (typeof navigator !== "undefined" && navigator.onLine === false);
}

// ---------- baixar / importar / exportar ----------
async function downloadPack(ver, onProgress) {
  if (!ver.json) throw new Error("Esta versão não tem download direto. Use “Importar…” com um arquivo de pacote.");
  const res = await fetch(GITHUB_BASE + ver.json + ".json", { credentials: "omit" });
  if (!res.ok) throw new Error("O servidor respondeu HTTP " + res.status);
  const total = +res.headers.get("content-length") || 0;
  let json;
  if (res.body && onProgress) {
    const reader = res.body.getReader(), chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      onProgress(got, total);
    }
    const buf = new Uint8Array(got);
    let o = 0;
    chunks.forEach(c => { buf.set(c, o); o += c.length; });
    json = JSON.parse(new TextDecoder("utf-8").decode(buf));
  } else {
    json = await res.json();
  }
  return saveLocal(packOf(ver), normalizeBible(json), "github");
}

async function addCustomVersion(v) {
  const { customVersions } = await chrome.storage.local.get("customVersions");
  const list = (customVersions || []).filter(x => x.id !== v.id);
  list.push(v);
  await chrome.storage.local.set({ customVersions: list });
  await loadCustomVersions();
  return VERSIONS.find(x => x.id === v.id);
}

// Importa um arquivo de pacote. Com "target", grava naquela versão; sem, cria/atualiza uma versão pelo id do arquivo.
async function importPackageText(text, target) {
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error("O arquivo não é um JSON válido."); }
  const norm = normalizePackage(j);
  let ver = target;
  if (!ver) {
    const id = String(j.id || j.short || "importada").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "importada";
    ver = VERSIONS.find(v => packOf(v) === id) ||
      await addCustomVersion({ id, short: String(j.short || id).toUpperCase().slice(0, 8), label: String(j.name || id) });
  }
  return { ver, meta: await saveLocal(packOf(ver), norm, "importada") };
}

async function buildPackage(ver) {
  const t = await getTranslation(ver, true);
  if (!t) throw new Error("A versão ainda não está baixada neste aparelho.");
  return {
    format: "biblia-pacote", version: 1, id: packOf(ver), name: ver.label, language: "pt-BR", license: "",
    books: BOOKS.map((b, i) => ({ id: b[3], name: b[0], chapters: t.norm[i] }))
  };
}

// ---------- leitura ----------
async function getTranslation(ver, offlineOnly) {
  const pack = packOf(ver);
  if (_mem[pack]) return { norm: _mem[pack], from: "offline" };
  const stored = (await chrome.storage.local.get(packKey(pack)))[packKey(pack)];
  if (stored) { _mem[pack] = stored; return { norm: stored, from: "offline" }; }
  if (BUNDLED.includes(pack)) {
    const r = await fetch(chrome.runtime.getURL("bibles/" + pack + ".json"));
    if (r.ok) { const norm = normalizePackage(await r.json()); _mem[pack] = norm; return { norm, from: "pacote" }; }
  }
  if (offlineOnly || !ver.json) return null;
  await downloadPack(ver);
  return { norm: _mem[pack], from: "GitHub" };
}

async function fetchVerses(c, ver) {
  const offline = await isOfflineOnly();
  const errors = [];
  try {
    const t = await getTranslation(ver, offline);
    if (t) {
      const arr = t.norm[c.book][c.chapter - 1];
      if (arr && arr.some(Boolean)) {
        return {
          source: t.from === "GitHub" ? "baixada agora" : t.from === "pacote" ? "pacote embutido" : "offline ✓",
          verses: arr.map((text, k) => ({ n: k + 1, text, heading: null, brk: false }))
        };
      }
      errors.push("capítulo vazio");
    }
  } catch (e) { errors.push(e.message); }

  const err = new Error(offline
    ? `A versão ${ver.short} não está baixada neste aparelho. Abra Configurações › Textos offline e baixe ou importe esta versão.`
    : "Não consegui carregar este capítulo. " + errors.join(" · "));
  err.debug = errors.join("\n");
  throw err;
}
