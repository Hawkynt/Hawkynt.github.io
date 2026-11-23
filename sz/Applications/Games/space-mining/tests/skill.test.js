'use strict';

/* Mission score and adaptive difficulty: the score from the outcome, what was kept, progress and
   activity (actions per second counted from control changes); the difficulty level it moves; the
   multipliers the level gives to hulls, numbers and pace in the running game; the weekly run
   leaving the level alone; and escorts that need the ship nearby - an unescorted freighter
   waits and gets raided. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const S = NS.skill;
const { OP_BY_ID } = NS.opsData;

/* ── pure rules ── */
check('activity is actions per second, full at one a second', S.activity(0) === 0 && S.activity(0.5) === 0.5 && S.activity(3) === 1);
check('a perfect win scores 100', S.score({ won: true, hull: 1, kept: 1, aps: 1 }) === 100);
check('a bare win with nothing kept and no activity scores 50', S.score({ won: true, hull: 0, kept: 0, aps: 0 }) === 50);
check('a loss scores progress and activity only', Math.abs(S.score({ won: false, progress: 0.5, aps: 0.5 }) - 17.5) < 1e-9);
check('nothing to guard counts as all of it kept', S.score({ won: true, hull: 1, kept: null, aps: 1 }) === 100);
const lv = S.blank();
check('a career starts at difficulty 1', lv.level === 1);
S.update(lv, 80);
check('a score above 60 raises the level (80 -> +0.12)', Math.abs(lv.level - 1.12) < 1e-9 && lv.n === 1 && lv.last === 80);
S.update(lv, 60);
check('60 leaves it alone', Math.abs(lv.level - 1.12) < 1e-9);
S.update(lv, 100);
check('a single operation moves it at most 0.15', Math.abs(lv.level - 1.27) < 1e-9);
const e1 = S.blank(); S.update(e1, 100, 'E');
const e2 = S.blank(); S.update(e2, 30, 'E');
const n1 = S.blank(); S.update(n1, 70, 'N');
check('an aced breather barely moves it, a lost one drops it hard', Math.abs(e1.level - 1.06) < 1e-9 && Math.abs(e2.level - 0.85) < 1e-9);
check('a good nightmare raises it well', Math.abs(n1.level - 1.12) < 1e-9);
for (let i = 0; i < 50; ++i) S.update(lv, 0);
check('never below 0.6', lv.level === 0.6);
for (let i = 0; i < 100; ++i) S.update(lv, 100);
check('never above 2.5', lv.level === 2.5);
const d1 = S.diff(1), d2 = S.diff(2), d06 = S.diff(0.6);
check('at level 1 nothing changes', d1.hp === 1 && d1.dmg === 1 && d1.size === 1 && d1.pace === 1 && d1.income === 1);
check('at level 2: hull x1.5, damage x1.3, numbers x1.6, pace x1.4, income x1.5', d2.hp === 1.5 && Math.abs(d2.dmg - 1.3) < 1e-9 && Math.abs(d2.size - 1.6) < 1e-9 && Math.abs(d2.pace - 1.4) < 1e-9 && d2.income === 1.5);
check('below 1 it eases', d06.hp < 1 && d06.dmg < 1 && d06.size < 1 && d06.pace < 1);
check('the level survives the save repair', NS.rules.migrateSave(JSON.parse(JSON.stringify(Object.assign(NS.rules.freshSave(), { skill: { level: 1.7, n: 4, last: 80 } })))).skill.level === 1.7);
check('a new career has a level of 1', NS.rules.freshSave().skill.level === 1);

/* ── in the running game ── */
const steps = n => H.run(NS, n);
function launch(id, opts) {
  G.save.licenses = ['kessler', 'amber', 'verdant', 'crimson', 'void'];
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[OP_BY_ID[id].zone].index, Object.assign({ op: id }, opts || {}));
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  G.ship.maxHull = G.ship.hull = 1e6;
  G.ship.control = true;
  G.run.pirateT = 1e9;
  for (const o of G.specials) o.found = true;
  for (const r of G.rocks) if (r.kind !== 'rock') r.found = true;
  return G.run.op;
}
G.save.seenIntro = true;

