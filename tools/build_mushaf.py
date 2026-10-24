"""Build data/mushaf/PPP.json for the "Read in Mushaf" view: the Indo-Pak 16-line pages (Taj Company layout,
from tools/mushaf_layout.json, see fetch_mushaf_layout.py) with each word's Indo-Pak text and its tajweed marks.

Word text (text_indopak) and the tajweed rules (text_uthmani_tajweed) come from the Quran.com API. The tajweed
rules are marked on the Uthmani spelling, so each rule is carried over to the Indo-Pak spelling of the same word
by lining up the two spellings letter by letter. Downloads are cached in tools/cache/qcom/ (not committed).

Each page: {"p": 3, "l": [[kind, ...], ...]} with one entry per line:
  ["s", sura]                 sura header
  ["b"]                       bismillah
  ["t", center, [[loc, text, marks], ...]]   a line of words; loc = "s:a:w", end-of-ayah words carry the number
marks = [[start, end, rule], ...] as character offsets into text (rule codes in RULES below)."""
import difflib, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, "cache", "qcom")
API = "https://api.quran.com/api/v4/verses/by_chapter/{s}?words=true&word_fields=text_indopak,text_uthmani_tajweed&per_page=50&page={page}"

# Quran.com tajweed classes -> the app's rule codes (one colour each). Natural madd (2 counts) is left plain.
RULES = {
    "ghunnah": "gh", "ikhafa": "ik", "ikhafa_shafawi": "ik", "iqlab": "iq",
    "idgham_ghunnah": "id", "idgham_wo_ghunnah": "id", "idgham_shafawi": "id", "idgham_mutajanisayn": "id", "idgham_mutaqaribayn": "id",
    "qalaqah": "qa", "madda_necessary": "md", "madda_obligatory": "md", "madda_permissible": "md",
    "ham_wasl": "sl", "laam_shamsiyah": "sl", "slnt": "sl",
}

def get(url, path):
    if os.path.exists(path):
        return json.load(open(path, encoding="utf-8"))
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (quranreader mushaf import)"})
            d = json.loads(urllib.request.urlopen(req, timeout=60).read().decode("utf-8"))
            json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            time.sleep(0.2)
            return d
        except Exception as e:
            print("retry", url, e, file=sys.stderr); time.sleep(2 ** i)
    raise SystemExit("download failed: " + url)

def words_of(s):
    out, page = {}, 1
    while True:
        d = get(API.format(s=s, page=page), os.path.join(CACHE, f"{s:03d}-{page}.json"))
        for v in d["verses"]:
            for w in v["words"]:
                out[f'{v["verse_key"]}:{w["position"]}'] = w
        if not d["pagination"].get("next_page"): return out
        page += 1

# ---- carrying a rule from the Uthmani spelling to the Indo-Pak one ----
TAG = re.compile(r"<rule class=(\w+)>(.*?)</rule>")
MARK = re.compile(r"[ؐ-ًؚ-ٟۖ-ۭ࣓-ࣿ]")
FOLD = str.maketrans({"ٱ": "ا", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ی": "ي", "ک": "ك", "ڪ": "ك", "ہ": "ه", "ھ": "ه", "ۃ": "ة",
                      "ۦ": "ي", "ۥ": "و", "ٮ": "ي", "ـ": "", "ٰ": "ا"})

def units(text):
    """split a spelling into letters, each with the marks that follow it: [(start, end, folded letter)]"""
    out = []
    for i, c in enumerate(text):
        if c.isspace() or c == "‏": continue
        if (MARK.match(c) and c != "ٰ") and out:
            out[-1][1] = i + 1
        else:
            out.append([i, i + 1, c.translate(FOLD)])
    return [u for u in out if u[2]]

def uthmani_rules(tj):
    """the plain Uthmani text, and the rule of each of its characters"""
    plain, rule = "", []
    pos = 0
    for m in TAG.finditer(tj):
        plain += tj[pos:m.start()]; rule += [None] * (m.start() - pos)
        plain += m.group(2); rule += [m.group(1)] * len(m.group(2))
        pos = m.end()
    plain += tj[pos:]; rule += [None] * (len(tj) - pos)
    return plain, rule

def carry(tj, ip):
    """tajweed marks for the Indo-Pak word ip, from the tagged Uthmani word tj"""
    if not tj or "<rule" not in tj: return []
    plain, rule = uthmani_rules(tj)
    a, b = units(plain), units(ip)
    # each Uthmani letter's rule: the rule on the letter itself (a rule that only covers the vowel of the letter
    # before a long vowel belongs to the long vowel, not to that letter)
    ar = [RULES.get(rule[s]) for s, e, _ in a]
    sm = difflib.SequenceMatcher(None, [x[2] for x in a], [x[2] for x in b], autojunk=False)
    got = [None] * len(b)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): got[j1 + k] = ar[i1 + k]
        elif tag == "replace" and i2 - i1 == j2 - j1:
            for k in range(i2 - i1): got[j1 + k] = ar[i1 + k]
    # "sl" (silent) only where Indo-Pak still writes the letter; join neighbours with the same rule
    marks = []
    for (s, e, _), r in zip(b, got):
        if not r: continue
        if marks and marks[-1][2] == r and marks[-1][1] == s: marks[-1][1] = e
        else: marks.append([s, e, r])
    return marks

def main():
    os.makedirs(CACHE, exist_ok=True)
    layout = json.load(open(os.path.join(HERE, "mushaf_layout.json")))
    W = {}
    for s in range(1, 115):
        W.update(words_of(s))
        if s % 10 == 0: print("sura", s, file=sys.stderr)
    out = os.path.join(ROOT, "data", "mushaf"); os.makedirs(out, exist_ok=True)
    missing, index = 0, {}
    for p, lines in layout.items():
        page = []
        for ln in lines:
            if ln["kind"] == "surah": page.append(["s", ln["s"]]); continue
            if ln["kind"] == "bismillah": page.append(["b"]); continue
            row = []
            for loc in ln["w"]:
                w = W.get(loc)
                if not w: missing += 1; continue
                ip = w["text_indopak"].replace("‏", "").strip()
                row.append([loc, ip, carry(w.get("text_uthmani_tajweed"), ip)])
                s, a, _ = loc.split(":"); index.setdefault(f"{s}:{a}", int(p))
                # the ayah-end sign after the ayah's last word
                nxt = W.get(f"{s}:{a}:{int(loc.split(':')[2]) + 1}")
                if nxt and nxt["char_type_name"] == "end": row.append([f"{s}:{a}:e", nxt["text_indopak"].strip(), []])
            page.append(["t", 1 if ln["center"] else 0, row])
        json.dump({"p": int(p), "l": page}, open(os.path.join(out, f"{int(p):03d}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    # where each sura and ayah starts: the page to open
    first = {}
    for k, p in index.items():
        s, a = map(int, k.split(":"))
        first.setdefault(s, {})[a] = p
    json.dump({"pages": len(layout), "at": {s: [first[s][a] for a in sorted(first[s])] for s in sorted(first)}},
              open(os.path.join(out, "index.json"), "w"), separators=(",", ":"))
    print("pages", len(layout), "missing words", missing, file=sys.stderr)

if __name__ == "__main__":
    main()
