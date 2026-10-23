#!/usr/bin/env python3
"""Build data/forms/KEY.json: the "Word forms" section of the word card.

Source
  sources/morphology.txt   Quranic Arabic Corpus 0.4 (Uthmani), one segment per line (loaded with tools/build_data.py).
  A word is every segment of one sura:ayah:word. Its stem is its first segment that is not a PREF (as in build_data.py),
  so the lemma and root here are exactly the "l" and "r" of the words in data/s/NNN.json.

Verbs: a conjugation table made by rules, then checked against every Quran occurrence
  Cells: past (13 persons 3MS 3FS 3MD 3FD 3MP 3FP 2MS 2FS 2D 2MP 2FP 1S 1P), pres = present indicative (same 13),
  cmd = command (2MS 2FS 2D 2MP 2FP). Active voice, forms I-X (plus IX and the quadriliteral forms QI, QIV),
  fully vowelled, standard (not Uthmani) spelling.
  The conjugator works on a small phonological string (root letters, affix letters, short vowels a i u, long A I U,
  Y = final ā written ى, ^ = hamzat al-wasl, @ = the silent alif after the plural و) and then spells it out:
  1. Sound templates per form for past, present (prefix ya/yu + stem + ending), subjunctive and jussive; the command is
     the jussive without its prefix, with a wasl alif (اُ before a u stem vowel, else اِ) when it starts with two
     consonants, or أَ for form IV.
  2. Weak-letter rules, in this order: form VIII ت assimilation (و ي ء(أخذ) -> تّ, ص ض ط ظ -> ط, د ز -> د,
     ذ -> دّ, ث -> ثّ); رأى drops its hamza in the form I present/command and in all of form IV (يَرَى، رَ، أَرَى، يُرِي);
     hollow verbs (R2 و/ي in forms I IV VII VIII X, unless R3 is also weak) lose R2 and lengthen the vowel before it
     (قَالَ يَقُولُ، أَقَامَ يُقِيمُ، اِخْتَارَ يَخْتَارُ، اِسْتَقَامَ يَسْتَقِيمُ), which is shortened in a closed syllable
     (form I past: u for a waw verb of pattern faʿala, else i: قُلْتُ بِعْتُ خِفْتُ; elsewhere the short vowel: أَقَمْتُ، قُلْ);
     doubled verbs merge R2 R3 when R3 has a vowel, moving R2's vowel back to a vowelless R1 (مَدَّ يَمُدُّ، أَحَبَّ يُحِبُّ)
     and stay apart before a consonant ending (مَدَدْتُ، يَمْدُدْنَ, command اُمْدُدْ, variant مُدَّ);
     defective verbs (R3 و/ي) by the vowel before R3 and what follows it (دَعَا دَعَوْا يَدْعُو يَدْعُونَ اُدْعُ،
     رَمَى رَمَوْا يَرْمِي يَرْمُونَ اِرْمِ، رَضِيَ رَضُوا يَرْضَى يَرْضَوْنَ اِرْضَ; derived forms use ي);
     assimilated form I loses initial و in the present (يَعِدُ عِدْ) when the Quran shows it does (rule: present vowel i,
     or a with past a); then uw/uy -> ū and iw/iy -> ī for R1 (يُوقِنُ), and ʾaʾ -> ʾā (آمَنَ، آتَى، آخُذُ).
     Irregular commands: كُلْ خُذْ مُرْ (variant اُؤْمُرْ), سَلْ (variant اِسْأَلْ). Special: لَيْسَ (past only),
     نِعْمَ and بِئْسَ (3MS only), عَسَى (past only), تَعَالَ (command only, conjugated as form VI).
  3. Accepted variants: the assimilated forms V/VI (يَذَّكَّرُ، اِطَّهَّرُوا، اِثَّاقَلْتُمْ) and the present with one ت
     dropped (تَنَزَّلُ), merged doubled commands (مُدَّ), contracted ظَلْتَ (doubled faʿila), مِتُّ beside مُتُّ, اِسْطَاعَ
     beside اِسْتَطَاعَ, حَيَّ beside حَيِيَ, the jussive يَكُ. A cell shows the main form, or the variant when the
     Quran's words in that cell fit only the variant (so the command of أَمَرَ shows the Quran's اُؤْمُرْ / وَأْمُرْ).
  Form I vowels: the past vowel (faʿala/faʿila/faʿula) and the present vowel (yafʿalu/yafʿilu/yafʿulu) are not
  guessed. Every allowed pair (sound: a-a a-i a-u i-a i-i u-u; hollow waw a-u u-u i-a, hollow ya a-i i-a; doubled a-u
  a-i i-a; defective a-u a-i i-a a-a) is conjugated and scored by how many Quran occurrences of the lemma it spells
  (all active PERF, IMPF in every mood, IMPV); ties are broken by the lemma's own spelling. A cell on which the best
  pairs still disagree is unknown (null), unless the Quran has that cell: e.g. a form I verb with no IMPF/IMPV in the
  Quran gets pres and cmd null, one with no PERF and a lemma that is not a past form gets past null.
  Hollow/doubled/defective verbs only allow the pairs above, so e.g. a known yaqūlu fixes qultu.
  If no candidate spells any Quran occurrence, the other VFs are tried (the corpus has تَضَرَّعُوا۟ as VF 1).

Verification
  Each active occurrence (PERF, IMPF MOOD:IND, IMPV, not energetic) is compared with its cell. The Quran word is its
  verb segment + its subject ending (the first PRON SUFF, for the persons that have one), without prefixes and object
  pronouns. Comparison spelling, applied to both sides (cmp_norm):
    tatweel removed; hamza above/below a seat-less letter becomes ء; آ -> ءَا; dagger alif ٰ (and ىٰ) -> َا;
    small waw ۥ -> و, small ya ۦ ۧ -> ي; a letter carrying ۟ or ۠ (the silent alif of وا۟, أُو۟) is dropped;
    sukun, ۡ, maddah, tanwin and all Quranic signs (U+0610-061A, U+06D6-06ED) removed; ٱ -> ا; أ إ ؤ ئ -> ء;
    ى -> ا after a fatha, else ي; a final silent alif after vowelless و dropped (قَالُوا = قَالُو); a leading wasl alif and
    its vowel dropped; the shadda of ت/ط after vowelless د ذ ط ت ظ ث dropped (Uthmani أَخَذتُّم = أَخَذْتُمْ).
    the shadda a first letter takes from the word before (مَن رَّحِمَ) dropped; صۜ (read س) -> س; marks put in Unicode
    NFC order. Kept: every consonant, the short vowels and the shadda. Allowed besides equality: a final short vowel in
    the Quran where the generated form has none (the helping vowel of قُلِ ٱللَّهُ، أَخَذَتِ، اِشْتَرَوُا), and a final
    ي/و of a long vowel missing in the Quran (يَدْعُ ٱلْإِنسَٰنُ، يُؤْتِ ٱللَّهُ). Before an object pronoun the Quran's -tumū
    counts as -tum and 3MP -ū (عَمِلُوهُ) as -ū(ا).
  A lemma with any mismatching occurrence gets "check": true. A cell never shows a form against the rules: when a
  Quran word does not fit the cell's rule form, the rule form stays, the word is not counted in q for that cell and goes
  to qx as "<tense>.<person>.Q" (spelled so in the Quran, outside the rules). Only a cell whose rule form is unknown
  (null) takes the Quran's commonest spelling there (counted in q).
  Occurrences with another VF than the lemma's main one, passive, energetic (-nna), subjunctive and jussive go to "qx".

Nouns (POS N without PRON DEM REL PN INTG COND NV; participles and verbal nouns included): the distinct Quran forms
  (stem with ال if present, written ٱل also after لِ; no other prefix, no attached pronoun, no borrowed first shadda),
  grouped by number/gender tag (corpus M F P MS FS MD FD
  MP FP, or ""), "al"/"" and case (NOM ACC GEN or "").

Output: data/forms/KEY.json, KEY = the word's root (as data/root/ROOT.json), or for words without a root "=" + norm(lemma)
  (norm() of build_data.py / js app.js, e.g. =اذا.json), so the app fetches `data/forms/${w.r || "=" + norm(w.l)}.json`
  and reads [w.l]. Compact JSON:
  {LEMMA: {"pos": "V", "vf": 1, "check": false, "past": {"3MS": ..}|null, "pres": {..}|null, "cmd": {..}|null,
           "q": {"past.3MP": [count, "s:a:w"], ..}, "qx": [[spelling, "pres.3MP.SUBJ", count, "s:a:w"], ..],
           "rel": [[lemma, "ACT_PCPL"|"PASS_PCPL"|"VN", count, "s:a:w"], ..]},
   LEMMA: {"pos": "N", "forms": [[spelling, "MP", "al", "NOM", count, ["s:a:w", ..up to 5]], ..]}}
  Cells inside past/pres/cmd may be null. qx labels: tense.person[.SUBJ|.JUS|.PASS|.ENER|.VFn], or tense.person.Q.
  tools/forms_report.txt: counts and every remaining mismatch.
Usage: python3 tools/build_forms.py
"""
import collections
import itertools
import json
import pathlib
import re
import sys
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_data import load_words, norm  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "forms"
REPORT = ROOT / "tools" / "forms_report.txt"

