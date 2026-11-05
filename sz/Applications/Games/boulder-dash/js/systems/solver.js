/* The completability analysis: which cells the miner can dig or walk without ever setting a
   loose object in motion and without coming near a creature's pocket, the gems and exit that
   such safe digging reaches, and the repair that softens blockages (boulders into dirt), drops
   creatures that wall the route off and adds gems until the cave's quota is reachable. The same
   safety test steers the bot. Pure functions over a cave record. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const R = NS.rng;

  function isRolling(cv, i) {
    const t = cv.cells[i];
    return C.ROLLS[t] && C.ROUNDED[cv.cells[i + cv.w]];
  }

  const STEPPABLE = new Uint8Array(C.CELL_TYPES);
  STEPPABLE[C.EMPTY] = STEPPABLE[C.DIRT] = STEPPABLE[C.GEM] = STEPPABLE[C.BIGGEM] = STEPPABLE[C.ITEM] = STEPPABLE[C.PLAYER] = 1;

  /* digging or entering this cell can never start a loose object moving onto the miner */
  function isSafeCell(cv, i) {
    const cells = cv.cells, w = cv.w;
    if (!STEPPABLE[cells[i]]) return false;
    const above = cells[i - w];
    if (C.FALLS[above] || above === C.MAGIC) return false;
    if (isRolling(cv, i - 1) || isRolling(cv, i + 1)) return false;
    const solidAbove = above === C.STEEL || above === C.BRICK || above === C.EXIT || above === C.LAVA;
    if (!solidAbove && (isRolling(cv, i - w - 1) || isRolling(cv, i - w + 1))) return false;
    return true;
  }

  /* creature pockets grown by two cells: never safe to approach */
  function dangerMap(cv, radius) {
    const { w, h, cells } = cv;
    const n = w * h;
    const region = new Uint8Array(n);
    const stack = [];
    for (let i = 0; i < n; ++i)
      if (C.CREATURE[cells[i]] && !region[i]) {
        region[i] = 1;
        stack.push(i);
        while (stack.length) {
          const j = stack.pop();
          for (let d = 0; d < 4; ++d) {
            const k = j + C.DX[d] + C.DY[d] * w;
            if (region[k]) continue;
            if (cells[k] === C.EMPTY || C.CREATURE[cells[k]]) { region[k] = 1; stack.push(k); }
          }
        }
      }
    const danger = new Uint8Array(n);
    const rad = radius === undefined ? 2 : radius;
    /* a dozing mole wakes when the miner comes near: keep beyond its reach */
    for (let i = 0; i < n; ++i) {
      if (cells[i] !== C.MOLE) continue;
      const r0 = (i / w) | 0, c0 = i % w, wr = 7;
      for (let y = Math.max(0, r0 - wr); y <= Math.min(h - 1, r0 + wr); ++y)
        for (let x = Math.max(0, c0 - wr); x <= Math.min(w - 1, c0 + wr); ++x)
          if (Math.abs(y - r0) + Math.abs(x - c0) <= wr) danger[y * w + x] = 1;
    }
    for (let i = 0; i < n; ++i) {
      if (!region[i]) continue;
      const r = (i / w) | 0, c = i % w;
      for (let y = Math.max(0, r - rad); y <= Math.min(h - 1, r + rad); ++y)
        for (let x = Math.max(0, c - rad); x <= Math.min(w - 1, c + rad); ++x)
          danger[y * w + x] = 1;
    }
    return danger;
  }

  /* Explores everything reachable over safe cells from the start */
  function analyse(cv) {
    const { w, cells } = cv;
    const n = cells.length;
    const danger = dangerMap(cv);
    const seen = new Uint8Array(n);
    const start = cv.startR * w + cv.startC;
    const exit = cv.exitR * w + cv.exitC;
    const queue = [start];
    const frontier = [];
    seen[start] = 1;
    let gems = 0, exitReached = false, dangerBlocked = 0;
    for (let q = 0; q < queue.length; ++q) {
      const i = queue[q];
      if (cells[i] === C.GEM) ++gems;
      else if (cells[i] === C.BIGGEM) gems += 5;
      for (let d = 0; d < 4; ++d) {
        const k = i + C.DX[d] + C.DY[d] * w;
        if (k === exit) exitReached = true;
        if (seen[k]) continue;
        const t = cells[k];
        if (t === C.STEEL || t === C.EXIT || t === C.LAVA || t === C.MAGIC || t === C.AMOEBA) continue;
        seen[k] = 1;
        if (danger[k]) { ++dangerBlocked; continue; }
        if (isSafeCell(cv, k)) queue.push(k);
        else if (t !== C.BRICK) frontier.push(k);
      }
    }
    return { gems, exitReached, frontier, reached: queue, dangerBlocked };
  }

  /* turns the objects that make a cell unsafe (and the cell itself, if loose) into dirt */
  function soften(cv, k) {
    const { w, cells } = cv;
    const fix = (j) => {
      if (C.FALLS[cells[j]] || cells[j] === C.MAGIC) cells[j] = C.DIRT;
    };
    fix(k);
    fix(k - w);
    if (isRolling(cv, k - 1)) fix(k - 1);
    if (isRolling(cv, k + 1)) fix(k + 1);
    if (isRolling(cv, k - w - 1)) fix(k - w - 1);
    if (isRolling(cv, k - w + 1)) fix(k - w + 1);
  }

  function nearestCreature(cv, target) {
    const w = cv.w;
    let best = -1, bd = 1e9;
    for (let i = 0; i < cv.cells.length; ++i)
      if (C.CREATURE[cv.cells[i]]) {
        const d = Math.abs(((i / w) | 0) - ((target / w) | 0)) + Math.abs(i % w - target % w);
        if (d < bd) { bd = d; best = i; }
      }
    return best;
  }

  /* cheapest route from the start to the exit: safe cells cost 1, cells that need a boulder
     softened 6, cells beside a creature pocket 40; returns the cells along it */
  function cheapestRoute(cv) {
    const { w, cells } = cv;
    const n = cells.length;
    const danger = dangerMap(cv);
    const dist = new Int32Array(n).fill(1 << 29);
    const prev = new Int32Array(n).fill(-1);
    const start = cv.startR * w + cv.startC, exit = cv.exitR * w + cv.exitC;
    const buckets = [[start]];
    dist[start] = 0;
    for (let d = 0; d < buckets.length; ++d) {
      const b = buckets[d];
      if (!b) continue;
      for (let q = 0; q < b.length; ++q) {
        const i = b[q];
        if (dist[i] !== d) continue;
        if (i === exit) {
          const path = [];
          for (let j = prev[i]; j >= 0 && j !== start; j = prev[j]) path.push(j);
          return { path, danger };
        }
        for (let k = 0; k < 4; ++k) {
          const j = i + C.DX[k] + C.DY[k] * w;
          const t = cells[j];
          if (j !== exit && (t === C.STEEL || t === C.EXIT || t === C.LAVA || t === C.MAGIC || t === C.AMOEBA || t === C.BRICK)) continue;
          const cost = j === exit ? 1 : danger[j] ? 40 : isSafeCell(cv, j) ? 1 : 6;
          const nd = d + cost;
          if (nd < dist[j]) {
            dist[j] = nd;
            prev[j] = i;
            (buckets[nd] || (buckets[nd] = [])).push(j);
          }
        }
      }
    }
    return null;
  }

  /* Repairs the cave until `required` gems and the exit are safely reachable; sets cv.required */
  function repair(cv, required, rng) {
    const w = cv.w;
    let res = analyse(cv);
    /* 1. open the cheapest way to the exit, softening only what lies on it */
    for (let round = 0; round < 8 && !res.exitReached; ++round) {
      const route = cheapestRoute(cv);
      if (!route) break;
      for (let q = 0; q < route.path.length; ++q) {
        const k = route.path[q];
        if (route.danger[k]) {
          const cr = nearestCreature(cv, k);
          if (cr >= 0) cv.cells[cr] = C.EMPTY;
        }
      }
      for (let pass = 0; pass < 3; ++pass)
        for (let q = 0; q < route.path.length; ++q)
          if (!isSafeCell(cv, route.path[q])) soften(cv, route.path[q]);
      res = analyse(cv);
    }
    /* 1b. still shut off: soften the frontier nearest the exit, one blockage at a time */
    for (let step = 0; step < 600 && !res.exitReached; ++step) {
      const f = res.frontier;
      if (!f.length) {
        const cr = nearestCreature(cv, cv.exitR * w + cv.exitC);
        if (cr < 0) break;
        cv.cells[cr] = C.EMPTY;
      } else {
        const dist = (k) => Math.abs(((k / w) | 0) - cv.exitR) + Math.abs(k % w - cv.exitC);
        f.sort((a, b) => dist(a) - dist(b));
        soften(cv, f[R.int(rng, Math.min(3, f.length))]);
      }
      res = analyse(cv);
    }
    /* 2. top up gems by planting them in safely reachable dirt; a plant that cuts the route
          (a gem hanging over a cell the route needs) is taken back */
    const tried = new Uint8Array(cv.cells.length);
    for (let step = 0; step < 160 && res.exitReached && res.gems < required; ++step) {
      let k = -1;
      const reached = res.reached.slice(4);
      R.shuffle(rng, reached);
      for (let pass = 0; pass < 2 && k < 0; ++pass)
        for (let q = 0; q < reached.length; ++q) {
          const j = reached[q], below = cv.cells[j + w];
          if (tried[j] || cv.cells[j] !== C.DIRT || below === C.EMPTY) continue;
          if (pass === 0 && STEPPABLE[below]) continue;
          k = j;
          break;
        }
      if (k < 0) break;
      tried[k] = 1;
      cv.cells[k] = C.GEM;
      const next = analyse(cv);
      if (!next.exitReached || next.gems <= res.gems) { cv.cells[k] = C.DIRT; continue; }
      res = next;
    }
    cv.required = Math.max(0, Math.min(required, res.exitReached ? res.gems : 0));
    return res;
  }

  function isSolvable(cv) {
    const res = analyse(cv);
    return res.exitReached && res.gems >= cv.required;
  }

  Object.assign(NS.solver, { cheapestRoute, isSafeCell, isRolling, dangerMap, analyse, repair, isSolvable, STEPPABLE });
})();
