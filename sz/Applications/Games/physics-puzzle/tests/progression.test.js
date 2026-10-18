'use strict';

global.window = {};
const fs = require('fs');
require('../js/core/progression.js');
require('../js/engine/physics.js');
require('../js/engine/parts.js');
require('../js/engine/sim.js');
require('../js/data/levels-data.js');

const P = window.SZ.PhysicsPuzzleProgress;
const Lv = window.SZ.PhysicsPuzzleLevels;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!P && Object.isFrozen(P), 'SZ.PhysicsPuzzleProgress missing or not frozen');
check('no DOM or storage use', !/document|localStorage/.test(fs.readFileSync(require.resolve('../js/core/progression.js'), 'utf8')), 'touches DOM/storage');

/* tree data */
const ids = new Set(P.TREE.map(n => n.id));
check('tree node ids unique', ids.size === P.TREE.length, 'duplicates');
check('five branches with at least four nodes each', P.BRANCH_ORDER.length === 5 && P.BRANCH_ORDER.every(b => P.TREE.filter(n => n.branch === b).length >= 4), 'thin branch');
check('every requirement exists', P.TREE.every(n => n.req.every(r => ids.has(r[0]) && r[1] >= 1 && r[1] <= P.TREE_BY_ID[r[0]].costs.length)), 'bad req');
check('a description per rank', P.TREE.every(n => n.desc.length === n.costs.length), 'desc count mismatch');
check('costs rise within a node', P.TREE.every(n => n.costs.every((c, i) => i === 0 || c > n.costs[i - 1])), 'non-rising costs');
check('skins and trails map to nodes', P.SKINS.every(s => !s.node || P.TREE_BY_ID[s.node]) && P.TRAILS.every(s => !s.node || P.TREE_BY_ID[s.node]), 'missing node');
function depth(id, seen) {
  if (seen.has(id)) return Infinity;
  seen.add(id);
  let d = 0;
  for (const r of P.TREE_BY_ID[id].req) d = Math.max(d, 1 + depth(r[0], new Set(seen)));
  return d;
}
check('requirements acyclic', P.TREE.every(n => depth(n.id, new Set()) < 10), 'cycle');

/* base stats */
const save = P.defaultSave();
const base = P.computeStats(save);
check('base stats are plain', base.powerMul === 1 && base.extraBalls === 0 && !base.ricochet && base.rubber === 0 && base.bulletTime === 0, JSON.stringify(base));
check('base coin multiplier 1', base.coinMul === 1, base.coinMul);
check('base sandbox has four parts', base.sandboxParts.length === 4, base.sandboxParts);

/* buying */
check('locked node reports locked', P.nodeState(save, 'ricochet') === 'locked', P.nodeState(save, 'ricochet'));
check('expensive when broke', P.nodeState(save, 'power') === 'expensive', P.nodeState(save, 'power'));
save.coins = 100000;
check('buy works', P.buy(save, 'power') && P.level(save, 'power') === 1 && save.coins === 100000 - 90, save.coins);
check('effect applies at once', P.computeStats(save).powerMul > 1.07, P.computeStats(save).powerMul);
P.buy(save, 'sight'); P.buy(save, 'sight');
check('requirement unlocks dependant', P.nodeState(save, 'ricochet') === 'available', P.nodeState(save, 'ricochet'));
for (const n of P.TREE) while (P.buy(save, n.id)) {}
check('everything can be bought', P.TREE.every(n => P.nodeState(save, n.id) === 'maxed'), 'not maxed');
const full = P.computeStats(save);
check('full tree stats', full.powerMul > 1.2 && full.extraBalls === 2 && full.ricochet && full.sandboxParts.length === 10 && full.coinMul > 1.7, JSON.stringify(full));
check('multi-ball toggle', P.computeStats(Object.assign({}, save, { multiOn: false })).extraBalls === 0, 'toggle ignored');

