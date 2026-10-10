'use strict';

/*
 * Level generator for the Fantasy Puzzle.
 *
 * Builds chamber-and-barrier maps for the five realms and keeps a candidate
 * only when the breadth-first solver in puzzle-core.js verifies it: solvable,
 * par inside the slot's target range, every realm element used by the optimal
 * perfect run, and a non-perfect route of at least two casts. Deterministic --
 * every realm/slot pair has a fixed seed, so levels-data.js is reproducible.
 *
 * Layout: the mage starts on the left, the goal sits on the right, and full
 * barrier columns split the map into chambers; each barrier has exactly one
 * gate of its realm's element, so the only route through the wall uses that
 * barrier's element. Chambers are carved out of solid rock and the open ground
 * is floor: the earth element raises stone on floor, so every extra floor tile
 * multiplies the solver's search. The route between two gates is therefore a
 * corridor, kept as tight as the slot's par needs, and structure is always
 * wall -- a pre-raised stone pillar would only read as a cast the player has
 * to reason about. Rune pockets are vertical chains of one to three seals --
 * each seal is a cast.
 *
 * Run: node sz/Applications/Games/fantasy-puzzle/tools/generate-levels.js
 */

global.window = {};
require('../puzzle-core.js');
const core = window.SZ.PuzzleCore;

const MAX_STATES = 300000;
const TIME_BUDGET_MS = 700;
const ATTEMPTS = 400;

const REALMS = [
  { id: 0, name: 'Ember Grove', elements: ['fire'], color: '#ff7a3a' },
  { id: 1, name: 'Tide Caverns', elements: ['fire', 'water'], color: '#3ab4ff' },
  { id: 2, name: 'Stone Peaks', elements: ['fire', 'water', 'earth'], color: '#c9a36a' },
  { id: 3, name: 'Sky Ruins', elements: ['fire', 'water', 'earth', 'air'], color: '#bfe8ff' },
  { id: 4, name: 'Elemental Sanctum', elements: ['fire', 'water', 'earth', 'air'], color: '#c04cff' }
];

const NAMES = [
  ['Kindling Path', 'Ashen Gate', 'Ember Hollow', 'Charred Crossing', 'Cinder Step', 'Blazing Way', 'Flame Thicket', 'Pyre Gate'],
  ['Mirror Tide', 'Flooded Hall', 'Channel Run', 'Welling Gate', 'Still Basin', 'Rain Corridor', 'Undertow', 'Tideway'],
  ['Granite Steps', 'Stone Bridge', 'Chasm Walk', 'Basalt Gate', 'Quarry Path', 'Stonefall', 'Rift Crossing', 'High Stone'],
  ['Gale Bridge', 'Boulder Lane', 'Wind Push', 'Sky Corridor', 'Gust Gate', 'Rolling Stone', 'Cloud Passage', 'Zephyr Way'],
  ['Sanctum Gate', 'Elemental Trial', 'Convergence', 'Fourfold Path', 'Sigil Hall', 'Elemental Crown', 'Inner Sanctum', 'Heart of Elements']
];

// interior width x height, first slot -> last slot
const DIMS = [
  [[8, 6], [10, 7]],
  [[9, 6], [10, 7]],
  [[10, 7], [11, 7]],
  [[11, 7], [12, 8]],
  [[11, 7], [12, 8]]
];

const OBSTACLES = 'w~_BiB';
const DIR4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function ri(rng, n) {
  return Math.floor(rng() * n);
}

