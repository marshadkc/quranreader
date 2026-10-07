#!/usr/bin/env python3
"""Build the app's JSON data from the morphology source and our own meanings.

Inputs
  sources/morphology.txt               Quranic Arabic Corpus morphology (see sources/README.md)
  glosses/NNN.tsv                      word and verse meanings written for this app

Outputs
  data/surahs.json                     list of surahs with counts
  data/s/NNN.json                      one file per surah
  data/index/roots.json                every root (or base word) with its forms, counts and places
  data/index/forms.json                normalised spellings -> roots, for the word search

Usage
  python3 tools/build_data.py            build everything
  python3 tools/build_data.py --list 112 print a surah's words, to help write its glosses
"""
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "sources" / "morphology.txt"
GLOSSES = ROOT / "glosses"
OUT = ROOT / "data"

SURAHS = {
    1: ("الفاتحة", "Al-Fatihah", "The Opening"),
    2: ("البقرة", "Al-Baqarah", "The Cow"),
    3: ("آل عمران", "Al-Imran", "The Family of Imran"),
    4: ("النساء", "An-Nisa", "The Women"),
    5: ("المائدة", "Al-Ma'idah", "The Table Spread"),
    6: ("الأنعام", "Al-An'am", "The Cattle"),
    7: ("الأعراف", "Al-A'raf", "The Heights"),
    8: ("الأنفال", "Al-Anfal", "The Spoils of War"),
    9: ("التوبة", "At-Tawbah", "The Repentance"),
    10: ("يونس", "Yunus", "Jonah"),
    11: ("هود", "Hud", "Hud"),
    12: ("يوسف", "Yusuf", "Joseph"),
    13: ("الرعد", "Ar-Ra'd", "The Thunder"),
    14: ("إبراهيم", "Ibrahim", "Abraham"),
    15: ("الحجر", "Al-Hijr", "The Rocky Tract"),
    16: ("النحل", "An-Nahl", "The Bee"),
    17: ("الإسراء", "Al-Isra", "The Night Journey"),
    18: ("الكهف", "Al-Kahf", "The Cave"),
    19: ("مريم", "Maryam", "Mary"),
    20: ("طه", "Ta-Ha", "Ta-Ha"),
    21: ("الأنبياء", "Al-Anbiya", "The Prophets"),
    22: ("الحج", "Al-Hajj", "The Pilgrimage"),
    23: ("المؤمنون", "Al-Mu'minun", "The Believers"),
    24: ("النور", "An-Nur", "The Light"),
    25: ("الفرقان", "Al-Furqan", "The Criterion"),
    26: ("الشعراء", "Ash-Shu'ara", "The Poets"),
    27: ("النمل", "An-Naml", "The Ant"),
    28: ("القصص", "Al-Qasas", "The Stories"),
    29: ("العنكبوت", "Al-Ankabut", "The Spider"),
    30: ("الروم", "Ar-Rum", "The Romans"),
    31: ("لقمان", "Luqman", "Luqman"),
    32: ("السجدة", "As-Sajdah", "The Prostration"),
    33: ("الأحزاب", "Al-Ahzab", "The Combined Forces"),
    34: ("سبأ", "Saba", "Sheba"),
    35: ("فاطر", "Fatir", "The Originator"),
    36: ("يس", "Ya-Sin", "Ya-Sin"),
    37: ("الصافات", "As-Saffat", "Those Ranged in Rows"),
    38: ("ص", "Sad", "Sad"),
    39: ("الزمر", "Az-Zumar", "The Groups"),
    40: ("غافر", "Ghafir", "The Forgiver"),
    41: ("فصلت", "Fussilat", "Explained in Detail"),
    42: ("الشورى", "Ash-Shura", "The Consultation"),
    43: ("الزخرف", "Az-Zukhruf", "The Ornaments of Gold"),
    44: ("الدخان", "Ad-Dukhan", "The Smoke"),
    45: ("الجاثية", "Al-Jathiyah", "The Kneeling"),
    46: ("الأحقاف", "Al-Ahqaf", "The Wind-Curved Sandhills"),
    47: ("محمد", "Muhammad", "Muhammad"),
    48: ("الفتح", "Al-Fath", "The Victory"),
    49: ("الحجرات", "Al-Hujurat", "The Rooms"),
    50: ("ق", "Qaf", "Qaf"),
    51: ("الذاريات", "Adh-Dhariyat", "The Winnowing Winds"),
    52: ("الطور", "At-Tur", "The Mount"),
    53: ("النجم", "An-Najm", "The Star"),
    54: ("القمر", "Al-Qamar", "The Moon"),
    55: ("الرحمن", "Ar-Rahman", "The Most Merciful"),
    56: ("الواقعة", "Al-Waqi'ah", "The Inevitable Event"),
    57: ("الحديد", "Al-Hadid", "The Iron"),
    58: ("المجادلة", "Al-Mujadila", "The Pleading Woman"),
    59: ("الحشر", "Al-Hashr", "The Exile"),
    60: ("الممتحنة", "Al-Mumtahanah", "The Woman to be Examined"),
    61: ("الصف", "As-Saff", "The Ranks"),
    62: ("الجمعة", "Al-Jumu'ah", "Friday"),
    63: ("المنافقون", "Al-Munafiqun", "The Hypocrites"),
    64: ("التغابن", "At-Taghabun", "The Mutual Loss and Gain"),
    65: ("الطلاق", "At-Talaq", "The Divorce"),
    66: ("التحريم", "At-Tahrim", "The Prohibition"),
    67: ("الملك", "Al-Mulk", "The Sovereignty"),
    68: ("القلم", "Al-Qalam", "The Pen"),
    69: ("الحاقة", "Al-Haqqah", "The Inevitable Reality"),
    70: ("المعارج", "Al-Ma'arij", "The Ascending Stairways"),
    71: ("نوح", "Nuh", "Noah"),
    72: ("الجن", "Al-Jinn", "The Jinn"),
    73: ("المزمل", "Al-Muzzammil", "The Enwrapped One"),
    74: ("المدثر", "Al-Muddaththir", "The Cloaked One"),
    75: ("القيامة", "Al-Qiyamah", "The Resurrection"),
    76: ("الإنسان", "Al-Insan", "Man"),
    77: ("المرسلات", "Al-Mursalat", "Those Sent Forth"),
    78: ("النبأ", "An-Naba", "The Great News"),
    79: ("النازعات", "An-Nazi'at", "Those Who Pull Out"),
    80: ("عبس", "Abasa", "He Frowned"),
    81: ("التكوير", "At-Takwir", "The Folding Up"),
    82: ("الانفطار", "Al-Infitar", "The Splitting Open"),
    83: ("المطففين", "Al-Mutaffifin", "Those Who Give Short Measure"),
    84: ("الانشقاق", "Al-Inshiqaq", "The Splitting Asunder"),
    85: ("البروج", "Al-Buruj", "The Great Stars"),
    86: ("الطارق", "At-Tariq", "The Night Comer"),
    87: ("الأعلى", "Al-A'la", "The Most High"),
    88: ("الغاشية", "Al-Ghashiyah", "The Overwhelming Event"),
    89: ("الفجر", "Al-Fajr", "The Dawn"),
    90: ("البلد", "Al-Balad", "The City"),
    91: ("الشمس", "Ash-Shams", "The Sun"),
    92: ("الليل", "Al-Layl", "The Night"),
    93: ("الضحى", "Ad-Duha", "The Morning Light"),
    94: ("الشرح", "Ash-Sharh", "The Opening Up"),
    95: ("التين", "At-Tin", "The Fig"),
    96: ("العلق", "Al-Alaq", "The Clinging Clot"),
    97: ("القدر", "Al-Qadr", "The Night of Decree"),
    98: ("البينة", "Al-Bayyinah", "The Clear Proof"),
    99: ("الزلزلة", "Az-Zalzalah", "The Earthquake"),
    100: ("العاديات", "Al-Adiyat", "The Chargers"),
    101: ("القارعة", "Al-Qari'ah", "The Striking Calamity"),
    102: ("التكاثر", "At-Takathur", "Competition in Increase"),
    103: ("العصر", "Al-Asr", "Time"),
    104: ("الهمزة", "Al-Humazah", "The Slanderer"),
    105: ("الفيل", "Al-Fil", "The Elephant"),
    106: ("قريش", "Quraysh", "Quraysh"),
    107: ("الماعون", "Al-Ma'un", "Small Kindnesses"),
    108: ("الكوثر", "Al-Kawthar", "Abundance"),
    109: ("الكافرون", "Al-Kafirun", "The Disbelievers"),
    110: ("النصر", "An-Nasr", "The Help"),
    111: ("المسد", "Al-Masad", "The Palm Fibre"),
    112: ("الإخلاص", "Al-Ikhlas", "Sincerity"),
    113: ("الفلق", "Al-Falaq", "The Daybreak"),
    114: ("الناس", "An-Nas", "Mankind"),
}

