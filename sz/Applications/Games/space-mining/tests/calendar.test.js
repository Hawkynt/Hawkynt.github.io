'use strict';

/* The calendar (pure, local dates): seasons and their wrap over new year, ISO week keys, the
   weekly anomaly belt and the modifiers trips fly with, the daily contract and its streak, and
   the seeded event schedule of a trip. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/save.js');
const { check, done } = H;
const K = NS.calendar;
const { ZONES, ZONE_BY_ID } = NS.ores;
const day = (y, m, d) => new Date(y, m - 1, d, 12);

check('no season in early March', K.season(day(2026, 3, 3)) === null);
check('Perihelion Lights wraps the new year', K.season(day(2026, 12, 20)).id === 'perihelion' && K.season(day(2027, 1, 6)).id === 'perihelion' && K.season(day(2027, 1, 7)) === null);
check('Void Night runs over Halloween', K.season(day(2026, 10, 31)).id === 'voidnight' && K.season(day(2026, 11, 3)).id === 'voidnight');
check('Spring Bloom and Perseid Drift', K.season(day(2026, 4, 20)).id === 'bloom' && K.season(day(2026, 8, 12)).id === 'meteor');

check('ISO week of a Thursday new year', K.weekKey(day(2026, 1, 1)) === '2026-W01');
check('the last days of 2026 belong to week 53', K.weekKey(day(2027, 1, 1)) === '2026-W53' && K.weekKey(day(2026, 12, 31)) === '2026-W53');
check('Monday starts a new week', K.weekKey(day(2026, 11, 8)) !== K.weekKey(day(2026, 11, 9)) && K.weekKey(day(2026, 11, 9)) === K.weekKey(day(2026, 11, 15)));

const a = K.anomaly('2026-W45');
check('the anomaly of a week is stable and sits in an outer belt', JSON.stringify(a) === JSON.stringify(K.anomaly('2026-W45')) && a.zone >= 1 && a.zone <= 4);
const seen = new Set();
for (let w = 1; w <= 52; ++w) seen.add(K.anomaly('2026-W' + (w < 10 ? '0' : '') + w).def.id);
check('the anomalies rotate through the year', seen.size >= 6);
let date = null;
for (let d = 1; d <= 60 && !date; ++d) {
  const dt = day(2026, 3, d);
  if (!K.season(dt)) date = dt;
}
const an = K.anomaly(K.weekKey(date));
const inBelt = K.mods(date, an.zone), outBelt = K.mods(date, an.zone === 1 ? 2 : 1);
check('anomaly rules apply in its belt only', inBelt.anomaly === an.def && outBelt.anomaly === null && inBelt.reward === an.def.reward && outBelt.reward === 1);
const vn = K.mods(day(2026, 10, 30), 0);
check('a season changes every belt', vn.nano === 2 && vn.waves === 1.25 && vn.season.id === 'voidnight');

/* streaks */
let st = { day: '', streak: 0, last: '' };
st = K.streakAfter(st, '2026-11-05');
check('the first daily starts a streak', st.streak === 1 && st.last === '2026-11-05');
st = K.streakAfter(st, '2026-11-06');
st = K.streakAfter(st, '2026-11-07');
check('consecutive days build it', st.streak === 3);
check('the same day twice counts once', K.streakAfter(st, '2026-11-07').streak === 3);
check('across a month end too', K.streakAfter({ streak: 4, last: '2026-11-30' }, '2026-12-01').streak === 5);
check('a missed day breaks it', K.streakAfter(st, '2026-11-09').streak === 1);
check('a broken streak shows as zero', K.liveStreak(st, '2026-11-09') === 0 && K.liveStreak(st, '2026-11-08') === 3);
check('the streak raises the pay, up to x2.5', K.streakMul(1) === 1 && K.streakMul(3) === 1.5 && K.streakMul(30) === 2.5);
const opts = { hasBase: true, hasFab: true, ores: ['iron', 'gold'], streak: 0, waves: 4 };
const d1 = K.dailyContract('2026-11-05', opts);
check('the daily contract is the same all day', JSON.stringify(d1) === JSON.stringify(K.dailyContract('2026-11-05', opts)) && d1.daily === '2026-11-05');
const kinds = new Set();
for (let i = 1; i <= 28; ++i) kinds.add(K.dailyContract('2026-02-' + (i < 10 ? '0' : '') + i, opts).kind);
check('dailies vary between ore, components and waves', kinds.size === 3);
const noBase = new Set();
for (let i = 1; i <= 28; ++i) noBase.add(K.dailyContract('2026-02-' + (i < 10 ? '0' : '') + i, { ores: ['iron'], streak: 0 }).kind);
check('without an outpost they ask for ore only', noBase.size === 1 && noBase.has('ore'));
check('a longer streak pays more', K.dailyContract('2026-11-05', Object.assign({}, opts, { streak: 4 })).reward > d1.reward);