PERS = ["3MS", "3FS", "3MD", "3FD", "3MP", "3FP", "2MS", "2FS", "2D", "2MP", "2FP", "1S", "1P"]
CMDP = ["2MS", "2FS", "2D", "2MP", "2FP"]
PCODE = {"2MD": "2D", "2FD": "2D"}
TABLE = {"past": PERS, "pres": PERS, "cmd": CMDP}

# ---------------------------------------------------------------- conjugator

VOW = set("aiuAIUY")
LONG = {"a": "A", "i": "I", "u": "U"}
SHORT = {"A": "a", "I": "i", "U": "u", "Y": "a"}
CLS = {"a": "a", "A": "a", "Y": "a", "i": "i", "I": "i", "u": "u", "U": "u"}
MARK = {"a": "َ", "i": "ِ", "u": "ُ"}
SUKUN, SHADDA = "ْ", "ّ"

PAST_END = {"3MS": "a", "3FS": "aت", "3MD": "A", "3FD": "aتA", "3MP": "U@", "3FP": "نa", "2MS": "تa", "2FS": "تi",
            "2D": "تuمA", "2MP": "تuم", "2FP": "تuننa", "1S": "تu", "1P": "نA"}
PREFIX = {"3MS": "ي", "3FS": "ت", "3MD": "ي", "3FD": "ت", "3MP": "ي", "3FP": "ي", "2MS": "ت", "2FS": "ت", "2D": "ت",
          "2MP": "ت", "2FP": "ت", "1S": "ء", "1P": "ن"}
_SING = {"3MS", "3FS", "2MS", "1S", "1P"}
_DUAL = {"3MD", "3FD", "2D"}
_PL = {"3MP", "2MP"}
_FPL = {"3FP", "2FP"}


def mood_end(p, mood):
    if p in _SING:
        return {"ind": "u", "subj": "a", "jus": ""}[mood]
    if p in _DUAL:
        return "Aنi" if mood == "ind" else "A"
    if p in _PL:
        return "Uنa" if mood == "ind" else "U@"
    if p in _FPL:
        return "نa"
    return "Iنa" if mood == "ind" else "I"  # 2FS


# '1'-'4' radicals, 'X' the infix ت of form VIII, 'v' past vowel, 'q' present vowel (form I)
PAST_T = {1: "1a2v3", 2: "1a22a3", 3: "1A2a3", 4: "ءa12a3", 5: "تa1a22a3", 6: "تa1A2a3", 7: "^iن1a2a3",
          8: "^i1Xa2a3", 9: "^i12a3a3", 10: "^iستa12a3", "Q1": "1a23a4", "Q4": "^i12a34a4"}
