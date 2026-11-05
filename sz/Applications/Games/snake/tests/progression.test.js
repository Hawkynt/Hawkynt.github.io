'use strict';

/* Progression maths and calendar logic: tech tree costs, prerequisites, states and the stats they
   add up to; combo multipliers, fruit scores, stars and scale rewards; story unlocks; cosmetic
   unlock rules; the daily streak; daily quests; festival seasons, event ids, reward tracks, the
   weekly mutator and the Daily Garden recipe. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules;
const S = NS.seasons;
const { TREE, TREE_BY_ID, BRANCHES } = NS.treeData;
const C = NS.constants;

/* ── tech tree ── */
let save = R.defaultSave();
check('tree has 5 branches and 25 nodes', BRANCHES.length === 5 && TREE.length === 25);
let reqOk = true, slots = {};
for (const n of TREE) {
  for (const r of n.req) if (!TREE_BY_ID[r[0]] || r[1] > TREE_BY_ID[r[0]].costs.length) reqOk = false;
  const key = n.branch + ':' + n.row + ':' + n.lane;
  if (slots[key]) reqOk = false;
  slots[key] = 1;
}
check('every prerequisite exists and no two nodes share a slot', reqOk);
check('a fresh node with no money is too expensive', R.nodeState(save, 'hide') === 'expensive');
check('a node behind a prerequisite is locked', R.nodeState(save, 'lives') === 'locked');
save.scales = 1000;
check('buying spends the cost', R.buyNode(save, 'hide') && save.scales === 920 && R.nodeLevel(save, 'hide') === 1);
check('the next level costs more', R.nodeCost(save, 'hide') === 240);
check('the prerequisite now unlocks the next node', R.nodeState(save, 'lives') === 'available');
R.buyNode(save, 'hide');
check('a maxed node cannot be bought again', R.nodeState(save, 'hide') === 'maxed' && !R.buyNode(save, 'hide'));
let st = R.computeStats(save);
check('stats add up from node levels', st.shields === 2 && st.lives === 0);
save.tree.collector = 3;
save.tree.last = 2;
st = R.computeStats(save);
check('percentage stats scale per level', Math.abs(st.scaleBonus - 0.3) < 1e-9 && Math.abs(st.duration - 0.3) < 1e-9);
check('node text fills values and percentages', R.nodeText(TREE_BY_ID.collector, 3) === '+30% scales from every run' && R.nodeText(TREE_BY_ID.hide, 2) === 'Start every level with 2 Scale Armor');
check('tree levels are counted', R.treeLevels(save) === 7);

/* ── scoring ── */
check('combo multiplier steps every 3 fruit', R.comboMultiplier(0) === 1 && R.comboMultiplier(2) === 1 && R.comboMultiplier(3) === 1.5 && R.comboMultiplier(6) === 2);
check('combo multiplier is capped, the tree raises the cap', R.comboMultiplier(99) === C.COMBO_CAP && R.comboMultiplier(99, 2) === C.COMBO_CAP + 2);
check('fruit score uses value and multiplier', R.fruitScore(2, 1.5, 4, 0) === 30);
check('Thrive adds per segment beyond the start length', R.fruitScore(1, 1, 14, 0.02) === Math.round(10 * 1.2));
check('stars: clear, eggs, no crash', JSON.stringify(R.levelStars(true, 3, 3, 0)) === '[true,true,true]' && JSON.stringify(R.levelStars(true, 2, 3, 1)) === '[true,false,false]' && JSON.stringify(R.levelStars(false, 3, 3, 0)) === '[false,false,false]');
const sc1 = R.scalesForRun({ score: 1200, gems: 3, cleared: true, newStars: 2, boss: false, mode: 'story' }, { scaleBonus: 0 }, 1);
check('scale reward: score, gems, clear and new stars', sc1 === 10 + 3 + 8 + 12, sc1);
check('scale bonus and mutators multiply', R.scalesForRun({ score: 1200, gems: 0, mode: 'arcade' }, { scaleBonus: 0.5 }, 2) === 30);

/* ── story ── */
save = R.defaultSave();
check('only 1-1 is open at first', R.levelUnlocked(save, 0, 0) && !R.levelUnlocked(save, 0, 1) && !R.worldUnlocked(save, 1));
let fresh = R.recordLevel(save, 0, 0, [true, false, true], 500);
check('recording a level counts new stars', fresh === 2 && R.totalStars(save) === 2 && R.levelUnlocked(save, 0, 1));
fresh = R.recordLevel(save, 0, 0, [true, true, false], 300);
check('stars merge and the best score stays', fresh === 1 && R.levelRecord(save, 0, 0).best === 500 && R.totalStars(save) === 3);
for (let l = 1; l < 6; ++l) R.recordLevel(save, 0, l, [true, false, false], 10);
check('clearing a world opens the next', R.worldUnlocked(save, 1) && R.nextStoryLevel(save).w === 1);
check('world stars are summed', R.worldStars(save, 0) === 8);

/* ── cosmetics ── */
save = R.defaultSave();
const coral = NS.cosmetics.find('skin', 'coral');
check('a priced skin is buyable, not owned', !R.unlockInfo(save, 'skin', coral).owned && R.unlockInfo(save, 'skin', coral).buyable);
check('buying needs the scales', !R.buyCosmetic(save, 'skin', 'coral'));
save.scales = 500;
check('buying a skin spends scales and owns it', R.buyCosmetic(save, 'skin', 'coral') && save.scales === 350 && save.owned.skin.coral);
save.story.freed.push('mole');
let got = R.refreshUnlocks(save);
check('freeing a guardian unlocks its reward', got.some(g => g.item.id === 'crown') && save.owned.hat.crown);
check('festival items are never granted by refreshUnlocks', !save.owned.skin.maple);