const wk = K.weeklyContract('2026-W45', opts);
check('the weekly contract is the same all week and pays more than a daily', JSON.stringify(wk) === JSON.stringify(K.weeklyContract('2026-W45', opts)) && wk.weekly === '2026-W45' && wk.reward > d1.reward);
const E = NS.economy, R = NS.rules;
const save = R.freshSave();
E.dailyContract(save, '2026-11-05');
const n0 = save.contracts.length;
check('a save carries today\'s daily and this week\'s weekly', save.contracts.some(c => c.daily === '2026-11-05') && save.contracts.some(c => c.weekly));
E.dailyContract(save, '2026-11-05');
check('asking again the same day adds nothing', save.contracts.length === n0);
E.dailyContract(save, '2026-11-06');
check('a new day replaces the daily', save.contracts.some(c => c.daily === '2026-11-06') && !save.contracts.some(c => c.daily === '2026-11-05'));
const dc = save.contracts.find(c => c.daily);
save.store[dc.kind === 'waves' ? 'ore' : dc.kind][dc.ore] = 999;
if (dc.kind === 'waves') save.stats.waves = dc.start + dc.qty;
const before = save.credits;
check('fulfilling the daily pays and starts the streak', E.fulfil(save, save.contracts.indexOf(dc)) && save.credits > before && save.daily.streak === 1 && save.stats.dailies === 1);

/* the event schedule */
const p1 = K.planEvents(1234, ZONE_BY_ID.verdant, { hasBase: true, career: true });
check('events are seeded', JSON.stringify(p1) === JSON.stringify(K.planEvents(1234, ZONE_BY_ID.verdant, { hasBase: true, career: true })));
check('and sorted by time', p1.every((e, i) => !i || e.t >= p1[i - 1].t));
let homeEvents = 0, outbreaks = 0, noBaseOutbreaks = 0;
for (let s = 0; s < 200; ++s) {
  homeEvents += K.planEvents(s, ZONE_BY_ID.kessler, { hasBase: true, career: true }).length;
  outbreaks += K.planEvents(s, ZONE_BY_ID.void, { hasBase: true, career: true }).filter(e => e.kind === 'outbreak' || e.kind === 'nanoprobe').length;
  noBaseOutbreaks += K.planEvents(s, ZONE_BY_ID.void, { hasBase: false, career: true }).filter(e => e.kind === 'outbreak' || e.kind === 'nanoprobe').length;
}
check('the home belt stays quiet', homeEvents === 0);
check('the outer belts breed outbreaks and incursions - at outposts only', outbreaks > 150 && noBaseOutbreaks === 0);
const bloom = K.mods(day(2026, 4, 20), 2);
let calm = 0, lively = 0;
for (let s = 0; s < 200; ++s) {
  calm += K.planEvents(s, ZONE_BY_ID.amber, { hasBase: true, career: true }).length;
  lively += K.planEvents(s, ZONE_BY_ID.amber, { hasBase: true, career: true, mods: bloom }).length;
}
check('the Spring Bloom makes the belts livelier', lively > calm);
check('every belt but the home belt has life or gas', ZONES.every(z => z.index === 0 || z.life > 0));

done();