PRES_T = {1: "a12q3", 2: "u1a22i3", 3: "u1A2i3", 4: "u12i3", 5: "aتa1a22a3", 6: "aتa1A2a3", 7: "aن1a2i3",
          8: "a1Xa2i3", 9: "a12a3i3", 10: "aستa12i3", "Q1": "u1a23i4", "Q4": "a12a34i4"}
# assimilated forms V/VI (يَذَّكَّرُ، اِثَّاقَلَ) and the present with one ت dropped (تَنَزَّلُ)
ALT_PAST = {5: "^i11a22a3", 6: "^i11A2a3"}
ALT_PRES = {5: "a11a22a3", 6: "a11A2a3"}
DROP_PRES = {5: "a1a22a3", 6: "a1A2a3"}
ASSIM_T = set("تثدذزسشصضطظ")


def parse(s, rad=None):
    toks = []
    for ch in s:
        if ch in "1234":
            toks.append([rad[int(ch) - 1], ch])
        elif ch == "X":
            toks.append(["ت", "X"])
        else:
            toks.append([ch, None])
    return toks


isv = lambda t: t is not None and t[0] in VOW
iscons = lambda t: t is not None and t[0] not in VOW and t[0] != "@"


def idx(toks, role, start=0):
    for i in range(start, len(toks)):
        if toks[i][1] == role:
            return i
    return -1


def at(toks, i):
    return toks[i] if 0 <= i < len(toks) else None


