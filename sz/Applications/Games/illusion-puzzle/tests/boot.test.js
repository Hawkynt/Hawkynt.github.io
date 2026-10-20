/* Boots the game in a deterministic sandbox, drives a scripted session and compares
   the digest of every observable effect against the recorded baseline. The baseline
   was captured from the pre-refactor controller; a refactor must reproduce it. */
'use strict';

const fs = require('fs');
const path = require('path');
const { createGame } = require('./harness.js');

const BASELINE = path.join(__dirname, 'baseline.json');
let failures = 0;

function check(name, ok, details) {
  if (ok) console.log('PASS ' + name);
  else { ++failures; console.log('FAIL ' + name + (details ? ': ' + details : '')); }
}

/* The session driver's map knowledge: the same 16 levels the game carries, so a
   breadth-first solver can plan a real solution per level (moves, perspective
   rotations and illusion warps) and drive the game through every transition. */
const MAPS = [
  { grid: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,4]], start: {row:0,col:0}, links: [] },
  { grid: [[1,1,1,0,0],[1,2,2,2,0],[0,2,1,2,0],[0,2,2,2,0],[0,0,0,0,4]], start: {row:0,col:0}, links: [{from:{row:1,col:3},to:{row:4,col:4},p:1}] },
  { grid: [[1,1,3,0,0],[1,1,1,0,0],[3,1,1,1,0],[0,0,1,1,1],[0,0,0,1,4]], start: {row:0,col:0}, links: [{from:{row:0,col:2},to:{row:2,col:0},p:0}] },
  { grid: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,4]], start: {row:0,col:0}, links: [] },
  { grid: [[1,1,0,0,0],[1,2,2,0,0],[0,2,3,2,0],[0,0,2,2,1],[0,0,0,1,4]], start: {row:0,col:0}, links: [{from:{row:2,col:2},to:{row:3,col:4},p:1}] },
  { grid: [[1,1,1,1,1],[1,0,0,0,1],[1,0,3,0,1],[1,0,0,0,1],[1,1,1,1,4]], start: {row:0,col:0}, links: [{from:{row:2,col:2},to:{row:4,col:4},p:2}] },
  { grid: [[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,4]], start: {row:0,col:0}, links: [{from:{row:0,col:2},to:{row:2,col:0},p:1},{from:{row:2,col:4},to:{row:4,col:2},p:1}] },
  { grid: [[2,2,1,1,0],[2,3,1,0,0],[1,1,1,1,0],[0,0,1,3,2],[0,0,1,2,4]], start: {row:0,col:0}, links: [{from:{row:1,col:1},to:{row:3,col:3},p:0}] },
  { grid: [[1,1,1,1,1],[1,3,0,3,1],[1,0,2,0,1],[1,3,0,3,1],[1,1,1,1,4]], start: {row:0,col:2}, links: [{from:{row:1,col:1},to:{row:3,col:3},p:1},{from:{row:1,col:3},to:{row:3,col:1},p:2}] },
  { grid: [[1,1,1,0,0],[1,2,1,0,0],[1,1,1,1,1],[0,0,1,2,1],[0,0,1,1,4]], start: {row:0,col:0}, links: [] },
  { grid: [[1,1,0,1,1],[1,0,0,0,1],[0,0,3,0,0],[1,0,0,0,1],[1,1,0,1,4]], start: {row:0,col:0}, links: [{from:{row:2,col:2},to:{row:0,col:4},p:1},{from:{row:2,col:2},to:{row:4,col:0},p:2}] },
  { grid: [[2,1,1,1,0],[0,0,0,1,0],[0,0,2,1,0],[0,0,0,1,0],[0,0,0,1,4]], start: {row:0,col:0}, links: [{from:{row:0,col:0},to:{row:2,col:2},p:1}] },
  { grid: [[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,4]], start: {row:0,col:0}, links: [{from:{row:1,col:1},to:{row:3,col:3},p:0},{from:{row:1,col:3},to:{row:3,col:1},p:1}] },
  { grid: [[1,0,0,0,1],[0,1,0,1,0],[0,0,3,0,0],[0,1,0,1,0],[1,0,0,0,4]], start: {row:0,col:0}, links: [{from:{row:2,col:2},to:{row:4,col:4},p:2}] },
  { grid: [[2,2,1,2,2],[2,1,1,1,2],[1,1,3,1,1],[2,1,1,1,2],[2,2,1,2,4]], start: {row:0,col:2}, links: [{from:{row:2,col:2},to:{row:4,col:2},p:1}] },
  { grid: [[1,1,1,1,1],[1,3,2,3,1],[1,2,3,2,1],[1,3,2,3,1],[1,1,1,1,4]], start: {row:0,col:0}, links: [{from:{row:1,col:1},to:{row:3,col:3},p:0},{from:{row:1,col:3},to:{row:3,col:1},p:1},{from:{row:2,col:2},to:{row:4,col:4},p:2}] }
];

const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

function linkFrom(map, row, col) {
  for (const link of map.links)
    if (link.from.row === row && link.from.col === col)
      return link;
  return null;
}

function walkable(map, row, col, persp) {
  if (row < 0 || row >= map.grid.length || col < 0 || col >= map.grid[0].length)
    return false;
  const cell = map.grid[row][col];
  if (cell === 0) return false;
  if (cell === 3) {
    const link = linkFrom(map, row, col);
    return link ? link.p === persp : true;
  }
  return true;
}

