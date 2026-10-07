'use strict';

global.window = {};
require('../campaign.js');

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const C = window.SZ.InvaderCampaign || {};
const SECTORS = C.SECTORS;
const STAGES = C.STAGES;

/* Test 0: every documented export is present and callable where expected */
const fns = ['stageIndexById', 'nextStage', 'starsFor', 'STAR_TEXT', 'creditsFor', 'rng', 'hashSeed', 'dailySeed', 'sectorUnlocked', 'stageUnlocked'];
const missing = fns.filter(n => typeof C[n] !== 'function');
const badData = !Array.isArray(C.SECTORS) || !Array.isArray(C.STAGES) || !Array.isArray(C.FORMATION_PLAN);
check('exports', missing.length === 0 && !badData, 'missing ' + missing.join(',') + ' bad-data ' + badData);
if (missing.length > 0 || badData) {
  console.log('cannot continue without the campaign exports');
  process.exit(1);
}

/* Test 1: 6 sectors, 30 stages, ids unique and in order '1-1'..'6-5' */
check('sector-count', SECTORS.length === 6, 'got ' + SECTORS.length);
check('stage-count', STAGES.length === 30, 'got ' + STAGES.length);
const wantIds = [];
for (let s = 1; s <= 6; ++s)
  for (let k = 1; k <= 5; ++k)
    wantIds.push(s + '-' + k);
const gotIds = STAGES.map(st => st.id);
const uniqueIds = new Set(gotIds).size === 30;
check('stage-ids', uniqueIds && gotIds.join(',') === wantIds.join(','), 'got ' + gotIds.join(','));

/* Test 2: boss stages every 5th, others carry a formation 0..11 */
let ok2 = true, why2 = [];
for (let i = 0; i < STAGES.length; ++i) {
  const st = STAGES[i];
  if (i % 5 === 4) {
    if (!st.boss || st.formation !== null) { ok2 = false; why2.push(st.id); }
  } else if (st.boss !== null || !(st.formation >= 0 && st.formation <= 11)) {
    ok2 = false; why2.push(st.id);
  }
}
check('boss-and-formation-shape', ok2, 'bad stages ' + why2.join(','));

/* Test 3: speed and fire increase monotonically, armored bounds hold */
let ok3 = true, why3 = [];
for (let i = 1; i < STAGES.length; ++i) {
  if (!(STAGES[i].speed > STAGES[i - 1].speed)) { ok3 = false; why3.push('speed ' + STAGES[i].id); }
  if (!(STAGES[i].fire > STAGES[i - 1].fire)) { ok3 = false; why3.push('fire ' + STAGES[i].id); }
}
for (let i = 0; i < STAGES.length; ++i) {
  const st = STAGES[i];
  if (st.sector < 2 && st.armored !== 0) { ok3 = false; why3.push('armored ' + st.id); }
  if (st.armored > 0.5) { ok3 = false; why3.push('armored>0.5 ' + st.id); }
}
check('difficulty-curves', ok3, why3.join(','));

/* Test 3b: frozen data and the exact curves at both ends of the campaign */
const first = STAGES[0], last = STAGES[STAGES.length - 1] || {};
const frozen = STAGES.every(st => Object.isFrozen(st)) && SECTORS.every(sec => Object.isFrozen(sec));
check('frozen-data', frozen, 'stage or sector not frozen');
check('curve-values',
  first.speed === 1 && first.fire === 1 && first.armored === 0 &&
  last.speed === 2.74 && last.fire === 2.45 && last.armored === 0.5,
  'first ' + JSON.stringify([first.speed, first.fire, first.armored]) + ' last ' + JSON.stringify([last.speed, last.fire, last.armored]));
const lastBoss = last.boss || {};
check('boss-scaling',
  STAGES[4].boss.hp === 30 && STAGES[4].escorts === 0 &&
  lastBoss.hp === 140 && last.escorts === 3 && lastBoss.design === 5 && last.name === 'The Overmind',
  JSON.stringify([STAGES[4].boss, STAGES[4].escorts, lastBoss, last.escorts]));
const planOk = STAGES.every(st => st.formation === null || C.FORMATION_PLAN[st.sector][st.stage] === st.formation);
check('formation-plan-used', planOk, 'stage formation does not match FORMATION_PLAN');
const planWant = '[[0,1,2,3],[4,5,0,6],[7,8,10,3],[9,11,5,2],[6,10,7,11],[8,9,11,4]]';
check('formation-plan-exact', JSON.stringify(C.FORMATION_PLAN) === planWant, 'got ' + JSON.stringify(C.FORMATION_PLAN));

/* Test 3c: the armored share follows its own curve (rounded to dodge float noise) */
const r2v = v => Math.round(v * 100) / 100;
check('armored-curve',
  r2v(STAGES[10].armored) === 0.12 && r2v(STAGES[14].armored) === 0.24 &&
  r2v(STAGES[24].armored) === 0.48 && r2v(STAGES[26].armored) === 0.5,
  JSON.stringify([STAGES[10].armored, STAGES[14].armored, STAGES[24].armored, STAGES[26].armored]));

