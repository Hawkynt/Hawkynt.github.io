/* The course generator: a seeded stream of hand-shaped patterns (hurdles, overhangs, pits,
   ledges, walls, saws, drones, falling rocks, rollers, springs, boost pads, gem routes...) laid
   out ahead of the runner. Every gap and spacing is scaled by the running speed at that spot so a
   pattern stays fair at any speed: reaction room before each obstacle, pits never wider than a
   jump carries, landing room after them. Also places coins along jump arcs, power-up orbs,
   story shards, festival tokens and the finish gate. The course is plain data (saved with the
   run); the generator's random state travels with it. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const { makeRng, clamp, lerp } = NS.rng;
  const { HAZARDS, POWERS, BAR_DECK } = NS.items;
  const { WORLDS } = NS.worlds;

  const GY = C.GROUND_Y;
  const T1 = 2 * C.JUMP_V / C.GRAVITY;
  const H1 = C.JUMP_V * C.JUMP_V / (2 * C.GRAVITY);
  const BODY = 38;

  /* ── speed along the course (px/s at world x) ── */
  function speedAt(cfg, x) {
    const m = Math.max(0, (x - cfg.x0) / C.PX_PER_M);
    if (cfg.mode === 'zen') return C.ZEN_SPEED * C.PX_PER_M;
    if (cfg.lenM) return lerp(cfg.v0, cfg.v1, clamp(m / cfg.lenM, 0, 1)) * C.PX_PER_M;
    const v = cfg.v0 + (cfg.vMax - cfg.v0) * (1 - Math.exp(-m / (cfg.ramp || 1800)));
    return v * C.PX_PER_M;
  }

  /* difficulty 0..1 at world x */
  function diffAt(cfg, x) {
    if (cfg.mode === 'zen') return 0.15;
    const m = Math.max(0, (x - cfg.x0) / C.PX_PER_M);
    if (cfg.lenM) return clamp(cfg.diff + 0.12 * m / cfg.lenM, 0, 1);
    return clamp(cfg.diff + m / 4000, 0, 1);
  }

  /* the world whose look and weights apply at x (arcade cycles through all five) */
  function worldAt(cfg, x) {
    if (!cfg.cycle) return cfg.world;
    const m = Math.max(0, (x - cfg.x0) / C.PX_PER_M);
    return (cfg.world + Math.floor(m / cfg.cycle)) % WORLDS.length;
  }

  function create(cfg) {
    const x0 = cfg.x0 || 0;
    cfg.x0 = x0;
    return {
      cfg: cfg, rngS: (cfg.seed >>> 0) || 1, genX: x0 + 900, uid: 0, n: 0,
      ground: [{ x: x0 - 1600, w: 2500 }], plats: [], hz: [], items: [], pads: [], decor: [],
      nextPower: x0 + (cfg.firstPower || 2600), nextToken: x0 + 1800, nextShard: 0, shardsPlaced: 0,
      endX: cfg.lenM ? x0 + cfg.lenM * C.PX_PER_M : 0, finished: 0, last: '', coinsTotal: 0,
    };
  }

  /* ── the emitter a pattern writes through ── */
  function emitter(c) {
    const hzs = [], items = [], plats = [], pads = [];
    const E = {
      hzs: hzs, items: items, plats: plats, pads: pads,
      hz(kind, x, props) {
        const def = HAZARDS[kind];
        const h = { id: ++c.uid, kind: kind, x: x, w: def.w, h: def.h, base: GY, smash: def.smash ? 1 : 0 };
        if (props) for (const k in props) h[k] = props[k];
        hzs.push(h);
        return h;
      },
      coin(x, y) { items.push({ k: 'coin', x: x, y: y }); ++c.coinsTotal; },
      gem(x, y) { items.push({ k: 'gem', x: x, y: y }); },
      item(k, x, y, extra) { const it = { k: k, x: x, y: y }; if (extra) for (const q in extra) it[q] = extra[q]; items.push(it); return it; },
      plat(x, y, w, crumble) { plats.push({ x: x, y: y, w: w, cr: crumble ? 1 : 0 }); },
      /* an overhang beam: slide under it or land on its deck */
      bar(x, w, props) {
        const h = E.hz('bar', x, Object.assign({ w: w }, props || {}));
        plats.push({ x: x, y: GY - BAR_DECK, w: w, cr: 0, bar: 1 });
        return h;
      },
      pad(kind, x, w) { pads.push({ kind: kind, x: x, w: w || 70 }); },
      pit(x, w) {
        const g = c.ground[c.ground.length - 1];
        g.w = Math.max(0, x - g.x);
        c.ground.push({ x: x + w, w: 0, after: w });
      },
      /* coins along a jump arc from xa to xb peaking dy above the ground */
      arc(xa, xb, dy, n, y0) {
        const base = (y0 || GY) - BODY;
        for (let i = 0; i < n; ++i) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          E.coin(lerp(xa, xb, t), base - dy * 4 * t * (1 - t));
        }
      },
      line(xa, xb, y, step) {
        for (let x = xa; x <= xb; x += step || 46) E.coin(x, y);
      },
    };
    return E;
  }

  /* ── patterns: (E, x, v, d, r, w) -> end x ── */
  const P = {
    rest(E, x, v, d, r) {
      const len = v * r.range(0.7, 1.1);
      E.line(x + 40, x + len - 40, GY - BODY);
      return x + len;
    },
    coins(E, x, v, d, r) {
      const len = v * r.range(1.0, 1.4);
      const kind = r.int(0, 2);
      if (kind === 0) {
        const reach = v * T1;
        E.arc(x + 60, x + 60 + reach * 0.9, H1 * 0.8, 9);
      } else if (kind === 1) {
        for (let i = 0; i < 12; ++i) E.coin(x + 60 + i * (len - 120) / 11, GY - BODY - 40 - Math.sin(i * 0.8) * 40);
      } else E.line(x + 40, x + len - 40, GY - BODY - (r.chance(0.5) ? 0 : 90));
      return x + len;
    },
    hurdle(E, x, v, d, r) {
      const hx = x + v * 0.55;
      E.hz('hurdle', hx);
      E.arc(hx - v * T1 * 0.38, hx + 34 + v * T1 * 0.38, H1 * 0.85, 7);
      return hx + 34 + v * 0.35;
    },
    block(E, x, v, d, r) {
      const hx = x + v * 0.55;
      const stack = d > 0.35 && r.chance(0.4);
      E.hz('block', hx, stack ? { h: 112 } : null);
      E.arc(hx - v * T1 * 0.35, hx + 58 + v * T1 * 0.35, H1 * (stack ? 0.95 : 0.8), 7);
      if (stack && r.chance(0.5)) E.gem(hx + 29, GY - 112 - 110);
      return hx + 58 + v * 0.35;
    },
    double(E, x, v, d, r) {
      const a = x + v * 0.55, gap = v * r.range(0.62, 0.8);
      E.hz(r.chance(0.5) ? 'hurdle' : 'block', a);
      E.hz('hurdle', a + gap);
      E.arc(a - v * 0.2, a + gap + v * 0.25, H1 * 0.9, 9);
      return a + gap + 40 + v * 0.35;
    },
    bar(E, x, v, d, r) {
      const bx = x + v * 0.6, w = r.range(90, 200);
      E.bar(bx, w);
      E.line(bx - 20, bx + w + 10, GY - 18, 40);
      return bx + w + v * 0.35;
    },
    tunnel(E, x, v, d, r) {
      const bx = x + v * 0.6;
      const total = v * r.range(0.8, 1.3);
      const segs = Math.ceil(total / 380);
      const sw = total / segs;
      for (let i = 0; i < segs; ++i) E.bar(bx + i * sw, sw + 1, { seg: i });
      E.line(bx, bx + total, GY - 18, 44);
      return bx + total + v * 0.4;
    },
    lowHigh(E, x, v, d, r) {
      const a = x + v * 0.55;
      const first = r.chance(0.5);
      if (first) {
        E.hz('hurdle', a);
        const b = a + 34 + v * 0.95;
        E.bar(b, 110);
        E.arc(a - v * 0.25, a + v * 0.45, H1 * 0.8, 6);
        return b + 110 + v * 0.35;
      }
      E.bar(a, 110);
      const b = a + 110 + v * 0.6;
      E.hz('hurdle', b);
      E.line(a, a + 110, GY - 18, 40);
      return b + 34 + v * 0.4;
    },
    pit(E, x, v, d, r) {
      const reach = v * T1;
      const w = clamp(reach * r.range(0.32, 0.38 + d * 0.18), 110, reach * 0.62);
      const px = x + v * 0.6;
      E.pit(px, w);
      E.arc(px - reach * 0.18, px + w + reach * 0.18, H1 * 0.75, 8);
      return px + w + v * 0.45;
    },
    pitPlat(E, x, v, d, r) {
      const reach = v * T1;
      const px = x + v * 0.6;
      const pw = clamp(v * 0.5, 170, 420);
      const g1 = clamp(reach * r.range(0.3, 0.42), 100, reach * 0.5);
      const g2 = clamp(reach * r.range(0.3, 0.42), 100, reach * 0.5);
      const w = g1 + pw + g2;
      E.pit(px, w);
      const py = GY - r.range(60, 110);
      E.plat(px + g1, py, pw, false);
      E.line(px + g1 + 20, px + g1 + pw - 20, py - BODY, 44);
      if (r.chance(0.35 + d * 0.3)) E.gem(px + g1 + pw / 2, py - BODY - 150);
      return px + w + v * 0.45;
    },
    crumble(E, x, v, d, r) {
      const reach = v * T1;
      const px = x + v * 0.6;
      const n = r.int(2, 3);
      const pw = clamp(v * 0.32, 120, 260);
      const gap = clamp(reach * r.range(0.25, 0.34), 90, reach * 0.42);
      const w = gap + n * (pw + gap);
      E.pit(px, w);
      let cx = px + gap;
      for (let i = 0; i < n; ++i) {
        const py = GY - 70 - (i % 2) * 40;
        E.plat(cx, py, pw, true);
        E.arc(cx + 10, cx + pw - 10, 30, 4, py);
        cx += pw + gap;
      }
      return px + w + v * 0.45;
    },
    stairs(E, x, v, d, r) {
      const sx = x + v * 0.45;
      const pw = clamp(v * 0.55, 200, 460);
      const step = clamp(v * 0.42, 180, 420);
      E.plat(sx, GY - 120, pw, false);
      E.plat(sx + step + pw * 0.4, GY - 235, pw, false);
      E.line(sx + 20, sx + pw - 20, GY - 120 - BODY, 46);
      const top = sx + step + pw * 0.4;
      for (let i = 0; i < 3; ++i) E.gem(top + 40 + i * (pw - 80) / 2, GY - 235 - BODY);
      /* below: something the high route skips */
      const wx = top + pw * 0.35;
      if (d > 0.25 && r.chance(0.6)) E.hz('spikes', wx - 60, { w: 120 });
      else E.hz('hurdle', wx);
      return top + pw + v * 0.4;
    },
    wall(E, x, v, d, r) {
      const wx = x + v * 0.7;
      E.hz('wall', wx);
      E.arc(wx - v * 0.42, wx + 54 + v * 0.42, 250, 9);
      return wx + 54 + v * 0.45;
    },
    spring(E, x, v, d, r) {
      const sx = x + v * 0.5;
      E.pad('spring', sx, 70);
      if (r.chance(0.5)) E.hz('wall', sx + 70 + v * 0.42);
      else E.pit(sx + 50 + v * 0.3, clamp(v * 0.45, 200, v * 0.45));
      E.arc(sx + 30, sx + 70 + v * 1.0, 360, 11);
      if (r.chance(0.5)) E.gem(sx + 70 + v * 0.5, GY - BODY - 380);
      return sx + 70 + v * 1.25;
    },
    boost(E, x, v, d, r) {
      const bx = x + v * 0.4;
      E.pad('boost', bx, 90);
      const len = v * C.BOOST_MUL * (C.BOOST_T + 0.3);
      E.line(bx + 120, bx + len, GY - BODY, 40);
      return bx + len + v * 0.3;
    },
    spikes(E, x, v, d, r) {
      const sx = x + v * 0.6;
      const w = clamp(v * T1 * r.range(0.22, 0.32 + d * 0.12), 90, v * T1 * 0.5);
      E.hz('spikes', sx, { w: w });
      E.arc(sx - v * 0.2, sx + w + v * 0.2, H1 * 0.85, 8);
      return sx + w + v * 0.4;
    },
    saw(E, x, v, d, r) {
      const sx = x + v * 0.75;
      const low = r.chance(0.5);
      E.hz('saw', sx, { cyEnd: low ? GY - 30 : GY - 84, cyStart: low ? GY - 150 : GY - 30, low: low ? 1 : 0 });
      if (low) E.arc(sx - v * 0.3, sx + 64 + v * 0.3, H1 * 0.85, 7); else E.line(sx - 30, sx + 90, GY - 18, 40);
      return sx + 64 + v * 0.45;
    },
    drone(E, x, v, d, r) {
      const sx = x + v * 0.8;
      const low = r.chance(0.5);
      E.hz('drone', sx, { cyEnd: low ? GY - 26 : GY - 64, cyStart: GY - 230, glide: 160, low: low ? 1 : 0 });
      if (low) E.arc(sx - 160 - v * 0.3, sx - 100 + v * 0.3, H1 * 0.85, 7); else E.line(sx - 200, sx - 60, GY - 18, 40);
      return sx + 56 + v * 0.45;
    },
    rock(E, x, v, d, r) {
      const rx = x + v * 0.7;
      E.hz('rock', rx, { top: -160 });
      E.arc(rx - v * 0.3, rx + 52 + v * 0.3, H1 * 0.85, 7);
      return rx + 52 + v * 0.4;
    },
    roller(E, x, v, d, r) {
      const roll = clamp(v * 0.45, 160, 380);
      const rx = x + v * 0.7 + roll;
      E.hz('roller', rx, { roll: roll });
      E.arc(rx - roll - v * 0.3, rx - roll + 56 + v * 0.3, H1 * 0.85, 7);
      return rx + 56 + v * 0.4;
    },
    gemRoute(E, x, v, d, r) {
      const sx = x + v * 0.45;
      const len = v * r.range(1.4, 1.9);
      E.plat(sx, GY - 130, len * 0.2, false);
      E.plat(sx + len * 0.25, GY - 200, len * 0.75, false);
      const n = Math.max(3, Math.floor(len * 0.75 / 120));
      for (let i = 0; i < n; ++i) E.gem(sx + len * 0.25 + 60 + i * (len * 0.75 - 120) / Math.max(1, n - 1), GY - 200 - BODY);
      /* low route: two jumpable hazards */
      E.hz('hurdle', sx + len * 0.35);
      E.hz(d > 0.4 ? 'block' : 'hurdle', sx + len * 0.35 + v * 0.75);
      return sx + len + v * 0.4;
    },
  };

  /* earliest difficulty at which a pattern appears */
  const MIN_D = { rest: 0, coins: 0, hurdle: 0, block: 0, bar: 0, pit: 0.05, double: 0.15, tunnel: 0.25, lowHigh: 0.2,
    pitPlat: 0.2, crumble: 0.35, stairs: 0.1, wall: 0.2, spring: 0.15, boost: 0.1, spikes: 0.15, saw: 0.3, drone: 0.2,
    rock: 0.2, roller: 0.25, gemRoute: 0.25 };
  const HARD = { wall: 1, crumble: 1, saw: 1, tunnel: 1, lowHigh: 1, pitPlat: 1, double: 1 };
  const SAFE = { rest: 1, coins: 1 };
  const NAMES = Object.keys(P);

  function pickPattern(c, r, d, w, boss) {
    const weights = WORLDS[w].weights;
    let total = 0;
    const list = [];
    for (let i = 0; i < NAMES.length; ++i) {
      const n = NAMES[i];
      let wt = weights[n] || 0;
      if (!wt || d < MIN_D[n]) continue;
      if (boss && !(SAFE[n] || n === 'pit')) continue;
      if (HARD[n]) wt *= 0.4 + d;
      if (c.cfg.pits && (n === 'pit' || n === 'pitPlat' || n === 'crumble')) wt *= 3;
      if (SAFE[n]) wt *= 1.4 - d;
      if (n === c.last) wt *= 0.25;
      list.push(n, wt);
      total += wt;
    }
    let q = r() * total;
    for (let i = 0; i < list.length; i += 2) {
      q -= list[i + 1];
      if (q <= 0) return list[i];
    }
    return list[0];
  }

  function pickPower(cfg, r) {
    let total = 0;
    for (let i = 0; i < POWERS.length; ++i) if (!cfg.noPower || cfg.noPower.indexOf(POWERS[i].id) < 0) total += POWERS[i].weight;
    let q = r() * total;
    for (let i = 0; i < POWERS.length; ++i) {
      if (cfg.noPower && cfg.noPower.indexOf(POWERS[i].id) >= 0) continue;
      q -= POWERS[i].weight;
      if (q <= 0) return POWERS[i].id;
    }
    return 'magnet';
  }

  function byX(a, b) { return a.x - b.x; }

  function flush(c, E, r) {
    const gr = c.cfg.gemRate || 0;
    if (gr && r)
      for (let i = 0; i < E.items.length; ++i) if (E.items[i].k === 'coin' && r() < gr) { E.items[i].k = 'gem'; --c.coinsTotal; }
    E.hzs.sort(byX); E.items.sort(byX); E.plats.sort(byX); E.pads.sort(byX);
    for (let i = 0; i < E.hzs.length; ++i) c.hz.push(E.hzs[i]);
    for (let i = 0; i < E.items.length; ++i) c.items.push(E.items[i]);
    for (let i = 0; i < E.plats.length; ++i) c.plats.push(E.plats[i]);
    for (let i = 0; i < E.pads.length; ++i) c.pads.push(E.pads[i]);
  }

  /* generate until the course reaches toX */
  function ensure(c, toX) {
    const cfg = c.cfg;
    if (c.finished) return;
    const r = makeRng(c.rngS);
    while (c.genX < toX) {
      const x = c.genX;
      const g = c.ground[c.ground.length - 1];
      if (c.endX && x > c.endX - 700) {
        /* the finish: flat ground, a last line of coins and the gate */
        const E = emitter(c);
        /* a long last pattern may have run past the planned line: the finish moves up */
        c.endX = Math.max(c.endX, x + 400);
        E.line(x + 60, c.endX - 60, GY - BODY, 60);
        E.item('finish', c.endX, GY);
        flush(c, E, r);
        g.w = c.endX + 4000 - g.x;
        c.genX = c.endX + 4000;
        c.finished = 1;
        break;
      }
      const v = speedAt(cfg, x);
      const d = diffAt(cfg, x);
      const w = worldAt(cfg, x);
      const E = emitter(c);
      let name;
      const wantPower = !cfg.noPowers && x >= c.nextPower;
      const wantToken = cfg.token && x >= c.nextToken;
      if (wantPower || wantToken) name = 'rest';
      else if (cfg.boostEvery && x >= (c.nextBoost || 0)) {
        name = 'boost';
        c.nextBoost = x + cfg.boostEvery * r.range(0.8, 1.2);
      } else name = pickPattern(c, r, d, w, cfg.boss);
      if (c.n < 2) name = 'rest';
      let end = P[name](E, x, v, d, r, w);
      if (wantPower) {
        E.item('power', x + v * 0.45, GY - 64, { p: pickPower(cfg, r) });
        c.nextPower = x + (cfg.powerEvery || 3400) * r.range(0.75, 1.25);
      } else if (wantToken) {
        E.item('token', x + v * 0.5, GY - BODY - 70);
        c.nextToken = x + r.range(1400, 2400);
      }
      /* story shards sit high above flat stretches: a well-timed double jump */
      if (cfg.shards && c.shardsPlaced < cfg.shards && c.endX && SAFE[name]) {
        const at = c.cfg.x0 + (c.endX - c.cfg.x0) * (0.2 + c.shardsPlaced * 0.28);
        if (x >= at) {
          E.item('shard', x + v * 0.55, GY - 270, { n: c.shardsPlaced });
          ++c.shardsPlaced;
        }
      }
      flush(c, E, r);
      /* reaction room before the next pattern shrinks with difficulty */
      const gap = v * lerp(0.42, 0.18, d) * r.range(0.8, 1.3);
      end += gap;
      g.w = Math.max(g.w, 0);
      const last = c.ground[c.ground.length - 1];
      last.w = Math.max(last.w, end - last.x);
      c.genX = end;
      c.last = name;
      ++c.n;
    }
    c.rngS = r.s;
  }

  /* drop everything entirely behind x (arrays stay sorted) */
  function cull(c, x) {
    function trim(arr, right) {
      let k = 0;
      while (k < arr.length - 1 && right(arr[k]) < x) ++k;
      if (k) arr.splice(0, k);
    }
    trim(c.ground, g => g.x + g.w);
    trim(c.plats, q => q.x + q.w);
    trim(c.pads, q => q.x + q.w);
    trim(c.hz, h => h.x + Math.max(h.w, 60) + (h.kind === 'roller' ? 0 : 0));
    trim(c.items, it => it.x + 40);
  }

  Object.assign(NS.course, {
    PATTERNS: P, PATTERN_NAMES: NAMES, MIN_D, T1, H1, BODY, speedAt, diffAt, worldAt, create, emitter, ensure, cull, pickPower
  });
})();
