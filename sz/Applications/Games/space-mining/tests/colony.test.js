'use strict';

/* Colony rules (pure): the outpost sites and deposits, placement, the link network and power,
   crew, production chains (extract, smelt, fabricate, research, export, storage), costs,
   upkeep and the market cycle of outposts, wave scaling and composition, and loading saves
   from before outposts existed. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/save.js');
const { check, done } = H;
const C = NS.colony, P = NS.production, R = NS.rules;
const { ZONES, ZONE_BY_ID, ORES } = NS.ores;
const { BUILDINGS, BUILDING_BY_ID, COMPONENTS } = NS.colonyData;

check('22 resources and 7 components', ORES.length === 22 && COMPONENTS.length === 7);
check('every resource kind is present', ['bulk', 'precious', 'gas', 'crystal', 'exotic', 'salvage', 'bio'].every(k => ORES.some(o => o.kind === k)));
check('23 buildings in 6 categories, all distinct', BUILDINGS.length === 23 && new Set(BUILDINGS.map(b => b.id)).size === 23 && new Set(BUILDINGS.map(b => b.cat)).size === 6);
check('every belt ore is known', ZONES.every(z => Object.keys(z.ores).concat(Object.keys(z.gases)).every(id => NS.ores.ORE_BY_ID[id])));

/* sites and deposits */
const stats = R.computeStats(R.freshSave());
for (const z of ZONES) {
  const d = C.deposits(z);
  const again = C.deposits(z);
  const s = C.site(z.index, 6400, 4600);
  check(z.name + ': deposits are seeded and stable', JSON.stringify(d) === JSON.stringify(again) && d.length >= 5);
  check(z.name + ': ore, gas and crystal deposits', ['ore', 'gas', 'crystal'].every(k => d.some(q => q.kind === k)));
  check(z.name + ': deposits keep clear of the hub block and each other', d.every(q => !(q.cx >= s.hubX - 2 && q.cx <= s.hubX + 4 && q.cy >= s.hubY - 2 && q.cy <= s.hubY + 4)) &&
    d.every((q, i) => d.every((p, k) => k === i || Math.abs(p.cx - q.cx) >= 3 || Math.abs(p.cy - q.cy) >= 3)));
  check(z.name + ': the site sits inside the sector away from the dock', s.x0 > 0 && s.y0 > 0 && s.x0 + s.w < 6400 && s.y0 + s.h < 4600 &&
    Math.hypot(s.cx - 3200, s.cy - 2300) > 900);
}

/* placement */
const zone = ZONE_BY_ID.amber;
const deps = C.deposits(zone);
const site = C.site(zone.index, 6400, 4600);
const base = C.newBase('amber');
const add = (type, cx, cy, extra) => {
  const b = Object.assign({ id: base.nextId++, type: type, cx: cx, cy: cy, lvl: 1, hp: BUILDING_BY_ID[type].hp, prog: 1, inf: 0, cor: 0, rogue: false, quarantine: false }, extra || {});
  base.buildings.push(b);
  return b;
};
check('no building before the hub', !C.canPlace(base, deps, 'solar', site.hubX + 3, site.hubY, stats).ok);
check('the hub may go anywhere free', C.canPlace(base, deps, 'hub', site.hubX, site.hubY, stats).ok);
check('nothing outside the grid', !C.canPlace(base, deps, 'hub', C.COLS - 2, 0, stats).ok);
const hub = add('hub', site.hubX, site.hubY);
check('only one hub', !C.canPlace(base, deps, 'hub', 1, 1, stats).ok);
check('no overlaps', /Blocked/.test(C.canPlace(base, deps, 'solar', site.hubX + 1, site.hubY + 1, stats).reason));
const reach = (d) => Math.max(Math.abs(d.cx - site.hubX - 1), Math.abs(d.cy - site.hubY - 1));
const oreDep = deps.filter(d => d.kind === 'ore').sort((a, b) => reach(a) - reach(b))[0];
check('deposits are kept for extractors', !C.canPlace(base, deps, 'solar', oreDep.cx, oreDep.cy, stats).ok);
check('an extractor needs its deposit', /deposit|pocket|cluster/.test(C.canPlace(base, deps, 'rig', site.hubX + 3, site.hubY, stats).reason));
const far = { cx: 0, cy: 0 };
check('out of link range is refused', /link range/.test(C.canPlace(base, deps, 'solar', far.cx, far.cy, stats).reason));
check('in range next to the hub is fine', C.canPlace(base, deps, 'solar', site.hubX + 3, site.hubY, stats).ok);