function pick(rng, arr) {
  return arr[ri(rng, arr.length)];
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; --i) {
    const j = ri(rng, i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
}

function seedFor(kind, realm, slot, attempt) {
  let h = kind === 'c' ? 0x51ED2701 : 0x9E3779B1;
  h = Math.imul(h ^ (realm + 2), 0x85EBCA6B);
  h = Math.imul(h ^ (slot + 1), 0xC2B2AE35);
  h = Math.imul(h ^ (attempt + 1), 0x27D4EB2F);
  return h >>> 0;
}

function parRange(kind, realm, slot) {
  if (kind === 'b')
    return [4, 8];
  const j = realm * 8 + slot;
  const lo = 2 + Math.floor(j * 7 / 39);
  return [lo, Math.min(lo + 1, 9)];
}

function runeCount(realm, slot, rng) {
  if (realm < 0)
    return 2 + ri(rng, 2);
  if (realm === 0)
    return slot < 6 ? 1 : 2;
  if (realm === 1 || realm === 2)
    return slot < 4 ? 1 : 2;
  return 2;
}

/*
 * Open ground is floor and floor accepts earth casts, so the solver's branching
 * factor is the number of floor tiles the mage can touch. A par-p search over f
 * floor tiles costs about C(f, p) states, which bounds how much of the map a
 * slot of that par may leave open.
 */
function floorBudget(lo) {
  if (lo >= 8)
    return 16;
  if (lo >= 7)
    return 20;
  if (lo >= 6)
    return 24;
  if (lo >= 5)
    return 30;
  return 42;
}

// how far apart two gates may sit: the route may only jog as far as the open
// ground budget allows, and a straight route keeps a high-par search small
function gateSpread(budget, W, H, nb) {
  const jogRoom = Math.max(0, budget - (W - 1) + nb + 1);
  return Math.max(1, Math.min(H - 1, Math.floor(jogRoom / (nb + 1)) + 1));
}

// barrier columns, at least two apart, leaving room for rune pockets at both ends
function barrierCols(W, nb, rng) {
  const cols = [];
  const step = Math.max(2, Math.floor((W - 3) / nb));
  for (let i = 0; i < nb; ++i) {
    let c = 3 + i * step + ri(rng, Math.max(1, step - 1));
    if (i > 0 && c < cols[i - 1] + 2)
      c = cols[i - 1] + 2;
    if (c > W - 1)
      return null;
    cols.push(c);
  }
  return cols;
}

function neighbourIs(g, r, c, chars) {
  return chars.indexOf(g[r - 1][c]) >= 0 || chars.indexOf(g[r + 1][c]) >= 0 ||
    chars.indexOf(g[r][c - 1]) >= 0 || chars.indexOf(g[r][c + 1]) >= 0;
}

// a cell that touches the open ground at exactly one side and nothing else
function deadEnd(g, r, c) {
  let open = 0;
  for (let d = 0; d < 4; ++d) {
    const ch = g[r + DIR4[d][0]][c + DIR4[d][1]];
    if (ch === '.')
      ++open;
    else if (ch !== '#')
      return false;
  }
  return open === 1;
}

function countFloors(g) {
  let n = 0;
  for (let r = 0; r < g.length; ++r)
    for (let c = 0; c < g[r].length; ++c)
      if (g[r][c] === '.')
        ++n;
  return n;
}

/*
 * One gate per barrier: a single obstacle in the barrier column, so the only
 * route through the wall uses that barrier's element. An air gate is a boulder
 * with a chasm behind it -- one push clears both.
 */
function placeGate(g, r, x, W, kind) {
  if (kind === 'air') {
    if (x + 1 > W - 1 || g[r][x + 1] !== '.')
      return null;
    g[r][x] = 'B';
    g[r][x + 1] = '_';
    return r;
  }
  const ch = kind === 'wood' ? 'w' : kind === 'ice' ? 'i' : kind === 'water' ? '~' : '_';
  if (g[r][x] !== '.')
    return null;
  g[r][x] = ch;
  return r;
}

/*
 * The route: from the mage on the right-hand edge of the start chamber to the
 * goal, stepping through every gate in turn. It only ever moves right, so no
 * chamber can be entered before its gate is opened; the vertical steps are
 * taken one column before a gate, which keeps the barrier columns intact.
 */
function carveSpine(g, H, W, hero, goalR, cols, gateRows, path) {
  let r = hero[0], c = hero[1];
  g[r][c] = '.';
  path.push([r, c]);
  for (let i = 0; i < cols.length; ++i) {
    const x = cols[i], gr = gateRows[i];
    while (c < x - 1) {
      ++c;
      if (g[r][c] === '#') g[r][c] = '.';
      path.push([r, c]);
    }
    while (r !== gr) {
      r += r < gr ? 1 : -1;
      if (g[r][c] === '#') g[r][c] = '.';
      path.push([r, c]);
    }
    if (g[r][x] === '#') g[r][x] = '.';
    c = x;
  }
  while (c < W) {
    ++c;
    if (g[r][c] === '#') g[r][c] = '.';
    path.push([r, c]);
  }
  while (r !== goalR) {
    r += r < goalR ? 1 : -1;
    if (g[r][c] === '#') g[r][c] = '.';
    path.push([r, c]);
  }
}

// every barrier column must hold its gate and nothing else
function barriersIntact(g, cols) {
  for (let i = 0; i < cols.length; ++i) {
    let open = 0;
    for (let r = 1; r < g.length - 1; ++r)
      if (g[r][cols[i]] !== '#')
        ++open;
    if (open !== 1)
      return false;
  }
  return true;
}

// every rune must hang behind its seals: one open side, rock on the other three
function runesSealed(g) {
  for (let r = 1; r < g.length - 1; ++r)
    for (let c = 1; c < g[r].length - 1; ++c) {
      if (g[r][c] !== 'r')
        continue;
      let open = 0;
      for (let d = 0; d < 4; ++d)
        if (g[r + DIR4[d][0]][c + DIR4[d][1]] !== '#')
          ++open;
      if (open !== 1)
        return false;
    }
  return true;
}

/*
 * Rune pocket: a vertical chain hanging off the route -- `depth` seals in a
 * walled column, the rune at the far end. The mage breaks the seals one at a
 * time, so a pocket costs exactly `depth` casts.
 */
function addPocket(g, H, W, rng, realm, depth, path) {
  const seals = realm === 0 ? ['w', 'i'] :
    realm === 1 ? ['w', 'i', '~'] : ['w', 'i', '~', '_'];
  for (let tryIdx = 0; tryIdx < 80; ++tryIdx) {
    const p = pick(rng, path);
    const c = p[1];
    if (g[p[0]][c] !== '.')
      continue;
    const dir = ri(rng, 2) ? 1 : -1;
    const far = p[0] + dir * (depth + 1);
    if (far < 1 || far > H)
      continue;
    let ok = true;
    for (let s = 1; s <= depth + 1 && ok; ++s) {
      const r = p[0] + dir * s;
      if (g[r][c] !== '#' || g[r][c - 1] !== '#' || g[r][c + 1] !== '#')
        ok = false;
    }
    if (ok) {
      const beyond = p[0] + dir * (depth + 2);
      if (beyond >= 1 && beyond <= H && g[beyond][c] !== '#')
        ok = false;
    }
    if (!ok)
      continue;
    let prev = '';
    for (let s = 1; s <= depth; ++s) {
      let ch = pick(rng, seals);
      if (ch === prev && (ch === 'w' || ch === '~'))
        ch = ch === 'w' ? 'i' : '_';
      g[p[0] + dir * s][c] = ch;
      prev = ch;
    }
    g[far][c] = 'r';
    return true;
  }
  return null;
}

// decoy obstacles parked in dead-end alcoves off the route
function addDecoys(g, H, W, rng, realm, path, cols) {
  const n = ri(rng, 3);
  for (let k = 0; k < n; ++k) {
    const p = pick(rng, path);
    const d = pick(rng, DIR4);
    const r = p[0] + d[0], c = p[1] + d[1];
    if (r < 1 || r > H || c < 1 || c > W || g[r][c] !== '#' || cols.indexOf(c) >= 0)
      continue;
    if (!deadEnd(g, r, c))
      continue;
    g[r][c] = realm >= 1 && ri(rng, 2) === 0 ? '~' : 'w';
  }
}

/*
 * Dead-end alcoves: the carved ground keeps growing into the rock while the
 * open ground stays inside the budget. Every new cell touches the open ground
 * at exactly one side, so an alcove can never open a second route.
 */
function addAlcoves(g, H, W, rng, path, cols, budget) {
  const open = path.slice();
  for (let k = 0; k < 600 && countFloors(g) < budget; ++k) {
    const p = pick(rng, open);
    const d = pick(rng, DIR4);
    const r = p[0] + d[0], c = p[1] + d[1];
    if (r < 1 || r > H || c < 1 || c > W || g[r][c] !== '#' || cols.indexOf(c) >= 0)
      continue;
    if (!deadEnd(g, r, c))
      continue;
    g[r][c] = '.';
    open.push([r, c]);
  }
}

function buildCandidate(styleRealm, slot, rng, lo) {
  const dims = DIMS[styleRealm];
  const t = Math.min(slot, 7) / 7;
  const dimW = Math.round(dims[0][0] + (dims[1][0] - dims[0][0]) * t);
  const dimH = Math.round(dims[0][1] + (dims[1][1] - dims[0][1]) * t);
  const elements = REALMS[styleRealm].elements;
  /* two barriers at least: the route to the goal alone must cost two casts */
  const nb = styleRealm === 0 ? 2 : elements.length;
  /* the board is only as large as the open ground a search of this par can carry */
  const budget = floorBudget(lo);
  const W = Math.min(dimW, Math.max(2 * nb + 1, budget - 6));
  const H = Math.min(dimH, Math.max(5, Math.round(budget / 3)));
  const g = [];
  for (let r = 0; r <= H + 1; ++r) {
    const row = new Array(W + 2);
    row.fill('#');
    g.push(row);
  }
  const cols = barrierCols(W, nb, rng);
  if (!cols)
    return null;
  let kinds;
  if (styleRealm === 0) {
    kinds = [];
    for (let i = 0; i < nb; ++i)
      kinds.push(pick(rng, ['wood', 'ice']));
  } else {
    kinds = elements.slice();
    shuffle(rng, kinds);
  }
  const gateKinds = [];
  for (let i = 0; i < nb; ++i)
    gateKinds.push(kinds[i] === 'fire' ? pick(rng, ['wood', 'ice']) : kinds[i]);
  const spread = gateSpread(budget, W, H, nb);
  const base = 1 + Math.min(spread, H - 1) + ri(rng, Math.max(1, H - 2 * Math.min(spread, H - 1)));
  const bandLo = Math.max(1, base - spread), bandHi = Math.min(H, base + spread);
  const near = function() {
    return bandLo + ri(rng, bandHi - bandLo + 1);
  };
  const hero = [near(), 1];
  const goalR = near();
  const gateRows = [];
  for (let i = 0; i < nb; ++i)
    gateRows.push(near());
  const path = [];
  carveSpine(g, H, W, hero, goalR, cols, gateRows, path);
  g[goalR][W] = 'G';
  for (let i = 0; i < nb; ++i)
    if (placeGate(g, gateRows[i], cols[i], W, gateKinds[i]) === null)
      return null;
  const n = runeCount(styleRealm, slot, rng);
  const depths = new Array(n).fill(1);
  let extra = Math.max(0, Math.min(lo - nb - n, 2 * n));
  for (let k = 0; k < n && extra > 0; ++k) {
    const add = Math.min(2, extra);
    depths[k] += add;
    extra -= add;
  }
  for (let k = 0; k < n; ++k)
    if (addPocket(g, H, W, rng, styleRealm, depths[k], path) === null)
      return null;
  addDecoys(g, H, W, rng, styleRealm, path, cols);
  addAlcoves(g, H, W, rng, path, cols, floorBudget(lo));
  if (!barriersIntact(g, cols) || !runesSealed(g) || countFloors(g) > floorBudget(lo))
    return null;
  return { grid: g.map(row => row.join('')), hero: hero };
}

function precheck(level) {
  let chasm = 0, ice = 0, wood = 0, channel = 0, boulder = 0;
  for (const row of level.grid)
    for (const ch of row) {
      if (ch === '_') ++chasm;
      else if (ch === 'i') ++ice;
      else if (ch === 'w') ++wood;
      else if (ch === '~') ++channel;
      else if (ch === 'B') ++boulder;
    }
  if (chasm > 7 || ice > 6 || wood > 9 || channel > 9 || boulder > 2)
    return false;
  const opened = {
    grid: level.grid.map(row => row.replace(/[w~i_B]/g, '.')),
    hero: level.hero
  };
  try {
    const st = core.parseLevel(opened);
    if (!core.isSolved(st))
      return false;
    if (core.collectedRunes(st).length !== core.totalRunes(st))
      return false;
  } catch (e) {
    return false;
  }
  return true;
}

function evaluate(level, lo, hi, elements) {
  const t0 = Date.now();
  const plain = core.solve(level, { perfect: false, maxStates: MAX_STATES });
  if (!plain || plain.par < 2)
    return null;
  const sol = core.solve(level, { perfect: true, maxStates: MAX_STATES });
  const ms = Date.now() - t0;
  if (!sol || sol.par < lo || sol.par > hi || ms > TIME_BUDGET_MS)
    return null;
  const used = {};
  for (const a of sol.actions)
    used[a.element] = true;
  for (const e of elements)
    if (!used[e])
      return null;
  return { sol: sol, ms: ms };
}

function hintFor(level, sol) {
  const cols = level.grid[0].length;
  const a = sol.actions[0];
  const ch = level.grid[(a.index / cols) | 0][a.index % cols];
  if (a.element === 'fire')
    return ch === 'i' ? 'Fire melts ice into water.' : 'Fire spreads through connected wood.';
  if (a.element === 'water')
    return 'Water floods a channel network and opens it.';
  if (a.element === 'earth')
    return ch === '_' ? 'Earth fills a chasm to bridge the gap.' : 'Earth raises stone on open ground.';
  const word = { up: 'upwards', down: 'downwards', left: 'leftwards', right: 'rightwards' }[a.dir];
  return 'Air pushes the boulder ' + word + ', filling the chasm behind it.';
}

function genSlot(kind, realm, slot, styleRealm) {
  const elements = REALMS[styleRealm].elements;
  const range = parRange(kind, realm, slot);
  for (let pass = 0; pass < 2; ++pass) {
    const lo = pass === 0 ? range[0] : 2;
    const hi = pass === 0 ? range[1] : 9;
    for (let attempt = 0; attempt < ATTEMPTS; ++attempt) {
      const rng = mulberry32(seedFor(kind, realm, slot, attempt));
      const level = buildCandidate(styleRealm, slot, rng, lo);
      if (!level || !precheck(level))
        continue;
      const ev = evaluate(level, lo, hi, elements);
      if (!ev)
        continue;
      let runes = 0;
      for (const row of level.grid)
        for (const ch of row)
          if (ch === 'r')
            ++runes;
      level.par = ev.sol.par;
      level.mana = ev.sol.par + (kind === 'c' ? 2 : 1);
      level.runes = runes;
      level.hint = hintFor(level, ev.sol);
      level.ms = ev.ms;
      return level;
    }
  }
  throw new Error('no verified level for ' + kind + ' realm ' + realm + ' slot ' + slot);
}

function q(s) {
  return JSON.stringify(s);
}

function levelSrc(l) {
  const rows = l.grid.map(function(r) { return '          ' + q(r); }).join(',\n');
  return '    Object.freeze({\n' +
    '      id: ' + q(l.id) + ', realm: ' + l.realm + ', name: ' + q(l.name) + ',\n' +
    '      grid: Object.freeze([\n' + rows + '\n      ]),\n' +
    '      hero: Object.freeze([' + l.hero[0] + ', ' + l.hero[1] + ']),\n' +
    '      par: ' + l.par + ', mana: ' + l.mana + ', runes: ' + l.runes + ',\n' +
    '      hint: ' + q(l.hint) + '\n    })';
}

function realmSrc(rm) {
  return '    Object.freeze({ id: ' + rm.id + ', name: ' + q(rm.name) +
    ', elements: Object.freeze([' + rm.elements.map(q).join(', ') + ']), color: ' + q(rm.color) + ' })';
}

function writeData(campaign, bonus) {
  const out = ';(function() {\n' +
    "  'use strict';\n" +
    '  const SZ = window.SZ || (window.SZ = {});\n\n' +
    '  /*\n' +
    '   * Solver-verified levels: 40 campaign levels in five realms plus 60 bonus\n' +
    '   * trials. Every par was confirmed by the breadth-first solver in puzzle-core.js.\n' +
    '   * Open ground is floor; walls carry the structure and water and fire only come\n' +
    '   * from casts on channels and ice. Regenerate with tools/generate-levels.js --\n' +
    '   * the output is deterministic.\n' +
    '   */\n\n' +
    '  const REALMS = Object.freeze([\n' + REALMS.map(realmSrc).join(',\n') + '\n  ]);\n\n' +
    '  const CAMPAIGN = Object.freeze([\n' + campaign.map(levelSrc).join(',\n') + '\n  ]);\n\n' +
    '  const BONUS = Object.freeze([\n' + bonus.map(levelSrc).join(',\n') + '\n  ]);\n\n' +
    '  SZ.PuzzleLevels = Object.freeze({ REALMS, CAMPAIGN, BONUS });\n' +
    '})();\n';
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'levels-data.js'), out);
}

