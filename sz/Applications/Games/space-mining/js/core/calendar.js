/* Pure calendar rules, all from the local date (no server): the season running today, the ISO
   week key and its anomaly belt, the rule modifiers a trip flies with, the daily contract and
   the streak it builds, and the seeded schedule of belt events for a trip. No DOM, no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { SEASONS, ANOMALIES } = NS.eventData;
  const { ORE_BY_ID } = NS.ores;
  const { COMPONENTS } = NS.colonyData;
  const rng = NS.rng;

  function inSeason(s, m, d) {
    const v = m * 100 + d, a = s.m0 * 100 + s.d0, b = s.m1 * 100 + s.d1;
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  }

  function season(date) {
    const d = date || new Date();
    for (let i = 0; i < SEASONS.length; ++i)
      if (inSeason(SEASONS[i], d.getMonth() + 1, d.getDate())) return SEASONS[i];
    return null;
  }

  /* ISO 8601 week: "2026-W45" */
  function weekKey(date) {
    const d0 = date || new Date();
    const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((d - y0) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + (wk < 10 ? '0' : '') + wk;
  }

  /* this week's anomaly and the belt (1..4) it runs in */
  function anomaly(key) {
    const h = rng.hashString('anomaly:' + key);
    return { def: ANOMALIES[h % ANOMALIES.length], zone: 1 + ((h >>> 8) % 4), key: key };
  }

  const NEUTRAL = { yield: 1, life: 1, nano: 1, waves: 1, reward: 1, rare: 0, contracts: 1, bioPrice: 1, migration: 1, storm: 0,
    shieldRegen: 1, drift: 1, precious: 1, dark: 0, derelicts: 1 };

  /* every modifier a trip into belt zoneIndex flies with today */
  function mods(date, zoneIndex) {
    const out = {};
    for (const k in NEUTRAL) out[k] = NEUTRAL[k];
    const apply = (m) => {
      for (const k in m) out[k] = (k === 'rare' || k === 'storm' || k === 'dark') ? out[k] + m[k] : out[k] * m[k];
    };
    const s = season(date);
    if (s) apply(s.mods);
    const a = anomaly(weekKey(date));
    out.anomaly = null;
    if (a.zone === zoneIndex) {
      apply(a.def.mods);
      out.reward *= a.def.reward;
      out.anomaly = a.def;
    }
    out.season = s;
    return out;
  }

  function dayAfter(key, n) {
    const p = key.split('-');
    const d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return rng.dayKey(d);
  }

  /* the streak after finishing today's daily: kept from yesterday, reset after a gap */
  function streakAfter(daily, today) {
    if (daily.last === today) return { streak: daily.streak, last: today };
    const kept = daily.last && dayAfter(daily.last, 1) === today;
    return { streak: kept ? daily.streak + 1 : 1, last: today };
  }

  /* the streak still alive today (a missed day breaks it) */
  function liveStreak(daily, today) {
    if (!daily.last) return 0;
    return daily.last === today || dayAfter(daily.last, 1) === today ? daily.streak : 0;
  }

  function streakMul(streak) {
    return 1 + 0.25 * Math.min(6, Math.max(0, streak - 1));
  }

  /* Today's daily contract: an ore delivery, components (with a fabricator) or waves held (with
     an outpost), the same all day; reward grows with the streak */
  function dailyContract(day, opts) {
    const r = rng.makeRng(rng.hashString('daily-contract:' + day));
    const kinds = ['ore'];
    if (opts.hasBase) kinds.push('waves');
    if (opts.hasFab) kinds.push('comp');
    const kind = kinds[Math.floor(r() * kinds.length)];
    const mul = streakMul(opts.streak + 1);
    let c;
    if (kind === 'ore') {
      const pool = opts.ores && opts.ores.length ? opts.ores : ['iron'];
      const id = pool[Math.floor(r() * pool.length)];
      const o = ORE_BY_ID[id];
      const qty = Math.max(6, Math.round(30 / (1 + o.rarity * 0.6)));
      c = { kind: 'ore', ore: id, qty: qty, reward: Math.round(qty * o.value * 2.4 * mul / 10) * 10 };
    } else if (kind === 'comp') {
      const id = COMPONENTS[Math.floor(r() * 3)].id;
      const qty = 3 + Math.floor(r() * 3);
      c = { kind: 'comp', ore: id, qty: qty, reward: Math.round(qty * NS.colonyData.COMP_BY_ID[id].value * 2.2 * mul / 10) * 10 };
    } else {
      const qty = 2 + Math.floor(r() * 2);
      c = { kind: 'waves', ore: 'waves', qty: qty, start: opts.waves || 0, reward: Math.round(qty * 700 * mul / 10) * 10 };
    }
    c.id = 'daily_' + day;
    c.daily = day;
    c.rd = 2 + Math.min(4, opts.streak);
    c.trips = 99;
    return c;
  }

  /* This week's contract: a bigger job (components, or waves held in the anomaly belt) */
  function weeklyContract(week, opts) {
    const r = rng.makeRng(rng.hashString('weekly-contract:' + week));
    const an = anomaly(week);
    let c;
    if (opts.hasFab && r() < 0.5) {
      const id = COMPONENTS[Math.floor(r() * 4)].id;
      const qty = 8 + Math.floor(r() * 6);
      c = { kind: 'comp', ore: id, qty: qty, reward: Math.round(qty * NS.colonyData.COMP_BY_ID[id].value * 3 * an.def.reward / 10) * 10 };
    } else if (opts.hasBase) {
      const qty = 6 + Math.floor(r() * 4);
      c = { kind: 'waves', ore: 'waves', qty: qty, start: opts.waves || 0, reward: Math.round(qty * 900 * an.def.reward / 10) * 10 };
    } else {
      const pool = opts.ores && opts.ores.length ? opts.ores : ['iron'];
      const id = pool[pool.length - 1 - Math.floor(r() * Math.min(3, pool.length))];
      const o = ORE_BY_ID[id];
      const qty = Math.max(12, Math.round(90 / (1 + o.rarity * 0.6)));
      c = { kind: 'ore', ore: id, qty: qty, reward: Math.round(qty * o.value * 3 * an.def.reward / 10) * 10 };
    }
    c.id = 'weekly_' + week;
    c.weekly = week;
    c.rd = 6;
    c.trips = 99;
    return c;
  }

  /* Seeded belt events for one trip: [{ t, kind }] in seconds from arrival */
  function planEvents(seed, zone, opts) {
    const r = rng.makeRng((seed ^ 0x6a09e667) >>> 0);
    const m = opts.mods || NEUTRAL;
    const out = [];
    const life = (zone.life || 0) * m.life, nano = (zone.nano || 0) * m.nano;
    if (opts.hasBase && life > 0 && r() < Math.min(0.85, life * 1.1)) out.push({ t: 140 + r() * 260, kind: 'outbreak' });
    if (opts.career && zone.index >= 1 && r() < 0.4 * m.derelicts) out.push({ t: 50 + r() * 200, kind: 'distress' });
    if (life > 0 && r() < Math.min(0.9, 0.3 * (1 + life) * m.migration)) out.push({ t: 180 + r() * 320, kind: 'migration' });
    if (opts.hasBase && nano > 0 && r() < Math.min(0.9, nano)) out.push({ t: 220 + r() * 380, kind: 'nanoprobe' });
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  Object.assign(NS.calendar, {
    inSeason, season, weekKey, anomaly, mods, dayAfter, streakAfter, liveStreak, streakMul, dailyContract, weeklyContract, planEvents, NEUTRAL
  });
})();