/* links and power */
const sol = add('solar', site.hubX + 3, site.hubY);
const las = add('laser', site.hubX - 1, site.hubY);
let net = C.links(base, stats);
check('buildings near the hub link to it', net.on[1] && net.on[2] && net.parent[1] === 0);
const relay = add('relay', site.hubX + 6, site.hubY + 1);
const fargun = add('laser', Math.min(C.COLS - 1, site.hubX + 10), site.hubY + 1);
net = C.links(base, stats);
check('a relay carries the network further', net.on[base.buildings.indexOf(relay)] && net.on[base.buildings.indexOf(fargun)] && net.parent[base.buildings.indexOf(fargun)] === base.buildings.indexOf(relay));
relay.quarantine = true;
net = C.links(base, stats);
check('quarantine cuts a relay and what hangs on it', !net.on[base.buildings.indexOf(relay)] && !net.on[base.buildings.indexOf(fargun)]);
relay.quarantine = false;
net = C.links(base, stats);
let pw = C.power(base, zone, stats, net, {});
check('power: hub and solar make, turrets use', Math.abs(pw.make - (12 + 10 * 1.33)) < 0.01 && pw.use === 6 && pw.ratio === 1);
check('solar gives a third more under a sun', zone.theme.sun && C.buildingPower(sol, zone, stats, true) > C.buildingPower(sol, ZONE_BY_ID.kessler, stats, true));
const fus = add('fusion', site.hubX, site.hubY + 4);
check('fusion makes 36 fuelled, 6 dry', C.buildingPower(fus, zone, stats, true) === 36 && C.buildingPower(fus, zone, stats, false) === 6);
fus.rogue = true;
check('a hijacked reactor drains the grid', C.buildingPower(fus, zone, stats, true) < 0);
base.buildings.pop();

/* crew */
base.crew = 2;
const staff = C.assignCrew(base);
check('crew go to the most important posts first', staff[hub.id] === 1 && staff[las.id] === 0);
base.crew = 3;
check('more crew staff the turrets', C.assignCrew(base)[las.id] === 1);
check('housing: hub 6, habitats 8 per level', C.housing(base) === 6);
hub.prog = 0.3;
check('the founding crew have a home while the hub is going up', C.housing(base) === 6);
hub.prog = 1;

for (let i = 0; i < 3; ++i) add('shield', 0, 1 + i * 2);
pw = C.power(base, zone, stats, C.links(base, stats), {});
check('linked consumers only: far shields do not draw', pw.use === 6);

