'use strict';

/* Level validation and the solvability proof: every campaign level, trick
   shot and a run of Daily challenges replays its stored solution with the
   game's own deterministic physics. */

global.window = {};
const fs = require('fs');
require('../js/engine/physics.js');
require('../js/engine/parts.js');
require('../js/engine/sim.js');
require('../js/data/levels-data.js');
require('../js/data/solutions.js');

const SZ = window.SZ;
const Lv = SZ.PhysicsPuzzleLevels, Sim = SZ.PhysicsPuzzleSim, Parts = SZ.PhysicsPuzzleParts;
const SOL = SZ.PhysicsPuzzleSolutions;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('modules registered', !!Lv && !!SOL && Object.isFrozen(Lv) && Object.isFrozen(SOL), 'missing');
check('no DOM or storage use', ['js/data/levels-data.js', 'js/engine/sim.js', 'js/engine/parts.js', 'js/data/solutions.js'].every(f => !/document|localStorage/.test(fs.readFileSync(require.resolve('../' + f), 'utf8'))), 'touches DOM');

/* structure */
check('five worlds', Lv.WORLDS.length === 5, Lv.WORLDS.length);
check('forty levels, eight per world', Lv.LEVELS.length === 40 && Lv.WORLDS.every((w, i) => Lv.worldLevels(i).length === 8), Lv.LEVELS.length);
check('level ids unique', new Set(Lv.LEVELS.map(l => l.id)).size === 40, 'dupes');
check('level names unique', new Set(Lv.LEVELS.map(l => l.name)).size === 40, 'dupes');
check('at least ten trick shots on existing levels', Lv.TRICKS.length >= 10 && Lv.TRICKS.every(t => Lv.BY_ID[t.base]), 'bad tricks');
const KINDS = new Set(['ground', 'wall', 'ice', 'ramp', 'peg', 'crate', 'steel', 'boulder', 'glass', 'tnt', 'spring', 'bumper', 'conveyor', 'paddle', 'swing', 'fan', 'water', 'magnet', 'portal', 'pendulum', 'lava']);
for (const l of Lv.LEVELS) {
  const bad = [];
  if (!Array.isArray(l.launcher) || l.launcher.length !== 2) bad.push('launcher');
  if (!l.targets.length) bad.push('no targets');
  if (!(l.par >= 1 && l.par <= 4)) bad.push('par');
  if (!l.tip) bad.push('tip');
  for (const it of l.items) if (!KINDS.has(it[0])) bad.push('kind ' + it[0]);
  for (const k of Object.keys(l.inv)) if (!Parts.PARTS[k] || Parts.PARTS[k].sandbox) bad.push('inv ' + k);
  for (const t of l.targets.concat(l.stars)) if (t[0] < 20 || t[0] > 1260 || t[1] < 20 || t[1] > 630) bad.push('off-field ' + t);
  if (l.aim && !(l.aim[0] < l.aim[1] && l.aim[0] >= Sim.ANGLE_MIN && l.aim[1] <= Sim.ANGLE_MAX)) bad.push('aim');
  if (bad.length)
    check('level ' + l.id + ' well formed', false, bad.join(', '));
}
check('every level well formed', true, '');
/* every world shows off its own gadgets */
const kindsOf = (w) => new Set([].concat.apply([], Lv.worldLevels(w).map(l => l.items.map(i => i[0]))));
check('garden has conveyors, water, fans and a pendulum', ['conveyor', 'water', 'fan', 'pendulum'].every(k => kindsOf(1).has(k)), [...kindsOf(1)]);
check('cryo lab has ice, portals and magnets', ['ice', 'portal', 'magnet'].every(k => kindsOf(2).has(k)), [...kindsOf(2)]);
check('forge has TNT, gears, lava and steel', ['tnt', 'paddle', 'lava', 'steel'].every(k => kindsOf(3).has(k)), [...kindsOf(3)]);
check('station has low gravity', Lv.WORLDS[4].gravity < 700, Lv.WORLDS[4].gravity);
check('levels fill the trays with at least five part types', new Set([].concat.apply([], Lv.LEVELS.map(l => Object.keys(l.inv)))).size >= 5, 'few parts');

