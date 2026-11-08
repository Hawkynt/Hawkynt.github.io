/* Boards and logic, pure: neighbour tables, mine placement after the first click (never on it, and
   off the 3 x 3 around it when there is room), the numbers, and a logical solver.
   The solver works on what a player can see - cells unknown, open (with their number) or known to
   be mines - and finds the next certain moves with three rules, tried in order:
   1. a number whose remaining mines equal its unknown neighbours makes them all mines; one with no
      mines left makes them all safe;
   2. subsets: when one number's unknown neighbours lie inside another's, the cells only the second
      sees hold exactly the difference of their remaining mines (all safe at 0, all mines when it
      equals their count);
   3. the global count: no mines left means every unknown cell is safe, as many mines as unknown
      cells means all are mines.
   A board is "no guess" when the solver clears it from the first click alone; generate() draws
   seeded boards until one is (puzzle-proven boards for the story, the Daily, Zen and Rush). When
   logic runs out on a classic board, guessCell() names the least risky cell. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const { makeRng, hashString } = NS.rng;

  const NB_CACHE = {};
  /* neighbour index lists for a w x h board */
  function neighbours(w, h) {
    const key = w + 'x' + h;
    if (NB_CACHE[key]) return NB_CACHE[key];
    const out = [];
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const list = [];
        for (let dy = -1; dy <= 1; ++dy)
          for (let dx = -1; dx <= 1; ++dx) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) list.push(ny * w + nx);
          }
        out.push(list);
      }
    return (NB_CACHE[key] = out);
  }

  /* -> array of 0/1; count mines avoid `safe` (and its 3 x 3 when the board has room) */
  function placeMines(w, h, count, safe, rng) {
    const n = w * h;
    const nb = neighbours(w, h);
    const banned = new Uint8Array(n);
    if (safe != null && safe >= 0) {
      banned[safe] = 1;
      if (n - 9 >= count) for (const j of nb[safe]) banned[j] = 1;
    }
    const pool = [];
    for (let i = 0; i < n; ++i) if (!banned[i]) pool.push(i);
    const k = Math.min(count, pool.length);
    for (let i = 0; i < k; ++i) {
      const j = i + Math.floor(rng.next() * (pool.length - i));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const mine = new Array(n).fill(0);
    for (let i = 0; i < k; ++i) mine[pool[i]] = 1;
    return mine;
  }

  function numbers(w, h, mine) {
    const nb = neighbours(w, h);
    const out = new Array(w * h).fill(0);
    for (let i = 0; i < w * h; ++i) {
      if (mine[i]) { out[i] = -1; continue; }
      let c = 0;
      for (const j of nb[i]) c += mine[j];
      out[i] = c;
    }
    return out;
  }

  /* ---- deduction over a player's view: { w, h, mines, state[] (0 unknown, 1 open, 2 mine), num[] } ---- */
  function constraints(v) {
    const nb = neighbours(v.w, v.h);
    const list = [];
    for (let i = 0; i < v.w * v.h; ++i) {
      if (v.state[i] !== 1 || v.num[i] <= 0) continue;
      const U = [];
      let known = 0;
      for (const j of nb[i]) {
        if (v.state[j] === 0) U.push(j);
        else if (v.state[j] === 2) ++known;
      }
      if (U.length) list.push({ U: U, r: v.num[i] - known });
    }
    return list;
  }

  /* -> { safe: [], mine: [], rule } with the next certain cells (empty when logic runs out) */
  function deduce(v) {
    const safe = new Set(), mine = new Set();
    const cs = constraints(v);
    for (const c of cs) {
      if (c.r === 0) for (const j of c.U) safe.add(j);
      else if (c.r === c.U.length) for (const j of c.U) mine.add(j);
    }
    if (safe.size || mine.size) return { safe: [...safe], mine: [...mine], rule: 1 };
    /* subsets: constraints that share a cell */
    const byCell = new Map();
    cs.forEach((c, k) => { c.set = new Set(c.U); for (const j of c.U) { if (!byCell.has(j)) byCell.set(j, []); byCell.get(j).push(k); } });
    for (let a = 0; a < cs.length; ++a) {
      const A = cs[a];
      const seen = new Set();
      for (const j of A.U)
        for (const b of byCell.get(j)) {
          if (b === a || seen.has(b)) continue;
          seen.add(b);
          const B = cs[b];
          if (B.U.length <= A.U.length) continue;
          let inside = true;
          for (const x of A.U) if (!B.set.has(x)) { inside = false; break; }
          if (!inside) continue;
          const diff = B.U.filter(x => !A.set.has(x));
          const rd = B.r - A.r;
          if (rd === 0) for (const x of diff) safe.add(x);
          else if (rd === diff.length) for (const x of diff) mine.add(x);
        }
    }
    if (safe.size || mine.size) return { safe: [...safe], mine: [...mine], rule: 2 };
    /* the global count */
    let known = 0, unknown = 0;
    for (let i = 0; i < v.w * v.h; ++i) { if (v.state[i] === 2) ++known; else if (v.state[i] === 0) ++unknown; }
    const left = v.mines - known;
    if (unknown && left === 0) for (let i = 0; i < v.w * v.h; ++i) if (v.state[i] === 0) safe.add(i);
    if (unknown && left === unknown) for (let i = 0; i < v.w * v.h; ++i) if (v.state[i] === 0) mine.add(i);
    return { safe: [...safe], mine: [...mine], rule: safe.size || mine.size ? 3 : 0 };
  }

  /* the least risky unknown cell when logic runs out: frontier cells by their worst local odds,
     the rest by the global odds; ties go to the lowest index */
  function guessCell(v) {
    const n = v.w * v.h;
    const risk = new Array(n).fill(-1);
    for (const c of constraints(v)) {
      const p = c.r / c.U.length;
      for (const j of c.U) risk[j] = Math.max(risk[j], p);
    }
    let known = 0, unknown = 0;
    for (let i = 0; i < n; ++i) { if (v.state[i] === 2) ++known; else if (v.state[i] === 0) ++unknown; }
    const global = unknown ? (v.mines - known) / unknown : 1;
    let best = -1, bp = 2;
    for (let i = 0; i < n; ++i) {
      if (v.state[i] !== 0) continue;
      const p = risk[i] < 0 ? global : risk[i];
      if (p < bp - 1e-9) { bp = p; best = i; }
    }
    return best;
  }

  /* opens i in a view (flooding through zeros) from the true numbers; -> cells opened */
  function openIn(v, num, i) {
    const nb = neighbours(v.w, v.h);
    const stack = [i];
    let n = 0;
    while (stack.length) {
      const k = stack.pop();
      if (v.state[k] !== 0) continue;
      v.state[k] = 1;
      v.num[k] = num[k];
      ++n;
      if (num[k] === 0) for (const j of nb[k]) if (v.state[j] === 0) stack.push(j);
    }
    return n;
  }

  /* plays a board by logic alone from the first click; -> { solved, steps, rules: [count per rule] } */
  function solve(w, h, mine, start) {
    const n = w * h;
    let mines = 0;
    for (let i = 0; i < n; ++i) mines += mine[i];
    const num = numbers(w, h, mine);
    const v = { w: w, h: h, mines: mines, state: new Array(n).fill(0), num: new Array(n).fill(0) };
    if (mine[start]) return { solved: false, steps: 0, rules: [0, 0, 0, 0] };
    let open = openIn(v, num, start), steps = 0;
    const rules = [0, 0, 0, 0];
    const safeCells = n - mines;
    while (open < safeCells) {
      const d = deduce(v);
      if (!d.rule) break;
      ++rules[d.rule];
      ++steps;
      for (const j of d.mine) v.state[j] = 2;
      for (const j of d.safe) {
        if (mine[j]) return { solved: false, steps: steps, rules: rules, wrong: true };
        open += openIn(v, num, j);
      }
    }
    return { solved: open >= safeCells, steps: steps, rules: rules };
  }

  /* a seeded board for a first click at `start`; opts.noGuess draws until the solver clears it.
     -> { mine, noGuess (proven), tries } */
  function generate(w, h, count, seed, start, opts) {
    opts = opts || {};
    const tries = opts.tries || 600;
    let mine = null;
    for (let k = 0; k < tries; ++k) {
      mine = placeMines(w, h, count, start, makeRng(hashString(seed + ':' + start + ':' + k)));
      if (!opts.noGuess) return { mine: mine, noGuess: false, tries: k + 1 };
      if (solve(w, h, mine, start).solved) return { mine: mine, noGuess: true, tries: k + 1 };
    }
    return { mine: mine, noGuess: false, tries: tries };
  }

  Object.assign(NS.board, { neighbours, placeMines, numbers, constraints, deduce, guessCell, openIn, solve, generate });
})();