/* production */
const pb = C.newBase('amber');
const padd = (type, cx, cy) => { const b = { id: pb.nextId++, type: type, cx: cx, cy: cy, lvl: 1, hp: 500, prog: 1, inf: 0, cor: 0 }; pb.buildings.push(b); return b; };
padd('hub', site.hubX, site.hubY);
const rig = padd('rig', oreDep.cx > 0 ? oreDep.cx - 1 : 0, oreDep.cy > 0 ? oreDep.cy - 1 : 0);
for (let i = 0; i < 4; ++i) padd('solar', 7 + i * 2, site.hubY - 3);
pb.crew = 20;
const world = P.world(pb, zone, stats);
const stepN = (secs) => {
  const ev = [];
  for (let t = 0; t < secs; t += 0.5) { world.dt = 0.5; P.refresh(world); ev.push.apply(ev, P.step(world)); }
  return ev;
};
P.refresh(world);
check('the rig stands linked on its deposit', world.net.on[1] && C.depositUnder(rig, deps) === oreDep);
stepN(30);
check('a rig pulls its deposit\'s ore', (pb.stock.ore[oreDep.res] || 0) >= 8);
rig.prog = 0.5;
pb.stock.ore = { iron: 9, gold: 6 };
padd('smelter', site.hubX + 3, site.hubY);
let ev = stepN(13);
check('the smelter makes bars of bulk ore only', (pb.stock.bar.iron || 0) >= 3 && !pb.stock.bar.gold && ev.some(e => e.type === 'make' && e.bar));
pb.stock.bar = { iron: 4, nickel: 2, copper: 1, silver: 1 };
const fab = padd('fabricator', site.hubX - 2, site.hubY);
fab.recipe = 'alloy';
ev = stepN(14);
check('the fabricator turns 2 iron + 1 nickel into alloy', pb.stock.comp.alloy === 2 && !pb.stock.bar.nickel && ev.some(e => e.comp));
fab.recipe = 'auto';
check('auto recipe picks the most valuable it can make', P.pickRecipe({ bar: { copper: 1, silver: 1, iron: 2, nickel: 1 }, comp: {} }, fab).id === 'circuit');
fab.recipe = 'warpcore';
pb.stock.comp.circuit = 1;
const lab = padd('lab', site.hubX + 3, site.hubY + 3);
ev = stepN(25);
check('the lab writes research, doubled while it burns a circuit', ev.filter(e => e.type === 'rd').reduce((a, e) => a + e.n, 0) === 2 && !pb.stock.comp.circuit);
pb.stock.ore = { iron: C.storageCap(pb, stats) + 5 };
rig.prog = 1;
rig._t = 0;
ev = stepN(10);
check('full storage stalls extraction', rig._blocked === true && !ev.some(e => e.type === 'make' && e.b === rig));
pb.stock = { ore: {}, bar: { gold: 10, iron: 10 }, comp: { warpcore: 1 } };
padd('depot', site.hubX - 2, site.hubY + 3);
ev = stepN(13);
const ex = ev.find(e => e.type === 'export');
check('the trade depot ships the most valuable stock first', ex && ex.items[0].id === 'warpcore' && ex.items.length >= 2);

/* costs */
const save = R.freshSave();
check('modular kits cut building costs', C.buildCost('shipyard', R.computeStats(Object.assign(R.freshSave(), { tree: { c_cost: 2 } }))).cr < C.buildCost('shipyard', stats).cr);
const wallet = { credits: 1000 };
const stock = { ore: { iron: 10, copper: 4 }, bar: {}, comp: {} };
check('missing names the first lack', C.missing(wallet, stock, { cr: 2000 }) === 'credits' && C.missing(wallet, stock, { cr: 1, ore: { iron: 11 } }) === 'ore:iron');
check('pay takes credits and stock', C.pay(wallet, stock, { cr: 200, ore: { iron: 10 } }) && wallet.credits === 800 && !('iron' in stock.ore));
C.refund(wallet, stock, { cr: 200, ore: { iron: 10 } }, 0.5);
check('refund gives half back', wallet.credits === 900 && stock.ore.iron === 5);
check('upgrades cost more each level and stop at 3', C.upgradeCost({ type: 'laser', lvl: 2 }, stats).cr > C.upgradeCost({ type: 'laser', lvl: 1 }, stats).cr && C.upgradeCost({ type: 'laser', lvl: 3 }, stats) === null);

/* the market cycle for outposts */
save.credits = 1000;
const sb = save.bases.amber = C.repairBases({ amber: JSON.parse(JSON.stringify(pb)) }).amber;
const rep = P.cycleBases(save, stats);
check('a cycle charges upkeep and books research and exports', rep.upkeep === C.upkeep(sb) && save.credits === 1000 - rep.upkeep && rep.upkeep > 0);
check('offline work leaves no runtime fields behind', sb.buildings.every(b => Object.keys(b).every(k => k.charAt(0) !== '_')));
sb.abandoned = true;
sb.stock = { ore: { iron: 100 }, bar: {}, comp: {} };
P.cycleBases(save, stats);
P.cycleBases(save, stats);
check('scavengers strip an abandoned outpost', sb.stock.ore.iron < 60);
P.cycleBases(save, stats);
check('after three cycles abandoned, the Bloom turns it into a hive', sb.hive === true && sb.idleCycles === 3);

