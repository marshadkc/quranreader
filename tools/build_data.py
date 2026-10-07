#!/usr/bin/env python3
"""Build the app's JSON data from the morphology source and our own meanings.

Inputs
  sources/morphology-fatiha-juz30.txt  Quranic Arabic Corpus morphology (see sources/README.md)
  glosses/NNN.tsv                      word and verse meanings written for this app

Outputs
  data/surahs.json                     list of surahs with counts
  data/s/NNN.json                      one file per surah

Usage
  python3 tools/build_data.py            build everything
  python3 tools/build_data.py --list 112 print a surah's words, to help write its glosses
"""
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "sources" / "morphology-fatiha-juz30.txt"
GLOSSES = ROOT / "glosses"
OUT = ROOT / "data"

SURAHS = {
    1: ("الفاتحة", "Al-Fatihah", "The Opening"),
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
    return {
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
            for wd in ws:
                wd["f"] = lemma_count[wd["l"]]
            v = {"n": a, "w": ws}
            if a in gv:
                v["en"], v["ur"] = gv[a]
            ayahs.append(v)
        nwords = sum(len(v["w"]) for v in ayahs)
        ar, en, meaning = SURAHS[s]
        index.append({"n": s, "ar": ar, "en": en, "meaning": meaning, "ayahs": len(ayahs), "words": nwords, "ready": glossed == nwords})
        (OUT / "s" / f"{s:03d}.json").write_text(json.dumps({"n": s, "ar": ar, "en": en, "meaning": meaning, "ayahs": ayahs}, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    parts = {k: {"ar": None, "en": v[1], "ur": v[2]} for v in PREFIX.values() for k in [v[0]]}
    parts.update({"pron-" + k: {"ar": None, "en": v[0], "ur": v[1]} for k, v in SUFFIX.items()})
    (OUT / "surahs.json").write_text(json.dumps({"surahs": index, "parts": parts}, ensure_ascii=False, indent=1), encoding="utf8")
    ready = sum(x["ready"] for x in index)
    print(f"built {len(index)} surahs, {ready} with meanings")
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
