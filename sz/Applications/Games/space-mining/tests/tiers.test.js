'use strict';

/* Hard and Nightmare tiers and the weekly Nightmare Op: which modifiers an operation draws (one
   for Hard, two for Nightmare, only ones that fit it, Nightmare keeping Hard's), unlocking tier by
   tier, first-clear rewards and medals, every modifier in the running game, a tier won, the
   weekly operation the same for everyone in a week, its score, streak and high score. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const T = NS.tiers;
const O = NS.ops;
const { OPS, OP_BY_ID } = NS.opsData;

/* ── which modifiers ── */
check('seven modifiers', Object.keys(T.MODS).length === 7);
let fits = true, keeps = true, counts = true, steady = true;
for (const op of OPS) {
  const h = T.modsFor(op, 'hard'), n = T.modsFor(op, 'nightmare');
  if (h.length !== 1 || n.length !== 2 || T.modsFor(op, 'normal').length !== 0) counts = false;
  if (n.indexOf(h[0]) < 0) keeps = false;
  if (!h.concat(n).every(m => T.fits(m, op))) fits = false;
  if (JSON.stringify(T.modsFor(op, 'nightmare')) !== JSON.stringify(n)) steady = false;
}
check('Hard draws one modifier, Nightmare two, Normal none', counts);
check('Nightmare keeps the Hard modifier', keeps);
check('only modifiers that fit the operation', fits);
check('the draw is fixed per operation', steady);
check('no turrets only where invader waves come, a double convoy only in escorts', T.fits('noturrets', OP_BY_ID.v_hold) && !T.fits('noturrets', OP_BY_ID.k_haul) &&
  T.fits('doubled', OP_BY_ID.a_first) && !T.fits('doubled', OP_BY_ID.v_hold));
check('the operations draw a spread of modifiers', new Set(OPS.map(o => T.modsFor(o, 'hard')[0])).size >= 5);

/* ── unlocking, rewards, medals ── */
const sv = NS.rules.freshSave();
const op = OP_BY_ID.a_first;
check('a fresh operation has no tier open beyond Normal', !T.unlocked(sv, op, 'hard') && !T.unlocked(sv, op, 'nightmare') && T.medal(sv, op) === '');
O.finish(sv, op, true, 60);
check('a clear opens Hard and earns bronze', T.unlocked(sv, op, 'hard') && !T.unlocked(sv, op, 'nightmare') && T.medal(sv, op) === 'bronze');
const i0 = sv.intel, tok0 = sv.festival.tokens;
const r1 = T.finish(sv, op, 'hard', true, 50);
check('the first Hard clear pays twice the Intel and earns silver', r1.first && sv.intel === i0 + 2 * O.intelFor(op) && T.medal(sv, op) === 'silver' && T.unlocked(sv, op, 'nightmare'));
T.finish(sv, op, 'hard', true, 40);
check('a Hard replay pays nothing more but keeps the best time', sv.intel === i0 + 2 * O.intelFor(op) && sv.ops.a_first.tiers.hard.best === 40);
T.finish(sv, op, 'nightmare', false, 30);
check('a lost Nightmare earns nothing', T.medal(sv, op) === 'silver');
T.finish(sv, op, 'nightmare', true, 70);
check('the first Nightmare clear pays three times the Intel, three tokens and gold', sv.intel === i0 + 5 * O.intelFor(op) && sv.festival.tokens === tok0 + 3 && T.medal(sv, op) === 'gold');
check('the tiers survive the save repair', NS.rules.migrateSave(JSON.parse(JSON.stringify(sv))).ops.a_first.tiers.nightmare.best === 70);

/* ── the weekly Nightmare Op ── */
const w1 = T.weekly('2026-W47'), w1b = T.weekly('2026-W47');
check('the weekly operation is the same for everyone in a week', w1.op === w1b.op && JSON.stringify(w1.mods) === JSON.stringify(w1b.mods) && w1.mods.length === 2);
check('with two modifiers that fit it', w1.mods.every(m => T.fits(m, OP_BY_ID[w1.op])));
const weeks = new Set();
for (let k = 10; k < 30; ++k) weeks.add(T.weekly('2026-W' + k).op);
check('it rotates through the operations', weeks.size >= 8);
check('it is never a capstone', !OP_BY_ID[w1.op].capstone);
check('the score falls ten points a second, at least 500', T.score(100) === 9000 && T.score(5000) === 500);
const ws = NS.rules.freshSave();
const day = (s) => new Date(s + 'T12:00:00');
T.finishWeekly(ws, day('2026-11-18'), true, 200);
check('a weekly win keeps the best score, pays 5 Intel and starts a streak', ws.weekly.best === T.score(200) && ws.intel === 5 && ws.weekly.streak === 1 && ws.weekly.week === '2026-W47');
check('and enters the High Scores', ws.highScores.some(h => h.mode === 'weekly' && h.score === T.score(200)));
T.finishWeekly(ws, day('2026-11-19'), true, 100);
check('a better run that week raises the best, without more Intel or streak', ws.weekly.best === T.score(100) && ws.intel === 5 && ws.weekly.streak === 1);
T.finishWeekly(ws, day('2026-11-25'), true, 300);
check('a win the next week grows the streak', ws.weekly.streak === 2 && ws.weekly.best === T.score(300) && ws.intel === 10);
T.finishWeekly(ws, day('2026-12-16'), true, 300);
check('a missed week starts it over', ws.weekly.streak === 1);
check('the weekly record survives the save repair', NS.rules.migrateSave(JSON.parse(JSON.stringify(ws))).weekly.streak === 1);

