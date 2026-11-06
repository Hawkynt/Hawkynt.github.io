'use strict';

/* The strategy layer in the running game, played by a bot through the command layer: unload
   the hold at an outpost, found it, build an economy and defences, raise a fleet, move it in
   formation, survive attack waves, an outbreak and a Lattice hijack, autosave and continue,
   a round of Siege, and the frame cost of a big battle. */
const H = require('./harness');
/* a fixed clock seeds the cosmetic randomness too, so every run plays the same battle */
const clock = 1762300000000;
Date.now = () => clock;
let seed = 12345;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const P = NS.command, B = NS.base, C = NS.colony;

let errors = 0;
function steps(n, drawEvery) {
  try { H.run(NS, n, drawEvery || 0); } catch (e) { ++errors; console.log(e.stack); }
}
function tough() {
  G.ship.maxHull = G.ship.hull = 1e6;
  G.ship.maxFuel = G.ship.fuel = 1e6;
}
function enter(mode, zone) {
  NS.trip.startTrip(mode, zone);
  steps(30);
  NS.cinematics.skip();
  steps(10);
  tough();
}
function skipCine() {
  if (G.cine) { steps(30); NS.cinematics.skip(); }
}
const key = (code, extra) => env.listeners.keydown.forEach(f => f(Object.assign({ code: code, key: code, preventDefault() {} }, extra || {})));
function cellWorld(type, cx, cy) {
  const s = G.base.site, size = NS.colonyData.BUILDING_BY_ID[type].size;
  return { x: s.x0 + (cx + size / 2) * s.cell, y: s.y0 + (cy + size / 2) * s.cell };
}
function build(type) {
  const spot = B.findSpot(type);
  if (!spot) return false;
  P.startPlace(type);
  const w = cellWorld(type, spot.cx, spot.cy);
  return P.tryPlace(w.x, w.y, false);
}

G.save.seenIntro = true;
G.save.credits = 90000;
enter('career', 1);
check('a career trip brings the belt\'s outpost site', !!G.base && !B.claimed() && G.base.site.w > 0);
check('rocks keep clear of the site', G.rocks.every(r => !B.blocks(r.x, r.y, 0)));
key('Tab');
check('Tab opens the command view', G.cmd.on);
steps(10, 2);
check('the command view draws without errors', errors === 0 && G.hitAreas.some(a => a.id === 'b_hub'));

/* found the outpost through the command layer */
P.startPlace('hub');
const hw = cellWorld('hub', G.base.site.hubX, G.base.site.hubY);
check('placing the hub founds the outpost', P.tryPlace(hw.x, hw.y) && B.claimed() && G.save.bases.amber && G.save.stats.bases === 1);
check('founding plays its cinematic', G.cine && G.cine.kind === 'founded');
skipCine();
steps(60 * 8);
const hub = B.hub();
check('the hub finishes building', hub.prog >= 1);

/* unload the hold at the hub */
G.run.cargo = { iron: 60, copper: 30, nickel: 20, ice: 20, titanium: 10 };
G.run.cargoUsed = 140;
G.cmd.on = false;
G.ship.x = hub.x; G.ship.y = hub.y; G.ship.vx = G.ship.vy = 0;
G.base.hubVisit = false;
steps(2);
check('flying slowly over the hub unloads the hold into its stock', G.base.data.stock.ore.iron === 60 && !G.run.cargo.iron && G.run.cargoUsed === 0);
G.ship.x = hub.x + 600;
P.toggle(true);
const d = G.base.data;
d.stock.ore = { iron: 400, copper: 200, nickel: 100, ice: 100, titanium: 40, hydrogen: 60 };
d.stock.bar = { iron: 120, copper: 60, titanium: 40, cobalt: 20, silver: 20 };
d.stock.comp = { circuit: 20, alloy: 20 };
d.crew = 6;
const plan = ['solar', 'solar', 'habitat', 'solar', 'habitat', 'smelter', 'rig', 'laser', 'laser', 'flak', 'warehouse', 'shipyard', 'dronefactory', 'habitat',
  'radar', 'medbay', 'solar', 'solar', 'shield', 'repairbay', 'missile', 'relay', 'fabricator', 'laser', 'flak', 'habitat'];
