'use strict';

/* Progression maths: tech tree states, costs, prerequisites and derived stats; difficulty growing
   with the maze number and Zen staying gentle; shard payouts; the high-score table; cosmetics
   shop and unlock sync; daily quests; the play streak; achievements and their rewards. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/save.js');
const { check, done } = H;
const R = NS.rules;
const { TREE, TREE_BY_ID } = NS.treeData;

const p = R.freshProfile();
check('a fresh profile starts with the classic skin and no shards', p.skins.join() === 'classic' && p.shards === 0);
check('root nodes are too expensive at first', R.nodeState(p, 'a_speed') === 'expensive');
check('nodes with prerequisites are locked', R.nodeState(p, 'a_tunnel') === 'locked');
p.shards = 10000;
check('buying a node takes its cost', R.buyNode(p, 'a_speed') && p.shards === 10000 - 40 && R.nodeLevel(p, 'a_speed') === 1);
check('the next level costs more', R.nodeCost(p, 'a_speed') === 90);
check('a met prerequisite unlocks the child', R.nodeState(p, 'a_tunnel') === 'available');
check('locked nodes cannot be bought', !R.buyNode(p, 'f_mult'));
let total = 0;
for (const n of TREE) total += n.costs.reduce((a, b) => a + b, 0);
for (let pass = 0; pass < 6; ++pass) for (const n of TREE) while (R.buyNode(p, n.id)) {}
check('the whole tree can be bought in prerequisite order', TREE.every(n => R.nodeState(p, n.id) === 'maxed'));
check('the whole tree costs what its levels add up to', 10000 - p.shards === total, 10000 - p.shards + ' vs ' + total);
check('maxed nodes cannot be bought again', !R.buyNode(p, 'a_speed'));
const st = R.computeStats(p), st0 = R.computeStats(R.freshProfile());
check('stats start at their base values', st0.speed === 1 && st0.lives === 3 && st0.multCap === 5 && !st0.revive && st0.powerRate === 1);
check('a full tree improves every stat', st.speed > 1.08 && st.lives === 5 && st.multCap === 8 && st.revive && st.powerRate < 0.7 && st.frightBonus === 3 && st.lifeEvery === 8000);
check('every node has text for each level', TREE.every(n => n.costs.every((c, i) => typeof n.text(i + 1) === 'string' && n.text(i + 1).length > 3)));

/* difficulty */
const a0 = R.levelConfig('arcade', 0, []), a12 = R.levelConfig('arcade', 12, []), z12 = R.levelConfig('zen', 12, []);
check('ghosts get faster and fright shorter with the maze number', a12.ghostSpeed > a0.ghostSpeed && a12.frightTime < a0.frightTime);
check('Zen ghosts stay slow with long fright and no Elroy', z12.ghostSpeed < a0.ghostSpeed && z12.frightTime >= 8 && z12.elroy === 0);
check('ghosts never outrun Pac-Man by much', R.levelConfig('arcade', 40, []).ghostSpeed < R.levelConfig('arcade', 40, []).pacSpeed * 1.05);
check('modifiers change the rules', R.levelConfig('daily', 0, ['turbo', 'glass']).scoreMul === 3 && R.levelConfig('daily', 0, ['swarm']).extraGhosts === 2 && R.levelConfig('daily', 0, ['dark']).dark);

/* shards and scores */
check('shards grow with score and mazes', R.shardsForRun('arcade', 10000, 3, st0) === 68 && R.shardsForRun('arcade', 10000, 3, { shardBonus: 1.45 }) === 98);
const q = R.freshProfile();
for (let i = 1; i <= 12; ++i) R.addHighScore(q, { score: i * 100, mode: 'arcade', detail: 'x' });
check('the table keeps the best ten in order', q.highScores.length === 10 && q.highScores[0].score === 1200 && q.highScores[9].score === 300);
check('a low score does not rank', R.addHighScore(q, { score: 50, mode: 'arcade' }) === -1);
check('a top score ranks first', R.addHighScore(q, { score: 5000, mode: 'daily' }) === 0);

/* cosmetics */
const c = R.freshProfile();
check('shop items need shards', !R.buyCosmetic(c, 'skin', 'bow'));
c.shards = 500;
check('buying a skin takes shards and owns it', R.buyCosmetic(c, 'skin', 'bow') && c.shards === 380 && R.owns(c, 'skin', 'bow'));
check('event and trophy skins cannot be bought', !R.buyCosmetic(c, 'skin', 'pumpkin') && !R.buyCosmetic(c, 'skin', 'ninja'));
c.achievements.ghost100 = true;
c.story.reached = 5;
const got = R.syncUnlocks(c).map(g => g.item.id);
check('trophies and story progress unlock their cosmetics', got.indexOf('ninja') >= 0 && got.indexOf('king') >= 0);

/* quests */
const k1 = R.dailyQuests('2026-11-05'), k2 = R.dailyQuests('2026-11-05'), k3 = R.dailyQuests('2026-11-06');
check('the same day gives the same three distinct quests', JSON.stringify(k1) === JSON.stringify(k2) && new Set(k1.map(x => x.id)).size === 3);
check('another day gives other quests', JSON.stringify(k1) !== JSON.stringify(k3));
const d = R.freshProfile();
R.refreshQuests(d, '2026-11-05');
const quest = d.quests.list[0];
const target = R.questTarget(quest);
R.bump(d, NS.goals.QUESTS.find(t => t.id === quest.id).stat, target);
const before = d.shards;
const doneList = R.checkQuests(d);
check('a met quest completes once and pays', doneList.length >= 1 && d.shards > before && R.checkQuests(d).length === 0);
R.refreshQuests(d, '2026-11-06');
check('a new day resets quests and counters', d.quests.key === '2026-11-06' && !d.quests.list.some(x => x.done) && Object.keys(d.quests.counts).length === 0);

/* streak */
const s = R.freshProfile();
const b1 = R.touchStreak(s, 1000), b1b = R.touchStreak(s, 1000), b2 = R.touchStreak(s, 1001), b3 = R.touchStreak(s, 1002);
check('the first play of a day pays the streak bonus once', b1 === 20 && b1b === 0);
check('consecutive days grow the bonus', b2 === 30 && b3 === 40 && s.streak.count === 3 && s.stats.bestStreak === 3);
R.touchStreak(s, 1005);
check('a missed day restarts the streak', s.streak.count === 1 && s.stats.bestStreak === 3);
for (let i = 0; i < 12; ++i) R.touchStreak(s, 1006 + i);
check('the bonus is capped at a week', R.touchStreak(s, 1018) === 80);

/* achievements */
const a = R.freshProfile();
a.stats.ghosts = 150;
const ach = R.checkAchievements(a).map(x => x.id);
check('stat achievements unlock with their rewards', ach.indexOf('ghost1') >= 0 && ach.indexOf('ghost100') >= 0 && a.shards === 115);
check('achievements unlock only once', R.checkAchievements(a).length === 0);
check('feats unlock by name once', R.feat(a, 'quad') && !R.feat(a, 'quad'));
for (const pw of NS.items.POWERUPS) a.used[pw.id] = true;
check('using every power-up unlocks Collector', R.checkAchievements(a).some(x => x.id === 'allpower'));

done();
