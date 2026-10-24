// Read in Mushaf: the Quran as the Indo-Pak 15-line ḥifẓ muṣḥaf prints it (Qudratullah layout, 610 pages), one page
// at a time, with the tajweed rules in colour. Pages: data/mushaf/PPP.json, built by tools/build_mushaf.py.
import { esc, arN, index, withMeanings, store, mushafCard, cardAct } from "./app.js";
import { JUZ, inJuz } from "./hive.js";

const $ = (s, el = document) => el.querySelector(s);
// one colour per rule: [code, English, Urdu, what it means]
export const RULES = [
  ["gh", "Ghunna", "غُنّہ", "a nasal sound held for two counts, on نّ and مّ"],
  ["ik", "Ikhfa", "اِخفاء", "ن sākin or tanwīn hidden before 15 letters, with ghunna (also مۡ before ب)"],
  ["iq", "Iqlab", "اِقلاب", "ن sākin or tanwīn before ب is read as م"],
  ["id", "Idgham", "اِدغام", "merged into the next letter (ن sākin or tanwīn before ي ر م ل و ن, and similar letters)"],
  ["qa", "Qalqala", "قلقلہ", "an echo on ق ط ب ج د when they have a sukūn"],
  ["md", "Madd", "مدّ", "a long vowel stretched beyond two counts"],
  ["sl", "Silent", "خاموش", "written but not read when joined to the word before"],
];
const BISMILLAH = "بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ";
let IDX = null;
const PAGES = new Map();
const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
const mindex = () => (IDX ||= json("data/mushaf/index.json").catch((e) => { IDX = null; throw e; }));
const page = (p) => { if (!PAGES.has(p)) PAGES.set(p, json(`data/mushaf/${String(p).padStart(3, "0")}.json`).catch((e) => { PAGES.delete(p); throw e; })); return PAGES.get(p); };
// the page where an āyah starts
export const pageOf = async (s, a = 1) => { const m = await mindex(); const at = m.at[s] || m.at[String(s)]; return at ? at[Math.max(0, Math.min(at.length, a) - 1)] : 1; };

const wordHTML = ([loc, t, marks]) => {
  if (loc.endsWith(":e")) return `<span class="me">${esc(t)}</span>`;
  let h = "", at = 0;
  for (const [s, e, r] of marks) { h += esc(t.slice(at, s)) + `<span class="t-${r}">${esc(t.slice(s, e))}</span>`; at = e; }
  return `<span class="mw" data-loc="${loc}">${h + esc(t.slice(at))}</span>`;
};
const lineHTML = (l, idx) => {
  if (l[0] === "s") { const m = idx.surahs[l[1] - 1]; return `<div class="ml sura"><span>سُوۡرَةُ ${esc(m.ar)}</span></div>`; }
  if (l[0] === "b") return `<div class="ml bism">${BISMILLAH}</div>`;
  if (!l[2].length) return "";
  return `<div class="ml${l[1] ? " mid" : ""}">${l[2].map(wordHTML).join("")}</div>`;
};
// the size that lets the longest line fit the page's width
function fit() {
  const box = $("#mlines"); if (!box) return;
  box.style.fontSize = "40px"; box.classList.add("measure");
  const w = box.clientWidth, widest = Math.max(...[...box.children].map((x) => x.scrollWidth));
  box.classList.remove("measure");
  box.style.fontSize = Math.min(40, Math.floor((40 * w * 0.985) / widest * 10) / 10) + "px";
}