# Front attachments: (tag, lemma) -> (key, English, Urdu)
PREFIX = {
    ("CONJ", "و"): ("wa", "and", "اور"),
    ("REM", "و"): ("wa", "and", "اور"),
    ("CIRC", "و"): ("wa", "and, while", "اور"),
    ("P", "و"): ("wa-oath", "by (an oath)", "قسم ہے"),
    ("CONJ", "ف"): ("fa", "so, then", "پھر، تو"),
    ("REM", "ف"): ("fa", "so, then", "پھر، تو"),
    ("RSLT", "ف"): ("fa", "so, then", "پھر، تو"),
    ("CAUS", "ف"): ("fa", "so, then", "پھر، تو"),
    ("SUP", "ف"): ("fa", "so, then", "پھر، تو"),
    ("P", "ب"): ("bi", "with, in, by", "سے، میں"),
    ("P", "ل"): ("li", "for, to", "کے لیے"),
    ("PRP", "ل"): ("li-purpose", "so that", "تاکہ"),
    ("EMPH", "ل"): ("la", "surely", "یقیناً"),
    ("IMPV", "ل"): ("li-command", "let", "چاہیے کہ"),
    ("P", "ك"): ("ka", "like", "کی طرح"),
    ("DET", "ال"): ("al", "the", "—"),
    ("INTG", "أ"): ("a-question", "(question)", "کیا"),
    ("FUT", "س"): ("sa", "will", "عنقریب"),
    ("VOC", "ي"): ("ya", "O", "اے"),
}
# End attachments (pronoun endings): person code -> (English, Urdu)
SUFFIX = {
    "3MS": ("he, him, his", "وہ، اس"),
    "3FS": ("she, it, her", "وہ، اس"),
    "3MP": ("they, them, their", "وہ، ان"),
    "3FP": ("they, them (f.)", "وہ، ان"),
    "3D": ("the two of them", "وہ دونوں"),
    "2MS": ("you", "تو، تیرا"),
    "2FS": ("you (f.)", "تو، تیرا"),
    "2MP": ("you all", "تم، تمہارا"),
    "1S": ("I, me, my", "میں، میرا"),
    "1P": ("we, us, our", "ہم، ہمارا"),
}


