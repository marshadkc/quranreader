"""Build data/index/shapes.json: where each word shape occurs, for the progress bars.

A word's shape is its base word plus its stem as written, without vowels, case endings, prefixes (و، ف، ٱل…)
or attached pronouns. So رَبُّ، رَبِّكَ and وَرَبُّنَا share the shape رَبّ|رب, while the plural أَرْبَابًا is a new
shape (رَبّ|ارباب) that the learner must learn where it occurs. Likewise كَافِر, ٱلْكَٰفِرِينَ, يَكْفُرُونَ and
كَفَرُوا are four shapes. js/app.js shapeKey() must match shape_key().

{shape: "n:count,n,..."}: the sūrahs it occurs in, with the count when above 1.
The app weighs each shape's learning level by these counts to get a sūrah's and the whole Quran's progress
without loading every sūrah. Usage: python3 tools/build_shapes.py
"""
import glob, json, re

FOLD = {"ٱ": "ا", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ۥ": "", "ۦ": ""}


def norm(t):
    t = re.sub("(?<![ىي])ٰ", "ا", t)  # small (dagger) alif is a long a, as in كِتَٰب = كتاب
    t = re.sub("[ؐ-ًؚ-ٰۖ-ۭـ]", "", t)
    t = re.sub("[ٱأإآىئؤةۥۦ]", lambda m: FOLD[m.group()], t)
    return re.sub("[^ء-ي]", "", t)


def shape_key(w):
    s = "".join(p[0] for p in w["p"] if p[1] == "s")
    s = re.sub("ً[ٰۭۢ]?[اى]$|[اى]ً$", "", s)  # the alif of -an (رَبًّا = رب)
    n = norm(s)
    if w["pos"] != "V" and n.endswith("ت") and not norm(w["l"]).endswith("ت"):
        n = n[:-1] + "ه"  # رَحْمَتِهِۦ and رَحْمَة are one shape
    if w["pos"] != "V" and n.endswith("ون") and not norm(w["l"]).endswith("ون"):
        n = n[:-2] + "ين"  # the plural's case endings: ٱلْكَٰفِرُونَ and ٱلْكَٰفِرِينَ are one shape
    return w["l"] + "|" + n


if __name__ == "__main__":
    idx = {}
    for f in sorted(glob.glob("data/s/*.json")):
        n = int(f[-8:-5])
        for a in json.load(open(f))["ayahs"]:
            for w in a["w"]:
                m = idx.setdefault(shape_key(w), {})
                m[n] = m.get(n, 0) + 1
    out = {k: ",".join(f"{n}:{c}" if c > 1 else str(n) for n, c in sorted(m.items())) for k, m in sorted(idx.items())}
    json.dump(out, open("data/index/shapes.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "shapes")
