'use strict';

/* The Arsenal: a third tree page bought with Intel, which operations pay on their first clear
   (by mood); nodes that need a cleared operation; and what each node does in the running game -
   hardpoint damage, cooldown and range, freighter hull and speed, a bigger hired wing, ability
   cooldowns, spotting cloaked craft, the scanner pulse, unit damage to structures, armour
   piercing, unit hit points, spores, hijacks, cloaks, gas scooping, deep tanks and the Fusion
   Drive that frees the best ship from fuel worries. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const R = NS.rules;
const F = NS.fuel;
const { BRANCHES, PAGES, TREE, TREE_BY_ID } = NS.treeData;
const { OP_BY_ID } = NS.opsData;

const arsenal = BRANCHES.filter(b => b.page === 2);
check('the third page is the Arsenal with six branches paid in Intel', PAGES[2] === 'Arsenal' && arsenal.length === 6 && arsenal.every(b => b.currency === 'intel'));
check('Weapons, Convoy, Tactics, Warfare, Xeno and Drive', ['weapons', 'convoy', 'tactics', 'warfare', 'xeno', 'drive'].every(id => arsenal.some(b => b.id === id)));
check('three nodes a branch', arsenal.every(b => TREE.filter(n => n.branch === b.id).length === 3));
check('74 nodes in all', TREE.length === 74);
check('every prerequisite is a node or a cleared operation', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]] || (r[0].indexOf('op:') === 0 && OP_BY_ID[r[0].slice(3)]))));

/* Intel */
const sv = R.freshSave();
check('a new career has no Intel', sv.intel === 0);
const rd0 = sv.rd;
NS.ops.finish(sv, OP_BY_ID.k_haul, true, 90);
check('a first clear pays Intel by mood (a challenge: 1)', sv.intel === 1);
NS.ops.finish(sv, OP_BY_ID.k_haul, true, 80);
check('a replay pays no more', sv.intel === 1);
NS.ops.finish(sv, OP_BY_ID.k_charter, true, 300);
check('a peak pays 3', sv.intel === 4);
NS.ops.finish(sv, OP_BY_ID.a_haul, true, 300);
check('a nightmare pays 4', sv.intel === 8);
check('Intel survives the save repair', R.migrateSave(JSON.parse(JSON.stringify(sv))).intel === 8);
const rdNow = sv.rd;
check('an Arsenal node costs Intel, not research', R.nodeState(sv, 'w_dmg') === 'available' && R.buyNode(sv, 'w_dmg') && sv.intel === 8 - TREE_BY_ID.w_dmg.costs[0] && sv.rd === rdNow);
sv.intel = 0;
check('without Intel it is too expensive', R.nodeState(sv, 'w_cd') === 'expensive');
void rd0;
sv.intel = 99;
R.buyNode(sv, 'r_tanks'); R.buyNode(sv, 'r_tanks');
check('the Fusion Drive needs the Syndicate Citadel cleared', R.nodeState(sv, 'r_fusion') === 'locked');
NS.ops.finish(sv, OP_BY_ID.c_citadel, true, 600);
check('with the Citadel cleared it opens', R.nodeState(sv, 'r_fusion') === 'available');
check('the lock names the operation', /Syndicate Citadel/.test(R.reqText(TREE_BY_ID.r_fusion)));

/* stats */
function maxed(hull, arsenalToo) {
  const s = R.freshSave();
  s.hull = hull;
  for (const u of NS.ships.UPGRADES) s.upgrades[u.id] = u.max;
  for (const n of TREE) if (arsenalToo || BRANCHES.find(b => b.id === n.branch).page < 2) s.tree[n.id] = n.costs.length;
  return R.computeStats(s);
}
const lev = maxed('leviathan', true), levPlain = maxed('leviathan', false);
const voidZ = NS.ores.ZONE_BY_ID.void;
const secs = F.thrustSeconds(lev, voidZ);
check('the best ship fully upgraded carries over five minutes of full thrust in the Void Crown (' + secs.toFixed(0) + ' s)', secs >= 300);
check('and crosses the belt dozens of times on a tank (' + F.crossings(lev, voidZ, 'career').toFixed(1) + ')', F.crossings(lev, voidZ, 'career') >= 25);
check('without the Drive branch fuel still matters there', F.thrustSeconds(levPlain, voidZ) < 120);
check('the Arsenal stats are all there', lev.hpDmg > 1 && lev.hpCd < 1 && lev.hpRange > 1 && lev.freighterHp > 1 && lev.freighterSpeed > 1 && lev.wing === 2 &&
  lev.abilityCd < 1 && lev.detect > 1 && lev.pulseMul > 1 && lev.unitStruct > 1 && lev.pierce > 0 && lev.sporeMul > 1 && lev.hijackDur > 1 && lev.cloakDur > 1 && lev.scoopRate > 1);

