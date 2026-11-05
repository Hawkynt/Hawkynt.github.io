'use strict';

/* Calendar logic: seasons and festivals by local date, the per-season track key across the year
   change, track tiers and rewards, the daily challenge and quests being stable within a day and
   different across days, the weekly featured chapter, and the play streak. Also that the game
   boots on every season's date with that season's rocks, decor and opening. */
const H = require('./harness');
H.installEnv({ date: new Date('2026-07-01T12:00:00') });
const NS = H.load();
const { check, done } = H;
const S = NS.seasons;
const d = (s) => new Date(s + 'T12:00:00');

check('winter, spring, summer, autumn by month', S.seasonOf(d('2026-02-10')) === 'winter' && S.seasonOf(d('2026-04-01')) === 'spring' &&
  S.seasonOf(d('2026-07-31')) === 'summer' && S.seasonOf(d('2026-09-15')) === 'autumn' && S.seasonOf(d('2026-12-05')) === 'winter');
check('the Haunted Belt runs Oct 20 to Nov 2', S.seasonOf(d('2026-10-19')) === 'autumn' && S.seasonOf(d('2026-10-20')) === 'halloween' &&
  S.seasonOf(d('2026-11-02')) === 'halloween' && S.seasonOf(d('2026-11-03')) === 'autumn');
check('Starfall runs Dec 20 to Jan 6', S.seasonOf(d('2026-12-19')) === 'winter' && S.seasonOf(d('2026-12-20')) === 'yearend' &&
  S.seasonOf(d('2027-01-06')) === 'yearend' && S.seasonOf(d('2027-01-07')) === 'winter');
check('a winter spanning the new year keeps one track', S.seasonKey(d('2026-12-05')) === 'winter-2026' && S.seasonKey(d('2027-02-10')) === 'winter-2026');
check('the festival keeps one track across the year change', S.seasonKey(d('2026-12-24')) === 'yearend-2026' && S.seasonKey(d('2027-01-03')) === 'yearend-2026');
check('the next year has a fresh track', S.seasonKey(d('2027-07-01')) === 'summer-2027' && S.seasonKey(d('2026-07-01')) === 'summer-2026');
check('every season has a token rock', Object.keys(S.SEASONS).every(k => NS.rockData.ROCK_TYPES[S.SEASONS[k].token]));

check('track tiers', S.tierFor(0) === 0 && S.tierFor(5) === 1 && S.tierFor(29) === 3 && S.tierFor(90) === 8 && S.tierFor(500) === 8);
for (const id of Object.keys(S.SEASONS)) {
  const t2 = S.trackReward(id, 2), t4 = S.trackReward(id, 4), t8 = S.trackReward(id, 8);
  check(id + ': tier 2 a trail, tier 4 a skin, tier 8 a badge', t2.kind === 'trail' && t4.kind === 'skin' && t8.kind === 'badge');
}

const a = S.dailySpec(d('2026-03-03')), b = S.dailySpec(new Date('2026-03-03T23:59:00')), c = S.dailySpec(d('2026-03-04'));
check('the daily is the same all day', a.seed === b.seed && a.mods.join() === b.mods.join());
check('and changes the next day', a.seed !== c.seed);
check('two distinct modifiers', a.mods.length === 2 && a.mods[0] !== a.mods[1]);
let differ = 0;
for (let i = 1; i <= 28; ++i) {
  const k1 = '2026-02-' + (i < 10 ? '0' : '') + i;
  const q = S.questsFor(k1);
  if (q.length !== 3 || new Set(q.map(x => x.id)).size !== 3) differ = -99;
  if (i > 1 && S.questsFor(k1).map(x => x.id).join() !== S.questsFor('2026-02-' + (i - 1 < 10 ? '0' : '') + (i - 1)).map(x => x.id).join()) ++differ;
}
check('three distinct quests a day, varying across days', differ > 20, differ);
check('quests are stable for a day', JSON.stringify(S.questsFor('2026-05-05')) === JSON.stringify(S.questsFor('2026-05-05')));
const f1 = S.featured(d('2026-11-02')), f2 = S.featured(d('2026-11-08')), f3 = S.featured(d('2026-11-09'));
check('the featured chapter holds for an ISO week', f1.week === '2026-W45' && f1.week === f2.week && f1.chapter === f2.chapter && f3.week === '2026-W46');
check('ISO weeks at the year boundary', NS.rng.weekKey(d('2027-01-01')) === '2026-W53' && NS.rng.weekKey(d('2026-01-01')) === '2026-W01');

const st = { last: '', count: 0, best: 0 };
check('first play starts a streak with a bonus', S.touchStreak(st, '2026-03-01') === 40 && st.count === 1);
check('the same day pays once', S.touchStreak(st, '2026-03-01') === 0 && st.count === 1);
S.touchStreak(st, '2026-03-02');
check('the next day grows the streak', st.count === 2 && st.best === 2);
check('a missed day resets it', S.touchStreak(st, '2026-03-05') === 40 && st.count === 1 && st.best === 2);
for (let i = 6; i <= 15; ++i) S.touchStreak(st, '2026-03-' + (i < 10 ? '0' : '') + i);
check('the bonus caps at seven days', st.count === 11 && S.touchStreak(st, '2026-03-16') === 280);
check('streaks span month ends', (() => { const x = { last: '2026-02-28', count: 3, best: 3 }; S.touchStreak(x, '2026-03-01'); return x.count === 4; })());

/* the game in every season: its token rocks in the attract scene, its opening once, its tint */
const G = NS.state;
const dates = { winter: '2026-01-20', spring: '2026-04-10', summer: '2026-07-10', autumn: '2026-09-20', halloween: '2026-10-28', yearend: '2026-12-28' };
for (const id of Object.keys(dates)) {
  NS.save.refreshCalendar(d(dates[id]));
  NS.sim.startDemo();
  const token = S.SEASONS[id].token;
  check(id + ': the calendar picks the season', G.cal.season === id);
  check(id + ': its token rock flies on the title', G.rocks.some(r => r.type === token));
  let played = 0;
  const toTitle = () => NS.screens.setScreen('title');
  if (id === 'summer') check('summer: the boot already played its opening', G.save.seen['season:' + G.cal.seasonKey] === true);
  delete G.save.seen['season:' + G.cal.seasonKey];
  NS.cinematics.seasonIntro(toTitle);
  if (G.screen === 'cine' && G.cine.kind === 'season') ++played;
  NS.cinematics.end();
  NS.cinematics.seasonIntro(toTitle);
  if (G.screen === 'cine') ++played;
  check(id + ': its opening plays once', played === 1);
  NS.screens.setScreen('title');
  NS.frame.draw();
}
done();
