'use strict';

/* Local-date logic: seasons across the year, day keys and gaps (including month and year
   ends), the consecutive-day streak, daily quests and the Daily Bake-Off modifier (stable for
   a date, varied across dates), and the season shown after boot under a mocked date. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const Cal = NS.calendar;
const d = (y, m, day) => new Date(y, m - 1, day, 12);

const cases = [[1, 3, 'yearend'], [1, 6, 'winter'], [2, 29, 'winter'], [3, 1, 'spring'], [5, 31, 'spring'], [6, 1, 'summer'], [8, 31, 'summer'],
  [9, 1, 'autumn'], [10, 19, 'autumn'], [10, 20, 'halloween'], [11, 2, 'halloween'], [11, 3, 'autumn'], [12, 1, 'winter'], [12, 26, 'winter'], [12, 27, 'yearend']];
for (const c of cases) check('season of ' + c[0] + '/' + c[1] + ' is ' + c[2], Cal.seasonOf(d(2028, c[0], c[1])) === c[2], Cal.seasonOf(d(2028, c[0], c[1])));
check('day key pads month and day', Cal.dayKey(d(2026, 3, 7)) === '2026-03-07');
check('day gaps across a month end', Cal.dayDiff('2026-01-31', '2026-02-01') === 1);
check('day gaps across a year end', Cal.dayDiff('2026-12-31', '2027-01-01') === 1);
check('day gaps across a leap day', Cal.dayDiff('2028-02-28', '2028-03-01') === 2);

const s = { last: '', count: 0, best: 0 };
check('first play starts a streak of 1', Cal.touchStreak(s, '2026-11-06') && s.count === 1);
check('same day changes nothing', !Cal.touchStreak(s, '2026-11-06') && s.count === 1);
Cal.touchStreak(s, '2026-11-07');
Cal.touchStreak(s, '2026-11-08');
check('consecutive days grow the streak', s.count === 3 && s.best === 3);
Cal.touchStreak(s, '2026-11-10');
check('a missed day resets it, best stays', s.count === 1 && s.best === 3);

const q1 = Cal.rollQuests('2026-11-06'), q2 = Cal.rollQuests('2026-11-06');
check('daily quests are stable for a date', JSON.stringify(q1) === JSON.stringify(q2));
check('three different quests', q1.length === 3 && new Set(q1.map(q => q.id)).size === 3);
const seen = new Set();
for (let i = 1; i <= 28; ++i) seen.add(Cal.rollQuests('2026-02-' + (i < 10 ? '0' : '') + i).map(q => q.id).sort().join());
check('quests vary from day to day', seen.size > 5, seen.size);
const mods = new Set();
for (let i = 1; i <= 30; ++i) mods.add(Cal.dailyModifier('2026-04-' + (i < 10 ? '0' : '') + i).id);
check('Daily Bake-Off modifiers rotate', mods.size >= 4 && Cal.dailyModifier('2026-04-05') === Cal.dailyModifier('2026-04-05'), mods.size);

/* boot under a mocked date */
H.setNow(Date.UTC(2026, 9, 28, 12));
H.installEnv();
const NS2 = H.load();
check('booting on October 28 shows Halloween', NS2.state.season === 'halloween' && NS2.state.today === '2026-10-28');
check('the day rolls quests and a modifier', NS2.state.profile.daily && NS2.state.profile.daily.day === '2026-10-28' && NS2.state.modifier);
check('Halloween golden treats are pumpkins', NS2.eventData.CARRIERS[NS2.state.season].id === 'pumpkin');
H.setNow(Date.UTC(2026, 9, 29, 12));
NS2.app.syncDate();
check('a new day during play extends the streak', NS2.state.profile.streak.count === 2 && NS2.state.profile.daily.day === '2026-10-29');
done();
