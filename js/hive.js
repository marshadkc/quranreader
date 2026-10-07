// Ayah Honeycomb: the Juz Amma review game.
// An āyah's words lie on a zig-zag path of cells from the right edge of a hexagon-shaped
// honeycomb to the left edge. Cells are answered in reading order; right = honey, wrong = red.
import { state, store, lv, withMeanings, CREDIT, ORDER, arN, esc, hasMeaning, meaningOf, addHoney } from "./app.js";

const UNLOCK = 80; // % of Juz Amma words known before the game opens

// ---------- geometry ----------
function comb(R) {
  const cells = [];
  for (let r = -R; r <= R; r++) {
    const lo = Math.max(-R, -R - r), hi = Math.min(R, R - r);
    for (let q = lo; q <= hi; q++) cells.push({ q, r, k: q + "," + r, x: q + r / 2, leftEnd: q === lo, rightEnd: q === hi });
  }
  return cells;
}
// The honeycomb grows with the āyah so a zig-zag path can always run edge to edge
const radiusFor = (n) => Math.max(1, Math.ceil((n - 1) / 4), Math.min(3, Math.round((n - 1) / 3)));
const STEPS = { W: [-1, 0], NW: [0, -1], SW: [-1, 1] }; // straight left and the two left diagonals

function walk(n, R) {
  const cells = comb(R), byKey = new Map(cells.map((c) => [c.k, c]));
  const starts = cells.filter((c) => c.rightEnd).sort(() => Math.random() - 0.5);
  let budget = 60000;
  for (const s of starts) {
    const seen = new Set([s.k]), path = [s.k];
    const pref = (m, last) => (m === "W" ? 1.6 + Math.random() : !last || last === "W" ? Math.random() : m !== last ? Math.random() * 0.7 : 0.6 + Math.random());
    const go = (c, last) => {
      if (--budget < 0) return false;
      const rem = n - path.length;
      if (rem === 0) return c.leftEnd;
      if (rem > 2 * (c.x + R) + 1) return false; // not enough room left for the remaining words
      const opts = Object.entries(STEPS).map(([m, [dq, dr]]) => ({ m, c: byKey.get(c.q + dq + "," + (c.r + dr)) }))
        .filter((o) => o.c && !seen.has(o.c.k)).sort((a, b) => pref(a.m, last) - pref(b.m, last));
      for (const o of opts) { seen.add(o.c.k); path.push(o.c.k); if (go(o.c, o.m)) return true; seen.delete(o.c.k); path.pop(); }
      return false;
    };
    if (go(s, null)) return path;
  }
  return null;
}
function layout(n) {
  for (let R = radiusFor(n); R <= 7; R++) { const p = walk(n, R); if (p) return { R, path: p }; }
  return { R: radiusFor(n), path: [] };
}

// ---------- game ----------
const letters = (t) => t.replace(/[ً-ٰٟۖ-ۭ]/g, "").length;
let g = null;

