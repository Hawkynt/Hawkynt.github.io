'use strict';

/* Progression maths: tech tree costs, prerequisites and perks; gold with the Prospector bonus;
   achievements; deterministic daily quests and their progress; play streaks across days and
   gaps; season detection by local date including the year-end wrap; the seasonal event track;
   story unlocks and stars; the daily cave seed and modifier. */
const H = require('./harness.js');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const P = NS.progression;
const M = NS.meta;

let s = P.defaultSave();
check('a new save has every stat at zero', P.STAT_KEYS.every((k) => s.stats[k] === 0));
check('tree nodes all have costs for every level', M.TREE.every((n) => n.cost.length === n.max));
check('tree has five branches and 25 nodes', M.BRANCHES.length === 5 && M.TREE.length === 25);
check('every prerequisite exists', M.TREE.every((n) => (n.req || []).every((r) => P.node(r))));

check('cannot buy without gold', P.buyBlocker(s, 'hardhat') === 'gold');
s.gold = 1000;
check('cannot skip a prerequisite', P.buyBlocker(s, 'lives') === 'locked');
check('buying spends the cost', P.buyNode(s, 'hardhat') && s.gold === 880 && s.tree.hardhat === 1);
check('a maxed node cannot be bought again', P.buyBlocker(s, 'hardhat') === 'maxed');
P.buyNode(s, 'gemvalue'); P.buyNode(s, 'gemvalue');
let pk = P.perks(s);
check('perks sum per level', pk.startShield === 1 && Math.abs(pk.gemValue - 0.2) < 1e-9);
s.tree.gold = 5;
pk = P.perks(s);
const before = s.gold;
check('prospector adds 50% gold', P.earnGold(s, pk, 100) === 150 && s.gold === before + 150);

/* achievements */
s = P.defaultSave();
P.addStat(s, 'gems', 120);
let got = P.checkAchievements(s, P.perks(s));
check('gem achievements unlock and pay gold', got.some((a) => a.id === 'gems_100') && s.gold > 0);
check('achievements unlock only once', P.checkAchievements(s, P.perks(s)).length === 0);

/* quests and streaks */
const q1 = P.questsFor('2026-11-05'), q2 = P.questsFor('2026-11-05'), q3 = P.questsFor('2026-11-06');
check('daily quests are the same all day', JSON.stringify(q1) === JSON.stringify(q2));
check('daily quests change the next day', JSON.stringify(q1) !== JSON.stringify(q3));
check('three distinct quests a day', new Set(q1.map((q) => q.id)).size === 3);
s = P.defaultSave();
const b1 = P.refreshDay(s, new Date(2026, 10, 5), null);
check('first day starts a streak with a bonus', s.streak.count === 1 && b1 > 0);
check('same day gives no second bonus', P.refreshDay(s, new Date(2026, 10, 5, 23, 0), null) === 0);
P.refreshDay(s, new Date(2026, 10, 6), null);
P.refreshDay(s, new Date(2026, 10, 7), null);
check('consecutive days grow the streak', s.streak.count === 3 && s.stats.bestStreak === 3);
P.refreshDay(s, new Date(2026, 10, 10), null);
check('a gap resets the streak', s.streak.count === 1 && s.stats.bestStreak === 3);
P.refreshDay(s, new Date(2026, 11, 31), null); P.refreshDay(s, new Date(2027, 0, 1), null);
check('a streak continues over New Year', s.streak.count === 2);
const qs = s.quests.list;
const target = qs[0];
P.addStat(s, target.stat, target.target);
check('stats advance today\'s quests', target.done && target.progress === target.target);
check('a finished quest can be claimed once', P.claimQuest(s, 0, null) === target.gold && P.claimQuest(s, 0, null) === 0);

/* seasons */
const season = (y, m, d) => (P.seasonFor(new Date(y, m - 1, d)) || {}).id;
check('Christmas Eve to Epiphany is the year-end festival', season(2026, 12, 24) === 'yearend' && season(2027, 1, 6) === 'yearend');
check('early December and late January are winter', season(2026, 12, 3) === 'winter' && season(2027, 1, 20) === 'winter' && season(2028, 2, 29) === 'winter');
check('spring, summer, autumn', season(2026, 4, 10) === 'spring' && season(2026, 7, 4) === 'summer' && season(2026, 9, 20) === 'autumn');
check('Halloween window', season(2026, 10, 15) === 'halloween' && season(2026, 10, 31) === 'halloween' && season(2026, 11, 2) === 'halloween' && season(2026, 11, 3) === 'autumn');
check('every day of a year has a season', (() => { for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) if (!P.seasonFor(d)) return false; return true; })());
const win = M.SEASONS.find((x) => x.id === 'winter');
check('a winter spanning New Year keeps one event key', P.seasonKey(win, new Date(2026, 11, 10)) === P.seasonKey(win, new Date(2027, 1, 10)));
s = P.defaultSave();
const spring = M.SEASONS.find((x) => x.id === 'spring');
P.syncSeason(s, spring, new Date(2026, 3, 1));
s.season.tokens = 60;
const rewards = P.claimTrack(s, spring, null);
check('event track grants every reached tier once', rewards.length === 4 && P.claimTrack(s, spring, null).length === 0);
check('event track unlocks the seasonal skin and trail', s.seasonUnlocks.bunny && s.seasonUnlocks.petals && P.isUnlocked(s, M.SKINS.find((x) => x.id === 'bunny')));
P.syncSeason(s, spring, new Date(2027, 3, 1));
check('a new year\'s season starts a fresh track', s.season.tokens === 0 && s.season.claimed.length === 0);

/* story */
s = P.defaultSave();
check('only the first cave is open at first', P.levelOpen(s, 0, 0) && !P.levelOpen(s, 0, 1) && !P.levelOpen(s, 1, 0));
s.story.stars['0-0'] = 1;
check('a star opens the next cave', P.levelOpen(s, 0, 1));
s.story.stars['0-7'] = 2;
check('beating the boss opens the next chapter', P.levelOpen(s, 1, 0));
check('stars: clear, par time, gem goal', P.starsFor({ timeUsed: 10, par: 20, gems: 30, gemsGoal: 25 }) === 3 && P.starsFor({ timeUsed: 30, par: 20, gems: 3, gemsGoal: 25 }) === 1);
check('the daily cave is the same all day', P.dailySeed('2026-11-05') === P.dailySeed('2026-11-05') && P.dailySeed('2026-11-05') !== P.dailySeed('2026-11-06'));
check('daily modifiers rotate', new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((d) => P.dailyModifier('2026-11-' + d).id)).size >= 4);
check('cosmetics: 16 skins, 12 trails, 6 tile sets, 30 achievements', M.SKINS.length === 16 && M.TRAILS.length === 12 && M.TILESETS.length === 6 && M.ACHIEVEMENTS.length === 30);
check('power-ups: eleven with icons and names', NS.items.POWERUPS.filter(Boolean).length === 11);
done();
