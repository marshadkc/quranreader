// Quran Word Reader: sūrah sidebar, reader with fading meanings, āyah and word search,
// practice quiz, word parts and the Ayah Honeycomb.
import { renderHive } from "./hive.js";
import { formsOf, formsHTML, formLabel, formHL, trickOf, switchQuestion } from "./forms.js";
import { mushaf, tajweedGuide } from "./mushaf.js";
import { deva } from "./translit.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");

// ---------- storage (works without localStorage, e.g. private windows) ----------
// Progress belongs to a profile, so a teacher can test a class under its own profile and clear it without
// touching their own. The first profile keeps the original keys; others are stored under "qwr.p.<id>.".
const raw = {
  get(k, d) { try { const v = localStorage.getItem("qwr." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("qwr." + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem("qwr." + k); } catch { /* ignore */ } },
};
// read before anything is stored: a device that has never opened the app gets no "updated" notice
const FIRST_VISIT = (() => { try { for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).startsWith("qwr.")) return false; } catch { /* ignore */ } return true; })();
const MINE = /^(shape|moved|level|honey|lastPrac|hiveSrc|hiveScope|upto\.\d+|prac\.\d+)$/;
export const profiles = { list: () => raw.get("profiles", [{ id: "", name: "Me" }]), active: () => raw.get("profile", "") };
const scoped = (k) => { const id = profiles.active(); return id && MINE.test(k) ? `p.${id}.${k}` : k; };
export const store = { get: (k, d) => raw.get(scoped(k), d), set: (k, v) => raw.set(scoped(k), v), del: (k) => raw.del(scoped(k)) };
// every stored key of a profile, to clear or delete it
const profileKeys = (id) => {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i).slice(4); if (id ? k.startsWith(`p.${id}.`) : MINE.test(k)) out.push(k); } } catch { /* ignore */ }
  return out;
};

export const state = {
  // the meaning languages shown under each word, at most two of en, ur, hi; none = hidden, to test yourself
  langs: store.get("langs", null) || ({ en: ["en"], ur: ["ur"], none: [] })[store.get("lang", "both")] || ["en", "ur"],
  level: store.get("shape", null),     // word shape (shapeKey) -> 0 new, 1 learning, 2 almost, 3 known
  honey: store.get("honey", 0),
  combo: 0,
  script: store.get("script", "ar"),  // the word itself in Arabic letters, Hindi letters (transliteration), or both
};
// A word as the reader asked to see it: Arabic, its sound in Hindi letters, or both
const wordFace = (w) => `<span class="face">${state.script !== "hi" ? `<span class="ar">${arHTML(w)}</span>` : ""}${state.script !== "ar" ? `<span class="dv" lang="hi">${esc(deva(w.t))}</span>` : ""}</span>`;
// under the big Arabic word on the card and in quizzes, when the reader uses Hindi letters
const dvLine = (w) => (state.script !== "ar" ? `<div class="dv big" lang="hi">${esc(deva(w.t))}</div>` : "");
// quizzes ask the word as the reader reads it: only Hindi letters with हिंदी लिपि, both with Both
export const quizWordHTML = (w) => (state.script === "hi" ? "" : `<div class="ar big">${arHTML(w)}</div>`) + dvLine(w);
// a word or letter inline (Honeycomb cells, feedback): Hindi letters with हिंदी लिपि, else Arabic
export const wordSpan = (t, cls = "") => (state.script === "hi" ? `<span class="dv ${cls}" lang="hi">${esc(deva(t))}</span>` : `<span class="ar ${cls}">${esc(t)}</span>`);
// the āyah around a quiz word, the word itself underlined
export const ctxHTML = (a, w) => `<div class="ctx${state.script === "hi" ? " dv" : ""}">${a.w.map((x) => { const t = esc(state.script === "hi" ? deva(x.t) : x.t); return x === w ? `<b>${t}</b>` : t; }).join(" ")}</div>`;
const SCRIPTS = [["ar", "عربی"], ["hi", "हिंदी लिपि"], ["both", "Both"]];
const scriptHTML = () => `<div class="seg" aria-label="Show the words in">${SCRIPTS.map(([k, n]) => `<button data-script="${k}" aria-pressed="${state.script === k}">${n}</button>`).join("")}</div>`;
// A word's level belongs to its shape: the base word as written without vowels, case endings, prefixes or
// attached pronouns, but with a verb's subject ending (he / they denied). So رَبُّ, رَبِّكَ and وَرَبُّنَا share one level, but the plural أَرْبَابًا is a new shape to learn
// where it occurs. Must match shape_key() in tools/build_shapes.py.
const shapeNorm = (t) => t.replace(/(?<![ىي])\u0670/g, "ا").replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "").replace(/[ٱأإآىئؤةۥۦ]/g, (c) => FOLD[c]).replace(/[^\u0621-\u064a]/g, "");
// a verb's subject ending (he / they / you / we) belongs to its shape; object pronouns (him, them…) do not
const SUBJECT = { "وا": "و", "و": "و", "ون": "و", "نا": "نا", "ن": "ن", "تم": "تم", "تمو": "تم", "تما": "تما", "تن": "تن", "ت": "ت", "ي": "ي", "ا": "ا", "ان": "ان", "ءو": "و" };
const subjectOf = (w) => {
  if (w.pos !== "V") return "";
  let i = w.p.map((y) => y[1]).lastIndexOf("s") + 1;
  if (w.p[i] && w.p[i][2] === "nna") i++; // the stressing -nna is not the subject
  const x = w.p[i];
  return !x || x[2] === "pron-1S" ? "" : SUBJECT[shapeNorm(x[0])] || "";
};
const shapeKey = (w) => {
  let n = shapeNorm(w.p.filter((x) => x[1] === "s").map((x) => x[0]).join("").replace(/\u064b[\u0670\u06e2\u06ed]?[اى]$|[اى]\u064b$/, ""));
  if (w.pos !== "V" && n.endsWith("ت") && !shapeNorm(w.l).endsWith("ت")) n = n.slice(0, -1) + "ه";
  if (w.pos !== "V" && n.endsWith("ون") && !shapeNorm(w.l).endsWith("ون")) n = n.slice(0, -2) + "ين";
  return w.l + "|" + n + subjectOf(w);
};
export const lv = (w) => state.level[w.k] || 0;
export const setLevel = (w, n) => { state.level[w.k] = Math.max(0, Math.min(3, n)); store.set("shape", state.level); };
export function addHoney(n) { state.honey += n; store.set("honey", state.honey); $("#jar").textContent = state.honey; }
const LABEL = ["new", "learning", "almost", "known"];
const VERSION_NO = 39; // keep in step with VERSION in sw.js
// What's new, shown once after the app updates on a device (newest first; add a line with each version)
const CHANGES = {
  39: ["🌙 / ☀️ at the top switches between dark and light, whatever your phone is set to.", "Words in Hindi letters: above the āyāt, pick हिंदी लिपि to see how each Arabic word sounds written in Hindi, or Both to see it under the Arabic. With हिंदी लिपि the quizzes and the Honeycomb show the words in Hindi letters too.", "Mushaf pages now have a printed muṣḥaf's blue border, with the sūrah, para and page in frames."],
  38: ["Read in Mushaf now uses the 15-line ḥifẓ muṣḥaf (610 pages, every page ends on an āyah).", "Mushaf: tapping a word opens its word card right on the page, and Close brings you back to the same page.", "Mushaf: the page buttons sit just above and below the page.", "Tajweed colours guide: in the Mushaf, tap a colour or \"What do the colours mean?\" to see how each rule is read, with examples you can open on their page."],
  37: ["Read in Mushaf: tap 📖 Read in Mushaf beside the language buttons to read the Indo-Pak 16-line muṣḥaf, one page at a time, with tajweed in colour (ghunna, ikhfa, iqlab, idgham, qalqala, madd). Tap a word there for its meaning and its word card.", "Every place a word occurs: each āyah now has buttons to go to it in the sūrah or in the Mushaf.", "Word card: 📖 In the Mushaf shows the word on its muṣḥaf page."],
  35: ["The home page now says: Learn to read the Quran without translation."],
  34: ["The Word forms section on the word card is now a clear button: tap Show to open it.", "Honeycomb Two teams: with \"Meanings + Form Switch\", each team now gets a meaning question and a Form Switch question in turn, and nouns are asked too."],
  33: ["Form Switch: a new quiz that turns each word into another form: a verb into another person or tense, a noun into one, two or many (on every sūrah page).", "Two teams in Honeycomb can now ask word forms too.", "Word forms on the word card: how each verb and noun changes, with the easy trick for each.", "This notice, so you know when the app has updated."],
  32: ["Āyah translations under each āyah in English, Urdu and Hindi."],
};

// ---------- data ----------
let INDEX = null, ROOTS = null, FORMS = null, CORE = null;
const SURAH = new Map();
const json = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
export async function index() {
  if (!INDEX) INDEX = await json("data/surahs.json");
  return INDEX;
}
// The core meaning of each root, quoted from the classical dictionaries (loaded when a word card first opens)
const core = () => (CORE ||= json("data/core.json").catch(() => { CORE = null; return {}; }));
export async function surah(n) {
  if (!SURAH.has(n)) {
    const d = await json(`data/s/${String(n).padStart(3, "0")}.json`);
    d.ayahs.forEach((a) => a.w.forEach((w, i) => { w.s = n; w.a = a.n; w.i = i; w.k = shapeKey(w); }));
    SURAH.set(n, d);
  }
  return SURAH.get(n);
}
const roots = async () => (ROOTS ||= await json("data/index/roots.json"));
const forms = async () => (FORMS ||= await json("data/index/forms.json"));

