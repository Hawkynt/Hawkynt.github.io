'use strict';

/* Seasons from the local date: which event runs on each boundary day, event keys across new year,
   days left, the reward track tiers and claiming, and the seeded daily maze and weekly twist. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/save.js');
const { check, done } = H;
const SE = NS.seasons;
const R = NS.rules;
const D = (s) => new Date(s + 'T12:00:00');

const cases = [
  ['2026-01-01', 'yearend'], ['2026-01-06', 'yearend'], ['2026-01-07', 'winter'], ['2026-02-28', 'winter'],
  ['2026-03-01', 'spring'], ['2026-05-31', 'spring'], ['2026-06-01', 'summer'], ['2026-08-31', 'summer'],
  ['2026-09-01', 'autumn'], ['2026-10-14', 'autumn'], ['2026-10-15', 'halloween'], ['2026-11-02', 'halloween'],
  ['2026-11-03', 'autumn'], ['2026-11-30', 'autumn'], ['2026-12-01', 'winter'], ['2026-12-14', 'winter'],
  ['2026-12-15', 'yearend'], ['2026-12-31', 'yearend'], ['2028-02-29', 'winter'],
];
const wrong = cases.filter(c => SE.seasonFor(D(c[0])).id !== c[1]).map(c => c[0] + '=' + SE.seasonFor(D(c[0])).id);
check('every boundary day maps to the right event', wrong.length === 0, wrong.join(', '));
check('every day of a year has an event', (() => { for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) if (!SE.seasonFor(d)) return false; return true; })());
check('year-end keeps the year it started in', SE.seasonKey(D('2026-12-20')) === 'yearend-2026' && SE.seasonKey(D('2027-01-03')) === 'yearend-2026');
check('winter after new year belongs to the previous winter', SE.seasonKey(D('2027-01-20')) === 'winter-2026' && SE.seasonKey(D('2026-12-05')) === 'winter-2026');
check('days left counts to the last day', SE.daysLeft(D('2026-11-30')) === 1 && SE.daysLeft(D('2026-11-05')) === 26 && SE.daysLeft(D('2026-10-15')) === 19);
check('days left survives the February end in non-leap years', SE.daysLeft(D('2027-02-27')) === 2);

const p = R.freshProfile();
check('a new event starts a fresh track', SE.syncSeason(p, D('2026-10-20')) && p.season.key === 'halloween-2026' && !SE.syncSeason(p, D('2026-10-21')));
p.season.tokens = 30;
const claimed = SE.claimTiers(p, D('2026-10-20'));
check('reaching tiers pays them out', claimed.length === 2 && p.shards === 60 && R.owns(p, 'trail', 'bats'));
check('tiers pay only once', SE.claimTiers(p, D('2026-10-20')).length === 0);
p.season.tokens = 100;
SE.claimTiers(p, D('2026-10-20'));
check('the full track gives the event skin', R.owns(p, 'skin', 'pumpkin') && p.season.claimed.length === 5);
SE.syncSeason(p, D('2026-11-05'));
check('the next event resets the track but keeps rewards', p.season.tokens === 0 && R.owns(p, 'skin', 'pumpkin'));

const d1 = SE.daily(D('2026-11-05')), d2 = SE.daily(D('2026-11-05')), d3 = SE.daily(D('2026-11-06'));
check('the daily maze is the same all day', JSON.stringify(d1) === JSON.stringify(d2) && d1.mods.length === 2 && d1.mods[0] !== d1.mods[1]);
check('the daily maze changes the next day', d1.seed !== d3.seed);
check('the weekly twist holds for a week', SE.weekly(D('2026-11-02')).id === SE.weekly(D('2026-11-08')).id);

done();