COURSE = {1} | set(range(78, 115))  # Al-Fatihah and Juz Amma: the learning course

# Search spelling: drop vowel marks and Quranic signs, and fold letter variants together
_MARKS = re.compile("[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
_FOLD = str.maketrans({"ٱ": "ا", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ۥ": "", "ۦ": ""})


def norm(t):
    return _MARKS.sub("", t).translate(_FOLD).replace(" ", "")


def feats(s):
    out = {"tags": []}
    for f in s.split("|"):
        if ":" in f:
            k, v = f.split(":", 1)
            out[k] = v
        else:
            out["tags"].append(f)
    return out


def load_words():
    words = collections.OrderedDict()
    for line in SOURCE.read_text(encoding="utf8").splitlines():
        loc, form, pos, feat = line.split("\t")
        s, a, w, _ = map(int, loc.split(":"))
        words.setdefault((s, a, w), []).append((form, pos, feats(feat)))
    return words


def word_entry(segs):
    stem_i = next((i for i, (_, _, f) in enumerate(segs) if "PREF" not in f["tags"]), 0)
    stem = segs[stem_i]
    parts = []
    for i, (form, pos, f) in enumerate(segs):
        kind = "s"
        gloss = None
        if "PREF" in f["tags"]:
            g = PREFIX.get((f["tags"][0], f.get("LEM", "")))
            if g:
                kind, gloss = "p", g
        elif i > stem_i and "SUFF" in f["tags"] and f["tags"][0] == "PRON":
            code = next((t for t in f["tags"] if t[:1] in "123"), "")
            if code in SUFFIX:
                kind, gloss = "e", ("pron-" + code,) + SUFFIX[code]
        part = [form, kind]
        if gloss:
            part.append(gloss[0])
        parts.append(part)
    # merge neighbouring plain segments so the stem reads as one piece
    merged = []
    for p in parts:
        if merged and p[1] == "s" and merged[-1][1] == "s":
            merged[-1][0] += p[0]
        else:
            merged.append(p)
    lem = stem[2].get("LEM") or "".join(x[0] for x in segs)
    stem_text = "".join(p[0] for p in merged if p[1] == "s")
    return {
        "_stem": stem_text,
        "t": "".join(x[0] for x in segs),
        "p": merged,
        "l": lem,
        "r": stem[2].get("ROOT", ""),
        "pos": stem[1] if stem[1] != "N" else ("PN" if "PN" in stem[2]["tags"] else "N"),
    }


def load_glosses(s):
    path = GLOSSES / f"{s:03d}.tsv"
    words, verses = {}, {}
    if not path.exists():
        return words, verses
    for n, line in enumerate(path.read_text(encoding="utf8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        cols = line.split("\t")
        if len(cols) != 3:
            sys.exit(f"{path.name}:{n}: expected 3 tab-separated columns, got {len(cols)}")
        key, en, ur = cols
        if key.startswith("v"):
            verses[int(key[1:])] = (en.strip(), ur.strip())
        else:
            ens = [x.strip() for x in en.split(";")]
            urs = [x.strip() for x in ur.split(";")]
            words[int(key)] = (ens, urs, n)
    return words, verses


def build():
    words = load_words()
    by_surah = collections.defaultdict(lambda: collections.defaultdict(list))
    for (s, a, w), segs in words.items():
        by_surah[s][a].append(word_entry(segs))
    index, problems = [], []
    roots = {}
    forms = collections.defaultdict(collections.Counter)
    lemma_count = collections.Counter(wd["l"] for s in by_surah.values() for a in s.values() for wd in a)
    (OUT / "s").mkdir(parents=True, exist_ok=True)
    for s in sorted(by_surah):
        gw, gv = load_glosses(s)
        ayahs = []
        glossed = 0
        for a in sorted(by_surah[s]):
            ws = by_surah[s][a]
            if a in gw:
                ens, urs, line = gw[a]
                if len(ens) != len(ws) or len(urs) != len(ws):
                    problems.append(f"{s:03d}.tsv line {line}: ayah {a} has {len(ws)} words, got {len(ens)} English and {len(urs)} Urdu")
                else:
                    for wd, en, ur in zip(ws, ens, urs):
                        wd["en"], wd["ur"] = en, ur
                    glossed += len(ws)
            for wi, wd in enumerate(ws, 1):
                wd["f"] = lemma_count[wd["l"]]
                key = wd["r"] or "=" + wd["l"]          # root, or the base word for words without a root
                # root -> base word -> spelling -> places (s*1000000 + ayah*1000 + word number)
                roots.setdefault(key, {}).setdefault(wd["l"], {}).setdefault(wd["t"], []).append(s * 1000000 + a * 1000 + wi)
                for spelling in {norm(wd["t"]), norm(wd.pop("_stem")), norm(wd["l"]), norm(wd["r"])}:
                    if spelling:
                        forms[spelling][key] += 1
            v = {"n": a, "w": ws}
            if a in gv:
                v["en"], v["ur"] = gv[a]
            ayahs.append(v)
        nwords = sum(len(v["w"]) for v in ayahs)
        ar, en, meaning = SURAHS[s]
        index.append({"n": s, "ar": ar, "en": en, "meaning": meaning, "ayahs": len(ayahs), "words": nwords, "ready": glossed == nwords, "course": s in COURSE})
        (OUT / "s" / f"{s:03d}.json").write_text(json.dumps({"n": s, "ar": ar, "en": en, "meaning": meaning, "ayahs": ayahs}, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    parts = {k: {"ar": None, "en": v[1], "ur": v[2]} for v in PREFIX.values() for k in [v[0]]}
    parts.update({"pron-" + k: {"ar": None, "en": v[0], "ur": v[1]} for k, v in SUFFIX.items()})
    (OUT / "index").mkdir(exist_ok=True)
    # each root: [[base word, [[spelling, [places...]], ...]], ...], most frequent first
    size = lambda x: sum(len(o) for o in x.values())
    roots_out = {k: [[lem, sorted(fs.items(), key=lambda f: -len(f[1]))] for lem, fs in sorted(v.items(), key=lambda x: -size(x[1]))]
                 for k, v in roots.items()}
    (OUT / "index" / "roots.json").write_text(json.dumps(roots_out, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    (OUT / "index" / "forms.json").write_text(json.dumps({k: dict(v.most_common()) for k, v in sorted(forms.items())}, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    (OUT / "surahs.json").write_text(json.dumps({"surahs": index, "parts": parts}, ensure_ascii=False, indent=1), encoding="utf8")
    ready = sum(x["ready"] for x in index)
    print(f"built {len(index)} surahs, {ready} with meanings; {len(roots)} roots and base words, {len(forms)} search spellings")
    if problems:
        print("\n".join(problems))
        sys.exit(1)


def listing(s):
    words = load_words()
    cur = None
    for (ss, a, w), segs in words.items():
        if ss != s:
            continue
        if a != cur:
            print(f"\n{a}:", end="")
            cur = a
        print(" " + "".join(x[0] for x in segs), end="")
    print()


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--list":
        listing(int(sys.argv[2]))
    else:
        build()