// ---------- word meanings (English, Urdu and Hindi) ----------
// They are bundled in data/s/NNN.json from glosses/ (imported from Quran.com with tools/import_meanings.py).
// If a sūrah or language has none bundled, they are fetched live from the Quran.com API instead and kept
// on the device for at most 7 days, as Quran Foundation's developer terms ask for live use.
const WBW_API = "https://api.quran.com/api/v4/verses/by_chapter/";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const LANGS = ["en", "ur", "hi"];
export const CREDIT = `<p class="note credit">Word meanings from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>'s word-by-word translations; Urdu by Dr. Farhat Hashmi (Al-Huda International); Hindi by Al-Huda International, with English where Quran.com has no Hindi for a word. Āyah translations: Saheeh International (English), Fateh Muhammad Jalandhari (Urdu) and Maulana Azizul Haque al-Umari (Hindi). Quran data provided by Quran Foundation.</p>`;
const LIVE = new Map(); // "lang.sūrah" -> { at, p: promise of { ayah: [meanings] } or null }
const cleanText = (s) => String(s || "").replace(/<sup[^>]*>.*?<\/sup>|<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function liveMeanings(n, lang) {
  const key = `${lang}.${n}`, mem = LIVE.get(key);
  if (mem && Date.now() - mem.at < WEEK) return mem.p;
  const saved = store.get(key, null);
  if (saved && Date.now() - saved.at < WEEK) { LIVE.set(key, { at: saved.at, p: Promise.resolve(saved.ayahs) }); return LIVE.get(key).p; }
  if (saved) store.del(key);
  const p = (async () => {
    const ayahs = {};
    for (let page = 1; page; ) {
      const r = await fetch(`${WBW_API}${n}?words=true&language=${lang}&per_page=50&page=${page}&fields=verse_number&word_fields=char_type_name`);
      if (!r.ok) throw new Error(`Quran.com answered ${r.status}`);
      const d = await r.json();
      for (const v of d.verses) ayahs[v.verse_number] = v.words.filter((w) => w.char_type_name === "word").map((w) => cleanText(w.translation && w.translation.text));
      page = d.pagination && d.pagination.next_page;
    }
    store.set(key, { at: Date.now(), ayahs });
    return ayahs;
  })().catch(() => { LIVE.delete(key); return null; }); // offline: try again next time
  LIVE.set(key, { at: Date.now(), p });
  return p;
}
// A sūrah with its meanings attached. Āyāt whose word count differs from ours are left without, so no meaning lands on the wrong word.
export async function withMeanings(n) {
  const d = await surah(n);
  d.live ||= {};
  const bundled = (lang) => d.ayahs.some((a) => a.w.some((w) => w[lang]));
  await Promise.all(LANGS.filter((lang) => !d.live[lang] && !bundled(lang)).map(async (lang) => {
    const m = await liveMeanings(n, lang);
    if (!m) return;
    for (const a of d.ayahs) {
      const ms = m[a.n];
      if (ms && ms.length === a.w.length) a.w.forEach((w, i) => { if (!w[lang] && ms[i]) w[lang] = ms[i]; });
    }
    d.live[lang] = true;
  }));
  return d;
}
const fromQuranCom = (d) => d.ayahs.some((a) => a.w.some(hasMeaning));

export const arN = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const arHTML = (w) => w.p.map(([t, k]) => (k === "s" ? esc(t) : `<span class="${k}">${esc(t)}</span>`)).join("");
export const hasMeaning = (w) => !!(w.en || w.ur);
export const meaningOf = (w, lang) => w[lang] || w.en || w.ur || "";
export const LANG_NAME = { en: "English", ur: "اردو", hi: "हिंदी" };

// Search spelling, the same as norm() in tools/build_data.py, plus Urdu/Persian keyboard letters
const FOLD = { "ٱ": "ا", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ۥ": "", "ۦ": "", "ی": "ي", "ے": "ي", "ک": "ك", "ہ": "ه", "ۃ": "ه", "ھ": "ه" };
export const norm = (t) => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/[ٱأإآىئؤةۥۦیےکہۃھ]/g, (c) => FOLD[c]).replace(/[^ء-ي]/g, "");
const spaced = (r) => [...r].join(" ");
const keyLabel = (k) => (k.startsWith("=") ? k.slice(1) : spaced(k));

// Progress: every right answer (or "I know this") moves a word shape one step up, and three steps make it known.
// The percent shown is the share of words known, so it always agrees with the "N of M words known" count.
// The lighter part of the bar is every step made so far (out of three per word), so it grows with each answer.
// A word learned anywhere counts wherever that same shape occurs.
const pctOf = (x) => (x >= 99.95 ? 100 : x >= 10 || x === 0 ? Math.round(x) : Math.round(x * 10) / 10);
const share = (part, whole) => (whole ? pctOf((part / whole) * 100) : 0);
function progressOf(ws) {
  let known = 0, learning = 0, steps = 0;
  for (const w of ws) { const k = lv(w); steps += k; if (k >= 3) known++; else if (k) learning++; }
  return { known, learning, pct: share(known, ws.length), way: share(steps, 3 * ws.length) };
}
const barHTML = (p, id = "") => `<div class="fill way"${id ? ` id="${id}way"` : ""} style="width:${p.way}%"></div><div class="fill"${id ? ` id="${id}"` : ""} style="width:${p.pct}%"></div>`;
// where each word shape occurs, so the home page can show every sūrah's progress without loading them all
let SHAPES = null;
const shapes = () => (SHAPES ||= json("data/index/shapes.json").then((d) => {
  const m = new Map();
  for (const [k, v] of Object.entries(d)) m.set(k, v.split(",").map((x) => { const [n, c] = x.split(":"); return [+n, +c || 1]; }));
  return m;
}).catch(() => { SHAPES = null; return new Map(); }));
async function quranProgress(idx) {
  const m = await shapes(), steps = new Map(), known = new Map();
  const add = (map, n, x) => map.set(n, (map.get(n) || 0) + x);
  for (const [key, k] of Object.entries(state.level)) {
    if (!k) continue;
    for (const [n, c] of m.get(key) || []) { add(steps, n, k * c); add(steps, 0, k * c); if (k >= 3) { add(known, n, c); add(known, 0, c); } }
  }
  const total = idx.surahs.reduce((t, s) => t + s.words, 0);
  const of = (n, words) => ({ pct: share(known.get(n) || 0, words), way: share(steps.get(n) || 0, 3 * words) });
  return { all: of(0, total), surah: (n) => of(n, idx.surahs[n - 1].words) };
}
// Levels used to belong to the base word. Carry them over to that word's shapes in the sūrahs the learner
// worked on (Al-Fātiḥah, Juz ʿAmma and any sūrah practised), so a new shape elsewhere still starts as new.
async function migrateLevels() {
  if (state.level) return;
  const old = store.get("level", {}), level = {};
  if (Object.keys(old).length) {
    const worked = new Set([1, ...Array.from({ length: 37 }, (_, i) => 78 + i)]);
    for (let n = 1; n <= 114; n++) if (store.get("upto." + n, 0) || store.get("prac." + n, null)) worked.add(n);
    const m = await shapes();
    if (!m.size) { state.level = {}; return; } // offline: try again next time
    for (const [key, where] of m) {
      const k = old[key.slice(0, key.indexOf("|"))];
      if (k && where.some(([n]) => worked.has(n))) level[key] = k;
    }
  }
  state.level = level; store.set("shape", level);
}
// Word parts added on 2026-10-16 (كُمَا, ـنَّ, تَ, أَ, the و of وَلَٰكِنْ…) changed some words' shapes. Carry each
// learner's level from the old shape to the new one, once (data/index/moved.json: old shape -> new shape).
async function moveShapes() {
  if (store.get("moved", 0) >= 1 || !Object.keys(state.level).length) return store.set("moved", 1);
  const m = await json("data/index/moved.json");
  for (const [from, to] of Object.entries(m)) {
    if (from in state.level) state.level[to] = Math.max(state.level[to] || 0, state.level[from]); // the old key is kept: a few shapes still exist
  }
  store.set("shape", state.level); store.set("moved", 1);
}
const allWords = (d) => d.ayahs.flatMap((a) => a.w);
const place = (x) => ({ s: Math.floor(x / 1e6), a: Math.floor(x / 1000) % 1000, w: x % 1000 });

// ---------- sidebar ----------
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʿʾ'’\-\s]/g, "").toLowerCase();
async function sidebar() {
  const idx = await index();
  $("#surahs").innerHTML = idx.surahs.map((s) => `<li data-n="${s.n}" data-q="${esc(fold(s.en) + "|" + fold(s.meaning) + "|" + norm(s.ar))}">
    <a href="#/s/${s.n}"><span class="sn">${s.n}</span>
    <span class="nm">${esc(s.en)}<small>${esc(s.meaning)} · ${s.ayahs} āyāt</small></span>
    <span class="an">${esc(s.ar)}</span></a></li>`).join("");
  activeSurah(route.surah);
}
function activeSurah(n) {
  document.querySelectorAll("#surahs a").forEach((a) => {
    if (+a.parentNode.dataset.n === n) { a.setAttribute("aria-current", "page"); a.scrollIntoView({ block: "nearest" }); }
    else a.removeAttribute("aria-current");
  });
}
function drawer(open) {
  $("#side").classList.toggle("open", open);
  $("#scrim").hidden = !open;
  $("#menu").setAttribute("aria-expanded", open);
  if (open && matchMedia("(max-width:899px)").matches) $("#filter").focus({ preventScroll: true });
}
$("#menu").onclick = () => drawer(!$("#side").classList.contains("open"));
$("#scrim").onclick = () => drawer(false);
$("#surahs").onclick = (e) => { if (e.target.closest("a")) drawer(false); };
addEventListener("keydown", (e) => { if (e.key === "Escape") drawer(false); });
$("#filter").oninput = (e) => {
  const raw = e.target.value.trim(), q = fold(raw), qa = norm(raw);
  document.querySelectorAll("#surahs li").forEach((li) => {
    const [en, meaning, ar] = li.dataset.q.split("|");
    li.hidden = !!raw && !(/^\d+$/.test(raw) ? li.dataset.n.startsWith(raw) : (q && (en.includes(q) || meaning.includes(q))) || (qa && ar.includes(qa)));
  });
};

// ---------- reading: word cards, the word sheet, fading meanings ----------
// One reading view is open at a time: its words in order, and the selected word
let view = { ws: [], sel: null, prog: null };

function wordHTML(w, k, idx) {
  const pl = w.p.filter((x) => x[1] !== "s").map((x) => (idx.parts[x[2]] || {}).en).filter((x) => x && x !== "—");
  return `<button class="w lv${hasMeaning(w) ? lv(w) : 0}" data-k="${k}">${wordFace(w)}
    <span class="gl">${pl.length ? `<span class="parts">${esc(pl.join(" + "))}</span>` : ""}${w.en ? `<span class="en">${esc(w.en)}</span>` : ""}${w.ur ? `<span class="ur">${esc(w.ur)}</span>` : ""}${hiSpan(w)}</span></button>`;
}
// Hindi under a word; where Quran.com has none (small words like مِن), the English, hidden when English shows anyway
const hiSpan = (w) => (w.hi || w.en ? `<span class="hi${w.hi ? "" : " fb"}" lang="hi">${esc(w.hi || w.en)}</span>` : "");
const has = (ws, l) => ws.some((w) => w[l]);
const anyUrdu = (ws) => has(ws, "ur");
// the meaning languages this set of words can show, in the switch's order
const langsOf = (ws) => LANGS.filter((l) => l === "en" || has(ws, l));
// Quiz answers are in English, Urdu or Hindi, switchable inside the practice and the Honeycomb.
// The first time, they follow the reader's first language.
export const quizLang = (ws) => { const l = store.get("quizLang", state.langs[0] || "en"); return langsOf(ws).includes(l) ? l : "en"; };
export const quizLangHTML = (ws) => langsOf(ws).length < 2 ? "" : `<div class="seg" aria-label="Answers in">
  ${langsOf(ws).map((l) => `<button data-qlang="${l}" aria-pressed="${quizLang(ws) === l}">${LANG_NAME[l]}</button>`).join("")}</div>`;
// After a wrong answer, the meaning is shown in the reader's languages and the answer language, so they are learnt together
export const bothHTML = (w) => {
  const ls = new Set([...(state.langs.length ? state.langs : ["en", "ur"]), store.get("quizLang", "en")]);
  return LANGS.filter((l) => ls.has(l) && w[l]).map((l) => `<strong class="${l === "en" ? "" : l}">${esc(w[l])}</strong>`).join(" · ") || `<strong>${esc(w.en || "")}</strong>`;
};
export const setQuizLang = (b) => { store.set("quizLang", b.dataset.qlang); document.querySelectorAll("[data-qlang]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.qlang === b.dataset.qlang)); };
// Wrong answers: other words whose meaning differs from the right one, and from each other, in both
// languages, so the options stay distinct whichever language they are shown in. Never the same word
// (same shape or base word) met elsewhere: عَلَىٰ is "to" in 18:1 but "on" elsewhere, and "on" must not
// show as a wrong answer.
const sameWord = (x, w) => x.k === w.k || (!!x.l && x.l === w.l);
export function distractors(w, pool, k = 3) {
  const used = Object.fromEntries(LANGS.map((l) => [l, new Set([w[l]].filter(Boolean))])), out = [];
  for (const x of [...pool].sort(() => Math.random() - 0.5)) {
    if (out.length === k) break;
    if (!hasMeaning(x) || sameWord(x, w) || LANGS.some((l) => x[l] && used[l].has(x[l])) || meaningOf(x, "en") === meaningOf(w, "en")) continue;
    out.push(x); LANGS.forEach((l) => x[l] && used[l].add(x[l]));
  }
  return out;
}
// "Practise up to here": a round from the āyah after the last one practised to this one. An āyah already
// practised gets a round of just itself, so the earlier āyāt are never pulled back in.
const upto = (n) => store.get("upto." + n, 0);
const practiseLink = (n, a) => {
  const again = a <= upto(n), f = again ? a : upto(n) + 1;
  return `<a class="btn small practise-here" href="#/s/${n}/practise/${f}-${a}">Practise ${f === a ? `āyah ${a}${again ? " again" : ""}` : `āyāt ${f}–${a}`}</a>`;
};
// The āyah's full translation, one line per language; the reader's switch hides the ones not chosen
const ayahLines = (a) => LANGS.filter((l) => a[l]).map((l) => `<span class="${l}" lang="${l}">${esc(a[l])}</span>`).join("");
// the same, for places outside the reader: just the reader's languages (English and Urdu when meanings are hidden)
export const ayahHTML = (a) => (state.langs.length ? state.langs : ["en", "ur"]).filter((l) => a[l]).map((l) => `<div class="${l}" lang="${l}">${esc(a[l])}</div>`).join("");
function versesHTML(ayahs, idx, practiseIn) {
  let k = 0;
  return `<div class="verses${versesClass(ayahs.flatMap((a) => a.w))}" id="verses">
    ${ayahs.map((a) => {
      const faded = a.w.every((w) => lv(w) >= 2);
      return `<article class="verse" id="a${a.n}"><div class="words">${a.w.map((w) => wordHTML(w, k++, idx)).join("")}
        <span class="vn">﴿${arN(a.n)}﴾</span></div>
        ${LANGS.some((l) => a[l]) ? `<div class="meaning${faded ? " faded" : ""}">${ayahLines(a)}</div>` : ""}
        ${practiseIn && a.w.some(hasMeaning) ? practiseLink(practiseIn, a.n) : ""}
      </article>`;
    }).join("")}</div><div id="sheetbox"></div>`;
}
// The meanings shown: the reader's languages this sūrah has (English if it has none of them), or none
const readLangs = (ws) => { const ls = state.langs.filter((l) => langsOf(ws).includes(l)); return ls.length || !state.langs.length ? ls : ["en"]; };
const versesClass = (ws) => { const ls = readLangs(ws); return ls.length ? LANGS.filter((l) => !ls.includes(l)).map((l) => " hide-" + l).join("") : " no-meaning"; };
// Up to two languages at once: picking a third drops the one picked first; None hides them all
const langHTML = (ws) => `<div class="seg" aria-label="Meaning languages">
  ${[...langsOf(ws), "none"].map((l) => `<button data-lang="${l}" aria-pressed="${l === "none" ? !readLangs(ws).length : readLangs(ws).includes(l)}">${LANG_NAME[l] || "None"}</button>`).join("")}</div>`;
function pickLang(l) {
  const ls = state.langs.filter((x) => x !== l);
  state.langs = l === "none" ? [] : state.langs.includes(l) ? ls : [...ls, l].slice(-2);
  store.set("langs", state.langs);
}

// Root meaning: a short line in the reader's language where one is approved, then the dictionaries' own words
const BOOKS = { l: ["lisan", "Ibn Manẓūr, Lisān al-ʿArab"], m: ["maqayees", "Ibn Fāris, Maqāyīs al-Lugha"], r: ["mufradat-ragheb", "al-Rāghib, al-Mufradāt"] };
// The dictionaries in the root card's list, the default first. For each root, data/root/ROOT.json holds every
// dictionary's meaning summed up in English and Urdu, with the exact phrase from its entry that the summary rests
// on (built by tools/build_core.py from the entries on tafsir.app). al-Muʿjam al-Ishtiqāqī is a modern book still
// under copyright, so it is only linked.
const DICTS = [
  ["m", "maqayees", "Maqāyīs al-Lugha", "Ibn Fāris (d. 395)"],
  ["r", "mufradat-ragheb", "al-Mufradāt", "al-Rāghib al-Iṣfahānī (d. 502)"],
  ["l", "lisan", "Lisān al-ʿArab", "Ibn Manẓūr (d. 711)"],
  ["s", "alsihah", "al-Ṣiḥāḥ", "al-Jawharī (d. 393)"],
  ["q", "qamoos", "al-Qāmūs al-Muḥīṭ", "al-Fīrūzābādī (d. 817)"],
  ["b", "basair-tamyeez", "Baṣāʾir Dhawī al-Tamyīz", "al-Fīrūzābādī (d. 817)"],
  ["u", "umdah-alhufadh", "ʿUmdat al-Ḥuffāẓ", "al-Samīn al-Ḥalabī (d. 756)"],
  ["i", "ishtiqaqi", "al-Muʿjam al-Ishtiqāqī", "Muḥammad Ḥasan Jabal (d. 2015)"],
];
const MEANS = new Map();
const rootOf = (r) => { if (!MEANS.has(r)) MEANS.set(r, json(`data/root/${encodeURIComponent(r)}.json`).catch(() => { MEANS.delete(r); return {}; })); return MEANS.get(r); };
// English and/or Urdu, following the reader's languages (English when only Hindi is picked: there is no Hindi summary)
const gistHTML = (en, ur) => { const ls = state.langs.filter((l) => l !== "hi"); return ["en", "ur"].filter((l) => (l === "en" ? en : ur) && (!ls.length || ls.includes(l) || (l === "en" && !ur))); };
const gistLines = (en, ur) => gistHTML(en, ur).map((l) => l === "ur" ? `<div class="ur" dir="rtl">${esc(ur)}</div>` : `<div><strong>${esc(en)}</strong></div>`).join("");
function coreHTML(c, r) {
  if (!c) return "";
  const quotes = (c.q || []).map(([k, t, form]) =>
    `<div class="q"><span class="ar" dir="rtl">${esc(t)}</span> <a class="note" href="https://tafsir.app/${BOOKS[k][0]}/${encodeURIComponent(form)}" target="_blank" rel="noopener">${BOOKS[k][1]}</a></div>`).join("");
  return `<div class="eyebrow">Root meaning</div>${gistLines(c.en, c.ur)}${quotes}`;
}
// the word card's root meaning: a dictionary list, and the chosen dictionary's meaning in English and Urdu
function rootHTML(d, r, k) {
  const ks = DICTS.filter(([x]) => d[x] || x === "i").map(([x]) => x);
  if (!ks.includes(k)) k = ks[0];
  const [, src, name, by] = DICTS.find((x) => x[0] === k);
  const [en, ur, t, form] = d[k] || [];
  const link = `<a class="note" href="https://tafsir.app/${src}/${encodeURIComponent(form || r)}" target="_blank" rel="noopener">full entry on tafsir.app</a>`;
  const body = k === "i"
    ? `<p class="note">${esc(name)} is a modern book still under copyright, so it is not copied into this app. Read its entry on tafsir.app.</p><div>${link}</div>`
    : `${gistLines(en, ur)}<div class="q"><span class="ar" dir="rtl">${esc(t)}</span></div>
       <div class="note">${esc(by)}, ${esc(name)}${form && form !== r ? `, under <span class="ar">${esc(spaced(form))}</span>` : ""} · ${link}</div>`;
  return `<div class="eyebrow">Root meaning</div>
    <label class="dpick"><span class="note">Dictionary</span><select data-dict>${ks.map((x) => { const n = DICTS.find((y) => y[0] === x)[2];
      return `<option value="${x}" ${x === k ? "selected" : ""}>${esc(n)}${x === "i" ? " (link)" : ""}</option>`; }).join("")}</select></label>${body}`;
}
// the word card shows English, then the reader's other languages (Urdu when meanings are hidden)
const sheetLangs = () => (state.langs.length ? state.langs : ["ur"]);
function sheetHTML(w, idx) {
  const parts = w.p.filter((x) => x[1] !== "s").map(([t, , key]) => {
    const g = idx.parts[key] || {};
    const more = sheetLangs().filter((l) => l !== "en" && g[l] && g[l] !== "—").map((l) => " · " + esc(g[l])).join("");
    return `<span class="chip"><span class="ar">${esc(t)}</span> = ${esc(g.en)}${more}</span>`;
  }).join(" ") || "None";
  const fam = [...new Set(view.ws.filter((x) => w.r && x.r === w.r && x.t !== w.t).map((x) => x.t))];
  const key = w.r || "=" + w.l;
  return `<div class="sheet" id="sheet">
    <div class="top2"><div><div class="eyebrow">${w.s}:${w.a} · word ${w.i + 1} · ${LABEL[lv(w)]}</div>
      <div><strong>${esc(w.en || "Meaning not added yet")}</strong></div>${sheetLangs().filter((l) => l !== "en" && w[l]).map((l) => `<div class="${l}" lang="${l}">${esc(w[l])}</div>`).join("")}</div>
      <div><div class="ar big">${arHTML(w)}</div>${dvLine(w)}</div></div>
    <dl class="kv"><dt>Parts</dt><dd>${parts}</dd>
      <dt>Base word</dt><dd><span class="ar" style="font-size:22px">${esc(w.l)}</span> <span class="note">· ${w.f} times in the Quran</span></dd>
      <dt>Root</dt><dd>${w.r ? `<span class="ar" style="font-size:22px">${esc(spaced(w.r))}</span>` : "None"}
      ${w.r ? `<div class="core" data-root="${esc(w.r)}"></div>` : ""}
      ${fam.length ? `<div class="note">Same root here: <span class="ar" style="font-size:20px">${fam.map(esc).join("، ")}</span></div>` : ""}</dd></dl>
    ${w.pos === "V" || w.pos === "N" ? `<details class="forms" data-fkey="${esc(w.r || "=" + norm(w.l))}" ${raw.get("formsOpen", false) ? "open" : ""}><summary><span class="lbl">Word forms<br><span class="note">${w.pos === "V" ? "How this verb changes: he, they, you… with the tricks" : "How this word changes: one, two, many…"}</span></span></summary><div class="fbody note">Loading…</div></details>` : ""}
    <div class="btns">${hasMeaning(w) ? `<button class="btn primary" data-act="know">I know this</button><button class="btn" data-act="again">Show meaning again</button>` : ""}
      <a class="btn" href="#/word/${encodeURIComponent(norm(w.l))}/${encodeURIComponent(key)}">${w.r ? "Every word from this root" : "Every place it occurs"}</a>
      ${view.mushaf ? `<a class="btn" href="#/s/${w.s}/${w.a}">Read this āyah word by word</a>` : `<a class="btn" href="#/mushaf/s/${w.s}/${w.a}/${w.i + 1}">📖 In the Mushaf</a>`}
      <button class="btn" data-act="close">Close</button></div></div>`;
}

// Click handling shared by the sūrah reader and the single-āyah view. Updates in place so long sūrahs stay fast.
function readingClick(e, idx) {
  const lb = e.target.closest("[data-lang]");
  if (lb) {
    pickLang(lb.dataset.lang);
    lb.closest(".seg").outerHTML = langHTML(view.ws);
    $("#verses").className = "verses" + versesClass(view.ws);
    app.querySelectorAll(".peek").forEach((x) => x.classList.remove("peek"));
    return;
  }
  const sb = e.target.closest("[data-script]");
  if (sb) {
    state.script = sb.dataset.script; store.set("script", state.script);
    sb.closest(".seg").outerHTML = scriptHTML();
    app.querySelectorAll(".w").forEach((b) => { b.querySelector(".face").outerHTML = wordFace(view.ws[+b.dataset.k]); });
    if (view.sel !== null) showCard(view.sel, idx);
    return;
  }
  // Meanings hidden: the first tap on a word, or on an āyah's translation, shows just that one
  const hidden = $("#verses").classList.contains("no-meaning");
  const m = e.target.closest(".meaning");
  if (hidden && m) { m.classList.toggle("peek"); return; }
  const btns = () => app.querySelectorAll(".w");
  const act = e.target.closest("[data-act]");
  if (act) {
    const w = view.ws[view.sel];
    cardAct(act, idx);
    if (act.dataset.act !== "close") btns().forEach((b) => { const x = view.ws[+b.dataset.k]; if (x.k === w.k) b.className = `w lv${hasMeaning(x) ? lv(x) : 0}`; });
    return;
  }
  const b = e.target.closest(".w"); if (!b) return;
  const k = +b.dataset.k, w = view.ws[k];
  if (hidden && !b.classList.contains("peek")) { b.classList.add("peek"); return; }
  if (hasMeaning(w) && lv(w) === 3 && !b.classList.contains("peek")) { b.classList.add("peek"); setLevel(w, 2); return; }
  btns().forEach((x) => x.classList.toggle("sel", +x.dataset.k === k));
  showCard(k, idx);
}

// The word card in #sheetbox for view.ws[k] (k null closes it). Used by the readers and the Mushaf.
export function showCard(k, idx) {
  view.sel = k;
  if (k === null) app.querySelectorAll(".w.sel,.mw.sel").forEach((b) => b.classList.remove("sel"));
  $("#sheetbox").innerHTML = k === null ? "" : sheetHTML(view.ws[k], idx);
  const fd = $("#sheetbox .forms");
  if (fd) {
    const w = view.ws[k];
    const fill = () => formsOf(fd.dataset.fkey).then((d) => {
      if (!fd.isConnected) return;
      const h = formsHTML(d, w, state.langs);
      if (h) fd.querySelector(".fbody").outerHTML = `<div class="fbody">${h}</div>`; else fd.remove();
    });
    fd.ontoggle = () => raw.set("formsOpen", fd.open);
    fill();
  }
  const box = $("#sheetbox .core");
  if (box) {
    const r = box.dataset.root;
    rootOf(r).then((d) => {
      if (!box.isConnected) return;
      const show = () => { box.innerHTML = rootHTML(d, r, raw.get("dict", "m")); };
      box.onchange = (e) => { if (e.target.dataset.dict !== undefined) { raw.set("dict", e.target.value); show(); } };
      show();
    });
  }
}
// the card's buttons: I know this, Show meaning again, Close
export function cardAct(act, idx) {
  const w = view.ws[view.sel];
  if (act.dataset.act === "know") setLevel(w, lv(w) + 1);
  if (act.dataset.act === "again") setLevel(w, 0);
  if (act.dataset.act !== "close" && view.prog) view.prog();
  showCard(null, idx);
}
// the Mushaf opens a word's card under its page: the āyah's words become the card's words
export function mushafCard(ws, k, idx) { view = { ws, sel: null, prog: null, mushaf: true }; showCard(k, idx); }

// ---------- views ----------
async function home() {
  const idx = await index(), p = await quranProgress(idx);
  const total = idx.surahs.reduce((t, s) => t + s.words, 0);
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Course · the whole Quran · 114 sūrahs · ${total.toLocaleString()} words</div>
      <h1>Learn to read the Quran without translation</h1>
      <p class="sub">Each word's meaning sits under it and fades as you learn it. Practise, and watch the page turn into plain Arabic. <a href="#/about">How to learn</a></p>
      <div class="row"><span>Words of the Quran you know</span><strong>${p.all.pct}%</strong></div>
      <div class="track">${barHTML(p.all)}</div>
    </section>
    <div class="row"><span class="note">Every right answer moves a word one step (the lighter bar); three steps and it is known. A word you know counts wherever it occurs. <a href="#/search">Search</a> finds any āyah, or every place a word occurs.</span></div>
    <ul class="list">
      ${idx.surahs.map((s) => {
        const sp = p.surah(s.n);
        return `<li><a href="#/s/${s.n}"><span class="num">${s.n}</span>
          <span class="name">${esc(s.en)} <small>${esc(s.meaning)} · ${s.ayahs} āyāt · ${s.words.toLocaleString()} words${sp.way ? ` · ${sp.pct}% known` : ""}</small>
          <span class="mini"><i class="way" style="width:${sp.way}%"></i><i style="width:${sp.pct}%"></i></span></span>
          <span class="arname">${esc(s.ar)}</span></a></li>`;
      }).join("")}
    </ul>`;
}

async function reader(n, focus) {
  const idx = await index(), meta = idx.surahs.find((s) => s.n === n);
  if (!meta) throw new Error(`there is no sūrah ${n}`);
  const d = await withMeanings(n), ws = allWords(d), ready = ws.some(hasMeaning);
  const prog = () => {
    const p = progressOf(ws);
    $("#prog").innerHTML = `<span>Your progress in this sūrah${p.learning ? ` <small class="note">· ${p.learning.toLocaleString()} more on the way</small>` : ""}</span><strong>${p.pct}% · ${p.known.toLocaleString()} of ${ws.length.toLocaleString()} words known</strong>`;
    $("#progfill").style.width = p.pct + "%";
    $("#progfillway").style.width = p.way + "%";
  };
  view = { ws, sel: null, prog };
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Sūrah ${n} · ${meta.ayahs} āyāt · ${meta.words.toLocaleString()} words</div>
      <div class="row"><h1>${esc(meta.en)} <small class="note">${esc(meta.meaning)}</small></h1><span class="ar" style="font-size:30px">${esc(meta.ar)}</span></div>
      <div class="row" id="prog"></div>
      <div class="track">${barHTML({ pct: 0, way: 0 }, "progfill")}</div>
    </section>
    <div class="row"><span class="row">${langHTML(ws)}${scriptHTML()}<a class="btn mushaf-btn" href="#/mushaf/s/${n}/${focus || 1}">📖 Read in Mushaf</a></span>
      ${ready ? `<span class="row"><a class="btn primary" href="#/s/${n}/practise">Practise this sūrah</a><a class="btn" href="#/s/${n}/roots">Root challenge</a><a class="btn" href="#/s/${n}/forms">Form Switch</a></span>` : ""}</div>
    ${ready ? "" : `<div class="banner">Word meanings for this sūrah haven't loaded. Check your connection and try again. Tap any word to see its parts, base word and root.</div>`}
    ${versesHTML(d.ayahs, idx, n)}
    ${fromQuranCom(d) ? CREDIT : ""}`;
  prog();
  app.onclick = (e) => readingClick(e, idx);
  const el = focus && document.getElementById("a" + focus);
  if (el) { el.classList.add("flash"); el.scrollIntoView({ block: "start" }); return true; }
}

// One āyah on its own, from "Go to an āyah" or a search result. w = a word to open straight away.
async function ayahView(s, a, w) {
  const idx = await index(), meta = idx.surahs.find((x) => x.n === s);
  if (!meta || a < 1 || a > meta.ayahs) {
    app.innerHTML = `<div class="banner">${meta ? `${esc(meta.en)} has ${meta.ayahs} āyāt, so there is no āyah ${a}.` : `There is no sūrah ${s}. The Quran has 114.`}</div><a class="btn" href="#/search">Back to search</a>`;
    return;
  }
  const d = await withMeanings(s), ay = d.ayahs.find((x) => x.n === a);
  const prev = a > 1 ? [s, a - 1] : s > 1 ? [s - 1, idx.surahs[s - 2].ayahs] : null;
  const next = a < meta.ayahs ? [s, a + 1] : s < 114 ? [s + 1, 1] : null;
  const nav = (p, label) => (p ? `<a class="btn" href="#/ayah/${p[0]}/${p[1]}">${label}</a>` : "<span></span>");
  view = { ws: ay.w, sel: null, prog: null };
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Sūrah ${s} · āyah ${a} of ${meta.ayahs} · ${ay.w.length} words</div>
      <div class="row"><h1>${esc(meta.en)} ${s}:${a}</h1><span class="ar" style="font-size:30px">${esc(meta.ar)}</span></div>
    </section>
    <div class="row">${langHTML(ay.w)}${scriptHTML()}<a class="btn" href="#/s/${s}/${a}">Open the full sūrah</a></div>
    ${versesHTML([ay], idx)}
    ${fromQuranCom(d) ? CREDIT : ""}
    <div class="row">${nav(prev, `← ${prev ? prev.join(":") : ""}`)}<a class="btn" href="#/search">Search again</a>${nav(next, `${next ? next.join(":") : ""} →`)}</div>`;
  app.onclick = (e) => readingClick(e, idx);
  if (w && ay.w[w - 1]) app.querySelector(`.w[data-k="${w - 1}"]`).click();
}

// ---------- search ----------
const EXAMPLES = ["رحمة", "علم", "قال", "كتاب", "صبر", "نور", "قلب", "سماء"];
const refRe = /^\s*(\d{1,3})\s*[:.\s/]\s*(\d{1,3})\s*$/;

function searchForms(idx, q = "", s = route.surah || 1) {
  return `<section class="card search-grid">
      <h2>Go to an āyah</h2>
      <form class="field" id="goto">
        <label class="sr" for="gs">Sūrah</label>
        <select id="gs">${idx.surahs.map((x) => `<option value="${x.n}" ${x.n === s ? "selected" : ""}>${x.n}. ${esc(x.en)} (${x.ayahs} āyāt)</option>`).join("")}</select>
        <label class="sr" for="ga">Āyah number</label>
        <input id="ga" class="num" type="number" inputmode="numeric" min="1" max="${idx.surahs[s - 1].ayahs}" placeholder="Āyah" required>
        <button class="btn primary">Show āyah</button>
      </form>
    </section>
    <section class="card search-grid">
      <h2>Search a word</h2>
      <form class="field" id="wordf">
        <label class="sr" for="wq">Arabic word</label>
        <input id="wq" class="word" type="search" lang="ar" dir="rtl" placeholder="اكتب كلمة" value="${esc(q)}" autocomplete="off" required>
        <button class="btn primary">Search</button>
      </form>
      <p class="note">Type a word in Arabic, with or without vowel marks. You'll get its root with every related word and how often each occurs, then every āyah they appear in. A reference like 2:255 works here too.</p>
      ${q ? "" : `<div class="examples">${EXAMPLES.map((x) => `<a href="#/word/${encodeURIComponent(x)}" lang="ar">${x}</a>`).join("")}</div>`}
    </section>`;
}
function searchSubmit(e, idx) {
  e.preventDefault();
  if (e.target.id === "goto") location.hash = `#/ayah/${$("#gs").value}/${$("#ga").value}`;
  if (e.target.id === "wordf") {
    const v = $("#wq").value.trim(), m = v.match(refRe);
    location.hash = m ? `#/ayah/${+m[1]}/${+m[2]}` : `#/word/${encodeURIComponent(v)}`;
  }
}
function searchWire(idx) {
  app.onsubmit = (e) => searchSubmit(e, idx);
  $("#gs").onchange = (e) => { $("#ga").max = idx.surahs[e.target.value - 1].ayahs; };
}

async function searchPage() {
  const idx = await index();
  app.innerHTML = `<h1>Search</h1>${searchForms(idx)}`;
  searchWire(idx);
}

// Word search: result 1 is the root and its family with counts, result 2 every āyah they occur in
const PAGE = 25;
let wf = null; // { key, lem, form, shown } for the open word search
async function wordSearch(raw, pick) {
  const ref = raw.match(refRe);
  if (ref) return location.replace(`#/ayah/${+ref[1]}/${+ref[2]}`);
  const idx = await index(), q = norm(raw);
  const head = `<h1>Search</h1>${searchForms(idx, raw)}`;
  app.innerHTML = head + `<p class="note">Searching…</p>`;
  searchWire(idx);
  if (!q) { app.innerHTML = head + `<div class="banner">Type the word in Arabic letters, for example رحمة.</div>`; return searchWire(idx); }
  const [F, R] = await Promise.all([forms(), roots()]);
  let cands = F[q] ? Object.entries(F[q]) : [], exact = cands.length > 0;
  if (!exact && q.length >= 2) {
    const agg = new Map();
    for (const [sp, ks] of Object.entries(F)) if (sp.includes(q)) for (const [k, c] of Object.entries(ks)) agg.set(k, (agg.get(k) || 0) + c);
    cands = [...agg];
  }
  cands.sort((a, b) => b[1] - a[1]);
  const key = pick && R[pick] ? pick : exact ? cands[0][0] : null;
  const total = (k) => R[k].reduce((t, [, fs]) => t + fs.reduce((u, [, o]) => u + o.length, 0), 0);
  const candHTML = (list) => `<div class="cands">${list.slice(0, 12).map(([k]) => `<a class="fc" href="#/word/${encodeURIComponent(raw)}/${encodeURIComponent(k)}" aria-pressed="${k === key}"><span class="ar">${esc(keyLabel(k))}</span><small>${total(k).toLocaleString()}</small></a>`).join("")}</div>`;
  if (!key) {
    app.innerHTML = head + (cands.length
      ? `<section class="card search-grid"><div>No word is spelled exactly <span class="ar">${esc(raw)}</span>. These contain it. Pick one:</div>${candHTML(cands)}</section>`
      : `<div class="banner"><span class="ar">${esc(raw)}</span> wasn't found in the Quran. Check the spelling, or try the word without its prefixes, like كتاب for والكتاب.</div>`);
    return searchWire(idx);
  }
  if (!wf || wf.key !== key || wf.q !== q) wf = { q, key, lem: -1, form: null, shown: PAGE };
  // Spellings that differ only in vowels or recitation marks are one form; matching base words come first
  const lems = R[key].map(([lem, fs]) => {
    const g = new Map();
    for (const [t, o] of fs) { const k = norm(t); if (!g.has(k)) g.set(k, [t, []]); g.get(k)[1].push(...o); }
    return [lem, [...g].map(([k, [t, o]]) => [k, t, o]).sort((a, b) => b[2].length - a[2].length)];
  });
  const hit = ([lem, fs]) => fs.some((f) => f[0] === q) || norm(lem) === q;
  lems.sort((a, b) => hit(b) - hit(a));
  const occ = lems.flatMap(([, fs], i) => (wf.lem < 0 || wf.lem === i ? fs.filter(([k]) => !wf.form || k === wf.form).flatMap(([, , o]) => o) : [])).sort((a, b) => a - b);
  const all = lems.flatMap(([, fs]) => fs.flatMap(([, , o]) => o));
  const ayahs = new Map();
  for (const x of occ) { const p = place(x), k = p.s * 1000 + p.a; if (!ayahs.has(k)) ayahs.set(k, { s: p.s, a: p.a, w: new Set() }); ayahs.get(k).w.add(p.w); }
  const groups = [...ayahs.values()];
  const nAyahs = new Set(all.map((x) => Math.floor(x / 1000))).size, nSurahs = new Set(all.map((x) => Math.floor(x / 1e6))).size;
  const isRoot = !key.startsWith("=");
  const filtered = wf.lem >= 0 ? `<span class="ar">${esc(wf.form ? lems[wf.lem][1].find((f) => f[0] === wf.form)[1] : lems[wf.lem][0])}</span>` : "";

  const shown = groups.slice(0, wf.shown);
  await Promise.all([...new Set(shown.map((g) => g.s))].map(surah));
  if (wf.key !== key) return; // a newer search started while loading
  const hits = shown.map((g) => {
    const meta = idx.surahs[g.s - 1], ay = SURAH.get(g.s).ayahs[g.a - 1], first = Math.min(...g.w);
    return `<li class="hit"><a class="ref" href="#/ayah/${g.s}/${g.a}/${first}">${esc(meta.en)} ${g.s}:${g.a}</a>
      <div class="ar">${ay.w.map((w, i) => (g.w.has(i + 1) ? `<mark>${esc(w.t)}</mark>` : esc(w.t))).join(" ")} <span class="vn">﴿${arN(g.a)}﴾</span></div>
      <div class="row go"><a class="btn" href="#/s/${g.s}/${g.a}">Go to it in the sūrah</a><a class="btn" href="#/mushaf/s/${g.s}/${g.a}/${first}">📖 In the Mushaf</a></div></li>`;
  }).join("");

  app.innerHTML = head + `
    ${cands.length > 1 ? `<div class="note">This spelling also matches:</div>${candHTML(cands)}` : ""}
    <section class="card search-grid">
      <div class="eyebrow">Result 1 · ${isRoot ? "Root and the words built from it" : "Base word (it has no root)"}</div>
      <div class="rootbig">${esc(keyLabel(key))}</div>
      <div class="stats">
        <div class="stat"><strong>${all.length.toLocaleString()}</strong><span>times in the Quran</span></div>
        <div class="stat"><strong>${nAyahs.toLocaleString()}</strong><span>āyāt</span></div>
        <div class="stat"><strong>${nSurahs}</strong><span>sūrahs</span></div>
        ${isRoot ? `<div class="stat"><strong>${lems.length}</strong><span>base words</span></div>` : ""}
      </div>
      <p class="note">Tap a base word or a spelling to list only its āyāt. The spelling you searched is outlined.</p>
      <div class="lemmas">${lems.map(([lem, fs], i) => `<div class="lemma">
        <h3><button class="fc" data-lem="${i}" aria-pressed="${wf.lem === i && !wf.form}"><span class="ar">${esc(lem)}</span><small>${fs.reduce((t, [, , o]) => t + o.length, 0).toLocaleString()} times</small></button></h3>
        <div class="formchips">${fs.map(([k, t, o]) => `<button class="fc${k === q ? " match" : ""}" data-lem="${i}" data-form="${esc(k)}" aria-pressed="${wf.form === k}"><span class="ar">${esc(t)}</span><small>${o.length}</small></button>`).join("")}</div>
      </div>`).join("")}</div>
    </section>
    <section class="search-grid">
      <div class="row"><h2>Result 2 · ${groups.length.toLocaleString()} āyāt ${filtered ? `with ${filtered}` : ""}</h2>
        ${wf.lem >= 0 ? `<button class="btn" data-all>Show all forms</button>` : ""}</div>
      <ol class="hits">${hits}</ol>
      ${groups.length > wf.shown ? `<div class="pager"><span class="note">Showing ${shown.length} of ${groups.length}</span><button class="btn" data-more>Show ${Math.min(PAGE, groups.length - wf.shown)} more</button></div>` : ""}
    </section>`;
  searchWire(idx);
  app.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const y = scrollY;
    if (b.dataset.more !== undefined) wf.shown += PAGE;
    else if (b.dataset.all !== undefined) Object.assign(wf, { lem: -1, form: null, shown: PAGE });
    else if (b.dataset.lem !== undefined) {
      const lem = +b.dataset.lem, form = b.dataset.form || null;
      Object.assign(wf, wf.lem === lem && wf.form === form ? { lem: -1, form: null } : { lem, form }, { shown: PAGE });
    } else return;
    wordSearch(raw, key).then(() => scrollTo(0, y));
  };
}

// Practice: pick the āyāt and how many words, then a fixed-length round that can be left at any time.
// Each base word comes up once (weakest and most frequent first); a missed word comes back once at the end.
const LENGTHS = [10, 20, 0]; // 0 = every word in the chosen āyāt
async function practise(n, range) {
  const d = await withMeanings(n), all = allWords(d).filter(hasMeaning);
  if (!all.length) { app.innerHTML = `<div class="banner">This sūrah's word meanings haven't loaded, so there is nothing to practise yet.</div><a class="btn" href="#/s/${n}">Back to the sūrah</a>`; return; }
  const lang = () => quizLang(all);
  const last = d.ayahs.length;
  const saved = store.get("prac." + n, null);
  const opt = saved || { from: 1, to: Math.min(last, 5), len: 10 };
  const m = /^(\d+)-(\d+)$/.exec(range || "");
  if (m) Object.assign(opt, { from: +m[1], to: +m[2], len: 0 }); // from "Practise up to here": every word in those āyāt
  opt.from = Math.min(Math.max(1, opt.from), last); opt.to = Math.min(Math.max(opt.from, opt.to), last);

  const setup = () => {
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card practise-setup">
        <h2>Practise ${esc(d.en)}</h2>
        <p class="note">Choose the āyāt you have just studied. Each word comes up once; any you miss come back once at the end.</p>
        <div class="range"><label>From āyah <input id="pf" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.from}"></label>
          <label>to <input id="pt" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.to}"></label>
          <button class="btn" id="pall">Whole sūrah</button></div>
        <div class="row"><span>Answers in</span>${quizLangHTML(all) || `<span class="note">English (no Urdu meanings for this sūrah yet)</span>`}</div>
        <div class="row"><span>Words</span><div class="seg" aria-label="How many words">${LENGTHS.map((l) => `<button data-len="${l}" aria-pressed="${opt.len === l}">${l || "All"}</button>`).join("")}</div></div>
        <p class="note" id="pcount"></p>
        ${upto(n) ? `<p class="note">"Practise up to here" in the reader continues after āyah ${upto(n)}, where your last round ended. <button class="btn small" id="preset">Start over from āyah 1</button></p>` : ""}
        <button class="btn primary" id="pgo">Start</button>
        <p class="note">Ready for more? The optional <a href="#/s/${n}/roots/${opt.from}-${opt.to}">Root challenge</a> asks each word's root and its deep meaning, and <a href="#/s/${n}/forms/${opt.from}-${opt.to}">Form Switch</a> turns each word into another form.</p>
      </section>`;
    count();
    app.oninput = count;
  };
  const count = () => {
    const f = +$("#pf").value || 1, to = +$("#pt").value || f;
    const k = new Set(all.filter((w) => w.a >= f && w.a <= to).map((w) => w.k)).size;
    $("#pcount").textContent = k ? `${k} different words in āyāt ${f}–${to}. This round: ${opt.len ? Math.min(opt.len, k) : k}.` : "No words in that range.";
  };
  const setupClick = (e) => {
      const lb = e.target.closest("[data-len]");
      if (lb) { opt.len = +lb.dataset.len; app.querySelectorAll("[data-len]").forEach((b) => b.setAttribute("aria-pressed", b === lb)); return count(); }
      if (e.target.id === "preset") { store.set("upto." + n, 0); return setup(); }
      if (e.target.id === "pall") { $("#pf").value = 1; $("#pt").value = last; return count(); }
      if (e.target.id === "pgo") {
        let f = Math.min(Math.max(1, +$("#pf").value || 1), last), to = Math.min(Math.max(1, +$("#pt").value || f), last);
        if (f > to) [f, to] = [to, f];
        Object.assign(opt, { from: f, to }); store.set("prac." + n, opt);
        start();
      }
  };

  let r = null; // the current round
  const start = () => {
    const pool = all.filter((w) => w.a >= opt.from && w.a <= opt.to);
    const byShape = new Map();
    for (const w of pool) { if (!byShape.has(w.k)) byShape.set(w.k, []); byShape.get(w.k).push(w); }
    let deck = [...byShape.values()].map((occ) => occ[Math.floor(Math.random() * occ.length)])
      .sort((a, b) => lv(a) - lv(b) || b.f - a.f || Math.random() - 0.5);
    if (opt.len) deck = deck.slice(0, opt.len);
    deck.sort(() => Math.random() - 0.5);
    if (!deck.length) return;
    app.oninput = null;
    r = { deck, i: 0, total: deck.length, answered: 0, right: 0, honey: 0, missed: [], retried: new Set(), q: null };
    ask();
  };
  const ask = () => {
    const w = r.deck[r.i];
    // options are words, not text, so switching the answer language keeps the same question
    r.q = { w, opts: [w, ...distractors(w, all)].sort(() => Math.random() - 0.5), done: false, fb: "What does the highlighted word mean in this āyah?", marks: {} };
    draw();
  };
  const draw = () => {
    const { w, opts, done, fb, marks } = r.q, a = d.ayahs.find((x) => x.n === w.a), ur = lang() === "ur";
    const again = r.i >= r.total;
    app.innerHTML = `<div class="row"><span class="note">${again ? "Second try" : `Word ${r.i + 1} of ${r.total}`} · āyāt ${opt.from}–${opt.to}${state.combo >= 2 ? ` · streak ${state.combo}` : ""}</span><span class="row">${quizLangHTML(all)}<button class="btn" id="quit">Quit</button></span></div>
      <div class="track"><div class="fill" style="width:${Math.round((Math.min(r.i, r.total) / r.total) * 100)}%"></div></div>
      <section class="card quiz">
        <div class="note">${w.s}:${w.a} · this word: ${LABEL[lv(w)]}</div>
        ${quizWordHTML(w)}
        ${ctxHTML(a, w)}
        <div class="opts">${opts.map((o, i) => `<button class="opt${ur ? " ur" : ""}${marks[i] ? " " + marks[i] : ""}" data-o="${i}">${esc(meaningOf(o, lang()))}</button>`).join("")}</div>
        <div class="fb">${fb}</div>
        ${done ? `<button class="btn primary" id="next">${r.i + 1 < r.deck.length ? "Next word" : "See my score"}</button>` : ""}
      </section>${fromQuranCom(d) ? CREDIT : ""}`;
  };
  const summary = (quit) => {
    r.ended = true; r.quit = quit;
    const asked = r.answered, missed = r.missed;
    if (asked) { store.set("upto." + n, Math.max(upto(n), opt.to)); store.set("lastPrac", n); store.set("hiveSrc", { k: "s", n }); store.set("hiveScope", "practised"); }
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card quiz">
        <h2>${quit ? "Round stopped" : "Round complete"}</h2>
        <div class="big-score">${r.right} of ${asked}</div>
        <div class="note">right on the first try · āyāt ${opt.from}–${opt.to}${r.honey ? ` · <span class="pts">+${r.honey} honey</span>` : ""}</div>
        <div class="note">Words of ${esc(d.en)} you know: <strong>${progressOf(allWords(d)).pct}%</strong></div>
        ${missed.length ? `<div class="missed"><div class="note">Words to look at again</div>${missed.map((w) => `<div class="mrow"><span class="ar">${esc(w.t)}</span><span>${bothHTML(w)}</span></div>`).join("")}</div>` : asked ? `<div class="note">No mistakes. Well done.</div>` : ""}
        <div class="btns"><button class="btn primary" id="again">Practise again</button>${opt.from > 1 ? `<a class="btn" href="#/s/${n}/practise/1-${opt.to}" id="widen">Review āyāt 1–${opt.to}</a>` : ""}<button class="btn" id="other">Choose other āyāt</button><a class="btn" href="#/s/${n}/${opt.from}">Back to the sūrah</a></div>
      </section>`;
  };
  app.onsubmit = (e) => e.preventDefault();
  if (m) start(); else setup();
  app.onclick = (e) => {
    const ql = e.target.closest("[data-qlang]");
    if (ql) { setQuizLang(ql); return !r ? undefined : r.ended ? summary(r.quit) : draw(); }
    if (!r) return setupClick(e);
    if (e.target.id === "quit") return summary(true);
    if (e.target.id === "again") return start();
    if (e.target.id === "other") { r = null; return setup(); }
    if (e.target.id === "next") { r.i++; return r.i < r.deck.length ? ask() : summary(false); }
    const o = e.target.closest(".opt"); if (!o || !r.q || r.q.done) return;
    r.q.done = true;
    const i = +o.dataset.o, w = r.q.w, ok = r.q.opts[i] === w, marks = r.q.marks, first = r.i < r.total;
    marks[r.q.opts.indexOf(w)] = "right";
    let fb;
    if (ok) {
      state.combo++; const p = state.combo >= 5 ? 20 : 10; addHoney(p); r.honey += p; setLevel(w, lv(w) + 1);
      if (first) { r.right++; r.answered++; }
      fb = `<span class="pts">+${p} honey</span> Correct. This meaning will fade a little more in the reader.`;
    } else {
      marks[i] = "wrong"; state.combo = 0; setLevel(w, lv(w) - 1);
      if (first) { r.missed.push(w); r.answered++; }
      if (!r.retried.has(w.k)) { r.retried.add(w.k); r.deck.push(w); fb = `Not quite. It means ${bothHTML(w)}. This word comes back once at the end.`; }
      else fb = `Not quite. It means ${bothHTML(w)}.`;
    }
    r.q.fb = fb; draw();
  };
}

