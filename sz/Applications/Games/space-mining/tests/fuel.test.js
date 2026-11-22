'use strict';

/* Fuel and range: the belts grow and burn more from the Kessler Drift to the Void Crown, a full
   hold and the afterburner burn more, a faster engine burns faster (fuel per distance stays), so
   a fully upgraded ship in the last belt has about the range of a new one in the first; rubble is
   thin and poor near the dock and thick and rich at the rim; the bingo mark is the fuel to the
   nearest place to refuel; fuel cells burn by themselves when the tank runs low; the Ramscoop
   refuels from gas pockets; trading posts refuel for a fee and the hub for free. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const F = NS.fuel;
const R = NS.rules;
const { ZONES } = NS.ores;

function career(hull, ups, tree) {
  const s = R.freshSave();
  s.hull = hull;
  for (const u of NS.ships.UPGRADES) s.upgrades[u.id] = ups ? u.max : 0;
  /* the ship and colony pages; the Arsenal's Drive branch lifts the limit at the very end (arsenal.test.js) */
  if (tree) for (const n of NS.treeData.TREE) if (NS.treeData.BRANCHES.find(b => b.id === n.branch).page < 2) s.tree[n.id] = n.costs.length;
  return s;
}

/* ── pure rules ── */
for (let i = 1; i < ZONES.length; ++i) {
  const a = F.worldSize(ZONES[i - 1], 'career'), b = F.worldSize(ZONES[i], 'career');
  check(ZONES[i].name + ' is bigger and burns more than ' + ZONES[i - 1].name, b.w > a.w && b.h > a.h && ZONES[i].burn > ZONES[i - 1].burn);
}
check('the Kessler Drift is bigger than the classic sector', F.worldSize(ZONES[0], 'career').w > F.CLASSIC[0]);
check('Gold Rush and the Daily Belt keep the classic sector', F.worldSize(ZONES[3], 'rush').w === F.CLASSIC[0] && F.worldSize(ZONES[1], 'daily').h === F.CLASSIC[1]);
const dock = { x: 4000, y: 2800 };
check('reach is 0 at the dock and 1 at the rim', F.reach(4000, 2800, dock, 8000, 5600) === 0 && F.reach(0, 2800, dock, 8000, 5600) === 1 && F.reach(8000, 0, dock, 8000, 5600) === 1);
check('rubble is thin near the dock and full at the rim', F.density(0.1) < 0.2 && F.density(1) > 0.99 && F.density(0.5) > F.density(0.3));
check('rocks are richer and rare ore commoner at the rim', F.richness(1) > F.richness(0) + 0.4 && F.rareBoost(0.2) === 0 && F.rareBoost(1) > 1);

const fresh = R.computeStats(career('prospector', false, false));
const k = ZONES[0];
check('a new ship burns 2 a second at full thrust in the Kessler Drift', Math.abs(F.rate(fresh, k, 1, 0, false) - 2) < 1e-9);
check('a full hold burns half again as much', Math.abs(F.rate(fresh, k, 1, 1, false) / F.rate(fresh, k, 1, 0, false) - 1.5) < 1e-9);
check('the afterburner burns about three times as much', F.rate(fresh, k, 1, 0, true) > 2.5 * F.rate(fresh, k, 1, 0, false));
check('later belts burn more', F.rate(fresh, ZONES[4], 1, 0, false) > F.rate(fresh, ZONES[2], 1, 0, false));
check('Lean Burn burns less', F.rate(Object.assign({}, fresh, { fuelEff: 0.8 }), k, 1, 0, false) < F.rate(fresh, k, 1, 0, false));
check('the bingo cost grows with distance and keeps a spare', F.homeCost(0, fresh, k, 0) > 0 && F.homeCost(3000, fresh, k, 0) > F.homeCost(1000, fresh, k, 0));
check('the bingo cost grows with the hold', F.homeCost(2000, fresh, k, 1) > F.homeCost(2000, fresh, k, 0));
const secs = F.thrustSeconds(fresh, k);
check('a new ship has a tight tank in the Kessler Drift (' + secs.toFixed(0) + ' s of thrust)', secs >= 40 && secs <= 70);

/* the progression: range in belt widths barely grows over the whole career */
const first = F.crossings(fresh, k, 'career');
const tuned = R.computeStats(career('prospector', true, false));
check('speed upgrades do not stretch the range (fuel per distance stays)', Math.abs(F.crossings(Object.assign({}, fresh, { maxSpeed: fresh.maxSpeed * 2, engine: 2 }), k, 'career') - first) < 1e-9);
check('tanks and Lean Burn add range', F.crossings(tuned, k, 'career') > first);
for (const hull of NS.ships.HULLS) {
  const st = R.computeStats(career(hull.id, true, true));
  const c = F.crossings(st, ZONES[4], 'career');
  check('a ' + hull.name + ' maxed short of the Arsenal in the Void Crown has between 0.6 and 2 times the range of a new ship at home (' + c.toFixed(1) + ' vs ' + first.toFixed(1) + ')', c <= first * 2 && c >= first * 0.6);
}

