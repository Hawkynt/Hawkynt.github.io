'use strict';

/* Operations and pacing as pure rules: the chains per belt and their moods, what opens when,
   the capstone gate on licences, which loops a belt allows, objective progress from what a
   trip measured, results and first-clear rewards, the save migration that dismantles outposts
   in belts that no longer allow them, and the pacing director's beats and tension. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/colony.js');
const { check, done } = H;
const O = NS.ops, PC = NS.pacing, R = NS.rules;
const { OPS, OP_BY_ID, MOODS, LOOPS } = NS.opsData;
const { ZONES, ORE_BY_ID } = NS.ores;

/* the data */
check('every operation names a real belt, mood and goal type', OPS.every(o => NS.ores.ZONE_BY_ID[o.zone] && MOODS[o.mood] && o.goals.length &&
  o.goals.every(g => ['bank', 'ore', 'value', 'stat', 'record'].indexOf(g.type) >= 0)));
check('the Kessler Drift has six operations ending in its capstone', O.zoneOps('kessler').length === 6 && O.capstoneOf('kessler').id === 'k_charter' &&
  O.zoneOps('kessler').filter(o => o.capstone).length === 1);
check('every threat names real pirates', OPS.every(o => !o.threat || Object.keys(o.threat.kinds).every(k => NS.ships.PIRATES[k])));
check('beats run forward in time', OPS.every(o => !o.beats || o.beats.every((b, i) => !i || b[0] > o.beats[i - 1][0])));
for (const z of ZONES) {
  const list = O.zoneOps(z.id);
  if (list.length) check(z.name + ' never puts two peaks in a row and lets you breathe after one', O.moodsOk(list));
}
check('the mood rule catches two peaks in a row', !O.moodsOk([{ mood: 'C' }, { mood: 'W' }, { mood: 'N' }]) && !O.moodsOk([{ mood: 'W' }, { mood: 'H' }, { mood: 'C' }]) &&
  O.moodsOk([{ mood: 'W' }, { mood: 'E' }, { mood: 'N' }]));

/* the loops a belt allows */
check('one loop per belt, in order', LOOPS.length === 5 && LOOPS.every((l, i) => l.from === i));
check('the Kessler Drift and the Amber Reach allow no outposts', !O.allows(0, 'outpost') && !O.allows(1, 'outpost'));
check('outposts from the Verdant Shoals on, warfare from the Crimson Maw', O.allows(2, 'outpost') && O.allows(4, 'outpost') && !O.allows(2, 'warfare') && O.allows(3, 'warfare'));
check('each belt names its own loop', O.loopOf(0).id === 'mining' && O.loopOf(1).id === 'escort' && O.loopOf(4).id === 'all');

/* opening */
let s = R.freshSave();
check('a fresh save has no operation records', s.v === 3 && s.ops && !Object.keys(s.ops).length && Array.isArray(s.unlocks));
check('the first operation is open, the rest locked', O.state(s, 'k_haul') === 'open' && O.state(s, 'k_copper') === 'locked' && O.state(s, 'k_charter') === 'locked');
check('the next operation opens after a win', (O.finish(s, OP_BY_ID.k_haul, true, 100), O.state(s, 'k_haul') === 'done' && O.state(s, 'k_copper') === 'open'));

/* the capstone gate */
s = R.freshSave();
s.stats.earned = 1e9;
check('the Amber licence waits for the Kessler capstone', R.zoneState(s, 1) === 'locked' && !O.licenceReady(s, 1));
for (const o of O.zoneOps('kessler')) O.finish(s, o, true, 60);
check('after the capstone it can be bought', O.licenceReady(s, 1) && R.zoneState(s, 1) === 'buyable');
check('a belt without operations yet does not hold the next licence back', (s.licenses.push('amber'), O.licenceReady(s, 2) && R.zoneState(s, 2) === 'buyable'));
check('earnings still count', (s.stats.earned = 0, R.zoneState(s, 2) === 'locked'));

/* progress */
const jump = OP_BY_ID.k_jumpers, haul = OP_BY_ID.k_haul, charter = OP_BY_ID.k_charter, drones = OP_BY_ID.k_drones;
const m = { units: 30, banked: { iron: 20, copper: 10 }, stats: { pirates: 7, geodes: 1, derelicts: 1, maxDrones: 0 }, base: { pirates: 2, geodes: 0, derelicts: 0, maxDrones: 0 } };
let p = O.progress(haul, m);
check('bank counts units banked', p[0].have === 30 && p[0].n === 60 && !p[0].done && !O.complete(haul, m));
p = O.progress(jump, m);
check('stat counts the rise since the operation began', p[0].have === 5 && !p[0].done);
check('value counts the ore\'s worth', O.progress(charter, m)[0].have === 20 * ORE_BY_ID.iron.value + 10 * ORE_BY_ID.copper.value);
check('stat goals sum several statistics', O.progress(OP_BY_ID.k_geode, m)[0].have === 2 && O.complete(OP_BY_ID.k_geode, m));
check('record goals look at the value reached', !O.progress(drones, m)[0].done && O.progress(drones, Object.assign({}, m, { stats: Object.assign({}, m.stats, { maxDrones: 1 }) }))[0].done);
check('progress never shows more than the goal', O.progress(haul, Object.assign({}, m, { units: 500 }))[0].have === 60);

