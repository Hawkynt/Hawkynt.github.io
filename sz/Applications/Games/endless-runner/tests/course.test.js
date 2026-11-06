'use strict';

/* Course fairness and completability. Every pattern is driven by the look-ahead solver over the
   real physics step at the slowest and fastest speeds; every story stage, the Daily Run and long
   Arcade stretches are run start to finish; and the generator's invariants hold: lists sorted,
   pits never wider than a jump carries, spans never overlapping, no obstacle over a pit. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/solver.js');
const { check, done } = H;
const CO = NS.course, SO = NS.solver, PH = NS.physics, C = NS.constants, WD = NS.worlds;
const mods = { maxJumps: 2 };
const fast = process.argv.includes('--fast');

/* each pattern alone on flat ground */
let patFails = [];
for (const name of CO.PATTERN_NAMES)
  for (const vm of [10, 23])
    for (let seed = 1; seed <= (fast ? 2 : 4); ++seed) {
      const cfg = { mode: 'story', x0: 0, v0: vm, vMax: vm, ramp: 1e9, diff: 0.6, world: 4, seed: seed };
      const c = CO.create(cfg);
      const E = CO.emitter(c);
      const end = CO.PATTERNS[name](E, c.genX, vm * C.PX_PER_M, 0.9, NS.rng.makeRng(seed * 77 + vm), 4);
      for (const k of ['hzs', 'items', 'plats', 'pads']) E[k].sort((a, b) => a.x - b.x);
      c.hz.push(...E.hzs); c.items.push(...E.items); c.plats.push(...E.plats); c.pads.push(...E.pads);
      const last = c.ground[c.ground.length - 1];
      last.w = end + 3000 - last.x;
      const res = SO.run(c, { speedAt: x => CO.speedAt(cfg, x), mods: mods }, PH.newPlayer(0), end + 200, {});
      if (!res.ok) patFails.push(name + '@' + vm + '#' + seed + ':' + res.why);
    }
check('every pattern can be cleared at 10 and 23 m/s', !patFails.length, patFails.join(', '));

function invariants(c, label) {
  const sorted = a => a.every((e, i) => !i || a[i - 1].x <= e.x);
  check(label + ': lists sorted', sorted(c.hz) && sorted(c.items) && sorted(c.plats) && sorted(c.ground));
  let overlap = false, wide = false;
  for (let i = 1; i < c.ground.length; ++i) {
    const gap = c.ground[i].x - (c.ground[i - 1].x + c.ground[i - 1].w);
    if (gap < 0) overlap = true;
    const v = CO.speedAt(c.cfg, c.ground[i - 1].x + c.ground[i - 1].w);
    const x0 = c.ground[i - 1].x + c.ground[i - 1].w, x1 = c.ground[i].x;
    const ledge = c.plats.some(q => !q.bar && q.x < x1 && q.x + q.w > x0);
    const spring = c.pads.some(q => q.kind === 'spring' && q.x < x0 && q.x > x0 - 600);
    if (gap > v * CO.T1 * 0.65 && !ledge && !spring) wide = true;
  }
  check(label + ': spans never overlap and pits stay within a jump (or a ledge/spring)', !overlap && !wide);
  let floating = false;
  for (const h of c.hz) if (h.kind !== 'bar' && h.kind !== 'drone' && h.kind !== 'saw' && !PH.onGroundSpan(c, h.x + 4, h.x + h.w - 4)) floating = true;
  check(label + ': no ground obstacle hangs over a pit', !floating);
}

/* whole courses, start to finish */
function drive(cfg, toM, label) {
  const c = CO.create(cfg);
  const toX = cfg.lenM ? c.endX + 300 : toM * C.PX_PER_M;
  const t0 = Date.now();
  const res = SO.run(c, { speedAt: x => CO.speedAt(cfg, x), mods: mods }, PH.newPlayer(0), toX,
    { ensure: x => { CO.ensure(c, x + C.GEN_AHEAD); } });
  check(label + ' completable (' + Math.round(res.x / C.PX_PER_M) + ' m, ' + (Date.now() - t0) + ' ms)', res.ok, res.why + ' at ' + Math.round(res.x));
  CO.ensure(c, toX);
  invariants(c, label);
  return c;
}

const stages = WD.allStages().filter(s => !s.boss);
check('twenty run stages and five guardians', stages.length === 20 && WD.allStages().length === 25);
for (const st of fast ? stages.filter((s, i) => i % 5 === 3) : stages) {
  const c = drive({ mode: 'story', world: st.w, seed: NS.rng.hashString('runner-stage-' + st.id), v0: st.v0, v1: st.v1, vMax: st.v1 + 1,
    ramp: 2400, diff: st.diff, lenM: st.lenM, shards: 3, x0: 0, powerEvery: 3400 }, 0, 'stage ' + st.id);
  check('stage ' + st.id + ' places its three shards and a finish', c.shardsPlaced === 3 && c.items.some(i => i.k === 'finish'));
}
const rec = NS.seasons.dailyRecipe(new Date(2026, 10, 6));
drive({ mode: 'daily', world: rec.world, seed: rec.seed, v0: 11, v1: 15.5, diff: 0.32, lenM: rec.lenM, x0: 0 }, 0, 'daily run ' + rec.key);
for (const seed of fast ? [7] : [7, 99]) drive({ mode: 'arcade', world: 0, cycle: 1200, seed: seed, v0: C.ARCADE_BASE, vMax: C.ARCADE_MAX, ramp: 1800, diff: 0.1, x0: 0 }, fast ? 2500 : 6000, 'arcade seed ' + seed);
drive({ mode: 'arcade', world: 0, cycle: 1200, seed: 5, v0: C.ARCADE_BASE, vMax: C.ARCADE_MAX, ramp: 1800, diff: 0.1, x0: 0, pits: true }, 2000, 'pitfall mutator');
drive({ mode: 'zen', world: 2, cycle: 1500, seed: 3, diff: 0.15, x0: 0 }, 1500, 'zen');

/* the same seed builds the same course */
const a = CO.create({ mode: 'story', world: 1, seed: 42, v0: 12, v1: 14, lenM: 800, diff: 0.4, x0: 0 });
const b = CO.create({ mode: 'story', world: 1, seed: 42, v0: 12, v1: 14, lenM: 800, diff: 0.4, x0: 0 });
CO.ensure(a, 40000); CO.ensure(b, 20000); CO.ensure(b, 40000);
check('a seed always builds the same course, however it is streamed', JSON.stringify(a.hz) === JSON.stringify(b.hz) && JSON.stringify(a.ground) === JSON.stringify(b.ground));
done();
