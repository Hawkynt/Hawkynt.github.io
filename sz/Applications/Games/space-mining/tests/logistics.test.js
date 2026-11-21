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
for (let rank = 1; rank <= 6; ++rank) {
  check('Block Press rank ' + rank + ' can be researched', NS.rules.buyNode(G.save, 'l_blocks'));
  NS.trip.refreshFlightStats();
  const units = 4 ** rank;
  stock.ore = { iron: units, copper: units + 1 };
  stock.bar = { iron: units };
  check('rank ' + rank + ' packs by material and keeps partial blocks',
    NS.colony.stockCount(stock, G.stats) === 4 &&
    NS.mining.cargoSpace('iron', units) === 0.5 && NS.drones.capacity(4) === 4 * units);
  const node = NS.treeData.TREE_BY_ID.l_blocks;
  check('rank ' + rank + ' displays its capacity', NS.rules.nodeText(node, rank).includes(units + ' units'));
}

G.save.tree.l_blocks = 1;
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

function fractureYield(chance) {
  G.stats.fortune = chance;
  NS.mining.clear();
  const rock = NS.asteroids.restoreRock('rock', 300, 300, 1, 'iron', 1);
  NS.asteroids.damage(rock, rock.hp + 1, rock.x, rock.y, 'drone');
  return G.nuggets.reduce((sum, n) => sum + n.units, 0);
}
const normal = fractureYield(0);
check('Fortune doubles ore when the bonus roll succeeds', normal > 0 && fractureYield(1) === normal * 2);
done();
