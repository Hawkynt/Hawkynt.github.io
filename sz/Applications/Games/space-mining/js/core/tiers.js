/* Pure tier rules: the Hard and Nightmare modifiers, which ones an operation draws (one for Hard,
   two for Nightmare keeping Hard's, only ones that fit it, fixed per operation), unlocking tier
   by tier, first-clear rewards (Intel times two or three, festival tokens), medals, the weekly
   Nightmare Op (one non-capstone operation and two modifiers per ISO week), its score, streak
   and high score, and repairing what a save stores. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const rng = NS.rng;

  const TIERS = ['normal', 'hard', 'nightmare'];
  const MODS = {
    veteran: { name: 'Veteran foes', text: 'Every pirate and enemy has half again its hull' },
    swarm: { name: 'Swarm', text: 'Ambushes, threats and fronts are half again as big' },
    fog: { name: 'Fog', text: 'The radar sees half as far' },
    storm: { name: 'Endless storm', text: 'Solar storms come one after another' },
    dry: { name: 'Dry tanks', text: 'The tank holds 60%' },
    noturrets: { name: 'No turrets', text: 'Turrets cannot be built', fits: op => !!op.waves && !op.waves.off },
    doubled: { name: 'Double convoy', text: 'Every freighter comes with a twin', fits: op => !!op.convoy },
  };
  const ORDER = Object.keys(MODS);
  const PAY = { hard: 2, nightmare: 3 };
  const TOKENS = 3;
  const WEEKLY_INTEL = 5;

  function fits(id, op) {
    const m = MODS[id];
    return !!m && (!m.fits || m.fits(op));
  }

  /* a seeded draw of n distinct modifiers that fit the operation */
  function draw(op, seed, n) {
    const r = rng.makeRng(rng.hashString(seed));
    const pool = ORDER.filter(id => fits(id, op));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }

  function modsFor(op, tier) {
    if (tier !== 'hard' && tier !== 'nightmare') return [];
    const first = draw(op, 'tier:' + op.id, 1);
    if (tier === 'hard') return first;
    const rest = draw(op, 'tier2:' + op.id, 3).filter(id => first.indexOf(id) < 0);
    return first.concat(rest.slice(0, 1));
  }

  function record(save, op) {
    return save.ops && save.ops[op.id] || null;
  }

  function tierRec(save, op, tier) {
    const rec = record(save, op);
    return rec && rec.tiers && rec.tiers[tier] || null;
  }

  function unlocked(save, op, tier) {
    const rec = record(save, op);
    if (tier === 'hard') return !!(rec && rec.done);
    if (tier === 'nightmare') return !!(tierRec(save, op, 'hard') || {}).done;
    return true;
  }

  /* records a tier run; the first clear pays Intel (and tokens for Nightmare) */
  function finish(save, op, tier, won, secs) {
    const rec = save.ops[op.id] || (save.ops[op.id] = { done: false, tries: 0, best: 0 });
    rec.tiers = rec.tiers || {};
    const t = rec.tiers[tier] || (rec.tiers[tier] = { done: false, tries: 0, best: 0 });
    t.tries += 1;
    if (!won) return { first: false };
    const first = !t.done;
    t.done = true;
    const s = Math.max(1, Math.round(secs || 0));
    if (!t.best || s < t.best) t.best = s;
    if (first) {
      save.intel = (save.intel || 0) + NS.ops.intelFor(op) * (PAY[tier] || 1);
      if (tier === 'nightmare' && save.festival) save.festival.tokens = (save.festival.tokens || 0) + TOKENS;
    }
    return { first: first };
  }

  function medal(save, op) {
    if ((tierRec(save, op, 'nightmare') || {}).done) return 'gold';
    if ((tierRec(save, op, 'hard') || {}).done) return 'silver';
    const rec = record(save, op);
    return rec && rec.done ? 'bronze' : '';
  }

  /* ── the weekly Nightmare Op ── */
  function weekly(week) {
    const pool = NS.opsData.OPS.filter(o => !o.capstone);
    const r = rng.makeRng(rng.hashString('nightmare:' + week));
    const op = pool[Math.floor(r() * pool.length)];
    return { week: week, op: op.id, mods: draw(op, 'nightmare-mods:' + week, 2) };
  }

  function weeklyOpen(save, wk) {
    return NS.ops.state(save, wk.op) !== 'locked';
  }

  function score(secs) {
    return Math.max(500, Math.round(10000 - secs * 10));
  }

  /* a weekly run's end: the week's best, 5 Intel and the streak on the first win of a week */
  function finishWeekly(save, date, won, secs) {
    if (!won) return null;
    const week = NS.calendar.weekKey(date);
    const prev = NS.calendar.weekKey(new Date(date.getTime() - 7 * 86400000));
    const w = save.weekly || { week: '', best: 0, streak: 0, last: '' };
    const sc = score(secs);
    if (w.week !== week) {
      w.streak = w.last === prev ? w.streak + 1 : 1;
      w.last = week;
      w.week = week;
      w.best = 0;
      save.intel = (save.intel || 0) + WEEKLY_INTEL;
    }
    if (sc > w.best) w.best = sc;
    save.weekly = w;
    const op = NS.opsData.OP_BY_ID[weekly(week).op];
    save.highScores.push({ score: sc, mode: 'weekly', detail: (op ? op.name : '') + ' ' + week });
    save.highScores.sort((a, b) => b.score - a.score);
    save.highScores.length = Math.min(save.highScores.length, 10);
    return { score: sc, streak: w.streak };
  }

  /* ── repair ── */
  function repairTiers(src) {
    if (!src || typeof src !== 'object') return undefined;
    const out = {};
    const n = (v, hi) => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : 0;
    for (const t of ['hard', 'nightmare']) if (src[t] && typeof src[t] === 'object') out[t] = { done: !!src[t].done, tries: n(src[t].tries, 1e6), best: n(src[t].best, 1e7) };
    return Object.keys(out).length ? out : undefined;
  }

  function repairWeekly(src) {
    if (!src || typeof src !== 'object') return null;
    const str = v => typeof v === 'string' ? v.slice(0, 10) : '';
    const n = v => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1e7, Math.floor(v))) : 0;
    return { week: str(src.week), best: n(src.best), streak: n(src.streak), last: str(src.last) };
  }

  Object.assign(NS.tiers, {
    TIERS, MODS, PAY, TOKENS, WEEKLY_INTEL, fits, modsFor, unlocked, finish, medal, weekly, weeklyOpen, score, finishWeekly, repairTiers, repairWeekly
  });
})();
