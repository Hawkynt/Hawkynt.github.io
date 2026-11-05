/* The autopilot that plays the title screen's attract mode (and proves levels completable in
   the tests): a breadth-first danger map from every threatening ghost, boss and shard, then a
   breadth-first search from Pac-Man over tiles it reaches safely ahead of them toward the
   nearest dot, fruit, power-up or frightened ghost - a power pellet when cornered - or the
   safest tile when nothing is reachable. Owns its search buffers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const { COLS, DX, DY, D_DOT, D_POWER } = C;
  const grid = NS.grid;

  const N = C.COLS * C.ROWS;
  const danger = new Int16Array(N);
  const dist = new Int16Array(N);
  const first = new Int8Array(N);
  const queue = new Int32Array(N + 8);
  const sources = [];
  let thinkT = 0;
  const last = { best: -1, score: 0, safest: -1 };

  function threats(lvl) {
    sources.length = 0;
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode !== 'out' && g.mode !== 'leaving') continue;
      if (g.scared || g.stun > 0.4 || lvl.effects.freeze > 0.4 || lvl.effects.mega > 0.3) continue;
      sources.push(grid.tileIndex(g.x, g.y));
      /* a ghost also threatens the tile it is heading into */
      if (g.dir >= 0) {
        const nx = grid.wrapX(Math.floor(g.x) + DX[g.dir]), ny = Math.floor(g.y) + DY[g.dir];
        if (grid.canEnter(lvl.maze, nx, ny, 'ghost')) sources.push(ny * COLS + nx);
      }
    }
    grid.bfs(lvl.maze, sources, danger, 'pac', 40);
    /* phantoms, bosses and shards ignore walls: mark by straight distance */
    const extra = [];
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode === 'out' && NS.ghosts.aiOf(g) === 'phase' && !g.scared && lvl.effects.mega <= 0) extra.push([g.x, g.y, 2.5]);
    }
    const b = lvl.boss;
    if (b && b.state !== 'dying' && !(b.vuln && (lvl.frightT > 0.6 || lvl.effects.mega > 0.6))) {
      extra.push([b.x, b.y, NS.boss.radius(b) + (b.state === 'tele' || b.state === 'charge' ? 4.5 : 2.6)]);
      if (b.state === 'tele' || b.state === 'charge') extra.push([b.tx, b.ty, 3.2]);
    }
    for (let i = 0; i < lvl.shots.length; ++i) {
      const s = lvl.shots[i];
      if (s.owner === 'boss') {
        extra.push([s.x, s.y, 1.6]);
        extra.push([s.x + s.vx * 0.35, s.y + s.vy * 0.35, 1.6]);
      }
    }
    if (lvl.features.indexOf('vents') >= 0) {
      const m = lvl.maze;
      for (let i = 0; i < N; ++i) {
        if (m.feat[i] !== C.F_VENT) continue;
        const x = i % COLS, y = (i - x) / COLS;
        if (NS.hazards.ventState(lvl, x, y) !== 'idle') extra.push([x + 0.5, y + 0.5, 0.9]);
      }
    }
    for (let k = 0; k < extra.length; ++k) {
      const e = extra[k];
      const r = e[2];
      for (let y = Math.max(0, Math.floor(e[1] - r)); y <= Math.min(C.ROWS - 1, Math.floor(e[1] + r)); ++y)
        for (let x = Math.max(0, Math.floor(e[0] - r)); x <= Math.min(COLS - 1, Math.floor(e[0] + r)); ++x) {
          const d = Math.max(0, Math.floor(Math.sqrt((x + 0.5 - e[0]) * (x + 0.5 - e[0]) + (y + 0.5 - e[1]) * (y + 0.5 - e[1])) - r + 1));
          const i = y * COLS + x;
          if (danger[i] < 0 || d < danger[i]) danger[i] = d;
        }
    }
  }

  function isGoal(lvl, i, hunt, wantPower) {
    const m = lvl.maze;
    if (m.dots[i] === D_POWER) return wantPower || lvl.kind === 'boss' ? 3 : 1;
    if (m.dots[i] === D_DOT) return 1;
    for (let k = 0; k < lvl.items.length; ++k) if (grid.tileIndex(lvl.items[k].x, lvl.items[k].y) === i) return 2;
    if (hunt) {
      for (let k = 0; k < lvl.ghosts.length; ++k) {
        const g = lvl.ghosts[k];
        if (g.mode === 'out' && (g.scared || lvl.effects.mega > 0) && grid.tileIndex(g.x, g.y) === i) return 3;
      }
      const b = lvl.boss;
      if (b && b.vuln && (lvl.frightT > 1 || lvl.effects.mega > 1) && grid.tileIndex(b.x, b.y) === i) return 3;
    }
    return 0;
  }

  /* chooses a direction for Pac-Man; returns -1 to keep going */
  function think(lvl) {
    const pac = lvl.pac;
    const m = lvl.maze;
    threats(lvl);
    const start = grid.tileIndex(pac.x, pac.y);
    const hunt = lvl.frightT > 1.2 || lvl.effects.mega > 1;
    const near = danger[start] >= 0 && danger[start] < 7;
    dist.fill(-1);
    let head = 0, tail = 0;
    dist[start] = 0;
    first[start] = -1;
    queue[tail++] = start;
    let best = -1, bestScore = -Infinity;
    let safest = -1, safestD = -1;
    const kind = lvl.effects.phase > 0 ? 'phase' : 'pac';
    while (head < tail) {
      const i = queue[head++];
      const d = dist[i];
      if (i !== start) {
        const g = isGoal(lvl, i, hunt, near);
        if (g) {
          const score = g * 8 - d;
          if (score > bestScore) { bestScore = score; best = i; }
        }
        const dz = danger[i] < 0 ? 99 : danger[i];
        if (dz - d > safestD) { safestD = dz - d; safest = i; }
        if (d > 30 && best >= 0) break;
      }
      const x = i % COLS, y = (i - x) / COLS;
      for (let k = 0; k < 4; ++k) {
        let j;
        if (kind === 'pac') {
          j = NS.mazes.stepPlay(m, i, k);
          if (j < 0) continue;
        } else {
          let nx = x + DX[k];
          const ny = y + DY[k];
          if (!grid.canEnter(m, nx, ny, kind)) continue;
          nx = grid.wrapX(nx);
          j = ny * COLS + nx;
        }
        if (dist[j] >= 0) continue;
        /* unsafe if a threat gets there no later than Pac-Man (with a margin) */
        const dz = danger[j];
        if (dz >= 0 && dz <= d + 2 && d < 9) continue;
        dist[j] = d + 1;
        first[j] = i === start ? k : first[i];
        queue[tail++] = j;
      }
    }
    last.best = best; last.score = bestScore; last.safest = safest;
    if (best >= 0) return first[best];
    if (safest >= 0) return first[safest];
    /* boxed in: step to the neighbour farthest from danger */
    let bd = -1, dir = -1;
    const x = start % COLS, y = (start - x) / COLS;
    for (let k = 0; k < 4; ++k) {
      let nx = x + DX[k];
      const ny = y + DY[k];
      if (!grid.canEnter(m, nx, ny, kind)) continue;
      nx = grid.wrapX(nx);
      const dz = danger[ny * COLS + nx];
      const v = dz < 0 ? 99 : dz;
      if (v > bd) { bd = v; dir = k; }
    }
    return dir;
  }

  /* sets pac.want a few times a second (and at every new tile) */
  function drive(lvl, dt) {
    thinkT -= dt;
    const pac = lvl.pac;
    const tile = grid.tileIndex(pac.x, pac.y);
    if (thinkT > 0 && tile === pac.botTile && pac.dir >= 0) return;
    thinkT = 0.12;
    pac.botTile = tile;
    const d = think(lvl);
    if (d >= 0) pac.want = d;
  }

  Object.assign(NS.autopilot, {
    think, drive, danger, last
  });
})();
