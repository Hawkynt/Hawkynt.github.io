'use strict';

global.window = {};
require('../puzzle-core.js');

const core = window.SZ.PuzzleCore;
const T = core.T;

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

function throwsAs(name, fn, pattern) {
  try {
    fn();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    check(name, e instanceof Error && pattern.test(msg), 'wrong error: ' + msg);
    return;
  }
  check(name, false, 'no error thrown');
}

function tileAt(state, r, c) {
  return state.tiles[r * state.cols + c];
}

function show(state) {
  const out = [];
  for (let r = 0; r < state.rows; ++r) {
    let line = '';
    for (let c = 0; c < state.cols; ++c) {
      const t = tileAt(state, r, c);
      line += t === T.FLOOR ? '.' : t === T.WALL ? '#' : t === T.WOOD ? 'w' : t === T.CHANNEL ? '~'
        : t === T.WATER ? 'o' : t === T.BOULDER ? 'B' : t === T.STONE ? 'S' : t === T.CHASM ? '_'
        : t === T.ICE ? 'i' : t === T.GOAL ? 'G' : 'r';
    }
    out.push(line);
  }
  return out.join(' / ');
}

function replay(state, actions) {
  for (const a of actions) {
    const next = core.applyAction(state, a);
    if (!next)
      return null;
    state = next;
  }
  return state;
}

/* ── exports ─────────────────────────────────────────────────────────── */

const names = ['T', 'CHARS', 'DIRS', 'ELEMENTS', 'parseLevel', 'cloneState', 'stateKey', 'reachSet',
  'castableTiles', 'validActions', 'applyAction', 'isSolved', 'isPerfect', 'totalRunes',
  'collectedRunes', 'solve', 'hint'];
const missing = names.filter(n => core[n] === undefined);
const badFn = names.filter(n => typeof core[n] !== 'function' && ['T', 'CHARS', 'DIRS', 'ELEMENTS'].indexOf(n) < 0);
check('exports', missing.length === 0 && badFn.length === 0,
  'missing ' + JSON.stringify(missing) + ' not-functions ' + JSON.stringify(badFn));
check('tile codes', T.FLOOR === 0 && T.WALL === 1 && T.WOOD === 2 && T.CHANNEL === 3 && T.WATER === 4 &&
  T.BOULDER === 5 && T.STONE === 6 && T.CHASM === 7 && T.ICE === 8 && T.GOAL === 9 && T.RUNE === 10,
  JSON.stringify(T));
check('elements and dirs', core.ELEMENTS.length === 4 && core.ELEMENTS[0] === 'fire' &&
  core.ELEMENTS[3] === 'air' && core.DIRS.up[0] === -1 && core.DIRS.right[1] === 1 &&
  core.DIRS.left[1] === -1 && core.DIRS.down[0] === 1, JSON.stringify(core.ELEMENTS) + ' ' + JSON.stringify(core.DIRS));

/* ── parseLevel validation ───────────────────────────────────────────── */

throwsAs('parse: no goal', () => core.parseLevel({ grid: ['...', '...'], hero: [0, 0] }), /goal/i);
throwsAs('parse: two goals', () => core.parseLevel({ grid: ['G.G'], hero: [0, 0] }), /goal/i);
throwsAs('parse: hero on wall', () => core.parseLevel({ grid: ['#G', '..'], hero: [0, 0] }), /walkable/i);
throwsAs('parse: ragged rows', () => core.parseLevel({ grid: ['..G', '.'], hero: [0, 0] }), /expected 3|row 1/i);
throwsAs('parse: hero out of bounds', () => core.parseLevel({ grid: ['.G'], hero: [3, 0] }), /outside/i);
throwsAs('parse: unknown tile', () => core.parseLevel({ grid: ['.XG'], hero: [0, 0] }), /unknown/i);
throwsAs('parse: no hero', () => core.parseLevel({ grid: ['.G'] }), /hero/i);

const basic = core.parseLevel({ grid: ['.rG'], hero: [0, 0] });
check('parse: rune in reach at start is collected',
  core.totalRunes(basic) === 1 && core.collectedRunes(basic).length === 1 && core.isPerfect(basic),
  show(basic) + ' collected ' + JSON.stringify(core.collectedRunes(basic)));
