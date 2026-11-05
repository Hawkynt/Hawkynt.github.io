'use strict';

/* Progression math: tech tree costs, states, prerequisites and the stats they produce; cosmetics
   buying and equipping; scoring, combo multipliers, rock hit points; story stars, rewards and
   unlock order; arcade wave growth; achievements and earned cosmetics. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules;
const { TREE, TREE_BY_ID, BRANCHES } = NS.treeData;
const C = NS.constants;

/* tree data */
check('29 tree nodes in five branches', TREE.length === 29 && BRANCHES.length === 5);
check('every prerequisite names a real node and a reachable level', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]] && r[1] <= TREE_BY_ID[r[0]].costs.length)));
check('costs rise level by level', TREE.every(n => n.costs.every((c, i) => i === 0 || c > n.costs[i - 1])));
let levels = 0, total = 0;
for (const n of TREE) { levels += n.costs.length; total += n.costs.reduce((a, b) => a + b, 0); }
check('the whole tree is a long-term goal (over 30,000 stardust)', total > 30000, total);

const s = R.defaultSave();
check('a fresh save has no stardust and stock stats', s.dust === 0 && R.computeStats(s).dmg === 1 && R.computeStats(s).lives === 3);
check('roots are expensive without stardust', R.nodeState(s, 'c_dmg') === 'expensive');
check('children are locked', R.nodeState(s, 'c_cap') === 'locked');
s.dust = 10000;
check('buying a root works and charges its cost', R.buyNode(s, 'c_dmg') && s.dust === 10000 - 60 && R.nodeLevel(s, 'c_dmg') === 1);
check('the child opens', R.nodeState(s, 'c_cap') === 'available');
check('a locked node cannot be bought', !R.buyNode(s, 'c_twin'));
for (let i = 0; i < 4; ++i) R.buyNode(s, 'c_dmg');
check('a node stops at its last level', R.nodeState(s, 'c_dmg') === 'maxed' && !R.buyNode(s, 'c_dmg') && R.nodeLevel(s, 'c_dmg') === 5);
let st = R.computeStats(s);
check('five damage levels give +75% damage', Math.abs(st.dmg - 1.75) < 1e-9);
R.buyNode(s, 'h_hyper'); R.buyNode(s, 'h_invuln'); R.buyNode(s, 'h_hyper');
st = R.computeStats(s);
check('jump tuning shortens the hyperspace cooldown multiplicatively', Math.abs(st.hyperCd - C.HYPER_CD * (1 - 0.15)) < 1e-9);
R.buyNode(s, 's_magnet');
check('tractor coils widen the pickup reach', Math.abs(R.computeStats(s).magnet - 90 * 1.4) < 1e-9);
check('node text shows percent and value', R.nodeText(TREE_BY_ID.c_dmg, 2) === '+30% shot damage' && R.nodeText(TREE_BY_ID.h_life, 1) === '+1 ship per run');

/* cosmetics */
const c2 = R.defaultSave();
check('two skins are free', R.owns(c2, 'skin', 'kestrel') && R.owns(c2, 'skin', 'vector'));
check('a dust skin cannot be bought while poor', !R.buyCosmetic(c2, 'skin', 'crimson'));
c2.dust = 500;
check('buying a dust skin works and charges it', R.buyCosmetic(c2, 'skin', 'crimson') && c2.dust === 100 && R.owns(c2, 'skin', 'crimson'));
check('an unowned skin cannot be equipped', !R.equip(c2, 'skin', 'gilded') && R.equip(c2, 'skin', 'crimson') && c2.look.skin === 'crimson');
check('achievement skins are not for sale', !R.buyCosmetic(c2, 'skin', 'gilded'));

/* scoring */
check('combo multiplier climbs every six kills to x8', R.comboMult(0) === 1 && R.comboMult(6) === 2 && R.comboMult(30) === 6 && R.comboMult(500) === 8);
check('small rocks score most, types multiply', R.rockScore('normal', 1) === 100 && R.rockScore('normal', 3) === 20 && R.rockScore('gold', 1) === 500);
check('rock hit points scale with size', R.rockHp('normal', 1) === 1 && R.rockHp('crystal', 3) === 5 && R.rockHp('iron', 4) === 8);

/* story */
const L = { par: 60 };
check('stars: clear, flawless, under par', R.starsFor(L, { lost: 0, time: 50 }) === 3 && R.starsFor(L, { lost: 1, time: 50 }) === 2 && R.starsFor(L, { lost: 2, time: 90 }) === 1);
check('first clears pay double', R.levelDust(0, 3, true) === 2 * R.levelDust(0, 3, false));
const p = R.defaultSave();
check('only the first mission is open at first', R.levelOpen(p, 0, 0) && !R.levelOpen(p, 0, 1) && !R.levelOpen(p, 1, 0));
for (let l = 0; l < 6; ++l) p.stars['1-' + (l + 1)] = 1;
check('finishing a chapter opens the next', R.levelOpen(p, 1, 0) && R.chaptersDone(p) === 1 && R.totalStars(p) === 6);

/* arcade */
const rng = NS.rng.makeRng(5);
const w1 = R.arcadeWave(1, rng), w12 = R.arcadeWave(12, rng), w8 = R.arcadeWave(8, rng);
check('waves grow', w12.rocks.length > w1.rocks.length && w12.speed > w1.speed && w12.foes.max > w1.foes.max);
check('a titan every eighth wave', w8.boss === 'glacier' && !w1.boss && R.arcadeWave(16, rng).boss === 'wyrm');
check('a colossus every fifth wave', R.arcadeWave(5, rng).rocks.some(g => g[1] === 4));
check('wave one only uses plain rocks', w1.rocks.every(g => g[0] === 'normal'));
check('Iron Rain turns plain rocks to iron', R.arcadeWave(3, NS.rng.makeRng(1), ['ironRain']).rocks.every(g => g[0] !== 'normal'));

/* achievements */
const a = R.defaultSave();
a.stats.rocks = 150;
const got = R.newAchievements(a);
check('reaching a goal earns its achievements once', got.map(x => x.id).join() === 'first,rocks100' && R.newAchievements(a).length === 0);
a.ach.combo50 = true;
const cos = R.earnedCosmetics(a);
check('an achievement unlocks its cosmetic', cos.some(x => x.item.id === 'comet') && R.owns(a, 'skin', 'comet'));
check('35 achievements', NS.goalData.ACHIEVEMENTS.length === 35 && new Set(NS.goalData.ACHIEVEMENTS.map(x => x.id)).size === 35);

/* high scores */
const hs = R.defaultSave();
for (let i = 0; i < 12; ++i) R.addHighScore(hs, { score: (i + 1) * 100, wave: i, mode: 'arcade', date: '' });
check('the table keeps the best ten in order', hs.highScores.length === 10 && hs.highScores[0].score === 1200 && hs.highScores[9].score === 300);
check('a low score does not enter', R.addHighScore(hs, { score: 5, wave: 1, mode: 'arcade' }) === -1);
done();
