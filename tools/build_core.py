"""Build data/core.json: each root's core meaning, quoted from the classical dictionaries.

Inputs:
- raw JSON files fetched from tafsir.app (get_word.php?src=lisan|maqayees|mufradat-ragheb&w=ROOT),
  each {root: {src: {"w": form looked up, "data": entry text}}}.
- picks.json: for each root, the clearest phrase(s) chosen from those entries and their English and
  Urdu translation: [{"root", "q": [{"s": "l"|"m"|"r", "t": exact phrase}], "en", "ur"}].
Every quoted phrase must appear word for word in its dictionary entry; any that doesn't is dropped and listed.
Usage: python3 tools/build_core.py picks.json raw1.json [raw2.json ...]
"""
import json, re, sys

SRC = {"l": "lisan", "m": "maqayees", "r": "mufradat-ragheb"}
clean = lambda t: re.sub(r"\s+", " ", re.sub(r"\[\[.*?\]\]", "", t)).strip()
raw = {}
for f in sys.argv[2:]:
    for root, rec in json.load(open(f)).items(): raw.setdefault(root, {}).update(rec)
out, bad = {}, []
for p in json.load(open(sys.argv[1])):
    root, rec, qs = p["root"], raw.get(p["root"], {}), []
    for q in p.get("q", []):
        e = rec.get(SRC.get(q.get("s")))
        t = q.get("t", "").strip(" .،:")
        if e and len(t) > 3 and t in clean(e["data"]): qs.append([q["s"], t, e["w"]])
        else: bad.append((root, q))
    c = {k: p[k].strip() for k in ("en", "ur") if p.get(k, "").strip()}
    if qs: c["q"] = qs
    if c: out[root] = c
json.dump(dict(sorted(out.items())), open("data/core.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "roots;", sum("q" in c for c in out.values()), "with quotes;", sum("en" in c for c in out.values()), "English;", sum("ur" in c for c in out.values()), "Urdu;", len(bad), "quotes dropped")
for b in bad: print("dropped", *b)
