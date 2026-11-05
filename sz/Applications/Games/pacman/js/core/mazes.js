/* Mazes as plain data: the classic 28 x 31 layout, a seeded generator of mirror-symmetric mazes
   on a corridor lattice (no dead ends, one connected network, the standard ghost house and
   start), placement of the tile twists (arrow pads, taffy, ice, portals, fire vents) and a
   validator that proves a maze is fully walkable. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const { COLS, ROWS, W_OPEN, W_WALL, W_HOUSE, W_GATE, D_NONE, D_DOT, D_POWER } = C;

  /* the original layout: 0 wall, 1 dot, 2 power pellet, 3 empty, 4 house, 5 gate */
  const CLASSIC = [
    '0000000000000000000000000000',
    '0111111111111001111111111110',
    '0100001000001001000001000010',
    '0200001000001001000001000020',
    '0100001000001001000001000010',
    '0111111111111111111111111110',
    '0100001001000000001001000010',
    '0100001001000000001001000010',
    '0111111001111001111001111110',
    '0000001000003003000001000000',
    '0000001000003003000001000000',
    '0000001003333333333001000000',
    '0000001003000550003001000000',
    '0000001003044444403001000000',
    '3333331333044444403331333333',
    '0000001003044444403001000000',
    '0000001003000000003001000000',
    '0000001003333333333001000000',
    '0000001003000000003001000000',
    '0000001003000000003001000000',
    '0111111111111001111111111110',
    '0100001000001001000001000010',
    '0100001000001001000001000010',
    '0211001111111331111111001120',
    '0001001001000000001001001000',
    '0001001001000000001001001000',
    '0111111001111001111001111110',
    '0100000000001001000000000010',
    '0100000000001001000000000010',
    '0111111111111111111111111110',
    '0000000000000000000000000000',
  ];

  function idx(x, y) {
    return y * COLS + x;
  }

  function blank() {
    const n = COLS * ROWS;
    const m = { w: COLS, h: ROWS, walls: new Array(n), dots: new Array(n), feat: new Array(n), tunnels: [], portals: [], seed: 0, name: '', dotCount: 0 };
    for (let i = 0; i < n; ++i) { m.walls[i] = W_WALL; m.dots[i] = D_NONE; m.feat[i] = 0; }
    return m;
  }

  function classic() {
    const m = blank();
    m.seed = 'classic';
    m.name = 'The Original';
    for (let y = 0; y < ROWS; ++y) {
      for (let x = 0; x < COLS; ++x) {
        const c = CLASSIC[y].charCodeAt(x) - 48;
        const i = idx(x, y);
        m.walls[i] = c === 0 ? W_WALL : c === 4 ? W_HOUSE : c === 5 ? W_GATE : W_OPEN;
        m.dots[i] = c === 1 ? D_DOT : c === 2 ? D_POWER : D_NONE;
      }
    }
    m.tunnels = [14];
    count(m);
    return m;
  }

  function count(m) {
    let n = 0;
    for (let i = 0; i < m.dots.length; ++i) if (m.dots[i]) ++n;
    m.dotCount = n;
    return n;
  }

  /* ── the lattice generator ── */
  const XS = [1, 5, 9, 12, 15, 18, 22, 26];
  const YS = [1, 5, 8, 11, 14, 17, 20, 23, 26, 29];
  const NX = XS.length, NY = YS.length;

  function inHouseZone(x, y) {
    return x >= 9 && x <= 18 && y >= 9 && y <= 19;
  }

  /* hseg[j][i]: row YS[j] from XS[i] to XS[i+1]; vseg[i][j]: column XS[i] from YS[j] to YS[j+1] */
  function lattice() {
    const h = [], v = [];
    for (let j = 0; j < NY; ++j) { h.push([]); for (let i = 0; i < NX - 1; ++i) h[j].push(1); }
    for (let i = 0; i < NX; ++i) { v.push([]); for (let j = 0; j < NY - 1; ++j) v[i].push(1); }
    return { h: h, v: v };
  }

  const FORCED_CLOSED = [['v', 3, 3], ['v', 3, 4], ['v', 4, 3], ['v', 4, 4], ['h', 4, 2], ['h', 4, 3], ['h', 4, 4]];
  const FORCED_OPEN = [['h', 3, 2], ['h', 3, 3], ['h', 3, 4], ['h', 5, 2], ['h', 5, 3], ['h', 5, 4],
    ['v', 2, 3], ['v', 2, 4], ['v', 5, 3], ['v', 5, 4], ['h', 7, 3]];

  function forced(kind, a, b) {
    for (let k = 0; k < FORCED_CLOSED.length; ++k) {
      const f = FORCED_CLOSED[k];
      if (f[0] === kind && f[1] === a && f[2] === b) return 'closed';
    }
    for (let k = 0; k < FORCED_OPEN.length; ++k) {
      const f = FORCED_OPEN[k];
      if (f[0] === kind && f[1] === a && f[2] === b) return 'open';
    }
    return '';
  }

  /* degree of node (i, j); tunnel rows add one at the edge columns */
  function degree(L, i, j, tunnelRows) {
    let d = 0;
    if (i > 0 && L.h[j][i - 1]) ++d;
    if (i < NX - 1 && L.h[j][i]) ++d;
    if (j > 0 && L.v[i][j - 1]) ++d;
    if (j < NY - 1 && L.v[i][j]) ++d;
    if ((i === 0 || i === NX - 1) && tunnelRows.indexOf(j) >= 0) ++d;
    return d;
  }

  /* every node with a corridor is connected to the start node; no node has exactly one way out */
  function latticeOk(L, tunnelRows) {
    let live = 0;
    for (let i = 0; i < NX; ++i)
      for (let j = 0; j < NY; ++j) {
        const d = degree(L, i, j, tunnelRows);
        if (d === 1) return false;
        if (d) ++live;
      }
    const seen = {};
    const stack = [[3, 7]];
    seen['3,7'] = 1;
    let reached = 0;
    while (stack.length) {
      const n = stack.pop();
      const i = n[0], j = n[1];
      ++reached;
      const nb = [];
      if (i > 0 && L.h[j][i - 1]) nb.push([i - 1, j]);
      if (i < NX - 1 && L.h[j][i]) nb.push([i + 1, j]);
      if (j > 0 && L.v[i][j - 1]) nb.push([i, j - 1]);
      if (j < NY - 1 && L.v[i][j]) nb.push([i, j + 1]);
      if ((i === 0 || i === NX - 1) && tunnelRows.indexOf(j) >= 0) nb.push([NX - 1 - i, j]);
      for (let k = 0; k < nb.length; ++k) {
        const key = nb[k][0] + ',' + nb[k][1];
        if (!seen[key]) { seen[key] = 1; stack.push(nb[k]); }
      }
    }
    return reached === live;
  }

  /* sets a segment and its mirror image */
  function setSeg(L, kind, a, b, val) {
    if (kind === 'h') {
      L.h[a][b] = val;
      L.h[a][NX - 2 - b] = val;
    } else {
      L.v[a][b] = val;
      L.v[NX - 1 - a][b] = val;
    }
  }

  function generate(seed, opts) {
    opts = opts || {};
    for (let attempt = 0; attempt < 40; ++attempt) {
      const m = tryGenerate(seed, attempt, opts);
      if (m && validate(m).ok && validatePlay(m).ok) return m;
    }
    const m = classic();
    if (opts.features) placeFeatures(m, NS.rng.makeRng(NS.rng.hashString('f' + seed)), opts.features);
    return m;
  }

  function tryGenerate(seed, attempt, opts) {
    const rng = NS.rng.makeRng(NS.rng.hashString(String(seed) + ':' + attempt));
    const L = lattice();
    const tunnelRows = [4];
    if (rng() < 0.45) tunnelRows.push(rng() < 0.5 ? 2 : 6);
    for (let k = 0; k < FORCED_CLOSED.length; ++k) {
      const f = FORCED_CLOSED[k];
      if (f[0] === 'h') L.h[f[1]][f[2]] = 0;
      else L.v[f[1]][f[2]] = 0;
    }
    /* candidates on the left half and the centre */
    const cand = [];
    for (let j = 0; j < NY; ++j)
      for (let i = 0; i <= 3; ++i)
        if (!forced('h', j, i)) cand.push(['h', j, i]);
    for (let i = 0; i <= 3; ++i)
      for (let j = 0; j < NY - 1; ++j)
        if (!forced('v', i, j)) cand.push(['v', i, j]);
    for (let k = cand.length - 1; k > 0; --k) {
      const r = Math.floor(rng() * (k + 1));
      const t = cand[k]; cand[k] = cand[r]; cand[r] = t;
    }
    const ratio = opts.close !== undefined ? opts.close : 0.3 + rng() * 0.16;
    let target = Math.round(cand.length * ratio), closed = 0;
    for (let k = 0; k < cand.length && closed < target; ++k) {
      const c = cand[k];
      setSeg(L, c[0], c[1], c[2], 0);
      if (latticeOk(L, tunnelRows)) ++closed;
      else setSeg(L, c[0], c[1], c[2], 1);
    }
    /* now and then, retire a whole node for bigger wall blocks */
    if (!opts.arena) {
      for (let tries = 0; tries < 6; ++tries) {
        const i = rng.int(0, 3), j = rng.int(0, NY - 1);
        if (degree(L, i, j, tunnelRows) !== 2) continue;
        const segs = [];
        if (i > 0 && L.h[j][i - 1]) segs.push(['h', j, i - 1]);
        if (L.h[j][i]) segs.push(['h', j, i]);
        if (j > 0 && L.v[i][j - 1]) segs.push(['v', i, j - 1]);
        if (j < NY - 1 && L.v[i][j]) segs.push(['v', i, j]);
        if (segs.some(s => forced(s[0], s[1], s[2]))) continue;
        for (let s = 0; s < segs.length; ++s) setSeg(L, segs[s][0], segs[s][1], segs[s][2], 0);
        if (!latticeOk(L, tunnelRows))
          for (let s = 0; s < segs.length; ++s) setSeg(L, segs[s][0], segs[s][1], segs[s][2], 1);
      }
    }
    return toMaze(L, tunnelRows, seed, rng, opts);
  }

  function toMaze(L, tunnelRows, seed, rng, opts) {
    const m = blank();
    m.seed = seed;
    const open = (x, y) => { m.walls[idx(x, y)] = W_OPEN; };
    for (let j = 0; j < NY; ++j)
      for (let i = 0; i < NX - 1; ++i)
        if (L.h[j][i]) for (let x = XS[i]; x <= XS[i + 1]; ++x) open(x, YS[j]);
    for (let i = 0; i < NX; ++i)
      for (let j = 0; j < NY - 1; ++j)
        if (L.v[i][j]) for (let y = YS[j]; y <= YS[j + 1]; ++y) open(XS[i], y);
    for (let k = 0; k < tunnelRows.length; ++k) {
      const y = YS[tunnelRows[k]];
      open(0, y);
      open(COLS - 1, y);
      m.tunnels.push(y);
    }
    m.tunnels.sort((a, b) => a - b);
    /* the ghost house */
    for (let y = 12; y <= 16; ++y)
      for (let x = 10; x <= 17; ++x)
        m.walls[idx(x, y)] = (x >= 11 && x <= 16 && y >= 13 && y <= 15) ? W_HOUSE : W_WALL;
    m.walls[idx(13, 12)] = W_GATE;
    m.walls[idx(14, 12)] = W_GATE;
    /* dots everywhere open, except around the house, in tunnels and on the start */
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        const i = idx(x, y);
        if (m.walls[i] !== W_OPEN) continue;
        if (inHouseZone(x, y) || x === 0 || x === COLS - 1) continue;
        if (y === 23 && (x === 13 || x === 14)) continue;
        m.dots[i] = D_DOT;
      }
    placePower(m, [[1, 3], [1, 23]]);
    count(m);
    if (opts.features && opts.features.length) placeFeatures(m, rng, opts.features);
    return m;
  }

  function placePower(m, targets) {
    for (let t = 0; t < targets.length; ++t) {
      let best = -1, bd = Infinity;
      for (let y = 0; y < ROWS; ++y)
        for (let x = 1; x < COLS / 2; ++x) {
          if (m.dots[idx(x, y)] !== D_DOT) continue;
          const d = (x - targets[t][0]) * (x - targets[t][0]) + (y - targets[t][1]) * (y - targets[t][1]);
          if (d < bd) { bd = d; best = idx(x, y); }
        }
      if (best < 0) continue;
      const x = best % COLS, y = Math.floor(best / COLS);
      m.dots[best] = D_POWER;
      m.dots[idx(COLS - 1 - x, y)] = D_POWER;
    }
  }

  function isOpen(m, x, y) {
    if (y < 0 || y >= ROWS) return false;
    if (x < 0 || x >= COLS) return m.tunnels.indexOf(y) >= 0;
    return m.walls[idx(x, y)] === W_OPEN;
  }

  /* straight corridor tiles (two opposite open neighbours only) on the left half, away from the house */
  function straightTiles(m, axis) {
    const out = [];
    for (let y = 1; y < ROWS - 1; ++y)
      for (let x = 2; x < COLS / 2; ++x) {
        if (m.walls[idx(x, y)] !== W_OPEN || inHouseZone(x, y) || m.dots[idx(x, y)] === D_POWER) continue;
        const l = isOpen(m, x - 1, y), r = isOpen(m, x + 1, y), u = isOpen(m, x, y - 1), d = isOpen(m, x, y + 1);
        if (axis === 'h' && l && r && !u && !d) out.push([x, y]);
        if (axis === 'v' && u && d && !l && !r) out.push([x, y]);
        if (!axis && ((l && r && !u && !d) || (u && d && !l && !r))) out.push([x, y]);
      }
    return out;
  }

  function mirrorFeat(m, x, y, f, fm) {
    m.feat[idx(x, y)] = f;
    m.feat[idx(COLS - 1 - x, y)] = fm === undefined ? f : fm;
  }

  function pickFree(m, rng, list, near) {
    for (let tries = 0; tries < 30 && list.length; ++tries) {
      const k = Math.floor(rng() * list.length);
      const p = list[k];
      list.splice(k, 1);
      if (m.feat[idx(p[0], p[1])] || p[0] > 11) continue;
      if (near && Math.abs(p[0] - 13.5) < 3 && p[1] > 20 && p[1] < 26) continue;
      return p;
    }
    return null;
  }

  function placeFeatures(m, rng, features) {
    const F = C;
    if (features.indexOf('pads') >= 0) {
      const hs = straightTiles(m, 'h'), vs = straightTiles(m, 'v');
      for (let k = 0; k < 2; ++k) {
        const p = pickFree(m, rng, hs, true);
        if (p) { const left = rng() < 0.5; mirrorFeat(m, p[0], p[1], left ? F.F_PAD_L : F.F_PAD_R, left ? F.F_PAD_R : F.F_PAD_L); }
        const q = pickFree(m, rng, vs, true);
        if (q) { const f = rng() < 0.5 ? F.F_PAD_U : F.F_PAD_D; mirrorFeat(m, q[0], q[1], f); }
      }
    }
    if (features.indexOf('taffy') >= 0) {
      const s = straightTiles(m);
      for (let k = 0; k < 3; ++k) { const p = pickFree(m, rng, s, true); if (p) mirrorFeat(m, p[0], p[1], F.F_TAFFY); }
    }
    if (features.indexOf('ice') >= 0) {
      /* whole straight runs turn to ice */
      const hs = straightTiles(m, 'h');
      for (let k = 0; k < 3 && hs.length; ++k) {
        const p = pickFree(m, rng, hs, false);
        if (!p) break;
        let x = p[0];
        while (x > 1 && isOpen(m, x - 1, p[1]) && !isOpen(m, x - 1, p[1] - 1) && !isOpen(m, x - 1, p[1] + 1)) --x;
        while (x < COLS / 2 && isOpen(m, x, p[1]) && !isOpen(m, x, p[1] - 1) && !isOpen(m, x, p[1] + 1)) {
          if (!m.feat[idx(x, p[1])]) mirrorFeat(m, x, p[1], F.F_ICE);
          ++x;
        }
      }
    }
    if (features.indexOf('portals') >= 0) {
      const s = straightTiles(m).filter(p => p[1] < 12);
      const p = pickFree(m, rng, s, false);
      if (p) {
        const q = nearestOpen(m, COLS - 1 - p[0], ROWS - 1 - p[1], true);
        if (q && !m.feat[idx(q[0], q[1])]) {
          m.feat[idx(p[0], p[1])] = F.F_PORTAL;
          m.feat[idx(q[0], q[1])] = F.F_PORTAL;
          m.feat[idx(COLS - 1 - p[0], p[1])] = F.F_PORTAL;
          m.feat[idx(COLS - 1 - q[0], q[1])] = F.F_PORTAL;
          m.portals.push([p[0], p[1], q[0], q[1]]);
          m.portals.push([COLS - 1 - p[0], p[1], COLS - 1 - q[0], q[1]]);
        }
      }
    }
    if (features.indexOf('vents') >= 0) {
      const s = straightTiles(m);
      for (let k = 0; k < 3; ++k) { const p = pickFree(m, rng, s, true); if (p) mirrorFeat(m, p[0], p[1], F.F_VENT); }
    }
  }

  function nearestOpen(m, tx, ty, straight) {
    let best = null, bd = Infinity;
    for (let y = 1; y < ROWS - 1; ++y)
      for (let x = 2; x < COLS - 2; ++x) {
        if (m.walls[idx(x, y)] !== W_OPEN || inHouseZone(x, y)) continue;
        if (straight) {
          const l = isOpen(m, x - 1, y), r = isOpen(m, x + 1, y), u = isOpen(m, x, y - 1), d = isOpen(m, x, y + 1);
          if (!((l && r && !u && !d) || (u && d && !l && !r))) continue;
        }
        const d2 = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d2 < bd) { bd = d2; best = [x, y]; }
      }
    return best;
  }

  /* Proves a maze playable: returns { ok, errors, reachable, open, dots, power } */
  function validate(m) {
    const errors = [];
    if (m.walls.length !== COLS * ROWS) errors.push('size');
    let open = 0, dots = 0, power = 0;
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        const i = idx(x, y);
        if (m.walls[i] !== m.walls[idx(COLS - 1 - x, y)]) { errors.push('asymmetric at ' + x + ',' + y); return { ok: false, errors: errors }; }
        if (m.walls[i] === W_OPEN) ++open;
        if (m.dots[i] && m.walls[i] !== W_OPEN) errors.push('dot inside a wall at ' + x + ',' + y);
        if (m.dots[i] === D_DOT) ++dots;
        if (m.dots[i] === D_POWER) ++power;
      }
    if (m.walls[idx(13, 12)] !== W_GATE || m.walls[idx(14, 12)] !== W_GATE) errors.push('gate');
    if (!isOpen(m, 13, 11) || !isOpen(m, 14, 11)) errors.push('door');
    if (!isOpen(m, 13, 23) || !isOpen(m, 14, 23)) errors.push('start');
    /* flood fill from the start with tunnel wrap */
    const seen = new Uint8Array(COLS * ROWS);
    const stack = [idx(13, 23)];
    seen[stack[0]] = 1;
    let reached = 0;
    while (stack.length) {
      const i = stack.pop();
      ++reached;
      const x = i % COLS, y = Math.floor(i / COLS);
      for (let d = 0; d < 4; ++d) {
        let nx = x + C.DX[d];
        const ny = y + C.DY[d];
        if (!isOpen(m, nx, ny)) continue;
        nx = (nx + COLS) % COLS;
        const j = idx(nx, ny);
        if (!seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (reached !== open) errors.push('unreachable tiles: ' + (open - reached));
    /* no dead ends */
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        if (m.walls[idx(x, y)] !== W_OPEN) continue;
        let n = 0;
        for (let d = 0; d < 4; ++d) if (isOpen(m, x + C.DX[d], y + C.DY[d])) ++n;
        if (n < 2) errors.push('dead end at ' + x + ',' + y);
      }
    if (power !== 4) errors.push('power pellets: ' + power);
    if (dots < 150) errors.push('too few dots: ' + dots);
    for (let k = 0; k < m.portals.length; ++k) {
      const p = m.portals[k];
      if (!isOpen(m, p[0], p[1]) || !isOpen(m, p[2], p[3])) errors.push('portal in a wall');
    }
    return { ok: errors.length === 0, errors: errors, reachable: reached, open: open, dots: dots, power: power };
  }

  /* Where Pac-Man really goes from tile i in direction d: arrow pads only fling one way, portals
     carry him to their partner. Returns the tile index reached or -1. */
  function stepPlay(m, i, d) {
    const F = m.feat[i];
    if (F >= C.F_PAD_L && F <= C.F_PAD_D && d !== F - C.F_PAD_L) return -1;
    const x = i % COLS, y = (i - x) / COLS;
    const nx = x + C.DX[d], ny = y + C.DY[d];
    if (!isOpen(m, nx, ny)) return -1;
    let j = idx((nx + COLS) % COLS, ny);
    if (m.feat[j] === C.F_PORTAL) j = partner(m, j);
    return j;
  }

  function partner(m, j) {
    const x = j % COLS, y = (j - x) / COLS;
    for (let k = 0; k < m.portals.length; ++k) {
      const p = m.portals[k];
      if (p[0] === x && p[1] === y) return idx(p[2], p[3]);
      if (p[2] === x && p[3] === y) return idx(p[0], p[1]);
    }
    return j;
  }

  /* Proves every dot reachable from the start AND the start reachable back from every tile Pac-Man
     can stand on, with pads and portals as one-way moves (no traps). */
  function validatePlay(m) {
    const n = COLS * ROWS;
    const fwd = new Uint8Array(n);
    const start = idx(13, 23);
    const stack = [start];
    fwd[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      for (let d = 0; d < 4; ++d) {
        const j = stepPlay(m, i, d);
        if (j >= 0 && !fwd[j]) { fwd[j] = 1; stack.push(j); }
      }
    }
    const errors = [];
    for (let i = 0; i < n; ++i) if (m.dots[i] && !fwd[i] && m.feat[i] !== C.F_PORTAL) errors.push('dot unreachable at ' + (i % COLS) + ',' + Math.floor(i / COLS));
    /* backward: every reached tile can get back to the start */
    const back = new Uint8Array(n);
    back[start] = 1;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; ++i) {
        if (back[i] || !fwd[i]) continue;
        for (let d = 0; d < 4; ++d) {
          const j = stepPlay(m, i, d);
          if (j >= 0 && back[j]) { back[i] = 1; changed = true; break; }
        }
      }
    }
    for (let i = 0; i < n; ++i) if (fwd[i] && !back[i]) errors.push('trap at ' + (i % COLS) + ',' + Math.floor(i / COLS));
    return { ok: errors.length === 0, errors: errors };
  }

  /* A deep copy safe to mutate during play */
  function clone(m) {
    return JSON.parse(JSON.stringify(m));
  }

  Object.assign(NS.mazes, {
    CLASSIC, XS, YS, idx, classic, generate, validate, validatePlay, stepPlay, partner, isOpen, clone, count, placeFeatures, inHouseZone
  });
})();
