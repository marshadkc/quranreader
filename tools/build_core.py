"""Build the root meanings shown on the word card.

Sources:
- tools/dict/ROOT.json: each root's full dictionary entries (tools/build_dict.py), keyed m, r, l, s, q, b, u
  (Maqāyīs, al-Mufradāt, Lisān, al-Ṣiḥāḥ, al-Qāmūs, Baṣāʾir, ʿUmdat al-Ḥuffāẓ); "x" holds a sister spelling's entries.
- tools/core_picks.json: each root's main summary, [{"root", "q": [{"s", "t": exact phrase, "from"?}], "en", "ur"}].
- tools/dict_picks.jsonl: one summary per root and dictionary, {"root", "s", "t", "en", "ur", "from"?} or {"root", "s", "skip"}.
  The last line for a (root, s) pair wins.
Every quoted phrase must appear word for word in its dictionary entry; any that doesn't is dropped and listed.

Output:
- data/core.json: {root: {en, ur, q: [[s, phrase, form]]}}, the main summary (the Root challenge loads all of it).
- data/root/ROOT.json: {s: [en, ur, phrase, form]} for every dictionary, loaded when a word card opens.
Usage: python3 tools/build_core.py
"""
import glob, json, os, re

norm = lambda t: re.sub(r"\s+", " ", re.sub(r"\[\[.*?\]\]", "", t, flags=re.S)).strip()
ENT = {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob("tools/dict/*.json")}


def entry(root, s, sister=None):
    d = ENT.get(root, {})
    e = (d.get("x", {}).get(sister) or {}).get(s) if sister else d.get(s)
    return norm(e) if e else None


def check(root, s, t, sister=None):
    t = norm(t or "").strip(" .،:")
    e = entry(root, s, sister)
    return t if e and len(t) > 3 and t in e else None


bad, core, per = [], {}, {}
for p in json.load(open("tools/core_picks.json")):
    root, qs = p["root"], []
    for q in p.get("q", []):
        t = check(root, q["s"], q["t"], q.get("from"))
        if t: qs.append([q["s"], t, q.get("from") or ENT.get(root, {}).get("w", root)])
        else: bad.append((root, q["s"], q["t"][:50]))
    c = {k: p[k].strip() for k in ("en", "ur") if p.get(k, "").strip()}
    if qs: c["q"] = qs
    if c: core[root] = c
    if qs and "en" in c and "ur" in c:  # the main summary also stands for the dictionary it quotes first
        per.setdefault(root, {})[qs[0][0]] = [c["en"], c["ur"], qs[0][1], qs[0][2]]
picks = {}
if os.path.exists("tools/dict_picks.jsonl"):
    for line in open("tools/dict_picks.jsonl"):
        o = json.loads(line); picks[(o["root"], o["s"])] = o
for (root, s), o in sorted(picks.items()):
    if o.get("skip") or s in per.get(root, {}): continue
    t = check(root, s, o.get("t"), o.get("from"))
    if t and o.get("en") and o.get("ur"):
        per.setdefault(root, {})[s] = [o["en"].strip(), o["ur"].strip(), t, o.get("from") or ENT[root].get("w", root)]
    else: bad.append((root, s, (o.get("t") or "")[:50]))
json.dump(dict(sorted(core.items())), open("data/core.json", "w"), ensure_ascii=False, separators=(",", ":"))
os.makedirs("data/root", exist_ok=True)
for f in glob.glob("data/root/*.json"): os.remove(f)
for root, d in per.items():
    json.dump(d, open(f"data/root/{root}.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(core), "roots in core.json;", len(per), "root files;", sum(len(d) for d in per.values()), "dictionary summaries;", len(bad), "quotes dropped")
for b in bad: print("dropped", *b)
