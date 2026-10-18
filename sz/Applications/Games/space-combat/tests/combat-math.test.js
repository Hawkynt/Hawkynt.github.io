'use strict';

/* Weapon and damage maths: crits, armour, combo multiplier, derived stats from the tree,
   weapon damage-per-second balance and enemy/boss data sanity. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules;
const { SHIPS, PRIMARIES, SECONDARIES, byId } = NS.ships;
const { ENEMIES, BOSSES, BOSS_ORDER } = NS.enemyData;
const { COMBO_STEPS } = NS.constants;

const save = R.defaultSave();
const base = R.computeStats(save, 'falcon');
check('base falcon stats come from the ship', base.hull === 110 && base.shield === 70 && base.dmgMul === 1, JSON.stringify(base));
check('no crits without the Targeting Matrix', !R.hitDamage(10, base, 0).crit);
save.tree.w_crit = 2;
save.tree.w_dmg = 3;
const st = R.computeStats(save, 'falcon');
check('crit chance per level', Math.abs(st.crit - 0.1) < 1e-9, st.crit);
check('roll below crit chance doubles damage', R.hitDamage(10, st, 0.05).crit && Math.abs(R.hitDamage(10, st, 0.05).dmg - 10 * 1.24 * 2) < 1e-9);
check('roll above crit chance is a normal hit', !R.hitDamage(10, st, 0.5).crit && Math.abs(R.hitDamage(10, st, 0.5).dmg - 12.4) < 1e-9);
check('extra multiplier applies (overcharge)', Math.abs(R.hitDamage(10, st, 0.5, 1.5).dmg - 18.6) < 1e-9);

save.tree.d_armor = 3;
const ar = R.computeStats(save, 'falcon');
check('armour reduces hull damage', Math.abs(R.armorDamage(100, ar) - 82) < 1e-9, R.armorDamage(100, ar));
check('armour reduction is capped at 60%', R.armorDamage(100, { armor: 5 }) === 40);

check('combo x1 below the first step', R.comboMultiplier(0) === 1 && R.comboMultiplier(COMBO_STEPS[1] - 1) === 1);
check('combo steps raise the multiplier', R.comboMultiplier(COMBO_STEPS[1]) === 2 && R.comboMultiplier(COMBO_STEPS[3]) === 4);
check('combo multiplier tops out at x7', R.comboMultiplier(10000) === COMBO_STEPS.length);
let mono = true;
for (let c = 1; c < 200; ++c) if (R.comboMultiplier(c) < R.comboMultiplier(c - 1)) mono = false;
check('combo multiplier never drops as the chain grows', mono);

/* every tree stat level improves the derived stat in the right direction */
const fresh = R.defaultSave();
const s0 = R.computeStats(fresh, 'falcon');
fresh.tree = { d_hull: 5, d_shield: 5, e_thrust: 5, e_roll: 3, w_rate: 5, s_radar: 3, s_magnet: 3, s_salvage: 4, s_ability: 3 };
const s1 = R.computeStats(fresh, 'falcon');
check('hull and shield grow', s1.hull > s0.hull && s1.shield > s0.shield);
check('thrust and speed grow', s1.thrust > s0.thrust && s1.speed > s0.speed);
check('roll and special cooldowns shrink', s1.rollCd < s0.rollCd && s1.abilityCd < s0.abilityCd);
check('radar, magnet, salvage and fire rate grow', s1.radar > s0.radar && s1.magnet > s0.magnet && s1.salvage > s0.salvage && s1.rateMul > s0.rateMul);
check('specter brings radar and a drone', R.computeStats(R.defaultSave(), 'specter').escortDrones === 1);

/* weapon balance: every primary lands within a band of sustained damage */
const dps = PRIMARIES.map(w => w.kind === 'beam' ? w.dps : w.dmg * (w.count || 1) / w.rate * (w.kind === 'flak' ? 1 + w.frags * w.frag / w.dmg * 0.35 : 1));
const lo = Math.min.apply(null, dps), hi = Math.max.apply(null, dps);
check('primary weapons sit within a 2.2x DPS band', hi / lo < 2.2, dps.map(Math.round).join(','));
check('the starter weapon is free and others cost scrap', PRIMARIES[0].cost === 0 && PRIMARIES.slice(1).every(w => w.cost > 0));
check('six primaries and four secondaries', PRIMARIES.length === 6 && SECONDARIES.length === 4);
check('five ships, one free', SHIPS.length === 5 && SHIPS.filter(s => s.cost === 0).length === 1);
check('every ship has a distinct special', new Set(SHIPS.map(s => s.ability.id)).size === 5);
check('byId finds and misses', byId(SHIPS, 'bastion').name === 'Bastion' && byId(SHIPS, 'nope') === null);

/* enemies and bosses */
const ids = Object.keys(ENEMIES);
check('ten enemy types', ids.length === 10, ids.length);
check('every enemy has hp, radius, score and an ai', ids.every(k => ENEMIES[k].hp > 0 && ENEMIES[k].r > 0 && ENEMIES[k].score > 0 && ENEMIES[k].ai));
check('every enemy behaviour is distinct', new Set(ids.map(k => ENEMIES[k].ai)).size === 10);
check('five bosses in order', BOSS_ORDER.length === 5 && BOSS_ORDER.every(b => BOSSES[b]));
check('every boss has three phases from full health down', BOSS_ORDER.every(b => BOSSES[b].phases.length === 3 && BOSSES[b].phases[0].at === 1 && BOSSES[b].phases[1].at > BOSSES[b].phases[2].at));
check('every boss has a weak point or a shield to break', BOSS_ORDER.every(b => BOSSES[b].weak || BOSSES[b].shieldBy));
check('shielding parts exist on shielded bosses', BOSS_ORDER.every(b => !BOSSES[b].shieldBy || BOSSES[b].parts.filter(p => p.type === BOSSES[b].shieldBy).length > BOSSES[b].shieldMin));
check('boss health rises sector by sector', BOSS_ORDER.every((b, i) => i === 0 || BOSSES[b].hp > BOSSES[BOSS_ORDER[i - 1]].hp));

done();
