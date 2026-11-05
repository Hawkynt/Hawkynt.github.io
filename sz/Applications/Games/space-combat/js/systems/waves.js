/* Stage generation, pure and seeded: campaign stages from the mission table, endless waves,
   the daily gauntlet, the boss rush, wave composition from a budget, and the stage layout for
   the arcade field (start, the first hazards on screen, the outposts and data cores that scroll
   in and when, the convoy and station positions). Never touches the DOM or G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const { makeRng, hashString, dist2 } = NS.rng;
  const { ENEMIES, BOSSES, BOSS_ORDER } = NS.enemyData;
  const { SECTORS, MISSIONS, missionId } = NS.campaign;
  const { PF_W, PF_H } = NS.constants;

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
  /* Everything a stage starts with, and when its objectives scroll in; the same seed gives the
     same stage. Coordinates are play field units (PF_W x PF_H, y grows down-screen). */
  function layoutStage(st) {
    const rng = makeRng(st.seed);
    const W = PF_W, H = PF_H;
    const L = { start: { x: W / 2, y: H - 90 }, rocks: [], mines: [], nebulae: [],
      outposts: [], cores: [], station: null, convoy: null, turrets: st.roster.indexOf('turret') >= 0 };
    const hz = st.hazards;

    if (st.type === 'defend') {
      L.station = { x: W / 2, y: H - 70 };
      L.start = { x: W / 2, y: H - 190 };
    } else if (st.type === 'escort') {
      L.convoy = { x: W / 2, y: H - 230 };
      L.start = { x: W / 2 - 150, y: H - 90 };
    } else if (st.type === 'destroy') {
      /* outposts arrive one by one in two lanes, so two never overlap; the next comes early if one falls */
      const first = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < st.n; ++i) {
        const side = i % 2 ? -first : first;
        L.outposts.push({ x: W / 2 + side * rng.range(150, 175), at: 4 + i * 26 });
      }
    } else if (st.type === 'collect') {
      for (let i = 0; i < st.n; ++i)
        L.cores.push({ x: rng.range(90, W - 90), at: 3 + i * 8.5 });
    }

    /* a few rocks already on screen, never in the pilot's lane */
    const rocks = Math.min(4, Math.round(hz.rocks / 7));
    for (let i = 0; i < rocks; ++i) {
      for (let t = 0; t < 20; ++t) {
        const q = { x: rng.range(60, W - 60), y: rng.range(40, H * 0.45) };
        if (Math.abs(q.x - L.start.x) < 120 || L.rocks.some(o => dist2(o.x, o.y, q.x, q.y) < 150 * 150)) continue;
        L.rocks.push({ x: q.x, y: q.y, size: rng() < 0.4 ? 2 : 1, seed: Math.floor(rng() * 1e9) });
        break;
      }
    }
    if (hz.nebulae > 0) L.nebulae.push({ x: rng.range(160, W - 160), y: rng.range(60, 180), r: rng.range(150, 210), seed: Math.floor(rng() * 1e9) });
    return L;
  }

  Object.assign(NS.waves, {
    WAVE_TYPES, MUTATORS, intensity, composeWave, campaignStage, endlessStage, dailyPlan, bossRushPlan,
    layoutStage
  });
})();
