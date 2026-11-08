'use strict';

/* Flying a trip: the laser fires along the heading and locks onto the ore closest to the nose
   inside its cone - the ship turns only slowly toward it; docking in the career banks the hold in
   the warehouse, services the ship and lets the flight go on - the trip ends only when the pilot
   asks for it; drones with no room in a full hold haul their baskets to the station and fly
   back out on their own. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const M = NS.mining;
const { angleDiff } = NS.rng;

NS.trip.startTrip('career', 0);
for (let i = 0; i < 20 && G.cine; ++i) { NS.cinematics.skip(); H.run(NS, 30); }
for (const o of G.specials) o.found = true;
const s = G.ship;
s.control = true;

/* an empty patch of the belt with only the test rocks in it */
function only(rocks) {
  G.rocks.length = 0;
  G.pirates.length = 0;
  G.nuggets.length = 0;
  for (const r of rocks) G.rocks.push(r);
  NS.asteroids.rebuildGrid();
}
function rockAt(angle, dist, ore) {
  const r = NS.asteroids.restoreRock('rock', s.x + Math.cos(angle) * dist, s.y + Math.sin(angle) * dist, 2, ore === undefined ? 'iron' : ore, 1);
  r.vx = r.vy = r.vr = 0;
  return r;
}
function park(angle) {
  s.x = G.dock.x + 1200; s.y = G.dock.y; s.vx = s.vy = 0; s.angle = angle;
}

/* cone aim */
park(0);
const ahead = rockAt(0.25, 200), wide = rockAt(1.2, 120), behind = rockAt(Math.PI, 100);
only([wide, ahead, behind]);
check('the cone picks the ore closest to the nose, not the nearest rock', M.coneTarget(s) === ahead);
park(0);
const side = rockAt(-0.3, 220), barren = rockAt(0.05, 150, null);
only([side, barren]);
check('barren rocks are skipped for ore', M.coneTarget(s) === side);
park(0);
only([rockAt(1.4, 150), rockAt(-2, 150)]);
check('nothing inside the cone means no lock', M.coneTarget(s) === null);

/* Space fires along the heading and turns the ship only slowly */
park(0);
const t = rockAt(0.4, 200);
only([t]);
G.input.keys.Space = true;
const a0 = s.angle;
H.run(NS, 6);
const turned = Math.abs(angleDiff(a0, s.angle));
check('the beam goes out at once toward the locked rock', G.beams.length > 0 && G.beams[0].hit);
const beamA = Math.atan2(G.beams[0].y1 - G.beams[0].y0, G.beams[0].x1 - G.beams[0].x0);
check('the beam bends inside the cone instead of the ship', Math.abs(angleDiff(s.angle, beamA)) <= M.AIM_CONE + 1e-6 && Math.abs(angleDiff(s.angle, beamA)) > 0.2);
check('the ship turns only slightly (no snap to the target)', turned > 0 && turned < 0.2, turned);
G.input.keys.Space = false;
H.run(NS, 2);

/* a mouse aim far off the nose: the beam is clamped to the cone edge */
park(0);
only([]);
G.input.firing = true;
G.input.aimWX = s.x; G.input.aimWY = s.y + 300;
M.updateLaser(1 / 60);
G.input.firing = false;
const edge = Math.atan2(G.beams[0].y1 - G.beams[0].y0, G.beams[0].x1 - G.beams[0].x0);
check('an aim outside the cone is clamped to its edge', Math.abs(angleDiff(s.angle, edge) - M.AIM_CONE) < 1e-6);

/* docking banks the hold and the flight goes on */
G.run.cargo = { iron: 6, copper: 2 };
G.run.cargoUsed = 8;
const iron0 = G.save.store.ore.iron || 0;
s.fuel = s.maxFuel * 0.5;
s.x = G.dock.x + 20; s.y = G.dock.y; s.vx = s.vy = 0; G.run.leftDock = true;
H.run(NS, 4);
check('docking does not end the trip or play the docking sequence', G.screen === 'playing' && G.run && !G.cine);
check('the hold is banked in the warehouse', (G.save.store.ore.iron || 0) === iron0 + 6 && G.run.cargoUsed === 0 && G.run.banked.iron === 6);
check('the ship is refuelled', s.fuel > s.maxFuel - 1);
H.run(NS, 60);
check('staying docked keeps flying', G.screen === 'playing' && G.run);
check('the snapshot remembers what was banked', NS.resume.capture().run.banked.iron === 6);

/* drones haul to the station when the hold is full */
G.stats.drones = 1;
NS.drones.setup(G.stats);
park(0);
const dr = G.drones[0];
G.run.cargoUsed = G.run.cargoMax;
dr.ore = 'silver'; dr.load = 3; dr.state = 'return'; dr.x = s.x + 200; dr.y = s.y;
const silver0 = G.save.store.ore.silver || 0;
let hauled = false, outAgain = false;
for (let i = 0; i < 60 * 30 && !outAgain; ++i) {
  H.run(NS, 1);
  s.x = G.dock.x + 1200; s.y = G.dock.y; s.vx = s.vy = 0;
  if (!hauled && (G.save.store.ore.silver || 0) === silver0 + 3) hauled = true;
  if (hauled && dr.state === 'seek' || hauled && dr.state === 'mine') outAgain = true;
}
check('a drone with a full ship hauls its basket to the station', hauled && G.run.banked.silver === 3);
check('and flies back out by itself', outAgain);
check('a docked drone with a full ship still goes out to mine', (() => { dr.state = 'docked'; H.run(NS, 1); return dr.state !== 'docked'; })());

/* ending the trip is the pilot's choice */
G.run.cargo = { iron: 2 };
G.run.cargoUsed = 2;
NS.trip.returnHome();
check('returning home plays the docking sequence', G.cine && G.cine.kind === 'docking');
H.run(NS, 60 * 4);
check('then the trip report counts everything banked plus the last hold', G.screen === 'results' && G.ui.results.reason === 'dock' && G.ui.results.hold.iron === 8 && G.ui.results.hold.silver === 3);
done();
