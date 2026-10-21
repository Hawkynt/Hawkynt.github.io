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

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 11 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  const canvas = game.document.getElementById('gameCanvas');

  /* song select: navigate and start the first song */
  game.frames(5);
  game.key('ArrowDown'); game.frames(2); game.key('ArrowUp'); game.frames(2);
  game.key('Enter');

  /* the first four notes of Cosmic Flow land at 0, 1.5, 3.0 and 4.5 seconds —
     at 16.667ms per frame they arrive after 120, 90, 90 and 90 frames */
  game.frames(120); game.key('d');
  game.frames(90); game.key('f');
  game.frames(90); game.key('j');
  game.frames(90); game.key('k');

  /* a stray press with no note nearby is a miss */
  game.key('d'); game.frames(5);

  /* pause and resume */
  game.key('Escape'); game.frames(10); game.key('Escape'); game.frames(10);

  /* run the song out to the results screen */
  game.frames(1600);

  /* back to song select via Enter */
  game.key('Enter'); game.frames(5);

  /* menu actions: high scores table, exit request, pause in select, new game */
  game.SZ.MenuBar.onAction('high-scores');
  game.SZ.MenuBar.onAction('exit');
  game.SZ.MenuBar.onAction('pause'); game.frames(3);
  game.SZ.MenuBar.onAction('new'); game.frames(3);

  /* auto-pause handler, then a canvas click resumes */
  game.SZ.GameAutoPause.handlers[0].pause(); game.frames(3);
  game.pointer('pointerdown', 50, 20); game.frames(3);

  /* window resize re-runs the canvas setup */
  game.dispatch('resize', { type: 'resize' }); game.frames(2);

  /* click the third song row (rows start at y=110, 60px apart; the fake canvas
     reports a 100x40 client box for a 900x640 surface) */
  game.pointer('pointerdown', 50, 15);
  game.frames(100);
  game.key('d'); game.key('f'); game.frames(20);

  /* fresh start via F2 */
  game.key('F2');
  game.frames(10);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  /* the session must walk the rich paths: song select, perfect hits and combo,
     miss, pause, results with grade and saved score, dialogs, menu, OS hooks */
  const markers = ['Select a Song', 'Song Complete!', 'Grade:', 'store sz-rhythm-game',
    'PERFECT', 'Miss', 'Combo', 'PAUSED', 'fx.confetti', 'fx.sparkle', 'fx.trail',
    'shake ', 'GameAudio.attachMuteButton', 'GameAudio.onMuteChange',
    'GameAutoPause.attach', 'Dialog.wireAll', 'MenuBar', 'User32.SetWindowText',
    'parent.postMessage'];
  for (const m of markers)
    check('path exercised: ' + m, game.log.some(l => l.includes(m)));

  if (!fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, JSON.stringify({ digest: d, entries: game.log.length }, null, 2) + '\n');
    console.log('BASELINE RECORDED ' + d);
    process.exit(failures ? 1 : 0);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  check('digest matches baseline', d === base.digest, 'got ' + d + ' want ' + base.digest);

  process.exit(failures ? 1 : 0);
}

main();
