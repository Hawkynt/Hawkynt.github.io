'use strict';

/* Progression math: tech tree costs, states, purchases and derived perks; story unlocks and
   stars; gem payouts; ranks; cosmetics; achievements; streaks; quests; the event track; score
   tables and the combo multiplier. */
const H = require('./harness');
H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load('core/save.js');
const { check, done } = H;
const R = NS.rules;
const M = NS.meta;

let s = R.freshSave();
check('a fresh save has no gems and the classic looks', s.gems === 0 && s.equip.skin === 'classic' && s.owned.bomb[0] === 'classic');
check('the tree has 25 nodes in 5 branches', M.TREE.length === 25 && M.BRANCHES.length === 5);
check('every prerequisite exists and every node has values per level', M.TREE.every(n => n.req.every(r => M.TREE_BY_ID[r[0]]) && n.values.length === n.costs.length));
check('root nodes are expensive without gems', R.nodeState(s, 'a_bombs') === 'expensive');
check('nodes with prerequisites start locked', R.nodeState(s, 'a_fuse') === 'locked');
s.gems = 1000;
check('buying a root node works', R.buyNode(s, 'a_bombs') && s.tree.a_bombs === 1 && s.gems === 960);
check('a bought prerequisite unlocks its child', R.nodeState(s, 'a_fuse') === 'available');
check('level two costs the second price', R.nodeCost(s, 'a_bombs') === 140);
R.buyNode(s, 'a_bombs'); R.buyNode(s, 'a_bombs');
check('a maxed node cannot be bought again', R.nodeState(s, 'a_bombs') === 'maxed' && !R.buyNode(s, 'a_bombs'));
check('tree levels are counted for the achievement', s.stats.treeLevels === 3);
let P = R.computePerks(s);
check('Bomb Bag 3 gives four starting bombs', P.bombs === 4);
check('defaults: fire 2, three lives, no mega bomb', P.fire === 2 && P.lives === 3 && !P.mega);
s.gems = 5000;
for (const id of ['a_fire', 'a_fuse', 'a_fuse', 'a_chain', 'a_super', 'g_life', 'f_gems']) R.buyNode(s, id);
P = R.computePerks(s);
check('Quick Fuse 2 shortens the fuse by 0.6 s', Math.abs(P.fuse - (NS.constants.FUSE - 0.6)) < 1e-9);
check('the fuse never drops below the minimum', P.fuse >= NS.constants.FUSE_MIN);
check('Mega Bomb unlocks with both prerequisites', P.mega === true);
check('Extra Heart adds a life, Gem Polish 20%', P.lives === 4 && Math.abs(P.gemMult - 1.2) < 1e-9);
check('node text fills in the level value', R.nodeText(M.TREE_BY_ID.f_gems, 2) === '+40% gems from everything');

/* story */
s = R.freshSave();
check('only 1-1 is open at first', R.levelUnlocked(s, 0, 0) && !R.levelUnlocked(s, 0, 1) && !R.worldUnlocked(s, 1));
check('three stars: clear, unhurt, under par', R.starRating({ hurt: false, time: 50, par: 60 }) === 3 && R.starRating({ hurt: true, time: 70, par: 60 }) === 1 && R.starRating({ hurt: true, time: 50, par: 60 }) === 2);
check('recording stars reports the gain', R.recordStars(s, 0, 0, 2) === 2 && R.recordStars(s, 0, 0, 1) === 0 && R.recordStars(s, 0, 0, 3) === 1);
check('the next stage opens after a clear', R.levelUnlocked(s, 0, 1));
for (let l = 0; l < 7; ++l) R.recordStars(s, 0, l, 3);
check('clearing the boss opens the next world', R.worldUnlocked(s, 1) && R.worldsCleared(s) === 1 && s.stats.worlds === 1);
check('next stage points into world 2', R.nextStage(s).world === 1 && R.nextStage(s).level === 0);
check('stars are totalled', R.totalStars(s) === 21 && s.stats.stars === 21);
check('world unlocks grant cosmetics', R.unlockEarned(s).some(u => u.item.id === 'nova') && R.owns(s, 'skin', 'nova'));

