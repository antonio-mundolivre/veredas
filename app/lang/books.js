// Nomes, siglas e apelidos dos livros por idioma (índices na ordem de BOOKS). 'extra' = apelidos aceitos ao digitar (chave = id do livro em BOOKS[i][3]).
const BOOK_LANG = {
 "pt": {
  "names": [
   "Gênesis",
   "Êxodo",
   "Levítico",
   "Números",
   "Deuteronômio",
   "Josué",
   "Juízes",
   "Rute",
   "1 Samuel",
   "2 Samuel",
   "1 Reis",
   "2 Reis",
   "1 Crônicas",
   "2 Crônicas",
   "Esdras",
   "Neemias",
   "Ester",
   "Jó",
   "Salmos",
   "Provérbios",
   "Eclesiastes",
   "Cantares",
   "Isaías",
   "Jeremias",
   "Lamentações",
   "Ezequiel",
   "Daniel",
   "Oséias",
   "Joel",
   "Amós",
   "Obadias",
   "Jonas",
   "Miquéias",
   "Naum",
   "Habacuque",
   "Sofonias",
   "Ageu",
   "Zacarias",
   "Malaquias",
   "Mateus",
   "Marcos",
   "Lucas",
   "João",
   "Atos",
   "Romanos",
   "1 Coríntios",
   "2 Coríntios",
   "Gálatas",
   "Efésios",
   "Filipenses",
   "Colossenses",
   "1 Tessalonicenses",
   "2 Tessalonicenses",
   "1 Timóteo",
   "2 Timóteo",
   "Tito",
   "Filemom",
   "Hebreus",
   "Tiago",
   "1 Pedro",
   "2 Pedro",
   "1 João",
   "2 João",
   "3 João",
   "Judas",
   "Apocalipse"
  ],
  "abbr": [
   "Gn",
   "Êx",
   "Lv",
   "Nm",
   "Dt",
   "Js",
   "Jz",
   "Rt",
   "1Sm",
   "2Sm",
   "1Rs",
   "2Rs",
   "1Cr",
   "2Cr",
   "Ed",
   "Ne",
   "Et",
   "Jó",
   "Sl",
   "Pv",
   "Ec",
   "Ct",
   "Is",
   "Jr",
   "Lm",
   "Ez",
   "Dn",
   "Os",
   "Jl",
   "Am",
   "Ob",
   "Jn",
   "Mq",
   "Na",
   "Hc",
   "Sf",
   "Ag",
   "Zc",
   "Ml",
   "Mt",
   "Mc",
   "Lc",
   "Jo",
   "At",
   "Rm",
   "1Co",
   "2Co",
   "Gl",
   "Ef",
   "Fp",
   "Cl",
   "1Ts",
   "2Ts",
   "1Tm",
   "2Tm",
   "Tt",
   "Fm",
   "Hb",
   "Tg",
   "1Pe",
   "2Pe",
   "1Jo",
   "2Jo",
   "3Jo",
   "Jd",
   "Ap"
  ],
  "extra": {
   "sl": [
    "sal",
    "salmo"
   ],
   "jó": [
    "job"
   ],
   "atos": [
    "at"
   ],
   "ap": [
    "apoc"
   ],
   "ct": [
    "cantares",
    "cantico"
   ]
  }
 },
 "en": {
  "names": [
   "Genesis",
   "Exodus",
   "Leviticus",
   "Numbers",
   "Deuteronomy",
   "Joshua",
   "Judges",
   "Ruth",
   "1 Samuel",
   "2 Samuel",
   "1 Kings",
   "2 Kings",
   "1 Chronicles",
   "2 Chronicles",
   "Ezra",
   "Nehemiah",
   "Esther",
   "Job",
   "Psalms",
   "Proverbs",
   "Ecclesiastes",
   "Song of Solomon",
   "Isaiah",
   "Jeremiah",
   "Lamentations",
   "Ezekiel",
   "Daniel",
   "Hosea",
   "Joel",
   "Amos",
   "Obadiah",
   "Jonah",
   "Micah",
   "Nahum",
   "Habakkuk",
   "Zephaniah",
   "Haggai",
   "Zechariah",
   "Malachi",
   "Matthew",
   "Mark",
   "Luke",
   "John",
   "Acts",
   "Romans",
   "1 Corinthians",
   "2 Corinthians",
   "Galatians",
   "Ephesians",
   "Philippians",
   "Colossians",
   "1 Thessalonians",
   "2 Thessalonians",
   "1 Timothy",
   "2 Timothy",
   "Titus",
   "Philemon",
   "Hebrews",
   "James",
   "1 Peter",
   "2 Peter",
   "1 John",
   "2 John",
   "3 John",
   "Jude",
   "Revelation"
  ],
  "abbr": [
   "Gen",
   "Exo",
   "Lev",
   "Num",
   "Deu",
   "Jos",
   "Jdg",
   "Rut",
   "1Sa",
   "2Sa",
   "1Ki",
   "2Ki",
   "1Ch",
   "2Ch",
   "Ezr",
   "Neh",
   "Est",
   "Job",
   "Psa",
   "Pro",
   "Ecc",
   "Sng",
   "Isa",
   "Jer",
   "Lam",
   "Eze",
   "Dan",
   "Hos",
   "Joe",
   "Amo",
   "Oba",
   "Jon",
   "Mic",
   "Nah",
   "Hab",
   "Zep",
   "Hag",
   "Zec",
   "Mal",
   "Mat",
   "Mar",
   "Luk",
   "Joh",
   "Act",
   "Rom",
   "1Co",
   "2Co",
   "Gal",
   "Eph",
   "Php",
   "Col",
   "1Th",
   "2Th",
   "1Ti",
   "2Ti",
   "Tit",
   "Phm",
   "Heb",
   "Jas",
   "1Pe",
   "2Pe",
   "1Jn",
   "2Jn",
   "3Jn",
   "Jud",
   "Rev"
  ],
  "extra": {
   "sl": [
    "ps",
    "psalm"
   ],
   "jo": [
    "jn",
    "jhn"
   ],
   "ct": [
    "song",
    "sos",
    "songofsongs"
   ],
   "ap": [
    "revelations",
    "rv"
   ],
   "mc": [
    "mk"
   ],
   "lc": [
    "lk"
   ],
   "fp": [
    "phil"
   ],
   "fm": [
    "philem"
   ],
   "1sm": [
    "1sam"
   ],
   "2sm": [
    "2sam"
   ],
   "1rs": [
    "1kgs",
    "1kg"
   ],
   "2rs": [
    "2kgs",
    "2kg"
   ],
   "1cr": [
    "1chr"
   ],
   "2cr": [
    "2chr"
   ],
   "pv": [
    "prov"
   ],
   "ec": [
    "eccl"
   ],
   "ez": [
    "ezek"
   ],
   "ob": [
    "obad"
   ],
   "hc": [
    "habak"
   ],
   "sf": [
    "zeph"
   ],
   "zc": [
    "zech"
   ],
   "1ts": [
    "1thess"
   ],
   "2ts": [
    "2thess"
   ],
   "1tm": [
    "1tim"
   ],
   "2tm": [
    "2tim"
   ],
   "1pe": [
    "1pet"
   ],
   "2pe": [
    "2pet"
   ],
   "1jo": [
    "1john"
   ],
   "2jo": [
    "2john"
   ],
   "3jo": [
    "3john"
   ],
   "tg": [
    "jam"
   ],
   "1co": [
    "1cor"
   ],
   "2co": [
    "2cor"
   ]
  }
 },
 "es": {
  "names": [
   "Génesis",
   "Éxodo",
   "Levítico",
   "Números",
   "Deuteronomio",
   "Josué",
   "Jueces",
   "Rut",
   "1 Samuel",
   "2 Samuel",
   "1 Reyes",
   "2 Reyes",
   "1 Crónicas",
   "2 Crónicas",
   "Esdras",
   "Nehemías",
   "Ester",
   "Job",
   "Salmos",
   "Proverbios",
   "Eclesiastés",
   "Cantares",
   "Isaías",
   "Jeremías",
   "Lamentaciones",
   "Ezequiel",
   "Daniel",
   "Oseas",
   "Joel",
   "Amós",
   "Abdías",
   "Jonás",
   "Miqueas",
   "Nahúm",
   "Habacuc",
   "Sofonías",
   "Hageo",
   "Zacarías",
   "Malaquías",
   "Mateo",
   "Marcos",
   "Lucas",
   "Juan",
   "Hechos",
   "Romanos",
   "1 Corintios",
   "2 Corintios",
   "Gálatas",
   "Efesios",
   "Filipenses",
   "Colosenses",
   "1 Tesalonicenses",
   "2 Tesalonicenses",
   "1 Timoteo",
   "2 Timoteo",
   "Tito",
   "Filemón",
   "Hebreos",
   "Santiago",
   "1 Pedro",
   "2 Pedro",
   "1 Juan",
   "2 Juan",
   "3 Juan",
   "Judas",
   "Apocalipsis"
  ],
  "abbr": [
   "Gn",
   "Éx",
   "Lv",
   "Nm",
   "Dt",
   "Jos",
   "Jue",
   "Rt",
   "1S",
   "2S",
   "1R",
   "2R",
   "1Cr",
   "2Cr",
   "Esd",
   "Neh",
   "Est",
   "Job",
   "Sal",
   "Pr",
   "Ec",
   "Cnt",
   "Is",
   "Jer",
   "Lm",
   "Ez",
   "Dn",
   "Os",
   "Jl",
   "Am",
   "Abd",
   "Jon",
   "Miq",
   "Nah",
   "Hab",
   "Sof",
   "Hag",
   "Zac",
   "Mal",
   "Mt",
   "Mr",
   "Lc",
   "Jn",
   "Hch",
   "Ro",
   "1Co",
   "2Co",
   "Gá",
   "Ef",
   "Fil",
   "Col",
   "1Ts",
   "2Ts",
   "1Ti",
   "2Ti",
   "Tit",
   "Flm",
   "Heb",
   "Stg",
   "1P",
   "2P",
   "1Jn",
   "2Jn",
   "3Jn",
   "Jud",
   "Ap"
  ],
  "extra": {
   "sl": [
    "salmo"
   ],
   "ct": [
    "cantar",
    "cantaresdesalomon"
   ],
   "ap": [
    "apoc"
   ],
   "1sm": [
    "1sam"
   ],
   "2sm": [
    "2sam"
   ],
   "1rs": [
    "1reyes"
   ],
   "2rs": [
    "2reyes"
   ]
  }
 },
 "fr": {
  "names": [
   "Genèse",
   "Exode",
   "Lévitique",
   "Nombres",
   "Deutéronome",
   "Josué",
   "Juges",
   "Ruth",
   "1 Samuel",
   "2 Samuel",
   "1 Rois",
   "2 Rois",
   "1 Chroniques",
   "2 Chroniques",
   "Esdras",
   "Néhémie",
   "Esther",
   "Job",
   "Psaumes",
   "Proverbes",
   "Ecclésiaste",
   "Cantique des cantiques",
   "Ésaïe",
   "Jérémie",
   "Lamentations",
   "Ézéchiel",
   "Daniel",
   "Osée",
   "Joël",
   "Amos",
   "Abdias",
   "Jonas",
   "Michée",
   "Nahum",
   "Habacuc",
   "Sophonie",
   "Aggée",
   "Zacharie",
   "Malachie",
   "Matthieu",
   "Marc",
   "Luc",
   "Jean",
   "Actes",
   "Romains",
   "1 Corinthiens",
   "2 Corinthiens",
   "Galates",
   "Éphésiens",
   "Philippiens",
   "Colossiens",
   "1 Thessaloniciens",
   "2 Thessaloniciens",
   "1 Timothée",
   "2 Timothée",
   "Tite",
   "Philémon",
   "Hébreux",
   "Jacques",
   "1 Pierre",
   "2 Pierre",
   "1 Jean",
   "2 Jean",
   "3 Jean",
   "Jude",
   "Apocalypse"
  ],
  "abbr": [
   "Gn",
   "Ex",
   "Lv",
   "Nb",
   "Dt",
   "Jos",
   "Jg",
   "Ru",
   "1S",
   "2S",
   "1R",
   "2R",
   "1Ch",
   "2Ch",
   "Esd",
   "Né",
   "Est",
   "Job",
   "Ps",
   "Pr",
   "Ec",
   "Ct",
   "Es",
   "Jr",
   "Lm",
   "Ez",
   "Dn",
   "Os",
   "Jl",
   "Am",
   "Ab",
   "Jon",
   "Mi",
   "Na",
   "Ha",
   "So",
   "Ag",
   "Za",
   "Ml",
   "Mt",
   "Mc",
   "Lc",
   "Jn",
   "Ac",
   "Rm",
   "1Co",
   "2Co",
   "Ga",
   "Ép",
   "Ph",
   "Col",
   "1Th",
   "2Th",
   "1Tm",
   "2Tm",
   "Tt",
   "Phm",
   "Hé",
   "Jc",
   "1P",
   "2P",
   "1Jn",
   "2Jn",
   "3Jn",
   "Jud",
   "Ap"
  ],
  "extra": {
   "sl": [
    "ps",
    "psaume"
   ],
   "jo": [
    "jn"
   ],
   "ct": [
    "cantique",
    "cantiquedescantiques",
    "ca"
   ],
   "ap": [
    "apoc"
   ],
   "mt": [
    "matt"
   ],
   "gn": [
    "gen",
    "genese"
   ],
   "ex": [
    "exo"
   ],
   "lv": [
    "lev"
   ],
   "nm": [
    "nom",
    "nb"
   ],
   "dt": [
    "deut"
   ],
   "jz": [
    "jug"
   ],
   "is": [
    "esaie",
    "isaie",
    "es"
   ],
   "ez": [
    "ezechiel",
    "ezek"
   ],
   "atos": [
    "act"
   ],
   "hb": [
    "heb"
   ],
   "tg": [
    "jac"
   ],
   "ed": [
    "esd"
   ],
   "ne": [
    "nehemie"
   ]
  }
 },
 "de": {
  "names": [
   "1. Mose",
   "2. Mose",
   "3. Mose",
   "4. Mose",
   "5. Mose",
   "Josua",
   "Richter",
   "Ruth",
   "1. Samuel",
   "2. Samuel",
   "1. Könige",
   "2. Könige",
   "1. Chronik",
   "2. Chronik",
   "Esra",
   "Nehemia",
   "Esther",
   "Hiob",
   "Psalmen",
   "Sprüche",
   "Prediger",
   "Hoheslied",
   "Jesaja",
   "Jeremia",
   "Klagelieder",
   "Hesekiel",
   "Daniel",
   "Hosea",
   "Joel",
   "Amos",
   "Obadja",
   "Jona",
   "Micha",
   "Nahum",
   "Habakuk",
   "Zefanja",
   "Haggai",
   "Sacharja",
   "Maleachi",
   "Matthäus",
   "Markus",
   "Lukas",
   "Johannes",
   "Apostelgeschichte",
   "Römer",
   "1. Korinther",
   "2. Korinther",
   "Galater",
   "Epheser",
   "Philipper",
   "Kolosser",
   "1. Thessalonicher",
   "2. Thessalonicher",
   "1. Timotheus",
   "2. Timotheus",
   "Titus",
   "Philemon",
   "Hebräer",
   "Jakobus",
   "1. Petrus",
   "2. Petrus",
   "1. Johannes",
   "2. Johannes",
   "3. Johannes",
   "Judas",
   "Offenbarung"
  ],
  "abbr": [
   "1Mo",
   "2Mo",
   "3Mo",
   "4Mo",
   "5Mo",
   "Jos",
   "Ri",
   "Rt",
   "1Sam",
   "2Sam",
   "1Kö",
   "2Kö",
   "1Chr",
   "2Chr",
   "Esr",
   "Neh",
   "Est",
   "Hi",
   "Ps",
   "Spr",
   "Pred",
   "Hld",
   "Jes",
   "Jer",
   "Klgl",
   "Hes",
   "Dan",
   "Hos",
   "Joel",
   "Am",
   "Ob",
   "Jon",
   "Mi",
   "Nah",
   "Hab",
   "Zef",
   "Hag",
   "Sach",
   "Mal",
   "Mt",
   "Mk",
   "Lk",
   "Joh",
   "Apg",
   "Röm",
   "1Kor",
   "2Kor",
   "Gal",
   "Eph",
   "Phil",
   "Kol",
   "1Thess",
   "2Thess",
   "1Tim",
   "2Tim",
   "Tit",
   "Phim",
   "Hebr",
   "Jak",
   "1Petr",
   "2Petr",
   "1Joh",
   "2Joh",
   "3Joh",
   "Jud",
   "Offb"
  ],
  "extra": {
   "gn": [
    "genesis",
    "1mose",
    "1mo"
   ],
   "ex": [
    "exodus",
    "2mose",
    "2mo"
   ],
   "lv": [
    "leviticus",
    "3mose",
    "3mo"
   ],
   "nm": [
    "numeri",
    "4mose",
    "4mo"
   ],
   "dt": [
    "deuteronomium",
    "5mose",
    "5mo"
   ],
   "sl": [
    "ps",
    "psalm"
   ],
   "jo": [
    "joh",
    "jn"
   ],
   "ap": [
    "offenbarung",
    "off",
    "apk"
   ],
   "ct": [
    "hohelied",
    "hl"
   ],
   "jó": [
    "job",
    "ijob"
   ],
   "atos": [
    "apg",
    "apostelgeschichte"
   ],
   "mt": [
    "matth"
   ],
   "is": [
    "jesaia"
   ],
   "ez": [
    "hesekiel",
    "ezechiel"
   ],
   "hb": [
    "hebr"
   ],
   "tg": [
    "jak",
    "jakobus"
   ],
   "rm": [
    "roemer",
    "röm",
    "rom"
   ],
   "pv": [
    "spr",
    "sprueche"
   ],
   "ec": [
    "pred",
    "prediger"
   ]
  }
 }
};