export async function renderHive(app) {
  const loaded = await Promise.all(ORDER.map(withMeanings));
  const juz = loaded.filter((d) => d.n !== 1);
  const words = juz.flatMap((d) => d.ayahs.flatMap((a) => a.w));
  const pool = juz.flatMap((d) => d.ayahs.filter((a) => a.w.every(hasMeaning)).map((a) => ({ s: d.n, name: d.en, a })));
  const known = Math.round((words.filter((w) => lv(w.l) >= 3).length / words.length) * 100);
  const preview = store.get("hivePreview", false);
  if (!pool.length) {
    app.innerHTML = `<h1>Ayah Honeycomb</h1><div class="banner">The honeycomb needs word meanings, and they haven't loaded for Juz ʿAmma yet. They come from Quran.com and need an internet connection at least once a week.</div>`;
    app.onclick = null; return;
  }
  if (known < UNLOCK && !preview) {
    app.innerHTML = `<h1>Ayah Honeycomb</h1><section class="card locked">
      <p>The honeycomb is the review game for the whole juz. It opens when you can read ${UNLOCK}% of Juz ʿAmma's words without help.</p>
      <div class="track" style="width:100%"><div class="fill" style="width:${known}%"></div></div>
      <p class="note">You're at ${known}%. Keep reading and practising each sūrah.</p>
      <button class="btn" id="preview">Try it now anyway</button></section>`;
    app.onclick = (e) => { if (e.target.id === "preview") { store.set("hivePreview", true); renderHive(app); } };
    return;
  }
  const distract = [...new Set(words.filter(hasMeaning).map((w) => w))];
  if (!g) g = { mode: "pick", nums: [], done: new Set(), R: 2, path: [], res: [], active: null, combo: 0, gain: null, last: null, fresh: false };
  const deal = () => { g.nums = [...pool].sort(() => Math.random() - 0.5).slice(0, 7); };
  if (!g.nums.length) deal();

  const hasUr = words.some((w) => w.ur);
  const lang = () => (state.lang === "ur" && hasUr ? "ur" : "en");
  const size = () => {
    const cols = 2 * g.R + 1, gap = 3, avail = Math.min(app.clientWidth - 32, 620);
    const cw = Math.max(30, Math.min(76, Math.floor((avail - gap * cols) / cols)));
    return { cw, h: cw * 1.1547, sx: cw + gap, sy: cw * 1.1547 * 0.75 + gap * 0.87 };
  };
  const opts = (w) => {
    const right = meaningOf(w, lang());
    const wrong = [...new Set(distract.map((x) => meaningOf(x, lang())).filter((m) => m && m !== right))].sort(() => Math.random() - 0.5).slice(0, 3);
    g.opts = [right, ...wrong].sort(() => Math.random() - 0.5); g.right = right;
  };
  const honey = (p, msg) => { addHoney(p); g.gain = `+${p} honey${msg ? " · " + msg : ""}`; };

  function draw() {
    const cur = g.cur, ws = cur ? cur.a.w : [];
    const { cw, h, sx, sy } = size(), R = g.R, idx = new Map(g.path.map((k, i) => [k, i]));
    const next = g.res.indexOf(null);
    const cells = comb(R).map((c) => {
      const left = (c.x + R) * sx, top = (c.r + R) * sy;
      let cls = "", inner = "", fs = cw * 0.3, tag = "div", attrs = "", delay = "";
      if (cur && idx.has(c.k)) {
        const i = idx.get(c.k), res = g.res[i], t = ws[i].t;
        fs = Math.min(cw * 0.3, (cw * 1.25) / Math.max(3, letters(t)));
        if (res === "right") { cls = "done"; inner = `<span class="ar">${esc(t)}</span>`; }
        else if (res === "wrong") { cls = "bad"; inner = `<span class="ar">${esc(t)}</span>`; }
        else if (g.active === i) { cls = "active"; inner = `<span class="ar">${esc(t)}</span>`; }
        else if (i === next && g.active === null) { cls = "hid next"; tag = "button"; attrs = `data-cell="${i}" aria-label="Reveal word ${i + 1} of ${ws.length}"`; }
        else cls = "hid";
        if (g.fresh) { cls += " appear"; delay = `animation-delay:${i * 60}ms;`; }
      }
      return `<${tag} class="hex ${cls}" ${attrs} style="left:${left}px;top:${top}px;--fs:${fs.toFixed(1)}px;${delay}"><span>${inner}</span></${tag}>`;
    }).join("");
    g.fresh = false;
    const busy = g.mode === "play";
    let panel;
    const gain = g.gain ? `<div class="pts">${g.gain}</div>` : "", last = g.last ? `<div class="note">${g.last}</div>` : "";
    if (g.mode === "pick") panel = `<div>Choose an āyah above. Its cells light up from the right edge of the honeycomb.</div>
      <div class="note">10 honey for each right answer, doubled after five in a row. Finish an āyah for 20 more, or 50 if every word was right.</div>`;
    else if (busy && g.active === null) panel = `${gain}${last}<div>${esc(cur.name)} ${cur.s}:${cur.a.n} · ${g.res.filter((x) => !x).length} of ${ws.length} cells left</div>
      <div class="note">Tap the glowing cell to reveal the next word.</div><button class="btn" id="back">Choose another āyah</button>`;
    else if (busy) {
      const w = ws[g.active];
      panel = `<div class="note">Word ${g.active + 1} of ${ws.length} · ${cur.s}:${cur.a.n}</div><div class="ar big" style="font-size:40px;line-height:1.6">${esc(w.t)}</div><div>What does it mean?</div>
        <div class="opts">${g.opts.map((o, i) => `<button class="opt${lang() === "ur" ? " ur" : ""}" data-o="${i}">${esc(o)}</button>`).join("")}</div>`;
    } else {
      const right = g.res.filter((x) => x === "right").length;
      panel = `${gain}${last}<div><strong style="color:var(--good)">${esc(cur.name)} ${cur.s}:${cur.a.n} complete.</strong> ${right} of ${ws.length} words right.</div>
        ${cur.a.en || cur.a.ur ? `<div>${esc(cur.a.en || "")}</div><div class="ur">${esc(cur.a.ur || "")}</div>` : ""}<button class="btn honey" id="back">Next āyah</button>`;
    }
    app.innerHTML = `<h1>Ayah Honeycomb</h1>
      <p class="sub">Choose an āyah. Tap the glowing cell to see its word, then pick the meaning. Right answers fill with honey; wrong ones turn red.</p>
      <div class="picker">${g.nums.map((p) => `<button class="nb${g.done.has(p.s + ":" + p.a.n) ? " won" : ""}" data-p="${p.s}:${p.a.n}" aria-pressed="${cur === p}" ${busy ? "disabled" : ""}><span>${p.s}:${p.a.n}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="deal" ${busy ? "disabled" : ""}>New āyāt</button>${g.combo >= 2 ? `<span class="note">Streak ${g.combo}${g.combo >= 5 ? " · double honey" : ""}</span>` : ""}</div>
      <div class="comb" id="comb" style="--cw:${cw}px;width:${(2 * R + 1) * sx - 3}px;height:${2 * R * sy + h}px">${cells}</div>
      <section class="card quiz">${panel}</section>${CREDIT}`;
  }
  const start = (p) => { const L = layout(p.a.w.length); Object.assign(g, { mode: "play", cur: p, R: L.R, path: L.path, res: p.a.w.map(() => null), active: null, gain: null, last: null, fresh: true }); draw(); };
  const toPick = () => { Object.assign(g, { mode: "pick", cur: null, path: [], res: [], active: null, gain: null, last: null, R: 2 }); draw(); };

  app.onclick = (e) => {
    const t = e.target.closest("button"); if (!t || t.disabled) return;
    if (t.dataset.p) return start(g.nums.find((p) => p.s + ":" + p.a.n === t.dataset.p));
    if (t.id === "deal") { deal(); return toPick(); }
    if (t.id === "back") return toPick();
    if (t.dataset.cell !== undefined && g.mode === "play" && g.active === null) { g.active = +t.dataset.cell; opts(g.cur.a.w[g.active]); g.gain = null; return draw(); }
    if (t.dataset.o !== undefined && g.active !== null) {
      const i = g.active, w = g.cur.a.w[i], ok = g.opts[+t.dataset.o] === g.right;
      g.res[i] = ok ? "right" : "wrong"; g.active = null; g.gain = null;
      if (ok) { g.combo++; honey(g.combo >= 5 ? 20 : 10, g.combo >= 5 ? "streak" : ""); g.last = null; }
      else { g.combo = 0; g.last = `<span style="color:var(--bad)">Not quite.</span> <span class="ar">${esc(w.t)}</span> means <strong>${esc(g.right)}</strong>.`; }
      if (g.res.every(Boolean)) {
        g.mode = "won"; g.done.add(g.cur.s + ":" + g.cur.a.n);
        const perfect = g.res.every((x) => x === "right");
        honey(perfect ? 50 : 20, perfect ? "perfect āyah" : "āyah complete");
      }
      return draw();
    }
  };
  draw();
}
