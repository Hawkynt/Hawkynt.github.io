'use strict';

const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;

NS.trip.startTrip('career', 0);
G.cine = null;
G.screen = 'playing';
const hub = B.grant('hub', G.base.site.hubX, G.base.site.hubY);
const stock = G.base.data.stock;
const ship = G.ship;
ship.x = hub.x + 200;
ship.y = hub.y;
const drone = { alive: true, state: 'return', vx: 0, vy: 0, angle: 0, hover: 0, exhaustT: 1 };
G.drones.push(drone);
G.run.dronesOut = true;

function deliverFrom(point, units) {
  Object.assign(drone, { state: 'return', x: point.x, y: point.y, ore: 'iron', load: units });
  NS.drones.update(0);
}

deliverFrom(hub, 4);
check('a basket goes to the nearby hub while the ship has room', stock.ore.iron === 4 && !drone.load && !G.run.cargo.iron);
deliverFrom(ship, 3);
check('the ship receives the basket when it is nearest', G.run.cargo.iron === 3 && !drone.load);
deliverFrom(G.dock, 5);
check('the station receives the basket when it is nearest', G.save.store.ore.iron === 5 && !drone.load);

const cap = NS.colony.storageCap(G.base.data, G.stats);
stock.ore.iron = cap - 1;
deliverFrom(hub, 4);
check('a nearly full hub takes only what fits', stock.ore.iron === cap && drone.load === 3);
drone.x = ship.x;
drone.y = ship.y;
NS.drones.update(0);
check('overflow heads to the station even when it passes the ship', drone.load === 3 && G.run.cargo.iron === 3);
deliverFrom(G.dock, 3);
deliverFrom(hub, 2);
check('a full nearby hub sends a whole basket to the station', NS.drones.destination(drone) === G.dock && drone.load === 2);
deliverFrom(G.dock, 2);
check('station fallback banks all overflow', G.save.store.ore.iron === 10 && !drone.load);

G.save.tree.l_hold = 2;
G.save.tree.l_compress = 1;
G.save.rd = 500;
G.save.credits = 500000;
check('ship and outpost purchases require research',
  !NS.rules.buildModule(G.save, 'blockPress') && !B.upgradePress());
check('one research unlocks both presses without installing them',
  NS.rules.buyNode(G.save, 'l_blocks') && !NS.rules.buyNode(G.save, 'l_blocks') &&
  !G.save.modules.blockPress && !G.base.data.blockRank);
NS.trip.refreshFlightStats();
const press = NS.ships.MODULE_BY_ID.blockPress;
for (let rank = 1; rank <= 6; ++rank) {
  const credits = G.save.credits;
  const units = 4 ** rank;
  check('ship rank ' + rank + ' costs credits and does not upgrade the outpost',
    NS.rules.buildModule(G.save, 'blockPress') && G.save.credits === credits - press.costs[rank - 1] &&
    G.base.data.blockRank === rank - 1);
  NS.trip.refreshFlightStats();
  stock.ore = { iron: units, copper: units + 1 };
  stock.bar = { iron: units };
  check('outpost rank ' + rank + ' is bought separately and packs by material',
    B.upgradePress() && G.base.data.blockRank === rank && NS.colony.stockCount(stock, G.base.data) === 4);
  check('rank ' + rank + ' increases ship and drone capacity',
    NS.mining.cargoSpace('iron', units) === 0.5 && NS.drones.capacity(4) === 4 * units);
}
check('press upgrades stop at rank six', !NS.rules.buildModule(G.save, 'blockPress') && !B.upgradePress());
const legacy = NS.rules.migrateSave({ tree: { l_blocks: 5 }, bases: { kessler: G.base.data } });
check('old research ranks carry over into both presses',
  legacy.tree.l_blocks === 1 && legacy.modules.blockPress === 5 && legacy.bases.kessler.blockRank === 5);
const migrated = NS.rules.migrateSave(legacy);
check('a second load preserves press levels', migrated.modules.blockPress === 5 && migrated.bases.kessler.blockRank === 5);

G.save.modules.blockPress = 1;
G.save.tree.l_compress = 0;
NS.trip.refreshFlightStats();
G.run.cargo = {};
NS.mining.refreshCargoSpace();
G.run.cargoMax = 2;
ship.x = hub.x;
ship.y = hub.y;
ship.vx = ship.vy = 0;
stock.ore = { iron: 10, copper: 10 };
check('hub pickup fills only the packed hold and leaves remaining stock',
  B.loadOre() === 8 && G.run.cargo.iron === 8 && G.run.cargoUsed === 2 &&
  stock.ore.iron === 2 && stock.ore.copper === 10 && G.base.hubVisit);
