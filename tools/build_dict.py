"""Build data/dict/ROOT.json: each Quran root's full entry in the classical dictionaries, for the
dictionary list on the word card.

Inputs: raw JSON files fetched from tafsir.app (get_word.php?src=SOURCE&w=ROOT), each
{root: {source: {"w": form looked up, "data": entry text}}}. tafsir.app answers with the nearest entry
when a root has none, so an entry is kept only if its opening words contain the root's letters.
Output per root: {"w": lookup form, key: entry text, ..., "x": {other root: {key: text}}}, where "x"
holds the entry under a sister spelling the dictionaries point to (صرط is explained under سرط).
Usage: python3 tools/build_dict.py raw1.json [raw2.json ...]
"""
import json, os, re, sys

KEYS = {"maqayees": "m", "mufradat-ragheb": "r", "lisan": "l", "alsihah": "s", "qamoos": "q", "basair-tamyeez": "b", "umdah-alhufadh": "u"}
HARAKAT = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")
FOLD = str.maketrans("أإآٱؤئى", "ااااويي")


def clean(t):
    t = re.sub(r"\[\[.*?\]\]", "", t, flags=re.S)  # editors' footnotes
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def letters(t):
    return HARAKAT.sub("", t).translate(FOLD)


def heads(root, text):
    """Do the entry's opening words hold the root? (its strong letters, in order, within one word)"""
    strong = [c for c in letters(root) if c not in "اويء"] or list(letters(root))
    strong = [c for i, c in enumerate(strong) if i == 0 or c != strong[i - 1]]  # a doubled letter is often written once (الأبّ)
    pat = re.compile(".*".join(map(re.escape, strong)))
    return any(pat.search(w) for w in re.findall(r"[ء-ي]+", letters(text[:300])))


raw = {}
for f in sys.argv[1:]:
    for root, rec in json.load(open(f)).items():
        for src, e in rec.items():
            raw.setdefault(root, {})[src] = e
os.makedirs("data/dict", exist_ok=True)
n = kept = 0
for root in raw:
    out, form = {}, None
    for src, e in raw[root].items():
        if src.startswith("x:"):
            continue
        k, t = KEYS.get(src), clean(e.get("data") or "")
        if k and t and heads(root if src != "umdah-alhufadh" else e["w"], t):
            out[k] = t
            form = form or e["w"]
    x = {}
    for src, e in raw[root].items():  # "x:ROOT:source" entries fetched for a sister spelling
        if src.startswith("x:"):
            _, other, s = src.split(":")
            t = clean(e.get("data") or "")
            if t and KEYS.get(s) and heads(other, t):
                x.setdefault(other, {})[KEYS[s]] = t
    if x:
        out["x"] = x
    if out:
        out["w"] = form or root
        json.dump(out, open(f"data/dict/{root}.json", "w"), ensure_ascii=False, separators=(",", ":"))
        n += 1
        kept += sum(k in out for k in KEYS.values())
print(n, "roots,", kept, "entries")
