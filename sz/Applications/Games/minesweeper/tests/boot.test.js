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

/* mirror of the harness LCG so the test can predict mine placement for the
   first games (the controller's placeMines is the only rng consumer before
   the first death animation) */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function simulateMines(rand, rows, cols, mineCount, safeR, safeC) {
  const mines = new Set();
  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(rand() * rows);
    const c = Math.floor(rand() * cols);
    if (mines.has(r + ',' + c))
      continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)
      continue;
    mines.add(r + ',' + c);
    ++placed;
  }
  return mines;
}
function adjacentOf(mines, r, c) {
  let n = 0;
  for (let dr = -1; dr <= 1; ++dr)
    for (let dc = -1; dc <= 1; ++dc)
      if ((dr || dc) && mines.has((r + dr) + ',' + (c + dc)))
        ++n;
  return n;
}

async function main() {
  const game = createGame(path.join(__dirname, '..'), {
    seed: 42,
    promptName: 'TestPilot',
    dialogResults: {
      customBackdrop: ['ok', 'ok', 'cancel'],
      bestTimesBackdrop: ['reset', null],
      statsBackdrop: ['reset', null]
    }
  });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* helpers: fake cells that closest('.cell') resolves, with dataset coords */
  function cellAt(r, c) {
    const el = game.document.createElement('div');
    el.className = 'cell hidden';
    el.dataset.r = r;
    el.dataset.c = c;
    return el;
  }
  function pev(target, extra) {
    return Object.assign({
      type: 'pointer', clientX: 0, clientY: 0, pointerId: 1, button: 0,
      pointerType: 'mouse', isPrimary: true,
      preventDefault() {}, stopPropagation() {}
    }, extra, { target });
  }
  function down(target, extra) { game.dispatch('pointerdown', pev(target, Object.assign({ type: 'pointerdown' }, extra))); }
  function up(target, extra) { game.dispatch('pointerup', pev(target, Object.assign({ type: 'pointerup' }, extra))); }
  function clickCell(r, c) {
    const el = cellAt(r, c);
    down(el, { button: 0 });
    up(el, { button: 0 });
  }
  function rightClick(r, c) {
    const el = cellAt(r, c);
    down(el, { button: 2 });
    up(el, { button: 2 });
  }
  function chord(r, c) {
    const el = cellAt(r, c);
    down(el, { button: 0 });
    down(el, { button: 2 });
    up(el, { button: 0 });
  }

  /* init ran during load: flush the queued rAFs (fit + MoveWindow) */
  game.frames(3);

  /* menu: difficulty switches, marks toggle, dialogs with resets */
  game.SZ.MenuBar.onAction('intermediate'); game.frames(2);
  game.SZ.MenuBar.onAction('expert'); game.frames(2);
  game.SZ.MenuBar.onAction('beginner'); game.frames(2);
  game.SZ.MenuBar.onAction('marks'); game.frames(1);
  game.SZ.MenuBar.onAction('marks'); game.frames(1);
  game.SZ.MenuBar.onAction('about'); await game.settle();
  game.SZ.MenuBar.onAction('best-times'); await game.settle(); game.frames(2);
  game.SZ.MenuBar.onAction('statistics'); await game.settle(); game.frames(2);

  /* custom field: valid, then invalid height, then back to beginner */
  const D = game.document;
  D.getElementById('customRows').value = '9';
  D.getElementById('customCols').value = '12';
  D.getElementById('customMines').value = '15';
  game.SZ.MenuBar.onAction('custom'); await game.settle(); game.frames(2);
  game.SZ.MenuBar.onAction('custom');
  D.getElementById('customRows').value = '5';
  await game.settle(); game.frames(2);
  game.SZ.MenuBar.onAction('beginner'); game.frames(2);

  /* keyboard: F2 new game, Escape closes every dialog */
  game.key('F2'); game.frames(2);
  game.key('Escape'); game.frames(1);
  game.SZ.MenuBar.onAction('new'); game.frames(2);

  /* ---- game A: win. rng is untouched so far, predict the mines and reveal
     every safe cell; the win path stores a best time and stats ---- */
  const rng = makeRng(42);
  const minesA = simulateMines(rng, 9, 9, 10, 4, 4);
  clickCell(4, 4);
  game.frames(2);
  for (let r = 0; r < 9; ++r)
    for (let c = 0; c < 9; ++c)
      if (!minesA.has(r + ',' + c))
        clickCell(r, c);
  await game.settle();
  game.frames(80);

  /* ---- game B: chord. rng only advanced through placeMines(A), so predict
     again: reveal a number cell, flag exactly its mines, chord it open ---- */
  game.key('F2'); game.frames(2);
  const minesB = simulateMines(rng, 9, 9, 10, 4, 4);
  clickCell(4, 4);
  game.frames(2);
  let chordR = -1, chordC = -1;
  for (let r = 0; r < 9 && chordR < 0; ++r)
    for (let c = 0; c < 9 && chordR < 0; ++c)
      if (!minesB.has(r + ',' + c) && adjacentOf(minesB, r, c) > 0) {
        chordR = r;
        chordC = c;
      }
  clickCell(chordR, chordC);
  game.frames(1);
  for (let dr = -1; dr <= 1; ++dr)
    for (let dc = -1; dc <= 1; ++dc)
      if (minesB.has((chordR + dr) + ',' + (chordC + dc)))
        rightClick(chordR + dr, chordC + dc);
  chord(chordR, chordC);
  game.frames(2);

  /* ---- game C: lose. blind clicks until the boom, then run the whole
     multi-phase death animation and fire its animationend handlers ---- */
  game.key('F2'); game.frames(2);
  clickCell(0, 0);
  game.frames(2);
  outer:
  for (let r = 0; r < 9; ++r)
    for (let c = 0; c < 9; ++c) {
      clickCell(r, c);
      if (game.log[game.log.length - 1] === 'sfx explode {}')
        break outer;
    }
  game.frames(150);
  for (let i = 0; i < 3; ++i) {
    game.dispatch('animationend', { type: 'animationend', target: D.getElementById('smileyBtn') });
    game.frames(5);
  }
  await game.settle();
  game.frames(60);

  /* ---- touch: tap reveals, long-press flags with vibration, move cancels ---- */
  game.key('F2'); game.frames(2);
  let el = cellAt(0, 0);
  down(el, { pointerType: 'touch', pointerId: 2 });
  up(el, { pointerType: 'touch', pointerId: 2 });
  game.frames(2);
  el = cellAt(1, 1);
  down(el, { pointerType: 'touch', pointerId: 3 });
  game.frames(30);
  up(el, { pointerType: 'touch', pointerId: 3 });
  game.frames(2);
  el = cellAt(2, 2);
  down(el, { pointerType: 'touch', pointerId: 4 });
  game.dispatch('pointermove', pev(el, { type: 'pointermove', pointerType: 'touch', pointerId: 4, clientX: 50, clientY: 0 }));
  up(el, { pointerType: 'touch', pointerId: 4 });
  game.dispatch('pointerleave', { type: 'pointerleave', target: D.getElementById('minefield') });
  game.dispatch('contextmenu', { type: 'contextmenu', target: D.getElementById('minefield'), preventDefault() {} });
  game.frames(2);

  /* smiley button bounces a new game */
  D.getElementById('smileyBtn').click();
  game.frames(2);

  /* exit closes the window */
  game.SZ.MenuBar.onAction('exit');
  game.frames(20);
  await game.settle();

  const d = game.digest();
  if (process.env.DUMP) fs.writeFileSync('/tmp/ms.log', game.log.join('\n'));
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of [
    'MenuBar', 'User32.EnableVisualStyles', 'User32.MoveWindow', 'GameAudio.attachMuteButton menuBar',
    'data smileyBtn face=normal', 'data smileyBtn face=click', 'data smileyBtn face=dead',
    'data smileyBtn face=win', 'data smileyBtn face=skull',
    'data gameFrame theme=meadow', 'data gameFrame theme=steel', 'data gameFrame theme=inferno',
    'data gameFrame theme=neutral',
    'text mineCounter 010', 'text timer 000',
    'sfx click', 'sfx drop', 'sfx whoosh', 'sfx explode', 'sfx win', 'sfx smallExplode',
    'vibrate 25', 'particles.confetti', 'particles.burst', 'shake.trigger',
    'store sz-minesweeper-stats=', 'store sz-minesweeper-best-times=',
    'Dialog.show customBackdrop', 'Dialog.show bestTimesBackdrop', 'Dialog.show statsBackdrop',
    'Dialog.show dlg-about', 'Dialog.prompt', 'User32.DestroyWindow',
    'text customError Height must be between 9 and 24.',
    'cls.add smileyBtn victory-bounce', 'cls.add minefield board-darkened',
    'append .field-border el#', 'cls.toggle .menu-entry[data-action="marks"] checked false'
  ])
    check('session covers ' + marker, game.log.some((l) => l.startsWith(marker)), 'no line starts with ' + marker);

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