/* Test 3d: sector themes, boss colors and stage names */
check('themes-and-names',
  SECTORS.map(sec => sec.id).join(',') === '1,2,3,4,5,6' &&
  SECTORS.map(sec => sec.name).join(',') === 'Lunar Orbit,Mars Front,Asteroid Belt,Jupiter Storm,Saturn Rings,Mothership' &&
  SECTORS.map(sec => sec.boss.name).join(',') === 'Crater Warden,Rust Colossus,Rock Hive,Storm Leviathan,Ring Sentinel,The Overmind' &&
  SECTORS.map(sec => sec.theme).join(',') === 'moon,mars,asteroids,jupiter,saturn,mothership' &&
  SECTORS.map(sec => sec.boss.color).join(',') === '#c8d0e0,#ff6a3a,#c9a36a,#ffb36a,#e8d48a,#c04cff' &&
  STAGES[0].name === 'Lunar Orbit 1' && STAGES[3].name === 'Lunar Orbit 4' &&
  STAGES[25].name === 'Mothership 1' && STAGES[9].name === 'Rust Colossus',
  SECTORS.map(sec => sec.theme).join(',') + ' | ' + [STAGES[0].name, STAGES[3].name, STAGES[25].name, STAGES[9].name].join(','));

/* Test 4: star rules */
const plain = STAGES[0];
const boss = STAGES[4];
check('stars-not-cleared', C.starsFor(plain, { cleared: false, livesLost: 0, maxMultiplier: 5, bossSeconds: 1 }) === 0, 'expected 0');
check('stars-cleared-lost-life-x2', C.starsFor(plain, { cleared: true, livesLost: 1, maxMultiplier: 2, bossSeconds: 0 }) === 1, 'expected 1');
check('stars-flawless-x3', C.starsFor(plain, { cleared: true, livesLost: 0, maxMultiplier: 3, bossSeconds: 0 }) === 3, 'expected 3');
check('stars-boss-slow', C.starsFor(boss, { cleared: true, livesLost: 0, maxMultiplier: 0, bossSeconds: 120 }) === 2, 'expected 2');
check('stars-boss-fast', C.starsFor(boss, { cleared: true, livesLost: 0, maxMultiplier: 0, bossSeconds: 90 }) === 3, 'expected 3');

/* Test 4b: the star hints shown to the player */
const tPlain = C.STAR_TEXT(plain), tBoss = C.STAR_TEXT(boss);
check('star-text',
  tPlain.length === 3 && tPlain[0] === 'Clear the stage' && tPlain[1] === 'Lose no life' && tPlain[2] === 'Reach a x3 combo' &&
  tBoss[2] === 'Defeat the boss within 90 s',
  JSON.stringify(tPlain) + ' ' + JSON.stringify(tBoss));

/* Test 5: credits */
check('credits-score-only', C.creditsFor(1234, null, 0) === 123, 'got ' + C.creditsFor(1234, null, 0));
check('credits-with-stage', C.creditsFor(1000, STAGES[7], 3) === 100 + 50 + 25 + 60, 'got ' + C.creditsFor(1000, STAGES[7], 3));

/* Test 6: stage chain and unlock rules */
check('next-stage', C.nextStage('1-5') && C.nextStage('1-5').id === '2-1', 'expected 2-1');
check('next-stage-end', C.nextStage('6-5') === null, 'expected null');
check('unlock-first-open', C.stageUnlocked({}, 0) === true, 'expected true');
check('unlock-second-locked', C.stageUnlocked({}, 1) === false, 'expected false');
check('unlock-second-open', C.stageUnlocked({ '1-1': 1 }, 1) === true, 'expected true');
check('unlock-sector', C.sectorUnlocked({ '1-5': 2 }, 1) === true, 'expected true');
check('unlock-sector-closed', C.sectorUnlocked({}, 1) === false && C.sectorUnlocked({}, 0) === true, 'expected false/true');
check('stage-index', C.stageIndexById('1-1') === 0 && C.stageIndexById('6-5') === 29 && C.stageIndexById('9-9') === -1,
  [C.stageIndexById('1-1'), C.stageIndexById('6-5'), C.stageIndexById('9-9')].join(','));

/* Test 7: seeded rng and daily seed */
const r1 = C.rng(5), r2 = C.rng(5), r3 = C.rng(6);
let ok7 = true, why7 = [];
const draws = [];
for (let i = 0; i < 10; ++i) {
  const a = r1(), b = r2(), c = r3();
  if (a !== b) { ok7 = false; why7.push('repeat ' + i); }
  if (a === c) { ok7 = false; why7.push('seed ' + i); }
  if (!(a >= 0 && a < 1)) { ok7 = false; why7.push('range ' + i); }
  draws.push(a);
}
if (new Set(draws).size !== draws.length) { ok7 = false; why7.push('stuck'); }
check('rng-repeatable', ok7, 'problem at ' + why7.join(','));
let sum = 0;
const rMany = C.rng(12345);
for (let i = 0; i < 4000; ++i)
  sum += rMany();
check('rng-spread', sum / 4000 > 0.45 && sum / 4000 < 0.55, 'mean ' + (sum / 4000));

/* Test 7b: hashSeed matches the published FNV-1a 32-bit test vectors */
check('hash-seed-vectors',
  C.hashSeed('') === 0x811c9dc5 && C.hashSeed('a') === 0xe40c292c && C.hashSeed('foobar') === 0xbf9cf968,
  [C.hashSeed(''), C.hashSeed('a'), C.hashSeed('foobar')].map(v => v.toString(16)).join(','));
const dayA = new Date(2026, 9, 6);
const dayA2 = new Date(2026, 9, 6, 17, 30);
const dayB = new Date(2026, 9, 7);
check('daily-seed', C.dailySeed(dayA) === C.dailySeed(dayA2) && C.dailySeed(dayA) !== C.dailySeed(dayB),
  C.dailySeed(dayA) + ' vs ' + C.dailySeed(dayA2) + ' vs ' + C.dailySeed(dayB));

if (failures > 0) {
  console.log(failures + ' failure(s)');
  process.exit(1);
}
console.log('all tests passed');
