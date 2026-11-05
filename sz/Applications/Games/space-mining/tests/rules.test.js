'use strict';

/* Progression maths: tech tree states, costs and buying with research data; hangar upgrades
   with rising costs and a cap; hulls; station modules; belt licences; derived stats; the
   fixed Daily loadout; hold space; achievements. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules;
const { TREE, TREE_BY_ID, BRANCHES } = NS.treeData;
const { UPGRADES, HULLS, MODULES } = NS.ships;
const { ZONES, ORES } = NS.ores;

check('six branches and 32 nodes', BRANCHES.length === 6 && TREE.length === 32);
check('every prerequisite names a real node', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]] && r[1] <= TREE_BY_ID[r[0]].costs.length)));
check('every node belongs to a branch', TREE.every(n => BRANCHES.some(b => b.id === n.branch)));

const s = R.freshSave();
check('a fresh save starts with credits and a little research', s.credits === R.START_CREDITS && s.rd === R.START_RD && s.hull === 'prospector');
check('a root node is available', R.nodeState(s, 'd_focus') === 'available');
check('a node behind a prerequisite is locked', R.nodeState(s, 'd_crit') === 'locked');
check('buying spends research data', R.buyNode(s, 'd_focus') && s.rd === R.START_RD - 2 && R.nodeLevel(s, 'd_focus') === 1);
s.rd = 0;
check('without data a node is too expensive', R.nodeState(s, 'd_focus') === 'expensive' && !R.buyNode(s, 'd_focus'));
s.rd = 1000;
for (let i = 0; i < 9; ++i) R.buyNode(s, 'd_focus');
check('a node stops at its last level', R.nodeLevel(s, 'd_focus') === 5 && R.nodeState(s, 'd_focus') === 'maxed');
check('meeting the prerequisite unlocks the next node', R.nodeState(s, 'd_crit') === 'available');
check('node text fills in the level', R.nodeText(TREE_BY_ID.d_focus, 3) === '+30% laser power');

/* upgrades */
const u = R.freshSave();
u.credits = 1e9;
let last = 0, rising = true;
for (let i = 0; i < 10; ++i) {
  const c = R.upgradeCost(u, 'laser');
  if (c <= last) rising = false;
  last = c;
  R.buyUpgrade(u, 'laser');
}
check('upgrade costs rise every level', rising);
check('upgrades cap at level 10', u.upgrades.laser === 10 && !R.buyUpgrade(u, 'laser') && R.upgradeCost(u, 'laser') === 0);
const poor = R.freshSave();
poor.credits = 10;
check('an upgrade needs the credits', !R.buyUpgrade(poor, 'cargo') && poor.upgrades.cargo === 0);

/* hulls and modules */
const h = R.freshSave();
check('an unaffordable hull is not bought', !R.buyHull(h, 'leviathan') && h.hull === 'prospector');
h.credits = 100000;
check('buying a hull flies it', R.buyHull(h, 'wasp') && h.hull === 'wasp' && h.credits === 100000 - 7500);
check('an owned hull is selected for free', R.buyHull(h, 'prospector') && h.hull === 'prospector' && h.credits === 92500);
check('modules build level by level', R.buildModule(h, 'refinery') && h.modules.refinery === 1 && R.moduleCost(h, 'refinery') === MODULES[0].costs[1]);

/* belts */
const z = R.freshSave();
check('the home belt is open, the rest locked', R.zoneState(z, 0) === 'open' && R.zoneState(z, 1) === 'locked' && R.zoneState(z, 2) === 'locked');
z.stats.earned = ZONES[1].unlock.earned;
check('earnings make the next licence buyable', R.zoneState(z, 1) === 'buyable' && R.zoneState(z, 2) === 'locked');
z.credits = 0;
check('a licence needs the fee', !R.buyLicense(z, 1));
z.credits = ZONES[1].unlock.fee;
check('buying the licence opens the belt', R.buyLicense(z, 1) && R.zoneState(z, 1) === 'open' && z.credits === 0);
z.stats.earned = 1e9;
check('belts open strictly in order', R.zoneState(z, 3) === 'locked' && R.zoneState(z, 2) === 'buyable');
check('belt unlock thresholds rise', ZONES.every((zz, i) => i === 0 || zz.unlock.earned > ZONES[i - 1].unlock.earned));

/* stats */
const base = R.computeStats(R.freshSave());
const up = R.freshSave();
up.upgrades.cargo = 5; up.upgrades.laser = 5; up.tree.l_hold = 2; up.tree.f_shield = 1; up.modules.droneBay = 2; up.tree.a_drone = 1;
const st = R.computeStats(up);
check('upgrades and research raise the stats', st.cargo > base.cargo && st.laser > base.laser && st.shield === 25 && base.shield === 0);
check('drones come from the bay, the hull and research', st.drones === 3 && base.drones === 0);
check('the hauler flies with a bigger hold', R.computeStats(R.freshSave(), 'hauler').cargo > base.cargo);
const d1 = R.computeStats(R.dailyLoadout(), 'prospector'), d2 = R.computeStats(R.dailyLoadout(), 'prospector');
check('the Daily loadout is the same for everyone', JSON.stringify(d1) === JSON.stringify(d2) && d1.boost === 1 && d1.drones === 1);
const comp = R.freshSave();
comp.tree.l_compress = 1;
const cs = R.computeStats(comp);
check('the compactor halves common ore only', R.oreSpace(cs, 'iron') === 0.5 && R.oreSpace(cs, 'gold') === 1 && R.oreSpace(base, 'iron') === 1);
check('ore values rise with rarity', ORES.every((o, i) => i < 2 || o.value > ORES[i - 1].value));

/* achievements */
const a = R.freshSave();
a.stats.nuggets = 1;
a.stats.fractures = 150;
const rd0 = a.rd;
const got = R.checkAchievements(a);
check('reaching a goal earns it once, with research data', got.length === 2 && a.rd === rd0 + 1 + 3 && R.checkAchievements(a).length === 0);
check('upgrade data is complete', UPGRADES.length === 6 && HULLS.length === 4 && MODULES.length === 5);

done();
