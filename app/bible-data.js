// [nome em português, nome em inglês, número de capítulos, slug no bibliaonline.com.br]
const BOOKS = [
  ["Gênesis","Genesis",50,"gn"],["Êxodo","Exodus",40,"ex"],["Levítico","Leviticus",27,"lv"],["Números","Numbers",36,"nm"],["Deuteronômio","Deuteronomy",34,"dt"],
  ["Josué","Joshua",24,"js"],["Juízes","Judges",21,"jz"],["Rute","Ruth",4,"rt"],["1 Samuel","1 Samuel",31,"1sm"],["2 Samuel","2 Samuel",24,"2sm"],
  ["1 Reis","1 Kings",22,"1rs"],["2 Reis","2 Kings",25,"2rs"],["1 Crônicas","1 Chronicles",29,"1cr"],["2 Crônicas","2 Chronicles",36,"2cr"],["Esdras","Ezra",10,"ed"],
  ["Neemias","Nehemiah",13,"ne"],["Ester","Esther",10,"et"],["Jó","Job",42,"jó"],["Salmos","Psalms",150,"sl"],["Provérbios","Proverbs",31,"pv"],
  ["Eclesiastes","Ecclesiastes",12,"ec"],["Cantares","Song of Solomon",8,"ct"],["Isaías","Isaiah",66,"is"],["Jeremias","Jeremiah",52,"jr"],["Lamentações","Lamentations",5,"lm"],
  ["Ezequiel","Ezekiel",48,"ez"],["Daniel","Daniel",12,"dn"],["Oséias","Hosea",14,"os"],["Joel","Joel",3,"jl"],["Amós","Amos",9,"am"],
  ["Obadias","Obadiah",1,"ob"],["Jonas","Jonah",4,"jn"],["Miquéias","Micah",7,"mq"],["Naum","Nahum",3,"na"],["Habacuque","Habakkuk",3,"hc"],
  ["Sofonias","Zephaniah",3,"sf"],["Ageu","Haggai",2,"ag"],["Zacarias","Zechariah",14,"zc"],["Malaquias","Malachi",4,"ml"],
  ["Mateus","Matthew",28,"mt"],["Marcos","Mark",16,"mc"],["Lucas","Luke",24,"lc"],["João","John",21,"jo"],["Atos","Acts",28,"atos"],
  ["Romanos","Romans",16,"rm"],["1 Coríntios","1 Corinthians",16,"1co"],["2 Coríntios","2 Corinthians",13,"2co"],["Gálatas","Galatians",6,"gl"],["Efésios","Ephesians",6,"ef"],
  ["Filipenses","Philippians",4,"fp"],["Colossenses","Colossians",4,"cl"],["1 Tessalonicenses","1 Thessalonians",5,"1ts"],["2 Tessalonicenses","2 Thessalonians",3,"2ts"],
  ["1 Timóteo","1 Timothy",6,"1tm"],["2 Timóteo","2 Timothy",4,"2tm"],["Tito","Titus",3,"tt"],["Filemom","Philemon",1,"fm"],["Hebreus","Hebrews",13,"hb"],
  ["Tiago","James",5,"tg"],["1 Pedro","1 Peter",5,"1pe"],["2 Pedro","2 Peter",3,"2pe"],["1 João","1 John",5,"1jo"],["2 João","2 John",1,"2jo"],
  ["3 João","3 John",1,"3jo"],["Judas","Jude",1,"jd"],["Apocalipse","Revelation",22,"ap"]
];

// Lista sequencial de todos os capítulos (1.189)
const CHAPTERS = [];
BOOKS.forEach(([pt, en, n, slug], b) => {
  for (let c = 1; c <= n; c++) CHAPTERS.push({ book: b, pt, en, slug, chapter: c });
});

const PSALMS_BOOK = 18; // índice de Salmos
const TOTAL_PSALMS = 150;
const PSALM_START = CHAPTERS.findIndex(c => c.book === PSALMS_BOOK); // índice global do Salmo 1

// Versões disponíveis.
//  bundled: true  → vem dentro da extensão (bibles/<id>.json), funciona sem internet desde a instalação
//  json           → id do arquivo no repositório público do GitHub (download opcional feito pelo próprio usuário)
//  third: true    → texto de terceiros: não é distribuído pelo Veredas; o direito de uso é de quem baixa
const VERSIONS = [
  { id: "blivre", short: "BLIVRE", label: "BLIVRE – Bíblia Livre (Almeida 1819, rev. 2018)", bundled: true, // @blivre
    credit: "Bíblia Livre (BLIVRE), Textus Receptus — Copyright © 2018 Diego Santos, Mario Sérgio e Marco Teles — sites.google.com/site/biblialivre — fevereiro de 2018 — Licença Creative Commons Atribuição 4.0 (creativecommons.org/licenses/by/4.0/br/)" }, // @blivre
  { id: "bkj",  short: "BKJ",  label: "BKJ – Bíblia King James Fiel",              json: "kja", third: true },
  { id: "acf",  short: "ACF",  label: "ACF – Almeida Corrigida Fiel",              json: "acf", third: true },
  { id: "arc",  short: "ARC",  label: "ARC – Almeida Revista e Corrigida",         json: "arc", third: true },
  { id: "aa",   short: "AA",   label: "AA – Almeida Revisada Imprensa Bíblica",    json: "aa",  third: true },
  { id: "nvi",  short: "NVI",  label: "NVI – Nova Versão Internacional",           json: "nvi", third: true }
];

// id do arquivo/cópia local de cada versão (versões sem download direto usam o próprio id)
const packOf = ver => ver.json || ver.id;
// ids de pacotes colocados na pasta bibles/ da extensão (bibles/<id>.json). Vazio por padrão.
const BUNDLED = VERSIONS.filter(v => v.bundled).map(packOf);