class Verb:
    """A root + form, with the form I vowels and flags, that conjugates itself."""

    def __init__(self, rad, vf, pv="a", qv="a", hollow=True, wdrop=False, lemma_root=None):
        self.rad = rad
        self.vf = vf
        self.form = ("Q1" if vf == 1 else "Q4") if len(rad) == 4 else vf
        self.pv, self.qv, self.hollow_flag, self.wdrop = pv, qv, hollow, wdrop
        r = rad
        self.weak3 = len(r) == 3 and r[2] in "وي"
        self.is_hollow = (hollow and len(r) == 3 and r[1] in "وي" and not self.weak3 and self.form in (1, 4, 7, 8, 10))
        self.is_doubled = len(r) == 3 and r[1] == r[2] and not self.weak3 and self.form in (1, 3, 4, 6, 7, 8, 10)

    # -- rules ------------------------------------------------------------
    def rules(self, toks, tense):
        r, form = self.rad, self.form
        if form == 8:
            i1, ix = idx(toks, "1"), idx(toks, "X")
            c = r[0]
            if c in "وي" or tuple(r) == ("ء", "خ", "ذ"):
                toks[i1][0] = "ت"
            elif c in "صضطظ":
                toks[ix][0] = "ط"
            elif c in "دز":
                toks[ix][0] = "د"
            elif c == "ذ":
                toks[i1][0] = toks[ix][0] = "د"
            elif c == "ث":
                toks[ix][0] = "ث"
        if tuple(r) == ("ر", "ء", "ي") and ((form == 1 and tense != "past") or form == 4):
            del toks[idx(toks, "2")]  # يَرَى، أَرَى: the hamza goes, its vowel moves to R1
        if self.is_hollow:
            self._hollow(toks, tense)
        if self.is_doubled or form in (9, "Q4"):
            self._merge(toks)
        if self.weak3:
            self._defective(toks, tense)
        if form == 1 and tense != "past" and r[0] == "و" and self.wdrop:
            i1 = idx(toks, "1")
            if i1 >= 0 and iscons(at(toks, i1 + 1)):
                del toks[i1]
        return toks

    def post(self, toks):
        # R1 و/ي without a vowel after u/i: يُوقِنُ، اِيجَلْ
        i1 = idx(toks, "1")
        if i1 > 0 and toks[i1][0] in "وي" and not isv(at(toks, i1 + 1)) and isv(toks[i1 - 1]) and toks[i1 - 1][0] in "ui" and self.form != 8:
            toks[i1 - 1][0] = LONG[toks[i1 - 1][0]]
            del toks[i1]
        # ʾaʾ -> ʾā
        k = 0
        while k + 2 < len(toks):
            if toks[k][0] == "ء" and toks[k + 1][0] in "aiu" and toks[k + 2][0] == "ء" and not isv(at(toks, k + 3)):
                toks[k + 1][0] = LONG[toks[k + 1][0]]
                del toks[k + 2]
            k += 1
        return toks

    def _hollow(self, toks, tense):
        i2 = idx(toks, "2")
        if i2 < 1 or not isv(at(toks, i2 + 1)):
            return
        if tense == "past":
            L = "A"
        elif self.form == 1:
            L = LONG[self.qv]
        else:
            L = "I" if self.form in (4, 10) else "A"
        del toks[i2:i2 + 2]
        j = i2 - 1
        if isv(toks[j]):
            toks[j][0] = L
            li = j
        else:
            toks.insert(i2, [L, None])
            li = i2
        i3 = li + 1
        if not isv(at(toks, i3 + 1)):  # closed syllable: shorten
            if self.form == 1 and tense == "past":
                s = "u" if self.pv == "u" or (self.pv == "a" and self.rad[1] == "و") else "i"
            else:
                s = SHORT[L]
            toks[li][0] = s

    def _merge(self, toks):
        if self.form == 9:
            a = idx(toks, "3"); b = idx(toks, "3", a + 1)
        elif self.form == "Q4":
            a = idx(toks, "4"); b = idx(toks, "4", a + 1)
        else:
            a = idx(toks, "2"); b = idx(toks, "3")
        if a < 0 or b != a + 2 or not isv(toks[a + 1]) or not isv(at(toks, b + 1)):
            return
        v = toks[a + 1]
        del toks[a + 1]
        if a > 0 and iscons(toks[a - 1]) and toks[a - 1][0] != "^":
            toks.insert(a, v)

    def _defective(self, toks, tense):
        i3 = idx(toks, "3")
        if i3 < 1 or not isv(toks[i3 - 1]):
            return
        x = toks[i3 - 1][0]
        n, nn = at(toks, i3 + 1), at(toks, i3 + 2)
        nv = n[0] if n else None
        if x in "aA":
            W = toks[i3][0] if (self.form == 1 and tense == "past") else "ي"
            if nv in ("a", "u"):
                if nn is None:
                    prev = at(toks, i3 - 2)
                    y = "A" if ((self.form == 1 and tense == "past" and self.rad[2] == "و") or (prev and prev[0] == "ي")) else "Y"
                    toks[i3 - 1:i3 + 2] = [[y, None]]
                else:
                    del toks[i3:i3 + 2]
            elif nv == "A":
                toks[i3][0] = W
            elif nv == "U":
                toks[i3][0] = "و"; del toks[i3 + 1]
            elif nv == "I":
                toks[i3][0] = "ي"; del toks[i3 + 1]
            elif n is None:
                del toks[i3]
            else:
                toks[i3][0] = W
        else:
            lv, lc = ("I", "ي") if x == "i" else ("U", "و")
            if n is None:
                del toks[i3]
            elif nv == "u" or (nv == "i" and x == "i"):
                toks[i3 - 1:i3 + 2] = [[lv, None]]
            elif nv in ("a", "A"):
                toks[i3][0] = lc
            elif nv in ("U", "I"):
                del toks[i3 - 1:i3 + 1]
            else:
                toks[i3 - 1:i3 + 1] = [[lv, None]]

    # -- building -----------------------------------------------------------
    def _tpl(self, t):
        return t.replace("v", self.pv).replace("q", self.qv)

    def past(self, p, tpl=None):
        toks = parse(self._tpl(tpl or PAST_T[self.form]), self.rad) + parse(PAST_END[p])
        return self.post(self.rules(toks, "past"))

    def pres(self, p, mood, tpl=None, raw=False):
        end = mood_end(p, mood)
        toks = parse(PREFIX[p]) + parse(self._tpl(tpl or PRES_T[self.form]), self.rad) + parse(end)
        toks = self.rules(toks, mood if mood != "ind" else "pres")
        return toks if raw else self.post(toks)

    def cmd(self, p, tpl=None, force_merge=False):
        toks = self.pres(p, "subj" if force_merge else "jus", tpl, raw=True)
        toks = toks[2:]
        form = self.form
        if form == 4 or (form == "Q4" and False):
            toks = parse("ءa") + toks
        elif toks and iscons(toks[0]) and not isv(at(toks, 1)):
            wv = "u" if (form == 1 and self.qv == "u") else "i"
            toks = parse("^" + wv) + toks
        return self.post(toks)

    def table(self):
        """{cell: [variant phonological token lists]} for past, pres, subj, jus, cmd."""
        out = {}
        f = self.form
        for p in PERS:
            out["past." + p] = [self.past(p)]
            if f in ALT_PAST and self.rad[0] in ASSIM_T:
                out["past." + p].append(self.past(p, ALT_PAST[f]))
            for mood, key in (("ind", "pres"), ("subj", "subj"), ("jus", "jus")):
                vs = [self.pres(p, mood)]
                if f in ALT_PRES and self.rad[0] in ASSIM_T:
                    vs.append(self.pres(p, mood, ALT_PRES[f]))
                if f in DROP_PRES and PREFIX[p] == "ت":
                    vs.append(self.pres(p, mood, DROP_PRES[f]))
                if mood == "jus" and self.is_doubled and p in _SING:
                    vs.append(self.pres(p, "subj"))
                out[key + "." + p] = vs
        for p in CMDP:
            vs = [self.cmd(p)]
            if f in ALT_PRES and self.rad[0] in ASSIM_T:
                vs.append(self.cmd(p, ALT_PRES[f]))
            if self.is_doubled and p == "2MS":
                vs.append(self.cmd(p, force_merge=True))
            out["cmd." + p] = vs
        if f == 1 and self.rad[0] == "ء" and len(self.rad) == 3:
            r = tuple(self.rad)
            if r in (("ء", "ك", "ل"), ("ء", "خ", "ذ"), ("ء", "م", "ر")):  # كُلْ خُذْ مُرْ
                for p in CMDP:
                    t = self.cmd(p)
                    i = idx(t, "1")
                    t2 = [x for j, x in enumerate(t) if j != i and not (j < i)]
                    out["cmd." + p] = [t2] + ([t] if r == ("ء", "م", "ر") else [])
        if f == 1 and tuple(self.rad) == ("س", "ء", "ل"):  # سَلْ beside اِسْأَلْ
            for p in CMDP:
                t = self.cmd(p)
                t2 = [x for x in t if x[1] != "2"][2:]
                t2[0:0] = []
                out["cmd." + p] = out["cmd." + p] + [t2]
        r = "".join(self.rad)
        if f == 1 and self.is_doubled and self.pv == "i":  # ظَلْتَ beside ظَلِلْتَ
            for p in PERS:
                t = self.past(p)
                i2 = idx(t, "2")
                if PAST_END[p][0] in "تن" and isv(at(t, i2 + 1)):
                    out["past." + p].append(t[:i2] + t[i2 + 2:])
        if f == 1 and r == "موت":  # مِتُّ beside مُتُّ
            for p in PERS:
                if PAST_END[p][0] in "تن":
                    t = self.past(p)
                    t[1][0] = "i"
                    out["past." + p].append(t)
        if f == 10 and r == "طوع":  # اِسْطَاعَ يَسْطِيعُ beside اِسْتَطَاعَ
            for p in PERS:
                out["past." + p].append(self.past(p, "^iس12a3"))
                for mood, key in (("ind", "pres"), ("subj", "subj"), ("jus", "jus")):
                    out[key + "." + p].append(self.pres(p, mood, "aس12i3"))
        res = {k: [spell(v) for v in vs] for k, vs in out.items()}
        for k, vs in EXTRA.get((r, self.vf, self.pv), {}).items():
            res[k] = res[k] + vs
        return res