/* waves */
const w1 = C.composeWave(1, ZONE_BY_ID.kessler, 0, 42, {});
const w1b = C.composeWave(1, ZONE_BY_ID.kessler, 0, 42, {});
check('waves are seeded', JSON.stringify(w1) === JSON.stringify(w1b));
check('the budget grows with the wave, the belt and the outpost value', C.waveBudget(5, 1, 0) > C.waveBudget(1, 1, 0) && C.waveBudget(3, 5, 0) > C.waveBudget(3, 1, 0) &&
  C.waveBudget(3, 2, 40000) > C.waveBudget(3, 2, 0));
check('the first wave is light', w1.groups.every(g => NS.fleetData.WAVE_UNLOCK[g.type] <= 1));
const w9 = C.composeWave(9, ZONE_BY_ID.crimson, 20000, 7, {});
check('later waves bring heavier ships', w9.groups.some(g => ['frigate', 'siege', 'carrier', 'bomber', 'nanoswarm'].indexOf(g.type) >= 0) && w9.count > w1.count);
check('wave 8 brings the mothership once per belt', C.composeWave(8, zone, 0, 1, {}).boss && !C.composeWave(8, zone, 0, 1, { bossDone: true }).boss);
check('Siege bosses at 10 and 15', C.isBossWave(10, 'siege') && C.isBossWave(15, 'siege') && !C.isBossWave(8, 'siege'));
let lattice = 0;
for (let s = 0; s < 40; ++s) if (C.composeWave(6, ZONE_BY_ID.void, 0, s, { nano: 2 }).faction === 'lattice') ++lattice;
check('belts with nanoprobes send Lattice waves', lattice > 3);
check('Siege waves come faster', C.waveInterval(zone, 'siege') < C.waveInterval(zone, 'career'));

/* saves from before outposts */
const old = JSON.parse(JSON.stringify(R.freshSave()));
delete old.bases; delete old.log; delete old.logSeen; delete old.daily; delete old.cine; delete old.resume;
delete old.store.comp; delete old.best.siege;
old.market = { iron: { f: 1.3, sat: 0.1, hist: [9, 10] } };
const mig = R.migrateSave(old, null);
check('a pre-colony save loads with no outposts', JSON.stringify(mig.bases) === '{}' && JSON.stringify(mig.store.comp) === '{}' && mig.best.siege === 0 && mig.log.length === 0);
NS.economy.initMarket(mig);
check('its market keeps the old prices and gains the new ores', mig.market.iron.f === 1.3 && mig.market.hydrogen && mig.market.hydrogen.f === 1);
const bad = R.migrateSave({ bases: { amber: { buildings: [{ type: 'hub', cx: 9, cy: 7, lvl: 9, hp: -5 }, { type: 'laser', cx: 9, cy: 7 }, { type: 'ghost', cx: 1, cy: 1 }, { type: 'solar', cx: 30, cy: 1 }],
  stock: { ore: { iron: 5.7, nope: 3 }, comp: { circuit: 2 } }, crew: -4, units: [{ type: 'fighter', kills: 3 }, { type: 'dragon' }] }, nowhere: {}, kessler: { buildings: [{ type: 'solar', cx: 1, cy: 1 }] } } }, null);
const ab = bad.bases.amber;
check('damaged outposts are repaired', ab.buildings.length === 1 && ab.buildings[0].lvl === 3 && ab.buildings[0].hp === 1 && ab.stock.ore.iron === 5 && !ab.stock.ore.nope && ab.crew === 0);
check('known units stay, unknown belts go, hubless outposts are emptied', ab.units.length === 1 && !bad.bases.nowhere && bad.bases.kessler.buildings.length === 0);
check('a repaired save survives a round trip unchanged', JSON.stringify(R.migrateSave(JSON.parse(JSON.stringify(bad)), null)) === JSON.stringify(bad));

done();
