// Quran Word Reader: sūrah sidebar, reader with fading meanings, āyah and word search,
// practice quiz, word parts and the Ayah Honeycomb.
import { renderHive } from "./hive.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");

// ---------- storage (works without localStorage, e.g. private windows) ----------
export const store = {
  get(k, d) { try { const v = localStorage.getItem("qwr." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("qwr." + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem("qwr." + k); } catch { /* ignore */ } },
};

export const state = {
  lang: store.get("lang", "both"),     // both | en | ur | none (meanings hidden, to test yourself)
  level: store.get("level", {}),       // lemma -> 0 new, 1 learning, 2 almost, 3 known
  honey: store.get("honey", 0),
  combo: 0,
};
export const lv = (l) => state.level[l] || 0;
export const setLevel = (l, n) => { state.level[l] = Math.max(0, Math.min(3, n)); store.set("level", state.level); };
export function addHoney(n) { state.honey += n; store.set("honey", state.honey); $("#jar").textContent = state.honey; }
const LABEL = ["new", "learning", "almost", "known"];

// ---------- data ----------
let INDEX = null, ROOTS = null, FORMS = null;
const SURAH = new Map();
const json = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
export async function index() {
  if (!INDEX) INDEX = await json("data/surahs.json");
  return INDEX;
}
export async function surah(n) {
  if (!SURAH.has(n)) {
    const d = await json(`data/s/${String(n).padStart(3, "0")}.json`);
    d.ayahs.forEach((a) => a.w.forEach((w, i) => { w.s = n; w.a = a.n; w.i = i; }));
    SURAH.set(n, d);
  }
  return SURAH.get(n);
}
const roots = async () => (ROOTS ||= await json("data/index/roots.json"));
const forms = async () => (FORMS ||= await json("data/index/forms.json"));

// ---------- word meanings (English and Urdu) ----------
// They are bundled in data/s/NNN.json from glosses/ (imported from Quran.com with tools/import_meanings.py).
// If a sūrah or language has none bundled, they are fetched live from the Quran.com API instead and kept
// on the device for at most 7 days, as Quran Foundation's developer terms ask for live use.
const WBW_API = "https://api.quran.com/api/v4/verses/by_chapter/";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const LANGS = ["en", "ur"];
export const CREDIT = `<p class="note credit">Word meanings from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>'s word-by-word translations; Urdu by Dr. Farhat Hashmi (Al-Huda International). Quran data provided by Quran Foundation.</p>`;
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

export const ORDER = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i)]; // the course: Al-Fatihah, then An-Nas back to An-Naba
export const arN = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const arHTML = (w) => w.p.map(([t, k]) => (k === "s" ? esc(t) : `<span class="${k}">${esc(t)}</span>`)).join("");
export const hasMeaning = (w) => !!(w.en || w.ur);
export const meaningOf = (w, lang) => (lang === "ur" ? w.ur : w.en) || w.en || w.ur || "";

// Search spelling, the same as norm() in tools/build_data.py, plus Urdu/Persian keyboard letters
const FOLD = { "ٱ": "ا", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ۥ": "", "ۦ": "", "ی": "ي", "ے": "ي", "ک": "ك", "ہ": "ه", "ۃ": "ه", "ھ": "ه" };
export const norm = (t) => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/[ٱأإآىئؤةۥۦیےکہۃھ]/g, (c) => FOLD[c]).replace(/[^ء-ي]/g, "");
const spaced = (r) => [...r].join(" ");
const keyLabel = (k) => (k.startsWith("=") ? k.slice(1) : spaced(k));

function unaided(ws) {
  if (!ws.length) return 0;
  return Math.round((ws.filter((w) => lv(w.l) >= 3).length / ws.length) * 100);
}
const allWords = (d) => d.ayahs.flatMap((a) => a.w);
const place = (x) => ({ s: Math.floor(x / 1e6), a: Math.floor(x / 1000) % 1000, w: x % 1000 });

