'use strict';

/*
 * Validates every chunk and level, then proves completability: the
 * reachability bot (tests/solver.js, driving the game's own physics) must
 * reach every campaign goal with the base move set - no tree upgrades - and
 * every gem with at most the full move set. Every item block must be
 * bumpable from below and climbable with the base move set, and the power-up
 * from a power block must be collectable. Procedural Endless stages and
 * Daily runs are sampled the same way. Set QUICK=1 to skip the bot.
 */

global.window = {};
require('../physics.js');
require('../levels-data.js');
require('../entities.js');
const solver = require('./solver.js');

const Ph = window.SZ.PlatformerPhysics;
const L = window.SZ.PlatformerLevels;
const E = window.SZ.PlatformerEntities;
const T = Ph.T, TS = Ph.TS;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!L && Object.isFrozen(L), 'SZ.PlatformerLevels missing or not frozen');
check('five worlds', L.WORLDS.length === 5, L.WORLDS.length + ' worlds');

/* chunks: rectangular, known characters, standard seams */
const KNOWN = '.#=^T~IF?!BKSGCo*eakxMmVvXW';
for (const ch of L.CHUNKS) {
  const rows = L.padRows(ch.rows);
  const w = rows[0].length;
  const rect = rows.length === L.ROWS && rows.every(r => r.length === w);
  check('chunk ' + ch.id + ' is ' + L.ROWS + ' rows of equal width', rect, rows.map(r => r.length).join(','));
  if (!rect)
    continue;
  const bad = rows.join('').split('').filter(c => KNOWN.indexOf(c) < 0);
  check('chunk ' + ch.id + ' uses known characters', bad.length === 0, bad.join(''));
  /* seams: the outer two columns stand on the floor row with headroom */
  let seam = true;
  const TILES = '#=^T~IF?!BK';
  for (const c of [0, 1, w - 2, w - 1]) {
    if ('#I'.indexOf(rows[L.GROUND_ROW].charAt(c)) < 0 || TILES.indexOf(rows[L.GROUND_ROW - 1].charAt(c)) >= 0 || TILES.indexOf(rows[L.GROUND_ROW - 2].charAt(c)) >= 0)
      seam = false;
  }
  check('chunk ' + ch.id + ' has standard seams', seam, 'outer columns must be floor at row ' + L.GROUND_ROW + ' with two free rows above');
}

function validate(level, label, needGems) {
  check(label + ' has a start', !!level.start, 'no start');
  check(label + ' has a goal', !!level.goal, 'no goal');
  if (!level.start || !level.goal)
    return false;
  check(label + ' size', level.cols >= 60 && level.cols <= 400 && level.rows === L.ROWS, level.cols + 'x' + level.rows);
  const inside = (p) => p.c >= 0 && p.c < level.cols && p.r >= 0 && p.r < level.rows;
  const free = (p) => {
    const code = Ph.tileAt(level, p.c, p.r);
    return code === T.EMPTY || code === T.FAKE;
  };
  const points = [level.start, level.goal].concat(level.coins, level.gems, level.enemies, level.checkpoints);
  check(label + ' everything in bounds', points.every(inside), 'out-of-bounds entity');
  const stuck = points.filter(p => !free(p));
  check(label + ' no entity inside solid tiles', stuck.length === 0, stuck.map(p => (p.type || 'item') + '@' + p.c + ',' + p.r).join(' '));
  check(label + ' start and goal stand on floor', Ph.solidAt(level, level.start.c, level.start.r + 1) && Ph.solidAt(level, level.goal.c, level.goal.r + 1), 'floating start/goal');
  check(label + ' checkpoints stand on floor', level.checkpoints.every(cp => Ph.solidAt(level, cp.c, cp.r + 1)), JSON.stringify(level.checkpoints));
  if (needGems)
    check(label + ' has three gems', level.gems.length === 3, level.gems.length + ' gems');
  check(label + ' has a time target', level.timeTarget > 0, String(level.timeTarget));
  if (level.boss) {
    check(label + ' boss arena', !!level.arena && !!level.bossSpawn, 'no arena or boss spawn');
  }
  return true;
}