/* ── streak ── */
save = R.defaultSave();
check('first day gives the first gift', R.touchStreak(save, '2026-11-05', {}) === 15 && save.streak.count === 1);
check('the same day gives nothing more', R.touchStreak(save, '2026-11-05', {}) === 0);
check('the next day continues the streak', R.touchStreak(save, '2026-11-06', {}) === 20 && save.streak.count === 2);
R.touchStreak(save, '2026-11-07', {});
check('a gap resets the streak', R.touchStreak(save, '2026-11-10', {}) === 15 && save.streak.count === 1 && save.stats.bestStreak === 3);
check('streaks cross month and year ends', (() => { const s = R.defaultSave(); R.touchStreak(s, '2026-12-31', {}); R.touchStreak(s, '2027-01-01', {}); return s.streak.count === 2; })());
check('Loyal Heart raises the gift', R.touchStreak(R.defaultSave(), '2026-01-01', { streakBonus: 0.5 }) === 23);

/* ── quests ── */
save = R.defaultSave();
R.ensureQuests(save, '2026-11-05');
const ids = save.quests.list.map(q => q.id).join();
const again = R.defaultSave();
R.ensureQuests(again, '2026-11-05');
check('three different quests, the same for the same day', save.quests.list.length === 3 && new Set(save.quests.list.map(q => q.id)).size === 3 && again.quests.list.map(q => q.id).join() === ids);
let differ = 0;
for (let d = 1; d <= 20; ++d) {
  const s = R.defaultSave();
  R.ensureQuests(s, '2026-12-' + (d < 10 ? '0' : '') + d);
  if (s.quests.list.map(q => q.id).join() !== ids) ++differ;
}
check('quests change from day to day', differ >= 15, differ);
save.quests.list = [{ id: 'eat', n: 5, progress: 0, done: false }, { id: 'combo', n: 6, progress: 0, done: false }, { id: 'zen', n: 2, progress: 0, done: false }];
let doneQ = R.questFeed(save, 'fruit', 3, false);
check('sum quests add up', save.quests.list[0].progress === 3 && !doneQ.length);
doneQ = R.questFeed(save, 'fruit', 4, false);
check('a quest completes once and reports its reward', doneQ.length === 1 && doneQ[0].reward === 30 && save.quests.list[0].done && R.questFeed(save, 'fruit', 9, false).length === 0);
R.questFeed(save, 'bestCombo', 4, true);
R.questFeed(save, 'bestCombo', 2, true);
check('max quests keep the best value', save.quests.list[1].progress === 4);
R.questFeed(save, 'zenTime', 90, false);
check('zen minutes count seconds', save.quests.list[2].progress === 1.5);

/* ── seasons ── */
const at = (s) => new Date(s + 'T12:00:00');
const cases = [['2026-01-03', 'starfall'], ['2026-01-07', 'frost'], ['2026-02-28', 'frost'], ['2026-03-01', 'bloom'], ['2026-05-31', 'bloom'],
  ['2026-06-01', 'sunfest'], ['2026-08-31', 'sunfest'], ['2026-09-01', 'harvest'], ['2026-10-19', 'harvest'], ['2026-10-20', 'hollow'],
  ['2026-11-02', 'hollow'], ['2026-11-03', 'harvest'], ['2026-12-01', 'frost'], ['2026-12-23', 'frost'], ['2026-12-24', 'starfall']];
const wrong = cases.filter(c => S.seasonIdFor(at(c[0])) !== c[1]).map(c => c[0]);
check('festival dates (all six, both year-end edges)', wrong.length === 0, wrong.join());
check('winter festivals belong to the year they began', S.eventId(at('2027-01-03')) === 'starfall-2026' && S.eventId(at('2026-12-28')) === 'starfall-2026' && S.eventId(at('2027-02-10')) === 'frost-2026' && S.eventId(at('2026-12-05')) === 'frost-2026');
check('other festivals use their own year', S.eventId(at('2026-07-01')) === 'sunfest-2026');
check('days left counts to the festival end', S.daysLeft(at('2026-11-02')) === 1 && S.daysLeft(at('2026-10-20')) === 14);
let tierOk = true;
for (const id of S.SEASON_ORDER) {
  for (let t = 0; t < S.TIERS.length; ++t) {
    const rw = R.eventReward(id, t);
    if (rw.kind !== S.TIERS[t].kind || (rw.kind !== 'scales' && !rw.item)) tierOk = false;
  }
}
check('every festival tier has its exclusive reward', tierOk);
save = R.defaultSave();
R.eventRecord(save, 'hollow-2026').tokens = 30;
const due = R.eventTiersDue(save, 'hollow-2026');
check('reached tiers are due until claimed', due.join() === '0,1');
R.eventRecord(save, 'hollow-2026').claimed.push(0);
check('claimed tiers are not due again', R.eventTiersDue(save, 'hollow-2026').join() === '1');
check('week keys follow ISO weeks', NS.rng.weekKey(at('2026-01-01')) === '2026-W01' && NS.rng.weekKey(at('2027-01-01')) === '2026-W53' && NS.rng.weekKey(at('2026-11-05')) === '2026-W45');
const d1 = S.dailyRecipe(at('2026-11-05')), d2 = S.dailyRecipe(at('2026-11-05')), d3 = S.dailyRecipe(at('2026-11-06'));
check('the daily recipe is fixed per day with two different mutators', JSON.stringify(d1) === JSON.stringify(d2) && d1.mutators[0] !== d1.mutators[1] && d1.seed !== d3.seed);
let weeks = new Set();
for (let w = 0; w < 30; ++w) weeks.add(S.weeklyMutator(new Date(2026, 0, 1 + w * 7)).id);
check('the weekly mutator rotates', weeks.size >= 5, weeks.size);

done();
