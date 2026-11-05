/* Level building: parses the hand-designed ASCII maps, generates seeded layouts (classic pillars,
   rooms, plazas, rings) with each world's twist (crates, ice, belts, teleporters), hides the exit,
   power-ups, gems and seasonal tokens under bricks, places enemies, and validates every level
   (connectivity, a safe opening bomb, a hidden exit, enemies away from the spawn) - regenerating
   with the next seed until it passes. Also defines the stage lists of every mode. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const { COLS, ROWS, T_EMPTY, T_HARD, T_SOFT, T_CRATE, T_ICE, T_BELT_U, T_BELT_D, T_BELT_L, T_BELT_R, T_TELE } = C;
  const { MAPS, WORLDS, LEVELS_PER_WORLD } = NS.story;
  const { POWERUPS, BOSS_ORDER, BOSSES } = NS.content;
  const R = NS.rng;

  const N = COLS * ROWS;
  const CHAR_TILE = { '#': T_HARD, '+': T_SOFT, 'x': T_CRATE, '.': T_EMPTY, '~': T_ICE, '^': T_BELT_U, 'v': T_BELT_D, '<': T_BELT_L, '>': T_BELT_R, 'T': T_TELE,
    'P': T_EMPTY, 'E': T_SOFT, '*': T_SOFT, 'e': T_EMPTY, 'B': T_EMPTY };

  function idx(c, r) {
    return r * COLS + c;
  }

  function isBlock(t) {
    return t === T_HARD || t === T_SOFT || t === T_CRATE;
  }

  function isBreakable(t) {
    return t === T_SOFT || t === T_CRATE;
  }

  function isFloor(t) {
    return !isBlock(t);
  }

  /* ── power-up table with the luck, curse and heart perks applied ── */
  function rollPowerup(rng, opts) {
    opts = opts || {};
    let total = 0;
    const w = [];
    for (let i = 0; i < POWERUPS.length; ++i) {
      const p = POWERUPS[i];
      let x = p.weight;
      if (p.rare && opts.luck) x *= 2;
      if (p.id === 'skull') x *= opts.skulls ? 4 : opts.luck ? 0.5 : 1;
      if (p.id === 'heart') x *= opts.heartRate || 1;
      if (opts.early && (p.rare || p.id === 'skull' || p.id === 'remote')) x = 0;
      w.push(x);
      total += x;
    }
    let roll = rng() * total;
    for (let i = 0; i < POWERUPS.length; ++i) {
      roll -= w[i];
      if (roll <= 0 && w[i] > 0) return POWERUPS[i].id;
    }
    return 'bomb';
  }

  /* ── hand-designed maps ── */
  function parseMap(rows, spec, rng) {
    const grid = new Array(N).fill(T_HARD);
    const hidden = {};
    const enemies = [];
    let spawn = idx(1, 1), boss = null, exit = -1;
    const mix = spec.mix || ['puff'];
    for (let r = 0; r < ROWS; ++r) {
      const line = rows[r] || '';
      for (let c = 0; c < COLS; ++c) {
        const ch = line[c] || '#';
        const i = idx(c, r);
        grid[i] = CHAR_TILE[ch] !== undefined ? CHAR_TILE[ch] : T_HARD;
        if (ch === 'P') spawn = i;
        else if (ch === 'E') { hidden[i] = 'exit'; exit = i; }
        else if (ch === '*') hidden[i] = rollPowerup(rng, spec);
        else if (ch === 'e') enemies.push({ type: mix[enemies.length % mix.length], i: i });
        else if (ch === 'B') boss = i;
      }
    }
    return { grid: grid, hidden: hidden, enemies: enemies, spawn: spawn, exit: exit, bossAt: boss };
  }

  /* ── generated layouts ── */
  function baseLayout(pattern, rng) {
    const g = new Array(N).fill(T_EMPTY);
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c) {
        const i = idx(c, r);
        if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) g[i] = T_HARD;
        else if (r % 2 === 0 && c % 2 === 0) g[i] = T_HARD;
      }
    if (pattern === 'rooms') {
      /* walls joining pillars into rooms; validation keeps doors open */
      for (let k = 0; k < 7; ++k) {
        const vertical = rng() < 0.5;
        const c = 2 * rng.int(1, (COLS - 3) / 2), r = 2 * rng.int(1, (ROWS - 3) / 2);
        const c2 = vertical ? c : c + 2, r2 = vertical ? r + 2 : r;
        if (c2 >= COLS - 1 || r2 >= ROWS - 1) continue;
        g[idx((c + c2) / 2, (r + r2) / 2)] = T_HARD;
      }
    } else if (pattern === 'plaza') {
      /* an open plaza in the middle */
      for (let r = 4; r <= ROWS - 5; ++r)
        for (let c = 6; c <= COLS - 7; ++c) g[idx(c, r)] = T_EMPTY;
    } else if (pattern === 'ring') {
      for (let c = 4; c <= COLS - 5; ++c) { g[idx(c, 3)] = T_HARD; g[idx(c, ROWS - 4)] = T_HARD; }
      for (let r = 3; r <= ROWS - 4; ++r) { g[idx(4, r)] = T_HARD; g[idx(COLS - 5, r)] = T_HARD; }
      /* gates through the ring */
      g[idx(9, 3)] = T_EMPTY; g[idx(9, ROWS - 4)] = T_EMPTY; g[idx(4, 6)] = T_EMPTY; g[idx(COLS - 5, 6)] = T_EMPTY;
      g[idx(7, 3)] = T_EMPTY; g[idx(11, ROWS - 4)] = T_EMPTY;
      for (let r = 4; r <= ROWS - 5; ++r)
        for (let c = 5; c <= COLS - 6; ++c) if (!(r % 2 === 0 && c % 2 === 0)) g[idx(c, r)] = T_EMPTY;
    } else if (pattern === 'cross') {
      for (let c = 1; c < COLS - 1; ++c) g[idx(c, 6)] = T_EMPTY;
      for (let r = 1; r < ROWS - 1; ++r) g[idx(9, r)] = T_EMPTY;
    }
    return g;
  }

  function inSpawnZone(c, r, sc, sr) {
    return (Math.abs(c - sc) + Math.abs(r - sr)) <= 1 || (c === sc + 2 && r === sr) || (c === sc && r === sr + 2);
  }

  function applyTwist(g, twist, amount, rng, sc, sr) {
    if (twist === 'ice') {
      for (let k = 0; k < 2 + amount; ++k) {
        const c0 = rng.int(2, COLS - 6), r0 = rng.int(2, ROWS - 5);
        const w = rng.int(3, 6), h = rng.int(2, 4);
        for (let r = r0; r < Math.min(ROWS - 1, r0 + h); ++r)
          for (let c = c0; c < Math.min(COLS - 1, c0 + w); ++c)
            if (g[idx(c, r)] === T_EMPTY && !inSpawnZone(c, r, sc, sr)) g[idx(c, r)] = T_ICE;
      }
    } else if (twist === 'belt') {
      for (let k = 0; k < 1 + amount; ++k) {
        if (rng() < 0.55) {
          const r = 2 * rng.int(1, (ROWS - 3) / 2) + 1;
          const c0 = rng.int(1, 6), len = rng.int(5, 9);
          const t = rng() < 0.5 ? T_BELT_L : T_BELT_R;
          for (let c = c0; c < Math.min(COLS - 1, c0 + len); ++c)
            if (g[idx(c, r)] === T_EMPTY && !inSpawnZone(c, r, sc, sr)) g[idx(c, r)] = t;
        } else {
          const c = 2 * rng.int(1, (COLS - 3) / 2) + 1;
          const r0 = rng.int(1, 4), len = rng.int(4, 7);
          const t = rng() < 0.5 ? T_BELT_U : T_BELT_D;
          for (let r = r0; r < Math.min(ROWS - 1, r0 + len); ++r)
            if (g[idx(c, r)] === T_EMPTY && !inSpawnZone(c, r, sc, sr)) g[idx(c, r)] = t;
        }
      }
    } else if (twist === 'tele') {
      const pairs = 1 + Math.min(2, amount);
      const spots = [];
      for (let r = 1; r < ROWS - 1; ++r)
        for (let c = 1; c < COLS - 1; ++c)
          if (g[idx(c, r)] === T_EMPTY && !inSpawnZone(c, r, sc, sr) && (c + r) % 2 === 1) spots.push(idx(c, r));
      rng.shuffle(spots);
      let placed = 0;
      for (let i = 0; i < spots.length && placed < pairs * 2; ++i) {
        const s = spots[i];
        let ok = true;
        for (let r = -1; r <= 1; ++r) for (let c = -1; c <= 1; ++c) if (g[s + r * COLS + c] === T_TELE) ok = false;
        if (!ok) continue;
        g[s] = T_TELE;
        ++placed;
      }
    }
  }

  function bfs(grid, start, passable) {
    const dist = new Array(N).fill(-1);
    const q = [start];
    dist[start] = 0;
    for (let h = 0; h < q.length; ++h) {
      const i = q[h];
      const c = i % COLS, r = (i / COLS) | 0;
      const nb = [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, r > 0 ? i - COLS : -1, r < ROWS - 1 ? i + COLS : -1];
      for (let k = 0; k < 4; ++k) {
        const j = nb[k];
        if (j < 0 || dist[j] >= 0 || !passable(grid[j], j)) continue;
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
    return dist;
  }

  /* Cells a bomb at i with this range would burn (blocks stop the blast, a brick burns but stops it) */
  function blastCells(grid, i, range) {
    const out = [i];
    const c0 = i % COLS, r0 = (i / COLS) | 0;
    for (let d = 0; d < 4; ++d) {
      const dx = C.DIRS[d][0], dy = C.DIRS[d][1];
      for (let k = 1; k <= range; ++k) {
        const c = c0 + dx * k, r = r0 + dy * k;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) break;
        const t = grid[idx(c, r)];
        if (t === T_HARD) break;
        out.push(idx(c, r));
        if (isBreakable(t)) break;
      }
    }
    return out;
  }

  /* All checks a playable level must pass; returns a list of problems (empty = valid) */
  function validate(level, opts) {
    opts = opts || {};
    const problems = [];
    const g = level.grid;
    if (!Array.isArray(g) || g.length !== N) return ['grid size'];
    for (let c = 0; c < COLS; ++c) if (g[idx(c, 0)] !== T_HARD || g[idx(c, ROWS - 1)] !== T_HARD) problems.push('open border');
    for (let r = 0; r < ROWS; ++r) if (g[idx(0, r)] !== T_HARD || g[idx(COLS - 1, r)] !== T_HARD) problems.push('open border');
    if (!isFloor(g[level.spawn])) problems.push('spawn blocked');
    /* every non-stone cell reachable once bricks are blasted: no sealed pockets */
    const all = bfs(g, level.spawn, t => t !== T_HARD);
    for (let i = 0; i < N; ++i)
      if (g[i] !== T_HARD && all[i] < 0) { problems.push('sealed cell ' + i); break; }
    /* a safe first bomb: some cell next to a brick, with a hiding spot off its blast */
    const open = bfs(g, level.spawn, t => isFloor(t));
    const range = opts.range || 3;
    let safe = level.kind === 'boss' || level.kind === 'zen';
    for (let b = 0; b < N && !safe; ++b) {
      if (open[b] < 0) continue;
      const burn = blastCells(g, b, range);
      let useful = false;
      for (let k = 1; k < burn.length; ++k) if (isBreakable(g[burn[k]])) useful = true;
      if (!useful) continue;
      const hit = {};
      for (let k = 0; k < burn.length; ++k) hit[burn[k]] = 1;
      const reach = bfs(g, b, t => isFloor(t));
      for (let s = 0; s < N; ++s) if (reach[s] > 0 && reach[s] <= 6 && !hit[s]) { safe = true; break; }
    }
    if (!safe) problems.push('no safe opening bomb');
    if (level.kind === 'stage') {
      if (level.exit < 0 || !isBreakable(g[level.exit]) || level.hidden[level.exit] !== 'exit') problems.push('exit not hidden under a brick');
      if (!level.enemies.length) problems.push('no enemies');
    }
    for (let k = 0; k < level.enemies.length; ++k) {
      const e = level.enemies[k];
      if (!isFloor(g[e.i]) || g[e.i] === T_TELE) problems.push('enemy on a block');
      if (open[e.i] >= 0 && open[e.i] < 4) problems.push('enemy next to spawn');
    }
    let teles = 0;
    for (let i = 0; i < N; ++i) if (g[i] === T_TELE) ++teles;
    if (teles === 1) problems.push('lonely teleporter');
    return problems;
  }

  /* spec: seed, world, pattern, density, enemies (count), mix, twist, amount, dark, powerups, gems, tokens, kind */
  function generate(spec) {
    for (let attempt = 0; attempt < 60; ++attempt) {
      const rng = R.makeRng(spec.seed + attempt * 7919);
      const sc = 1, sr = 1;
      const g = baseLayout(attempt > 40 ? 'classic' : spec.pattern || 'classic', rng);
      if (spec.twist && spec.twist !== 'crate') applyTwist(g, spec.twist, spec.amount || 1, rng, sc, sr);
      const density = spec.density;
      for (let r = 1; r < ROWS - 1; ++r)
        for (let c = 1; c < COLS - 1; ++c) {
          const i = idx(c, r);
          if (g[i] !== T_EMPTY || inSpawnZone(c, r, sc, sr)) continue;
          if (rng() < density) g[i] = spec.twist === 'crate' && rng() < 0.12 * (spec.amount || 1) ? T_CRATE : T_SOFT;
        }
      const spawn = idx(sc, sr);
      const dist = bfs(g, spawn, t => t !== T_HARD);
      const bricks = [];
      for (let i = 0; i < N; ++i) if (isBreakable(g[i])) bricks.push(i);
      if (bricks.length < 8 && spec.kind !== 'zen') continue;
      const hidden = {};
      let exit = -1;
      if (spec.kind !== 'zen') {
        const far = bricks.slice().sort((a, b) => dist[b] - dist[a]).slice(0, Math.max(3, Math.floor(bricks.length * 0.3)));
        exit = rng.pick(far);
        hidden[exit] = 'exit';
      }
      const free = rng.shuffle(bricks.filter(i => i !== exit));
      let k = 0;
      const pu = Math.round((spec.powerups || 3) * (spec.drop || 1));
      for (let n = 0; n < pu && k < free.length; ++n) hidden[free[k++]] = rollPowerup(rng, spec);
      for (let n = 0; n < (spec.gems || 0) && k < free.length; ++n) hidden[free[k++]] = 'gem';
      for (let n = 0; n < (spec.tokens || 0) && k < free.length; ++n) hidden[free[k++]] = 'token';
      /* enemies: on floor, away from the spawn, spread out */
      const open = bfs(g, spawn, t => isFloor(t));
      const spots = [];
      for (let i = 0; i < N; ++i) {
        const c = i % COLS, r = (i / COLS) | 0;
        if (isFloor(g[i]) && g[i] !== T_TELE && Math.abs(c - sc) + Math.abs(r - sr) >= 7 && !(open[i] >= 0 && open[i] < 4)) spots.push(i);
      }
      rng.shuffle(spots);
      const enemies = [];
      const mix = spec.mix || ['puff'];
      for (let s = 0; s < spots.length && enemies.length < spec.enemies; ++s) {
        const i = spots[s];
        if (enemies.some(e => Math.abs(e.i % COLS - i % COLS) + Math.abs(((e.i / COLS) | 0) - ((i / COLS) | 0)) < 3)) continue;
        enemies.push({ type: mix[enemies.length % mix.length], i: i });
      }
      const level = { grid: g, hidden: hidden, enemies: enemies, spawn: spawn, exit: exit, bossAt: null, kind: spec.kind || 'stage' };
      if (!validate(level).length) return finish(level, spec, attempt);
    }
    /* never reached in practice (tests prove it); a bare classic arena keeps the game going */
    const rng = R.makeRng(spec.seed);
    const g = baseLayout('classic', rng);
    const exit = idx(COLS - 3, ROWS - 2);
    g[exit] = T_SOFT;
    return finish({ grid: g, hidden: { [exit]: 'exit' }, enemies: [{ type: 'puff', i: idx(COLS - 2, ROWS - 2) }], spawn: idx(1, 1), exit: exit, bossAt: null, kind: spec.kind || 'stage' }, spec, -1);
  }

  function finish(level, spec, attempt) {
    level.world = spec.world || 0;
    level.name = spec.name || '';
    level.dark = !!spec.dark;
    level.seed = spec.seed;
    level.attempt = attempt;
    level.time = spec.time === undefined ? C.LEVEL_TIME : spec.time;
    level.par = spec.par || Math.round(40 + level.enemies.length * 9);
    level.boss = spec.boss || null;
    return level;
  }

  function fromMap(name, spec) {
    const rng = R.makeRng(spec.seed || R.hashString(name));
    const p = parseMap(MAPS[name], spec, rng);
    p.kind = spec.kind || 'stage';
    if (spec.tokens) {
      let t = spec.tokens;
      for (let i = 0; i < N && t > 0; ++i) if (isBreakable(p.grid[i]) && !p.hidden[i] && rng() < 0.08) { p.hidden[i] = 'token'; --t; }
    }
    if (spec.gems) {
      let t = spec.gems;
      for (let i = 0; i < N && t > 0; ++i) if (isBreakable(p.grid[i]) && !p.hidden[i] && rng() < 0.12) { p.hidden[i] = 'gem'; --t; }
    }
    return finish(p, spec, 0);
  }

  /* ── the stages of every mode ── */
  const PATTERNS = ['classic', 'rooms', 'plaza', 'ring', 'cross', 'rooms'];

  function storyLevel(w, l, opts) {
    opts = opts || {};
    const W = WORLDS[w];
    const name = W.name + ' ' + (l === LEVELS_PER_WORLD - 1 ? '- Boss' : (w + 1) + '-' + (l + 1));
    const common = { world: w, name: name, dark: W.dark, tokens: opts.tokens || 0, luck: opts.luck, heartRate: opts.heartRate, drop: opts.drop, early: w === 0 && l < 3 };
    if (l === LEVELS_PER_WORLD - 1)
      return fromMap(W.bossMap, Object.assign(common, { kind: 'boss', boss: W.boss, mix: [BOSSES[W.boss].minion], time: 300, par: 75 + w * 10, gems: 0, tokens: 0 }));
    if (l === 0)
      return fromMap(W.firstMap, Object.assign(common, { kind: 'stage', mix: W.mix[0], seed: R.hashString('story:' + w + ':0'), gems: 4 }));
    return generate(Object.assign(common, {
      kind: 'stage', seed: R.hashString('story:' + w + ':' + l), pattern: PATTERNS[l], density: Math.min(0.64, 0.44 + l * 0.035 + w * 0.01),
      enemies: Math.min(10, 3 + Math.ceil(l * 0.8) + w), mix: W.mix[l], twist: W.twist, amount: 1 + Math.floor(l / 2), powerups: 4 + (l % 2), gems: 6
    }));
  }

  const ARCADE_UNLOCKS = ['puff', 'zapper', 'hopper', 'blob', 'charger', 'wisp', 'brute', 'imp', 'hunter'];
  const TWISTS = ['crate', 'ice', 'belt', 'tele', 'crate'];

  function arcadeLevel(n, seed, opts) {
    opts = opts || {};
    const theme = Math.floor((n - 1) / 3) % WORLDS.length;
    if (n % 5 === 0) {
      const b = BOSS_ORDER[(n / 5 - 1) % BOSS_ORDER.length];
      const wi = WORLDS.findIndex(x => x.boss === b);
      return fromMap(WORLDS[wi].bossMap, { kind: 'boss', boss: b, world: wi, name: 'Arena ' + n + ' - ' + BOSSES[b].name, mix: [BOSSES[b].minion], time: 240, par: 80, dark: !!opts.dark });
    }
    const pool = ARCADE_UNLOCKS.slice(0, Math.min(ARCADE_UNLOCKS.length, 1 + n));
    const rng = R.makeRng(seed + n * 131);
    const mix = opts.haunted ? ['wisp', 'wisp', rng.pick(pool)] : [rng.pick(pool), rng.pick(pool), rng.pick(pool), pool[pool.length - 1]];
    const crowd = opts.crowded ? 1.5 : 1;
    return generate({
      kind: 'stage', seed: seed + n * 977, world: theme, name: (opts.label || 'Arena') + ' ' + n, pattern: rng.pick(PATTERNS),
      density: opts.brittle ? 0.25 : Math.min(0.62, 0.42 + n * 0.012), enemies: Math.min(13, Math.round((3 + Math.floor(n * 0.7)) * crowd)), mix: mix,
      twist: opts.ice ? 'ice' : TWISTS[theme], amount: 1 + Math.min(2, Math.floor(n / 6)), dark: !!opts.dark || (theme === 4 && n > 10),
      powerups: 5, gems: 5, tokens: opts.tokens || 0, time: 180, luck: opts.luck, skulls: opts.skulls, heartRate: opts.heartRate, drop: opts.drop
    });
  }

  function zenLevel(n, seed, opts) {
    opts = opts || {};
    const theme = (n - 1) % WORLDS.length;
    return generate({
      kind: 'zen', seed: seed + n * 4231, world: theme, name: 'Zen Garden ' + n, pattern: ['plaza', 'classic', 'ring', 'cross'][n % 4],
      density: 0.72, enemies: 3, mix: ['puff'], twist: theme === 1 ? 'ice' : theme === 3 ? 'tele' : '', amount: 1, dark: false,
      powerups: 7, gems: 16, tokens: opts.tokens || 0, time: 0
    });
  }

  function rushLevel(i) {
    const b = BOSS_ORDER[i];
    const wi = WORLDS.findIndex(x => x.boss === b);
    return fromMap(WORLDS[wi].bossMap, { kind: 'boss', boss: b, world: wi, name: 'Boss Rush ' + (i + 1) + '/5 - ' + BOSSES[b].name, mix: [BOSSES[b].minion], time: 0, par: 60, dark: WORLDS[wi].dark });
  }

  function dailyLevel(i, daily, opts) {
    const m = daily.mods;
    const has = id => m.indexOf(id) >= 0;
    return arcadeLevel(i * 2 + 2 + (i === 2 ? 1 : 0), daily.seed, Object.assign({}, opts, {
      label: 'Daily', haunted: has('haunted'), crowded: has('crowded'), skulls: has('skulls'), ice: has('ice'), dark: has('dark'), brittle: has('brittle')
    }));
  }

  Object.assign(NS.levelgen, {
    idx, isBlock, isBreakable, isFloor, rollPowerup, parseMap, generate, validate, blastCells, bfs, fromMap,
    storyLevel, arcadeLevel, zenLevel, rushLevel, dailyLevel, PATTERNS
  });
})();