// ---------- sidebar ----------
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʿʾ'’\-\s]/g, "").toLowerCase();
async function sidebar() {
  const idx = await index();
  $("#surahs").innerHTML = idx.surahs.map((s) => `<li data-n="${s.n}" data-q="${esc(fold(s.en) + "|" + fold(s.meaning) + "|" + norm(s.ar))}">
    <a href="#/s/${s.n}"><span class="sn">${s.n}</span>
    <span class="nm">${esc(s.en)}${s.course ? `<span class="tag">course</span>` : ""}<small>${esc(s.meaning)} · ${s.ayahs} āyāt</small></span>
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
  return `<button class="w lv${hasMeaning(w) ? lv(w.l) : 0}" data-k="${k}"><span class="ar">${arHTML(w)}</span>
    <span class="gl">${pl.length ? `<span class="parts">${esc(pl.join(" + "))}</span>` : ""}${w.en ? `<span class="en">${esc(w.en)}</span>` : ""}${w.ur ? `<span class="ur">${esc(w.ur)}</span>` : ""}</span></button>`;
}
const anyUrdu = (ws) => ws.some((w) => w.ur);
// Quiz answers are in English or Urdu, switchable inside the practice and the Honeycomb.
// The first time, they follow the reader: Urdu if the reader shows only Urdu.
export const quizLang = (ws) => (anyUrdu(ws) ? store.get("quizLang", state.lang === "ur" ? "ur" : "en") : "en");
export const quizLangHTML = (ws) => !anyUrdu(ws) ? "" : `<div class="seg" aria-label="Answers in">
  <button data-qlang="en" aria-pressed="${quizLang(ws) === "en"}">English</button>
  <button data-qlang="ur" aria-pressed="${quizLang(ws) === "ur"}">اردو</button></div>`;
// After a wrong answer, the meaning is shown in both languages so the pair is learnt together.
export const bothHTML = (w) => [w.en && `<strong>${esc(w.en)}</strong>`, w.ur && `<strong class="ur">${esc(w.ur)}</strong>`].filter(Boolean).join(" · ");
export const setQuizLang = (b) => { store.set("quizLang", b.dataset.qlang); document.querySelectorAll("[data-qlang]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.qlang === b.dataset.qlang)); };
// Wrong answers: other words whose meaning differs from the right one, and from each other, in both
// languages, so the options stay distinct whichever language they are shown in.
export function distractors(w, pool, k = 3) {
  const used = { en: new Set([w.en].filter(Boolean)), ur: new Set([w.ur].filter(Boolean)) }, out = [];
  for (const x of [...pool].sort(() => Math.random() - 0.5)) {
    if (out.length === k) break;
    if (!hasMeaning(x) || ["en", "ur"].some((l) => x[l] && used[l].has(x[l])) || meaningOf(x, "en") === meaningOf(w, "en")) continue;
    out.push(x); ["en", "ur"].forEach((l) => x[l] && used[l].add(x[l]));
  }
  return out;
}
// "Practise up to here": a round from the āyah after the last one practised (or from 1 when reviewing) to this one
const upto = (n) => store.get("upto." + n, 0);
const practiseLink = (n, a) => { const f = upto(n) < a ? upto(n) + 1 : 1; return `<a class="btn small practise-here" href="#/s/${n}/practise/${f}-${a}">Practise ${f === a ? `āyah ${a}` : `āyāt ${f}–${a}`}</a>`; };
function versesHTML(ayahs, idx, practiseIn) {
  let k = 0;
  return `<div class="verses${versesClass(ayahs.flatMap((a) => a.w))}" id="verses">
    ${ayahs.map((a) => {
      const faded = a.w.every((w) => lv(w.l) >= 2);
      return `<article class="verse" id="a${a.n}"><div class="words">${a.w.map((w) => wordHTML(w, k++, idx)).join("")}
        <span class="vn">﴿${arN(a.n)}﴾</span></div>
        ${a.en || a.ur ? `<div class="meaning${faded ? " faded" : ""}">${a.en ? `<span class="en">${esc(a.en)}</span>` : ""}${a.ur ? `<span class="ur">${esc(a.ur)}</span>` : ""}</div>` : ""}
        ${practiseIn && a.w.some(hasMeaning) ? practiseLink(practiseIn, a.n) : ""}
      </article>`;
    }).join("")}</div><div id="sheetbox"></div>`;
}
// The meanings shown: with no Urdu meanings yet, English or none
const readLang = (ws) => (anyUrdu(ws) || state.lang === "none" ? state.lang : "en");
const versesClass = (ws) => ({ en: " only-en", ur: " only-ur", none: " no-meaning" })[readLang(ws)] || "";
const langHTML = (ws) => `<div class="seg" aria-label="Meaning language">
  ${(anyUrdu(ws) ? [["both", "Both"], ["en", "English"], ["ur", "اردو"], ["none", "None"]] : [["en", "English"], ["none", "None"]])
    .map(([l, t]) => `<button data-lang="${l}" aria-pressed="${readLang(ws) === l}">${t}</button>`).join("")}</div>`;

function sheetHTML(w, idx) {
  const parts = w.p.filter((x) => x[1] !== "s").map(([t, , key]) => {
    const g = idx.parts[key] || {};
    return `<span class="chip"><span class="ar">${esc(t)}</span> = ${esc(g.en)}${g.ur && g.ur !== "—" ? " · " + esc(g.ur) : ""}</span>`;
  }).join(" ") || "None";
  const fam = [...new Set(view.ws.filter((x) => w.r && x.r === w.r && x.t !== w.t).map((x) => x.t))];
  const key = w.r || "=" + w.l;
  return `<div class="sheet" id="sheet">
    <div class="top2"><div><div class="eyebrow">${w.s}:${w.a} · word ${w.i + 1} · ${LABEL[lv(w.l)]}</div>
      <div><strong>${esc(w.en || "Meaning not added yet")}</strong></div>${w.ur ? `<div class="ur">${esc(w.ur)}</div>` : ""}</div>
      <div class="ar big">${arHTML(w)}</div></div>
    <dl class="kv"><dt>Parts</dt><dd>${parts}</dd>
      <dt>Base word</dt><dd><span class="ar" style="font-size:22px">${esc(w.l)}</span> <span class="note">· ${w.f} times in the Quran</span></dd>
      <dt>Root</dt><dd>${w.r ? `<span class="ar" style="font-size:22px">${esc(spaced(w.r))}</span>` : "None"}
      ${fam.length ? `<div class="note">Same root here: <span class="ar" style="font-size:20px">${fam.map(esc).join("، ")}</span></div>` : ""}</dd></dl>
    <div class="btns">${hasMeaning(w) ? `<button class="btn primary" data-act="know">I know this</button><button class="btn" data-act="again">Show meaning again</button>` : ""}
      <a class="btn" href="#/word/${encodeURIComponent(norm(w.l))}/${encodeURIComponent(key)}">${w.r ? "Every word from this root" : "Every place it occurs"}</a>
      <button class="btn" data-act="close">Close</button></div></div>`;
}

// Click handling shared by the sūrah reader and the single-āyah view. Updates in place so long sūrahs stay fast.
function readingClick(e, idx) {
  const lb = e.target.closest("[data-lang]");
  if (lb) {
    state.lang = lb.dataset.lang; store.set("lang", state.lang);
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === state.lang));
    $("#verses").className = "verses" + versesClass(view.ws);
    app.querySelectorAll(".peek").forEach((x) => x.classList.remove("peek"));
    return;
  }
  // Meanings hidden: the first tap on a word, or on an āyah's translation, shows just that one
  const hidden = $("#verses").classList.contains("no-meaning");
  const m = e.target.closest(".meaning");
  if (hidden && m) { m.classList.toggle("peek"); return; }
  const btns = () => app.querySelectorAll(".w");
  const select = (k) => {
    btns().forEach((b) => b.classList.toggle("sel", +b.dataset.k === k));
    view.sel = k;
    $("#sheetbox").innerHTML = k === null ? "" : sheetHTML(view.ws[k], idx);
  };
  const act = e.target.closest("[data-act]");
  if (act) {
    const w = view.ws[view.sel];
    if (act.dataset.act === "know") setLevel(w.l, lv(w.l) + 1);
    if (act.dataset.act === "again") setLevel(w.l, 0);
    if (act.dataset.act !== "close") {
      btns().forEach((b) => { const x = view.ws[+b.dataset.k]; if (x.l === w.l) b.className = `w lv${hasMeaning(x) ? lv(x.l) : 0}`; });
      if (view.prog) view.prog();
    }
    return select(null);
  }
  const b = e.target.closest(".w"); if (!b) return;
  const k = +b.dataset.k, w = view.ws[k];
  if (hidden && !b.classList.contains("peek")) { b.classList.add("peek"); return; }
  if (hasMeaning(w) && lv(w.l) === 3 && !b.classList.contains("peek")) { b.classList.add("peek"); setLevel(w.l, 2); return; }
  select(k);
}

// ---------- views ----------
async function home() {
  const idx = await index();
  const course = idx.surahs.filter((s) => s.course);
  const loaded = await Promise.all(ORDER.map(surah));
  const pct = unaided(loaded.filter((d) => d.n !== 1).flatMap(allWords));
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Course · Al-Fātiḥah and Juz ʿAmma · ${course.reduce((t, s) => t + s.words, 0).toLocaleString()} words</div>
      <h1>Read the Quran without a translation</h1>
      <p class="sub">Each word's meaning sits under it and fades as you learn it. Practise, and watch the page turn into plain Arabic.</p>
      <div class="row"><span>Juz ʿAmma read without help</span><strong>${pct}%</strong></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    </section>
    <div class="row"><span class="note">All 114 sūrahs are in the sūrah list. <a href="#/search">Search</a> finds any āyah, or every place a word occurs.</span></div>
    <ul class="list">
      ${ORDER.map((n) => {
        const s = idx.surahs.find((x) => x.n === n), p = unaided(allWords(SURAH.get(n)));
        return `<li><a href="#/s/${n}"><span class="num">${n}</span>
          <span class="name">${esc(s.en)} <small>${esc(s.meaning)} · ${s.ayahs} āyāt · ${s.words} words</small>
          <span class="mini"><i style="width:${p}%"></i></span></span>
          <span class="arname">${esc(s.ar)}</span></a></li>`;
      }).join("")}
    </ul>`;
}

async function reader(n, focus) {
  const idx = await index(), meta = idx.surahs.find((s) => s.n === n);
  if (!meta) throw new Error(`there is no sūrah ${n}`);
  const d = await withMeanings(n), ws = allWords(d), ready = ws.some(hasMeaning);
  const prog = () => {
    const pct = unaided(ws);
    $("#prog").innerHTML = `<span>Read without help</span><strong>${pct}% · ${ws.filter((w) => lv(w.l) >= 3).length} of ${ws.length} words</strong>`;
    $("#progfill").style.width = pct + "%";
  };
  view = { ws, sel: null, prog };
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Sūrah ${n} · ${meta.ayahs} āyāt · ${meta.words.toLocaleString()} words</div>
      <div class="row"><h1>${esc(meta.en)} <small class="note">${esc(meta.meaning)}</small></h1><span class="ar" style="font-size:30px">${esc(meta.ar)}</span></div>
      <div class="row" id="prog"></div>
      <div class="track"><div class="fill" id="progfill"></div></div>
    </section>
    <div class="row">${langHTML(ws)}
      ${ready ? `<a class="btn primary" href="#/s/${n}/practise">Practise this sūrah</a>` : ""}</div>
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
    <div class="row">${langHTML(ay.w)}<a class="btn" href="#/s/${s}/${a}">Open the full sūrah</a></div>
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
      <div class="ar">${ay.w.map((w, i) => (g.w.has(i + 1) ? `<mark>${esc(w.t)}</mark>` : esc(w.t))).join(" ")} <span class="vn">﴿${arN(g.a)}﴾</span></div></li>`;
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
      </section>`;
    count();
    app.oninput = count;
  };
  const count = () => {
    const f = +$("#pf").value || 1, to = +$("#pt").value || f;
    const k = new Set(all.filter((w) => w.a >= f && w.a <= to).map((w) => w.l)).size;
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
    const byLemma = new Map();
    for (const w of pool) { if (!byLemma.has(w.l)) byLemma.set(w.l, []); byLemma.get(w.l).push(w); }
    let deck = [...byLemma.values()].map((occ) => occ[Math.floor(Math.random() * occ.length)])
      .sort((a, b) => lv(a.l) - lv(b.l) || b.f - a.f || Math.random() - 0.5);
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
    r.q = { w, opts: [w, ...distractors(w, all)].sort(() => Math.random() - 0.5), done: false, fb: "What does the highlighted word mean?", marks: {} };
    draw();
  };
  const draw = () => {
    const { w, opts, done, fb, marks } = r.q, a = d.ayahs.find((x) => x.n === w.a), ur = lang() === "ur";
    const again = r.i >= r.total;
    app.innerHTML = `<div class="row"><span class="note">${again ? "Second try" : `Word ${r.i + 1} of ${r.total}`} · āyāt ${opt.from}–${opt.to}${state.combo >= 2 ? ` · streak ${state.combo}` : ""}</span><span class="row">${quizLangHTML(all)}<button class="btn" id="quit">Quit</button></span></div>
      <div class="track"><div class="fill" style="width:${Math.round((Math.min(r.i, r.total) / r.total) * 100)}%"></div></div>
      <section class="card quiz">
        <div class="note">${w.s}:${w.a} · this word: ${LABEL[lv(w.l)]}</div>
        <div class="ar big">${arHTML(w)}</div>
        <div class="ctx">${a.w.map((x) => (x === w ? `<b>${esc(x.t)}</b>` : esc(x.t))).join(" ")}</div>
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
      state.combo++; const p = state.combo >= 5 ? 20 : 10; addHoney(p); r.honey += p; setLevel(w.l, lv(w.l) + 1);
      if (first) { r.right++; r.answered++; }
      fb = `<span class="pts">+${p} honey</span> Correct. This meaning will fade a little more in the reader.`;
    } else {
      marks[i] = "wrong"; state.combo = 0; setLevel(w.l, lv(w.l) - 1);
      if (first) { r.missed.push(w); r.answered++; }
      if (!r.retried.has(w.l)) { r.retried.add(w.l); r.deck.push(w); fb = `Not quite. It means ${bothHTML(w)}. This word comes back once at the end.`; }
      else fb = `Not quite. It means ${bothHTML(w)}.`;
    }
    r.q.fb = fb; draw();
  };
}

async function parts() {
  const idx = await index(), loaded = await Promise.all(ORDER.map(surah));
  const seen = new Map();
  for (const w of loaded.flatMap(allWords)) for (const [t, k, key] of w.p) {
    if (k === "s" || !key) continue;
    if (!seen.has(key)) seen.set(key, { forms: new Set(), ex: [], count: 0 });
    const e = seen.get(key); e.forms.add(t); e.count++; if (e.ex.length < 3 && !e.ex.includes(w.t)) e.ex.push(w.t);
  }
  const rows = [...seen.entries()].sort((a, b) => b[1].count - a[1].count);
  app.innerHTML = `<h1>Word parts</h1>
    <p class="sub">These small pieces attach to the front or end of a word. Learn them once and you can read many more words. They are counted across Al-Fātiḥah and Juz ʿAmma.</p>
    <div class="card tbl"><table><thead><tr><th>Part</th><th>Meaning</th><th>اردو</th><th>Times</th><th>Example</th></tr></thead><tbody>
    ${rows.map(([key, e]) => { const g = idx.parts[key] || {}; return `<tr><td class="ar p" style="font-size:24px">${[...e.forms].slice(0, 3).map(esc).join(" ")}</td><td>${esc(g.en)}</td><td class="ur">${esc(g.ur)}</td><td>${e.count}</td><td class="ar" style="font-size:20px">${e.ex.map(esc).join("، ")}</td></tr>`; }).join("")}
    </tbody></table></div>`;
}

function about() {
  app.innerHTML = `<h1>About</h1>
    <div class="card"><p>Quran Word Reader helps you understand the Quran directly in Arabic. Each word shows its meaning, which fades as you learn it. The course covers Al-Fātiḥah and Juz ʿAmma; every sūrah can be read and searched.</p>
    <p class="note">Arabic text, word parts, base words and roots come from the Quranic Arabic Corpus (corpus.quran.com), version 0.4, as corrected in the open quran-morphology project. Search counts are counted from the same data. English and Urdu word meanings come from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>'s word-by-word translations; the Urdu meanings are by Dr. Farhat Hashmi (Al-Huda International). Quran data provided by Quran Foundation. They are stored in the app, so they work offline. Your progress stays on this device.</p>
    <p class="note">Install: open this page in Chrome (Android) or Safari (iPhone) and choose "Add to Home Screen". It works offline after the first visit.</p></div>
    <button class="btn" id="reset">Clear my progress</button><span class="note" id="resetmsg"></span>`;
  app.onclick = (e) => {
    if (e.target.id !== "reset") return;
    if (e.target.dataset.sure) { state.level = {}; store.set("level", {}); state.honey = 0; store.set("honey", 0); $("#jar").textContent = 0; $("#resetmsg").textContent = " Progress cleared."; delete e.target.dataset.sure; e.target.textContent = "Clear my progress"; }
    else { e.target.dataset.sure = "1"; e.target.textContent = "Tap again to clear everything"; }
  };
}

// ---------- router ----------
const TABS = { search: "search", word: "search", ayah: "search", parts: "parts", hive: "hive", about: "about" };
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
      if (h[2] === "practise") await practise(+h[1], h[3]); else anchored = await reader(+h[1], +h[2] || 0);
    } else if (h[0] === "ayah") await ayahView(+h[1], +h[2], +h[3] || 0);
    else if (h[0] === "word" && h[1]) await wordSearch(h[1], h[2]);
    else if (h[0] === "search") await searchPage();
    else if (h[0] === "parts") await parts();
    else if (h[0] === "hive") await renderHive(app);
    else if (h[0] === "about") about();
    else await home();
  } catch (err) {
    app.innerHTML = `<div class="banner">This page couldn't load (${esc(err.message)}). Check your connection and try again.</div>`;
  }
  if (!anchored) window.scrollTo(0, 0);
}
$("#jar").textContent = state.honey;
addEventListener("hashchange", route);
sidebar().catch(() => {});
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