check('parse: already solved level has par 0',
  JSON.stringify(core.solve({ grid: ['.rG'], hero: [0, 0] })) === '{"par":0,"actions":[]}',
  JSON.stringify(core.solve({ grid: ['.rG'], hero: [0, 0] })));

/* ── reach and castability ───────────────────────────────────────────── */

const reachLevel = core.parseLevel({ grid: ['..#G', '..#.', '..#.'], hero: [0, 0] });
const reach = core.reachSet(reachLevel);
check('reach: stops at a wall column', reach.size === 6 && !reach.has(3) && reach.has(1),
  'reach ' + JSON.stringify(Array.from(reach).sort((a, b) => a - b)));

const behindWall = core.parseLevel({ grid: ['.#wG'], hero: [0, 0] });
const castable = core.castableTiles(behindWall);
check('castable: wood behind a wall is out of reach',
  castable.length === 2 && castable[0] === 0 && castable[1] === 1 &&
  core.validActions(behindWall).length === 0 &&
  core.applyAction(behindWall, { element: 'fire', index: 2 }) === null,
  'castable ' + JSON.stringify(castable) + ' actions ' + JSON.stringify(core.validActions(behindWall)));

/* ── fire ────────────────────────────────────────────────────────────── */

const fireLevel = core.parseLevel({ grid: ['.wwG', '.w.w', '....'], hero: [2, 0] });
const burned = core.applyAction(fireLevel, { element: 'fire', index: 1 });
check('fire: burns the whole 4-connected wood cluster',
  burned !== null && tileAt(burned, 0, 1) === T.FLOOR && tileAt(burned, 0, 2) === T.FLOOR &&
  tileAt(burned, 1, 1) === T.FLOOR, show(burned || fireLevel));
check('fire: does not spread diagonally',
  burned !== null && tileAt(burned, 1, 3) === T.WOOD, show(burned || fireLevel));
check('fire: opens the way to the goal', burned !== null && core.isSolved(burned), show(burned || fireLevel));
check('fire: leaves the source state untouched',
  tileAt(fireLevel, 0, 1) === T.WOOD && tileAt(fireLevel, 0, 2) === T.WOOD, show(fireLevel));
check('fire: on floor is invalid',
  core.applyAction(fireLevel, { element: 'fire', index: 8 }) === null, 'cast on FLOOR accepted');

const iceLevel = core.parseLevel({ grid: ['.iG'], hero: [0, 0] });
const melted = core.applyAction(iceLevel, { element: 'fire', index: 1 });
check('fire: melts ice into water',
  melted !== null && tileAt(melted, 0, 1) === T.WATER && core.isSolved(melted), show(melted || iceLevel));

/* ── water ───────────────────────────────────────────────────────────── */

const waterLevel = core.parseLevel({ grid: ['..~.~G', '..~.~#', '......'], hero: [2, 0] });
const flooded = core.applyAction(waterLevel, { element: 'water', index: 2 });
check('water: floods the connected channel network',
  flooded !== null && tileAt(flooded, 0, 2) === T.WATER && tileAt(flooded, 1, 2) === T.WATER,
  show(flooded || waterLevel));
check('water: channels separated by floor stay dry',
  flooded !== null && tileAt(flooded, 0, 4) === T.CHANNEL && tileAt(flooded, 1, 4) === T.CHANNEL &&
  !core.isSolved(flooded), show(flooded || waterLevel));
const flooded2 = flooded && core.applyAction(flooded, { element: 'water', index: 4 });
check('water: a second network opens the goal',
  flooded2 !== null && tileAt(flooded2, 0, 4) === T.WATER && core.isSolved(flooded2), show(flooded2 || waterLevel));
check('water: on floor is invalid',
  core.applyAction(waterLevel, { element: 'water', index: 9 }) === null, 'cast on FLOOR accepted');

/* ── earth ───────────────────────────────────────────────────────────── */

const earthLevel = core.parseLevel({ grid: ['.._G'], hero: [0, 0] });
const filled = core.applyAction(earthLevel, { element: 'earth', index: 2 });
check('earth: fills a chasm',
  filled !== null && tileAt(filled, 0, 2) === T.FLOOR && core.isSolved(filled), show(filled || earthLevel));