/* actions */
let o = launch('k_haul');
steps(60);
check('a pilot who sits still takes no actions', o.actions === 0);
for (let k = 0; k < 10; ++k) {
  G.input.keys.Space = k % 2 === 1;
  G.input.rightDown = k % 3 === 0;
  steps(6);
}
G.input.keys.Space = false; G.input.rightDown = false;
check('control changes count as actions', o.actions >= 8);
NS.command.order('return', 0, 0, null, false, []);
const a0 = o.actions;
NS.skill.act();
check('orders and builds count through act()', o.actions === a0 + 1);
NS.trip.endTrip('dock');

/* the level scales the opposition */
G.save.skill.level = 2;
o = launch('a_first');
check('the operation remembers the difficulty it started at', o.diff === 2);
const p = NS.pirates.spawn('raider', 500, 500);
const base = NS.ships.PIRATES.raider.hp * (1 + 0.35 * (G.run.zone.danger - 1));
check('pirates have x1.5 hull at level 2', Math.abs(p.maxHp / base - 1.5) < 1e-6);
const e = NS.enemies.spawn('swarmer', 500, 500, {});
check('enemies too', Math.abs(e.maxHp / (NS.fleetData.ENEMY_BY_ID.swarmer.hp * (1 + 0.3 * (G.run.zone.danger - 1))) - 1.5) < 1e-6);
check('ambushes, threats and fronts come x1.6 as many', Math.abs(NS.operation.sized(5) - 8) < 1e-9);
NS.trip.endTrip('dock');
G.save.skill.level = 1;

/* a won operation raises the level, an idle loss lowers it */
o = launch('k_haul');
for (let k = 0; k < 120; ++k) { G.input.keys.Space = k % 2 === 1; steps(2); }
G.input.keys.Space = false;
G.run.banked = { iron: 999 }; G.run.bankedUnits = 999;
steps(2);
check('a won operation is scored', o.status === 'won' && o.score > 60);
check('and the level rises', G.save.skill.level > 1 && G.save.skill.last === o.score);
NS.trip.endTrip('dock');
check('the trip report carries the mission score and the level', G.ui.results.op.score === o.score && G.ui.results.op.level === G.save.skill.level);
const up = G.save.skill.level;
o = launch('k_copper');
steps(60 * 5);
NS.trip.endTrip('dock');
check('an idle operation given up scores low and lowers the level', G.save.skill.level < up);

/* the weekly run is scored but leaves the level alone */
const lw = G.save.skill.level;
for (const x of NS.opsData.OPS) NS.ops.finish(G.save, x, true, 60);
o = launch('k_haul', { tier: 'nightmare', weekly: true });
G.run.banked = { iron: 999 }; G.run.bankedUnits = 999;
steps(2);
check('a weekly win leaves the difficulty level alone', o.status === 'won' && G.save.skill.level === lw);
NS.trip.endTrip('dock');

/* a due freighter waits at the dock for its escort, then leaves alone */
o = launch('a_first');
let g = G.freighters[0];
G.ship.x = 200; G.ship.y = 200;
g.wait = 0;
steps(60 * 5);
check('a due freighter waits at the dock while its escort is away', g.state === 'wait' && g.due > 0);
steps(60 * (NS.escort.FREIGHTER.patience - 3));
check('its patience gone, it leaves alone', g.state === 'fly');
NS.trip.endTrip('dock');

/* escorts need the ship nearby */
o = launch('a_first');
const f = G.freighters[0];
f.wait = 0;
G.ship.x = f.x + 200; G.ship.y = f.y;
steps(60 * 2);
const d0 = f.d;
check('with the ship close the freighter flies', d0 > 20 && !f.alone);
G.ship.x = 200; G.ship.y = 200;
steps(60 * 3);
const d1b = f.d;
steps(60 * 2);
check('without its escort it holds and waits', Math.abs(f.d - d1b) < 1e-6 && f.alone > 0);
const before = G.pirates.filter(q => q.alive && q.prey === f).length;
steps(60 * 9);
check('twelve seconds alone, pirates raid it', G.pirates.filter(q => q.alive && q.prey === f).length > before);
G.ship.x = f.x + 150; G.ship.y = f.y;
steps(60 * 2);
check('back with its escort it flies on', f.d > d1b + 10 && !f.alone);
NS.trip.endTrip('dock');

done();
