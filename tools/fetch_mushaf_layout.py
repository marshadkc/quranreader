"""Download the Indo-Pak 16-line (Taj Company, 548 pages) mushaf layout from QUL (qul.tarteel.ai, Tarteel's
Quranic Universal Library): for each page, its 16 lines and the words (sura:ayah:word) on each line.
Writes tools/mushaf_layout.json, which tools/build_mushaf.py turns into data/mushaf/PPP.json.
Raw pages are cached in tools/cache/qul/ (not committed)."""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache", "qul")
URL = "https://qul.tarteel.ai/resources/mushaf-layout/11?page={p}"
PAGES = 548

def page_html(p):
    path = os.path.join(CACHE, f"{p:03d}.html")
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        return open(path, encoding="utf-8").read()
    for i in range(4):
        try:
            req = urllib.request.Request(URL.format(p=p), headers={"User-Agent": "Mozilla/5.0 (quranreader layout import)"})
            t = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
            open(path, "w", encoding="utf-8").write(t)
            time.sleep(0.3)
            return t
        except Exception as e:
            print("retry", p, e, file=sys.stderr); time.sleep(2 ** i)
    raise SystemExit(f"page {p} failed")

LINE = re.compile(r'<div class="line-container" data-line="(\d+)">\s*<div class="(line[^"]*)"(.*?)(?=<div class="line-container"|</turbo-frame>)', re.S)
WORD = re.compile(r'<span class="char[^"]*char-(word|end)[^"]*"[^>]*data-location="([\d:]+)"')
SURAH = re.compile(r'surah(\d{3})')

def parse(t, p):
    i = t.find(f'id="page-{p}"')
    if i < 0: raise SystemExit(f"page {p}: no page div")
    lines = []
    for n, cls, body in LINE.findall(t[i:]):
        kind = "surah" if "surah-name" in cls else "bismillah" if "bismillah" in cls or "basmal" in cls else "text"
        line = {"n": int(n), "kind": kind, "center": "center" in cls}
        if kind == "surah":
            m = SURAH.search(body); line["s"] = int(m.group(1)) if m else None
        else:
            line["w"] = [loc for k, loc in WORD.findall(body) if k == "word"]
        lines.append(line)
    return lines

def main():
    os.makedirs(CACHE, exist_ok=True)
    out = {}
    for p in range(1, PAGES + 1):
        out[p] = parse(page_html(p), p)
        if p % 50 == 0: print("page", p, file=sys.stderr)
    json.dump(out, open(os.path.join(HERE, "mushaf_layout.json"), "w"), separators=(",", ":"))

if __name__ == "__main__":
    main()
