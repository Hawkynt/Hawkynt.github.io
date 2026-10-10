'use strict';

global.window = {};
require('../puzzle-core.js');
require('../levels-data.js');

const core = window.SZ.PuzzleCore;
const data = window.SZ.PuzzleLevels;

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const REALM_NAMES = ['Ember Grove', 'Tide Caverns', 'Stone Peaks', 'Sky Ruins', 'Elemental Sanctum'];
const REALM_ELEMENTS = [['fire'], ['fire', 'water'], ['fire', 'water', 'earth'],
  ['fire', 'water', 'earth', 'air'], ['fire', 'water', 'earth', 'air']];
const REALM_COLORS = ['#ff7a3a', '#3ab4ff', '#c9a36a', '#bfe8ff', '#c04cff'];

/* ── structure ───────────────────────────────────────────────────────── */

check('realms: five entries with exact names, elements and colors',
  data.REALMS.length === 5 && data.REALMS.every(function(rm, i) {
    return rm.id === i && rm.name === REALM_NAMES[i] &&
      JSON.stringify(rm.elements) === JSON.stringify(REALM_ELEMENTS[i]) &&
      rm.color === REALM_COLORS[i];
  }), JSON.stringify(data.REALMS));

check('campaign: 40 levels, eight per realm in realm order',
  data.CAMPAIGN.length === 40 && data.CAMPAIGN.every(function(l, i) {
    return l.realm === ((i / 8) | 0);
  }), 'count ' + data.CAMPAIGN.length);

check('campaign: ids 1-1 .. 5-8 in order',
  data.CAMPAIGN.every(function(l, i) {
    return l.id === ((i / 8 | 0) + 1) + '-' + (i % 8 + 1);
  }), data.CAMPAIGN.map(l => l.id).join(','));

check('bonus: 60 levels with realm -1 and ids T1 .. T60',
  data.BONUS.length === 60 && data.BONUS.every(function(l, i) {
    return l.realm === -1 && l.id === 'T' + (i + 1);
  }), 'count ' + data.BONUS.length);

const all = data.CAMPAIGN.concat(data.BONUS);
const ids = {};
let dup = null;
for (const l of all) {
  if (ids[l.id]) dup = l.id;
  ids[l.id] = true;
}
check('ids: all 100 unique', dup === null && all.length === 100, 'duplicate ' + dup);

/* ── per-level fields ────────────────────────────────────────────────── */

const fieldBad = [];
for (const l of all) {
  try {
    core.parseLevel(l);
  } catch (e) {
    fieldBad.push(l.id + ' parse: ' + e.message);
    continue;
  }
  if (!(l.par >= 1)) fieldBad.push(l.id + ' par ' + l.par);
  if (!(l.mana >= l.par)) fieldBad.push(l.id + ' mana ' + l.mana + ' < par ' + l.par);
  let tiles = 0;
  for (const row of l.grid)
    for (const ch of row)
      if (ch === 'r')
        ++tiles;
  if (l.runes !== tiles) fieldBad.push(l.id + ' runes ' + l.runes + ' != ' + tiles + ' tiles');
  if (typeof l.hint !== 'string' || l.hint.length === 0) fieldBad.push(l.id + ' hint');
  if (typeof l.name !== 'string' || l.name.length === 0) fieldBad.push(l.id + ' name');
}
check('fields: every level parses, mana >= par, rune count matches',
  fieldBad.length === 0, fieldBad.join('; '));

/* ── open ground ─────────────────────────────────────────────────────── */

const fillerBad = [];
for (const l of all) {
  let water = 0, stone = 0;
  for (const row of l.grid)
    for (const ch of row) {
      if (ch === 'o') ++water;
      if (ch === 'S') ++stone;
    }
  if (water > 0) fillerBad.push(l.id + ' starts with ' + water + ' water tiles');
  if (stone > 2) fillerBad.push(l.id + ' starts with ' + stone + ' raised stones');
}
check('tiles: no pre-flooded water, at most two raised stones per level',
  fillerBad.length === 0, fillerBad.join('; '));

/* ── re-verification with the solver ─────────────────────────────────── */

const t0 = Date.now();
const solveBad = [];
for (const l of all) {
  const sol = core.solve(l, { perfect: true, maxStates: 400000 });
  if (!sol)
    solveBad.push(l.id + ' unsolvable');
  else if (sol.par !== l.par)
    solveBad.push(l.id + ' par ' + sol.par + ' != ' + l.par);
}
const elapsed = Date.now() - t0;
check('solve: all 100 levels re-verified at their par', solveBad.length === 0, solveBad.join('; '));
console.log('INFO solve: 100 levels re-verified in ' + elapsed + ' ms');
check('solve: re-verification stays under 120 s', elapsed < 120000, elapsed + ' ms');

/* ── difficulty curve ────────────────────────────────────────────────── */

const means = [];
for (let realm = 0; realm < 5; ++realm) {
  const slice = data.CAMPAIGN.slice(realm * 8, realm * 8 + 8);
  means.push(slice.reduce((a, l) => a + l.par, 0) / slice.length);
}
let curveBad = [];
for (let realm = 1; realm < 5; ++realm)
  if (means[realm] < means[realm - 1])
    curveBad.push('realm ' + realm + ' mean ' + means[realm] + ' < realm ' + (realm - 1) + ' mean ' + means[realm - 1]);
check('curve: mean par non-decreasing per realm', curveBad.length === 0, curveBad.join('; '));

process.exit(failures ? 1 : 0);
