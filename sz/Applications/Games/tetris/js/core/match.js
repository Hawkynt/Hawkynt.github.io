/* The colour-match engine behind Pairs and Jewels, pure and deterministic like the block engine
   and with the same calls (create, step, move, rotate, holdPiece, hardDrop, placeAt, active,
   addGarbage, stackHeight, rand, takeEvents), so sessions, Versus, the CPU rival and the input
   drive either one. A six-wide well, twelve rows tall under two hidden spawn rows.
   - Pairs: a pair of coloured blobs (four colours) turns around its lower blob with small kicks;
     after landing every blob falls on its own, and four or more blobs of one colour touching
     side by side burst.
   - Jewels: a column of three jewels (six colours) whose order cycles when turned; three or more
     of a colour in a row - across, down or diagonal - shatter.
   Both: what is left falls, and every new burst after a fall is the next link of a chain, worth
   far more than the last. Grey stones (garbage from a rival) only break when something bursts
   next to them. Bursts leave 'burst' events with the cells, their colours, the chain link and
   the points; gravity speeds up by level. Holding is not part of these rules. A small bot
   ranks every placement by simulating the landing and the whole chain. A new piece appears in
   the top visible rows, and a landed piece that slides or turns gets its lock time back up to
   fifteen times, as in the block rules. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const { makeRng } = NS.rng;

  const COLS = 6, ROWS = 14, HIDDEN = 2, STONE = 9;
  const RULES = {
    pairs: { colors: 4, size: 2, need: 4, lock: 0.4 },
    jewels: { colors: 6, size: 3, need: 3, lock: 0.4 },
  };
  const LOCK_RESETS = 15, CLEAR_TIME = 0.38, SPAWN_DELAY = 0.08, LEVEL_EVERY = 40, MAX_LEVEL = 15;

  function rand(g) {
    const r = makeRng(g.rng);
    const v = r.next();
    g.rng = r.s;
    return v;
  }

  function newPiece(g) {
    const R = RULES[g.rule], c = [];
    for (let i = 0; i < R.size; ++i) c.push(1 + Math.floor(rand(g) * R.colors));
    return c;
  }

  /* opts: rule ('pairs' | 'jewels'), seed, level, levelMode ('lines' | 'fixed'), preview */
  function create(opts) {
    opts = opts || {};
    const g = {
      match: true, rule: RULES[opts.rule] ? opts.rule : 'pairs', seed: opts.seed >>> 0 || 1, rng: opts.seed >>> 0 || 1,
      board: new Array(COLS * ROWS).fill(0), queue: [], piece: null, canHold: false, hold: null, holdUsed: false,
      level: opts.level || 1, startLevel: opts.level || 1, levelMode: opts.levelMode || 'lines', preview: Math.min(3, opts.preview || 2),
      gravityMul: 1, slowT: 0, scoreMul: 1, orbChance: 0,
      lines: 0, score: 0, combo: -1, time: 0, pieces: 0, fall: 0, lockT: 0, popping: null, chain: 0, spawnT: 0, over: false, reason: '',
      stats: { singles: 0, doubles: 0, triples: 0, quads: 0, tspins: 0, minis: 0, perfects: 0, maxCombo: 0, b2bs: 0, softRows: 0, hardRows: 0,
        orbs: 0, gems: 0, garbage: 0, holds: 0, zenClears: 0, bursts: 0, bestChain: 0, stones: 0 },
      events: [],
    };
    for (let i = 0; i < 3; ++i) g.queue.push(newPiece(g));
    spawn(g);
    return g;
  }

  const at = (b, x, y) => x < 0 || x >= COLS || y >= ROWS ? -1 : y < 0 ? 0 : b[y * COLS + x];

  /* the cells of a piece: [x, y, colour] */
  const OFF = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function cellsOf(rule, p) {
    if (rule === 'pairs') { const o = OFF[p.r & 3]; return [[p.x, p.y, p.c[0]], [p.x + o[0], p.y + o[1], p.c[1]]]; }
    const n = p.c.length, out = [];
    for (let i = 0; i < n; ++i) out.push([p.x, p.y - (n - 1) + i, p.c[(i - p.r % n + n * 3) % n]]);
    return out;
  }

  function fitsCells(b, cs) {
    for (const c of cs) if (at(b, c[0], c[1]) !== 0) return false;
    return true;
  }

  function fits(g, p) {
    return fitsCells(g.board, cellsOf(g.rule, p));
  }

  function spawn(g) {
    const c = g.queue.shift();
    g.queue.push(newPiece(g));
    /* in sight from the start: the whole piece sits in the top visible rows */
    const p = { c: c, x: 2, y: HIDDEN + RULES[g.rule].size - 1, r: 0 };
    g.piece = p;
    g.fall = 0;
    g.lockT = 0;
    g.lockResets = 0;
    g.chain = 0;
    if (!fits(g, p)) return topOut(g, 'block');
    g.events.push({ type: 'spawn' });
    return true;
  }

  function topOut(g, reason) {
    g.over = true;
    g.reason = reason;
    g.piece = null;
    g.events.push({ type: 'topout', reason: reason });
    return false;
  }

  function active(g) {
    return !!g.piece && !g.over && !g.popping && g.spawnT <= 0;
  }

  function grounded(g) {
    const p = g.piece;
    return !!p && !fits(g, { c: p.c, x: p.x, y: p.y + 1, r: p.r });
  }

  /* a landed piece that moves or turns gets its lock time back, up to LOCK_RESETS times */
  function onShift(g) {
    if (grounded(g) && (g.lockResets || 0) < LOCK_RESETS) { g.lockT = 0; g.lockResets = (g.lockResets || 0) + 1; }
  }

  function move(g, dx) {
    if (!active(g)) return false;
    const p = g.piece;
    const q = { c: p.c, x: p.x + dx, y: p.y, r: p.r };
    if (!fits(g, q)) return false;
    p.x = q.x;
    onShift(g);
    g.events.push({ type: 'move' });
    return true;
  }

  /* pairs: turn the second blob around the first (kicks off walls and the floor); jewels:
     cycle the colours. dir 1, -1 or 2 (two steps) */
  function rotate(g, dir) {
    if (!active(g)) return false;
    const p = g.piece;
    if (g.rule === 'jewels') {
      const n = p.c.length;
      p.r = (p.r + (dir === -1 ? n - 1 : dir === 2 ? 2 : 1)) % n;
      onShift(g);
      g.events.push({ type: 'rotate', kick: 0 });
      return true;
    }
    const to = (p.r + (dir === -1 ? 3 : dir === 2 ? 2 : 1)) & 3;
    const o = OFF[to];
    for (const k of [[0, 0], [-o[0], 0], [0, -o[1]], [-o[0], -1]]) {
      const q = { c: p.c, x: p.x + k[0], y: p.y + k[1], r: to };
      if (fits(g, q)) {
        p.x = q.x; p.y = q.y; p.r = to;
        onShift(g);
        g.events.push({ type: 'rotate', kick: k[0] || k[1] ? 1 : 0 });
        return true;
      }
    }
    return false;
  }

  function holdPiece() {
    return false;
  }

  function ghostY(g) {
    const p = g.piece;
    let y = p.y;
    while (fits(g, { c: p.c, x: p.x, y: y + 1, r: p.r })) ++y;
    return y;
  }

  function hardDrop(g) {
    if (!active(g)) return false;
    const y = ghostY(g);
    const d = y - g.piece.y;
    g.piece.y = y;
    g.score += d * 2 * g.scoreMul;
    g.stats.hardRows += d;
    g.events.push({ type: 'drop', rows: d });
    land(g);
    return true;
  }

  /* drops every cell of the board down its column; -> moved */
  function settle(b) {
    let moved = false;
    for (let x = 0; x < COLS; ++x) {
      let w = ROWS - 1;
      for (let y = ROWS - 1; y >= 0; --y) {
        const v = b[y * COLS + x];
        if (!v) continue;
        if (w !== y) { b[w * COLS + x] = v; b[y * COLS + x] = 0; moved = true; }
        --w;
      }
    }
    return moved;
  }

  /* the cells that burst on this board under a rule, stones next to them included */
  function findBursts(rule, b) {
    const hit = new Set();
    const need = RULES[rule].need;
    if (rule === 'pairs') {
      const seen = new Uint8Array(COLS * ROWS);
      for (let k = 0; k < COLS * ROWS; ++k) {
        const c = b[k];
        if (!c || c === STONE || seen[k] || (k / COLS | 0) < HIDDEN) continue;
        const group = [k], stack = [k];
        seen[k] = 1;
        while (stack.length) {
          const i = stack.pop(), x = i % COLS, y = (i / COLS) | 0;
          for (const d of OFF) {
            const nx = x + d[0], ny = y + d[1];
            if (nx < 0 || nx >= COLS || ny < HIDDEN || ny >= ROWS) continue;
            const j = ny * COLS + nx;
            if (!seen[j] && b[j] === c) { seen[j] = 1; group.push(j); stack.push(j); }
          }
        }
        if (group.length >= need) for (const i of group) hit.add(i);
      }
    } else {
      for (let y = HIDDEN; y < ROWS; ++y)
        for (let x = 0; x < COLS; ++x) {
          const c = b[y * COLS + x];
          if (!c || c === STONE) continue;
          for (const d of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
            let n = 1;
            while (at(b, x + d[0] * n, y + d[1] * n) === c && y + d[1] * n >= HIDDEN) ++n;
            if (n >= need) for (let k = 0; k < n; ++k) hit.add((y + d[1] * k) * COLS + x + d[0] * k);
          }
        }
    }
    for (const i of Array.from(hit)) {
      const x = i % COLS, y = (i / COLS) | 0;
      for (const d of OFF) if (at(b, x + d[0], y + d[1]) === STONE) hit.add((y + d[1]) * COLS + x + d[0]);
    }
    return Array.from(hit).sort((a, c) => a - c);
  }

  function chainPower(rule, link) {
    return rule === 'pairs' ? [1, 8, 16, 32, 64, 96, 128, 160, 192, 224][Math.min(9, link - 1)] : link * link;
  }

  function land(g) {
    const p = g.piece;
    const cs = cellsOf(g.rule, p);
    for (const c of cs) if (c[1] >= 0) g.board[c[1] * COLS + c[0]] = c[2];
    ++g.pieces;
    g.piece = null;
    g.events.push({ type: 'land', cells: cs });
    if (cs.every(c => c[1] < HIDDEN)) return topOut(g, 'lockout');
    settle(g.board);
    g.chain = 0;
    resolve(g);
    return true;
  }

  /* looks for bursts after a fall: starts the burst pause or hands over to the next piece */
  function resolve(g) {
    const hit = findBursts(g.rule, g.board);
    if (!hit.length) {
      g.combo = g.chain ? g.combo : -1;
      g.spawnT = SPAWN_DELAY;
      return;
    }
    ++g.chain;
    const cells = hit.map(i => [i % COLS, (i / COLS) | 0, g.board[i]]);
    const gems = cells.filter(c => c[2] !== STONE).length;
    const stones = cells.length - gems;
    const pts = Math.round(gems * 10 * chainPower(g.rule, g.chain) * g.level * g.scoreMul) || 0;
    g.score += pts;
    g.lines += gems;
    g.stats.bursts += 1;
    g.stats.stones += stones;
    g.stats.bestChain = Math.max(g.stats.bestChain, g.chain);
    g.stats.maxCombo = Math.max(g.stats.maxCombo, g.chain - 1);
    g.combo = g.chain - 1;
    g.popping = { cells: cells, t: CLEAR_TIME };
    g.events.push({ type: 'burst', source: 'piece', cells: cells, cleared: gems, stones: stones, chain: g.chain, points: pts });
    if (g.levelMode === 'lines') {
      const L = Math.min(MAX_LEVEL, g.startLevel + Math.floor(g.lines / LEVEL_EVERY));
      if (L > g.level) { g.level = L; g.events.push({ type: 'levelup', level: L }); }
    }
  }

  function gravity(g) {
    return (0.9 + (Math.min(g.level, MAX_LEVEL) - 1) * 0.45) * g.gravityMul * (g.slowT > 0 ? 0.25 : 1);
  }

  /* one fixed step; input: { soft } */
  function step(g, dt, input) {
    if (g.over) return;
    g.time += dt;
    if (g.slowT > 0) g.slowT = Math.max(0, g.slowT - dt);
    if (g.popping) {
      g.popping.t -= dt;
      if (g.popping.t <= 0) {
        for (const c of g.popping.cells) g.board[c[1] * COLS + c[0]] = 0;
        g.popping = null;
        settle(g.board);
        resolve(g);
      }
      return;
    }
    if (!g.piece) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) { g.spawnT = 0; spawn(g); }
      return;
    }
    const p = g.piece;
    const soft = input && input.soft;
    g.fall += (soft ? Math.max(gravity(g) * 12, 18) : gravity(g)) * dt;
    while (g.fall >= 1) {
      g.fall -= 1;
      if (fits(g, { c: p.c, x: p.x, y: p.y + 1, r: p.r })) {
        ++p.y;
        g.lockT = 0;
        if (soft) { g.score += g.scoreMul; ++g.stats.softRows; }
      } else { g.fall = 0; break; }
    }
    if (grounded(g)) {
      g.lockT += dt;
      if (g.lockT >= RULES[g.rule].lock) land(g);
    }
  }

  /* n grey stones fall on the columns one after another from a random one, so six make a
     row; -> false on top-out */
  function addGarbage(g, n) {
    if (n <= 0) return true;
    const start = Math.floor(rand(g) * COLS);
    for (let i = 0; i < n; ++i) {
      const col = (start + i) % COLS;
      let y = -1;
      while (y + 1 < ROWS && !g.board[(y + 1) * COLS + col]) ++y;
      if (y < 0) return topOut(g, 'garbage');
      g.board[y * COLS + col] = STONE;
    }
    const p = g.piece;
    if (p && !fits(g, p)) {
      while (p.y > -1 && !fits(g, p)) --p.y;
      if (!fits(g, p)) return topOut(g, 'garbage');
    }
    g.events.push({ type: 'garbage', rows: n });
    return true;
  }

  function columnTop(b, x) {
    for (let y = 0; y < ROWS; ++y) if (b[y * COLS + x]) return y;
    return ROWS;
  }

  /* the tallest column scaled to the twenty-row well, so warnings and music read the same */
  function stackHeight(g) {
    let top = ROWS;
    for (let x = 0; x < COLS; ++x) top = Math.min(top, columnTop(g.board, x));
    return Math.round((ROWS - top) * 20 / (ROWS - HIDDEN));
  }

  /* for the bot and tests: place at turn r and column x and drop */
  function placeAt(g, r, x) {
    if (!active(g)) return false;
    const p = g.piece;
    const q = { c: p.c, x: x, y: p.y, r: r };
    while (q.y > -1 && !fits(g, q)) --q.y;
    if (!fits(g, q)) return false;
    p.x = q.x; p.y = q.y; p.r = q.r;
    return hardDrop(g);
  }

  /* ---- bot: lands a placement on a copy and plays out the whole chain ---- */
  function simulate(g, r, x) {
    const p = g.piece;
    const q = { c: p.c, x: x, y: p.y, r: r };
    const b = g.board.slice();
    if (!fitsCells(b, cellsOf(g.rule, q))) return null;
    while (fitsCells(b, cellsOf(g.rule, { c: q.c, x: q.x, y: q.y + 1, r: q.r }))) ++q.y;
    for (const c of cellsOf(g.rule, q)) if (c[1] >= 0) b[c[1] * COLS + c[0]] = c[2];
    settle(b);
    let chain = 0, cleared = 0;
    for (;;) {
      const hit = findBursts(g.rule, b);
      if (!hit.length) break;
      ++chain;
      cleared += hit.length;
      for (const i of hit) b[i] = 0;
      settle(b);
    }
    return { board: b, chain: chain, cleared: cleared };
  }

  function evaluate(rule, s) {
    const b = s.board;
    let v = s.cleared * 4 + (s.chain > 1 ? s.chain * s.chain * 30 : 0);
    let maxH = 0, link = 0;
    for (let x = 0; x < COLS; ++x) {
      const h = ROWS - columnTop(b, x);
      maxH = Math.max(maxH, h);
      v -= h * h * (rule === 'jewels' ? 0.16 : 0.08);
    }
    for (let y = HIDDEN; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        const c = b[y * COLS + x];
        if (!c || c === STONE) continue;
        if (at(b, x + 1, y) === c) ++link;
        if (at(b, x, y + 1) === c) ++link;
        if (rule === 'jewels' && (at(b, x + 1, y + 1) === c || at(b, x - 1, y + 1) === c)) link += 0.5;
      }
    v += link * 1.6;
    if (columnTop(b, 2) < HIDDEN + RULES[rule].size + 1) v -= 400;
    if (maxH > ROWS - HIDDEN - 3) v -= (maxH - (ROWS - HIDDEN - 3)) * 40;
    return v;
  }

  function ranked(g) {
    if (!g.piece) return [];
    const out = [];
    const turns = g.rule === 'pairs' ? 4 : g.piece.c.length;
    for (let r = 0; r < turns; ++r)
      for (let x = 0; x < COLS; ++x) {
        const s = simulate(g, r, x);
        if (s) out.push({ r: r, x: x, value: evaluate(g.rule, s), chain: s.chain });
      }
    out.sort((a, b) => b.value - a.value);
    return out;
  }

  function choose(g) {
    const best = ranked(g)[0];
    return best ? { r: best.r, x: best.x, hold: false, value: best.value } : null;
  }

  function playPiece(g) {
    const c = choose(g);
    return c ? placeAt(g, c.r, c.x) : false;
  }

  function takeEvents(g) {
    const e = g.events;
    g.events = [];
    return e;
  }

  Object.assign(NS.match, {
    COLS, ROWS, HIDDEN, STONE, RULES, CLEAR_TIME, rand, create, cellsOf, fits, spawn, active, grounded, move, rotate, holdPiece, ghostY, hardDrop,
    settle, findBursts, chainPower, land, resolve, gravity, step, addGarbage, stackHeight, placeAt, simulate, evaluate, ranked, choose, playPiece, takeEvents,
  });
})();
