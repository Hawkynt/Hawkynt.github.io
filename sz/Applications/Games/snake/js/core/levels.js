/* Board building and validation, pure and seeded: layout motifs drawn with four-way symmetry
   (or a braided maze), hazard patches and timed traps, portal pairs, crates that never cut the
   board apart, unreachable pockets walled in, three golden eggs spread far from the start; the
   timed hazard clock; neighbours across wrap edges and portals; and the validator the tests run
   over every level. Owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { COLS, ROWS } = NS.constants;
  const { makeRng, hashString } = NS.rng;
  const { T, PORTAL_PAIR, HAZARD_TIMING } = NS.items;
  const { WORLDS } = NS.worlds;

  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const START_X = 3, START_Y = 8;

  function isSolid(ch) {
    return ch === T.WALL || ch === T.CRATE || ch === T.ROCK;
  }

  function isPortal(ch) {
    return ch === T.P1 || ch === T.P2 || ch === T.P3 || ch === T.P4;
  }

  function isTimed(ch) {
    return ch === T.SPIKE || ch === T.VENT || ch === T.GATE;
  }

  /* 'off', 'warn' or 'on' for a timed hazard cell; neighbours ripple a little apart */
  function hazardState(ch, i, time) {
    const h = HAZARD_TIMING[ch];
    if (!h) return 'off';
    const x = i % COLS, y = (i / COLS) | 0;
    const off = ch === T.GATE ? (y % 2) * h.period / 2 : ((x + y * 3) % 4) * h.period / 4;
    const p = ((time + off) % h.period + h.period) % h.period;
    if (p >= h.period - h.on) return 'on';
    if (p >= h.period - h.on - h.warn) return 'warn';
    return 'off';
  }

  /* the cell one step from i in direction d; -1 off the board (solid edge) */
  function step(level, i, d) {
    let x = i % level.cols + DX[d], y = ((i / level.cols) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) {
      if (!level.wrap) return -1;
      x = (x + level.cols) % level.cols;
      y = (y + level.rows) % level.rows;
    }
    return y * level.cols + x;
  }

  /* where a head entering cell i ends up (portals send it to their partner) */
  function arrive(level, i) {
    const ch = level.tiles[i];
    if (isPortal(ch)) {
      const p = level.portals[i];
      return p !== undefined ? p : i;
    }
    return i;
  }

  function linkPortals(level) {
    level.portals = {};
    const at = {};
    for (let i = 0; i < level.tiles.length; ++i)
      if (isPortal(level.tiles[i])) at[level.tiles[i]] = i;
    for (const ch in at) {
      const other = at[PORTAL_PAIR[ch]];
      if (other !== undefined) level.portals[at[ch]] = other;
    }
    return level;
  }

  /* BFS distances over passable cells (crates and walls block), through wrap edges and portals */
  function distances(level, from) {
    const n = level.tiles.length;
    const dist = new Int32Array(n).fill(-1);
    const q = new Int32Array(n);
    let h = 0, t = 0;
    dist[from] = 0;
    q[t++] = from;
    while (h < t) {
      const c = q[h++];
      for (let d = 0; d < 4; ++d) {
        const s = step(level, c, d);
        if (s < 0 || isSolid(level.tiles[s])) continue;
        const a = arrive(level, s);
        if (dist[s] < 0) { dist[s] = dist[c] + 1; q[t++] = s; }
        if (a !== s && dist[a] < 0) { dist[a] = dist[c] + 1; q[t++] = a; }
      }
    }
    return dist;
  }

  /* ── layout motifs, drawn into a tile array ── */
  function makeCanvas(wrap) {
    const tiles = new Array(COLS * ROWS).fill(T.FLOOR);
    if (!wrap) {
      for (let x = 0; x < COLS; ++x) { tiles[x] = T.WALL; tiles[(ROWS - 1) * COLS + x] = T.WALL; }
      for (let y = 0; y < ROWS; ++y) { tiles[y * COLS] = T.WALL; tiles[y * COLS + COLS - 1] = T.WALL; }
    }
    return tiles;
  }

  function sym(tiles, x, y, ch) {
    const pts = [[x, y], [COLS - 1 - x, y], [x, ROWS - 1 - y], [COLS - 1 - x, ROWS - 1 - y]];
    for (let k = 0; k < 4; ++k) {
      const px = pts[k][0], py = pts[k][1];
      if (px > 0 && py > 0 && px < COLS - 1 && py < ROWS - 1) tiles[py * COLS + px] = ch || T.WALL;
    }
  }

  function symRect(tiles, x0, y0, x1, y1) {
    for (let y = y0; y <= y1; ++y)
      for (let x = x0; x <= x1; ++x) sym(tiles, x, y);
  }

  const MOTIFS = {
    open(tiles, r) {
      const n = r.int(1, 2);
      for (let k = 0; k < n; ++k) {
        const x = r.int(6, 12), y = r.int(2, 5);
        if (r.chance(0.5)) symRect(tiles, x, y, x + 1, y);
        else symRect(tiles, x, y, x, y + 1);
      }
    },
    pillars(tiles, r) {
      const big = r.chance(0.5);
      for (let x = 5; x <= 13; x += 4)
        for (let y = 3; y <= 6; y += 3)
          if (big) symRect(tiles, x, y, x + 1, y); else sym(tiles, x, y);
    },
    rows(tiles, r) {
      const y = r.int(3, 5);
      symRect(tiles, r.int(3, 5), y, 11, y);
      symRect(tiles, 13, 2, 13, r.int(3, 4));
    },
    cross(tiles, r) {
      symRect(tiles, 14, 2, 14, r.int(4, 5));
      symRect(tiles, r.int(9, 10), 6, 12, 6);
      sym(tiles, 6, 3);
    },
    rings(tiles, r) {
      const x0 = r.int(7, 9), y0 = r.int(3, 4);
      symRect(tiles, x0, y0, 12, y0);
      symRect(tiles, x0, y0, x0, 6);
      sym(tiles, 4, 2);
    },
    zigzag(tiles, r) {
      const x0 = r.int(4, 6);
      for (let k = 0; k < 5; ++k) sym(tiles, x0 + k * 2, 2 + k % 3);
      symRect(tiles, 13, 5, 14, 5);
    },
    rooms(tiles, r) {
      const x = r.int(9, 11);
      for (let y = 1; y <= 7; ++y) if (y !== 3 && y !== 4) sym(tiles, x, y);
      symRect(tiles, x + 1, 5, x + 3, 5);
    },
    arena(tiles) {
      symRect(tiles, 4, 3, 6, 3);
      symRect(tiles, 4, 3, 4, 4);
    },
    maze(tiles, r) {
      /* coarse 9 x 5 cells of 2 x 2 floor with 1-wide walls, carved then braided open */
      const cw = 9, ch = 5;
      const wallAt = (x, y) => { if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1) tiles[y * COLS + x] = T.WALL; };
      for (let cy = 0; cy < ch; ++cy)
        for (let cx = 0; cx < cw; ++cx) {
          if (cx < cw - 1 && cy < ch - 1) wallAt(3 + cx * 3, 3 + cy * 3);
          if (cx < cw - 1) { wallAt(3 + cx * 3, 1 + cy * 3); wallAt(3 + cx * 3, 2 + cy * 3); }
          if (cy < ch - 1) { wallAt(1 + cx * 3, 3 + cy * 3); wallAt(2 + cx * 3, 3 + cy * 3); }
        }
      const seen = new Uint8Array(cw * ch);
      const stack = [0];
      seen[0] = 1;
      const open = (cx, cy, d) => {
        if (d === 1) { tiles[(1 + cy * 3) * COLS + 3 + cx * 3] = T.FLOOR; tiles[(2 + cy * 3) * COLS + 3 + cx * 3] = T.FLOOR; }
        if (d === 2) { tiles[(3 + cy * 3) * COLS + 1 + cx * 3] = T.FLOOR; tiles[(3 + cy * 3) * COLS + 2 + cx * 3] = T.FLOOR; }
      };
      while (stack.length) {
        const c = stack[stack.length - 1], cx = c % cw, cy = (c / cw) | 0;
        const opts = [];
        if (cx + 1 < cw && !seen[c + 1]) opts.push([c + 1, cx, cy, 1]);
        if (cx > 0 && !seen[c - 1]) opts.push([c - 1, cx - 1, cy, 1]);
        if (cy + 1 < ch && !seen[c + cw]) opts.push([c + cw, cx, cy, 2]);
        if (cy > 0 && !seen[c - cw]) opts.push([c - cw, cx, cy - 1, 2]);
        if (!opts.length) { stack.pop(); continue; }
        const o = r.pick(opts);
        open(o[1], o[2], o[3]);
        seen[o[0]] = 1;
        stack.push(o[0]);
      }
      /* braid: knock out a share of the remaining wall segments so there are loops to turn in */
      for (let cy = 0; cy < ch; ++cy)
        for (let cx = 0; cx < cw; ++cx) {
          if (cx + 1 < cw && r.chance(0.2)) open(cx, cy, 1);
          if (cy + 1 < ch && r.chance(0.2)) open(cx, cy, 2);
        }
    },
  };

  function protectStart(tiles) {
    for (let y = START_Y - 1; y <= START_Y + 1; ++y)
      for (let x = 1; x <= 9; ++x) tiles[y * COLS + x] = T.FLOOR;
    for (let x = 10; x <= 13; ++x) if (tiles[START_Y * COLS + x] === T.WALL) tiles[START_Y * COLS + x] = T.FLOOR;
  }

  function inStartZone(i) {
    const x = i % COLS, y = (i / COLS) | 0;
    return x <= 10 && y >= START_Y - 2 && y <= START_Y + 2;
  }

  function floorCells(tiles, r, filter) {
    const out = [];
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.FLOOR && !inStartZone(i) && (!filter || filter(i))) out.push(i);
    for (let i = out.length - 1; i > 0; --i) {
      const j = Math.floor(r() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* blobs of a soft tile (sand, ice) totalling about n cells */
  function patches(tiles, r, ch, n, wrap) {
    let placed = 0, guard = 0;
    while (placed < n && guard++ < 200) {
      const seeds = floorCells(tiles, r);
      if (!seeds.length) return;
      let c = seeds[0];
      const size = r.int(3, 7);
      for (let k = 0; k < size && placed < n; ++k) {
        if (tiles[c] === T.FLOOR && !inStartZone(c)) { tiles[c] = ch; ++placed; }
        const d = r.int(0, 3);
        const s = step({ cols: COLS, rows: ROWS, wrap: wrap }, c, d);
        if (s >= 0 && tiles[s] !== T.WALL) c = s;
      }
    }
  }

  function scatter(tiles, r, ch, n) {
    const cells = floorCells(tiles, r);
    for (let k = 0; k < n && k < cells.length; ++k) tiles[cells[k]] = ch;
  }

  function placePortals(level, r, pairs) {
    const t = level.tiles;
    const pick = (lo, hi) => {
      const c = floorCells(t, r, (i) => { const x = i % COLS; return x >= lo && x <= hi; });
      return c.length ? c[0] : -1;
    };
    for (let p = 0; p < pairs; ++p) {
      const a = p === 0 ? pick(2, 9) : pick(11, 18), b = p === 0 ? pick(20, 27) : pick(11, 18);
      if (a < 0 || b < 0 || a === b) continue;
      t[a] = p === 0 ? T.P1 : T.P3;
      t[b] = p === 0 ? T.P2 : T.P4;
    }
    linkPortals(level);
  }

  function reachableCount(level, start) {
    const dist = distances(level, start);
    let n = 0;
    for (let i = 0; i < dist.length; ++i) if (dist[i] >= 0) ++n;
    return n;
  }

  /* crates go one at a time, kept only if everything else stays reachable */
  function placeCrates(level, r, n, start) {
    const t = level.tiles;
    let total = reachableCount(level, start);
    const cells = floorCells(t, r);
    let placed = 0;
    for (let k = 0; k < cells.length && placed < n; ++k) {
      const c = cells[k];
      t[c] = T.CRATE;
      const now = reachableCount(level, start);
      if (now === total - 1) { total = now; ++placed; } else t[c] = T.FLOOR;
    }
  }

  function sealPockets(level, start) {
    const dist = distances(level, start);
    for (let i = 0; i < level.tiles.length; ++i)
      if (dist[i] < 0 && !isSolid(level.tiles[i])) level.tiles[i] = T.WALL;
  }

  function placeEggs(level, start, count) {
    const dist = distances(level, start);
    const cand = [];
    for (let i = 0; i < level.tiles.length; ++i)
      if (dist[i] >= 6 && level.tiles[i] === T.FLOOR) cand.push(i);
    const eggs = [];
    while (eggs.length < count && cand.length) {
      let best = -1, bestScore = -1;
      for (let k = 0; k < cand.length; ++k) {
        const c = cand[k];
        let s = Math.min(dist[c], 14);
        for (let e = 0; e < eggs.length; ++e) {
          const dx = Math.abs(c % COLS - eggs[e] % COLS), dy = Math.abs(((c / COLS) | 0) - ((eggs[e] / COLS) | 0));
          s = Math.min(s, (dx + dy) * 1.2);
        }
        if (s > bestScore) { bestScore = s; best = k; }
      }
      eggs.push(cand[best]);
      cand.splice(best, 1);
    }
    return eggs;
  }

  /* opts: seed, theme, motif, wrap, hazards {ice, sand, spike, vent, gate}, crates, portals, eggs */
  function buildBoard(opts) {
    const r = makeRng(opts.seed);
    const wrap = !!opts.wrap;
    const tiles = makeCanvas(wrap);
    const motif = MOTIFS[opts.motif] || MOTIFS.open;
    if (opts.motif !== 'none') motif(tiles, r);
    protectStart(tiles);
    const level = { cols: COLS, rows: ROWS, tiles: tiles, wrap: wrap, theme: opts.theme || 0, motif: opts.motif, portals: {} };
    const start = START_Y * COLS + START_X;
    sealPockets(level, start);
    const hz = opts.hazards || {};
    if (hz.sand) patches(tiles, r, T.SAND, hz.sand, wrap);
    if (hz.ice) patches(tiles, r, T.ICE, hz.ice, wrap);
    if (hz.spike) scatter(tiles, r, T.SPIKE, hz.spike);
    if (hz.vent) scatter(tiles, r, T.VENT, hz.vent);
    if (hz.gate) scatter(tiles, r, T.GATE, hz.gate);
    if (opts.portals) placePortals(level, r, opts.portals);
    if (opts.crates) placeCrates(level, r, opts.crates, start);
    level.start = { i: start, dir: 1 };
    level.eggs = opts.eggs ? placeEggs(level, start, opts.eggs) : [];
    return level;
  }

  function storyLevel(w, l) {
    const world = WORLDS[w];
    const rec = world.levels[l];
    const level = buildBoard({
      seed: hashString('snake-story-' + w + '-' + l), theme: world.theme, motif: rec.motif, wrap: false,
      hazards: rec.hazards, crates: rec.crates, portals: rec.portals, eggs: 3,
    });
    level.w = w;
    level.l = l;
    level.name = rec.name;
    level.goal = rec.goal;
    level.speed = rec.speed;
    level.enemies = rec.enemies.slice();
    level.boss = rec.boss || null;
    return level;
  }

  function validate(level) {
    const errors = [];
    const n = level.cols * level.rows;
    if (level.tiles.length !== n) errors.push('size');
    if (!level.wrap) {
      for (let x = 0; x < level.cols; ++x)
        if (level.tiles[x] !== T.WALL || level.tiles[n - level.cols + x] !== T.WALL) { errors.push('border'); break; }
    }
    const s = level.start.i;
    let c = s;
    for (let k = 0; k < 6; ++k) {
      if (c < 0 || level.tiles[c] !== T.FLOOR) { errors.push('start lane blocked at ' + k); break; }
      c = step(level, c, level.start.dir);
    }
    const dist = distances(level, s);
    let free = 0;
    for (let i = 0; i < n; ++i) {
      if (isSolid(level.tiles[i])) continue;
      ++free;
      if (dist[i] < 0) { errors.push('unreachable cell ' + i); break; }
    }
    if (free < 150) errors.push('too cramped: ' + free);
    const seen = {};
    for (let e = 0; e < level.eggs.length; ++e) {
      const i = level.eggs[e];
      if (level.tiles[i] !== T.FLOOR || dist[i] < 0 || seen[i]) errors.push('bad egg ' + i);
      seen[i] = 1;
    }
    for (const a in level.portals) {
      if (level.portals[level.portals[a]] !== +a) errors.push('portal pairing ' + a);
    }
    return { ok: errors.length === 0, errors: errors, free: free };
  }

  Object.assign(NS.levels, {
    DX, DY, START_X, START_Y, MOTIFS, isSolid, isPortal, isTimed, hazardState, step, arrive, linkPortals, distances,
    buildBoard, storyLevel, validate
  });
})();