check('loading stock grants no mining research', G.run.units === 3);
NS.base.update(0);
check('loaded ore stays in the hold while the ship remains at the hub', G.run.cargo.iron === 8);
NS.trip.deposit();
check('banking restores the full raw count and clears the packed hold', G.save.store.ore.iron === 18 && G.run.cargoUsed === 0);

for (const [rank, max] of [1.5, 2, 4, 8, 16].entries()) {
  check('Fortune rank ' + (rank + 1) + ' rolls from base yield to ' + max + 'x',
    NS.rules.fortuneYield(20, rank + 1, 0) === 20 &&
    NS.rules.fortuneYield(20, rank + 1, 0.99) > 20 &&
    NS.rules.fortuneYield(20, rank + 1, 1 - Number.EPSILON) === 20 * max);
}

NS.mining.clear();
const n = NS.mining.spawnNugget(G.world.w / 2, 100, 'iron', 40);
n.vx = 24;
n.vy = 0;
ship.x = 0;
ship.y = G.world.h;
for (let i = 0; i < 61; ++i) NS.mining.update(1);
check('ore still drifts after the old expiry time', n.alive && n.x > G.world.w / 2 + 1400);
const snap = NS.resume.capture();
NS.mining.clear();
NS.resume.restore(snap);
const restored = G.nuggets[0];
check('Continue retains loose ore and its drift', restored.units === 40 && restored.x === snap.nuggets[0][3] && restored.vx === 24);
restored.x = G.world.w - 1;
NS.mining.update(1);
check('ore leaves the field when it crosses the map boundary', !G.nuggets.length);
for (let i = 0; i < 425; ++i) NS.mining.spawnNugget(100, 100, 'iron', 1);
check('a crowded field keeps new drops', G.nuggets.length === 425);
NS.mining.clear();

G.run.cargoMax = 2;
const oversized = NS.mining.spawnNugget(ship.x + 1, ship.y - 1, 'iron', 40);
oversized.age = 1;
NS.mining.update(0);
check('a large Fortune drop fills the hold and leaves the remainder', G.run.cargo.iron === 8 && oversized.alive && oversized.units === 32);
/* Dock with an empty hold and baskets already on their way elsewhere. */
G.run.cargo = {};
NS.mining.refreshCargoSpace();
G.run.dronesOut = false;
G.run.leftDock = false;
ship.x = G.dock.x;
ship.y = G.dock.y;
ship.vx = ship.vy = 0;
ship.fuel = ship.maxFuel;
ship.hull = ship.maxHull;
G.base.data.blockRank = 0;
stock.ore = { iron: cap - 2 };
stock.bar = {};
const fleet = NS.units.spawn('miner', hub.x, hub.y, 'player');
Object.assign(fleet, { load: 5, ore: 'iron', job: 'haul' });
Object.assign(drone, { x: G.dock.x + 150, y: G.dock.y, ore: 'copper', load: 7, state: 'docked' });
const stationIron = G.save.store.ore.iron;
const bankedBefore = G.run.bankedUnits;
NS.trip.update(0);
check('station landing transfers recalled and fleet drone baskets immediately',
  !drone.load && !fleet.load && fleet.job === 'idle' && stock.ore.iron === cap &&
  G.save.store.ore.iron === stationIron + 3 && G.save.store.ore.copper === 7);
NS.trip.update(0);
check('remaining at the station does not bank the same baskets twice', G.run.bankedUnits === bankedBefore + 10);

/* Return Home must settle baskets even with a full ship hold. */
Object.assign(drone, { x: G.dock.x, y: G.dock.y, ore: 'copper', load: 9, state: 'haul' });
G.run.cargoUsed = G.run.cargoMax;
NS.trip.endTrip('dock');
check('Return Home banks drone cargo directly and includes it in the report',
  !drone.load && G.save.store.ore.copper === 16 && G.ui.results.hold.copper === 16);

NS.trip.startTrip('rush', 0);
G.cine = null;
G.ship.x = G.dock.x;
G.ship.y = G.dock.y;
G.ship.vx = G.ship.vy = 0;
Object.assign(drone, { x: G.dock.x + 150, y: G.dock.y, ore: 'gold', load: 6, state: 'haul' });
G.drones.push(drone);
NS.trip.update(0);
check('Gold Rush sells the drone basket on landing without warehouse deposits',
  !drone.load && G.run.sold === NS.ores.ORE_BY_ID.gold.value * 6 && !G.save.store.ore.gold);
done();