const stoned = core.applyAction(earthLevel, { element: 'earth', index: 1 });
check('earth: raises stone on floor',
  stoned !== null && tileAt(stoned, 0, 1) === T.STONE && !core.isSolved(stoned), show(stoned || earthLevel));
check('earth: on the hero tile is invalid',
  core.applyAction(earthLevel, { element: 'earth', index: 0 }) === null, 'cast under the hero accepted');
check('earth: on a rune is invalid',
  core.applyAction(core.parseLevel({ grid: ['..rG'], hero: [0, 0] }), { element: 'earth', index: 2 }) === null,
  'cast on RUNE accepted');

/* ── air ─────────────────────────────────────────────────────────────── */

const slideLevel = core.parseLevel({ grid: ['.B.#G'], hero: [0, 0] });
const slid = core.applyAction(slideLevel, { element: 'air', index: 1, dir: 'right' });
check('air: boulder slides until blocked',
  slid !== null && tileAt(slid, 0, 1) === T.FLOOR && tileAt(slid, 0, 2) === T.BOULDER &&
  tileAt(slid, 0, 3) === T.WALL, show(slid || slideLevel));
check('air: validActions offers the push',
  core.validActions(slideLevel).some(a => a.element === 'air' && a.index === 1 && a.dir === 'right'),
  JSON.stringify(core.validActions(slideLevel)));
check('air: unknown direction is invalid',
  core.applyAction(slideLevel, { element: 'air', index: 1, dir: 'sideways' }) === null, 'accepted');

const fallLevel = core.parseLevel({ grid: ['.B_G'], hero: [0, 0] });
const fell = core.applyAction(fallLevel, { element: 'air', index: 1, dir: 'right' });
check('air: boulder falls into a chasm and fills it',
  fell !== null && tileAt(fell, 0, 1) === T.FLOOR && tileAt(fell, 0, 2) === T.FLOOR &&
  Array.from(fell.tiles).indexOf(T.BOULDER) < 0, show(fell || fallLevel));

const blockedLevel = core.parseLevel({ grid: ['#B.', '..G'], hero: [1, 0] });
check('air: push without a reachable stand tile is invalid',
  core.applyAction(blockedLevel, { element: 'air', index: 1, dir: 'right' }) === null, 'accepted');
check('air: zero-distance push is invalid',
  core.applyAction(blockedLevel, { element: 'air', index: 1, dir: 'left' }) === null &&
  core.applyAction(blockedLevel, { element: 'air', index: 1, dir: 'up' }) === null &&
  core.applyAction(blockedLevel, { element: 'air', index: 1, dir: 'down' }) === null, 'accepted');
check('air: no push is offered when none is possible',
  core.validActions(blockedLevel).every(a => a.element !== 'air'),
  JSON.stringify(core.validActions(blockedLevel)));

/* ── runes ───────────────────────────────────────────────────────────── */

const runeLevel = core.parseLevel({ grid: ['.wG', '.##', '.w#', '#r#'], hero: [0, 0] });
const runeStep1 = core.applyAction(runeLevel, { element: 'fire', index: 1 });
check('runes: not collected while walled off',
  runeStep1 !== null && core.totalRunes(runeStep1) === 1 && core.collectedRunes(runeStep1).length === 0 &&
  core.isSolved(runeStep1) && !core.isPerfect(runeStep1), show(runeStep1 || runeLevel));
const runeStep2 = runeStep1 && core.applyAction(runeStep1, { element: 'fire', index: 7 });
check('runes: collected once reachable, tile stays a rune',
  runeStep2 !== null && tileAt(runeStep2, 3, 1) === T.RUNE &&
  core.collectedRunes(runeStep2).length === 1 && core.isPerfect(runeStep2), show(runeStep2 || runeLevel));

/* ── stateKey ────────────────────────────────────────────────────────── */

const keyA = core.parseLevel({ grid: ['..G'], hero: [0, 0] });
const keyB = core.parseLevel({ grid: ['..G'], hero: [0, 1] });
check('stateKey: hero position inside the same reach region is irrelevant',
  core.stateKey(keyA) === core.stateKey(keyB), core.stateKey(keyA) + ' vs ' + core.stateKey(keyB));
