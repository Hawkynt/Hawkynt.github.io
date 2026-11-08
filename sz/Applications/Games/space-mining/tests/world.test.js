'use strict';

/* The belt in motion: the spatial grid, seeded belt generation, fracture into children and
   nuggets, volatile chains, the laser ray cast, the tractor beam and a full hold, drones
   unloading, docking, and how much of the hold each ending keeps. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const A = NS.asteroids, M = NS.mining;
const { ROCK_RADII } = NS.constants;

/* grid */
const grid = NS.grid.createGrid(2000, 2000, 100);
const objs = [];
for (let i = 0; i < 200; ++i) { const o = { x: (i * 97) % 2000, y: (i * 61) % 2000, r: 10 }; objs.push(o); grid.insert(o); }
const out = [];
grid.query(1000, 1000, 150, out);
const brute = objs.filter(o => Math.abs(o.x - 1000) <= 260 && Math.abs(o.y - 1000) <= 260 && Math.hypot(o.x - 1000, o.y - 1000) <= 160);
check('a grid query finds every close object', brute.every(o => out.indexOf(o) >= 0));
check('a grid query returns each object once', new Set(out).size === out.length);
const seg = [];
grid.querySegment(0, 0, 2000, 2000, 20, seg);
check('a segment query finds objects on the line', objs.filter(o => Math.abs(o.x - o.y) < 5).every(o => seg.indexOf(o) >= 0));

/* generation */
NS.trip.startTrip('career', 0);
NS.cinematics.skip();
H.run(NS, 30);
const n0 = G.rocks.length;
check('a belt holds a few hundred rocks', n0 > 200 && n0 < 460, n0);
check('the dock has open space around it', G.rocks.every(r => Math.hypot(r.x - G.dock.x, r.y - G.dock.y) > 300));
const seed = G.run.seed;
const first = G.rocks.slice(0, 5).map(r => r.ore + r.tier).join();
NS.trip.startTrip('career', 0);
check('the same seed builds the same belt', G.run.seed === seed && G.rocks.slice(0, 5).map(r => r.ore + r.tier).join() === first);
check('rocks carry only ores of their belt', G.rocks.every(r => !r.ore || r.ore in NS.ores.ZONES[0].ores));

/* fracture */
NS.cinematics.skip();
const big = G.rocks.find(r => r.tier === 4 && r.ore && r.kind === 'rock');
const before = G.rocks.length, nug0 = G.nuggets.length;
A.damage(big, big.maxHp + 1, big.x, big.y, 'laser');
check('a broken rock is gone', !big.alive);
const kids = G.rocks.filter(r => r.alive && r.tier === 3 && Math.hypot(r.x - big.x, r.y - big.y) < big.r);
check('a big rock splits into three smaller ones', kids.length === 3 && G.rocks.length === before + 3);
check('children keep the ore', kids.every(k => k.ore === big.ore));
check('fractures spill ore nuggets', G.nuggets.length > nug0 && G.nuggets.slice(nug0).every(n => n.ore === big.ore));
check('a fracture counts', G.run.fractures === 1 && G.save.stats.fractures >= 1);
const small = G.rocks.find(r => r.alive && r.tier === 1 && r.ore);
const c1 = G.rocks.filter(r => r.alive).length;
A.damage(small, 999, small.x, small.y, 'laser');
check('the smallest rocks crumble completely', !small.alive && G.rocks.filter(r => r.alive).length === c1 - 1);
check('hit points grow with size and hardness', A.rockHp(4, 'iron', 1) > A.rockHp(1, 'iron', 1) && A.rockHp(2, 'iron', 2) > A.rockHp(2, 'iron', 1));

/* volatile chain */
const vx = G.ship.x + 2000, vy = G.ship.y;
const v1 = A.makeRock(vx, vy, 2, 'iron', 1, Math.random), v2 = A.makeRock(vx + 120, vy, 2, 'iron', 1, Math.random);
v1.volatile = v2.volatile = true;
G.rocks.push(v1, v2);
A.rebuildGrid();
A.fracture(v1, vx, vy);
check('a volatile rock lights its neighbour', v2.fuse > 0 && v2.fuse < 1);
H.run(NS, 30);
check('the neighbour goes off too', !v2.alive && G.save.stats.bestChain >= 2);

/* laser ray cast */
const target = G.rocks.find(r => r.alive && r.kind === 'rock' && r.tier >= 2);
const hitObj = M.raycast(target.x - target.r - 100, target.y, target.x + target.r + 100, target.y);
check('the laser stops at the first rock in line', hitObj === target || (hitObj && Math.hypot(hitObj.x - target.x, hitObj.y - target.y) < target.r + hitObj.r + 200));
check('the laser misses empty space', M.raycast(-500, -500, -400, -400) === null);

/* tractor and hold */
const s = G.ship;
G.nuggets.length = 0;
M.spawnNugget(s.x + 60, s.y, 'copper', 1, null, 1);
G.nuggets[0].age = 1;
H.run(NS, 60);
check('the tractor beam pulls a nugget into the hold', G.run.cargo.copper === 1 && G.nuggets.length === 0);
G.run.cargoUsed = G.run.cargoMax;
M.spawnNugget(s.x + 60, s.y, 'iron', 1, null, 1);
G.nuggets[0].age = 1;
H.run(NS, 60);
check('a full hold leaves nuggets floating', G.nuggets.length === 1 && !G.run.cargo.iron);
G.run.cargoUsed = 1;

/* drones */
NS.save.refreshStats();
G.stats.drones = 1;
NS.drones.setup(G.stats);
const d = G.drones[0];
d.ore = 'silver'; d.load = 3; d.state = 'return'; d.x = s.x + 300; d.y = s.y;
H.run(NS, 120);
check('a drone flies home and unloads its basket', G.run.cargo.silver === 3 && d.state !== 'return');

/* docking banks the hold; returning home ends the trip */
s.x = G.dock.x + 20; s.y = G.dock.y; s.vx = s.vy = 0; G.run.leftDock = true;
H.run(NS, 4);
check('slow flight into the ring banks the hold and keeps flying', !G.cine && G.screen === 'playing' && G.run.bankedUnits >= 4);
NS.trip.returnHome();
H.run(NS, 60 * 4);
check('docking ends in the trip report', G.screen === 'results' && G.ui.results.reason === 'dock');
check('the hold reaches the warehouse', G.save.store.ore.copper >= 1 && G.save.store.ore.silver >= 3);
check('a market cycle passed', G.save.cycle >= 1);

/* endings */
const st = NS.rules.computeStats(NS.rules.freshSave());
check('a tow keeps half the hold', NS.trip.keepShare('tow', st) === 0.5);
check('a lost ship keeps nothing', NS.trip.keepShare('destroyed', st) === 0);
check('the emergency jump keeps 85%', NS.trip.keepShare('destroyed', Object.assign({}, st, { jump: true })) === 0.85);

/* hazards wired per belt */
NS.trip.startTrip('career', 2);
check('Verdant Shoals has radiation fields', G.radZones.length === 4);
NS.trip.startTrip('career', 3);
check('Crimson Maw has gravity wells and storms', G.wells.length === 3 && !!G.storm);
NS.trip.startTrip('daily', 0);
const dz = G.run.zone.id;
NS.trip.startTrip('daily', 0);
check('the Daily Belt is the same belt all day', G.run.zone.id === dz && G.run.timeLeft === 240);

done();