check('the Ramscoop takes gas by level', F.scoopFuel(0, 'hydrogen') === 0 && F.scoopFuel(1, 'hydrogen') === 3 && F.scoopFuel(1, 'helium3') === 0 && F.scoopFuel(2, 'helium3') === 5 && F.scoopFuel(3, 'xenon') === 7 && F.scoopFuel(3, 'iron') === 0);
check('a fuel cell gives 40, the Cell Injector more', F.cellFuel(fresh) === 40 && F.cellFuel({ cells: 0.5 }) === 60);
const tree = NS.treeData.TREE;
check('the Engines tree has the Ramscoop and the Cell Injector', tree.some(n => n.id === 'e_scoop' && n.branch === 'engines') && tree.some(n => n.id === 'e_cells' && n.branch === 'engines'));
const sv = career('prospector', false, false);
sv.tree.e_scoop = 2; sv.tree.e_cells = 1;
const st2 = R.computeStats(sv);
check('the stats carry the Ramscoop level and the cell bonus', st2.scoop === 2 && st2.cells === 0.5);
check('the station sells fuel cells', NS.supply.onSale('comp', 'fuelcell'));

/* ── in the running game ── */
NS.trip.startTrip('career', 0);
for (let i = 0; i < 20 && G.cine; ++i) { NS.cinematics.skip(); H.run(NS, 30); }
const size = F.worldSize(ZONES[0], 'career');
check('the Kessler trip flies the bigger belt with the dock in the middle', G.world.w === size.w && G.world.h === size.h && G.dock.x === size.w / 2 && G.dock.y === size.h / 2);
let inner = 0, outer = 0, richIn = 0, richOut = 0;
for (const o of G.rocks) {
  if (o.kind !== 'rock') continue;
  const r = F.reach(o.x, o.y, G.dock, G.world.w, G.world.h);
  if (r < 0.35) { ++inner; richIn += o.rich; } else if (r > 0.65) { ++outer; richOut += o.rich; }
}
/* the inner square is 0.35^2 of the belt, the outer ring 1 - 0.65^2 */
const dIn = inner / 0.1225, dOut = outer / (1 - 0.4225);
check('the rim holds far more rubble per area than the inner belt (' + inner + ' inside, ' + outer + ' out)', dOut > dIn * 3);
check('rocks at the rim are richer', outer && (!inner || richOut / outer > richIn / inner));
const gas = G.clouds.filter(c => !c.bio);
check('gas pockets lie out toward the rim', gas.length && gas.reduce((a, c) => a + F.reach(c.x, c.y, G.dock, G.world.w, G.world.h), 0) / gas.length > 0.5);
for (const o of G.specials.concat(G.rocks.filter(r => r.kind === 'geode'))) check('a ' + o.kind + ' lies far out', F.reach(o.x, o.y, G.dock, G.world.w, G.world.h) >= 0.5);

const s = G.ship;
s.control = true;
G.rocks.length = 0; G.pirates.length = 0; G.clouds.length = 0;
NS.asteroids.rebuildGrid();
function burnFor(fill) {
  s.x = G.dock.x + 1500; s.y = G.dock.y; s.vx = s.vy = 0;
  G.run.cargoUsed = G.run.cargoMax * fill;
  s.fuel = s.maxFuel;
  G.input.moveX = 1; G.input.moveY = 0;
  for (let i = 0; i < 60; ++i) NS.ship.update(1 / 60);
  G.input.moveX = 0;
  return s.maxFuel - s.fuel;
}
const empty = burnFor(0), full = burnFor(1);
check('a second of full thrust burns about 2 (' + empty.toFixed(2) + ')', empty > 1.95 && empty < 2.25);
check('a full hold burns more (' + full.toFixed(2) + ')', full > empty * 1.35);
G.run.cargoUsed = 0;

/* bingo */
s.x = G.dock.x + 300; s.y = G.dock.y; s.fuel = s.maxFuel;
check('near the dock with a full tank there is no bingo', !NS.refuel.bingo());
s.x = 200; s.y = 200;
const home = NS.refuel.home();
check('the nearest place to refuel is the dock', home.kind === 'dock' && home.cost > 4);
s.fuel = home.cost - 1;
check('below the bingo mark the HUD warns', NS.refuel.bingo());

