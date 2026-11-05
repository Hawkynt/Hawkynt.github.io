'use strict';

/* Seasonal date logic: the event of every day of the year, the season keys across the
   year boundary, days left, the reward track tiers, the daily twist, the daily quests and
   the weekly challenge (deterministic per date), and the day difference used by streaks. */
global.window = {};
require('../js/core/course.js');
require('../js/core/seasons.js');
const S = window.SZ.FlappySeasons;
const { check, done } = require('./harness');

const d = (y, m, day) => new Date(y, m - 1, day);
const cases = [
  [d(2026, 1, 1), 'newyear'], [d(2026, 1, 5), 'newyear'], [d(2026, 1, 6), 'frost'], [d(2026, 2, 28), 'frost'],
  [d(2028, 2, 29), 'frost'], [d(2026, 3, 1), 'bloom'], [d(2026, 5, 31), 'bloom'], [d(2026, 6, 1), 'sun'], [d(2026, 8, 31), 'sun'],
  [d(2026, 9, 1), 'harvest'], [d(2026, 10, 14), 'harvest'], [d(2026, 10, 15), 'spooky'], [d(2026, 10, 31), 'spooky'],
  [d(2026, 11, 2), 'spooky'], [d(2026, 11, 3), 'harvest'], [d(2026, 11, 30), 'harvest'], [d(2026, 12, 1), 'frost'],
  [d(2026, 12, 26), 'frost'], [d(2026, 12, 27), 'newyear'], [d(2026, 12, 31), 'newyear']
];
const wrong = cases.filter(c => S.eventIdFor(c[0]) !== c[1]).map(c => c[0].toDateString() + ' -> ' + S.eventIdFor(c[0]));
check('every boundary day maps to its event', wrong.length === 0, wrong.join('; '));

const seen = new Set();
for (let i = 0; i < 366; ++i)
  seen.add(S.eventIdFor(new Date(2026, 0, 1 + i)));
check('all six events occur during a year', seen.size === 6 && S.EVENT_ORDER.every(id => seen.has(id)), [...seen].join());

check('winter belongs to the year it began', S.seasonKey(d(2027, 2, 10)) === 'frost-2026' && S.seasonKey(d(2026, 12, 10)) === 'frost-2026' &&
  S.seasonKey(d(2027, 1, 2)) === 'newyear-2026' && S.seasonKey(d(2026, 12, 30)) === 'newyear-2026');
check('other seasons key by their own year', S.seasonKey(d(2026, 4, 1)) === 'bloom-2026' && S.seasonKey(d(2027, 4, 1)) === 'bloom-2027');
check('days left counts to the end of the event', S.daysLeft(d(2026, 11, 5)) === 26 && S.daysLeft(d(2026, 10, 31)) === 3 && S.daysLeft(d(2026, 8, 31)) === 1,
  [S.daysLeft(d(2026, 11, 5)), S.daysLeft(d(2026, 10, 31)), S.daysLeft(d(2026, 8, 31))].join());

check('track tiers', S.trackTier(0) === 0 && S.trackTier(9) === 0 && S.trackTier(10) === 1 && S.trackTier(100) === 4 && S.trackTier(9999) === S.TRACK.length);
check('the track pays a trail, a hat and a bird', ['trail', 'hat', 'bird'].every(r => S.TRACK.some(t => t.reward === r)));
for (const id of S.EVENT_ORDER) {
  const ev = S.EVENTS[id];
  check('event ' + id + ' is complete', !!(ev.name && ev.token && ev.tokenColor && ev.tint && ev.rewards.trail && ev.rewards.hat && ev.rewards.bird));
}

const t1 = S.dailyTwist(d(2026, 11, 5)), t2 = S.dailyTwist(new Date(2026, 10, 5, 23, 59));
check('the daily twist is stable through a day', t1.id === t2.id);
const twists = new Set();
for (let i = 0; i < 60; ++i)
  twists.add(S.dailyTwist(new Date(2026, 0, 1 + i)).id);
check('the twist changes over the days', twists.size >= 5, twists.size + ' twists in 60 days');

const q = S.dailyQuests(d(2026, 11, 5));
check('three daily quests of different kinds', q.length === 3 && new Set(q.map(x => x.stat)).size === 3);
check('quests rise in difficulty', q[0].reward < q[1].reward && q[1].reward < q[2].reward);
check('quests are stable within a day', JSON.stringify(q) === JSON.stringify(S.dailyQuests(new Date(2026, 10, 5, 22))));
check('quests differ between days', JSON.stringify(q) !== JSON.stringify(S.dailyQuests(d(2026, 11, 6))) || JSON.stringify(q) !== JSON.stringify(S.dailyQuests(d(2026, 11, 7))));

check('week keys start on Monday', S.weekKey(d(2026, 11, 5)) === '2026-11-02' && S.weekKey(d(2026, 11, 8)) === '2026-11-02' && S.weekKey(d(2026, 11, 9)) === '2026-11-09');
check('the weekly challenge is stable through a week', S.weeklyChallenge(d(2026, 11, 3)).id === S.weeklyChallenge(d(2026, 11, 8)).id);
check('day difference across months and years', S.dayDiff('2026-11-30', '2026-12-01') === 1 && S.dayDiff('2026-12-31', '2027-01-01') === 1 &&
  S.dayDiff('2028-02-28', '2028-03-01') === 2 && S.dayDiff('2026-11-05', '2026-11-05') === 0);

done();
