'use strict';

/* The combat model and the hardpoints as pure rules: every damage type against every armour,
   the types of the shot kinds and of units and turrets, the armour of every enemy and pirate, an
   army's damage mix and the counter-pick it makes waves lean toward; weapons in the save -
   unlocks, prices, levels, mounting per hull, repair and the Pulse Cannon from Claim Jumpers. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/colony.js');
const { check, done } = H;
const CB = NS.combat, R = NS.rules, C = NS.colony;
const { WEAPONS, WEAPON_BY_ID, SLOTS } = NS.weaponData;
const { ENEMIES, UNITS } = NS.fleetData;

/* ── the table ── */
check('five damage types against six armours, every factor positive', CB.TYPES.length === 5 && CB.ARMOURS.length === 6 &&
  CB.TYPES.every(t => CB.ARMOURS.every(a => CB.TABLE[t][a] > 0)));
check('flak shreds swarms and light hulls, bounces off armour', CB.mult('flak', 'swarm') > 1.5 && CB.mult('flak', 'light') > 1 && CB.mult('flak', 'armoured') < 0.5);
check('kinetic punches armour, explosives crack structures, EMP strips shields', CB.mult('kinetic', 'armoured') > 1.2 && CB.mult('explosive', 'structure') > 1.2 &&
  CB.mult('emp', 'shielded') > 2 && CB.mult('emp', 'light') < 0.5);
check('no type is best against everything', CB.TYPES.every(t => CB.ARMOURS.some(a => CB.mult(t, a) < 1)));
check('unknown types and armours count as 1', CB.mult('control', 'light') === 1 && CB.mult('energy', 'nothing') === 1);
check('shot kinds carry their type', CB.typeOfKind('bolt') === 'energy' && CB.typeOfKind('shell') === 'kinetic' && CB.typeOfKind('flak') === 'flak' &&
  CB.typeOfKind('missile') === 'explosive' && CB.typeOfKind('artillery') === 'explosive');
check('every enemy and pirate has an armour', ENEMIES.every(e => CB.ARMOURS.indexOf(e.armour) >= 0) &&
  Object.keys(NS.ships.PIRATES).every(k => CB.ARMOURS.indexOf(NS.ships.PIRATES[k].armour) >= 0));
check('every armed unit and turret has a damage type', UNITS.filter(u => u.dmg > 0).every(u => CB.TYPES.indexOf(u.dtype) >= 0) &&
  ['laser', 'flak', 'missile'].every(id => CB.TYPES.indexOf(NS.colonyData.BUILDING_BY_ID[id].dtype) >= 0));

/* ── mixes and the counter-pick ── */
const flakOnly = CB.mix([{ type: 'flak', w: 3 }, { type: 'flak', w: 1 }]);
check('a mix shares out its damage', flakOnly.flak === 1 && JSON.stringify(CB.mix([])) === '{}');
const both = CB.mix([{ type: 'flak', w: 1 }, { type: 'kinetic', w: 3 }]);
check('several types share by weight', Math.abs(both.kinetic - 0.75) < 1e-9 && Math.abs(both.flak - 0.25) < 1e-9);
check('an all-flak army makes armour likelier and swarms rarer', CB.counterWeight(flakOnly, 'armoured') > 2 && CB.counterWeight(flakOnly, 'swarm') < 0.5);
check('no army leaves the weights alone', CB.counterWeight({}, 'armoured') === 1);
const zone = NS.ores.ZONES[3];
const plain = C.composeWave(9, zone, 20000, 77, {});
check('without an army the waves compose as before', JSON.stringify(C.composeWave(9, zone, 20000, 77, { army: null })) === JSON.stringify(plain));
const share = (w, ids) => { let n = 0, t = 0; for (const g of w.groups) { t += g.n; if (ids.indexOf(g.type) >= 0) n += g.n; } return n / Math.max(1, t); };
const armoured = ENEMIES.filter(e => e.armour === 'armoured').map(e => e.id);
let more = 0;
for (let s = 0; s < 20; ++s) if (share(C.composeWave(9, zone, 20000, s, { army: flakOnly }), armoured) > share(C.composeWave(9, zone, 20000, s, {}), armoured)) ++more;
check('later waves lean toward what resists the army', more >= 12, more + ' of 20');
check('early waves do not counter yet', JSON.stringify(C.composeWave(3, zone, 20000, 5, { army: flakOnly })) === JSON.stringify(C.composeWave(3, zone, 20000, 5, {})));

/* ── hardpoints in the save ── */
check('nine weapons with types, modes and unlocks', WEAPONS.length === 9 && WEAPONS.every(w => ['auto', 'charge', 'press', 'toggle'].indexOf(w.mode) >= 0 && (w.unlock.id || w.unlock.licence)));
check('hulls carry one to three hardpoints', SLOTS.prospector === 1 && SLOTS.wasp === 2 && SLOTS.hauler === 2 && SLOTS.leviathan === 3 && CB.slotCount('nope') === 1);
let s = R.freshSave();
check('a fresh save owns no weapons', JSON.stringify(s.weapons) === JSON.stringify({ owned: {}, slots: [] }) && CB.mounted(s).length === 1 && CB.mounted(s)[0] === null);
check('weapons open with their belt licence or unlock', !CB.open(s, 'pulse') && !CB.open(s, 'flak') && (s.licenses.push('amber'), CB.open(s, 'flak')) && !CB.open(s, 'rail'));
s.credits = 4000;
check('buying needs the credits', !CB.buy(s, 'missile') && CB.buy(s, 'flak') && CB.level(s, 'flak') === 1 && s.credits === 4000 - WEAPON_BY_ID.flak.cost);
check('a new weapon goes into a free hardpoint', CB.mounted(s)[0] === 'flak');
s.credits = 1e6;
const c1 = CB.nextCost(s, 'flak');
check('levels cost more and stop at three', c1 > WEAPON_BY_ID.flak.cost && CB.buy(s, 'flak') && CB.buy(s, 'flak') && CB.level(s, 'flak') === 3 && CB.nextCost(s, 'flak') === -1 && !CB.buy(s, 'flak'));
CB.buy(s, 'missile');
check('a full hull does not mount the next weapon by itself', CB.mounted(s).join() === 'flak');
s.hull = 'wasp';
check('a bigger hull shows more hardpoints', CB.mounted(s).length === 2 && CB.mount(s, 1, 'missile') && CB.mounted(s).join() === 'flak,missile');
check('a weapon sits in one hardpoint at most', CB.mount(s, 0, 'missile') && CB.mounted(s).join() === 'missile,' && !CB.mount(s, 0, 'rail'));
/* Claim Jumpers hands out the Pulse Cannon */
s = R.freshSave();
NS.ops.finish(s, NS.opsData.OP_BY_ID.k_jumpers, true, 100);
check('Claim Jumpers hands out the Pulse Cannon, mounted', CB.level(s, 'pulse') === 1 && CB.mounted(s)[0] === 'pulse' && CB.nextCost(s, 'pulse') > 0);
const rep = R.migrateSave({ v: 3, unlocks: ['w_pulse'], weapons: { owned: { flak: 9, nope: 1, missile: -1 }, slots: ['nope', 'flak', 'flak'] } });
check('stored weapons are repaired and unlocks granted', rep.weapons.owned.flak === 3 && !rep.weapons.owned.nope && !rep.weapons.owned.missile &&
  rep.weapons.owned.pulse === 1 && rep.weapons.slots[1] === 'flak' && rep.weapons.slots.filter(x => x === 'flak').length === 1);

done();