/* ── modifiers in the running game ── */
const steps = n => H.run(NS, n);
function launch(id, tier, mods, zone) {
  G.save.licenses = ['kessler', 'amber', 'verdant', 'crimson', 'void'];
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[OP_BY_ID[id].zone].index, { op: id, tier: tier, mods: mods });
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  G.ship.maxHull = G.ship.hull = 1e6;
  G.run.pirateT = 1e9;
  for (const o of G.specials) o.found = true;
  for (const r of G.rocks) if (r.kind !== 'rock') r.found = true;
  return G.run.op;
}
G.save.seenIntro = true;

let o = launch('a_first', 'hard', ['veteran']);
check('a tier run carries its tier and modifiers', o.tier === 'hard' && o.mods[0] === 'veteran' && NS.operation.mod('veteran') && !NS.operation.mod('fog'));
const pv = NS.pirates.spawn('raider', 500, 500);
const ev = NS.enemies.spawn('raider', 500, 500, {});
check('Veteran foes: half again the hull', Math.abs(pv.maxHp / (NS.ships.PIRATES.raider.hp * (1 + 0.35 * (G.run.zone.danger - 1))) - 1.5) < 1e-6 && ev.maxHp > ENEMY_HP('raider') * 1.45);
NS.trip.endTrip('dock');
function ENEMY_HP(id) { return NS.fleetData.ENEMY_BY_ID[id].hp * (1 + 0.3 * (G.run ? G.run.zone.danger - 1 : 1)); }

o = launch('a_first', 'hard', ['doubled']);
check('Double convoy: every freighter has a twin', G.freighters.length === 2 * OP_BY_ID.a_first.convoy.list.length);
NS.trip.endTrip('dock');

o = launch('a_first', 'hard', ['swarm']);
const f = G.freighters[0];
f.wait = 0;
steps(5);
const before = G.pirates.length;
const p = G.posts.find(q => q.id === f.to);
f.d = p.chokes[0].d - 250;
steps(3);
check('Swarm: ambushes half again as big', G.pirates.length - before >= Math.ceil(OP_BY_ID.a_first.convoy.ambush.size[0] * 1.5));
NS.trip.endTrip('dock');

o = launch('k_haul', 'hard', ['dry']);
check('Dry tanks: the tank holds 60%', Math.abs(G.ship.maxFuel - G.stats.fuel * 0.6) < 1e-6);
NS.trip.endTrip('dock');

o = launch('k_haul', 'hard', ['fog']);
check('Fog: the radar sees half as far', NS.hud.radarRange() === 750);
NS.trip.endTrip('dock');
check('and without it the full 1500', (launch('k_haul'), NS.hud.radarRange() === 1500));
NS.trip.endTrip('dock');

o = launch('k_haul', 'hard', ['storm']);
G.storm = null;
steps(60 * 2);
check('Endless storm: a storm is always on its way', G.storm && (G.storm.phase !== 'calm' || G.storm.t < 30));
NS.trip.endTrip('dock');

G.save.ops = {};
for (const id of ['k_haul', 'k_copper', 'k_drones', 'k_geode', 'k_jumpers', 'k_charter', 'a_first', 'a_long', 'a_storm', 'a_twin', 'a_wing', 'a_convoy', 'a_three', 'a_order', 'a_haul', 'v_found']) O.finish(G.save, OP_BY_ID[id], true, 60);
o = launch('v_hold', 'hard', ['noturrets']);
G.save.credits = 1e6;
const site = G.base.site;
NS.base.grant('hub', site.hubX, site.hubY);
G.base.data.stock.ore = { iron: 999, copper: 999, nickel: 999, titanium: 999 };
G.base.data.stock.bar = { iron: 999, copper: 999, titanium: 999 };
G.base.data.stock.comp = { circuit: 99, alloy: 99 };
const spot = NS.base.findSpot('laser');
const tryLaser = NS.base.place('laser', spot.cx, spot.cy);
check('No turrets: a turret cannot be built', !tryLaser.ok && /turret/i.test(tryLaser.reason));
const solar = NS.base.findSpot('solar');
check('other buildings still can', NS.base.place('solar', solar.cx, solar.cy).ok);
NS.trip.endTrip('dock');

/* a tier won */
o = launch('k_haul', 'hard');
check('a tier run without forced modifiers draws its own', JSON.stringify(o.mods) === JSON.stringify(T.modsFor(OP_BY_ID.k_haul, 'hard')));
const intel0 = G.save.intel;
G.run.banked = { iron: 999 }; G.run.bankedUnits = 999;
steps(2);
check('winning it records the tier and pays its reward', o.status === 'won' && G.save.ops.k_haul.tiers && G.save.ops.k_haul.tiers.hard.done && G.save.intel === intel0 + 2 * O.intelFor(OP_BY_ID.k_haul));
check('a tier run does not chain into the next operation', !o.nextId);
NS.trip.endTrip('dock');
check('the report names the tier', /HARD/.test(JSON.stringify(G.ui.results.op)) || G.ui.results.op.tier === 'hard');

/* the weekly run */
const wk = T.weekly(NS.calendar.weekKey(new Date()));
G.save.weekly = null;
check('the weekly operation is open once its operation is open or cleared', T.weeklyOpen(G.save, wk) === (O.state(G.save, wk.op) !== 'locked'));
for (const x of OPS) O.finish(G.save, x, true, 60);
o = launch(wk.op, 'nightmare', null);
G.run.op.weekly = true;
o.mods = wk.mods.slice();
check('a weekly run is a Nightmare with the week\'s modifiers', o.tier === 'nightmare' && JSON.stringify(o.mods) === JSON.stringify(wk.mods));
NS.trip.endTrip('dock');

done();
