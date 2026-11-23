/* Pure skill rules: the mission score (0..100) from the outcome, the hull and the guarded assets
   kept, the progress of a lost operation and activity (actions per second), the career's
   difficulty level it moves (start 1, between 0.6 and 2.5, 0.006 a point away from the score the
   operation's mood expects, at most 0.15 a time), and
   the multipliers a level gives to hulls, damage, numbers, pace and enemy income. No DOM, no state
   access - except act(), which counts an action on the running operation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const MIN = 0.6, MAX = 2.5, STEP = 0.006, PAR = 60, CAP = 0.15;
  /* the score an operation of each mood expects: aced breathers say little, a lost one a lot */
  const EXPECT = { C: 85, E: 90, S: 75, H: 65, W: 55, N: 50 };
  const clamp01 = v => Math.max(0, Math.min(1, v || 0));

  function blank() {
    return { level: 1, n: 0, last: 0 };
  }

  function activity(aps) {
    return clamp01(aps);
  }

  /* r: { won, hull (kept 0..1), kept (guarded assets kept 0..1, null: none), progress (0..1), aps } */
  function score(r) {
    const act = activity(r.aps);
    if (!r.won) return 25 * clamp01(r.progress) + 10 * act;
    const kept = r.kept === null || r.kept === undefined ? 1 : clamp01(r.kept);
    return 50 + 15 * clamp01(r.hull) + 15 * kept + 20 * act;
  }

  function update(sk, sc, mood) {
    const par = mood && EXPECT[mood] !== undefined ? EXPECT[mood] : PAR;
    const move = Math.max(-CAP, Math.min(CAP, STEP * (sc - par)));
    sk.level = Math.round(Math.max(MIN, Math.min(MAX, sk.level + move)) * 1e9) / 1e9;
    sk.n += 1;
    sk.last = Math.round(sc);
    return sk;
  }

  function diff(level) {
    const d = (level || 1) - 1;
    return { hp: 1 + 0.5 * d, dmg: 1 + 0.3 * d, size: 1 + 0.6 * d, pace: 1 + 0.4 * d, income: 1 + 0.5 * d };
  }

  function repair(src) {
    const s = blank();
    if (!src || typeof src !== 'object') return s;
    const n = (v, lo, hi, def) => typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
    s.level = n(src.level, MIN, MAX, 1);
    s.n = Math.floor(n(src.n, 0, 1e7, 0));
    s.last = Math.floor(n(src.last, 0, 100, 0));
    return s;
  }

  /* an order, ability, building or upgrade in the command view counts as an action */
  function act() {
    const o = NS.state.run && NS.state.run.op;
    if (o && o.status === 'active') o.actions = (o.actions || 0) + 1;
  }

  Object.assign(NS.skill, {
    MIN, MAX, STEP, PAR, CAP, EXPECT, blank, activity, score, update, diff, repair, act
  });
})();