/* results and rewards */
s = R.freshSave();
const cr = s.credits, rd = s.rd;
let r = O.finish(s, jump, false, 200);
check('a loss counts a try and pays nothing', !r.first && s.ops.k_jumpers.tries === 1 && !s.ops.k_jumpers.done && s.credits === cr);
r = O.finish(s, jump, true, 300);
check('the first win pays credits, research and unlocks', r.first && s.credits === cr + jump.reward.cr && s.rd === rd + jump.reward.rd && s.unlocks.indexOf('w_pulse') >= 0);
check('wins count toward the licence earnings', s.stats.earned === jump.reward.cr);
r = O.finish(s, jump, true, 250);
check('a replay pays nothing more but keeps the best time', !r.first && s.credits === cr + jump.reward.cr && s.ops.k_jumpers.best === 250 && s.ops.k_jumpers.tries === 3);
check('unlocks are never listed twice', s.unlocks.filter(u => u === 'w_pulse').length === 1);

/* the save migration */
const old = R.freshSave();
old.v = 2;
const nb = NS.colony.newBase;
old.bases = { kessler: nb('kessler'), amber: nb('amber'), verdant: nb('verdant') };
old.bases.kessler.buildings.push({ id: 1, type: 'hub', cx: 9, cy: 7, lvl: 1, hp: 1, prog: 1 });
old.bases.kessler.stock = { ore: { iron: 30 }, bar: { copper: 4 }, comp: { circuit: 2 } };
old.bases.amber.buildings.push({ id: 1, type: 'hub', cx: 9, cy: 7, lvl: 1, hp: 1, prog: 1 }, { id: 2, type: 'laser', cx: 3, cy: 3, lvl: 2, hp: 1, prog: 1 });
old.bases.verdant.buildings.push({ id: 1, type: 'hub', cx: 9, cy: 7, lvl: 1, hp: 1, prog: 1 });
old.store.ore.iron = 5;
const worth = NS.colony.baseValue(NS.colony.repairBases(old.bases).kessler) + NS.colony.baseValue(NS.colony.repairBases(old.bases).amber);
const mig = R.migrateSave(JSON.parse(JSON.stringify(old)));
check('the migration dismantles outposts in the Kessler Drift and the Amber Reach', !mig.bases.kessler && !mig.bases.amber && mig.bases.verdant && mig.v === 3);
check('their buildings come back as credits', mig.credits === old.credits + worth && worth > 0);
check('their stock moves to the station warehouse', mig.store.ore.iron === 35 && mig.store.bar.copper === 4 && mig.store.comp.circuit === 2);
check('the player is told once', mig.notices.length === 1 && /Kessler Drift/.test(mig.notices[0]) && /Amber Reach/.test(mig.notices[0]));
const again = R.migrateSave(JSON.parse(JSON.stringify(mig)));
check('a v3 save is not refunded twice', again.credits === mig.credits && again.notices.length === 1 && again.bases.verdant);
const kept = R.migrateSave({ v: 3, ops: { k_haul: { done: true, tries: 2, best: 99 }, bogus: { done: true } }, unlocks: ['w_pulse', 7] });
check('operation records and unlocks survive, unknown ones are dropped', kept.ops.k_haul.done && kept.ops.k_haul.tries === 2 && !kept.ops.bogus &&
  kept.unlocks.length === 1 && kept.unlocks[0] === 'w_pulse');
const res = R.freshSave();
res.v = 2;
res.bases = { kessler: nb('kessler') };
res.bases.kessler.buildings.push({ id: 1, type: 'hub', cx: 9, cy: 7, lvl: 1, hp: 1, prog: 1 });
res.resume = { v: 1, mode: 'career', zone: 0, seed: 1, run: { cargo: { iron: 3 } }, units: [{ type: 'fighter' }], enemies: [{ type: 'raider' }] };
const rm = R.migrateSave(JSON.parse(JSON.stringify(res)));
check('a trip in flight in such a belt resumes without its outpost fleet', rm.resume && rm.resume.run.cargo.iron === 3 && !rm.resume.units.length && !rm.resume.enemies.length);

/* the pacing director */
check('beats come from the timeline', PC.beatAt(jump.beats, 0) === 'build' && PC.beatAt(jump.beats, 150) === 'peak' && PC.beatAt(jump.beats, 235) === 'relief' &&
  PC.beatAt(null, 99) === 'build');
const th = jump.threat;
const calm = PC.next(th, 'build', 0.5), peak = PC.next(th, 'peak', 0.5), relief = PC.next(th, 'relief', 0.5);
check('peaks send waves sooner and bigger, relief later and smaller', peak.wait < calm.wait && relief.wait > calm.wait && peak.size >= calm.size && relief.size <= calm.size && relief.size >= 1);
const easy = PC.next(th, 'build', 0), hard = PC.next(th, 'build', 1);
check('a player who is crushing it gets pressed, one who is drowning gets air', easy.wait < calm.wait && hard.wait > calm.wait);
check('the adjustment stays within a quarter', PC.adjust(0) <= 1.25 && PC.adjust(1) >= 0.75 && Math.abs(PC.adjust(0.5) - 1) < 1e-9);
let pc = PC.create();
for (let i = 0; i < 600; ++i) PC.track(pc, { hullLost: 0.004, threats: 6, cap: 7 }, 1 / 60);
const hot = pc.tension;
for (let i = 0; i < 1200; ++i) PC.track(pc, { hullLost: 0, threats: 0, cap: 7 }, 1 / 60);
check('tension rises under fire and settles when it is quiet', hot > 0.6 && pc.tension < 0.15 && pc.peak >= hot);
pc = PC.create();
for (let i = 0; i < 600; ++i) PC.track(pc, { hullLost: 0, threats: 2, cap: 7 }, 1 / 60);
check('a few threats keep it moderate', pc.tension > 0.1 && pc.tension < 0.4);

done();