def hamza_seat(prev, own, initial, final):
    oc = CLS.get(own)
    if initial:
        return "آ" if own == "A" else ("إ" if oc == "i" else "أ")
    if final:
        return {"a": "أ", "i": "ئ", "u": "ؤ"}.get(prev, "ء")
    if own == "A" and prev in ("a", None):
        return "آ"
    if prev in ("A", "U"):
        return "ئ" if oc == "i" else "ء"
    if prev == "I":
        return "ئ"
    if prev is None:
        return {"a": "أ", "u": "ؤ", "i": "ئ"}.get(oc, "ء")
    s = {CLS[prev], oc}
    return "ئ" if "i" in s else ("ؤ" if "u" in s else "أ")


def spell(toks):
    out = []
    n = len(toks)
    k = 0
    while k < n:
        ch = toks[k][0]
        if ch == "@":
            out.append("ا"); k += 1; continue
        if ch in VOW:  # a stray vowel (should not happen)
            out.append(MARK.get(CLS[ch], "")); k += 1; continue
        if ch == "^":
            v = toks[k + 1][0] if isv(at(toks, k + 1)) else None
            out.append("ا" + (MARK[CLS[v]] + {"I": "ي", "U": "و"}.get(v, "") if v else ""))
            k += 2 if v else 1
            continue
        gem = k + 1 < n and toks[k + 1][0] == ch and not isv(toks[k])
        j = k + 2 if gem else k + 1
        own = toks[j][0] if isv(at(toks, j)) else None
        letter = ch
        if ch == "ء":
            prev = toks[k - 1][0] if k > 0 and isv(toks[k - 1]) else None
            rest = j + 1 if own else j
            letter = hamza_seat(prev, own, k == 0, rest >= n and own in (None, "a", "i", "u"))
        out.append(letter)
        if gem:
            out.append(SHADDA)
        if letter == "آ":
            k = j + 1 if own == "A" else j
            if own and own != "A":
                out.append(MARK[CLS[own]])
                k = j + 1
            continue
        if own:
            out.append(MARK[CLS[own]] + {"A": "ا", "I": "ي", "U": "و", "Y": "ى"}.get(own, ""))
            k = j + 1
        else:
            out.append(SUKUN)
            k = j
    return "".join(out)


# ---------------------------------------------------------------- comparison spelling

_HAR = "َُِ"
_DROP = re.compile("[ًٌٍْۡٓؐ-ؚۖ-ۜ۞-ۤۧ-ࣰۭ-ࣳ]")
_FOLDQ = str.maketrans({"ٱ": "ا", "أ": "ء", "إ": "ء", "ؤ": "ء", "ئ": "ء"})


def cmp_norm(t):
    t = t.replace("آ", "ءَا").replace("\u0653", "")  # maddah: before NFC, which would make ا + ٓ into آ
    t = unicodedata.normalize("NFC", t)  # NFC orders the marks; يَبْصُۜطُ is read يَبْسُطُ
    t = re.sub("ص([\u064b-\u0652]*)\u06dc", "س\\1", t)  # يَبْصُۜطُ is read يَبْسُطُ
    t = re.sub("ـ([ً-ْ]*)[ٕٔ]", "ء\\1", t)  # يَسْـَٔلُ: a hamza on a tatweel
    t = re.sub("[ٕٔ]", "ء", t.replace("ـ", ""))
    t = re.sub("(\u064e?)(\u0651?)\u0649\u0670", "\u064e\\2ا", t)  # ىٰ and ٰ are a long a (NFC puts shadda before ٰ)
    t = re.sub("(\u064e?)(\u0651?)\u0670", "\u064e\\2ا", t)
    t = t.replace("ۥ", "و").replace("ۦ", "ي").replace("ۧ", "ي")
    t = re.sub(".[۟۠]", "", t)
    t = _DROP.sub("", t)
    t = t.translate(_FOLDQ)
    t = re.sub("(\u064e\u0651?)\u0649(?![\u064b-\u0651])", "\\1ا", t).replace("ى", "ي")
    t = re.sub("وّ?ا$", lambda m: m.group()[:-1], t)
    t = re.sub("^ا[َُِ]?", "", t)
    t = re.sub("([دذطتظث])([تط])([\u064b-\u0650]?)\u0651", "\\1\\2\\3", t)
    t = re.sub("^(.)([\u064b-\u0650]?)\u0651", "\\1\\2", t)  # the shadda of a merged neighbour: لَن نَّقُولَ، مَن رَّحِمَ
    return t


def same(g, q):
    if g == q:
        return True
    if q[-1:] in _HAR and q[-1:] != "" and g[-1:] not in _HAR and q[:-1] == g:
        return True  # helping vowel: قُلِ ٱللَّهُ
    # Uthmani leaves out a final long vowel letter in some places: يَدْعُ ٱلْإِنسَٰنُ، يُؤْتِ ٱللَّهُ
    return g[-2:] in ("ِي", "ُو") and q == g[:-1]


# ---------------------------------------------------------------- Quran data

def loc_str(k):
    return f"{k[0]}:{k[1]}:{k[2]}"


def stem_index(segs):
    return next((i for i, (_, _, f) in enumerate(segs) if "PREF" not in f["tags"]), 0)


NEEDS = {"past": set(PERS) - {"3MS", "3FS"}, "pres": _DUAL | _PL | _FPL, "cmd": {"2FS", "2D", "2MP", "2FP"}}
NOUN_SKIP = {"PRON", "DEM", "REL", "PN", "INTG", "COND", "NV"}
GN = ["MS", "FS", "MD", "FD", "MP", "FP", "M", "F", "P"]