const levels = [];
for (let w = 0; w < 5; ++w) {
  check('world ' + w + ' has six levels', L.CAMPAIGN[w].length === 6, L.CAMPAIGN[w].length);
  for (let i = 0; i < 6; ++i) {
    const spec = L.CAMPAIGN[w][i];
    const level = L.build(spec);
    const label = spec.id + ' ' + spec.name;
    check(label + ' boss on the sixth', (i === 5) === !!level.boss, 'boss ' + level.boss);
    if (validate(level, label, true))
      levels.push({ label: label, level: level });
  }
}
/* deterministic campaign */
const again = L.build(L.CAMPAIGN[2][3]);
check('campaign is deterministic', again.tiles.join('') === levels[15].level.tiles.join(''), 'rebuild differs');

/* procedural runs */
const procedural = [];
for (let s = 0; s < 6; ++s) {
  const spec = L.endlessSpec(12345, s);
  const level = L.build(spec);
  if (validate(level, 'endless stage ' + (s + 1), false))
    procedural.push({ label: 'endless stage ' + (s + 1), level: level });
}
for (const date of ['2026-01-01', '2026-06-15', '2026-10-17']) {
  const level = L.build(L.dailySpec(date));
  if (validate(level, 'daily ' + date, false))
    procedural.push({ label: 'daily ' + date, level: level });
}

if (!process.env.QUICK) {
  const t0 = Date.now();
  let base = 0, full = 0;
  for (const it of levels) {
    const lv = it.level;
    const r = solver.reach(lv, solver.goalBox(lv), solver.BASE, {});
    check(it.label + ' goal reachable with the base move set', r.ok, 'bot got stuck at column ' + Math.floor(r.maxX / TS));
    if (r.ok)
      check(it.label + ' time target is fair', lv.timeTarget >= r.time * 1.3, 'bot ' + r.time.toFixed(1) + ' s, target ' + lv.timeTarget + ' s');
    for (let g = 0; g < lv.gems.length; ++g) {
      const box = solver.gemBox(lv.gems[g]);
      /* crates can be stood on or smashed: try both */
      const b = solver.reach(lv, box, solver.BASE, { openCrates: true, maxNodes: 150000 }).ok || solver.reach(lv, box, solver.BASE, { maxNodes: 150000 }).ok;
      let f = b;
      if (!b)
        f = solver.reach(lv, box, solver.FULL, { openCrates: true }).ok || solver.reach(lv, box, solver.FULL, {}).ok;
      if (b) ++base; else if (f) ++full;
      check(it.label + ' gem ' + (g + 1) + ' reachable', f, 'gem at ' + lv.gems[g].c + ',' + lv.gems[g].r + ' unreachable even with every upgrade');
    }
  }
  console.log('INFO gems reachable with base moves: ' + base + ', needing upgrades: ' + full);
  for (const it of procedural) {
    const r = solver.reach(it.level, solver.goalBox(it.level), solver.BASE, {});
    check(it.label + ' goal reachable with the base move set', r.ok, 'stuck at column ' + Math.floor(r.maxX / TS));
  }
  /* item blocks: bump from below, stand on top, grab the power-up */
  let blocks = 0;
  for (const it of levels.concat(procedural)) {
    const lv = it.level;
    for (let r = 0; r < lv.rows; ++r) {
      for (let c = 0; c < lv.cols; ++c) {
        if (Ph.tileAt(lv, c, r) !== T.QBLOCK)
          continue;
        ++blocks;
        const at = ' item block ' + c + ',' + r;
        const opts = { maxNodes: 150000 };
        check(it.label + at + ' bumped from below with the base move set', solver.reach(lv, solver.bumpBox(c, r), solver.BASE, opts).ok, 'the base jump cannot hit its underside');
        const stand = solver.standBox(c, r);
        check(it.label + at + ' can be stood on with the base move set', solver.reach(lv, stand, solver.BASE, opts).ok, 'the base jump cannot land on it');
        if (lv.powerBlocks[r * lv.cols + c]) {
          const item = E.createBlockItem('fire', c, r);
          E.updateBlockItem(item, 1);
          const grab = Object.assign({}, stand, { test: (p, ev) => stand.test(p, ev) && E.itemTouches(item, p) });
          check(it.label + at + ' power-up collectable', solver.reach(lv, grab, solver.BASE, opts).ok, 'the released item is out of reach');
        }
      }
    }
  }
  check('levels have item blocks to test', blocks > 20, blocks + ' blocks');
  console.log('INFO bot time ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