/* shortest action plan ('U','D','L','R','E') from the level start to its goal,
   mirroring the game's rules: standing on an active illusion link warps on any
   move, stair cells open only at the linked perspective */
function solve(map) {
  const start = [map.start.row, map.start.col, 0];
  const seen = new Set([start.join(',')]);
  let frontier = [{ pos: start, plan: [] }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      const [r, c, p] = node.pos;
      if (map.grid[r][c] === 4)
        return node.plan;
      for (const name of ['U', 'D', 'L', 'R']) {
        const link = linkFrom(map, r, c);
        let nr, nc;
        if (link && link.p === p) {
          nr = link.to.row; nc = link.to.col;
        } else {
          nr = r + DIRS[name][0]; nc = c + DIRS[name][1];
          if (!walkable(map, nr, nc, p))
            continue;
        }
        const key = nr + ',' + nc + ',' + p;
        if (!seen.has(key)) { seen.add(key); next.push({ pos: [nr, nc, p], plan: node.plan.concat(name) }); }
      }
      const rp = (p + 1) % 4;
      const rkey = r + ',' + c + ',' + rp;
      if (!seen.has(rkey)) { seen.add(rkey); next.push({ pos: [r, c, rp], plan: node.plan.concat('E') }); }
    }
    frontier = next;
  }
  return null;
}

async function main() {
  const game = createGame(path.join(__dirname, '..'), {
    seed: 42,
    /* a saved run resumes at level 4 and the high-score table starts filled */
    storage: {
      'sz-illusion-puzzle-progress': JSON.stringify({ levels: { 0: { moves: 5, gems: 1 } }, currentLevel: 3 }),
      'sz-illusion-puzzle-highscores': JSON.stringify([{ level: 3, moves: 12 }, { level: 1, moves: 7 }])
    },
    /* the high-scores dialog answers with Reset, exercising the reset branch */
    dialogResults: { highScoresBackdrop: 'reset' }
  });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));
  await game.settle();

  /* the ready screen draws its title island for a while, then a tap starts the game */
  game.frames(30);
  game.pointer('pointerdown', 350, 250);
  game.frames(10);

  /* a blocked move into the void, a rotation in both directions, pause and resume */
  game.key('ArrowUp'); game.frames(12);
  game.key('KeyE'); game.frames(25);
  game.key('KeyQ'); game.frames(25);
  game.key('Escape'); game.frames(10);
  game.key('Escape'); game.frames(10);

  /* solve the levels in order: moves, gems, warps, stair openings and level
     transitions. Level 7 is a checkerboard no cardinal walk can cross, so the
     run stops there and the blocked level is merely attempted */
  let solved = 0;
  for (const map of MAPS) {
    const plan = solve(map);
    if (!plan) break;
    for (const a of plan) {
      if (a === 'E') { game.key('KeyE'); game.frames(25); }
      else { game.key({ U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[a]); game.frames(12); }
    }
    ++solved;
    game.frames(5);
    game.key('Enter'); /* any key advances the level-complete screen */
    game.frames(5);
  }
  check('walkable levels solved', solved === 6, 'solved ' + solved);

  /* the unwalkable level: every direction is blocked, both rotations turn */
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) { game.key(k); game.frames(12); }
  game.key('KeyE'); game.frames(25);
  game.key('KeyQ'); game.frames(25);
  game.frames(20);

  /* F2 restarts the whole progress from level 1 */
  game.key('F2');
  game.frames(10);

  /* solve the first level again, this time advancing with a pointer tap;
     a tap while playing is a no-op, F2 restarts mid-run */
  const plan0 = solve(MAPS[0]);
  for (const a of plan0) {
    if (a === 'E') { game.key('KeyE'); game.frames(25); }
    else { game.key({ U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[a]); game.frames(12); }
  }
  game.pointer('pointerdown', 350, 250);
  game.frames(10);
  game.pointer('pointerdown', 350, 250); /* while playing: ignored */
  game.frames(10);
  game.key('ArrowDown'); game.frames(12);
  game.key('F2'); game.frames(10);

  /* menu actions: pause, high scores (reset), controls, about, new game, exit */
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('high-scores');
  await game.settle();
  game.SZ.MenuBar.onAction('controls');
  await game.settle();
  game.SZ.MenuBar.onAction('about');
  await game.settle();
  game.SZ.MenuBar.onAction('new'); game.frames(10);
  game.SZ.MenuBar.onAction('exit');
  await game.settle();

  /* OS integration: window resize, WM_SIZE and WM_THEMECHANGED re-fit the canvas */
  game.dispatch('resize', { type: 'resize' });
  game.SZ.Dlls.User32.windowProc('WM_SIZE');
  game.SZ.Dlls.User32.windowProc('WM_THEMECHANGED');
  game.frames(20);

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  if (!fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, JSON.stringify({ digest: d, entries: game.log.length }, null, 2) + '\n');
    console.log('BASELINE RECORDED ' + d);
    process.exit(0);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  check('digest matches baseline', d === base.digest, 'got ' + d + ' want ' + base.digest);

  process.exit(failures ? 1 : 0);
}

main();