// Root challenge (optional, harder): for each root in the chosen āyāt, pick the root of a word, then its deep meaning.
async function rootChallenge(n, range) {
  const d = await withMeanings(n), cr = await core(), all = allWords(d);
  const has = (r) => r && cr[r] && cr[r].en;
  const pool = all.filter((w) => has(w.r));
  if (!pool.length) { app.innerHTML = `<div class="banner">Root meanings haven't loaded. Check your connection and try again.</div><a class="btn" href="#/s/${n}">Back to the sūrah</a>`; return; }
  const last = d.ayahs.length, m = /^(\d+)-(\d+)$/.exec(range || "");
  const opt = { from: m ? +m[1] : 1, to: m ? +m[2] : last, len: 10 };
  const roots = Object.keys(cr).filter(has), here = [...new Set(pool.map((w) => w.r))];
  const lang = () => (quizLang(all) === "ur" ? "ur" : "en");
  const gist = (r) => cr[r][lang()] || cr[r].en;
  // wrong options: other roots of this sūrah first, then any; never one that reads the same
  const others = (r, k, f) => {
    const out = [], seen = new Set([f(r)]);
    for (const x of [...here.filter((x) => x !== r).sort(() => Math.random() - 0.5), ...roots.sort(() => Math.random() - 0.5)]) {
      if (out.length === k) break;
      if (x !== r && !seen.has(f(x))) { seen.add(f(x)); out.push(x); }
    }
    return out;
  };
  let c = null;
  const setup = () => {
    c = null;
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card practise-setup">
        <h2>Root challenge · ${esc(d.en)}</h2>
        <p class="note">A harder, optional round. For each word: first choose its root, then the root's deep meaning from the classical dictionaries.</p>
        <div class="range"><label>From āyah <input id="pf" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.from}"></label>
          <label>to <input id="pt" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.to}"></label></div>
        <div class="row"><span>Answers in</span>${quizLangHTML(all) || `<span class="note">English</span>`}</div>
        <div class="row"><span>Roots</span><div class="seg" aria-label="How many roots">${LENGTHS.map((l) => `<button data-len="${l}" aria-pressed="${opt.len === l}">${l || "All"}</button>`).join("")}</div></div>
        <button class="btn primary" id="rgo">Start</button>
      </section>`;
  };
  const start = () => {
    const byRoot = new Map();
    for (const w of pool) if (w.a >= opt.from && w.a <= opt.to) { if (!byRoot.has(w.r)) byRoot.set(w.r, []); byRoot.get(w.r).push(w); }
    let deck = [...byRoot.values()].map((occ) => occ[Math.floor(Math.random() * occ.length)]).sort(() => Math.random() - 0.5);
    if (opt.len) deck = deck.slice(0, opt.len);
    if (!deck.length) { app.querySelector(".practise-setup .note").textContent = "No words with a root meaning in those āyāt. Choose other āyāt."; return; }
    c = { deck, i: 0, right: 0, steps: 0, honey: 0, missed: [] };
    ask();
  };
  const ask = () => {
    const w = c.deck[c.i];
    c.q = { w, step: 1, opts: [w.r, ...others(w.r, 3, (x) => x)].sort(() => Math.random() - 0.5), marks: {}, done: false, fb: "Which root does the highlighted word come from?" };
    draw();
  };
  const draw = () => {
    const { w, step, opts, marks, done, fb } = c.q, a = d.ayahs.find((x) => x.n === w.a), ur = lang() === "ur";
    app.innerHTML = `<div class="row"><span class="note">Root ${c.i + 1} of ${c.deck.length} · step ${step} of 2</span><span class="row">${quizLangHTML(all)}<button class="btn" id="quit">Quit</button></span></div>
      <div class="track"><div class="fill" style="width:${Math.round(((c.i * 2 + step - 1) / (c.deck.length * 2)) * 100)}%"></div></div>
      <section class="card quiz">
        <div class="note">${w.s}:${w.a} · ${esc(meaningOf(w, lang()))}</div>
        ${quizWordHTML(w)}
        ${ctxHTML(a, w)}
        ${step === 2 ? `<div>The root <span class="ar" style="font-size:26px">${esc(spaced(w.r))}</span> means…</div>` : ""}
        <div class="opts">${opts.map((o, i) => `<button class="opt${step === 1 ? " ar" : ur ? " ur" : ""}${marks[i] ? " " + marks[i] : ""}" data-o="${i}"${step === 1 ? ' style="font-size:24px"' : ""}>${esc(step === 1 ? spaced(o) : gist(o))}</button>`).join("")}</div>
        <div class="fb">${fb}</div>
        ${done && step === 2 ? `<div class="core" style="align-self:stretch">${coreHTML(cr[w.r], w.r)}</div>` : ""}
        ${done ? `<button class="btn primary" id="next">${step === 1 ? "Now its meaning" : c.i + 1 < c.deck.length ? "Next root" : "See my score"}</button>` : ""}
      </section>`;
  };
  const summary = (quit) => {
    c.ended = true; c.quit = quit;
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card quiz">
        <h2>${quit ? "Challenge stopped" : "Challenge complete"}</h2>
        <div class="big-score">${c.right} of ${c.steps}</div>
        <div class="note">steps right · āyāt ${opt.from}–${opt.to}${c.honey ? ` · <span class="pts">+${c.honey} honey</span>` : ""}</div>
        ${c.missed.length ? `<div class="missed"><div class="note">Roots to look at again</div>${c.missed.map((r) => `<div class="mrow"><span class="ar">${esc(spaced(r))}</span><span>${esc(cr[r].en)}${cr[r].ur ? ` · <span class="ur">${esc(cr[r].ur)}</span>` : ""}</span></div>`).join("")}</div>` : c.steps ? `<div class="note">No mistakes. Well done.</div>` : ""}
        <div class="btns"><button class="btn primary" id="again">Try again</button><button class="btn" id="other">Choose other āyāt</button><a class="btn" href="#/s/${n}/${opt.from}">Back to the sūrah</a></div>
      </section>`;
  };
  setup();
  app.onclick = (e) => {
    const ql = e.target.closest("[data-qlang]");
    if (ql) { setQuizLang(ql); return !c ? undefined : c.ended ? summary(c.quit) : draw(); }
    if (!c) {
      const lb = e.target.closest("[data-len]");
      if (lb) { opt.len = +lb.dataset.len; app.querySelectorAll("[data-len]").forEach((b) => b.setAttribute("aria-pressed", b === lb)); return; }
      if (e.target.id === "rgo") {
        let f = Math.min(Math.max(1, +$("#pf").value || 1), last), to = Math.min(Math.max(1, +$("#pt").value || f), last);
        if (f > to) [f, to] = [to, f];
        Object.assign(opt, { from: f, to }); start();
      }
      return;
    }
    if (e.target.id === "quit") return summary(true);
    if (e.target.id === "again") return start();
    if (e.target.id === "other") return setup();
    if (e.target.id === "next") {
      const { w, step } = c.q;
      if (step === 1) { c.q = { w, step: 2, opts: [w.r, ...others(w.r, 3, gist)].sort(() => Math.random() - 0.5), marks: {}, done: false, fb: "Choose the deep meaning of this root." }; return draw(); }
      c.i++; return c.i < c.deck.length ? ask() : summary(false);
    }
    const o = e.target.closest(".opt"); if (!o || c.q.done) return;
    const q = c.q, i = +o.dataset.o, ok = q.opts[i] === q.w.r;
    q.done = true; c.steps++; q.marks[q.opts.indexOf(q.w.r)] = "right";
    if (ok) { c.right++; c.honey += 15; addHoney(15); q.fb = `<span class="pts">+15 honey</span> Correct.`; }
    else { q.marks[i] = "wrong"; if (!c.missed.includes(q.w.r)) c.missed.push(q.w.r); q.fb = q.step === 1 ? `Not quite. The root is <span class="ar" style="font-size:22px">${esc(spaced(q.w.r))}</span>.` : "Not quite. Here is what the dictionaries say:"; }
    draw();
  };
}

