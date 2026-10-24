// Read in Mushaf: the Quran as the Indo-Pak 16-line muṣḥaf prints it (Taj Company layout, 548 pages), one page
// at a time, with the tajweed rules in colour. Pages: data/mushaf/PPP.json, built by tools/build_mushaf.py.
import { esc, arN, index, withMeanings, meaningOf, state, store } from "./app.js";
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

export async function mushaf(arg, s, a) {
  const app = $("#app"), [m, idx] = await Promise.all([mindex(), index()]);
  let p = arg === "s" ? await pageOf(+s, +a || 1) : Math.min(Math.max(1, +arg || store.get("mushafPage", 1)), m.pages);
  if (arg === "s") history.replaceState(null, "", `#/mushaf/${p}`);
  const d = await page(p);
  store.set("mushafPage", p);
  const tj = store.get("tajweed", true), locs = d.l.flatMap((l) => (l[0] === "t" ? l[2].map((w) => w[0]) : [])).filter((x) => !x.endsWith(":e"));
  const [s0, a0] = (locs[0] || "1:1").split(":").map(Number), suras = [...new Set(locs.map((x) => +x.split(":")[0]))];
  const juz = JUZ.findIndex((_, j) => inJuz(j + 1, s0, a0)) + 1;
  app.innerHTML = `<div class="row mbar">
      <a class="btn" href="#/s/${s0}/${a0}">← Word by word</a>
      <div class="row pager"><button class="btn" id="mnext" ${p >= m.pages ? "disabled" : ""} aria-label="Next page">‹ Next</button>
        <label class="note">Page <input id="mpage" type="number" inputmode="numeric" min="1" max="${m.pages}" value="${p}"> of ${m.pages}</label>
        <button class="btn" id="mprev" ${p <= 1 ? "disabled" : ""} aria-label="Previous page">Previous ›</button></div>
      <button class="btn${tj ? " on" : ""}" id="mtj" aria-pressed="${tj}">Tajweed colours</button></div>
    ${tj ? `<div class="legend">${RULES.map(([k, en, ur, what]) => `<span class="chip" title="${esc(what)}"><i class="t-${k}">●</i> ${en} <span class="ur">${ur}</span></span>`).join("")}</div>` : ""}
    <section class="mpage${tj ? " tj" : ""}" dir="rtl" aria-label="Muṣḥaf page ${p}">
      <header><span class="ar">${suras.map((n) => esc(idx.surahs[n - 1].ar)).join(" · ")}</span><span class="note">Juz ${juz} · ${suras.map((n) => esc(idx.surahs[n - 1].en)).join(" · ")}</span></header>
      <div class="mlines" id="mlines">${d.l.map((l) => lineHTML(l, idx)).join("")}</div>
      <footer class="ar">${arN(p)}</footer>
    </section>
    <div id="mpop"></div>
    <p class="note">Swipe or use the arrow keys to turn the page. Tap a word for its meaning.</p>
    <p class="note credit">Page layout: the Indo-Pak 16-line muṣḥaf (Taj Company), from QUL (Tarteel's Quranic Universal Library). Indo-Pak text and tajweed marks from <a href="https://quran.com" target="_blank" rel="noopener">Quran.com</a>; font: AlQuran IndoPak by QuranWBW.</p>`;
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  // keep the next page ready
  if (p < m.pages) page(p + 1).catch(() => {});
  const go = (q) => { if (q >= 1 && q <= m.pages && q !== p) location.hash = `#/mushaf/${q}`; };
  app.onclick = async (e) => {
    if (e.target.closest("#mnext")) return go(p + 1);
    if (e.target.closest("#mprev")) return go(p - 1);
    if (e.target.closest("#mtj")) { store.set("tajweed", !tj); return mushaf(String(p)); }
    if (e.target.closest(".mpclose")) { $("#mpop").innerHTML = ""; app.querySelectorAll(".mw.sel").forEach((x) => x.classList.remove("sel")); return; }
    const w = e.target.closest(".mw"); if (!w) return;
    app.querySelectorAll(".mw.sel").forEach((x) => x.classList.remove("sel")); w.classList.add("sel");
    const [ws, wa, wi] = w.dataset.loc.split(":").map(Number);
    const sd = await withMeanings(ws).catch(() => null), word = sd?.ayahs.find((x) => x.n === wa)?.w[wi - 1];
    const langs = state.langs.length ? state.langs : ["en", "ur"];
    $("#mpop").innerHTML = `<div class="card mpop"><div class="row"><span class="ar" style="font-size:30px">${esc(word ? word.t : w.textContent)}</span><span class="note">${ws}:${wa}</span><button class="btn mpclose" aria-label="Close">×</button></div>
      ${word ? langs.map((l) => `<div class="${l === "ur" ? "ur" : ""}" lang="${l}">${esc(meaningOf(word, l))}</div>`).join("") : ""}
      <a class="btn" href="#/ayah/${ws}/${wa}/${wi}">Open this word's card</a></div>`;
  };
  app.onchange = (e) => { if (e.target.id === "mpage") go(Math.min(Math.max(1, +e.target.value || p), m.pages)); };
  // swipe right for the next page, as a muṣḥaf's pages turn
  const pg = $(".mpage");
  pg.addEventListener("touchstart", (e) => { pg.dataset.x = e.touches[0].clientX; pg.dataset.y = e.touches[0].clientY; }, { passive: true });
  pg.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - pg.dataset.x, dy = e.changedTouches[0].clientY - pg.dataset.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? p + 1 : p - 1);
  });
  mushaf.go = go; mushaf.p = p;
}
addEventListener("keydown", (e) => {
  if (!location.hash.startsWith("#/mushaf") || !mushaf.go || e.target.matches("input,select,textarea")) return;
  if (e.key === "ArrowLeft") mushaf.go(mushaf.p + 1);
  if (e.key === "ArrowRight") mushaf.go(mushaf.p - 1);
});
addEventListener("resize", () => { if (location.hash.startsWith("#/mushaf")) fit(); });