// arg: a page number, or "s" with a sūrah, āyah and word (that word is marked on its page)
export async function mushaf(arg, s, a, w) {
  const app = $("#app"), [m, idx] = await Promise.all([mindex(), index()]);
  let p = arg === "s" ? await pageOf(+s, +a || 1) : Math.min(Math.max(1, +arg || store.get("mushafPage15", 1)), m.pages);
  if (arg === "s") history.replaceState(null, "", `#/mushaf/${p}`);
  const d = await page(p);
  store.set("mushafPage15", p);
  const tj = store.get("tajweed", true), locs = d.l.flatMap((l) => (l[0] === "t" ? l[2].map((w) => w[0]) : [])).filter((x) => !x.endsWith(":e"));
  const [s0, a0] = (locs[0] || "1:1").split(":").map(Number), suras = [...new Set(locs.map((x) => +x.split(":")[0]))];
  const juz = JUZ.findIndex((_, j) => inJuz(j + 1, s0, a0)) + 1;
  const pager = (where) => `<div class="row pager ${where}"><button class="btn" data-go="1" ${p >= m.pages ? "disabled" : ""} aria-label="Next page">‹ Next</button>
      <label class="note">Page <input class="mpage-in" type="number" inputmode="numeric" min="1" max="${m.pages}" value="${p}"> of ${m.pages}</label>
      <button class="btn" data-go="-1" ${p <= 1 ? "disabled" : ""} aria-label="Previous page">Previous ›</button></div>`;
  app.innerHTML = `<div class="row mbar">
      <a class="btn" href="#/s/${s0}/${a0}">← Word by word</a>
      <button class="btn${tj ? " on" : ""}" id="mtj" aria-pressed="${tj}">Tajweed colours</button></div>
    ${tj ? `<div class="legend">${RULES.map(([k, en, ur, what]) => `<a class="chip" href="#/tajweed/${k}" title="${esc(what)}"><i class="t-${k}">●</i> ${en} <span class="ur">${ur}</span></a>`).join("")}<a class="chip guide" href="#/tajweed">What do the colours mean?</a></div>` : ""}
    ${pager("above")}
    <section class="mpage${tj ? " tj" : ""}" dir="rtl" aria-label="Muṣḥaf page ${p}">
      <header><span class="ar">${suras.map((n) => esc(idx.surahs[n - 1].ar)).join(" · ")}</span><span class="note">Juz ${juz} · ${suras.map((n) => esc(idx.surahs[n - 1].en)).join(" · ")}</span></header>
      <div class="mlines" id="mlines">${d.l.map((l) => lineHTML(l, idx)).join("")}</div>
      <footer class="ar">${arN(p)}</footer>
    </section>
    ${pager("below")}
    <div id="sheetbox"></div>
    <p class="note">Swipe or use the arrow keys to turn the page. Tap a word for its word card.</p>
    <p class="note credit">Page layout: the Indo-Pak 15-line ḥifẓ muṣḥaf (Qudratullah), from QUL (Tarteel's Quranic Universal Library). Indo-Pak text and tajweed marks from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>; font: AlQuran IndoPak by QuranWBW.</p>`;
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  // keep the next page ready
  if (p < m.pages) page(p + 1).catch(() => {});
  const go = (q) => { if (q >= 1 && q <= m.pages && q !== p) location.hash = `#/mushaf/${q}`; };
  app.onclick = async (e) => {
    const g = e.target.closest("[data-go]"); if (g) return go(p + +g.dataset.go);
    if (e.target.closest("#mtj")) { store.set("tajweed", !tj); return mushaf(String(p)); }
    const act = e.target.closest("[data-act]"); if (act) return cardAct(act, idx);
    const w = e.target.closest(".mw"); if (!w) return;
    app.querySelectorAll(".mw.sel").forEach((x) => x.classList.remove("sel")); w.classList.add("sel");
    const [ws, wa, wi] = w.dataset.loc.split(":").map(Number);
    const sd = await withMeanings(ws).catch(() => null), ay = sd?.ayahs.find((x) => x.n === wa);
    if (ay && ay.w[wi - 1] && w.isConnected) mushafCard(ay.w, wi - 1, idx);
  };
  app.onchange = (e) => { if (e.target.classList.contains("mpage-in")) go(Math.min(Math.max(1, +e.target.value || p), m.pages)); };
  // swipe right for the next page, as a muṣḥaf's pages turn
  const pg = $(".mpage");
  pg.addEventListener("touchstart", (e) => { pg.dataset.x = e.touches[0].clientX; pg.dataset.y = e.touches[0].clientY; }, { passive: true });
  pg.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - pg.dataset.x, dy = e.changedTouches[0].clientY - pg.dataset.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? p + 1 : p - 1);
  });
  mushaf.go = go; mushaf.p = p;
  const hit = arg === "s" && w && $(`.mw[data-loc="${+s}:${+a}:${+w}"]`);
  if (hit) { hit.classList.add("found"); hit.scrollIntoView({ block: "center" }); return true; }
}

