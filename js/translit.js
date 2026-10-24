// Arabic → Hindi (Devanagari) transliteration, for readers who don't read Arabic letters yet. Rule-based on the
// fully voweled Uthmani text, read as each word is said on its own: ٱلَّذِينَ → अल्लज़ी-न, ذَٰلِكَ → ज़ालि-क.
// A final "-" marks a last short "a" that is said (Hindi would otherwise drop it).
const C = { ب: "ब", ت: "त", ث: "स", ج: "ज", ح: "ह", خ: "ख़", د: "द", ذ: "ज़", ر: "र", ز: "ज़", س: "स", ش: "श", ص: "स", ض: "ज़",
  ط: "त", ظ: "ज़", غ: "ग़", ف: "फ़", ق: "क़", ك: "क", ل: "ल", م: "म", ن: "न", ه: "ह", و: "व", ي: "य", ى: "य", ة: "त" };
const HAMZA = "ءأإؤئعٔ"; // carry a vowel but no consonant of their own (ع is said as a plain vowel in Hindi script)
const FA = "َ", KA = "ِ", DA = "ُ", SUK = "ْۡ", SH = "ّ", TA = "ً", TK = "ٍ", TD = "ٌ";
const DAGGER = "ٰ", SILENT = "۟", MADDA = "ٓ";
const MARK = { a: "", i: "ि", u: "ु", A: "ा", I: "ी", U: "ू", ai: "ै", au: "ौ" };
const FREE = { a: "अ", i: "इ", u: "उ", A: "आ", I: "ई", U: "ऊ", ai: "ऐ", au: "औ" };

export function deva(word) {
  const t = [...word.replace(/[ۖ-ۭـ]/g, (c) => (c === SILENT || c === "ۥ" || c === "ۦ" ? c : ""))];
  // units: one letter and its marks
  const u = [];
  for (const ch of t) {
    if (/[ً-ٰٓ۟ۥۦ]/.test(ch) && u.length && !"ۥۦ".includes(ch)) u[u.length - 1].m += ch;
    else u.push({ c: ch, m: "" });
  }
  let out = "", lastShortA = false;
  const vowelOf = (m) => (m.includes(FA) || m.includes(TA) ? "a" : m.includes(KA) || m.includes(TK) ? "i" : m.includes(DA) || m.includes(TD) ? "u" : "");
  for (let i = 0; i < u.length; i++) {
    const { c, m } = u[i], nx = u[i + 1], first = i === 0;
    if (m.includes(SILENT)) continue;
    if (c === "ۥ") { out = out.replace(/ु?$/, "ू"); lastShortA = false; continue; } // small waw after ه: هُۥ
    if (c === "ۦ") { out = out.replace(/ि?$/, "ी"); lastShortA = false; continue; }
    // the joining alif: said only at the start of the word
    if (c === "ٱ") { if (first) { out += nx && nx.c === "ل" ? "अ" : "इ"; lastShortA = false; } continue; }
    // ل of al- before a doubled (sun) letter is not said: ٱلرَّحْمَٰن → अर्रह्मान
    if (c === "ل" && !m && nx && nx.m.includes(SH) && i > 0 && u[i - 1].c === "ٱ") continue;
    let v = vowelOf(m);
    const tan = /[\u064B\u064C\u064D]/.test(m), nm = nx ? nx.m : "", bare = !nm.replace(/[\u0652\u06E1\u0653]/g, "");
    // long vowels written with the next letter
    if (m.includes(DAGGER)) v = "A";
    else if (tan) { /* -an, -in, -un: the alif or ى after it is silent */ }
    else if (v === "a" && nx && "وىي".includes(nx.c) && nm.replace(MADDA, "") === DAGGER) { v = "A"; i++; } // صَلَوٰة, ءَاتَىٰ
    else if (v === "a" && nx && (nx.c === "ا" || nx.c === "آ") && !vowelOf(nm)) { v = "A"; i++; }
    else if (v === "a" && nx && nx.c === "ى" && !nm) { v = "A"; i++; }
    else if (v === "i" && nx && "يى".includes(nx.c) && bare) { v = "I"; i++; }
    else if (v === "u" && nx && nx.c === "و" && bare) { v = "U"; i++; }
    else if (v === "a" && nx && "يى".includes(nx.c) && nm && bare) { v = "ai"; i++; }
    else if (v === "a" && nx && nx.c === "و" && nm && bare) { v = "au"; i++; }
    // letters that only lengthen: a bare alif, alif maqsura, a bare و/ي after a long vowel
    if ("اى".includes(c) && !vowelOf(m)) { if (first) out += "अ"; continue; }
    if (c === "آ") { out += first || !out ? "आ" : "ा"; lastShortA = false; continue; }
    let s;
    if (HAMZA.includes(c) || (c === "ا" && v)) {
      // a vowel on its own: अ इ उ आ…; after a sukūn mid-word it's still a fresh vowel
      s = v ? FREE[v] : out ? "अ्" : "अ";
      if (!v) { out += s; lastShortA = false; continue; }
    } else {
      const k = c === "ة" && !v ? "ह" : C[c];
      if (!k) continue;
      const dbl = m.includes(SH) && out ? k + "्" : ""; // doubled, except at the start of the word
      const sukun = /[ْۡ]/.test(m) || (!v && !tan);
      s = dbl + k + (v ? MARK[v] : sukun && nx ? "्" : "");
    }
    if (tan) s += "न";
    if (tan && nx && "اى".includes(nx.c)) i++;
    out += s;
    lastShortA = v === "a" && !tan;
  }
  // Allah
  if (/ل\u0650?ل[\u064E\u0651]{2}ه/.test(word)) out = out.replace("ल्लह", "ल्लाह");
  // a last short "a" is said: mark it so Hindi readers don't drop it
  if (lastShortA && out.length > 1) out = out.replace(/([क-ह]़?)$/, "-$1");
  return out.replace(/्$/, "");
}
