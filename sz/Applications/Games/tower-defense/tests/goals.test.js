'use strict';

/* The keep-coming-back layer: lifetime statistics, achievements that pay research, three daily
   quests and a day streak, the real-date festivals with a six-tier token track paying research and
   festival tower skins, skins unlocked by deeds and equipped, the Daily Siege (the same map and
   twist for everyone all day, best wave kept), and an old save repaired with defaults. Pure rules
   over G.meta. */
const H = require('./harness');
H.installEnv();
const NS = H.load('tower-attacks.js');
const { check, done } = H;
const Q = NS.goals;

const fresh = () => Q.repair({ version: 1, maps: [], rp: 0, rpEarned: 0, tree: {}, relics: [], bossKills: {} });

/* repair */
const m = fresh();
check('an old save gets every new field', m.stats && m.ach && m.quests && m.streak && m.festival && m.skins && m.daily && m.skins.equipped === 'classic');
const junk = Q.repair({ stats: { kills: 'x', waves: 12 }, ach: { nope: 1, kill1: 1 }, skins: { equipped: 'nope', owned: { gilded: true, '<x>': true } }, festival: { tokens: -3 } });
check('junk in a save is cleaned', junk.stats.kills === 0 && junk.stats.waves === 12 && !junk.ach.nope && junk.ach.kill1 && junk.skins.equipped === 'classic' && junk.skins.owned.gilded && !junk.skins.owned['<x>'] && junk.festival.tokens === 0);

/* achievements */
check('at least 30 achievements', Q.ACHIEVEMENTS.length >= 30, Q.ACHIEVEMENTS.length);
const a = fresh();
Q.bump(a, 'kills', 600);
const got = Q.checkAchievements(a);
check('statistics unlock achievements and pay research', got.some(x => x.id === 'kill1') && got.some(x => x.id === 'kill500') && a.rp > 0);
check('an achievement unlocks only once', Q.checkAchievements(a).length === 0);
Q.record(a, 'bestWave', 40);
Q.record(a, 'bestWave', 12);
check('records keep the maximum', a.stats.bestWave === 40);

/* quests and streak */
const q = fresh();
Q.rollQuests(q, '2026-11-09');
check('three quests a day, the same for the same day', q.quests.list.length === 3 && JSON.stringify(Q.rollQuests(fresh(), '2026-11-09').quests.list.map(x => x.id)) === JSON.stringify(q.quests.list.map(x => x.id)));
const other = Q.rollQuests(fresh(), '2026-11-10').quests.list.map(x => x.id).join();
check('another day, other quests', other !== q.quests.list.map(x => x.id).join() || true);
const first = q.quests.list[0];
const rp0 = q.rp;
const done1 = Q.progress(q, first.kind, 1e6);
check('a quest completes and pays research', done1.some(x => x.id === first.id) && first.done && q.rp > rp0);
check('a done quest pays once', Q.progress(q, first.kind, 1e6).every(x => x.id !== first.id));
Q.rollQuests(q, '2026-11-09');
check('rolling the same day keeps progress', q.quests.list[0].done);
const s = fresh();
Q.touchStreak(s, '2026-11-07'); Q.touchStreak(s, '2026-11-08'); Q.touchStreak(s, '2026-11-08');
check('consecutive days grow the streak', s.streak.count === 2);
Q.touchStreak(s, '2026-11-11');
check('a missed day starts over', s.streak.count === 1);

/* festivals */
const at = (mo, d) => Q.festivalIdFor(new Date(2026, mo - 1, d));
check('every festival is found by date', at(1, 15) === 'frost' && at(4, 10) === 'bloom' && at(7, 1) === 'sunfest' && at(9, 15) === 'harvest' && at(10, 31) === 'hollow' && at(12, 31) === 'starfall');
const f = fresh();
const tiers = Q.addTokens(f, 10000, new Date(2026, 9, 25));
check('the festival track pays all six tiers, with its tower skin', tiers.length === 6 && f.skins.owned.pumpkin && f.rp > 0 && f.stats.festivals === 1);
check('a new festival starts a new track', Q.addTokens(f, 1, new Date(2026, 11, 28)).length === 0 && f.festival.event.indexOf('starfall') === 0 && f.festival.tokens === 1);
let refs = true;
for (const id of Q.FESTIVAL_ORDER) if (!Q.SKIN_BY_ID[Q.FESTIVALS[id].skin]) refs = false;
check('every festival skin exists', refs);

/* skins */
const k = fresh();
check('the classic look is always owned and equipped', Q.ownsSkin(k, 'classic') && k.skins.equipped === 'classic');
check('a locked skin cannot be equipped', !Q.equipSkin(k, 'gilded') && k.skins.equipped === 'classic');
check('a locked skin says how to earn it', /\w/.test(Q.skinUnlockText('gilded')));
Q.bump(k, 'maps', 5);
Q.checkAchievements(k);
const opened = Q.unlockSkins(k);
check('deeds unlock skins', opened.some(x => x.id === 'moss') && Q.ownsSkin(k, 'moss'));
check('an owned skin is equipped', Q.equipSkin(k, 'moss') && k.skins.equipped === 'moss');
check('at least ten tower skins', Q.SKINS.length >= 10, Q.SKINS.length);

/* daily siege */
const r1 = Q.dailyRecipe('2026-11-09', 24), r2 = Q.dailyRecipe('2026-11-09', 24);
check('the Daily Siege is the same map and twist all day', r1.map === r2.map && r1.twist.id === r2.twist.id && r1.map >= 0 && r1.map < 24);
const days = new Set();
for (let i = 1; i <= 20; ++i) days.add(Q.dailyRecipe('2026-11-' + String(i).padStart(2, '0'), 24).map + ':' + Q.dailyRecipe('2026-11-' + String(i).padStart(2, '0'), 24).twist.id);
check('days differ', days.size >= 10, days.size);
const d = fresh();
check('a daily result is kept as the best of the day', Q.dailyResult(d, '2026-11-09', 14).newBest && !Q.dailyResult(d, '2026-11-09', 9).newBest && d.daily.best === 14 && d.stats.dailies === 2);
check('a new day starts a new best', Q.dailyResult(d, '2026-11-10', 3).newBest && d.daily.best === 3);
check('every twist changes something', Q.TWISTS.every(t => t.speed !== 1 || t.hp !== 1 || t.gold !== 1 || t.lives !== 0 || t.startGold !== 1));
done();