// the colour guide: how to read each rule, with real words from the muṣḥaf
const GUIDE = {
  gh: ["Hold a nasal sound, through the nose, for about two counts whenever ن or م has a shadda (نّ مّ).", [["2:6:1"], ["114:5:5"]]],
  ik: ["When ن sākin (نۡ) or tanwīn comes before one of these 15 letters, don't say the ن clearly. Hide it in a light nasal sound for two counts, then go into the next letter: ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك. A مۡ before ب is hidden the same way.", [["2:4:7"], ["113:3:1", "113:3:2"]]],
  iq: ["ن sākin or tanwīn before ب turns into a م sound, held with ghunna for two counts. The muṣḥaf shows a small م above it.", [["2:27:5", "2:27:6"], ["2:10:9", "2:10:10"]]],
  id: ["ن sākin or tanwīn before one of ي ر م ل و ن (يَرۡمَلُوۡنَ) merges into that letter, which is then read doubled. Before ي ن م و the ghunna stays; before ل ر there is none. Some other close letters merge the same way, like مۡ before م.", [["2:8:3", "2:8:4"], ["112:4:2", "112:4:3"]]],
  qa: ["The five letters ق ط ب ج د (قُطۡبُ جَدٍّ) bounce with a small echo when they have a sukūn, or when you stop on them. The echo is strongest at the end of an āyah.", [["112:2:2"], ["113:1:4"]]],
  md: ["A long vowel (ا و ي) stretched for four to six counts: when a hamza comes after it, when a shadda or sukūn comes after it, or when you stop at the end of an āyah. The ordinary two-count madd is left without a colour.", [["1:7:9"], ["2:1:1"]]],
  sl: ["Written but not read: the ا of اَلۡ and of other joining alifs when the word before runs into it, and the ل of اَلۡ before a sun letter (ت ث د ذ ر ز س ش ص ض ط ظ ل ن), where the next letter is read doubled instead.", [["1:3:1"], ["2:3:3"]]],
};
export async function tajweedGuide(rule) {
  const app = $("#app"), words = new Map(), locs = Object.values(GUIDE).flatMap(([, ex]) => ex.flat());
  await Promise.all(locs.map(async (loc) => {
    const [s, a] = loc.split(":").map(Number), d = await page(await pageOf(s, a));
    for (const l of d.l) if (l[0] === "t") for (const w of l[2]) if (w[0] === loc) words.set(loc, w);
  }));
  app.innerHTML = `<h1>Tajweed colours</h1>
    <p class="sub">In <em>Read in Mushaf</em> each colour shows a rule of tajweed: how the coloured letters are read. Tap an example to see it on its muṣḥaf page.</p>
    ${RULES.map(([k, en, ur]) => `<div class="card tjrule" id="t-${k}"><h2><i class="t-${k}">●</i> ${en} <span class="ur">${ur}</span></h2>
      <p>${esc(GUIDE[k][0]).replace(/[\u0600-\u06ff]+(?: [\u0600-\u06ff]+)*/g, (x) => `<span class="tjar" dir="rtl">${x}</span>`)}</p>
      <div class="row tjex">${GUIDE[k][1].map((ex) => { const [s, a, w] = ex[0].split(":"); return `<a class="mpage tj" dir="rtl" href="#/mushaf/s/${s}/${a}/${w}">${ex.map((loc) => (words.has(loc) ? wordHTML(words.get(loc)) : "")).join(" ")}<span class="note">${s}:${a}</span></a>`; }).join("")}</div></div>`).join("")}
    <p class="note">Without a colour: everything else, including the ordinary two-count madd. The colours follow the tajweed data of <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>; the muṣḥaf's own signs are unchanged.</p>
    <p><a class="btn primary" href="#/mushaf">📖 Back to the Mushaf</a></p>`;
  const el = rule && document.getElementById(`t-${rule}`);
  if (el) { el.scrollIntoView({ block: "start" }); return true; }
}

addEventListener("keydown", (e) => {
  if (!location.hash.startsWith("#/mushaf") || !mushaf.go || e.target.matches("input,select,textarea")) return;
  if (e.key === "ArrowLeft") mushaf.go(mushaf.p + 1);
  if (e.key === "ArrowRight") mushaf.go(mushaf.p - 1);
});
addEventListener("resize", () => { if (location.hash.startsWith("#/mushaf")) fit(); });