/* fuel found while the tow is on its way calls it off */
s.x = 200; s.y = 200; s.vx = s.vy = 0; s.fuel = 0;
NS.trip.update(1 / 60);
check('running dry calls a tow', G.run.towT > 0);
s.fuel = 20;
NS.trip.update(1 / 60);
check('fuel aboard again calls the tow off', G.run.towT === 0 && G.run && !G.run.ending);
s.fuel = s.maxFuel;

/* fuel cells */
G.run.freight.comp.fuelcell = 2;
s.fuel = s.maxFuel * 0.05;
const before = s.fuel;
NS.refuel.update(1 / 60);
check('a fuel cell burns by itself when the tank runs low', Math.abs(s.fuel - before - 40) < 1e-6 && G.run.freight.comp.fuelcell === 1);
NS.refuel.update(1 / 60);
check('only one cell burns at a time', G.run.freight.comp.fuelcell === 1);
s.fuel = s.maxFuel * 0.5;
for (let i = 0; i < 120; ++i) NS.refuel.update(1 / 60);
check('a cell waits for the tank to run low', G.run.freight.comp.fuelcell === 1);

/* the Ramscoop */
function scoopRun(level) {
  G.stats.scoop = level;
  G.clouds.length = 0;
  G.run.cargoUsed = G.run.cargoMax;
  s.x = 1000; s.y = 1000; s.vx = 200; s.vy = 0; s.fuel = 20;
  const c = NS.life.cloud(1000, 1000, 160, 'hydrogen', false, () => 0.5);
  c.vx = c.vy = 0;
  G.clouds.push(c);
  for (let i = 0; i < 60; ++i) { s.x = 1000; s.y = 1000; NS.life.update(1 / 60); }
  return s.fuel - 20;
}
check('without the Ramscoop a gas pocket gives no fuel', scoopRun(0) === 0);
check('with the Ramscoop a hydrogen pocket refuels even with a full hold', scoopRun(1) >= 3);
G.stats.scoop = 1;
G.clouds.length = 0;
G.run.cargoUsed = 0;
s.fuel = s.maxFuel;
const xc = NS.life.cloud(1000, 1000, 160, 'xenon', false, () => 0.5);
xc.vx = xc.vy = 0;
G.clouds.push(xc);
for (let i = 0; i < 60; ++i) { s.x = 1000; s.y = 1000; s.vx = 200; NS.life.update(1 / 60); }
check('with a full tank the gas goes into the hold as before', (G.run.cargo.xenon || 0) > 0);
G.clouds.length = 0;
G.stats.scoop = 0;

/* a trading post (no cells aboard, so only the post refuels) */
delete G.run.freight.comp.fuelcell;
G.posts.push({ id: 'n', x: 3000, y: 900, name: 'Test Post' });
s.x = 3060; s.y = 900; s.vx = s.vy = 0; s.fuel = 10;
const cr0 = G.save.credits = 5000;
for (let i = 0; i < 60; ++i) NS.refuel.update(1 / 60);
check('hovering by a trading post refuels about 14 a second (' + (s.fuel - 10).toFixed(1) + ')', s.fuel - 10 > 12 && s.fuel - 10 < 16);
check('the post bills the fuel', G.save.credits < cr0);
s.vx = 600;
const f1 = s.fuel;
NS.refuel.update(1 / 60);
check('flying past fast does not refuel', s.fuel === f1);
s.vx = 0;
s.x = 3060; s.y = 900; s.fuel = 1;
check('a post is a place to refuel for the bingo mark', NS.refuel.home().kind === 'post');
G.posts.length = 0;

/* the hub refuels for free and keeps the fuel cells aboard */
NS.trip.startTrip('siege', 2);
for (let i = 0; i < 20 && G.cine; ++i) { NS.cinematics.skip(); H.run(NS, 30); }
const hub = NS.base.hub();
G.ship.control = true;
G.ship.x = hub.x + 80; G.ship.y = hub.y; G.ship.vx = G.ship.vy = 0; G.ship.fuel = 10;
G.save.credits = 5000;
for (let i = 0; i < 60; ++i) NS.refuel.update(1 / 60);
check('hovering by the hub refuels about 10 a second (' + (G.ship.fuel - 10).toFixed(1) + ')', G.ship.fuel - 10 > 8 && G.ship.fuel - 10 < 12);
check('the hub refuels for free', G.save.credits === 5000);
G.run.freight.comp.fuelcell = 3;
G.run.freight.comp.alloy = 1;
NS.supplies.unload(G.ship);
check('unloading supplies at the hub keeps the fuel cells aboard', G.run.freight.comp.fuelcell === 3 && !G.run.freight.comp.alloy);
check('the siege belt is the bigger belt too', G.world.w === F.worldSize(ZONES[2], 'siege').w);

done();