function summarize(title, levels) {
  const pars = levels.map(l => l.par);
  const mean = pars.reduce((a, b) => a + b, 0) / pars.length;
  const floors = levels.map(function(l) {
    let n = 0;
    for (const row of l.grid)
      for (const ch of row)
        if (ch === '.')
          ++n;
    return n;
  });
  const slow = Math.max.apply(null, levels.map(l => l.ms));
  console.log(title + ': ' + levels.length + ' levels, par ' + Math.min.apply(null, pars) +
    '-' + Math.max.apply(null, pars) + ', mean ' + mean.toFixed(2) +
    ', floor ' + Math.min.apply(null, floors) + '-' + Math.max.apply(null, floors) +
    ', slowest solve ' + slow + ' ms');
}

function main() {
  const t0 = Date.now();
  const campaign = [];
  for (let realm = 0; realm < 5; ++realm) {
    for (let slot = 0; slot < 8; ++slot) {
      const level = genSlot('c', realm, slot, realm);
      level.id = (realm + 1) + '-' + (slot + 1);
      level.realm = realm;
      level.name = NAMES[realm][slot];
      campaign.push(level);
    }
  }
  const bonus = [];
  for (let slot = 0; slot < 60; ++slot) {
    const style = slot % 5;
    const level = genSlot('b', -1, slot, style);
    level.id = 'T' + (slot + 1);
    level.realm = -1;
    level.name = 'Trial ' + (slot + 1);
    bonus.push(level);
  }
  writeData(campaign, bonus);
  for (let realm = 0; realm < 5; ++realm)
    summarize('Realm ' + realm + ' ' + REALMS[realm].name, campaign.slice(realm * 8, realm * 8 + 8));
  summarize('Bonus trials', bonus);
  console.log('Wrote levels-data.js: ' + (campaign.length + bonus.length) +
    ' levels in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}

main();
