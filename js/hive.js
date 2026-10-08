// Ayah Honeycomb: the Juz Amma review game.
// An āyah's words lie on a zig-zag path of cells from the right edge of a hexagon-shaped
// honeycomb to the left edge. Cells are answered in reading order; right = honey, wrong = red.
import { store, withMeanings, index, CREDIT, esc, hasMeaning, meaningOf, addHoney, quizLang, quizLangHTML, setQuizLang, distractors, bothHTML } from "./app.js";

// First pick a sūrah or a juz, then play the āyāt you have practised in it ("Practise up to here"
// remembers how far, per sūrah) or all of it.
// Where each juz starts: [sūrah, āyah]
const JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
const inJuz = (j, s, a) => { const [s0, a0] = JUZ[j - 1], [s1, a1] = JUZ[j] || [115, 1]; return (s > s0 || (s === s0 && a >= a0)) && (s < s1 || (s === s1 && a < a1)); };
const MAX = 20; // longer āyāt are played in parts of at most this many words, so each fits the honeycomb
function units(d) {
  return d.ayahs.filter((a) => a.w.every(hasMeaning)).flatMap((a) => {
    const parts = Math.ceil(a.w.length / MAX), size = Math.ceil(a.w.length / parts);
    return Array.from({ length: parts }, (_, i) => {
      const label = `${d.n}:${a.n}${parts > 1 ? ` (${i + 1}/${parts})` : ""}`;
      return { s: d.n, n: a.n, name: d.en, key: label, label, a: parts > 1 ? { n: a.n, w: a.w.slice(i * size, (i + 1) * size) } : a };
    });
  });
}

// ---------- geometry ----------
function comb(R) {
  const cells = [];
  for (let r = -R; r <= R; r++) {
    const lo = Math.max(-R, -R - r), hi = Math.min(R, R - r);
    for (let q = lo; q <= hi; q++) cells.push({ q, r, k: q + "," + r, x: q + r / 2, leftEnd: q === lo, rightEnd: q === hi });
  }
  return cells;
}
// The path flows like a river: from the right edge to the left edge in smooth diagonal runs that swing
// between the top and bottom of the comb. It never drops straight down or up (two diagonals that cancel
// sideways), and only bends back to the right now and then when a long āyah needs the room.
const radiusFor = (n) => (n < 2 ? 0 : Math.max(1, Math.ceil((n - 1) / 5)));
const STEPS = { W: [-1, 0], NW: [0, -1], SW: [-1, 1], NE: [1, -1], SE: [0, 1] };
const VERT = { NW: "up", NE: "up", SW: "down", SE: "down" }, BACK = new Set(["NE", "SE"]);
const STRAIGHT = new Set(["NW,NE", "NE,NW", "SW,SE", "SE,SW", "NE,SE", "SE,NE"]); // waterfalls and sharp hooks