// Form Switch: a word from the chosen āyāt is shown in its Quran form; choose its form for another person or
// tense (verbs) or number or case (nouns) from forms of the same word (see switchQuestion in forms.js).
// Gives honey, not word steps.
async function formSwitch(n, range) {
  const d = await withMeanings(n), all = allWords(d);
  const usable = all.filter((w) => w.g && (w.pos === "N" || (w.pos === "V" && !w.g.endsWith("PASS"))));
  if (!usable.length) { app.innerHTML = `<div class="banner">This sūrah has no words to switch. Try another sūrah.</div><a class="btn" href="#/s/${n}">Back to the sūrah</a>`; return; }
  const last = d.ayahs.length, m = /^(\d+)-(\d+)$/.exec(range || "");
  const opt = { from: m ? +m[1] : 1, to: m ? +m[2] : last, len: 10, pos: store.get("switchPos", "VN") };
  const lang = () => quizLang(all);
  const label = (c) => { const l = lang(); return l === "en" ? esc(formLabel(c)) : `<span class="${l === "ur" ? "ur" : ""}" lang="${l}">${esc(formLabel(c, l))}</span> <span class="note">(${esc(formLabel(c))})</span>`; };
  const POS = [["V", "Verbs"], ["N", "Nouns"], ["VN", "Both"]];
  let c = null;
  const setup = (msg) => {
    c = null;
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card practise-setup">
        <h2>Form Switch · ${esc(d.en)}</h2>
        <p class="note">${msg || "Each word from the āyāt is shown as the Quran says it. Turn a verb into another person or tense (يَعْمَلُونَ “they do” → تَعْمَلُونَ “you all do”), or a noun into another number or case (مُؤْمِنٌ “a believer” → مُؤْمِنُونَ “believers”)."}</p>
        <div class="range"><label>From āyah <input id="pf" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.from}"></label>
          <label>to <input id="pt" type="number" inputmode="numeric" min="1" max="${last}" value="${opt.to}"></label></div>
        <div class="row"><span>Labels in</span>${quizLangHTML(all) || `<span class="note">English</span>`}</div>
        <div class="row"><span>Words</span><div class="seg" aria-label="Which words">${POS.map(([k, l]) => `<button data-pos="${k}" aria-pressed="${opt.pos === k}">${l}</button>`).join("")}</div></div>
        <div class="row"><span>How many</span><div class="seg" aria-label="How many words">${LENGTHS.map((l) => `<button data-len="${l}" aria-pressed="${opt.len === l}">${l || "All"}</button>`).join("")}</div></div>
        <button class="btn primary" id="fgo">Start</button>
      </section>`;
  };
  const start = async () => {
    // one question per base word, loading each word's forms until the round is full
    const byLemma = new Map();
    for (const w of usable) if (w.a >= opt.from && w.a <= opt.to && opt.pos.includes(w.pos)) { if (!byLemma.has(w.l)) byLemma.set(w.l, []); byLemma.get(w.l).push(w); }
    const cand = [...byLemma.values()].map((occ) => occ[Math.floor(Math.random() * occ.length)]).sort(() => Math.random() - 0.5);
    const want = opt.len || cand.length, deck = [];
    $("#fgo").textContent = "Loading…";
    for (let i = 0; i < cand.length && deck.length < want; i += 12) {
      const got = await Promise.all(cand.slice(i, i + 12).map(async (w) => {
        const fd = await formsOf(w.r || "=" + norm(w.l));
        return switchQuestion(fd, w) ? { w, fd } : null;
      }));
      deck.push(...got.filter(Boolean));
    }
    if (!deck.length) return setup("No words with enough forms in those āyāt. Choose other āyāt, or Both.");
    c = { deck: deck.slice(0, want), i: 0, asked: 0, right: 0, honey: 0, missed: [] };
    ask();
  };
  const ask = () => {
    const it = c.deck[c.i];
    c.q = { ...it, ...switchQuestion(it.fd, it.w), marks: {}, done: false, fb: "" };
    if (!c.q.to) { c.i++; return c.i < c.deck.length ? ask() : summary(false); }
    draw();
  };
  const draw = () => {
    const { w, from, to, opts, marks, done, fb } = c.q, a = d.ayahs.find((x) => x.n === w.a), [pat, hint] = trickOf(to, from);
    app.innerHTML = `<div class="row"><span class="note">Word ${c.i + 1} of ${c.deck.length}</span><span class="row">${quizLangHTML(all)}<button class="btn" id="quit">Quit</button></span></div>
      <div class="track"><div class="fill" style="width:${Math.round((c.i / c.deck.length) * 100)}%"></div></div>
      <section class="card quiz fswitch">
        <div class="note">${w.s}:${w.a} · ${esc(meaningOf(w, lang()))}</div>
        <div class="ctx">${a.w.map((x) => (x === w ? `<b>${esc(x.t)}</b>` : esc(x.t))).join(" ")}</div>
        <div class="from"><span class="ar big">${esc(from.t)}</span><span>${label(from)}</span></div>
        <div class="to">Change it to: <strong>${label(to)}</strong></div>
        <div class="opts">${opts.map((o, i) => `<button class="opt ar${marks[i] ? " " + marks[i] : ""}" data-o="${i}" style="font-size:26px">${done ? formHL(o.t, from.t) : esc(o.t)}</button>`).join("")}</div>
        <div class="fb">${fb}</div>
        ${done ? `<div class="trick">${pat ? `<span class="ar pat" dir="rtl">${esc(pat)}</span> ` : ""}<span>${esc(hint)}</span></div>
          <button class="btn primary" id="next">${c.i + 1 < c.deck.length ? "Next word" : "See my score"}</button>` : ""}
      </section>`;
  };
  const summary = (quit) => {
    c.ended = true; c.quit = quit;
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a></div>
      <section class="card quiz">
        <h2>${quit ? "Form Switch stopped" : "Form Switch complete"}</h2>
        <div class="big-score">${c.right} of ${c.asked}</div>
        <div class="note">right · āyāt ${opt.from}–${opt.to}${c.honey ? ` · <span class="pts">+${c.honey} honey</span>` : ""}</div>
        ${c.missed.length ? `<div class="missed"><div class="note">Forms to look at again</div>${c.missed.map((q) => `<div class="mrow"><span class="ar">${esc(q.from.t)} → ${esc(q.to.t)}</span><span>${label(q.to)}</span></div>`).join("")}</div>` : c.right ? `<div class="note">No mistakes. Well done.</div>` : ""}
        <div class="btns"><button class="btn primary" id="again">Try again</button><button class="btn" id="other">Choose other āyāt</button><a class="btn" href="#/s/${n}/${opt.from}">Back to the sūrah</a></div>
      </section>`;
  };
  setup();
  app.onclick = (e) => {
    const ql = e.target.closest("[data-qlang]");
    if (ql) { setQuizLang(ql); return !c ? undefined : c.ended ? summary(c.quit) : draw(); }
    if (!c) {
      const lb = e.target.closest("[data-len]");
      if (lb) { opt.len = +lb.dataset.len; app.querySelectorAll("[data-len]").forEach((b) => b.setAttribute("aria-pressed", b === lb)); return; }
      const pb = e.target.closest("[data-pos]");
      if (pb) { opt.pos = pb.dataset.pos; store.set("switchPos", opt.pos); app.querySelectorAll("[data-pos]").forEach((b) => b.setAttribute("aria-pressed", b === pb)); return; }
      if (e.target.id === "fgo" && e.target.textContent === "Start") {
        let f = Math.min(Math.max(1, +$("#pf").value || 1), last), to = Math.min(Math.max(1, +$("#pt").value || f), last);
        if (f > to) [f, to] = [to, f];
        Object.assign(opt, { from: f, to }); start();
      }
      return;
    }
    if (e.target.id === "quit") return summary(true);
    if (e.target.id === "again") return start();
    if (e.target.id === "other") return setup();
    if (e.target.id === "next") { c.i++; return c.i < c.deck.length ? ask() : summary(false); }
    const o = e.target.closest(".opt"); if (!o || c.q.done) return;
    const q = c.q, i = +o.dataset.o, ok = q.opts[i] === q.to;
    q.done = true; c.asked++; q.marks[q.opts.indexOf(q.to)] = "right";
    if (ok) { c.right++; c.honey += 10; addHoney(10); q.fb = `<span class="pts">+10 honey</span> Correct.`; }
    else { q.marks[i] = "wrong"; c.missed.push(q); q.fb = `Not quite. That one is ${label(q.opts[i])}.`; }
    draw();
  };
}

