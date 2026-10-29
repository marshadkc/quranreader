"""Reasons of revelation (asbāb al-nuzūl) from al-Suyūṭī's Lubāb al-Nuqūl.

Step 1 (default): split the book into entries ("قوله تعالى ﴿…﴾" + the reports that follow), find the
āyah each entry is about by matching its quoted words against the Quran text in data/s, and flag
reports al-Suyūṭī ties to al-Bukhārī/Muslim or grades ṣaḥīḥ/ḥasan. Writes tools/asbab_raw.json
for review.

Step 2 (--build): turn tools/asbab_picks.json (the reviewed reports with their translations) into
data/asbab/NNN.json, one file per sūrah: {"A": [{"to": last āyah, "ar": Arabic, "ref": Arabic
source line, "g": grading key, "en"/"ur"/"hi": translation}]}. Every "ar" and "ref" must be found
word for word in the book, or the build stops.

Input: OpenITI 0925AH, data/0911Suyuti/0911Suyuti.LubabNuqul/0911Suyuti.LubabNuqul.JK000436-ara1
(git clone --filter=blob:none --sparse https://github.com/OpenITI/0925AH).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = Path(sys.argv[sys.argv.index("--book") + 1]) if "--book" in sys.argv else \
    Path("/home/user/openiti/0925ah/data/0911Suyuti/0911Suyuti.LubabNuqul/0911Suyuti.LubabNuqul.JK000436-ara1")

MARKS = re.compile("[ؐ-ًؚ-ٟۖ-ۭـ]")
# letters Uthmani and plain spelling disagree on (long vowels, hamza seats) are dropped for matching
LOOSE = str.maketrans("", "", "اأإآٱوؤيئىءٰ ")


def loose(t):
    return MARKS.sub("", t.replace("ة", "ه").replace("ٰ", "")).translate(LOOSE)


def clean(t):
    t = re.sub(r"PageV\d+P\d+|ms\d+", " ", t)
    t = t.replace("@QB@", "﴿").replace("@QE@", "﴾")
    return re.sub(r"\s+", " ", t).strip()


def paragraphs():
    out, prev = [], ""
    for line in BOOK.read_text(encoding="utf-8").splitlines():
        # a "# " right after a page break carries on the same sentence
        if line.startswith("# ") and not re.search(r"PageV\d+P\d+\s*$", prev): out.append(line[2:])
        elif line[:2] in ("~~", "# ") and out: out[-1] += " " + line[2:]
        if line.strip(): prev = line
    return [clean(p) for p in out]


def quran():
    """per sūrah: loose text and the āyah each character belongs to"""
    q = {}
    for n in range(1, 115):
        d = json.loads((ROOT / f"data/s/{n:03}.json").read_text(encoding="utf-8"))
        text, owner = "", []
        for a in d["ayahs"]:
            t = loose("".join(w["t"] for w in a["w"]))
            text += t; owner += [a["n"]] * len(t)
        q[n] = (text, owner)
    return q


def place(quote, q, cur):
    k = loose(quote)
    if len(k) < 2: return None
    for n in list(range(cur, 115)) + list(range(1, cur)):
        i = q[n][0].find(k)
        if i >= 0: return n, q[n][1][i]
    return None


SAHIH = re.compile(r"الشيخان|البخاري|الصحيحين|(?<![؀-ۿ])و?مسلم(?![؀-ۿ])|في الصحيح|بسند صحيح|بسند حسن|"
                   r"إسناده صحيح|اسناده صحيح|صححه|وصححه|حسنه|حسن صحيح|بسند جيد|رجاله ثقات|رجال الصحيح")


NAMES = {"البقرة": 2, "المائدة": 5, "الأعراف": 7, "يونس": 10, "هود": 11, "الشعراء": 26, "القصص": 28, "لقمان": 31}
REVEAL = re.compile(r"(?:نزلت|فنزلت|فأنزل الله|وأنزل الله|فنزل|نزلت فيه|نزل)[^﴿]{0,40}﴿([^﴾]+)﴾")


def reports(p):
    """a paragraph can hold several reports, each starting with (و)أخرج / روى"""
    cuts = [m.start() for m in re.finditer(r"(?:\( ك \) |ك )?(?:و ?)?(?:أخرج|اخرج|روى) ", p)]
    cuts = sorted(set([0] + [c for c in cuts if c > 0]))
    return [p[a:b].strip() for a, b in zip(cuts, cuts[1:] + [len(p)]) if p[a:b].strip()]


def step1():
    q, cur, at, out = quran(), 2, None, []
    for p in paragraphs():
        for name, n in NAMES.items():
            if f"سورة {name}" in p[:30] or p.endswith(f"$ سورة {name}"): cur = n
        m = re.match(r"(?:\| )?(?:سورة [^ ]+ )?قوله تعالى ﴿([^﴾]+)﴾", p)
        head = place(m.group(1), q, cur) if m else None
        if head: at = head; cur = head[0]
        for i, r in enumerate(reports(p)):
            own = REVEAL.search(r)
            here = (head if i == 0 and head else None) or (own and place(own.group(1), q, cur)) or at
            if here and here != at and not (i == 0 and head): cur = here[0]
            if here: at = here
            out.append({"s": here and here[0], "a": here and here[1], "ok": [x.group() for x in SAHIH.finditer(r)], "t": r})
    (ROOT / "tools/asbab_raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(out), "reports;", sum(bool(r["ok"]) for r in out), "flagged")


def build():
    """each pick names its report by the words it starts with ("from") and ends with ("end")"""
    book = " ".join(paragraphs())
    picks = json.loads((ROOT / "tools/asbab_picks.json").read_text(encoding="utf-8"))
    out = {}
    for p in picks:
        where = f"{p['s']}:{p['a']}"
        i = book.find(p["from"])
        if i < 0 or book.find(p["from"], i + 1) >= 0: sys.exit(f"{where}: 'from' not found once: {p['from']}")
        j = book.find(p["end"], i)
        if j < 0 or j - i > 6000: sys.exit(f"{where}: 'end' not found: {p['end']}")
        rec = {"ar": book[i:j + len(p["end"])], "g": p["g"], **{l: p[l] for l in ("en", "ur", "hi")}}
        if p.get("to", p["a"]) != p["a"]: rec["to"] = p["to"]
        out.setdefault(p["s"], {}).setdefault(str(p["a"]), []).append(rec)
    d = ROOT / "data/asbab"
    d.mkdir(exist_ok=True)
    for f in d.glob("*.json"): f.unlink()
    for s, v in out.items():
        (d / f"{s:03}.json").write_text(json.dumps(v, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (d / "index.json").write_text(json.dumps({s: sorted(map(int, v)) for s, v in sorted(out.items())}, separators=(",", ":")), encoding="utf-8")
    print(len(picks), "reports in", len(out), "sūrahs")


if __name__ == "__main__":
    build() if "--build" in sys.argv else step1()