function walk(n, R) {
  const cells = comb(R), byKey = new Map(cells.map((c) => [c.k, c]));
  // fewest steps from each cell to the left edge, to drop paths that can no longer finish in time
  const dist = new Map(), queue = cells.filter((c) => c.leftEnd);
  queue.forEach((c) => dist.set(c.k, 0));
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]) {
      const x = byKey.get(c.q + dq + "," + (c.r + dr));
      if (x && !dist.has(x.k)) { dist.set(x.k, dist.get(c.k) + 1); queue.push(x); }
    }
  }
  // longer āyāt like to start in the top or bottom corner and flow across to the far side
  const starts = cells.filter((c) => c.rightEnd).map((c) => ({ c, o: Math.random() - (n > 2 * R + 3 && Math.abs(c.r) === R ? 0.6 : 0) })).sort((a, b) => a.o - b.o).map((x) => x.c);
  let budget = 80000;
  for (const s of starts) {
    const seen = new Set([s.k]), path = [s.k];
    let head = s.r < 0 ? "down" : s.r > 0 ? "up" : Math.random() < 0.5 ? "up" : "down";
    const go = (c, last, run) => {
      if (--budget < 0) return false;
      const rem = n - path.length;
      if (rem === 0) return c.leftEnd;
      if (dist.get(c.k) > rem) return false;
      // room to spare: cells left over if the river ran straight to the left edge from here
      const spare = rem - Math.ceil((c.x + R) * 2);
      const was = head;
      if ((head === "up" && c.r === -R) || (head === "down" && c.r === R) || (run >= 2 * R && Math.random() < 0.5)) head = head === "up" ? "down" : "up";
      const pref = (m) => {
        if (BACK.has(m)) return spare > 0 ? 2 + Math.random() : 9; // a bend back right: only when needed
        const v = VERT[m];
        if (m === last) return Math.random() * 0.5; // keep flowing the same way
        if (v === head) return 0.3 + Math.random() * 0.5;
        if (m === "W") return 0.6 + Math.random() * 0.6;
        return 1.4 + Math.random();
      };
      const opts = Object.entries(STEPS).map(([m, [dq, dr]]) => ({ m, c: byKey.get(c.q + dq + "," + (c.r + dr)) }))
        .filter((o) => o.c && !seen.has(o.c.k) && !STRAIGHT.has(last + "," + o.m)).map((o) => ({ ...o, p: pref(o.m) })).sort((a, b) => a.p - b.p);
      for (const o of opts) {
        seen.add(o.c.k); path.push(o.c.k);
        if (go(o.c, o.m, o.m === last ? run + 1 : 1)) return true;
        seen.delete(o.c.k); path.pop();
      }
      head = was;
      return false;
    };
    if (go(s, null, 0)) return path;
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
  const idx = await index();
  const lastPrac = store.get("lastPrac", 0);
  const src = store.get("hiveSrc", lastPrac ? { k: "s", n: lastPrac } : { k: "j", n: 30 });
  const nums = src.k === "s" ? [src.n] : [...new Set(idx.surahs.map((s) => s.n).filter((s) => [...Array(idx.surahs[s - 1].ayahs)].some((_, i) => inJuz(src.n, s, i + 1))))];
  const loaded = await Promise.all(nums.map(withMeanings));
  const words = loaded.flatMap((d) => d.ayahs.flatMap((a) => a.w));
  const every = loaded.flatMap(units).filter((p) => src.k === "s" || inJuz(src.n, p.s, p.n));
  const practised = every.filter((p) => p.n <= store.get("upto." + p.s, 0));
  const scope = practised.length && store.get("hiveScope", "practised") === "practised" ? "practised" : "all";
  const pool = scope === "practised" ? practised : every;
  const srcName = src.k === "s" ? `Sūrah ${src.n} · ${idx.surahs[src.n - 1].en}` : `Juz ${src.n}`;
  const srcKey = src.k + src.n + scope;
  // Step 1: Sūrah or Juz. Step 2: a sūrah from the list, or a juz number from the grid.
  const name = (n) => `${n}. ${idx.surahs[n - 1].en}`;
  const choose = `<div class="srcpick">
      <div class="seg" aria-label="Play from"><button data-kind="s" aria-pressed="${src.k === "s"}">Sūrah</button><button data-kind="j" aria-pressed="${src.k === "j"}">Juz</button></div>
      ${src.k === "s"
        ? `<select id="hsrc" aria-label="Sūrah">${idx.surahs.map((s) => `<option value="${s.n}" ${src.n === s.n ? "selected" : ""}>${esc(name(s.n))}</option>`).join("")}</select>`
        : `<div class="juzgrid" role="group" aria-label="Juz">${JUZ.map(([s, a], i) => `<button data-juz="${i + 1}" aria-pressed="${src.n === i + 1}" title="Juz ${i + 1} starts at ${esc(idx.surahs[s - 1].en)} ${s}:${a}">${i + 1}</button>`).join("")}</div>`}</div>`;
  const pickSrc = (k, n) => { store.set("hiveSrc", { k, n }); store.set("hiveScope", "practised"); g = null; return renderHive(app); };
  app.onchange = (e) => { if (e.target.id === "hsrc") pickSrc("s", +e.target.value); };
  if (!every.length) {
    app.innerHTML = `<h1>Ayah Honeycomb</h1>${choose}<div class="banner">${esc(srcName)} has no word meanings loaded yet.</div>`;
    app.onclick = null; return;
  }
  const distract = words.filter(hasMeaning);
  if (g && g.srcKey !== srcKey) g = null;
  if (!g) g = { srcKey, mode: "pick", nums: [], done: new Set(), R: 2, path: [], res: [], active: null, combo: 0, gain: null, last: null, fresh: false };
  const deal = () => { g.nums = [...pool].sort(() => Math.random() - 0.5).slice(0, 7); };
  if (!g.nums.length) deal();

  const lang = () => quizLang(words);
  const size = () => {
    const cols = 2 * g.R + 1, gap = 3, avail = Math.min(app.clientWidth - 32, 620);
    const cw = Math.max(30, Math.min(76, Math.floor((avail - gap * cols) / cols)));
    return { cw, h: cw * 1.1547, sx: cw + gap, sy: cw * 1.1547 * 0.75 + gap * 0.87 };
  };
  // options are words, not text, so switching the answer language keeps the same question
  const opts = (w) => { g.opts = [w, ...distractors(w, distract)].sort(() => Math.random() - 0.5); };
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
    const gain = g.gain ? `<div class="pts">${g.gain}</div>` : "";
    const last = g.last ? `<div class="note"><span style="color:var(--bad)">Not quite.</span> <span class="ar">${esc(g.last.t)}</span> means ${bothHTML(g.last)}.</div>` : "";
    if (g.mode === "pick") panel = `<div>Choose an āyah above. Its cells light up from the right edge of the honeycomb.</div>
      <div class="note">10 honey for each right answer, doubled after five in a row. Finish an āyah for 20 more, or 50 if every word was right.</div>`;
    else if (busy && g.active === null) panel = `${gain}${last}<div>${esc(cur.name)} ${cur.label} · ${g.res.filter((x) => !x).length} of ${ws.length} cells left</div>
      <div class="note">Tap the glowing cell to reveal the next word.</div><button class="btn" id="back">Choose another āyah</button>`;
    else if (busy) {
      const w = ws[g.active];
      panel = `<div class="note">Word ${g.active + 1} of ${ws.length} · ${cur.label}</div><div class="ar big" style="font-size:40px;line-height:1.6">${esc(w.t)}</div><div>What does it mean?</div>
        <div class="opts">${g.opts.map((o, i) => `<button class="opt${lang() === "ur" ? " ur" : ""}" data-o="${i}">${esc(meaningOf(o, lang()))}</button>`).join("")}</div>`;
    } else {
      const right = g.res.filter((x) => x === "right").length;
      panel = `${gain}${last}<div><strong style="color:var(--good)">${esc(cur.name)} ${cur.label} complete.</strong> ${right} of ${ws.length} words right.</div>
        ${cur.a.en || cur.a.ur ? `<div>${esc(cur.a.en || "")}</div><div class="ur">${esc(cur.a.ur || "")}</div>` : ""}<button class="btn honey" id="back">Next āyah</button>`;
    }
    app.innerHTML = `<h1>Ayah Honeycomb</h1>
      <p class="sub">Choose an āyah. Tap the glowing cell to see its word, then pick the meaning. Right answers fill with honey; wrong ones turn red.</p>
      <div class="hsrc">${busy ? `<span class="note">${esc(srcName)}</span>` : choose}<div class="row"><div class="seg" aria-label="Which āyāt">
        <button data-scope="practised" aria-pressed="${scope === "practised"}" ${practised.length && !busy ? "" : "disabled"}>Āyāt I've practised${practised.length ? ` (${practised.length})` : ""}</button>
        <button data-scope="all" aria-pressed="${scope === "all"}" ${busy ? "disabled" : ""}>${src.k === "s" ? "Whole sūrah" : "Whole juz"}</button></div>${quizLangHTML(words) ? `<span class="row qlang"><span class="note">Answers in</span>${quizLangHTML(words)}</span>` : ""}</div></div>
      ${practised.length ? "" : `<p class="note">Nothing practised in ${esc(srcName)} yet. Use "Practise up to here" in the reader, and those āyāt will be collected here.</p>`}
      <div class="picker">${g.nums.map((p) => `<button class="nb${g.done.has(p.key) ? " won" : ""}" data-p="${esc(p.key)}" aria-pressed="${cur === p}" ${busy ? "disabled" : ""}><span dir="ltr">${esc(p.label)}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="deal" ${busy ? "disabled" : ""}>New āyāt</button>${g.combo >= 2 ? `<span class="note">Streak ${g.combo}${g.combo >= 5 ? " · double honey" : ""}</span>` : ""}</div>
      <div class="comb" id="comb" style="--cw:${cw}px;width:${(2 * R + 1) * sx - 3}px;height:${2 * R * sy + h}px">${cells}</div>
      <section class="card quiz">${panel}</section>${CREDIT}`;
  }
  const start = (p) => { const L = layout(p.a.w.length); Object.assign(g, { mode: "play", cur: p, R: L.R, path: L.path, res: p.a.w.map(() => null), active: null, gain: null, last: null, fresh: true }); draw(); };
  const toPick = () => { Object.assign(g, { mode: "pick", cur: null, path: [], res: [], active: null, gain: null, last: null, R: 2 }); draw(); };

  app.onclick = (e) => {
    const t = e.target.closest("button"); if (!t || t.disabled) return;
    if (t.dataset.qlang) { setQuizLang(t); return draw(); }
    if (t.dataset.kind) {
      if (t.dataset.kind === src.k) return;
      // keep the place: a sūrah opens on the juz you have practised up to, a juz on its first sūrah
      const at = Math.max(1, store.get("upto." + src.n, 0));
      return t.dataset.kind === "j" ? pickSrc("j", JUZ.findIndex((_, j) => inJuz(j + 1, src.n, at)) + 1) : pickSrc("s", JUZ[src.n - 1][0]);
    }
    if (t.dataset.juz) return pickSrc("j", +t.dataset.juz);
    if (t.dataset.scope) { store.set("hiveScope", t.dataset.scope); return renderHive(app); }
    if (t.dataset.p) return start(g.nums.find((p) => p.key === t.dataset.p));
    if (t.id === "deal") { deal(); return toPick(); }
    if (t.id === "back") return toPick();
    if (t.dataset.cell !== undefined && g.mode === "play" && g.active === null) { g.active = +t.dataset.cell; opts(g.cur.a.w[g.active]); g.gain = null; return draw(); }
    if (t.dataset.o !== undefined && g.active !== null) {
      const i = g.active, w = g.cur.a.w[i], ok = g.opts[+t.dataset.o] === w;
      g.res[i] = ok ? "right" : "wrong"; g.active = null; g.gain = null;
      if (ok) { g.combo++; honey(g.combo >= 5 ? 20 : 10, g.combo >= 5 ? "streak" : ""); g.last = null; }
      else { g.combo = 0; g.last = w; }
      if (g.res.every(Boolean)) {
        g.mode = "won"; g.done.add(g.cur.key);
        const perfect = g.res.every((x) => x === "right");
        honey(perfect ? 50 : 20, perfect ? "perfect āyah" : "āyah complete");
      }
      return draw();
    }
  };
  draw();
}