def lead(t):
    """Drop the shadda that a word's first letter takes from the word before it (مَن رَّحِمَ، لَن نَّقُولَ)."""
    return re.sub("^(.)([\u064b-\u0650]?)\u0651", "\\1\\2", t)


def collect(words):
    verbs = collections.defaultdict(list)    # lemma -> occurrences
    nouns = collections.defaultdict(lambda: collections.defaultdict(list))
    keys = collections.defaultdict(set)      # lemma -> file keys
    nrel = collections.defaultdict(lambda: collections.defaultdict(list))  # (root, vf) -> (lemma, tag) -> locs
    for k, segs in words.items():
        si = stem_index(segs)
        form, pos, f = segs[si]
        lem = f.get("LEM") or "".join(x[0] for x in segs)
        root = f.get("ROOT", "")
        fkey = root or "=" + norm(lem)
        if pos == "V":
            tags = f["tags"]
            tense = next(t for t in tags if t in ("PERF", "IMPF", "IMPV"))
            p = next((t for t in tags if t[:1] in "123" and len(t) <= 3), "?")
            p = PCODE.get(p, p)
            mood = f.get("MOOD")
            kind = {"PERF": "past", "IMPV": "cmd"}.get(tense) or {"IND": "pres", "SUBJ": "subj", "JUS": "jus"}[mood]
            after = segs[si + 1:]
            ener = any(x[2]["tags"][:1] == ["EMPH"] for x in after)
            text = form
            rest = after
            need = NEEDS["pres" if kind in ("subj", "jus") else kind]
            if p in need and after and after[0][2]["tags"][:2] == ["PRON", "SUFF"]:
                text += after[0][0]
                rest = after[1:]
            obj = any(x[2]["tags"][:1] == ["PRON"] for x in rest)
            text = lead(text)
            q = cmp_norm(text)
            if obj and kind == "past" and p == "2MP" and q.endswith("تُمُو"):
                q = q[:-1]
                q = q[:-1] if q.endswith("ُ") else q
            verbs[lem].append({"kind": kind, "p": p, "text": text, "q": q, "loc": loc_str(k), "vf": int(f.get("VF", 1)),
                               "pass": "PASS" in tags, "ener": ener, "root": root})
            keys[lem].add(fkey)
        elif pos == "N" and not (set(f["tags"]) & NOUN_SKIP):
            det = next((x for x in segs[:si] if "DET" in x[2]["tags"]), None)
            text = form
            if det:
                d = det[0]
                d = "ٱ" + d if d.startswith("ل") else ("ٱ" + d[1:] if d.startswith("آ") else d)
                text = d + form
            text = text if det else lead(text)
            gn = next((t for t in f["tags"] if t in GN), "")
            case = next((t for t in f["tags"] if t in ("NOM", "ACC", "GEN")), "")
            nouns[lem][(text, gn, "al" if det else "", case)].append(loc_str(k))
            keys[lem].add(fkey)
            for t in ("ACT_PCPL", "PASS_PCPL", "VN"):
                if t in f["tags"] and root:
                    nrel[(root, int(f.get("VF", 1)))][(lem, t)].append(loc_str(k))
    return verbs, nouns, keys, nrel


# ---------------------------------------------------------------- choosing form I vowels

def allowed_pairs(rad):
    if len(rad) == 4:
        return [("a", "i")]
    r1, r2, r3 = rad
    if r3 == "و":
        return [("a", "u"), ("i", "a"), ("a", "a")]
    if r3 == "ي":
        return [("a", "i"), ("i", "a"), ("a", "a"), ("i", "i")]
    if r2 == r3:
        return [("a", "u"), ("a", "i"), ("i", "a")]
    if r2 == "و":
        return [("a", "u"), ("u", "u"), ("i", "a")]
    if r2 == "ي":
        return [("a", "i"), ("i", "a")]
    return [("a", "a"), ("a", "i"), ("a", "u"), ("i", "a"), ("i", "i"), ("u", "u")]


def candidates(rad, vf):
    """[(Verb, flag-priority)]; lower priority wins ties."""
    out = []
    hollow_opts = [True, False] if (len(rad) == 3 and rad[1] in "وي" and rad[2] not in "وي") else [True]
    pairs = allowed_pairs(rad) if vf == 1 else [("a", "a")]
    for pv, qv in pairs:
        wopts = [True, False] if (vf == 1 and rad[0] == "و") else [False]
        for h, wd in itertools.product(hollow_opts, wopts):
            default_w = qv == "i" or (qv == "a" and pv == "a")
            prio = (0 if h else 1) + (0 if wd == default_w or rad[0] != "و" or vf != 1 else 1)
            out.append((Verb(rad, vf, pv, qv, h, wd), prio))
    return out


def match_cell(variants_norm, q):
    return any(same(g, q) for g in variants_norm)


SPECIAL = {
    "لَيْسَ": {"past": {"3MS": "لَيْسَ", "3FS": "لَيْسَتْ", "3MD": "لَيْسَا", "3FD": "لَيْسَتَا", "3MP": "لَيْسُوا",
                        "3FP": "لَسْنَ", "2MS": "لَسْتَ", "2FS": "لَسْتِ", "2D": "لَسْتُمَا", "2MP": "لَسْتُمْ",
                        "2FP": "لَسْتُنَّ", "1S": "لَسْتُ", "1P": "لَسْنَا"}, "pres": None, "cmd": None},
}
SPECIAL["نِعْمَ"] = {"past": {"3MS": ["نِعْمَ", "نِعِ", "نِعِمَّا"]}, "pres": None, "cmd": None}  # نِعِمَّا = نِعْمَ + مَا
SPECIAL["بِئْسَ"] = {"past": {"3MS": ["بِئْسَ"]}, "pres": None, "cmd": None}
SPECIAL["هاتُ"] = {"past": None, "pres": None,
                   "cmd": {"2MS": "هَاتِ", "2FS": "هَاتِي", "2D": "هَاتِيَا", "2MP": "هَاتُوا", "2FP": "هَاتِينَ"}}
