/* The cave generator: builds a cave record from level parameters and a seed - steel border,
   dirt, open caverns, brick and steel structures, scattered boulders, gems and ice, powder
   barrels, lava pools, a magic wall over a boulder shelf, a sealed spore-moss chamber, creature
   pockets, power-ups and seasonal tokens, the start and the exit - then lets loose objects
   settle and hands the cave to the solver, which repairs it until enough gems and the exit are
   reachable without setting any boulder in motion. Boss arenas get their own layout. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const R = NS.rng;

  function newCave(w, h, seed) {
    const n = w * h;
    return {
      w, h,
      cells: new Uint8Array(n), aux: new Uint8Array(n), dir: new Uint8Array(n), fall: new Uint8Array(n),
      item: new Uint8Array(n), bg: new Uint8Array(n), mvx: new Int8Array(n), mvy: new Int8Array(n), stamp: new Uint32Array(n),
      rng: R.make(seed), seed: seed >>> 0, tick: 0, clock: 0, worldPeriod: C.WORLD_PERIOD, playerPeriod: C.PLAYER_PERIOD,
      startR: 1, startC: 1, exitR: h - 2, exitC: w - 2,
      required: 0, gems: 0, gemsTotal: 0, exitOpen: false, won: false,
      magic: { state: 0, t: 0, dur: 120 },
      amoeba: { count: 0, ticks: 0, fastAfter: 160, limit: 90 },
      boss: null, bossDefeated: false,
      bombs: [], chain: [], chainCount: 0,
      timeAdd: 0, zen: false, frozen: false,
      player: null, events: []
    };
  }

  function idx(cv, r, c) {
    return r * cv.w + c;
  }

  function inside(cv, r, c) {
    return r > 0 && c > 0 && r < cv.h - 1 && c < cv.w - 1;
  }

  function set(cv, r, c, t) {
    if (inside(cv, r, c)) cv.cells[idx(cv, r, c)] = t;
  }

  function get(cv, r, c) {
    return cv.cells[idx(cv, r, c)];
  }

  function newPlayer(r, c) {
    return {
      r, c, fr: r, fc: c, alive: true, facing: 1, moveT: 0, moved: 0, push: 0, pushDir: -1,
      shield: 0, invuln: 0, bombs: 0, pow: {}, deadT: 0, digT: 0, idleT: 0
    };
  }

  /* ── Structures ── */
  function carveBlob(cv, r0, c0, rad, t) {
    for (let r = r0 - rad; r <= r0 + rad; ++r)
      for (let c = c0 - rad * 2; c <= c0 + rad * 2; ++c) {
        const dy = (r - r0) / rad, dx = (c - c0) / (rad * 2);
        if (dx * dx + dy * dy <= 1 && inside(cv, r, c)) set(cv, r, c, t);
      }
  }

  function brickLines(cv, n, rng) {
    for (let k = 0; k < n; ++k) {
      const len = 4 + R.int(rng, 9);
      const r = 3 + R.int(rng, cv.h - 6);
      const c = 2 + R.int(rng, Math.max(1, cv.w - len - 4));
      const gap = c + 1 + R.int(rng, len - 2);
      for (let x = c; x < c + len; ++x)
        if (x !== gap) set(cv, r, x, C.BRICK);
    }
  }

  function steelBits(cv, n, rng) {
    for (let k = 0; k < n; ++k) {
      const r = 3 + R.int(rng, cv.h - 6), c = 3 + R.int(rng, cv.w - 6);
      if (R.chance(rng, 0.5)) {
        set(cv, r, c, C.STEEL); set(cv, r, c + 1, C.STEEL); set(cv, r + 1, c, C.STEEL); set(cv, r + 1, c + 1, C.STEEL);
      } else {
        const len = 3 + R.int(rng, 4);
        for (let y = 0; y < len; ++y) set(cv, r + y - 1, c, C.STEEL);
      }
    }
  }

  function scatter(cv, p, rng) {
    for (let r = 1; r < cv.h - 1; ++r)
      for (let c = 1; c < cv.w - 1; ++c) {
        const t = get(cv, r, c);
        if (t !== C.DIRT && t !== C.EMPTY) continue;
        const x = R.next(rng);
        let a = p.boulders;
        if (x < a) { set(cv, r, c, C.BOULDER); continue; }
        a += p.gems;
        if (x < a) { set(cv, r, c, C.GEM); continue; }
        a += p.ice || 0;
        if (x < a) { set(cv, r, c, C.ICE); continue; }
        a += p.bigGems || 0;
        if (x < a) set(cv, r, c, C.BIGGEM);
      }
  }

  function lavaPools(cv, n, rng) {
    for (let k = 0; k < n; ++k) {
      const len = 3 + R.int(rng, 4);
      const c = 2 + R.int(rng, cv.w - len - 4);
      const r = cv.h - 2 - (R.chance(rng, 0.4) ? R.int(rng, 3) * 4 : 0);
      for (let x = c; x < c + len; ++x) {
        set(cv, r, x, C.LAVA);
        if (get(cv, r - 1, x) === C.BOULDER || get(cv, r - 1, x) === C.GEM) set(cv, r - 1, x, C.DIRT);
      }
    }
  }

  function magicWall(cv, rng) {
    const len = 6 + R.int(rng, 5);
    const r = Math.floor(cv.h * 0.45) + R.int(rng, 3);
    const c = 3 + R.int(rng, cv.w - len - 6);
    for (let x = c; x < c + len; ++x) {
      set(cv, r, x, C.MAGIC);
      set(cv, r - 1, x, R.chance(rng, 0.6) ? C.BOULDER : C.DIRT);
      set(cv, r - 2, x, R.chance(rng, 0.5) ? C.BOULDER : C.DIRT);
      set(cv, r + 1, x, C.DIRT);
    }
  }

  function amoebaRoom(cv, rng) {
    const rw = 6, rh = 4;
    const r0 = 3 + R.int(rng, cv.h - rh - 6), c0 = 4 + R.int(rng, cv.w - rw - 8);
    for (let r = r0 - 1; r <= r0 + rh; ++r)
      for (let c = c0 - 1; c <= c0 + rw; ++c) {
        const edge = r === r0 - 1 || r === r0 + rh || c === c0 - 1 || c === c0 + rw;
        set(cv, r, c, edge ? C.BRICK : C.EMPTY);
      }
    set(cv, r0 + rh - 1, c0 + 2, C.AMOEBA);
  }

  /* an empty pocket sealed by dirt, holding one or two creatures */
  function pocket(cv, type, count, rng) {
    for (let tries = 0; tries < 40; ++tries) {
      const pw = 3 + R.int(rng, 3), ph = 2 + R.int(rng, 2);
      const r0 = 2 + R.int(rng, cv.h - ph - 4), c0 = 2 + R.int(rng, cv.w - pw - 4);
      if (r0 < 7 && c0 < 9) continue;   /* keep clear of the start corner */
      let ok = true;
      for (let r = r0 - 1; r <= r0 + ph && ok; ++r)
        for (let c = c0 - 1; c <= c0 + pw; ++c) {
          const t = get(cv, r, c);
          if (t === C.STEEL || t === C.MAGIC || t === C.LAVA || t === C.AMOEBA || C.CREATURE[t] || t === C.EXIT) { ok = false; break; }
        }
      if (!ok) continue;
      for (let r = r0 - 1; r <= r0 + ph; ++r)
        for (let c = c0 - 1; c <= c0 + pw; ++c) {
          const edge = r === r0 - 1 || r === r0 + ph || c === c0 - 1 || c === c0 + pw;
          if (edge) {
            const t = get(cv, r, c);
            if (r === r0 - 1 && C.FALLS[t]) continue;      /* boulders resting on the pocket roof stay */
            if (t !== C.BRICK) set(cv, r, c, C.DIRT);
          } else set(cv, r, c, C.EMPTY);
        }
      for (let k = 0; k < count; ++k) {
        const r = r0 + R.int(rng, ph), c = c0 + R.int(rng, pw);
        const i = idx(cv, r, c);
        if (cv.cells[i] !== C.EMPTY) continue;
        cv.cells[i] = type;
        cv.dir[i] = type === C.MOLE ? 0 : R.int(rng, 4);
      }
      return true;
    }
    return false;
  }

  function dirtCells(cv, rng, filter) {
    const out = [];
    for (let r = 2; r < cv.h - 2; ++r)
      for (let c = 2; c < cv.w - 2; ++c)
        if (get(cv, r, c) === C.DIRT && (!filter || filter(r, c))) out.push(idx(cv, r, c));
    return R.shuffle(rng, out);
  }

  function placeItems(cv, kinds, rng) {
    const spots = dirtCells(cv, rng, (r, c) => !C.FALLS[get(cv, r - 1, c)]);
    for (let k = 0; k < kinds.length && k < spots.length; ++k) {
      cv.cells[spots[k]] = C.ITEM;
      cv.item[spots[k]] = kinds[k];
    }
  }

  /* weighted power-up roll: dynamite and hard hats most often */
  const POWER_WEIGHTS = [0, 5, 4, 3, 3, 2, 3, 2, 3, 3, 2, 1];
  function rollPowerup(rng, allowLife) {
    let total = 0;
    for (let k = 1; k < POWER_WEIGHTS.length; ++k) if (k !== 11 || allowLife) total += POWER_WEIGHTS[k];
    let x = R.next(rng) * total;
    for (let k = 1; k < POWER_WEIGHTS.length; ++k) {
      if (k === 11 && !allowLife) continue;
      x -= POWER_WEIGHTS[k];
      if (x < 0) return k;
    }
    return 1;
  }

  /* Applies the boulder rules (fall, roll off rounded objects) until nothing moves */
  function settle(cv) {
    const { w, h, cells } = cv;
    for (let pass = 0; pass < h * 3; ++pass) {
      let moved = false;
      for (let r = h - 2; r >= 1; --r)
        for (let c = 1; c < w - 1; ++c) {
          const i = r * w + c, t = cells[i];
          if (!C.FALLS[t]) continue;
          if (cells[i + w] === C.EMPTY) {
            cells[i + w] = t; cells[i] = C.EMPTY; moved = true;
            continue;
          }
          if (!C.ROLLS[t] || !C.ROUNDED[cells[i + w]]) continue;
          if (cells[i - 1] === C.EMPTY && cells[i - 1 + w] === C.EMPTY) { cells[i - 1] = t; cells[i] = C.EMPTY; moved = true; }
          else if (cells[i + 1] === C.EMPTY && cells[i + 1 + w] === C.EMPTY) { cells[i + 1] = t; cells[i] = C.EMPTY; moved = true; }
        }
      if (!moved) return;
    }
  }

  function placeStart(cv, r, c) {
    cv.startR = r; cv.startC = c;
    for (let y = r - 1; y <= r + 1; ++y)
      for (let x = c - 1; x <= c + 1; ++x) {
        if (!inside(cv, y, x)) continue;
        const t = get(cv, y, x);
        if (t !== C.DIRT && t !== C.STEEL) set(cv, y, x, C.DIRT);
      }
    /* nothing loose may hang above the start */
    for (let y = r - 2; y < r; ++y)
      if (inside(cv, y, c) && C.FALLS[get(cv, y, c)]) set(cv, y, c, C.DIRT);
    set(cv, r, c, C.PLAYER);
    cv.player = newPlayer(r, c);
  }

  function placeExit(cv, r, c) {
    cv.exitR = r; cv.exitC = c;
    for (let y = r - 1; y <= r + 1; ++y)
      for (let x = c - 1; x <= c + 1; ++x) {
        if (!inside(cv, y, x)) continue;
        const t = get(cv, y, x);
        if (t === C.LAVA || t === C.STEEL || t === C.MAGIC || C.FALLS[t] || t === C.ITEM) set(cv, y, x, C.DIRT);
      }
    if (inside(cv, r - 2, c) && C.FALLS[get(cv, r - 2, c)]) set(cv, r - 2, c, C.DIRT);
    set(cv, r, c, C.EXIT);
  }

  /* objects that start embedded in dirt get dirt drawn behind them until they move */
  const EMBED = new Uint8Array(C.CELL_TYPES);
  EMBED[C.BOULDER] = EMBED[C.GEM] = EMBED[C.BIGGEM] = EMBED[C.ITEM] = EMBED[C.ICE] = EMBED[C.TNT] = 1;
  function markBackground(cv) {
    const { w, h, cells, bg } = cv;
    for (let r = 1; r < h - 1; ++r)
      for (let c = 1; c < w - 1; ++c) {
        const i = r * w + c;
        if (!EMBED[cells[i]]) continue;
        let dirt = 0;
        for (let d = 0; d < 4; ++d) if (cells[i + C.DX[d] + C.DY[d] * w] !== C.EMPTY) ++dirt;
        bg[i] = dirt >= 3 ? 1 : 0;
      }
  }

  function countGems(cv) {
    let n = 0;
    for (let i = 0; i < cv.cells.length; ++i)
      n += cv.cells[i] === C.GEM ? 1 : cv.cells[i] === C.BIGGEM ? 5 : 0;
    return n;
  }

  /* ── The regular cave ── */
  function generate(p) {
    const rng = R.make(p.seed);
    const cv = newCave(p.w, p.h, R.hash('sim' + p.seed));
    const { w, h } = cv;
    for (let r = 0; r < h; ++r)
      for (let c = 0; c < w; ++c)
        cv.cells[r * w + c] = (r === 0 || c === 0 || r === h - 1 || c === w - 1) ? C.STEEL : C.DIRT;

    const caverns = p.caverns || 0;
    for (let k = 0; k < caverns; ++k)
      carveBlob(cv, 3 + R.int(rng, h - 6), 4 + R.int(rng, w - 8), 1 + R.int(rng, 2), C.EMPTY);
    brickLines(cv, p.bricks || 0, rng);
    steelBits(cv, p.steel || 0, rng);
    scatter(cv, p, rng);
    if (p.lava) lavaPools(cv, p.lava, rng);
    if (p.magic) magicWall(cv, rng);
    if (p.amoeba) amoebaRoom(cv, rng);
    for (let k = 0; k < (p.tnt || 0); ++k) {
      const spots = dirtCells(cv, rng);
      if (spots.length) cv.cells[spots[0]] = C.TNT;
    }
    const pockets = p.pockets || [];
    for (let k = 0; k < pockets.length; ++k) pocket(cv, pockets[k].type, pockets[k].count || 1, rng);

    /* start in the upper left band, exit far away */
    const sr = 2 + R.int(rng, Math.max(1, Math.floor(h / 3) - 1)), sc = 2 + R.int(rng, Math.max(1, Math.floor(w / 4)));
    placeStart(cv, sr, sc);
    const er = h - 3 - R.int(rng, Math.max(1, Math.floor(h / 3))), ec = w - 3 - R.int(rng, Math.max(1, Math.floor(w / 4)));
    placeExit(cv, er, ec);

    const kinds = [];
    for (let k = 0; k < (p.items || 0); ++k) kinds.push(rollPowerup(rng, p.allowLife));
    for (let k = 0; k < (p.tokens || 0); ++k) kinds.push(NS.items.TOKEN);
    placeItems(cv, kinds, rng);

    settle(cv);
    cv.zen = !!p.zen;
    NS.solver.repair(cv, p.required, rng);
    cv.gemsTotal = countGems(cv);
    markBackground(cv);
    return cv;
  }

  /* ── Boss arena: dirt shelves with boulders above an open hall ── */
  function generateArena(p) {
    const rng = R.make(p.seed);
    const cv = newCave(p.w, p.h, R.hash('sim' + p.seed));
    const { w, h } = cv;
    const hall = Math.floor(h * 0.45);
    for (let r = 0; r < h; ++r)
      for (let c = 0; c < w; ++c) {
        let t = C.DIRT;
        if (r === 0 || c === 0 || r === h - 1 || c === w - 1) t = C.STEEL;
        else if (r >= h - 1 - hall) t = C.EMPTY;
        cv.cells[r * w + c] = t;
      }
    /* boulder shelves over the hall: boulder sitting on a dirt plug */
    const top = h - 1 - hall;
    for (let c = 3; c < w - 3; c += 3 + R.int(rng, 2)) {
      set(cv, top - 1, c, C.DIRT);
      set(cv, top - 2, c, C.BOULDER);
      if (R.chance(rng, 0.5)) set(cv, top - 3, c, C.BOULDER);
    }
    /* steel pillars give cover in the hall */
    for (const c of [5, w - 6]) {
      set(cv, h - 2, c, C.STEEL); set(cv, h - 3, c, C.STEEL);
    }
    for (let k = 0; k < (p.gemsInArena || 12); ++k) {
      const spots = dirtCells(cv, rng, (r, c) => r < top - 3 && !C.FALLS[get(cv, r - 1, c)]);
      if (spots.length) cv.cells[spots[0]] = C.GEM;
    }
    placeStart(cv, 2, 2);
    placeExit(cv, 2, w - 3);
    const kinds = [];
    for (let k = 0; k < (p.items || 0); ++k) kinds.push(k < (p.bossBombs || 4) ? 1 : rollPowerup(rng, false));
    for (let k = 0; k < (p.tokens || 0); ++k) kinds.push(NS.items.TOKEN);
    placeItemsIn(cv, kinds, rng, (r) => r < top - 3);
    NS.boss.spawn(cv, p.boss, h - 3, Math.floor(w / 2) - 1);
    cv.required = 0;
    cv.gemsTotal = countGems(cv);
    markBackground(cv);
    return cv;
  }

  function placeItemsIn(cv, kinds, rng, rowOk) {
    const spots = dirtCells(cv, rng, (r, c) => rowOk(r) && !C.FALLS[get(cv, r - 1, c)]);
    for (let k = 0; k < kinds.length && k < spots.length; ++k) {
      cv.cells[spots[k]] = C.ITEM;
      cv.item[spots[k]] = kinds[k];
    }
  }

  Object.assign(NS.cavegen, { newCave, newPlayer, generate, generateArena, settle, countGems, rollPowerup, idx });
})();
