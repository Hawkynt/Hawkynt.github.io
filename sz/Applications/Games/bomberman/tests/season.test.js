'use strict';

/* Calendar logic: season boundaries (year-end beats winter), season keys across the new year,
   days left, the daily challenge (same for everyone that day, three distinct modifiers, never
   darkness with ice) and the weekly challenge (stable for a week, new on Monday). */
const H = require('./harness');
H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load('core/season.js');
const { check, done } = H;
const S = NS.season;

const d = (y, m, day) => new Date(y, m - 1, day, 12);
const cases = [
  [d(2026, 1, 3), 'yearend'], [d(2026, 1, 6), 'yearend'], [d(2026, 1, 7), 'winter'], [d(2026, 2, 28), 'winter'],
  [d(2026, 3, 1), 'spring'], [d(2026, 5, 31), 'spring'], [d(2026, 6, 1), 'summer'], [d(2026, 8, 31), 'summer'],
  [d(2026, 9, 1), 'autumn'], [d(2026, 11, 30), 'autumn'], [d(2026, 12, 1), 'winter'], [d(2026, 12, 19), 'winter'],
  [d(2026, 12, 20), 'yearend'], [d(2026, 12, 31), 'yearend']
];
for (const [date, want] of cases) check(date.toDateString() + ' is ' + want, S.seasonId(date) === want, S.seasonId(date));

check('January winter belongs to the winter that began in December', S.current(d(2027, 2, 10)).key === 'winter-2026' && S.current(d(2026, 12, 5)).key === 'winter-2026');
check('the year-end festival spans the new year under one key', S.current(d(2026, 12, 28)).key === 'yearend-2026' && S.current(d(2027, 1, 2)).key === 'yearend-2026');
check('autumn 2026 ends with November', S.current(d(2026, 11, 5)).daysLeft === 26);
check('Halloween nights are spooky', S.current(d(2026, 10, 31)).spooky && !S.current(d(2026, 9, 10)).spooky);
check('every season has a token, colour, tint and particle', NS.meta.SEASONS.every(se => se.token && se.color && se.tint && se.particle));

const a = S.daily(d(2026, 11, 5)), b = S.daily(new Date(2026, 10, 5, 23, 59));
check('the daily challenge is the same all day', a.seed === b.seed && a.mods.join() === b.mods.join());
check('the daily challenge changes the next day', S.daily(d(2026, 11, 6)).seed !== a.seed);
let distinct = true, cruel = false;
for (let i = 0; i < 400; ++i) {
  const x = S.daily(new Date(2026, 0, 1 + i, 12));
  if (new Set(x.mods).size !== 3) distinct = false;
  if (x.mods.indexOf('dark') >= 0 && x.mods.indexOf('ice') >= 0) cruel = true;
}
check('400 days of dailies all have three distinct modifiers', distinct);
check('darkness never comes with ice', !cruel);

const w1 = S.weekly(d(2026, 11, 2)), w2 = S.weekly(d(2026, 11, 8)), w3 = S.weekly(d(2026, 11, 9));
check('the weekly challenge holds Monday to Sunday', w1.week === w2.week && w1.id === w2.id);
check('a new week starts on Monday', w3.week === w1.week + 1);
check('weekly goals are big and well paid', w1.goal >= 15 && w1.gems >= 150);
check('day numbers count consecutive days', NS.rng.dayNumber(d(2026, 3, 29)) - NS.rng.dayNumber(d(2026, 3, 28)) === 1);

done();
