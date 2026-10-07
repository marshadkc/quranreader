// Quran Word Reader: reader with fading meanings, practice quiz, word parts and the Ayah Honeycomb.
import { renderHive } from "./hive.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");

// ---------- storage (works without localStorage, e.g. private windows) ----------
export const store = {
  get(k, d) { try { const v = localStorage.getItem("qwr." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("qwr." + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export const state = {
  lang: store.get("lang", "both"),     // both | en | ur
  level: store.get("level", {}),       // lemma -> 0 new, 1 learning, 2 almost, 3 known
  honey: store.get("honey", 0),
  combo: 0,
};
export const lv = (l) => state.level[l] || 0;
export const setLevel = (l, n) => { state.level[l] = Math.max(0, Math.min(3, n)); store.set("level", state.level); };
export function addHoney(n) { state.honey += n; store.set("honey", state.honey); $("#jar").textContent = state.honey; }
const LABEL = ["new", "learning", "almost", "known"];

// ---------- data ----------
let INDEX = null;
const SURAH = new Map();
export async function index() {
  if (!INDEX) INDEX = await (await fetch("data/surahs.json")).json();
  return INDEX;
}
export async function surah(n) {
  if (!SURAH.has(n)) {
    const d = await (await fetch(`data/s/${String(n).padStart(3, "0")}.json`)).json();
    d.ayahs.forEach((a) => a.w.forEach((w, i) => { w.s = n; w.a = a.n; w.i = i; }));
    SURAH.set(n, d);
  }
  return SURAH.get(n);
}
export const ORDER = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i)]; // Al-Fatihah, then An-Nas back to An-Naba
export const arN = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const arHTML = (w) => w.p.map(([t, k]) => (k === "s" ? esc(t) : `<span class="${k}">${esc(t)}</span>`)).join("");
export const hasMeaning = (w) => !!(w.en || w.ur);
export const meaningOf = (w, lang) => (lang === "ur" ? w.ur : w.en) || w.en || w.ur || "";

function unaided(ws) {
  if (!ws.length) return 0;
  return Math.round((ws.filter((w) => lv(w.l) >= 3).length / ws.length) * 100);
}
const allWords = (d) => d.ayahs.flatMap((a) => a.w);

// ---------- views ----------
async function home() {
  const idx = await index();
  const ready = idx.surahs.filter((s) => s.ready).length;
  const loaded = await Promise.all(ORDER.map(surah));
  const juz = loaded.filter((d) => d.n !== 1).flatMap(allWords);
  const pct = unaided(juz);
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Al-Fātiḥah and Juz ʿAmma · ${idx.surahs.reduce((t, s) => t + s.words, 0).toLocaleString()} words</div>
      <h1>Read the Quran without a translation</h1>
      <p class="sub">Each word's meaning sits under it and fades as you learn it. Practise, and watch the page turn into plain Arabic.</p>
      <div class="row"><span>Juz ʿAmma read without help</span><strong>${pct}%</strong></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    </section>
    ${ready < idx.surahs.length ? `<div class="banner">Word meanings are added for ${ready} of ${idx.surahs.length} sūrahs so far. The others already show the Arabic, each word's parts and its root.</div>` : ""}
    <ul class="list">
      ${ORDER.map((n) => {
        const s = idx.surahs.find((x) => x.n === n), d = SURAH.get(n), p = unaided(allWords(d));
        return `<li><a href="#/s/${n}"><span class="num">${n}</span>
          <span class="name">${esc(s.en)} <small>${esc(s.meaning)} · ${s.ayahs} āyāt · ${s.words} words${s.ready ? "" : " · meanings coming"}</small>
          <span class="mini"><i style="width:${p}%"></i></span></span>
          <span class="arname">${esc(s.ar)}</span></a></li>`;
      }).join("")}
    </ul>`;
}

let selected = null; // index into the reader's word list
async function reader(n) {
  const d = await surah(n), idx = await index(), meta = idx.surahs.find((s) => s.n === n);
  const ws = allWords(d), pct = unaided(ws);
  const lang = state.lang;
  let sheet = "";
  if (selected !== null && ws[selected]) {
    const w = ws[selected];
    const parts = w.p.filter((x) => x[1] !== "s").map(([t, k, key]) => {
      const g = idx.parts[key] || {};
      return `<span class="chip"><span class="ar">${esc(t)}</span> = ${esc(g.en)}${g.ur && g.ur !== "—" ? " · " + esc(g.ur) : ""}</span>`;
    }).join(" ") || "None";
    const fam = [...new Set(ws.filter((x) => w.r && x.r === w.r && x.t !== w.t).map((x) => x.t))];
    sheet = `<div class="sheet" id="sheet">
      <div class="top2"><div><div class="eyebrow">Āyah ${w.a} · ${LABEL[lv(w.l)]}</div>
        <div><strong>${esc(w.en || "Meaning not added yet")}</strong></div>${w.ur ? `<div class="ur">${esc(w.ur)}</div>` : ""}</div>
        <div class="ar big">${arHTML(w)}</div></div>
      <dl class="kv"><dt>Parts</dt><dd>${parts}</dd>
        <dt>Base word</dt><dd><span class="ar" style="font-size:22px">${esc(w.l)}</span></dd>
        <dt>Root</dt><dd>${w.r ? `<span class="ar" style="font-size:22px">${esc([...w.r].join(" "))}</span>` : "None"}
        ${fam.length ? `<div class="note">Same root in this sūrah: <span class="ar" style="font-size:20px">${fam.map(esc).join("، ")}</span></div>` : ""}</dd></dl>
      <div class="btns">${hasMeaning(w) ? `<button class="btn primary" data-act="know">I know this</button><button class="btn" data-act="again">Show meaning again</button>` : ""}<button class="btn" data-act="close">Close</button></div></div>`;
  }
  let k = 0;
  app.innerHTML = `
    <section class="progress">
      <div class="eyebrow">Sūrah ${n} · ${meta.ayahs} āyāt · ${meta.words} words</div>
      <div class="row"><h1>${esc(meta.en)}</h1><span class="ar" style="font-size:30px">${esc(meta.ar)}</span></div>
      <div class="row"><span>Read without help</span><strong>${pct}% · ${ws.filter((w) => lv(w.l) >= 3).length} of ${ws.length} words</strong></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    </section>
    <div class="row">
      <div class="seg" aria-label="Meaning language">
        <button data-lang="both" aria-pressed="${lang === "both"}">Both</button>
        <button data-lang="en" aria-pressed="${lang === "en"}">English</button>
        <button data-lang="ur" aria-pressed="${lang === "ur"}">اردو</button>
      </div>
      ${meta.ready ? `<a class="btn primary" href="#/s/${n}/practise">Practise this sūrah</a>` : ""}
    </div>
    ${meta.ready ? "" : `<div class="banner">Meanings for this sūrah haven't been added yet. Tap any word to see its parts, base word and root.</div>`}
    ${sheet}
    <div class="verses ${lang === "en" ? "only-en" : lang === "ur" ? "only-ur" : ""}">
    ${d.ayahs.map((a) => {
      const faded = a.w.every((w) => lv(w.l) >= 2);
      return `<article class="verse"><div class="words">
        ${a.w.map((w) => {
          const i = k++;
          const pl = w.p.filter((x) => x[1] !== "s").map((x) => (idx.parts[x[2]] || {}).en).filter((x) => x && x !== "—");
          return `<button class="w lv${hasMeaning(w) ? lv(w.l) : 0}" data-k="${i}"><span class="ar">${arHTML(w)}</span>
            <span class="gl">${pl.length ? `<span class="parts">${esc(pl.join(" + "))}</span>` : ""}${w.en ? `<span class="en">${esc(w.en)}</span>` : ""}${w.ur ? `<span class="ur">${esc(w.ur)}</span>` : ""}</span></button>`;
        }).join("")}
        <span class="vn">﴿${arN(a.n)}﴾</span></div>
        ${a.en || a.ur ? `<div class="meaning${faded ? " faded" : ""}">${a.en ? `<span class="en">${esc(a.en)}</span>` : ""}${a.ur ? `<span class="ur">${esc(a.ur)}</span>` : ""}</div>` : ""}
      </article>`;
    }).join("")}
    </div>`;
  app.onclick = (e) => {
    const lb = e.target.closest("[data-lang]");
    if (lb) { state.lang = lb.dataset.lang; store.set("lang", state.lang); return reader(n); }
    const act = e.target.closest("[data-act]");
    if (act) {
      const w = ws[selected];
      if (act.dataset.act === "know") setLevel(w.l, lv(w.l) + 1);
      if (act.dataset.act === "again") setLevel(w.l, 0);
      selected = null; return reader(n);
    }
    const b = e.target.closest(".w"); if (!b) return;
    const i = +b.dataset.k, w = ws[i];
    if (hasMeaning(w) && lv(w.l) === 3 && !b.classList.contains("peek")) { b.classList.add("peek"); setLevel(w.l, 2); return; }
    selected = i; reader(n);
  };
}

// Practice: lowest level first, frequent words first
let q = null, qDone = 0;
async function practise(n) {
  const d = await surah(n), ws = allWords(d).filter(hasMeaning);
  if (!ws.length) { app.innerHTML = `<div class="banner">Meanings for this sūrah haven't been added yet, so there is nothing to practise.</div><a class="btn" href="#/s/${n}">Back to the sūrah</a>`; return; }
  const lang = state.lang === "ur" ? "ur" : "en";
  const next = () => {
    const lemmas = [...new Map(ws.map((w) => [w.l, w])).values()]
      .sort((a, b) => lv(a.l) - lv(b.l) || b.f - a.f || Math.random() - 0.5).slice(0, 4);
    const pick = lemmas[Math.floor(Math.random() * Math.min(2, lemmas.length))];
    const occ = ws.filter((w) => w.l === pick.l), w = occ[Math.floor(Math.random() * occ.length)];
    const right = meaningOf(w, lang);
    const wrong = [...new Set(ws.map((x) => meaningOf(x, lang)).filter((m) => m && m !== right))].sort(() => Math.random() - 0.5).slice(0, 3);
    q = { w, right, opts: [right, ...wrong].sort(() => Math.random() - 0.5), done: false, lang };
  };
  const draw = (fb = "What does the highlighted word mean?", marks = {}) => {
    const w = q.w, a = d.ayahs.find((x) => x.n === w.a);
    app.innerHTML = `<div class="row"><a class="btn" href="#/s/${n}">← ${esc(d.en)}</a><span class="note">Answered ${qDone}${state.combo >= 2 ? ` · streak ${state.combo}` : ""}</span></div>
      <section class="card quiz">
        <div class="note">This word: ${LABEL[lv(w.l)]}</div>
        <div class="ar big">${arHTML(w)}</div>
        <div class="ctx">${a.w.map((x) => (x === w ? `<b>${esc(x.t)}</b>` : esc(x.t))).join(" ")}</div>
        <div class="opts">${q.opts.map((o, i) => `<button class="opt${q.lang === "ur" ? " ur" : ""}${marks[i] ? " " + marks[i] : ""}" data-o="${i}">${esc(o)}</button>`).join("")}</div>
        <div class="fb">${fb}</div>
        ${q.done ? `<button class="btn primary" id="next">Next word</button>` : ""}
      </section>`;
  };
  next(); draw();
  app.onclick = (e) => {
    if (e.target.id === "next") { next(); return draw(); }
    const o = e.target.closest(".opt"); if (!o || q.done) return;
    q.done = true; qDone++;
    const i = +o.dataset.o, ok = q.opts[i] === q.right, marks = {};
    q.opts.forEach((x, j) => { if (x === q.right) marks[j] = "right"; });
    let fb;
    if (ok) {
      state.combo++; const p = state.combo >= 5 ? 20 : 10; addHoney(p); setLevel(q.w.l, lv(q.w.l) + 1);
      fb = `<span class="pts">+${p} honey</span> Correct. This meaning will fade a little more in the reader.`;
    } else {
      marks[i] = "wrong"; state.combo = 0; setLevel(q.w.l, lv(q.w.l) - 1);
      fb = "Not quite. The right meaning is marked, and you'll see this word again soon.";
    }
    draw(fb, marks);
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
  app.onclick = null;
}

function about() {
  app.innerHTML = `<h1>About</h1>
    <div class="card"><p>Quran Word Reader helps you understand Al-Fātiḥah and Juz ʿAmma directly in Arabic. Each word shows its meaning, which fades as you learn it.</p>
    <p class="note">Arabic text, word parts, base words and roots come from the Quranic Arabic Corpus (corpus.quran.com), version 0.4, as corrected in the open quran-morphology project. Word meanings are being added from open sources and will be credited here. Your progress stays on this device.</p>
    <p class="note">Install: open this page in Chrome (Android) or Safari (iPhone) and choose "Add to Home Screen". It works offline after the first visit.</p></div>
    <button class="btn" id="reset">Clear my progress</button><span class="note" id="resetmsg"></span>`;
  app.onclick = (e) => {
    if (e.target.id !== "reset") return;
    if (e.target.dataset.sure) { state.level = {}; store.set("level", {}); state.honey = 0; store.set("honey", 0); $("#jar").textContent = 0; $("#resetmsg").textContent = " Progress cleared."; delete e.target.dataset.sure; e.target.textContent = "Clear my progress"; }
    else { e.target.dataset.sure = "1"; e.target.textContent = "Tap again to clear everything"; }
  };
}

// ---------- router ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  const tab = h[0] === "parts" ? "parts" : h[0] === "hive" ? "hive" : h[0] === "about" ? "about" : "home";
  document.querySelectorAll(".tabs a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  app.onclick = null;
  try {
    if (h[0] === "s" && h[1]) {
      const n = +h[1];
      if (h[2] === "practise") await practise(n); else { if (route.last !== n) selected = null; route.last = n; await reader(n); }
    } else if (h[0] === "parts") await parts();
    else if (h[0] === "hive") await renderHive(app);
    else if (h[0] === "about") about();
    else await home();
  } catch (err) {
    app.innerHTML = `<div class="banner">This page couldn't load (${esc(err.message)}). Check your connection and try again.</div>`;
  }
  if (!h[2]) window.scrollTo(0, 0);
}
$("#jar").textContent = state.honey;
addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
