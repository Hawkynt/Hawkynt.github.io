'use strict';

/* Calendar logic: which festival runs on a date (including the year-end overlap), event ids
   across the new year, days left, the weekly featured mutator and the Daily Run recipe. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/seasons.js');
const { check, done } = H;
const S = NS.seasons;
const D = (y, m, d) => new Date(y, m - 1, d, 12);

const cases = [[1, 3, 'starfall'], [1, 7, 'frost'], [2, 28, 'frost'], [3, 1, 'bloom'], [5, 31, 'bloom'], [6, 1, 'sunfest'], [8, 31, 'sunfest'],
  [9, 1, 'harvest'], [10, 19, 'harvest'], [10, 20, 'hollow'], [11, 2, 'hollow'], [11, 3, 'harvest'], [12, 1, 'frost'], [12, 23, 'frost'], [12, 24, 'starfall']];
for (const [m, d, id] of cases) check(m + '/' + d + ' is ' + id, S.seasonIdFor(D(2026, m, d)) === id);
check('six festivals with a world, token, outfit and trail each', S.SEASON_ORDER.length === 6 && S.SEASON_ORDER.every(id => {
  const s = S.SEASONS[id];
  return s.world >= 0 && s.world < 5 && s.token && NS.cosmetics.OUTFIT_BY_ID[s.outfit] && NS.cosmetics.TRAIL_BY_ID[s.trail];
}));
check('winter festivals keep the year they began in', S.eventId(D(2027, 1, 2)) === 'starfall-2026' && S.eventId(D(2026, 12, 30)) === 'starfall-2026' && S.eventId(D(2027, 2, 10)) === 'frost-2026');
check('other festivals use the calendar year', S.eventId(D(2026, 4, 1)) === 'bloom-2026');
check('days left counts today', S.daysLeft(D(2026, 11, 2)) === 1 && S.daysLeft(D(2026, 10, 20)) === 14);
check('the weekly mutator holds for a week', S.weeklyMutator(D(2026, 11, 2)).id === S.weeklyMutator(D(2026, 11, 8)).id);
const r1 = S.dailyRecipe(D(2026, 11, 6)), r2 = S.dailyRecipe(new Date(2026, 10, 6, 23, 59));
check('the daily recipe is fixed for the day', JSON.stringify(r1) === JSON.stringify(r2));
check('the daily recipe has two different known mutators', r1.mutators[0] !== r1.mutators[1] && r1.mutators.every(id => S.MUTATOR_BY_ID[id]));
let distinct = new Set();
for (let d = 1; d <= 20; ++d) distinct.add(S.dailyRecipe(D(2026, 3, d)).seed);
check('every day gets its own course', distinct.size === 20);
check('reward track ends at 100 tokens', S.TIERS[S.TIERS.length - 1].n === 100);
done();
