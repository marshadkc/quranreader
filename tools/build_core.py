"""Build data/core.json: each root's core meaning, quoted from the classical dictionaries.

Input: JSON files fetched from tafsir.app (get_word.php?src=lisan|maqayees|mufradat-ragheb&w=ROOT), each
{root: {src: {"w": form looked up, "data": entry text}}}.
Keeps only each entry's opening statement: Lisan al-Arab opens with the root's first sense, Ibn Faris
states its core meaning(s), and al-Raghib opens with the word's basic sense in the Quran. Quotes stay
word for word, cut at a sentence end (or at a clause when the sentence is long).
gists.json holds the English/Urdu line for each root, translated from these quotes: {root: {"en", "ur"}}.
Usage: python3 tools/build_core.py gists.json raw1.json [raw2.json ...]
"""
import json, re, sys

def opening(text, limit):
    text = re.sub(r"^\s*\([^)]*\)\s*", "", text.split("\n")[0])  # Ibn Faris heads each entry with the root, e.g. (ظَلَمَ)
    text = re.sub(r"^[^\s:]{2,5}:\s*", "", text)                        # Lisan heads it with "ظلم:"
    text = re.split(r"\s*﴿", text)[0]                                # stop before the first Quran citation
    m = re.match(r"(.+?\.)(\s|$)", text)
    first = (m.group(1) if m else text).strip()
    if len(first) > limit:                                            # long sentences end at a clause
        cut = max(first.rfind("،", 0, limit), first.rfind("؛", 0, limit))
        first = (first[:cut] if cut > limit // 3 else first[:first.rfind(" ", 0, limit)]) + " …"
    return first if first.endswith("…") else first.rstrip(" .،")

gists = json.load(open(sys.argv[1]))
raw = {}
for f in sys.argv[2:]:
    for root, rec in json.load(open(f)).items(): raw.setdefault(root, {}).update(rec)
out = {}
for root, rec in sorted(raw.items()):
    c = {}
    for key, src, limit in [("l", "lisan", 200), ("m", "maqayees", 260), ("r", "mufradat-ragheb", 200)]:
        if src in rec and rec[src]["data"].strip():
            q = opening(rec[src]["data"], limit)
            if len(q) > 8: c[key], c[key + "w"] = q, rec[src]["w"]
    c.update({k: v for k, v in gists.get(root, {}).items() if k in ("en", "ur") and v})
    if c: out[root] = c
json.dump(out, open("data/core.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "roots;", *(f"{k}: {sum(k in c for c in out.values())}" for k in ["l", "m", "r", "en", "ur"]))