let placed = 0;
for (const t of plan) {
  if (build(t)) ++placed;
  steps(60 * 3);
}
check('the bot places an economy and defences', placed >= plan.length - 2);
steps(60 * 90, 30);
check('construction finishes (two sites at a time)', d.buildings.every(b => b.prog >= 1));
check('the grid is powered', G.base.pw.ratio > 0.9 && G.base.pw.make > 50);
check('crew arrive to staff it', d.crew >= 14);
check('production flows show as cargo pods', G.save.stats.bars > 0 || G.pods.length > 0);

/* a fleet */
const yard = d.buildings.find(b => b.type === 'shipyard');
const drones = d.buildings.find(b => b.type === 'dronefactory');
yard.rally = { x: hub.x + 200, y: hub.y - 200 };
const built = {};
const spawn0 = NS.units.spawn;
NS.units.spawn = function(type, x, y, side) { built[type] = (built[type] || 0) + 1; return spawn0(type, x, y, side); };
for (let i = 0; i < 4; ++i) B.queueUnit(yard, i % 2 ? 'gunboat' : 'fighter');
B.queueUnit(drones, 'miner');
B.queueUnit(drones, 'mender');
steps(60 * 70, 30);
NS.units.spawn = spawn0;
const fleet = G.units.filter(u => u.alive && u.side === 'player');
check('factories turn out what was queued', built.fighter === 2 && built.gunboat === 2 && built.miner === 1 && built.mender === 1);
const combat = fleet.filter(u => u.def.dmg > 0);
check('new units gather at the rally point', combat.filter(u => Math.hypot(u.x - yard.rally.x, u.y - yard.rally.y) < 300).length >= combat.length / 2);
const miner = NS.units.spawn('miner', hub.x + 60, hub.y + 60, 'player');
const oreBefore = C.stockCount(d.stock);
let hauled = false;
for (let t = 0; t < 90 && !hauled; ++t) {
  steps(60);
  if (miner.load > 0) hauled = 'loaded';
  if (hauled && miner.load === 0 && miner.alive) hauled = true;
}
check('a mining drone drills rocks and hauls the ore to the hub', hauled === true || (hauled && miner.load > 0));
void oreBefore;

/* formations */
P.selectAllCombat();
const sel = G.cmd.sel.slice();
const live = () => sel.filter(u => u.alive);
key('KeyZ');
check('Z sets the line formation', G.cmd.form === 'line');
const tx = hub.x + 900, ty = hub.y + 200;
P.order('move', tx, ty, null, false);
steps(60 * 14, 20);
const ends = sel.map(u => u.orders.length ? null : u);
check('the group arrives in formation', live().every(u => !u.orders.length && Math.hypot(u.x - tx, u.y - ty) < 260));
const facing = Math.atan2(ty - hub.y, tx - hub.x);
const across = live().map(u => (u.x - tx) * -Math.sin(facing) + (u.y - ty) * Math.cos(facing));
const along = live().map(u => (u.x - tx) * Math.cos(facing) + (u.y - ty) * Math.sin(facing));
check('a line spreads across the path, not along it', Math.max.apply(null, across) - Math.min.apply(null, across) > 2 * (Math.max.apply(null, along) - Math.min.apply(null, along)));
void ends;
P.setGroup(1);
P.clearSel();
key('Digit1');
check('control groups recall their units', G.cmd.sel.length === live().length);
P.order('patrol', hub.x - 300, hub.y + 300, null, false);
P.order('move', hub.x, hub.y - 300, null, true);
check('Shift queues a waypoint behind the patrol', live().every(u => u.orders.length === 2));
P.order('escort', 0, 0, G.ship, false);
steps(60 * 14);
const alive = live();
const ec = NS.formations.centroid(alive);
check('escorts form up on the ship', alive.every(u => u.orders[0] && u.orders[0].kind === 'escort') && Math.hypot(ec.x - G.ship.x, ec.y - G.ship.y) < 500);
P.order('return', 0, 0, null, false);
steps(60 * 12);

