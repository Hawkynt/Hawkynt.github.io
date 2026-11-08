/* The playfield engine, pure and deterministic: a game is one plain object (board and tag
   arrays, the 7-bag and its seeded generator state, queue, piece, hold, lock-delay and gravity
   bookkeeping, score, combo, back-to-back, statistics), so it saves as JSON and replays the
   same from a seed. Movement and rotation with SRS wall kicks, 180-degree turns, hold, soft and
   hard drops, the guideline gravity curve, lock delay with 15 resets, T-spin and T-spin-mini
   detection (three-corner rule, the fifth kick upgrades a mini), line clears with a short pause,
   guideline scoring with back-to-back, combos and perfect clears, power orbs and gems carried
   by cells, garbage, crystals, mirroring and the cascade, sweep, laser and bomb used by powers.
   Blast rules: some pieces carry a bomb cell; when its row clears the bomb blows away every
   block within two cells, then the columns collapse and any rows that fill clear as well.
   Every step leaves events (lock, clear, levelup, spawn, topout, ...) for sound and effects. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const { COLS, ROWS, HIDDEN, SHAPES, TYPES, CODE, KICKS, KICKS_I, SCORE } = C;
  const { makeRng } = NS.rng;

  /* opts: seed, level, levelMode ('lines' | 'fixed'), gravity (rows/s override), gravityMul,
     lockDelay, preview, hold (false disables), orbChance, bombChance, zen, ghost */
  function create(opts) {
    opts = opts || {};
    const g = {
      seed: opts.seed >>> 0 || 1, rng: opts.seed >>> 0 || 1,
      board: new Array(COLS * ROWS).fill(0), tags: new Array(COLS * ROWS).fill(0),
      queue: [], piece: null, hold: null, holdUsed: false, canHold: opts.hold !== false,
      level: opts.level || 1, startLevel: opts.level || 1, levelMode: opts.levelMode || 'lines',
      gravity: opts.gravity || 0, gravityMul: opts.gravityMul || 1,
      lockDelay: opts.lockDelay || C.LOCK_DELAY, preview: opts.preview || 5,
      orbChance: opts.orbChance || 0, bombChance: opts.bombChance || 0, zen: !!opts.zen,
      lines: 0, score: 0, combo: -1, b2b: false, time: 0, pieces: 0,
      lock: { t: 0, resets: 0, low: 0 }, fall: 0, soft: 0, last: { rotate: false, kick: 0 },
      clearing: null, spawnT: 0, over: false, reason: '', scoreMul: 1, slowT: 0,
      stats: { singles: 0, doubles: 0, triples: 0, quads: 0, tspins: 0, minis: 0, perfects: 0, maxCombo: 0, b2bs: 0, softRows: 0, hardRows: 0,
        orbs: 0, gems: 0, garbage: 0, holds: 0, zenClears: 0, blasts: 0, blasted: 0 },
      events: [],
    };
    fillQueue(g);
    spawn(g);
    return g;
  }

  /* ---- randomizer: a shuffled bag of the seven, drawn from the saved generator state ---- */
  function fillQueue(g) {
    while (g.queue.length < 7) {
      const r = makeRng(g.rng);
      const bag = TYPES.slice();
      for (let i = bag.length - 1; i > 0; --i) {
        const j = Math.floor(r.next() * (i + 1));
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      g.rng = r.s;
      for (let i = 0; i < bag.length; ++i) g.queue.push(bag[i]);
    }
  }

  function rand(g) {
    const r = makeRng(g.rng);
    const v = r.next();
    g.rng = r.s;
    return v;
  }

  function shape(t, r) {
    return SHAPES[t][r & 3];
  }

  function cells(t, r, x, y) {
    const s = shape(t, r), out = [];
    for (let yy = 0; yy < s.length; ++yy)
      for (let xx = 0; xx < s.length; ++xx)
        if (s[yy][xx]) out.push([x + xx, y + yy]);
    return out;
  }

  function at(g, x, y) {
    return x < 0 || x >= COLS || y >= ROWS ? -1 : y < 0 ? 0 : g.board[y * COLS + x];
  }

  function fits(g, t, r, x, y) {
    const s = shape(t, r);
    for (let yy = 0; yy < s.length; ++yy)
      for (let xx = 0; xx < s.length; ++xx)
        if (s[yy][xx] && at(g, x + xx, y + yy) !== 0) return false;
    return true;
  }

  function spawnX(t) {
    return t === 'O' ? 4 : 3;
  }

  /* takes the next piece (or the given type, from hold) into play */
  function spawn(g, type) {
    fillQueue(g);
    const t = type || g.queue.shift();
    fillQueue(g);
    const p = { t: t, r: 0, x: spawnX(t), y: t === 'I' ? -1 : 0, orb: -1, bomb: -1 };
    if (!type && g.orbChance && rand(g) < g.orbChance) p.orb = Math.floor(rand(g) * 4);
    else if (!type && g.bombChance && rand(g) < g.bombChance) p.bomb = Math.floor(rand(g) * 4);
    /* drop one row straight away when there is room, as the guideline does */
    if (fits(g, p.t, p.r, p.x, p.y + 1)) ++p.y;
    g.piece = p;
    g.lock.t = 0;
    g.lock.resets = 0;
    g.lock.low = p.y;
    g.fall = 0;
    g.last.rotate = false;
    if (!fits(g, p.t, p.r, p.x, p.y)) {
      if (g.zen) {
        zenRelief(g);
        if (fits(g, p.t, p.r, p.x, p.y)) return true;
      }
      return topOut(g, 'block');
    }
    g.events.push({ type: 'spawn', t: t });
    return true;
  }

  function topOut(g, reason) {
    g.over = true;
    g.reason = reason;
    g.piece = null;
    g.events.push({ type: 'topout', reason: reason });
    return false;
  }

  /* Zen never ends: the lower half of the stack melts away instead */
  function zenRelief(g) {
    const n = 12;
    g.board.splice(ROWS * COLS - n * COLS, n * COLS);
    g.tags.splice(ROWS * COLS - n * COLS, n * COLS);
    for (let i = 0; i < n * COLS; ++i) { g.board.unshift(0); g.tags.unshift(0); }
    ++g.stats.zenClears;
    g.events.push({ type: 'zen' });
  }

  /* ---- gravity ---- */
  function gravity(g) {
    if (g.gravity) return g.gravity * g.gravityMul * (g.slowT > 0 ? 0.25 : 1);
    const L = Math.min(g.level, 20);
    const secPerRow = Math.pow(0.8 - (L - 1) * 0.007, L - 1);
    return Math.min(20 * 60, 1 / secPerRow) * g.gravityMul * (g.slowT > 0 ? 0.25 : 1);
  }

  function grounded(g) {
    const p = g.piece;
    return !!p && !fits(g, p.t, p.r, p.x, p.y + 1);
  }

  function onShift(g) {
    if (!grounded(g)) return;
    if (g.lock.resets < C.LOCK_RESETS) {
      g.lock.t = 0;
      ++g.lock.resets;
    }
  }

  function active(g) {
    return !!g.piece && !g.over && !g.clearing && g.spawnT <= 0;
  }

  function move(g, dx) {
    if (!active(g)) return false;
    const p = g.piece;
    if (!fits(g, p.t, p.r, p.x + dx, p.y)) return false;
    p.x += dx;
    g.last.rotate = false;
    onShift(g);
    g.events.push({ type: 'move' });
    return true;
  }

  /* dir 1 clockwise, -1 counter-clockwise, 2 half turn */
  function rotate(g, dir) {
    if (!active(g)) return false;
    const p = g.piece;
    if (p.t === 'O') return false;
    const to = (p.r + (dir === 2 ? 2 : dir === -1 ? 3 : 1)) & 3;
    const list = dir === 2 ? [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]] : (p.t === 'I' ? KICKS_I : KICKS)[p.r + '>' + to];
    for (let k = 0; k < list.length; ++k) {
      const nx = p.x + list[k][0], ny = p.y - list[k][1];
      if (fits(g, p.t, to, nx, ny)) {
        p.x = nx;
        p.y = ny;
        p.r = to;
        g.last.rotate = true;
        g.last.kick = k;
        onShift(g);
        if (p.y > g.lock.low) { g.lock.low = p.y; g.lock.resets = 0; }
        g.events.push({ type: 'rotate', kick: k });
        return true;
      }
    }
    return false;
  }

  function holdPiece(g) {
    if (!active(g) || !g.canHold || g.holdUsed) return false;
    const cur = g.piece.t;
    const had = g.hold;
    g.hold = cur;
    g.holdUsed = true;
    ++g.stats.holds;
    g.events.push({ type: 'hold', t: cur });
    if (had) spawn(g, had);
    else spawn(g);
    return true;
  }

  function ghostY(g) {
    const p = g.piece;
    if (!p) return 0;
    let y = p.y;
    while (fits(g, p.t, p.r, p.x, y + 1)) ++y;
    return y;
  }

  function hardDrop(g) {
    if (!active(g)) return false;
    const p = g.piece;
    const y = ghostY(g);
    const d = y - p.y;
    if (d > 0) g.last.rotate = false;
    p.y = y;
    g.score += d * SCORE.hard * g.scoreMul;
    g.stats.hardRows += d;
    g.events.push({ type: 'harddrop', rows: d, x: p.x, y: y, t: p.t, r: p.r });
    lock(g);
    return true;
  }

  /* ---- locking and clearing ---- */
  function tspinKind(g) {
    const p = g.piece;
    if (p.t !== 'T' || !g.last.rotate) return '';
    const occ = (x, y) => at(g, x, y) !== 0;
    const c = [occ(p.x, p.y), occ(p.x + 2, p.y), occ(p.x + 2, p.y + 2), occ(p.x, p.y + 2)];
    if (c[0] + c[1] + c[2] + c[3] < 3) return '';
    const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.r];
    if ((c[front[0]] && c[front[1]]) || g.last.kick === 4) return 'full';
    return 'mini';
  }

  function fullRows(g) {
    const out = [];
    for (let y = 0; y < ROWS; ++y) {
      let full = true;
      for (let x = 0; x < COLS; ++x) if (!g.board[y * COLS + x]) { full = false; break; }
      if (full) out.push(y);
    }
    return out;
  }

  function lock(g) {
    const p = g.piece;
    const kind = tspinKind(g);
    const cs = cells(p.t, p.r, p.x, p.y);
    let above = true;
    for (let i = 0; i < cs.length; ++i) {
      const [x, y] = cs[i];
      if (y < 0) continue;
      g.board[y * COLS + x] = CODE[p.t];
      if (i === p.orb) g.tags[y * COLS + x] = 1;
      else if (i === p.bomb) g.tags[y * COLS + x] = 3;
      if (y >= HIDDEN) above = false;
    }
    ++g.pieces;
    g.piece = null;
    g.holdUsed = false;
    g.events.push({ type: 'lock', t: p.t, cells: cs, tspin: kind });
    if (above && !g.zen) return topOut(g, 'lockout');
    const rows = fullRows(g);
    score(g, rows, kind, 'piece');
    if (rows.length) g.clearing = { rows: rows, t: C.CLEAR_TIME };
    else g.spawnT = C.SPAWN_DELAY;
    return true;
  }

  /* scores a lock (or a power clear) and records the clear event */
  function score(g, rows, kind, source) {
    const n = rows.length;
    let orbs = 0, gems = 0, garbage = 0, bombs = 0;
    for (let i = 0; i < n; ++i)
      for (let x = 0; x < COLS; ++x) {
        const k = rows[i] * COLS + x;
        if (g.tags[k] === 1) ++orbs;
        else if (g.tags[k] === 2) ++gems;
        else if (g.tags[k] === 3) ++bombs;
        if (g.board[k] >= 8) ++garbage;
      }
    if (source !== 'piece') {
      g.lines += n;
      g.events.push({ type: 'clear', lines: n, rows: rows.slice(), tspin: '', b2b: false, combo: 0, perfect: false, points: 0, orbs: orbs, gems: gems, garbage: garbage, source: source });
      g.stats.orbs += orbs;
      g.stats.gems += gems;
      g.stats.garbage += garbage;
      return;
    }
    if (!n && !kind) {
      g.combo = -1;
      return;
    }
    const L = g.level;
    let pts = kind === 'full' ? SCORE.tspin[n] : kind === 'mini' ? SCORE.mini[Math.min(2, n)] : SCORE.lines[n];
    const difficult = n === 4 || (!!kind && n > 0);
    let b2b = false;
    if (n > 0) {
      if (difficult && g.b2b) {
        pts *= SCORE.b2b;
        b2b = true;
        ++g.stats.b2bs;
      }
      g.b2b = difficult;
      ++g.combo;
    } else g.combo = -1;
    pts *= L;
    if (g.combo > 0) pts += SCORE.combo * g.combo * L;
    let filled = 0;
    if (n) for (let k = 0; k < COLS * ROWS; ++k) if (g.board[k] && rows.indexOf(Math.floor(k / COLS)) < 0) { ++filled; break; }
    const perfect = n > 0 && !filled;
    if (perfect) {
      pts += SCORE.perfect[n] * L * (b2b && n === 4 ? 1.6 : 1);
      ++g.stats.perfects;
    }
    pts = Math.round(pts * g.scoreMul);
    g.score += pts;
    g.lines += n;
    if (n === 1) ++g.stats.singles;
    else if (n === 2) ++g.stats.doubles;
    else if (n === 3) ++g.stats.triples;
    else if (n === 4) ++g.stats.quads;
    if (kind === 'full') ++g.stats.tspins;
    else if (kind === 'mini') ++g.stats.minis;
    g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
    g.stats.orbs += orbs;
    g.stats.gems += gems;
    g.stats.garbage += garbage;
    g.events.push({ type: 'clear', lines: n, rows: rows.slice(), tspin: kind, b2b: b2b, combo: Math.max(0, g.combo), perfect: perfect, points: pts,
      orbs: orbs, gems: gems, garbage: garbage, bombs: bombs, source: source });
    levelUp(g);
  }

  function levelUp(g) {
    if (g.levelMode !== 'lines') return;
    const L = Math.min(C.MAX_LEVEL, g.startLevel + Math.floor(g.lines / C.LINES_PER_LEVEL));
    if (L > g.level) {
      g.level = L;
      g.events.push({ type: 'levelup', level: L });
    }
  }

  function removeRows(g, rows) {
    const sorted = rows.slice().sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; ++i) {
      g.board.splice(sorted[i] * COLS, COLS);
      g.tags.splice(sorted[i] * COLS, COLS);
      for (let x = 0; x < COLS; ++x) { g.board.unshift(0); g.tags.unshift(0); }
    }
  }

  /* bombs in the clearing rows blow away the blocks around them; -> blocks destroyed */
  function blast(g, rows) {
    let total = 0;
    for (const y of rows)
      for (let x = 0; x < COLS; ++x) {
        if (g.tags[y * COLS + x] !== 3) continue;
        let n = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(ROWS - 1, y + 2); ++yy) {
          if (rows.indexOf(yy) >= 0) continue;
          for (let xx = Math.max(0, x - 2); xx <= Math.min(COLS - 1, x + 2); ++xx)
            if (g.board[yy * COLS + xx]) { g.board[yy * COLS + xx] = 0; g.tags[yy * COLS + xx] = 0; ++n; }
        }
        total += n;
        ++g.stats.blasts;
        g.stats.blasted += n;
        const pts = Math.round(n * 25 * g.level * g.scoreMul);
        g.score += pts;
        g.events.push({ type: 'blast', x: x, y: y, cells: n, points: pts });
      }
    return total;
  }

  /* one fixed step; input: { soft } */
  function step(g, dt, input) {
    if (g.over) return;
    g.time += dt;
    if (g.slowT > 0) g.slowT = Math.max(0, g.slowT - dt);
    if (g.clearing) {
      g.clearing.t -= dt;
      if (g.clearing.t <= 0) {
        const blasted = blast(g, g.clearing.rows);
        removeRows(g, g.clearing.rows);
        g.clearing = null;
        if (blasted) cascade(g);
        g.spawnT = C.SPAWN_DELAY;
      }
      return;
    }
    if (!g.piece) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        g.spawnT = 0;
        spawn(g);
      }
      return;
    }
    const p = g.piece;
    const soft = input && input.soft;
    let grav = gravity(g);
    if (soft) grav = Math.max(grav * C.SOFT_FACTOR, 40);
    g.fall += grav * dt;
    while (g.fall >= 1) {
      g.fall -= 1;
      if (fits(g, p.t, p.r, p.x, p.y + 1)) {
        ++p.y;
        g.last.rotate = false;
        if (soft) {
          g.score += SCORE.soft * g.scoreMul;
          ++g.stats.softRows;
        }
        if (p.y > g.lock.low) { g.lock.low = p.y; g.lock.resets = 0; g.lock.t = 0; }
      } else {
        g.fall = 0;
        break;
      }
    }
    if (grounded(g)) {
      g.lock.t += dt;
      if (g.lock.t >= g.lockDelay || g.lock.resets >= C.LOCK_RESETS && g.lock.t >= 0.05) lock(g);
    }
  }

  /* ---- outside forces: garbage, crystals, powers ---- */
  /* n rows from the bottom with one hole; gem: put a gem tag in each row */
  function addGarbage(g, n, hole, opts) {
    opts = opts || {};
    for (let i = 0; i < n * COLS; ++i)
      if (i < COLS * n && g.board[i]) return topOut(g, 'garbage');
    g.board.splice(0, n * COLS);
    g.tags.splice(0, n * COLS);
    for (let k = 0; k < n; ++k) {
      const h = hole == null ? Math.floor(rand(g) * COLS) : (typeof hole === 'number' ? hole : hole[k % hole.length]);
      for (let x = 0; x < COLS; ++x) {
        g.board.push(x === h ? 0 : CODE.garbage);
        g.tags.push(0);
      }
      if (opts.gem) {
        let gx = Math.floor(rand(g) * COLS);
        if (gx === h) gx = (gx + 1) % COLS;
        g.tags[g.tags.length - COLS + gx] = 2;
      }
    }
    const p = g.piece;
    if (p && !fits(g, p.t, p.r, p.x, p.y)) {
      let up = 0;
      while (up < n && !fits(g, p.t, p.r, p.x, p.y - up)) ++up;
      if (fits(g, p.t, p.r, p.x, p.y - up)) p.y -= up;
      else return topOut(g, 'garbage');
    }
    g.events.push({ type: 'garbage', rows: n });
    return true;
  }

  /* drops single crystal cells onto the given columns */
  function dropCrystals(g, cols) {
    for (let i = 0; i < cols.length; ++i) {
      const x = cols[i];
      let y = HIDDEN;
      while (y + 1 < ROWS && !g.board[(y + 1) * COLS + x]) ++y;
      if (g.board[y * COLS + x]) continue;
      if (g.piece && cells(g.piece.t, g.piece.r, g.piece.x, g.piece.y).some(c => c[0] === x && c[1] === y)) continue;
      g.board[y * COLS + x] = CODE.crystal;
    }
    g.events.push({ type: 'crystals', cols: cols.slice() });
    const rows = fullRows(g);
    if (rows.length && !g.clearing) {
      score(g, rows, '', 'force');
      removeRows(g, rows);
    }
  }

  function mirror(g) {
    for (let y = 0; y < ROWS; ++y) {
      const a = g.board.slice(y * COLS, y * COLS + COLS).reverse();
      const b = g.tags.slice(y * COLS, y * COLS + COLS).reverse();
      for (let x = 0; x < COLS; ++x) { g.board[y * COLS + x] = a[x]; g.tags[y * COLS + x] = b[x]; }
    }
    const p = g.piece;
    if (p && !fits(g, p.t, p.r, p.x, p.y)) {
      for (let up = 1; up < 6; ++up) if (fits(g, p.t, p.r, p.x, p.y - up)) { p.y -= up; break; }
      if (!fits(g, p.t, p.r, p.x, p.y)) return topOut(g, 'mirror');
    }
    g.events.push({ type: 'mirror' });
    return true;
  }

  /* power clears happen at once, without the line-clear pause */
  function powerClear(g, source) {
    const rows = fullRows(g);
    if (rows.length) {
      score(g, rows, '', source);
      removeRows(g, rows);
      levelUp(g);
    }
    return rows.length;
  }

  function columnTop(g, x) {
    for (let y = 0; y < ROWS; ++y) if (g.board[y * COLS + x]) return y;
    return ROWS;
  }

  function stackHeight(g) {
    let top = ROWS;
    for (let x = 0; x < COLS; ++x) top = Math.min(top, columnTop(g, x));
    return ROWS - top;
  }

  /* every column settles down, filling its holes */
  function cascade(g) {
    for (let x = 0; x < COLS; ++x) {
      const col = [], tg = [];
      for (let y = ROWS - 1; y >= 0; --y) if (g.board[y * COLS + x]) { col.push(g.board[y * COLS + x]); tg.push(g.tags[y * COLS + x]); }
      for (let y = ROWS - 1, k = 0; y >= 0; --y, ++k) {
        g.board[y * COLS + x] = k < col.length ? col[k] : 0;
        g.tags[y * COLS + x] = k < col.length ? tg[k] : 0;
      }
    }
    g.events.push({ type: 'cascade' });
    return powerClear(g, 'cascade');
  }

  function sweep(g, n) {
    const rows = [];
    for (let i = 0; i < n; ++i) rows.push(ROWS - 1 - i);
    let any = false;
    for (let k = (ROWS - n) * COLS; k < ROWS * COLS; ++k) if (g.board[k]) { any = true; break; }
    if (!any) return 0;
    score(g, rows, '', 'sweep');
    removeRows(g, rows);
    levelUp(g);
    return n;
  }

  /* clears the tallest column; -> the column */
  function laser(g) {
    let best = 0, top = ROWS;
    for (let x = 0; x < COLS; ++x) { const t = columnTop(g, x); if (t < top) { top = t; best = x; } }
    let n = 0;
    for (let y = 0; y < ROWS; ++y) if (g.board[y * COLS + best]) { g.board[y * COLS + best] = 0; g.tags[y * COLS + best] = 0; ++n; }
    g.events.push({ type: 'laser', x: best, cells: n });
    return best;
  }

  /* blasts a 4 x 4 area at the top of the tallest stack; -> its centre */
  function bomb(g) {
    let best = 0, top = ROWS;
    for (let x = 0; x < COLS; ++x) { const t = columnTop(g, x); if (t < top) { top = t; best = x; } }
    const x0 = Math.max(0, Math.min(COLS - 4, best - 1)), y0 = Math.min(ROWS - 4, top);
    for (let y = y0; y < y0 + 4; ++y)
      for (let x = x0; x < x0 + 4; ++x) { g.board[y * COLS + x] = 0; g.tags[y * COLS + x] = 0; }
    g.events.push({ type: 'bomb', x: x0 + 2, y: y0 + 2 });
    return { x: x0 + 2, y: y0 + 2 };
  }

  function count(g, pred) {
    let n = 0;
    for (let k = 0; k < COLS * ROWS; ++k) if (pred(g.board[k], g.tags[k])) ++n;
    return n;
  }

  function garbageLeft(g) {
    return count(g, b => b === CODE.garbage);
  }

  function gemsLeft(g) {
    return count(g, (b, t) => t === 2);
  }

  /* for the bot and tests: put the current piece at rotation r, column x and drop it */
  function placeAt(g, r, x) {
    if (!active(g)) return false;
    const p = g.piece;
    if (!fits(g, p.t, r, x, p.y)) {
      let y = p.y;
      while (y > -2 && !fits(g, p.t, r, x, y)) --y;
      if (!fits(g, p.t, r, x, y)) return false;
      p.y = y;
    }
    p.r = r;
    p.x = x;
    return hardDrop(g);
  }

  function takeEvents(g) {
    const e = g.events;
    g.events = [];
    return e;
  }

  Object.assign(NS.engine, {
    create, fillQueue, shape, cells, at, fits, spawn, gravity, grounded, active, move, rotate, holdPiece, ghostY, hardDrop,
    tspinKind, fullRows, lock, score, removeRows, blast, step, addGarbage, dropCrystals, mirror, powerClear, columnTop, stackHeight,
    cascade, sweep, laser, bomb, garbageLeft, gemsLeft, placeAt, takeEvents, rand,
  });
})();