ONLY = {"عَسَى": ("past", None), "تَعالَ": ("cmd", None)}
VF_OVERRIDE = {"تَعالَ": 6, "اشْمَأَزَّتْ": 4}
ROOT_OVERRIDE = {"اشْمَأَزَّتْ": "شمأز"}
# Quranic by-forms accepted beside the rule form: (root, vf) -> {cell: [spellings]}
EXTRA = {
    ("حيي", 1, "i"): {"past.3MS": ["حَيَّ"], "past.3MP": ["حَيُّوا"]},
    ("كون", 1, "a"): {"jus.3MS": ["يَكُ"], "jus.3FS": ["تَكُ"], "jus.2MS": ["تَكُ"], "jus.1S": ["أَكُ"], "jus.1P": ["نَكُ"]},
}


def radicals(root):
    return [("ء" if c in "أإؤئ" else c) for c in root]


def choose(rad, vf, ev, lem):
    """Score every candidate conjugation against the Quran; return (best key, cells, info)."""
    lemn = cmp_norm(lem)
    lemn = lemn[:-1] if lemn[-1:] in _HAR else lemn
    scored = []
    for v, prio in candidates(rad, vf):
        tb = v.table()
        nt = {k: [cmp_norm(x) for x in vs] for k, vs in tb.items()}
        hits = collections.Counter(o["kind"] + "." + o["p"] for o in ev if match_cell(nt.get(o["kind"] + "." + o["p"], []), o["q"]))
        lm = 0
        for c in ("past.3MS", "pres.3MS", "cmd.2MS"):
            g = nt[c][0]
            g = g[:-1] if g[-1:] in _HAR else g
            if g == lemn:
                lm = 1
        scored.append((sum(hits.values()), lm, -prio, v, tb, hits))
    best = max(s[:3] for s in scored)
    top = [s for s in scored if s[:3] == best]
    cells = {}
    for cell in top[0][4]:
        vals = {tuple(s[4][cell]) for s in top}
        if len(vals) == 1:
            cells[cell] = vals.pop()
        else:  # the vowels are not known; keep the cell only where the Quran shows it
            s_ = max(top, key=lambda s: s[5][cell])
            cells[cell] = tuple(s_[4][cell]) if s_[5][cell] else None
    info = {"pv": sorted({s[3].pv for s in top}), "qv": sorted({s[3].qv for s in top})} if vf == 1 else {}
    return best, cells, info


def build_verb(lem, occs):
    nfc = unicodedata.normalize("NFC", lem)
    lem_ = next((k for k in list(SPECIAL) + list(ONLY) + list(VF_OVERRIDE) if unicodedata.normalize("NFC", k) == nfc), lem)
    vf = VF_OVERRIDE.get(lem_) or collections.Counter(o["vf"] for o in occs).most_common(1)[0][0]
    root = ROOT_OVERRIDE.get(lem_) or collections.Counter(o["root"] for o in occs).most_common(1)[0][0]
    rad = radicals(root)
    cvf = vf  # the corpus's VF; the rules may find another one below
    main = [o for o in occs if o["vf"] == vf or lem_ in VF_OVERRIDE]
    ev = [o for o in main if not o["pass"] and not o["ener"]]
    tables = {}
    if lem_ in SPECIAL:
        t = {}
        for tense, cells in SPECIAL[lem_].items():
            for p in TABLE[tense]:
                c = cells.get(p) if cells else None
                t[tense + "." + p] = (c if isinstance(c, list) else [c]) if c else None
        chosen_cells = {k: (tuple(v) if v else None) for k, v in t.items()}
    elif len(rad) not in (3, 4):
        chosen_cells = {}
    else:
        best, chosen_cells, tables = choose(rad, vf, ev, lem)
        if best[0] == 0 and ev and lem_ not in VF_OVERRIDE:
            # nothing matches: the corpus may give the wrong VF (تَضَرَّعُوا۟ as VF 1); try the other forms
            alt = max((choose(rad, f, ev, lem) + (f,) for f in range(1, 11) if f != vf), key=lambda x: x[0][:1])
            if alt[0][0] > 0:
                best, chosen_cells, tables, vf = alt
    if lem_ in ONLY:
        tense, persons = ONLY[lem_]
        for cell in list(chosen_cells):
            t, p = cell.split(".")
            if t != tense or (persons and p not in persons):
                chosen_cells[cell] = None
    # verify and fill the table
    cellq = collections.defaultdict(list)
    for o in ev:
        cellq[o["kind"] + "." + o["p"]].append(o)
    entry = {"pos": "V", "vf": vf, "check": False}
    mism = []
    q = {}
    qbad = []
    for tense, persons in TABLE.items():
        row = {}
        for p in persons:
            cell = tense + "." + p
            vs = chosen_cells.get(cell)
            os_ = cellq.get(cell, [])
            val = vs[0] if vs else None
            if os_:
                nv = [cmp_norm(x) for x in vs] if vs else []
                ok = [o for o in os_ if match_cell(nv, o["q"])]
                bad = [o for o in os_ if not match_cell(nv, o["q"])]
                if vs and len(vs) > 1 and ok and not any(same(nv[0], o["q"]) for o in ok):
                    val = next(x for x, g in zip(vs, nv) if any(same(g, o["q"]) for o in ok))
                if vs:
                    shown = ok  # Quran words outside the rules go to qx as <cell>.Q; the rule form stays
                    qbad.extend(bad)
                else:  # no rule form: the cell takes the Quran's own spelling
                    shown = os_
                    if bad:
                        val = collections.Counter(o["text"] for o in os_).most_common(1)[0][0]
                if shown:
                    q[cell] = [len(shown), shown[0]["loc"]]
                if bad:
                    entry["check"] = True
                    for t_, n_ in collections.Counter(o["text"] for o in bad).most_common():
                        lo = next(o["loc"] for o in bad if o["text"] == t_)
                        mism.append((lem, cell, vs[0] if vs else None, t_, n_, lo))
            row[p] = val
        entry[tense] = row if any(v is not None for v in row.values()) else None
    entry["q"] = q
    # forms outside the table
    qx = collections.OrderedDict()
    sub_bad = 0
    for o in qbad:
        e = qx.setdefault((o["text"], o["kind"] + "." + o["p"] + ".Q"), [0, o["loc"]])
        e[0] += 1
    for o in occs:
        lab = None
        base = ("pres" if o["kind"] in ("subj", "jus") else o["kind"]) + "." + o["p"]
        base += "." + o["kind"].upper() if o["kind"] in ("subj", "jus") else ""
        if o["vf"] != cvf and lem_ not in VF_OVERRIDE:
            lab = base + (".PASS" if o["pass"] else "") + f".VF{o['vf']}"
        elif o["pass"]:
            lab = base + ".PASS"
        elif o["ener"]:
            lab = base + ".ENER"
        elif o["kind"] in ("subj", "jus"):
            lab = base
            vs = chosen_cells.get(o["kind"] + "." + o["p"])
            if not vs or not match_cell([cmp_norm(x) for x in vs], o["q"]):
                sub_bad += 1
        if lab:
            e = qx.setdefault((o["text"], lab), [0, o["loc"]])
            e[0] += 1
    entry["qx"] = [[t, lab, n, lo] for (t, lab), (n, lo) in qx.items()]
    return entry, mism, sub_bad, len(ev) - sum(1 for o in ev if o["kind"] in ("subj", "jus")), tables, (root, vf)