async function parts() {
  // counted over the whole Quran by tools/build_data.py
  const idx = await index();
  const row = (g, e) => `<tr><td class="ar p" style="font-size:24px">${e.f.map(esc).join(" ")}</td><td>${esc(g.en)}</td><td class="ur">${esc(g.ur)}</td><td lang="hi">${esc(g.hi || "")}</td><td>${e.n.toLocaleString()}</td><td class="ar" style="font-size:20px">${e.ex.map(esc).join("، ")}</td></tr>`;
  const table = (rows) => `<div class="card tbl"><table><thead><tr><th>Part</th><th>Meaning</th><th>اردو</th><th lang="hi">हिंदी</th><th>Times</th><th>Example</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  app.innerHTML = `<h1>Word parts</h1>
    <p class="sub">These small pieces attach to the front or end of a word. Learn them once and you can read many more words. They are counted across the whole Quran.</p>
    ${table(Object.entries(idx.counts || {}).map(([key, e]) => row(idx.parts[key] || {}, e)).join(""))}
    <p class="note">Some short words are built from these pieces too, but are best learned whole: هٰذَا "this" is هَا + ذَا, and ذٰلِكَ "that" is ذَا + لِ + كَ.</p>
    <h2>Verb endings: who does it</h2>
    <p class="sub">The end of a verb tells you who does the action. A verb with no ending, like كَفَرَ, means "he".</p>
    ${table(Object.entries(idx.endings || {}).map(([, e]) => row(e, e)).join(""))}`;
}

function about() {
  app.innerHTML = `<h1>About</h1>
    <div class="card"><p>Quran Word Reader helps you understand the Quran directly in Arabic, without relying on a translation. The course covers the whole Quran, one small set of āyāt at a time.</p></div>
    <div class="card how"><h2>How to learn</h2>
      <ol>
        <li><strong>Take a small set of āyāt</strong>: 3, 5 or 10, as your free time allows each day.</li>
        <li><strong>Say each Arabic word aloud, then its meaning</strong> in English, Urdu or Hindi (pick up to two of English, اردو and हिंदी above the āyāt).</li>
        <li><strong>Repeat the set 7 times.</strong> That's all.</li>
        <li><strong>Test yourself:</strong> tap <em>None</em> to hide the meanings and read the set once more. Tap a word if you need to peek.</li>
        <li><strong>Practise:</strong> tap <em>Practise āyāt X–Y</em> under the last āyah of your set. Each word comes up once; any you miss come back at the end.</li>
        <li><strong>Read the real muṣḥaf.</strong> Take a muṣḥaf without a translation in your hands. You will understand the meanings 😊</li>
      </ol>
      <p>Gradually complete the sūrah, and then the Quran, in this way.</p></div>
    <div class="card how"><h2>Practice and quizzes</h2>
      <p><strong>Practise this sūrah</strong> (or <em>Practise āyāt X–Y</em> under any āyah): choose the āyāt and how many words, then pick each word's meaning. Every right answer moves the word one step: learning, almost, known. Its meaning fades in the reader as it moves up.</p>
      <p><strong>Root challenge</strong> (optional, harder): choose the root of each word, then its deep meaning from the classical dictionaries.</p>
      <p><strong>Form Switch</strong>: a word from the āyāt is turned into another form. A verb such as يَعْمَلُونَ "they do" changes person or tense ("you all do?" → تَعْمَلُونَ); a noun changes number or case (one, two, many; doer, object, after a preposition). Pick the right form and see the trick that makes it.</p>
      <p><strong>Honeycomb</strong>: answer words to fill a path across the comb and collect honey. <em>Two teams</em> plays a race on one screen for a class.</p>
      <p><strong>Your progress</strong>: each sūrah shows the share of its words you know, with a lighter bar for words on their way (every right answer fills it a little), and the home page shows the whole Quran. A word you know counts wherever it occurs.</p></div>
    <div class="card">
    <p class="note">Arabic text, word parts, base words and roots come from the Quranic Arabic Corpus (corpus.quran.com), version 0.4, as corrected in the open quran-morphology project. Search counts are counted from the same data. English and Urdu word meanings come from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>'s word-by-word translations; the Urdu meanings are by Dr. Farhat Hashmi (Al-Huda International). Quran data provided by Quran Foundation. They are stored in the app, so they work offline. Your progress stays on this device, in the profile you are using.</p>
    <p class="note">Root meanings on the word card come from the classical dictionaries: Maqāyīs al-Lugha (Ibn Fāris), al-Mufradāt (al-Rāghib al-Iṣfahānī), Lisān al-ʿArab (Ibn Manẓūr), al-Ṣiḥāḥ (al-Jawharī), al-Qāmūs al-Muḥīṭ and Baṣāʾir Dhawī al-Tamyīz (al-Fīrūzābādī) and ʿUmdat al-Ḥuffāẓ (al-Samīn al-Ḥalabī). Choose a dictionary in the list on the word card and its meaning for the root shows in English and Urdu, with the phrase from its entry that the meaning rests on. The phrases are copied word for word from the texts on <a href="https://tafsir.app" target="_blank" rel="noopener">tafsir.app</a> (al-Bāḥith al-Qurʾānī), which also has each full entry. The English and Urdu are translations of the dictionaries, made with AI help. al-Muʿjam al-Ishtiqāqī (Muḥammad Ḥasan Jabal) is still under copyright, so it is linked rather than quoted.</p>
    <p class="note">Install: open this page in Chrome (Android) or Safari (iPhone) and choose "Add to Home Screen". It works offline after the first visit.</p></div>
    <p class="note">Version ${VERSION_NO}. <button class="btn" id="upd">Check for update</button> <span class="note" id="updmsg"></span></p>
    <p><a class="btn" href="#/profile">Profiles and clearing progress</a></p>`;
  app.onclick = async (e) => {
    if (e.target.id !== "upd") return;
    $("#updmsg").textContent = "Checking…";
    const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
    await reg?.update().catch(() => {});
    if (reg?.installing || reg?.waiting) { $("#updmsg").textContent = "Updating…"; return; } // the new version reloads the page when ready
    $("#updmsg").textContent = "You have the latest version.";
  };
}

// ---------- profiles ----------
// Each profile keeps its own progress and honey on this device. A teacher can test a class under a class
// profile and clear it after the lesson without touching their own progress.
function profilePage() {
  const list = profiles.list(), cur = profiles.active();
  const draw = (msg = "") => {
    app.innerHTML = `<h1>Profiles</h1>
      <div class="card"><p>Each profile keeps its own progress and honey on this device. Use one for yourself and one for each class, and clear a class profile after a lesson without losing your own progress.</p></div>
      <ul class="profiles">${profiles.list().map((p) => `<li class="card${p.id === cur ? " on" : ""}">
        <div><strong>${esc(p.name)}</strong>${p.id === cur ? ` <span class="note">· in use</span>` : ""}</div>
        <div class="row">${p.id === cur ? "" : `<button class="btn" data-use="${esc(p.id)}">Use</button>`}
          <button class="btn" data-ren="${esc(p.id)}">Rename</button>
          <button class="btn" data-clr="${esc(p.id)}">Clear progress</button>
          ${p.id && p.id !== cur ? `<button class="btn" data-del="${esc(p.id)}">Delete</button>` : ""}</div></li>`).join("")}</ul>
      <form class="row" id="addp"><input id="pname" maxlength="24" placeholder="New profile name, e.g. Class 5B" autocomplete="off"><button class="btn honey">Add profile</button></form>
      <p class="note" id="pmsg">${esc(msg)}</p>`;
  };
  const save = (l) => raw.set("profiles", l);
  const use = (id) => { raw.set("profile", id); location.hash = "#/"; location.reload(); };
  app.onsubmit = (e) => {
    e.preventDefault();
    const name = $("#pname").value.trim(); if (!name) return;
    const l = profiles.list(), id = Date.now().toString(36);
    l.push({ id, name }); save(l); use(id);
  };
  app.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const l = profiles.list(), d = b.dataset;
    if (d.use !== undefined) return use(d.use);
    if (d.ren !== undefined) {
      const p = l.find((x) => x.id === d.ren), name = (prompt("Profile name", p.name) || "").trim().slice(0, 24);
      if (name) { p.name = name; save(l); profileChip(); draw(); }
      return;
    }
    const id = d.clr ?? d.del; if (id === undefined) return;
    const name = l.find((x) => x.id === id).name;
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = d.clr !== undefined ? "Tap again to clear" : "Tap again to delete"; return; }
    profileKeys(id).forEach((k) => raw.del(k));
    if (d.del !== undefined) { save(l.filter((x) => x.id !== id)); return draw(`${name} deleted.`); }
    if (id === cur) { state.level = {}; state.honey = 0; raw.set(scoped("shape"), {}); $("#jar").textContent = 0; }
    draw(`${name}: progress cleared.`);
  };
  draw();
}
// Light or dark, whatever the phone is set to: the choice is kept on this device for every profile
const DARK = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (document.documentElement.dataset.theme || (DARK.matches ? "dark" : "light")) === "dark";
const themeIcon = () => { const b = $("#theme"); b.textContent = isDark() ? "☀️" : "🌙"; b.title = isDark() ? "Switch to light" : "Switch to dark"; };
$("#theme").onclick = () => { const t = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = t; raw.set("theme", t); themeIcon(); };
DARK.addEventListener("change", themeIcon);
themeIcon();
const profileChip = () => { const p = profiles.list().find((x) => x.id === profiles.active()) || profiles.list()[0]; $("#who").textContent = p.name; };

// ---------- router ----------
const TABS = { search: "search", word: "search", ayah: "search", parts: "parts", hive: "hive", about: "about", profile: "about" };
async function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const tab = TABS[h[0]] || (h[0] === "s" ? "" : "home");
  document.querySelectorAll(".tabs a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  route.surah = h[0] === "s" || h[0] === "ayah" ? +h[1] || null : null;
  activeSurah(route.surah);
  app.onclick = null; app.onsubmit = null; app.oninput = null; app.onchange = null;
  let anchored = false;
  try {
    if (h[0] === "s" && h[1]) {
      if (h[2] === "practise") await practise(+h[1], h[3]);
      else if (h[2] === "roots") await rootChallenge(+h[1], h[3]);
      else if (h[2] === "forms") await formSwitch(+h[1], h[3]);
      else anchored = await reader(+h[1], +h[2] || 0);
    } else if (h[0] === "mushaf") anchored = await mushaf(h[1], h[2], h[3], h[4]);
    else if (h[0] === "tajweed") anchored = await tajweedGuide(h[1]);
    else if (h[0] === "ayah") await ayahView(+h[1], +h[2], +h[3] || 0);
    else if (h[0] === "word" && h[1]) await wordSearch(h[1], h[2]);
    else if (h[0] === "search") await searchPage();
    else if (h[0] === "parts") await parts();
    else if (h[0] === "hive") await renderHive(app);
    else if (h[0] === "about") about();
    else if (h[0] === "profile") profilePage();
    else await home();
  } catch (err) {
    app.innerHTML = `<div class="banner">This page couldn't load (${esc(err.message)}). Check your connection and try again.</div>`;
  }
  if (!anchored) window.scrollTo(0, 0);
}
$("#jar").textContent = state.honey;
profileChip();
addEventListener("hashchange", route);
sidebar().catch(() => {});
migrateLevels().catch(() => (state.level ||= {})).then(() => moveShapes().catch(() => {})).then(route);

