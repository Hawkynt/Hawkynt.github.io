'use strict';

/* A playing bot for tests: each step it reads the live run and sets the same intents the
   keyboard would (move, bomb, detonate). Rules, in order: flee danger (blast lines of placed
   bombs, fire, boss telegraphs) to the nearest safe cell; walk into the open exit; pick up
   nearby items; otherwise walk to the best safe bombing spot (bricks, enemies or the boss in
   reach, with an escape cell) and drop a bomb there. */

function createBot(NS, opts) {
  opts = opts || {};
  const C = NS.constants;
  const G = NS.state;
  const A = NS.arena;
  const { COLS, ROWS, DIRS } = C;
  const N = COLS * ROWS;
  const danger = new Uint8Array(N);
  let path = null;
  let stuck = 0;
  let lastCell = -1;

  function cellOf(x, y) { return Math.round(y) * COLS + Math.round(x); }

  function walk(i, p) {
    const t = G.run.level.grid[i];
    if (t === C.T_TELE || t === C.T_SOFT || t === C.T_CRATE) return false;
    return A.playerCan(i % COLS, (i / COLS) | 0, p);
  }

  function buildDanger(extraBomb, extraRange) {
    danger.fill(0);
    const run = G.run;
    const g = run.level.grid;
    for (const b of run.bombs) for (const c of NS.levelgen.blastCells(g, b.fly ? cellOf(b.fly.tx, b.fly.ty) : b.i, b.range + 1)) danger[c] = 1;
    if (extraBomb >= 0) for (const c of NS.levelgen.blastCells(g, extraBomb, extraRange)) danger[c] = 1;
    for (let i = 0; i < N; ++i) if (run.fire[i] > 0) danger[i] = 1;
    for (const t of run.tele) for (const c of t.cells) danger[c] = 1;
    for (const e of run.enemies) {
      const c = cellOf(e.x, e.y);
      danger[c] = 1;
      /* the cell it is heading into */
      const t = Math.round(e.ty) * COLS + Math.round(e.tx);
      if (t >= 0 && t < N) danger[t] = 1;
    }
    const b = run.boss;
    if (b && b.state !== 'dead' && !b.under) {
      const h = NS.bosses.half(b) + 0.9;
      for (let r = 0; r < ROWS; ++r) for (let c = 0; c < COLS; ++c) if (Math.abs(c - b.x) < h && Math.abs(r - b.y) < h) danger[r * COLS + c] = 1;
    }
  }

  /* breadth-first over walkable cells; returns prev[] and dist[] */
  function bfs(start, p, avoidDanger) {
    const prev = new Int16Array(N).fill(-1);
    const dist = new Int16Array(N).fill(-1);
    const q = [start];
    dist[start] = 0;
    prev[start] = start;
    for (let h = 0; h < q.length; ++h) {
      const i = q[h];
      for (const d of DIRS) {
        const j = i + d[0] + d[1] * COLS;
        if (j < 0 || j >= N || dist[j] >= 0) continue;
        if (!walk(j, p)) continue;
        if (avoidDanger && danger[j] && !danger[i]) continue;
        if (G.run.fire[j] > 0) continue;
        dist[j] = dist[i] + 1;
        prev[j] = i;
        q.push(j);
      }
    }
    return { prev, dist };
  }

  function route(prev, start, goal) {
    const out = [];
    for (let i = goal; i !== start; i = prev[i]) { out.unshift(i); if (out.length > N) return null; }
    return out;
  }

  function nearestSafe(start, p) {
    const { prev, dist } = bfs(start, p, false);
    let best = -1;
    for (let i = 0; i < N; ++i) if (dist[i] >= 0 && !danger[i] && (best < 0 || dist[i] < dist[best])) best = i;
    return best >= 0 ? route(prev, start, best) : null;
  }

  function value(i, range) {
    const run = G.run, g = run.level.grid;
    let v = 0;
    const cells = NS.levelgen.blastCells(g, i, range);
    for (const c of cells) {
      if (g[c] === C.T_SOFT || g[c] === C.T_CRATE) v += 1;
    }
    for (const e of run.enemies) if (cells.indexOf(cellOf(e.x, e.y)) >= 0) v += 4;
    const b = run.boss;
    if (b && b.state !== 'dead' && !b.under && b.state !== 'intro') for (const c of cells) if (NS.bosses.covers(b, c % COLS, (c / COLS) | 0)) { v += 8; break; }
    return v;
  }

  function plan() {
    const run = G.run, p = run.player;
    const here = cellOf(p.x, p.y);
    buildDanger(-1, 0);
    if (danger[here]) return { path: nearestSafe(here, p) || [] };
    const { prev, dist } = bfs(here, p, true);
    if (run.exitOpen && run.exitShown && dist[run.exitAt] >= 0) return { path: route(prev, here, run.exitAt) };
    let pick = -1;
    for (const pk of run.pickups) { const c = cellOf(pk.x, pk.y); if (dist[c] >= 0 && dist[c] <= 5 && pk.type !== 'skull' && (pick < 0 || dist[c] < dist[pick])) pick = c; }
    if (pick >= 0 && pick !== here) return { path: route(prev, here, pick) };
    const ownBombs = run.bombs.filter(b => b.owner === 'p').length;
    if (ownBombs >= p.bombs) return { path: [] };
    /* the best reachable bombing spot that leaves an escape */
    let best = -1, bestScore = -1;
    for (let i = 0; i < N; ++i) {
      if (dist[i] < 0 || A.bombAtCell(i % COLS, (i / COLS) | 0)) continue;
      const v = value(i, p.fire);
      if (!v) continue;
      const score = v * 10 - dist[i];
      if (score <= bestScore) continue;
      buildDanger(i, p.fire);
      const esc = bfs(i, p, false);
      let ok = false;
      for (let j = 0; j < N && !ok; ++j) if (esc.dist[j] > 0 && esc.dist[j] <= 6 && !danger[j]) ok = true;
      buildDanger(-1, 0);
      if (ok) { best = i; bestScore = score; }
    }
    if (best === here) return { bomb: true, path: [] };
    if (best >= 0) return { path: route(prev, here, best) };
    /* nothing to do: wander toward the farthest reachable safe cell */
    let far = here;
    for (let i = 0; i < N; ++i) if (dist[i] > dist[far] && !danger[i]) far = i;
    return { path: route(prev, here, far).slice(0, 3) };
  }

  /* Proof mode (the bot cannot be hurt): march on the nearest target through bricks, bombing
     whatever brick blocks the way and whenever a target is in the blast */
  function bfsThrough(start, p) {
    const g = G.run.level.grid;
    const prev = new Int16Array(N).fill(-1);
    const dist = new Int16Array(N).fill(-1);
    const q = [start];
    dist[start] = 0;
    prev[start] = start;
    for (let h = 0; h < q.length; ++h) {
      const i = q[h];
      for (const d of DIRS) {
        const j = i + d[0] + d[1] * COLS;
        if (j < 0 || j >= N || dist[j] >= 0 || g[j] === C.T_HARD || (g[j] === C.T_TELE && j !== G.run.exitAt)) continue;
        dist[j] = dist[i] + 1;
        prev[j] = i;
        q.push(j);
      }
    }
    return { prev, dist };
  }

  function planFearless() {
    const run = G.run, p = run.player, g = run.level.grid;
    const here = cellOf(p.x, p.y);
    const { prev, dist } = bfsThrough(here, p);
    const targets = [];
    if (run.exitOpen && run.exitShown) targets.push(run.exitAt);
    else if (run.exitOpen && run.exitAt >= 0) targets.push(run.exitAt);
    else if (run.mode === 'zen') {
      for (let i = 0; i < N; ++i) if (g[i] === C.T_SOFT || g[i] === C.T_CRATE) targets.push(i);
      for (const pk of run.pickups) if (pk.type === 'gem' || pk.type === 'gem5') targets.push(cellOf(pk.x, pk.y));
    } else {
      for (const e of run.enemies) if (!e.hurry) targets.push(cellOf(e.x, e.y));
      const b = run.boss;
      if (b && b.state !== 'dead' && b.state !== 'dying') targets.push(cellOf(b.x, b.y));
      for (const pk of run.pickups) if (pk.type !== 'skull' && dist[cellOf(pk.x, pk.y)] >= 0 && dist[cellOf(pk.x, pk.y)] <= 6) targets.push(cellOf(pk.x, pk.y));
    }
    /* nearest first, but take turns among the three nearest every twelve seconds so runners cannot keep the bot busy */
    const reach = targets.filter(t => dist[t] >= 0).sort((a, b) => dist[a] - dist[b]);
    const goal = reach.length ? reach[Math.floor(run.t / 12) % Math.min(3, reach.length)] : -1;
    const blast = NS.levelgen.blastCells(g, here, p.fire);
    let hit = false;
    for (const e of run.enemies) if (blast.indexOf(cellOf(e.x, e.y)) >= 0) hit = true;
    if (run.boss && !run.boss.under && run.boss.state !== 'dead') for (const c of blast) if (NS.bosses.covers(run.boss, c % COLS, (c / COLS) | 0)) hit = true;
    if (goal < 0) return { path: [], bomb: hit };
    const r = route(prev, here, goal) || [];
    /* stop in front of the first brick (or bomb) on the way and blast it */
    const out = [];
    for (const c of r) {
      if (!walk(c, p)) { if (g[c] === C.T_SOFT || g[c] === C.T_CRATE) hit = true; break; }
      out.push(c);
      if (out.length >= 2) break;
    }
    if (run.mode === 'zen' && (g[goal] === C.T_SOFT || g[goal] === C.T_CRATE) && dist[goal] <= p.fire && blast.indexOf(goal) >= 0) hit = true;
    return { path: out, bomb: hit };
  }

  /* Honest mode: the proof planner's targets, but never into danger, and a bomb only with
     an escape route */
  function planCareful() {
    const run = G.run, p = run.player;
    const here = cellOf(p.x, p.y);
    buildDanger(-1, 0);
    if (danger[here]) return { path: nearestSafe(here, p) || [] };
    const d = planFearless();
    buildDanger(-1, 0);
    const out = [];
    for (const c of d.path) { if (danger[c]) break; out.push(c); }
    let bomb = false;
    if (d.bomb) {
      buildDanger(here, p.fire);
      const esc = bfs(here, p, false);
      for (let j = 0; j < N && !bomb; ++j) if (esc.dist[j] > 0 && esc.dist[j] <= 4 && !danger[j]) bomb = true;
      buildDanger(-1, 0);
    }
    return { path: out, bomb: bomb };
  }

  /* One step: decide at cell centres, else keep following */
  function step() {
    const run = G.run, inp = G.input;
    if (!run || run.phase !== 'play' || run.player.dead) { inp.moveX = inp.moveY = 0; return; }
    const p = run.player;
    const here = cellOf(p.x, p.y);
    const centred = Math.abs(p.x - Math.round(p.x)) < 0.06 && Math.abs(p.y - Math.round(p.y)) < 0.06;
    if (here === lastCell) ++stuck; else { stuck = 0; lastCell = here; }
    if (centred || !path || !path.length || stuck > 90) {
      const d = opts.fearless ? planFearless() : planCareful();
      path = d.path || [];
      if (d.bomb && !A.bombAtCell(Math.round(p.x), Math.round(p.y))) inp.bombQ = true;
      if (p.remote && run.bombs.some(b => b.owner === 'p' && b.remote)) {
        buildDanger(-1, 0);
        if (opts.fearless || !danger[here]) inp.detonateQ = true;
      }
      if (stuck > 90) stuck = 0;
    }
    inp.moveX = inp.moveY = 0;
    if (!path.length && !centred) {
      /* settle on the cell centre (exits and belts need it) */
      const dx = Math.round(p.x) - p.x, dy = Math.round(p.y) - p.y;
      if (Math.abs(dx) > 0.05) inp.moveX = Math.sign(dx); else if (Math.abs(dy) > 0.05) inp.moveY = Math.sign(dy);
    }
    while (path.length) {
      const t = path[0];
      const tc = t % COLS, tr = (t / COLS) | 0;
      if (Math.abs(p.x - tc) < 0.08 && Math.abs(p.y - tr) < 0.08) { path.shift(); continue; }
      const dx = tc - p.x, dy = tr - p.y;
      if (Math.abs(dx) > Math.abs(dy)) inp.moveX = Math.sign(dx); else inp.moveY = Math.sign(dy);
      break;
    }
  }

  return { step };
}

module.exports = { createBot };