def main():
    words = load_words()
    verbs, nouns, keys, nrel = collect(words)
    files = collections.defaultdict(dict)
    all_mism = []
    stats = collections.Counter()
    for lem, occs in verbs.items():
        entry, mism, sub_bad, ntab, info, (root, vf) = build_verb(lem, occs)
        rel = []
        for (nl, tag), locs in sorted(nrel.get((root, vf), {}).items(), key=lambda x: -len(x[1])):
            rel.append([nl, tag, len(locs), locs[0]])
        entry["rel"] = rel
        stats["lemmas"] += 1
        if ntab == 0:
            stats["no_table_occ"] += 1
        if entry["check"]:
            stats["flagged"] += 1
        elif ntab:
            stats["verified"] += 1
        stats["mism_occ"] += sum(m[4] for m in mism)
        stats["mism_cells"] += len({(m[0], m[1]) for m in mism})
        stats["sub_bad"] += sub_bad
        stats["table_occ"] += ntab
        for t in ("past", "pres", "cmd"):
            if entry[t] is None:
                stats["null_" + t] += 1
        all_mism.extend(mism)
        for k in keys[lem]:
            files[k][lem] = entry
    for lem, forms in nouns.items():
        fl = [[t, gn, d, c, len(locs), locs[:5]] for (t, gn, d, c), locs in sorted(forms.items(), key=lambda x: -len(x[1]))]
        stats["nouns"] += 1
        for k in keys[lem]:
            if lem in files[k] and files[k][lem]["pos"] == "V":
                files[k][lem]["forms"] = fl
            else:
                files[k][lem] = {"pos": "N", "forms": fl}
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    total = 0
    for k, d in files.items():
        data = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        (OUT / f"{k}.json").write_text(data, encoding="utf8")
        total += len(data.encode("utf8"))
    lines = [
        "Word forms build report (tools/build_forms.py)",
        f"verb lemmas: {stats['lemmas']}",
        f"  fully verified (every PERF / IMPF-IND / IMPV active occurrence matches): {stats['verified']}",
        f"  flagged check=true: {stats['flagged']}",
        f"  with no table occurrence (only passive / subjunctive / jussive / energetic): {stats['no_table_occ']}",
        f"  table occurrences checked: {stats['table_occ']}; mismatching occurrences: {stats['mism_occ']} in {stats['mism_cells']} cells",
        f"  subjunctive/jussive occurrences (not in the table) not spelled by the rules: {stats['sub_bad']}",
        f"  lemmas with past unknown: {stats['null_past']}, present unknown: {stats['null_pres']}, command unknown: {stats['null_cmd']}",
        f"noun lemmas: {stats['nouns']}",
        f"files: {len(files)}, total {total / 1e6:.2f} MB",
        "",
        "Comparison spelling: see cmp_norm() and the docstring of tools/build_forms.py.",
        "What is left is mostly the corpus, not the rules: two verbs under one lemma (لَبَسَ/لَبِسَ، حَزَنَ/حَزِنَ،",
        "قَدَمَ/قَدِمَ، حَلَّ يَحِلُّ/يَحُلُّ، هَوَى/هَوِيَ), form IV words tagged VF 1 (أَغْنَىٰ، أَرَىٰ، أَبْقَىٰ), wrong tense or",
        "person tags (يَسْعَىٰ as PERF, دَعَانِ as 2MS), a merged nūn (تَأْمَ۫نَّا، مَكَّنِّى), and rare Quranic by-forms",
        "(يَخِصِّمُونَ، يَهِدِّىٓ، ٱدَّٰرَٰٔتُمْ، ٱقْتَدِهْ). None (generated) = the rules could not fix the vowels",
        "(the cell then shows the Quran spelling); otherwise the cell keeps the rule form and the word is in qx as .Q.",
        "",
        "Remaining mismatches: lemma, cell, generated, Quran (count, first place)",
    ]
    for lem, cell, g, t, n, lo in sorted(all_mism, key=lambda m: (m[0], m[1])):
        lines.append(f"{lem}\t{cell}\t{g}\t{t}\t{n}\t{lo}")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf8")
    print("\n".join(lines[:11]))


if __name__ == "__main__":
    main()
