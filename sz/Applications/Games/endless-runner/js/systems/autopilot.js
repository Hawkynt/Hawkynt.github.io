/* The demo runner behind the title screen: steers with the look-ahead planner over the real
   physics, replanning every few frames on a small beam so it stays cheap, and spends the odd
   frame showing off a dash on open ground. Owns the current plan. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const { A } = NS.physics;

  const EVERY = 3;
  let plan = null, idx = 0, sub = 0, age = 0, shots = 0;

  function reset() {
    plan = null; idx = 0; sub = 0; age = 0;
  }

  function bits(run, env) {
    if (run.p.fly) return 0;
    /* guardian volleys: look further ahead, wider, and replan whenever a shot is fired */
    const duel = run.projs.length > 0 || (run.bs && !run.bs.chase);
    if (!plan || age >= (duel ? 6 : 12) || idx >= plan.length || run.projs.length !== shots) {
      shots = run.projs.length;
      const bs = run.bs;
      const chased = bs && bs.phase === 'fight' && (bs.chase ? bs.lead < 500 : bs.id === 'king' && bs.hp <= bs.maxHp / 2 && bs.wallLead < 500);
      plan = NS.solver.plan(run.p, env, duel ? 96 : 60, { every: EVERY, beam: duel ? 30 : 14, push: chased ? 0.02 : 0 });
      idx = 0; sub = 0; age = 0;
      if (!plan) return 0;
    }
    const act = plan[idx];
    const out = sub === 0 ? act : (act & A.HOLD_DOWN);
    if (++sub >= EVERY) { sub = 0; ++idx; }
    ++age;
    return out;
  }

  Object.assign(NS.autopilot, {
    reset, bits
  });
})();