/* economy and ranks */
check('gem payouts apply the perk and the Gold Rush modifier', R.gemPayout(100, { gemMult: 1.4 }, ['rich']) === 280 && R.gemPayout(10, null, null) === 10);
check('story rewards grow with the world and new stars', R.stageReward('story', 4, 3, true) > R.stageReward('story', 0, 1, false));
check('ranks rise with XP', R.rankOf(0).name === 'Spark' && R.rankOf(8000).name === 'Firecracker' && R.rankOf(1e9).max);
check('combo multiplier: x1, x2 at 2, capped at x8', R.comboMultiplier(1) === 1 && R.comboMultiplier(2) === 2 && R.comboMultiplier(99) === 8);

/* cosmetics */
s = R.freshSave();
check('buying a skin needs gems', !R.buyCosmetic(s, 'skin', 'ninja'));
s.gems = 500;
check('buying a skin spends gems and owns it', R.buyCosmetic(s, 'skin', 'ninja') && s.gems === 100 && R.equip(s, 'skin', 'ninja') && s.equip.skin === 'ninja');
check('event skins cannot be bought', !R.buyCosmetic(s, 'skin', 'pumpkin'));
check('unowned looks cannot be equipped', !R.equip(s, 'skin', 'gold'));

/* achievements */
s = R.freshSave();
s.stats.kills = 120; s.stats.bestChain = 5;
const got = R.checkAchievements(s);
check('achievements pay once', got.length === 4 && R.checkAchievements(s).length === 0, got.map(a => a.id).join());
check('the Skull bomb unlocks through Domino Master', R.unlockEarned(s).some(u => u.item.id === 'skull'));

/* streak */
s = R.freshSave();
check('the first day pays 10', R.touchStreak(s, 100) === 10 && s.streak.count === 1);
check('the same day pays nothing more', R.touchStreak(s, 100) === 0);
check('consecutive days grow the streak', R.touchStreak(s, 101) === 20 && R.touchStreak(s, 102) === 30 && s.stats.streakBest === 3);
check('a missed day resets it', R.touchStreak(s, 104) === 10 && s.streak.count === 1 && s.stats.streakBest === 3);

/* quests */
s = R.freshSave();
check('three quests are rolled per day', R.rollQuests(s, '2026-11-05') && s.quests.list.length === 3 && !R.rollQuests(s, '2026-11-05'));
const ids = s.quests.list.map(q => q.id).join();
const s2 = R.freshSave(); R.rollQuests(s2, '2026-11-05');
check('the same day gives everyone the same quests', s2.quests.list.map(q => q.id).join() === ids);
const q = s.quests.list[0];
check('a quest cannot be claimed early', R.claimQuest(s, 0) === 0);
s.stats[q.stat] += q.goal;
const before = s.gems;
check('a finished quest pays and is marked', R.claimQuest(s, 0) === q.gems && s.gems === before + q.gems && R.claimQuest(s, 0) === 0);
check('another day brings new quests', R.rollQuests(s, '2026-11-06') && s.quests.day === '2026-11-06');

/* event track */
s = R.freshSave();
R.syncEvent(s, 'autumn-2026');
s.event.tokens = 30;
check('tier 1 pays gems', R.claimTier(s, 'autumn', 0).gems === 60 && s.gems === 60);
check('tier 2 gives the season bomb', R.claimTier(s, 'autumn', 1).item.id === 'pumpkin' && R.owns(s, 'bomb', 'pumpkin'));
check('a tier above the tokens stays locked', R.claimTier(s, 'autumn', 2) === null);
check('a claimed tier cannot be claimed twice', R.claimTier(s, 'autumn', 0) === null);
R.syncEvent(s, 'winter-2026');
check('a new season resets the track but keeps prizes', s.event.tokens === 0 && s.event.claimed.length === 0 && R.owns(s, 'bomb', 'pumpkin'));
check('every season has a skin, a bomb and a trail prize', NS.meta.SEASONS.every(se => ['skin', 'bomb', 'trail'].every(k => R.catalog(k).some(x => x.unlock.type === 'event' && x.unlock.season === se.id))));

/* scores */
s = R.freshSave();
for (let i = 0; i < 12; ++i) R.addScore(s, 'arcade', i * 100, i, 'd');
check('score tables keep the best ten in order', s.scores.arcade.length === 10 && s.scores.arcade[0].score === 1100 && s.scores.arcade[9].score === 200);
check('a new entry reports its rank', R.addScore(s, 'arcade', 5000, 3, 'x') === 0);

done();