const keyC = core.applyAction(keyA, { element: 'earth', index: 1 });
check('stateKey: different tiles give different keys',
  keyC !== null && core.stateKey(keyC) !== core.stateKey(keyA), 'keys equal');
const cloned = core.cloneState(keyA);
cloned.tiles[1] = T.STONE;
check('cloneState: tiles and runes are copied, not shared',
  keyA.tiles[1] === T.FLOOR && core.stateKey(cloned) !== core.stateKey(keyA), show(keyA));

/* ── solver ──────────────────────────────────────────────────────────── */

const twoCast = { grid: ['.w~G'], hero: [0, 0] };
const twoSol = core.solve(twoCast);
check('solve: fire then water gives par 2',
  twoSol !== null && twoSol.par === 2 && twoSol.actions.length === 2 &&
  twoSol.actions[0].element === 'fire' && twoSol.actions[1].element === 'water',
  JSON.stringify(twoSol));
const twoReplay = twoSol && replay(core.parseLevel(twoCast), twoSol.actions);
check('solve: the actions replay to a solved state',
  twoReplay !== null && core.isSolved(twoReplay), show(twoReplay || core.parseLevel(twoCast)));

const sealed = { grid: ['..#..', '.#G#.', '..#..'], hero: [0, 0] };
check('solve: a sealed goal has no solution', core.solve(sealed) === null, JSON.stringify(core.solve(sealed)));

const runePuzzle = { grid: ['.wG', '.##', '.w#', '#r#'], hero: [0, 0] };
const plain = core.solve(runePuzzle, { perfect: false });
const perfect = core.solve(runePuzzle, { perfect: true });
check('solve: perfect needs one extra cast for the rune',
  plain !== null && perfect !== null && plain.par === 1 && perfect.par === plain.par + 1,
  'plain ' + JSON.stringify(plain) + ' perfect ' + JSON.stringify(perfect));
const perfectReplay = perfect && replay(core.parseLevel(runePuzzle), perfect.actions);
check('solve: perfect actions replay to a perfect state',
  perfectReplay !== null && core.isSolved(perfectReplay) && core.isPerfect(perfectReplay),
  show(perfectReplay || core.parseLevel(runePuzzle)));

const hintFromLevel = core.hint(runePuzzle);
check('hint: first action of an optimal solution',
  hintFromLevel !== null && hintFromLevel.element === 'fire' && hintFromLevel.index === 1,
  JSON.stringify(hintFromLevel));
const hintFromState = core.hint(runeStep1);
check('hint: works from a state and points at the rune wood',
  hintFromState !== null && hintFromState.element === 'fire' && hintFromState.index === 7,
  JSON.stringify(hintFromState));
check('hint: null on an unsolvable level', core.hint(sealed) === null, JSON.stringify(core.hint(sealed)));

check('solve: maxStates bounds the search',
  core.solve(twoCast, { maxStates: 1 }) === null && core.solve(twoCast, { maxStates: 50 }) !== null,
  JSON.stringify(core.solve(twoCast, { maxStates: 1 })));

/* ── performance ─────────────────────────────────────────────────────── */

const bigLevel = {
  grid: [
    '########',
    '.iw~_B_G',
    '.w~w#~w#',
    '########',
    '########',
    '########',
    '########',
    '########',
    '########',
    '########'
  ],
  hero: [1, 0]
};
const bigState = core.parseLevel(bigLevel);
check('perf: level is 10 x 8', bigState.rows === 10 && bigState.cols === 8 &&
  bigState.tiles.length === 80, bigState.rows + ' x ' + bigState.cols);
const t0 = Date.now();
const bigSol = core.solve(bigLevel);
const elapsed = Date.now() - t0;
const bigReplay = bigSol && replay(core.parseLevel(bigLevel), bigSol.actions);
check('perf: 10 x 8 par 5 solved in under 2 s',
  bigSol !== null && bigSol.par === 5 && elapsed < 2000 &&
  bigReplay !== null && core.isSolved(bigReplay) && core.isPerfect(bigReplay),
  'par ' + (bigSol && bigSol.par) + ' in ' + elapsed + ' ms: ' + JSON.stringify(bigSol));
console.log('INFO perf: par ' + (bigSol && bigSol.par) + ' in ' + elapsed + ' ms');

process.exit(failures ? 1 : 0);