// A new version takes over as soon as it is installed (sw.js skips waiting); reload once so the page runs it.
// Installed apps on phones are often resumed rather than reopened, so look for an update whenever the app comes back.
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  // a new version took over: reload at once, unless a quiz is running (then offer the reload instead)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!had || reloaded) return;
    if (!/\/(practise|roots|forms)|^#\/hive/.test(location.hash)) { reloaded = true; return location.reload(); }
    toast(`<strong>A new version is ready.</strong> <button class="btn primary" id="toastgo">Update now</button>`, () => { reloaded = true; location.reload(); });
  });
}

// ---------- update notice ----------
function toast(html, onGo) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.innerHTML = `<div class="tbody">${html}</div><button class="tx" aria-label="Close">×</button>`;
  t.onclick = (e) => { if (e.target.id === "toastgo") onGo?.(); if (e.target.id === "toastgo" || e.target.closest(".tx")) t.remove(); };
}
// After an update, say so once with what's new. A first visit (nothing stored yet) just records the version.
{
  const seen = raw.get("seenVersion", 0);
  const used = seen || !FIRST_VISIT;
  if (seen < VERSION_NO && used) {
    const news = Object.keys(CHANGES).map(Number).filter((v) => v > (seen || VERSION_NO - 1)).sort((a, b) => b - a).flatMap((v) => CHANGES[v]);
    // a version with no line in CHANGES (nothing you would see) updates quietly
    if (news.length) toast(`<strong>Updated to version ${VERSION_NO}</strong><ul>${news.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn primary" id="toastgo">OK</button>`);
  }
  raw.set("seenVersion", VERSION_NO);
}