/* the solutions */
function ruleOpts(level) {
  const r = level.rule || {};
  return { oneShot: !!r.oneShot, minBounces: r.minBounces || 0 };
}

function replay(level, sol) {
  return Sim.playSolution(level, sol, Object.assign({ theme: Lv.WORLDS[level.world] }, ruleOpts(level)));
}

let solved = 0, threeStar = 0, totalShots = 0;
const t0 = Date.now();
for (const l of Lv.LEVELS) {
  const sol = SOL[l.id];
  if (!sol) {
    check(l.id + ' has a solution', false, 'missing');
    continue;
  }
  /* the parts must fit the inventory and the placement rules */
  const left = Object.assign({}, l.inv);
  let fits = true;
  const placed = [];
  for (const p of sol.parts) {
    left[p[0]] = (left[p[0]] || 0) - 1;
    const pl = { type: p[0], x: p[1], y: p[2], a: p[3] || 0 };
    if (left[p[0]] < 0 || !Parts.canPlace(l, Lv.WORLDS[l.world], placed, pl).ok)
      fits = false;
    placed.push(pl);
  }
  const r = replay(l, sol);
  const r2 = replay(l, sol);
  const ok = fits && r.win && r.shots <= l.par;
  if (ok) ++solved;
  if (ok && r.stars === r.starsTotal) ++threeStar;
  totalShots += r.shots;
  check(l.id + ' ' + l.name + ' solved in ' + r.shots + '/' + l.par + ' shots, stars ' + r.stars + '/' + r.starsTotal, ok && r.stars === r.starsTotal,
    'fits=' + fits + ' win=' + r.win + ' shots=' + r.shots + ' stars=' + r.stars);
  check(l.id + ' replay is deterministic', SZ.PhysicsPuzzlePhysics.hash(r.attempt.world) === SZ.PhysicsPuzzlePhysics.hash(r2.attempt.world), 'hash differs');
}
console.log('INFO ' + solved + '/40 levels solved within par, ' + threeStar + '/40 with every star, ' + totalShots + ' shots, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
check('all 40 levels solvable within par', solved === 40, solved);

for (const t of Lv.TRICKS) {
  const level = Lv.trickLevel(t);
  const sol = SOL[level.id];
  if (!sol) {
    check('trick ' + t.id + ' has a solution', false, 'missing');
    continue;
  }
  const r = replay(level, sol);
  const ok = r.win && r.shots === 1 && (!t.rule.noParts || !sol.parts.length) && (!t.rule.minBounces || r.bounces >= t.rule.minBounces);
  check('trick ' + t.id + ' ' + t.name + ' (' + JSON.stringify(t.rule) + ') replays', ok, 'win=' + r.win + ' shots=' + r.shots + ' bounces=' + r.bounces);
}

/* daily challenges stay solvable: stars hang on a known solution path */
{
  let ok = 0;
  const days = 30;
  for (let d = 0; d < days; ++d) {
    const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    const daily = Sim.buildDaily(date, Lv.LEVELS, SOL, Lv.WORLDS);
    const r = replay(daily, SOL[daily.baseId]);
    if (r.win && r.stars === daily.stars.length && daily.stars.length >= 2 && r.shots <= daily.par)
      ++ok;
    else
      console.log('INFO daily ' + date + ' ' + daily.baseId + ' win=' + r.win + ' stars ' + r.stars + '/' + daily.stars.length);
  }
  check('30 daily challenges replay with every star', ok === days, ok + '/' + days);
  const a = Sim.buildDaily('2026-05-05', Lv.LEVELS, SOL, Lv.WORLDS), b = Sim.buildDaily('2026-05-05', Lv.LEVELS, SOL, Lv.WORLDS);
  check('the daily is the same for everyone that day', JSON.stringify(a.stars) === JSON.stringify(b.stars) && a.baseId === b.baseId, 'differs');
}

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
