// Ayah Honeycomb: the Juz Amma review game.
// An āyah's words lie on a zig-zag path of cells from the right edge of a hexagon-shaped
// honeycomb to the left edge. Cells are answered in reading order; right = honey, wrong = red.
import { store, withMeanings, index, CREDIT, esc, hasMeaning, meaningOf, addHoney, quizLang, quizLangHTML, setQuizLang, distractors, bothHTML } from "./app.js";

// First pick a sūrah or a juz, then play the āyāt you have practised in it ("Practise up to here"
// remembers how far, per sūrah) or all of it.
// Where each juz starts: [sūrah, āyah]
const JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
const inJuz = (j, s, a) => { const [s0, a0] = JUZ[j - 1], [s1, a1] = JUZ[j] || [115, 1]; return (s > s0 || (s === s0 && a >= a0)) && (s < s1 || (s === s1 && a < a1)); };
const MAX = 13; // longer āyāt are played in parts of at most this many words, so each flows across a 37-cell honeycomb
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
// sideways) and never turns back to the right.
const radiusFor = (n) => (n < 2 ? 0 : Math.max(1, Math.ceil((n - 1) / 4))); // a diagonal river of 4R + 1 cells fits
const STEPS = { W: [-1, 0], NW: [0, -1], SW: [-1, 1] }; // straight left and the two left diagonals
const VERT = { NW: "up", SW: "down" };

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
      if (dist.get(c.k) > rem || rem > 2 * (c.x + R)) return false; // can't reach the left edge in exactly rem steps
      const was = head;
      if ((head === "up" && c.r === -R) || (head === "down" && c.r === R) || (run >= 2 * R && Math.random() < 0.5)) head = head === "up" ? "down" : "up";
      const pref = (m) => {
        const v = VERT[m];
        if (m === last) return Math.random() * 0.5; // keep flowing the same way
        if (v === head) return 0.3 + Math.random() * 0.5;
        if (m === "W") return 0.6 + Math.random() * 0.6;
        return 1.4 + Math.random();
      };
      const opts = Object.entries(STEPS).map(([m, [dq, dr]]) => ({ m, c: byKey.get(c.q + dq + "," + (c.r + dr)) }))
        .filter((o) => o.c && !seen.has(o.c.k) && !(last && last !== "W" && o.m !== "W" && o.m !== last && run < 2)).map((o) => ({ ...o, p: pref(o.m) })).sort((a, b) => a.p - b.p);
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
let g = null, t = null; // the solo game and the team race

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
  const pickSrc = (k, n) => { store.set("hiveSrc", { k, n }); store.set("hiveScope", "practised"); g = null; t = null; return renderHive(app); };
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
  const mode = store.get("hiveMode", "solo");
  const size = (R = g.R) => {
    const cols = 2 * R + 1, gap = 3, avail = Math.min(app.clientWidth - 32, 620);
    const cw = Math.max(30, Math.min(76, Math.floor((avail - gap * cols) / cols)));
    return { cw, h: cw * 1.1547, sx: cw + gap, sy: cw * 1.1547 * 0.75 + gap * 0.87 };
  };
  // options are words, not text, so switching the answer language keeps the same question
  const opts = (w) => { g.opts = [w, ...distractors(w, distract)].sort(() => Math.random() - 0.5); };
  const honey = (p, msg) => { addHoney(p); g.gain = `+${p} honey${msg ? " · " + msg : ""}`; };

  // title, game type, where the āyāt come from, and the answer language: shared by both games
  const head = (busy, sub) => `<h1>Ayah Honeycomb</h1>
      <div class="row"><p class="sub" style="margin:0">${sub}</p><div class="seg" aria-label="Game"><button data-mode="solo" aria-pressed="${mode === "solo"}" ${busy ? "disabled" : ""}>Solo</button><button data-mode="teams" aria-pressed="${mode === "teams"}" ${busy ? "disabled" : ""}>Two teams</button></div></div>
      <div class="hsrc">${busy ? `<span class="note">${esc(srcName)}</span>` : choose}<div class="row"><div class="seg" aria-label="Which āyāt">
        <button data-scope="practised" aria-pressed="${scope === "practised"}" ${practised.length && !busy ? "" : "disabled"}>Āyāt I've practised${practised.length ? ` (${practised.length})` : ""}</button>
        <button data-scope="all" aria-pressed="${scope === "all"}" ${busy ? "disabled" : ""}>${src.k === "s" ? "Whole sūrah" : "Whole juz"}</button></div>${quizLangHTML(words) ? `<span class="row qlang"><span class="note">Answers in</span>${quizLangHTML(words)}</span>` : ""}</div></div>
      ${practised.length ? "" : `<p class="note">Nothing practised in ${esc(srcName)} yet. Use "Practise up to here" in the reader, and those āyāt will be collected here.</p>`}`;

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
    app.innerHTML = `${head(busy, "Choose an āyah. Tap the glowing cell to see its word, then pick the meaning. Right answers fill with honey; wrong ones turn red.")}
      <div class="picker">${g.nums.map((p) => `<button class="nb${g.done.has(p.key) ? " won" : ""}" data-p="${esc(p.key)}" aria-pressed="${cur === p}" ${busy ? "disabled" : ""}><span dir="ltr">${esc(p.label)}</span></button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="deal" ${busy ? "disabled" : ""}>New āyāt</button>${g.combo >= 2 ? `<span class="note">Streak ${g.combo}${g.combo >= 5 ? " · double honey" : ""}</span>` : ""}</div>
      <div class="comb" id="comb" style="--cw:${cw}px;width:${(2 * R + 1) * sx - 3}px;height:${2 * R * sy + h}px">${cells}</div>
      <section class="card quiz">${panel}</section>${CREDIT}`;
  }
  const start = (p) => { const L = layout(p.a.w.length); Object.assign(g, { mode: "play", cur: p, R: L.R, path: L.path, res: p.a.w.map(() => null), active: null, gain: null, last: null, fresh: true }); draw(); };
  const toPick = () => { Object.assign(g, { mode: "pick", cur: null, path: [], res: [], active: null, gain: null, last: null, R: 2 }); draw(); };

  // ---------- team race ----------
  // Two teams, one screen, a numbered honeycomb with a hidden word in every cell. Team A builds from the
  // right edge to the left, Team B from the left edge to the right. Teams take turns choosing a cell on
  // their starting edge or touching their own cells. A right answer claims the cell; a wrong one turns
  // it white and hides a new word in it, so the cell stays free and the missed word is not given away.
  // No team may hold three cells in a straight row, so routes have to bend. A team may also try to steal
  // an enemy cell touching its own, answering a fresh word for it, so no route is ever safe.
  // The first team whose cells join its two edges wins.
  const TEAMS = [{ name: "Team A", cls: "a" }, { name: "Team B", cls: "b" }];
  const names = () => store.get("teamNames", TEAMS.map((x) => x.name));
  // A brick-wall board, W cells across and H rows, every other row shifted half a cell, so every route
  // from the right edge to the left edge crosses all W columns.
  const W = 7, H = 5;
  const board0 = () => Array.from({ length: H * W }, (_, i) => { const row = Math.floor(i / W), col = i % W; return { k: row + "," + col, row, col, x: col + (row % 2) / 2 }; });
  const START = [(c) => c.col === W - 1, (c) => c.col === 0], GOAL = [START[1], START[0]];
  const ROUTE = ["right → left", "left → right"], EDGE = ["the right edge", "the left edge"];
  const near = (c) => { const d = c.row % 2 ? 0 : -1; return [[0, -1], [0, 1], [-1, d], [-1, d + 1], [1, d], [1, d + 1]].map(([dr, dc]) => c.row + dr + "," + (c.col + dc)); };
  function match() {
    const cells = board0();
    // one word per cell: the chosen āyāt first (each base word once), then the rest of the sūrah or juz
    const seen = new Set(), list = [];
    for (const w of [...pool.flatMap((p) => p.a.w)].sort(() => Math.random() - 0.5).concat([...distract].sort(() => Math.random() - 0.5))) {
      if (list.length === cells.length * 3) break; // the extra words refill cells after a wrong answer
      if (!hasMeaning(w) || seen.has(w.l)) continue;
      seen.add(w.l); list.push(w);
    }
    if (list.length < cells.length) return null;
    // numbered in rows from the top, right to left like the reading
    const order = [...cells].sort((a, b) => a.row - b.row || b.col - a.col);
    const first = store.get("teamFirst", 0); store.set("teamFirst", 1 - first); // the first move helps, so the teams take it in turn
    const board = new Map(order.map((c, i) => [c.k, { c, no: i + 1, w: list[i], own: null, white: false }]));
    return { srcKey, board, spare: list.slice(cells.length), ready: false, turn: first, pick: null, opts: [], last: null, over: null, fresh: true,
      teams: TEAMS.map((x, i) => ({ ...x, name: names()[i] || x.name, right: 0, missed: [] })) };
  }
  // would taking this cell give the team three of its cells side by side in one row?
  const straight = (ti, c) => {
    const mine = (col) => t.board.get(c.row + "," + col)?.own === ti;
    let run = 1;
    for (let col = c.col - 1; mine(col); col--) run++;
    for (let col = c.col + 1; mine(col); col++) run++;
    return run >= 3;
  };
  // cells a team may choose: free cells on its starting edge or touching its own, and enemy cells
  // touching its own (a steal); never one that makes three in a row
  const touches = (ti, c) => near(c).some((k) => t.board.get(k)?.own === ti);
  const legal = (ti) => new Set([...t.board.values()].filter((x) => !straight(ti, x.c) &&
    (x.own === null ? START[ti](x.c) || touches(ti, x.c) : x.own === 1 - ti && touches(ti, x.c))).map((x) => x.c.k));
  const joined = (ti) => { // do the team's cells link the right edge to the left edge?
    const mine = [...t.board.values()].filter((x) => x.own === ti), seen = new Set(), stack = mine.filter((x) => START[ti](x.c));
    stack.forEach((x) => seen.add(x.c.k));
    while (stack.length) { const x = stack.pop(); if (GOAL[ti](x.c)) return true; for (const k of near(x.c)) { const y = t.board.get(k); if (y && y.own === ti && !seen.has(k)) { seen.add(k); stack.push(y); } } }
    return false;
  };
  function teams() {
    if (t && t.srcKey !== srcKey) t = null;
    if (!t) t = match();
    if (!t) {
      app.innerHTML = `${head(false, "Two teams race across the honeycomb.")}<div class="banner">The team race needs 35 different words with meanings. Choose "Whole sūrah", or a bigger sūrah or juz.</div>${CREDIT}`;
      app.onclick = (e) => { const b = e.target.closest("button"); if (b && !b.disabled) { if (b.dataset.qlang) { setQuizLang(b); return; } common(b); } };
      return;
    }
    const tdraw = () => {
      const { cw, h, sx, sy } = size((W - 0.5) / 2), playing = t.ready && !t.over, cur = t.teams[t.turn];
      const can = playing && t.pick === null ? legal(t.turn) : new Set();
      const cells = [...t.board.values()].map((x) => {
        const c = x.c, left = c.x * sx, top = c.row * sy;
        let cls, inner, tag = "div", attrs = "", fs = cw * 0.3, delay = t.fresh ? `animation-delay:${x.no * 20}ms;` : "";
        const word = `<span class="ar">${esc(x.w.t)}</span>`;
        if (t.pick === c.k) { cls = "active"; inner = `<span class="ar">${esc(t.pickW.t)}</span>`; fs = Math.min(cw * 0.3, (cw * 1.25) / Math.max(3, letters(t.pickW.t))); }
        else if (x.own !== null) {
          cls = "won" + t.teams[x.own].cls; inner = word; fs = Math.min(cw * 0.3, (cw * 1.25) / Math.max(3, letters(x.w.t)));
          if (can.has(c.k)) { cls += " steal"; tag = "button"; attrs = `data-tc="${c.k}" aria-label="Steal cell ${x.no}"`; }
        }
        else { cls = "num" + (x.white ? " white" : "") + (can.has(c.k) ? " can can" + cur.cls : ""); inner = `<span class="no">${x.no}</span>`; if (can.has(c.k)) { tag = "button"; attrs = `data-tc="${c.k}" aria-label="Cell ${x.no}"`; } }
        if (t.fresh) cls += " appear";
        return `<${tag} class="hex ${cls}" ${attrs} style="left:${left}px;top:${top}px;--fs:${fs.toFixed(1)}px;${delay}"><span>${inner}</span></${tag}>`;
      }).join("");
      t.fresh = false;
      const held = (ti) => [...t.board.values()].filter((x) => x.own === ti).length;
      const score = t.teams.map((tm, ti) => `<div class="team t${tm.cls}${playing && ti === t.turn ? " now" : ""}"><strong>${esc(tm.name)} <span class="note">${ROUTE[ti]}</span></strong>
          <span class="note">${held(ti)} cell${held(ti) === 1 ? "" : "s"} · ${tm.missed.length} wrong</span></div>`).join("");
      const last = t.last ? `<div class="note">${t.last.ok ? `<span style="color:var(--good)">Right.</span> ${esc(t.last.who)} ${t.last.steal ? "steals" : "takes"} cell ${t.last.no}.` : `<span style="color:var(--bad)">Not quite.</span> <span class="ar">${esc(t.last.w.t)}</span> means ${bothHTML(t.last.w)}. ${t.last.steal ? `Cell ${t.last.no} stays with ${esc(t.last.owner)}.` : `Cell ${t.last.no} turns white and gets a new word.`}`}</div>` : "";
      let panel;
      if (!t.ready) {
        panel = `<div><strong>Name the teams</strong></div><div class="names">${t.teams.map((tm, i) => `<label class="team t${tm.cls}">Team ${i + 1}<input id="tn${i}" maxlength="20" value="${esc(tm.name)}" autocomplete="off"></label>`).join("")}</div>
          <div class="note">Each cell hides a word. ${esc(t.teams[0].name)} builds from the right edge to the left, ${esc(t.teams[1].name)} from the left edge to the right. Take turns choosing a numbered cell on your starting edge or touching your cells; answer right to take it, while a wrong answer turns it white with a new hidden word. You may not hold three cells side by side in one row. You may also steal a cell of the other team that touches yours by answering a new word for it. First to join both edges wins. ${esc(t.teams[t.turn].name)} goes first.</div>
          <button class="btn primary" id="tgo">Start the match</button>`;
      } else if (t.over) {
        const missed = t.teams.map((tm) => `<div class="missed"><div class="note">${esc(tm.name)}: ${tm.missed.length ? "words to look at again" : "no mistakes"}</div>${tm.missed.map((w) => `<div class="mrow"><span class="ar">${esc(w.t)}</span><span>${bothHTML(w)}</span></div>`).join("")}</div>`).join("");
        panel = `${last}<h2 style="margin:4px 0">${t.over}</h2>${missed}<button class="btn honey" id="tnew">New match</button>`;
      } else if (t.pick === null) {
        panel = `${last}<div>Turn: <strong>${esc(cur.name)}</strong></div><div class="note">Choose a glowing cell${[...t.board.values()].some((x) => x.own === t.turn) ? `, on ${EDGE[t.turn]} or touching your cells, or steal a marked cell of the other team` : ` on ${EDGE[t.turn]}`}.</div>`;
      } else {
        const x = { no: t.board.get(t.pick).no, w: t.pickW }, ur = lang() === "ur";
        panel = `<div class="note">${esc(cur.name)} · cell ${x.no}</div><div class="ar big" style="font-size:40px;line-height:1.6">${esc(x.w.t)}</div><div>What does it mean?</div>
          <div class="opts">${t.opts.map((o, i) => `<button class="opt${ur ? " ur" : ""}" data-to="${i}">${esc(meaningOf(o, lang()))}</button>`).join("")}</div>`;
      }
      app.innerHTML = `${head(playing, "Two teams build opposite ways across the honeycomb. Choose a numbered cell, answer its word, and take it, or steal one.")}
        <div class="teams">${score}</div>
        <div class="row" style="justify-content:center"><button class="btn" id="tnew">${t.over ? "Play again" : "New match"}</button></div>
        <div class="comb" id="comb" style="--cw:${cw}px;width:${(W + 0.5) * sx - 3}px;height:${(H - 1) * sy + h}px">${cells}</div>
        <section class="card quiz">${panel}</section>${CREDIT}`;
    };
    const nextTurn = () => {
      for (const ti of [1 - t.turn, t.turn]) if (legal(ti).size) { t.turn = ti; return; }
      t.over = "No cells left to take. It's a draw!"; // nobody can move any more
    };
    app.onclick = (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.qlang) { setQuizLang(b); return tdraw(); }
      if (common(b)) return;
      if (b.id === "tnew") { t = match(); return tdraw(); }
      if (b.id === "tgo") {
        const ns = t.teams.map((tm, i) => (app.querySelector("#tn" + i).value || "").trim() || TEAMS[i].name);
        store.set("teamNames", ns); t.teams.forEach((tm, i) => { tm.name = ns[i]; }); t.ready = true;
        return tdraw();
      }
      if (b.dataset.tc && t.pick === null && !t.over) {
        const x = t.board.get(b.dataset.tc);
        // a steal is asked with a fresh word: the cell's own word is already showing
        const w = x.own === null ? x.w : t.spare.pop() || distract[Math.floor(Math.random() * distract.length)];
        t.pick = b.dataset.tc; t.pickW = w; t.opts = [w, ...distractors(w, distract)].sort(() => Math.random() - 0.5); t.last = null;
        return tdraw();
      }
      if (b.dataset.to !== undefined && t.pick !== null) {
        const cur = t.teams[t.turn], x = t.board.get(t.pick), w = t.pickW, ok = t.opts[+b.dataset.to] === w, steal = x.own !== null;
        t.pick = null; t.last = { ok, w, no: x.no, who: cur.name, steal, owner: steal ? t.teams[x.own].name : "" };
        if (ok) { x.own = t.turn; x.w = w; cur.right++; }
        else { cur.missed.push(w); if (!steal) { x.white = true; x.w = t.spare.pop() || distract[Math.floor(Math.random() * distract.length)]; } }
        if (ok && joined(t.turn)) t.over = `Winner: ${esc(cur.name)}`;
        else nextTurn();
        return tdraw();
      }
    };
    tdraw();
  }

  // buttons in the shared header; true when handled
  const common = (b) => {
    if (b.dataset.mode) { if (b.dataset.mode !== mode) { store.set("hiveMode", b.dataset.mode); renderHive(app); } return true; }
    if (b.dataset.kind) {
      if (b.dataset.kind === src.k) return true;
      // keep the place: a sūrah opens on the juz you have practised up to, a juz on its first sūrah
      const at = Math.max(1, store.get("upto." + src.n, 0));
      if (b.dataset.kind === "j") pickSrc("j", JUZ.findIndex((_, j) => inJuz(j + 1, src.n, at)) + 1); else pickSrc("s", JUZ[src.n - 1][0]);
      return true;
    }
    if (b.dataset.juz) { pickSrc("j", +b.dataset.juz); return true; }
    if (b.dataset.scope) { store.set("hiveScope", b.dataset.scope); renderHive(app); return true; }
    return false;
  };
  if (mode === "teams") return teams();

  app.onclick = (e) => {
    const t = e.target.closest("button"); if (!t || t.disabled) return;
    if (t.dataset.qlang) { setQuizLang(t); return draw(); }
    if (common(t)) return;
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