/* in the running game */
G.save = R.freshSave();
G.save.seenIntro = true;
NS.save.refreshStats();
NS.trip.startTrip('career', 0);
for (let i = 0; i < 20 && G.cine; ++i) { NS.cinematics.skip(); H.run(NS, 30); }
const s = G.ship;
s.control = true;

/* gas scooping speed */
function scoop(rate) {
  G.stats.scoopRate = rate;
  G.stats.scoop = 0;
  G.clouds.length = 0;
  G.run.cargo = {}; G.run.cargoUsed = 0;
  const c = NS.life.cloud(1000, 1000, 160, 'hydrogen', false, () => 0.5);
  c.vx = c.vy = 0;
  G.clouds.push(c);
  for (let i = 0; i < 120; ++i) { s.x = 1000; s.y = 1000; s.vx = 200; s.vy = 0; NS.life.update(1 / 60); }
  return G.run.cargo.hydrogen || 0;
}
const slow = scoop(1), fast = scoop(2.5);
check('Scoop Intake scoops gas faster (' + slow + ' vs ' + fast + ')', fast > slow * 1.8);
G.stats.scoopRate = 1;
G.clouds.length = 0;

/* pulse reach */
G.stats.scan = 1; G.run.pulseCd = 0; G.stats.pulseMul = 1;
NS.mining.pulse();
const r1 = G.run.pulse.r;
G.run.pulseCd = 0; G.stats.pulseMul = 1.4;
NS.mining.pulse();
check('Signal Flares widen the scanner pulse', Math.abs(G.run.pulse.r / r1 - 1.4) < 1e-6);
G.run.pulse = null;

/* armour piercing and sappers */
const e = NS.enemies.spawn('syn_tower', 3000, 3000, {});
const hp0 = e.hp;
G.stats.pierce = 0; G.stats.unitStruct = 1;
NS.enemies.damage(e, 100, null, 'energy');
const plain = hp0 - e.hp;
e.hp = hp0;
G.stats.pierce = 0.2;
NS.enemies.damage(e, 100, null, 'energy');
check('Penetrators let more of a resisted hit through', hp0 - e.hp > plain);
e.hp = hp0; G.stats.pierce = 0;
const unit = NS.units.spawn('fighter', 2900, 3000, 'player');
NS.enemies.damage(e, 100, unit, 'energy');
const byUnit = hp0 - e.hp;
e.hp = hp0; G.stats.unitStruct = 1.3;
NS.enemies.damage(e, 100, unit, 'energy');
check('Sappers: units hit structures harder', Math.abs((hp0 - e.hp) / byUnit - 1.3) < 1e-6);
G.stats.unitStruct = 1;

/* spotting cloaked craft */
const st = NS.enemies.spawn('stalker', s.x + 300, s.y, {});
G.stats.detect = 1;
st.seenT = 0;
NS.enemies.spot(st, 1 / 60);
check('a stalker 300 out stays hidden with plain sensors', !(st.seenT > 0));
G.stats.detect = 1.25;
NS.enemies.spot(st, 1 / 60);
check('Keen Sensors spot it', st.seenT > 0);
G.stats.detect = 1;

/* abilities */
const herder = NS.units.spawn('herder', 1500, 1500, 'player');
G.stats.abilityCd = 0.8;
herder.abCd = 0;
NS.abilities.cast(herder, { x: 1700, y: 1500 });
check('Drilled Crews shorten ability cooldowns', Math.abs(herder.abCd - NS.fleetData.ABILITIES[herder.def.ability].cd * 0.8) < 1e-6);
G.stats.abilityCd = 1;

/* hardpoints */
check('Hot Coils and Quick Loaders reach the hardpoints', NS.hardpoints.dmgMul() === G.stats.hpDmg && NS.hardpoints.cdMul() === G.stats.hpCd);

/* the convoy */
G.stats.wing = 2;
NS.freighters.hireWing();
check('Bigger Wing hires two more fighters', G.wing.length === 4);
G.wing.length = 0;
G.stats.freighterHp = 1.4;
check('Armoured Freighters build tougher hulls', NS.freighters.hullHp() === Math.round(NS.escort.FREIGHTER.hp * 1.4));
G.stats.freighterSpeed = 1.16;
check('Tuned Haulers fly faster', Math.abs(NS.freighters.speed() - NS.escort.pace(G.world.w) * 1.16) < 1e-9);

done();
