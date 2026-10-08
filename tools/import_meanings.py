#!/usr/bin/env python3
"""Import word-by-word English and Urdu meanings from the Quran.com API into glosses/NNN.tsv.

Run this where the network allows api.quran.com, then run tools/build_data.py.
Quran Foundation's developer terms do not allow storing their content as files; the project owner chose to
bundle the meanings anyway (see glosses/README.md). Without glosses the app fetches them live instead.

Usage
  python3 tools/import_meanings.py                 all surahs in the app
  python3 tools/import_meanings.py 112 113 114     only these surahs
  Options:
    --verse-en ID   also import a verse translation (Quran.com translation id) for English
    --verse-ur ID   same for Urdu
    --force         overwrite glosses that already exist

The word lists are matched to our Arabic word by word; any ayah whose word count
differs is reported and left out, so nothing is attached to the wrong word.
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_data  # noqa: E402

API = "https://api.quran.com/api/v4/verses/by_chapter/{s}?words=true&word_fields=text_uthmani&language={lang}&per_page=50&page={page}{extra}"


def fetch(s, lang, verse_id=None):
    out, page = {}, 1
    extra = f"&translations={verse_id}" if verse_id else ""
    while True:
        req = urllib.request.Request(API.format(s=s, lang=lang, page=page, extra=extra), headers={"User-Agent": "quranreader-importer"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        for v in data["verses"]:
            words = [w["translation"]["text"] for w in v["words"] if w.get("char_type_name") == "word"]
            verse = v["translations"][0]["text"] if verse_id and v.get("translations") else None
            out[v["verse_number"]] = (words, verse)
        nxt = data.get("pagination", {}).get("next_page")
        if not nxt:
            return out
        page = nxt


def clean(t):
    t = re.sub(r"<sup[^>]*>.*?</sup>|<[^>]+>", "", t or "")
    return " ".join(t.replace(";", ",").replace("\t", " ").split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("surahs", nargs="*", type=int)
    ap.add_argument("--verse-en", type=int)
    ap.add_argument("--verse-ur", type=int)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    words = build_data.load_words()
    counts = {}
    for (s, ay, w) in words:
        counts[(s, ay)] = counts.get((s, ay), 0) + 1
    targets = a.surahs or sorted(build_data.SURAHS)
    for s in targets:
        path = build_data.GLOSSES / f"{s:03d}.tsv"
        if path.exists() and not a.force:
            print(f"{s:03d}: glosses exist, skipped (use --force)")
            continue
        en, ur = fetch(s, "en", a.verse_en), fetch(s, "ur", a.verse_ur)
        lines = [f"# Surah {s}: word meanings from Quran.com (Quran Foundation); Urdu by Dr. Farhat Hashmi, Al-Huda International."]
        skipped = []
        for ay in sorted(en):
            n = counts.get((s, ay), 0)
            e, u = en[ay][0], ur.get(ay, ([], None))[0]
            if len(e) != n or len(u) != n:
                skipped.append(f"{ay} (ours {n}, English {len(e)}, Urdu {len(u)})")
                continue
            lines.append(f"{ay}\t{' ; '.join(clean(x) for x in e)}\t{' ; '.join(clean(x) for x in u)}")
            ve, vu = en[ay][1], ur.get(ay, ([], None))[1]
            if ve or vu:
                lines.append(f"v{ay}\t{clean(ve)}\t{clean(vu)}")
        path.write_text("\n".join(lines) + "\n", encoding="utf8")
        print(f"{s:03d}: wrote {len(lines) - 1} lines" + (f"; word counts differ, left out ayah {', '.join(skipped)}" if skipped else ""))


if __name__ == "__main__":
    main()
