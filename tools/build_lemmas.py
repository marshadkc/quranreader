"""Build data/index/lemmas.json: where each base word (lemma) occurs, for the progress bars.

{lemma: "n:count,n,..."}: the sūrahs it occurs in, with the count when above 1.
The app weighs each lemma's learning level by these counts to get a sūrah's and the whole Quran's progress
without loading every sūrah. Usage: python3 tools/build_lemmas.py
"""
import glob, json

idx = {}
for f in sorted(glob.glob("data/s/*.json")):
    n = int(f[-8:-5])
    for a in json.load(open(f))["ayahs"]:
        for w in a["w"]:
            m = idx.setdefault(w["l"], {})
            m[n] = m.get(n, 0) + 1
out = {l: ",".join(f"{n}:{c}" if c > 1 else str(n) for n, c in sorted(m.items())) for l, m in sorted(idx.items())}
json.dump(out, open("data/index/lemmas.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "lemmas")