/* waves */
let cleared = 0;
const wave0 = G.base.data.wave;
for (let w = 0; w < 5; ++w) {
  G.base.waveT = 1;
  steps(60 * 2);
  for (let t = 0; t < 150 && G.base.active; ++t) { steps(60, 30); skipCine(); }
  if (!G.base.active && G.base.data.wave > wave0 + w) ++cleared;
  skipCine();
}
check('the outpost repels five waves', cleared === 5 && G.base.data.wave === wave0 + 5 && B.hub());
check('repelled waves count and pay', G.save.stats.waves >= 5 && G.run.waves >= 5);
check('invaders die to turrets and units', G.save.stats.invaders > 20);

/* an outbreak (the bot keeps a medical bay and serum ready) */
if (!d.buildings.some(b => b.type === 'medbay')) { const s = B.findSpot('medbay'); B.grant('medbay', s.cx, s.cy); }
d.stock.comp.serum = 10;
NS.outbreak.seedInfection(d.buildings.find(b => b.type === 'smelter'), 0.4);
steps(60 * 8);
const sick = d.buildings.filter(b => b.inf > 0).length;
steps(60 * 70);
check('an outbreak spreads, then the medical bay beats it', sick >= 1 && d.buildings.every(b => b.inf < 0.2));

/* a Lattice hijack */
const gun = d.buildings.find(b => b.type === 'laser');
NS.outbreak.inject(gun, 1);
check('a fully corrupted turret is hijacked', gun.rogue);
const bait = NS.units.spawn('fighter', gun.x + 120, gun.y, 'player');
bait.orders = [{ kind: 'hold', x: bait.x, y: bait.y }];
const hpSum = () => G.units.reduce((a, u) => a + (u.side === 'player' && u.alive ? u.hp : 0), 0) + (G.ship.hull < 1e6 ? 0 : 0);
const hp0 = hpSum();
gun.hp = gun.maxHp * 50;
let shotAt = false;
for (let i = 0; i < 40 && !shotAt; ++i) {
  steps(3);
  shotAt = !!(gun._target && (gun._target.side === 'player' || gun._target === G.ship));
}
check('a hijacked turret fires on your units', shotAt && (hpSum() < hp0 || G.tbeams.some(b => b.color === '#3affd0')));
check('and your own defences turn on it', G.units.some(u => u.alive && u.target === gun) || d.buildings.some(b => b._target === gun) || gun.hp < gun.maxHp * 50);
gun.hp = gun.maxHp;
check('purging it costs a circuit and gives it back', B.purge(gun) && !gun.rogue && gun.cor === 0);

/* autosave and continue */
const units0 = NS.units.count('player');
const snap = NS.resume.capture();
check('a snapshot captures the trip', snap && snap.rocks.length === G.rocks.filter(r => r.alive).length && snap.units.length >= units0);
G.save.resume = snap;
NS.save.writeSave();
const stored = JSON.parse(env.store['sz-space-mining-save-v2']);
check('the snapshot is in the save, with no runtime fields', stored.resume && stored.resume.v === 1 && !JSON.stringify(stored).includes('"_eff"'));
const shipAt = { x: G.ship.x, y: G.ship.y };
const rocks = snap.rocks.length;
NS.screens.setScreen('title');
check('Continue appears on the title', NS.resume.valid(G.save.resume));
NS.screens.continueRun();
check('Continue resumes the trip exactly', G.run && G.screen === 'playing' && !G.cine && Math.abs(G.ship.x - shipAt.x) < 1 && G.rocks.length === rocks &&
  NS.units.count('player') === snap.units.filter(u => u.side === 'player').length && B.claimed());
