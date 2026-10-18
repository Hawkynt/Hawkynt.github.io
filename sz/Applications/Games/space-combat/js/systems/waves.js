/* Stage generation, pure and seeded: campaign stages from the mission table, endless waves,
   the daily gauntlet, the boss rush, wave composition from a budget, and the sector layout
   (start, hazards, outposts, cores, convoy route). Never touches the DOM or G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const { makeRng, hashString, dist2 } = NS.rng;
  const { ENEMIES, BOSSES, BOSS_ORDER } = NS.enemyData;
  const { SECTORS, MISSIONS, missionId } = NS.campaign;

  const WAVE_TYPES = ['fighter', 'interceptor', 'drone', 'bomber', 'frigate', 'cloaker', 'lancer', 'carrier'];

  const MUTATORS = {
    glass: { name: 'Glass Cannons', desc: 'Everyone deals double damage.', dmgIn: 2, dmgOut: 2 },
    swarm: { name: 'Swarm', desc: '50% more enemies, worth more.', count: 1.5, score: 1.3 },
    storm: { name: 'Hazard Storm', desc: 'Twice the hazards.', hazards: 2 },
    overclock: { name: 'Overclocked', desc: 'Enemies move and fire 25% faster.', speed: 1.25 },
    salvage: { name: 'Salvage Rights', desc: 'Fewer power-ups, double scrap.', luck: 0.5, scrap: 2 },
  };

  /* The difficulty of a campaign slot */
  function intensity(sector, index) {
    return 1 + sector * 0.42 + index * 0.07;
  }

  /* Spend `budget` points on enemies from the roster; heavy ships only from later waves */
  function composeWave(rng, roster, budget, waveIdx) {
    const types = roster.filter(t => WAVE_TYPES.indexOf(t) >= 0);
    const groups = {};
    let left = budget;
    let guard = 0;
    while (left >= 1 && ++guard <= 60) {
      const pool = types.filter(t => {
        const c = ENEMIES[t].cost;
        if (c > left) return false;
        if (t === 'carrier' && (budget < 14 || waveIdx < 2)) return false;
        if (t === 'frigate' && waveIdx < 1) return false;
        return true;
      });
      if (!pool.length) break;
      /* cheap ships are common, heavy ones rarer */
      let total = 0;
      for (let i = 0; i < pool.length; ++i) total += 1 / ENEMIES[pool[i]].cost;
      let pick = rng() * total;
      let type = pool[0];
      for (let i = 0; i < pool.length; ++i) {
        pick -= 1 / ENEMIES[pool[i]].cost;
        if (pick <= 0) { type = pool[i]; break; }
      }
      if (type === 'drone') {
        const n = Math.min(Math.floor(left), 3 + Math.floor(rng() * 3));
        groups[type] = (groups[type] || 0) + n;
        left -= n;
      } else {
        groups[type] = (groups[type] || 0) + 1;
        left -= ENEMIES[type].cost;
      }
    }
    const out = [];
    for (const t in groups) out.push({ type: t, count: groups[t] });
    return out;
  }

  function baseStage(sector, extra) {
    const sec = SECTORS[sector];
    return Object.assign({
      sector: sector,
      size: sec.size,
      roster: sec.roster.slice(),
      hazards: Object.assign({}, sec.hazards),
      hpMul: 1 + sector * 0.16,
      dmgMul: 1 + sector * 0.12,
      mutator: null,
      period: 9,
      maxAlive: 14 + sector * 3,
    }, extra);
  }

  /* A campaign mission as a playable stage */
  function campaignStage(sector, index) {
    const m = MISSIONS[sector][index];
    const k = intensity(sector, index);
    const st = baseStage(sector, {
      id: missionId(sector, index), mode: 'campaign', index: index,
      name: m.name, type: m.type, brief: m.brief, par: m.par,
      time: m.time || 0, n: m.n || 0, len: m.len || 0, boss: m.boss || null,
      seed: hashString(missionId(sector, index)),
      budget: Math.round(5 * k), growth: 1.1 * k,
    });
    if (m.type === 'survive') st.period = 7.5;
    if (m.type === 'defend') { st.period = 9; st.maxAlive -= 4; }
    if (m.type === 'destroy') st.period = 15;
    if (m.type === 'collect') st.period = 11;
    if (m.type === 'escort') st.period = 8.5;
    if (m.type === 'boss') { st.period = 22; st.budget = Math.round(3 * k); st.growth = 0.5; }
    /* the first missions are a gentle start */
    if (sector === 0 && index < 2) { st.budget = Math.max(3, st.budget - 1); st.maxAlive = 10; }
    return st;
  }

  /* Endless wave n (1-based): sector theme rotates every five waves, a boss every fifth */
  function endlessStage(n) {
    const sector = Math.floor((n - 1) / 5) % SECTORS.length;
    const cycle = Math.floor((n - 1) / 25);
    const unlocked = Math.min(WAVE_TYPES.length, 3 + Math.floor(n / 2));
    const roster = WAVE_TYPES.slice(0, unlocked);
    const isBoss = n % 5 === 0;
    const st = baseStage(sector, {
      id: 'endless-' + n, mode: 'endless', index: n,
      name: isBoss ? 'Wave ' + n + ' - Boss' : 'Wave ' + n, type: 'endless',
      brief: '', par: 0, time: 0, n: 0, len: 0,
      boss: isBoss ? BOSS_ORDER[(n / 5 - 1) % BOSS_ORDER.length] : null,
      seed: hashString('endless' + n),
      roster: roster,
      budget: Math.round(5 + n * 2.1), growth: 0,
      hpMul: 1 + n * 0.035 + cycle * 0.3, dmgMul: 1 + n * 0.025,
      maxAlive: Math.min(60, 14 + n * 2),
    });
    st.bossHpMul = 0.7 + n * 0.03;
    return st;
  }

  /* The daily gauntlet: five seeded stages with one mutator, the same for every player that day */
  function dailyPlan(day) {
    const rng = makeRng(hashString('daily-' + day));
    const keys = Object.keys(MUTATORS);
    const mutator = keys[Math.floor(rng() * keys.length)];
    const kinds = ['survive', 'destroy', 'collect', 'defend', 'escort'];
    const stages = [];
    for (let i = 0; i < 4; ++i) {
      const sector = Math.min(4, Math.floor(rng() * 3) + Math.floor(i / 2));
      const type = kinds.splice(Math.floor(rng() * kinds.length), 1)[0];
      const k = 1.3 + i * 0.25;
      const st = baseStage(sector, {
        id: 'daily-' + day + '-' + i, mode: 'daily', index: i,
        name: 'Gauntlet ' + (i + 1), type: type, brief: MUTATORS[mutator].desc, par: 90,
        time: type === 'survive' || type === 'defend' ? 50 + i * 5 : 0,
        n: type === 'destroy' ? 2 + (i >> 1) : type === 'collect' ? 5 + i : 0,
        len: type === 'escort' ? 2200 + i * 200 : 0, boss: null,
        seed: hashString(day + ':' + i), budget: Math.round(6 * k), growth: k,
        period: type === 'destroy' ? 14 : 9,
      });
      stages.push(st);
    }
    const bossId = BOSS_ORDER[Math.floor(rng() * BOSS_ORDER.length)];
    stages.push(baseStage(BOSSES[bossId].sector, {
      id: 'daily-' + day + '-boss', mode: 'daily', index: 4, name: 'Gauntlet Boss', type: 'boss',
      brief: MUTATORS[mutator].desc, par: 160, time: 0, n: 0, len: 0, boss: bossId,
      seed: hashString(day + ':boss'), budget: 4, growth: 0.6, period: 20,
    }));
    for (let i = 0; i < stages.length; ++i) applyMutator(stages[i], mutator);
    return { day: day, mutator: mutator, stages: stages };
  }

  function applyMutator(st, id) {
    const m = MUTATORS[id];
    st.mutator = id;
    if (m.count) { st.budget = Math.round(st.budget * m.count); st.maxAlive = Math.round(st.maxAlive * m.count); }
    if (m.hazards) {
      st.hazards.rocks = Math.round(st.hazards.rocks * m.hazards) + 8;
      st.hazards.mines = Math.round(st.hazards.mines * m.hazards) + 6;
    }
  }

  function bossRushPlan() {
    const stages = [];
    for (let i = 0; i < BOSS_ORDER.length; ++i) {
      const b = BOSSES[BOSS_ORDER[i]];
      stages.push(baseStage(b.sector, {
        id: 'rush-' + i, mode: 'bossRush', index: i, name: b.name, type: 'boss', brief: b.title,
        par: 150, time: 0, n: 0, len: 0, boss: BOSS_ORDER[i], seed: hashString('rush' + i),
        budget: 3, growth: 0.4, period: 24,
      }));
    }
    return { stages: stages };
  }

  /* ── layout ── */
  function far(p, list, d) {
    const d2 = d * d;
    for (let i = 0; i < list.length; ++i)
      if (dist2(p.x, p.y, list[i].x, list[i].y) < d2 + (list[i].r || 0) * (list[i].r || 0) * 2)
        return false;
    return true;
  }

  function scatter(rng, S, n, margin, avoid, minD, tries) {
    const out = [];
    for (let i = 0; i < n; ++i) {
      for (let t = 0; t < (tries || 40); ++t) {
        const p = { x: rng.range(margin, S - margin), y: rng.range(margin, S - margin) };
        if (far(p, avoid, minD) && far(p, out, minD * 0.6)) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  }

  /* Places everything that exists before the first wave; the same seed gives the same sector */
  function layoutStage(st) {
    const rng = makeRng(st.seed);
    const S = st.size;
    const C = S / 2;
    const L = { start: { x: C, y: C + 300 }, rocks: [], mines: [], nebulae: [], hole: null,
      outposts: [], cores: [], route: [], station: null };
    const keep = [];

    if (st.type === 'escort') {
      L.start = { x: 520, y: C + 140 };
      const len = Math.min(st.len, S - 900);
      const x0 = (S - len) / 2;
      for (let i = 0; i <= 5; ++i)
        L.route.push({ x: x0 + len * i / 5, y: C + Math.sin(i * 1.3 + rng() * 0.5) * 520 * (i > 0 && i < 5 ? 1 : 0.3) });
      for (let i = 0; i < L.route.length; ++i) keep.push({ x: L.route[i].x, y: L.route[i].y, r: 120 });
    } else if (st.type === 'defend') {
      L.station = { x: C, y: C };
      L.start = { x: C, y: C + 260 };
      keep.push({ x: C, y: C, r: 260 });
    } else if (st.type === 'destroy') {
      L.start = { x: C, y: S - 500 };
      const base = rng() * Math.PI * 2;
      for (let i = 0; i < st.n; ++i) {
        const a = base + i * Math.PI * 2 / st.n + rng.range(-0.3, 0.3);
        const r = S * rng.range(0.26, 0.36);
        L.outposts.push({ x: C + Math.cos(a) * r, y: C - 120 + Math.sin(a) * r * 0.9 });
      }
      for (let i = 0; i < L.outposts.length; ++i) keep.push({ x: L.outposts[i].x, y: L.outposts[i].y, r: 240 });
    } else if (st.type === 'boss') {
      L.start = { x: C, y: C + 520 };
    }
    keep.push({ x: L.start.x, y: L.start.y, r: 380 });

    const hz = st.hazards;
    if (hz.hole) {
      const bossHole = st.boss === 'maw';
      if (bossHole) L.hole = { x: C, y: C - 300, r: 70, pull: 0 };
      else {
        /* the spot farthest from the start, the route and the objectives, among a few candidates */
        let best = null, bestD = -1;
        for (let t = 0; t < 16; ++t) {
          const q = { x: rng.range(S * 0.25, S * 0.75), y: rng.range(S * 0.2, S * 0.8) };
          let d = Infinity;
          for (let k = 0; k < keep.length; ++k) d = Math.min(d, Math.hypot(q.x - keep[k].x, q.y - keep[k].y) - keep[k].r);
          if (d > bestD) { bestD = d; best = q; }
        }
        L.hole = { x: best.x, y: best.y, r: 70, pull: 520 };
      }
      keep.push({ x: L.hole.x, y: L.hole.y, r: 520 });
    }
    for (let i = 0; i < hz.nebulae; ++i) {
      const p = scatter(rng, S, 1, 500, [L.start].concat(L.hole ? [L.hole] : []), 600)[0];
      if (p) L.nebulae.push({ x: p.x, y: p.y, r: rng.range(320, 520), seed: Math.floor(rng() * 1e9) });
    }
    if (st.type === 'collect') {
      const inNeb = L.nebulae.length ? Math.min(L.nebulae.length, Math.ceil(st.n / 3)) : 0;
      for (let i = 0; i < inNeb; ++i) {
        const nb = L.nebulae[i];
        L.cores.push({ x: nb.x + rng.range(-0.4, 0.4) * nb.r, y: nb.y + rng.range(-0.4, 0.4) * nb.r });
      }
      if (L.hole) {
        for (let i = 0; i < 2 && L.cores.length < st.n; ++i) {
          const a = rng() * Math.PI * 2;
          L.cores.push({ x: L.hole.x + Math.cos(a) * 330, y: L.hole.y + Math.sin(a) * 330 });
        }
      }
      const more = scatter(rng, S, st.n - L.cores.length, 320, keep.concat(L.cores), 420, 80);
      L.cores = L.cores.concat(more);
      for (let i = 0; i < L.cores.length; ++i) keep.push({ x: L.cores[i].x, y: L.cores[i].y, r: 90 });
    }
    const avoid = keep.concat(L.hole ? [{ x: L.hole.x, y: L.hole.y, r: 380 }] : []);
    const rocks = scatter(rng, S, hz.rocks, 150, avoid, 170, 30);
    for (let i = 0; i < rocks.length; ++i)
      L.rocks.push({ x: rocks[i].x, y: rocks[i].y, size: rng() < 0.35 ? 3 : rng() < 0.6 ? 2 : 1, seed: Math.floor(rng() * 1e9) });
    L.mines = scatter(rng, S, hz.mines, 200, avoid.concat(L.rocks), 220, 30);
    return L;
  }

  /* Where enemies of a wave appear: off-screen around the anchor, inside the sector */
  function spawnPoint(rng, S, ax, ay, minR, maxR) {
    for (let t = 0; t < 12; ++t) {
      const a = rng() * Math.PI * 2;
      const r = rng.range(minR, maxR);
      const x = ax + Math.cos(a) * r, y = ay + Math.sin(a) * r;
      if (x > 80 && y > 80 && x < S - 80 && y < S - 80) return { x: x, y: y };
    }
    return { x: Math.min(S - 100, Math.max(100, ax + minR)), y: Math.min(S - 100, Math.max(100, ay)) };
  }

  Object.assign(NS.waves, {
    WAVE_TYPES, MUTATORS, intensity, composeWave, campaignStage, endlessStage, dailyPlan, bossRushPlan,
    layoutStage, spawnPoint
  });
})();
