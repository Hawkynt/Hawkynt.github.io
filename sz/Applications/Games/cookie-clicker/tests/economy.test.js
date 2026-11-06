'use strict';

/* Economy math: content sizes, bulk costs against a step-by-step sum, what the bank can afford,
   production with tiers, flavours, decorations, crystals, achievements, eras, buffs and the
   combo, recipe-note marks, sugar crystals, tech tree purchases in both currencies. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const E = NS.economy;
const { BUILDINGS } = NS.buildingData;
const { UPGRADES } = NS.upgradeData;
const { STAGES } = NS.treatData;
const { TREE } = NS.treeData;

check('at least 15 producers', BUILDINGS.length >= 15, BUILDINGS.length);
check('at least 60 upgrades', UPGRADES.length >= 60, UPGRADES.length);
check('at least 7 treat stages', STAGES.length >= 7, STAGES.length);
check('unique upgrade ids', new Set(UPGRADES.map(u => u.id)).size === UPGRADES.length);
check('producers get pricier and stronger in order', BUILDINGS.every((b, i) => !i || (b.cost > BUILDINGS[i - 1].cost && b.cps > BUILDINGS[i - 1].cps)));
check('stage thresholds rise', STAGES.every((s, i) => !i || s.need > STAGES[i - 1].need));

const p = E.newProfile();
const run = E.newRun('classic', p);
let st = E.compute(run, p, {});
check('fresh run bakes nothing', st.cps === 0 && run.cookies === 0);
check('a fresh click is worth 1', Math.abs(st.click - 1) < 1e-9, st.click);

/* bulk costs */
run.buildings.grandma = 7;
let iter = 0;
for (let k = 0; k < 10; ++k) iter += 100 * Math.pow(1.15, 7 + k);
check('bulk cost equals the step-by-step sum', Math.abs(E.buildingCost(run, st, 'grandma', 10) - Math.ceil(iter)) <= 1, E.buildingCost(run, st, 'grandma', 10) + ' vs ' + iter);
run.cookies = 5000;
const n = E.maxAffordable(run, st, 'grandma');
check('max affordable fits the bank', E.buildingCost(run, st, 'grandma', n) <= 5000 && E.buildingCost(run, st, 'grandma', n + 1) > 5000, n);

/* production */
run.buildings.grandma = 10;
run.buildings.cursor = 10;
st = E.compute(run, p, {});
check('production is the sum of producers', Math.abs(st.cps - (10 * 1 + 10 * 0.1)) < 1e-9, st.cps);
run.upgrades['t-grandma-0'] = true;
st = E.compute(run, p, {});
check('a tier upgrade doubles its producer', Math.abs(st.cps - (20 + 1)) < 1e-9, st.cps);
run.upgrades['g-sugar'] = true;
st = E.compute(run, p, {});
check('a flavour multiplies everything', Math.abs(st.cps - 21 * 1.05) < 1e-9, st.cps);
run.upgrades['d-icing'] = true;
st = E.compute(run, p, {});
check('a decoration shows up in the mask and boosts clicks', st.decoMask === 1 && Math.abs(st.click - 1.5 * 1) < 1e-9, st.decoMask + ' ' + st.click);
p.crystals = 10;
st = E.compute(run, p, {});
check('crystals add 1% each', Math.abs(st.cps - 21 * 1.05 * 1.05 * 1.1) < 1e-6, st.cps);
p.achievements.a01 = true;
st = E.compute(run, p, {});
check('achievements add 1% each', Math.abs(st.achF - 1.01) < 1e-9);
run.stage = 3;
st = E.compute(run, p, {});
check('eras add their bonus', Math.abs(st.eraF - 1.35) < 1e-9, st.eraF);
run.buffs.push({ id: 'frenzy', kind: 'prod', mult: 7, t: 10, dur: 77 });
check('buffs multiply production', E.buffMult(run, 'prod') === 7 && E.buffMult(run, 'click') === 1);
run.combo = 50;
check('the combo multiplies clicks', Math.abs(E.comboMult(run, st) - 2) < 1e-9, E.comboMult(run, st));
const bake = E.newRun('bake', null);
bake.buildings.cursor = 1;
check('Bake-Off runs bake twelve times as fast', Math.abs(E.compute(bake, E.newProfile(), {}).cps - 1.2) < 1e-9);
check('streak bonus is capped at 20%', NS.calendar.streakBonus(3) === 0.04 && NS.calendar.streakBonus(50) === 0.2);

/* notes, eras and crystals */
check('no notes below 100 baked', E.noteMark(99) === 0);
check('one note mark per half decade', E.noteMark(1000) === 3 && E.noteMark(3200) === 4 && E.noteMark(1e6) === 9);
check('stage for baked', E.stageFor(0) === 0 && E.stageFor(999) === 0 && E.stageFor(1000) === 1 && E.stageFor(1e18) === 7);
check('sugar crystals are the cube root of trillions', E.crystalsFor(1e12) === 1 && E.crystalsFor(8e12) === 2 && E.crystalsFor(1e15) === 10 && E.crystalsFor(9e11) === 0);

/* tech tree */
check('at least 25 tech nodes on two pages', TREE.length >= 25 && NS.treeData.PAGES.length === 2, TREE.length);
const q = E.newProfile();
check('a root node is too expensive without notes', E.nodeState(q, 'o_heat') === 'expensive');
check('a deeper node is locked', E.nodeState(q, 'o_trays') === 'locked');
q.notes = 3;
check('buying spends notes and levels up', E.buyNode(q, 'o_heat') && q.notes === 2 && E.nodeLevel(q, 'o_heat') === 1);
check('tree stats sum levels', Math.abs(E.treeStat(q, 'prod') - 0.05) < 1e-9);
q.crystals = 5;
check('Sanctum nodes cost unspent crystals', E.buyNode(q, 'c_potency') && q.crystalsSpent === 2 && E.wallet(q, 'crystals') === 3);
q.notes = 1000;
for (let i = 0; i < 10; ++i) E.buyNode(q, 'o_heat');
check('nodes stop at their max level', E.nodeLevel(q, 'o_heat') === 5 && E.nodeState(q, 'o_heat') === 'maxed');
q.tree.c_start = 1;
check('Heirloom Starter seeds new runs', E.newRun('classic', q).cookies === 1000);
q.tree.l_offhrs = 2;
check('offline cap grows with Night Shift', E.offlineGain(1, 1e9, q).cap === (8 + 4) * 3600);
done();