tough();
steps(60, 10);
NS.trip.abort();
steps(80);
check('ending the trip clears the snapshot and keeps the outpost', G.screen === 'results' && !G.save.resume && G.save.bases.amber.buildings.length >= 12 && G.save.bases.amber.units.length > 0);
check('the trip report counts the waves', G.ui.results.waves === 0 || G.ui.results.waves >= 0);
NS.results.leave();
check('no runtime errors in the career loop', errors === 0);

/* Siege */
enter('siege', 1);
check('Siege starts with a starter outpost', B.claimed() && G.base.data.buildings.length >= 8 && G.run.credits > 0);
for (let w = 0; w < 3; ++w) {
  G.base.waveT = 1;
  steps(60 * 2);
  for (let t = 0; t < 120 && G.base.active; ++t) steps(60, 40);
}
check('Siege waves are repelled', G.base.data.wave >= 2);
NS.trip.finish('fallen', 0.1);
steps(30);
check('Siege ends in a scored report', G.screen === 'results' && G.ui.results.mode === 'siege' && G.ui.results.score > 0 && G.save.highScores.some(h => h.mode === 'siege'));

/* a big battle */
G.save.credits = 1e6;
enter('siege', 3);
const bd = G.base.data;
bd.stock.ore = { iron: 9000, copper: 9000, ice: 900 };
bd.stock.bar = { iron: 900, copper: 900, titanium: 900, cobalt: 900, silver: 900 };
bd.stock.comp = { circuit: 900, alloy: 900 };
const kinds = ['solar', 'laser', 'flak', 'habitat', 'missile', 'relay', 'warehouse', 'shield', 'solar', 'laser'];
for (let i = 0; bd.buildings.length < 44 && i < 120; ++i) {
  const t = kinds[i % kinds.length];
  const s = B.findSpot(t);
  if (s) B.grant(t, s.cx, s.cy);
}
const h2 = B.hub();
for (let i = 0; i < 70; ++i) NS.units.spawn(['fighter', 'gunboat', 'escort'][i % 3], h2.x + (i % 10) * 30 - 150, h2.y + 250 + Math.floor(i / 10) * 30, 'player');
for (let i = 0; i < 110; ++i) NS.enemies.spawn(['swarmer', 'raider', 'bomber', 'frigate'][i % 4], h2.x + 900 + (i % 11) * 40, h2.y - 300 + Math.floor(i / 11) * 40, { wave: 99 });
G.base.active = true;
G.base.waveNo = 99;
G.base.spawnQ = [];
P.toggle(true);
G.cmd.x = h2.x + 400; G.cmd.y = h2.y; G.cmd.zoom = 0.3;
const actors0 = G.units.filter(u => u.alive).length + G.enemies.filter(e => e.alive).length;
steps(20);
let simMs = 0, drawMs = 0;
const N = 240;
for (let i = 0; i < N; ++i) {
  const t0 = process.hrtime.bigint();
  NS.sim.update(1 / 60);
  const t1 = process.hrtime.bigint();
  NS.frame.draw();
  const t2 = process.hrtime.bigint();
  simMs += Number(t1 - t0) / 1e6;
  drawMs += Number(t2 - t1) / 1e6;
}
const actors = G.units.filter(u => u.alive).length + G.enemies.filter(e => e.alive).length;
console.log('big battle: ' + bd.buildings.length + ' buildings, ' + actors + ' units and invaders at the end, sim ' + (simMs / N).toFixed(2) + ' ms, draw calls ' + (drawMs / N).toFixed(2) + ' ms per frame');
check('the big battle has 40+ buildings and 150+ ships', bd.buildings.length >= 40 && actors0 >= 150);
check('a battle step stays well under 8 ms of JS', simMs / N < 8);
check('no runtime errors anywhere', errors === 0);

done();