/* rewards */
{
  const s = P.defaultSave();
  const st = P.computeStats(s);
  const lvl = Lv.LEVELS[0];
  const r1 = P.applyLevelResult(s, lvl, { win: true, shots: 1, starsTaken: lvl.stars.length }, st);
  check('first clear pays and earns three stars', r1.coins > 50 && r1.first && r1.newStars === 3 && P.starCount(s, lvl.id) === 3, JSON.stringify(r1));
  const r2 = P.applyLevelResult(s, lvl, { win: true, shots: 1, starsTaken: 0 }, st);
  check('replay pays a little', r2.coins > 0 && r2.coins < r1.coins / 4, r2.coins);
  const r3 = P.applyLevelResult(s, Lv.LEVELS[1], { win: false, shots: 4, starsTaken: 0 }, st);
  check('a loss pays nothing and clears nothing', r3.coins === 0 && !P.cleared(s, Lv.LEVELS[1].id), JSON.stringify(r3));
  const r4 = P.applyLevelResult(s, Lv.LEVELS[1], { win: true, shots: 9, starsTaken: 0 }, st);
  check('over par earns one star', P.starCount(s, Lv.LEVELS[1].id) === 1 && r4.newStars === 1, P.starCount(s, Lv.LEVELS[1].id));
}

/* the economy: the campaign plus tricks pays a good share of the tree, not all of it */
{
  const s = P.defaultSave();
  const st = P.computeStats(s);
  for (const l of Lv.LEVELS)
    P.applyLevelResult(s, l, { win: true, shots: l.par, starsTaken: l.stars.length }, st);
  for (const t of Lv.TRICKS)
    P.applyTrickResult(s, t, true, st);
  const total = P.totalTreeCost();
  console.log('INFO perfect campaign + tricks pay ' + s.coins + ' coins, tree costs ' + total);
  check('campaign pays 50-90 % of the tree', s.coins > total * 0.5 && s.coins < total * 0.9, s.coins + ' vs ' + total);
}

/* unlocks */
{
  const s = P.defaultSave();
  check('first level open, second locked', P.levelUnlocked(s, Lv.LEVELS, 'w1-1') && !P.levelUnlocked(s, Lv.LEVELS, 'w1-2'), 'bad start');
  check('world 2 locked at start', !P.worldUnlocked(s, Lv.LEVELS, 1), 'open');
  const st = P.computeStats(s);
  for (const l of Lv.worldLevels(0))
    P.applyLevelResult(s, l, { win: true, shots: l.par, starsTaken: 0 }, st);
  check('world 2 opens after world 1 with enough stars', P.worldUnlocked(s, Lv.LEVELS, 1) === (P.totalStars(s, Lv.LEVELS) >= P.STAR_GATES[1]), P.totalStars(s, Lv.LEVELS));
  check('star gates fit the star supply', P.STAR_GATES.every((g, w) => g <= w * 8 * 2), P.STAR_GATES);
  check('tricks unlock with their base level', P.trickUnlocked(s, Lv.TRICKS[0]) && !P.trickUnlocked(s, Lv.TRICKS[Lv.TRICKS.length - 1]), 'bad trick unlock');
}

/* daily */
{
  const s = P.defaultSave();
  const st = P.computeStats(s);
  const lvl = Object.assign({}, Lv.LEVELS[0], { stars: [[1, 1]] });
  const a = P.applyDailyResult(s, '2026-01-02', { win: true, shots: 1, starsTaken: 1 }, lvl, st);
  const b = P.applyDailyResult(s, '2026-01-02', { win: true, shots: 1, starsTaken: 1 }, lvl, st);
  const c = P.applyDailyResult(s, '2026-01-03', { win: true, shots: 1, starsTaken: 0 }, lvl, st);
  check('daily pays once per day', a.coins > 0 && b.coins === 0 && c.coins > 0, [a.coins, b.coins, c.coins].join(','));
}

/* migration */
{
  check('null save is default', JSON.stringify(P.migrate(null)) === JSON.stringify(P.defaultSave()), 'differs');
  check('old version starts fresh', P.migrate({ version: 1, coins: 50 }).coins === 0, 'kept v1');
  const m = P.migrate({ version: 2, coins: '42', tree: { power: 9, bogus: 3 }, skin: 'gold', levels: { 'w1-1': { stars: [1, 0, 1], best: 2 } } });
  check('migrate clamps and filters', m.coins === 42 && m.tree.power === 3 && !('bogus' in m.tree) && m.skin === 'steel' && m.levels['w1-1'].stars[2] === true, JSON.stringify(m));
  const round = P.migrate(JSON.parse(JSON.stringify(save)));
  check('a full save survives a round trip', JSON.stringify(round.tree) === JSON.stringify(save.tree), 'tree changed');
}

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
