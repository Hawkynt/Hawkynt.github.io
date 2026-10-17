'use strict';

global.window = {};
const fs = require('fs');
require('../progression.js');

const P = window.SZ.PlatformerProgress;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!P && Object.isFrozen(P), 'SZ.PlatformerProgress missing or not frozen');
check('no DOM or storage use', !/document|localStorage/.test(fs.readFileSync(require.resolve('../progression.js'), 'utf8')), 'touches DOM/storage');

/* tree data */
const ids = new Set(P.TREE.map(n => n.id));
check('tree node ids unique', ids.size === P.TREE.length, 'duplicates');
check('five branches with nodes', P.BRANCH_ORDER.every(b => P.TREE.some(n => n.branch === b)), 'empty branch');
check('every requirement exists', P.TREE.every(n => n.req.every(r => ids.has(r[0]) && r[1] >= 1 && r[1] <= P.TREE_BY_ID[r[0]].costs.length)), 'bad req');
check('a description per level', P.TREE.every(n => n.desc.length === n.costs.length), 'desc count mismatch');
check('costs rise within a node', P.TREE.every(n => n.costs.every((c, i) => i === 0 || c.coins > n.costs[i - 1].coins)), 'non-rising costs');
/* requirements form no cycle */
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
check('base move set is plain', !base.wallJump && !base.doubleJump && base.dash === 0 && base.airControl === 0, JSON.stringify(base));
check('three hearts to start', base.maxHearts === 3, base.maxHearts);
check('coin multiplier 1', base.coinMul === 1, base.coinMul);

/* buying */
check('locked node reports locked', P.nodeState(save, 'dash') === 'locked', P.nodeState(save, 'dash'));
check('expensive when broke', P.nodeState(save, 'wallJump') === 'expensive', P.nodeState(save, 'wallJump'));
save.coins = 5000;
save.gems = 50;
check('buy wall kick', P.buy(save, 'wallJump') && save.coins === 5000 - 120, 'coins ' + save.coins);
check('dash unlocked by wall kick', P.nodeState(save, 'dash') === 'available', P.nodeState(save, 'dash'));
check('buy dash I', P.buy(save, 'dash') && save.gems === 49, 'gems ' + save.gems);
check('buy dash II', P.buy(save, 'dash') && P.level(save, 'dash') === 2, P.level(save, 'dash'));
check('dash maxed', P.nodeState(save, 'dash') === 'maxed' && !P.buy(save, 'dash'), P.nodeState(save, 'dash'));
P.buy(save, 'hearts'); P.buy(save, 'hearts'); P.buy(save, 'coinBonus'); P.buy(save, 'magnet');
const st = P.computeStats(save);
check('stats follow the tree', st.wallJump && st.dash === 2 && st.maxHearts === 5 && st.coinMul === 1.25 && st.magnet === 2, JSON.stringify(st));
const pr = P.treeProgress(save);
check('tree progress', pr.have === 7 && pr.total === P.TREE.reduce((a, n) => a + n.costs.length, 0), JSON.stringify(pr));

/* cosmetics */
check('classic skin owned', P.skinOwned(save, 'classic'), 'classic not owned');
check('forest skin needs its node', !P.skinOwned(save, 'forest'), 'forest owned for free');
P.buy(save, 'skinForest');
check('forest skin bought', P.skinOwned(save, 'forest'), 'forest not owned');
check('no trail always owned', P.trailOwned(save, 'none') && !P.trailOwned(save, 'shadow'), 'trail ownership');

/* completing levels */
const s2 = P.defaultSave();
const r1 = P.completeLevel(s2, 'w0l0', 30, { coins: 40, gems: [true, false, true], time: 42 });
check('first clear pays bonus', r1.firstClear && s2.coins === 40 + 50 + 25 && s2.gems === 2, 'coins ' + s2.coins + ' gems ' + s2.gems);
check('stars: finish only', r1.stars.join() === 'true,false,false', r1.stars.join());
const r2 = P.completeLevel(s2, 'w0l0', 30, { coins: 10, gems: [false, true, false], time: 25 });
check('gems accumulate across runs', r2.stars[1] && r2.newGems === 1, JSON.stringify(r2));
check('time star', r2.stars[2] && r2.newBest, JSON.stringify(r2));
check('three stars counted', P.totalStars(s2) === 3, P.totalStars(s2));
const r3 = P.completeLevel(s2, 'w0l0', 30, { coins: 5, gems: [true, true, true], time: 50 });
check('no double gem payout', r3.newGems === 0 && r3.bonus === 0 && !r3.newBest, JSON.stringify(r3));
check('unlocks', P.levelUnlocked(s2, 0, 1) && !P.levelUnlocked(s2, 0, 2) && !P.worldUnlocked(s2, 1), 'unlock logic');
s2.levels.w0l5 = { done: true, gems: [false, false, false], bestTime: 60, timeStar: false, ghost: '' };
check('world unlocks after its boss', P.worldUnlocked(s2, 1), 'world 1 locked');

/* migration */
const m = P.migrate(JSON.parse(JSON.stringify(s2)));
check('save round-trips', JSON.stringify(m.levels) === JSON.stringify(s2.levels) && m.coins === s2.coins, 'mismatch');
check('junk migrates to defaults', JSON.stringify(P.migrate({ version: 1, coins: 999 })) === JSON.stringify(P.defaultSave()), 'v1 not reset');
check('bad values sanitised', P.migrate({ version: 2, coins: -5, tree: { dash: 99, bogus: 3 }, skin: 'nope' }).tree.dash === 2, 'not clamped');

/* ghosts */
const samples = [];
for (let i = 0; i < 400; ++i)
  samples.push({ x: 100 + i * 15.6, y: 600 - Math.abs(Math.sin(i / 10)) * 160, pose: P.POSES[i % P.POSES.length], facing: i % 7 ? 1 : -1 });
const enc = P.encodeGhost(samples);
const dec = P.decodeGhost(enc);
let maxErr = 0;
for (let i = 0; i < samples.length; ++i)
  maxErr = Math.max(maxErr, Math.abs(dec[i].x - samples[i].x), Math.abs(dec[i].y - samples[i].y));
check('ghost round-trip', dec.length === samples.length && maxErr <= 1 && dec[5].pose === samples[5].pose && dec[7].facing === -1, 'err ' + maxErr + ' len ' + dec.length);
check('ghost is compact', enc.length < samples.length * 6, enc.length + ' chars');
const g = P.ghostAt(dec, 1.025, {});
check('ghost interpolates', g && Math.abs(g.x - (dec[20].x + dec[21].x) / 2) < 1, JSON.stringify(g));
check('empty ghost decodes', P.decodeGhost('').length === 0 && P.decodeGhost('junk').length === 0, 'junk decoded');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
