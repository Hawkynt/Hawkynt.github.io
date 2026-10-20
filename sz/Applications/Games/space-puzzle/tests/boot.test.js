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
  const game = createGame(path.join(__dirname, '..'), { seed: 7 });

  /* the canvas element reports 100x40 client box while the game draws 640x480,
     so pointer coordinates scale by 6.4 horizontally and 12 vertically */
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* ready overlay, then start via F2 */
  game.frames(5);
  game.key('F2');
  game.frames(10);

  /* drag left and launch — the probe flies off-screen and is missed */
  game.pointer('pointerdown', 16, 20);
  game.pointer('pointermove', 30, 20);
  game.pointer('pointerup', 30, 20);
  game.frames(60);

  /* retry, then aim right: level 1 is a straight shot to the repair goal */
  game.key('r');
  game.frames(5);
  game.pointer('pointerdown', 16, 20);
  game.pointer('pointermove', 2, 20);
  game.pointer('pointerup', 2, 20);
  game.frames(240); /* solve, star rating, then the timed advance to level 2 */

  /* pause and resume */
  game.key('Escape'); game.frames(10); game.key('Escape'); game.frames(10);

  /* level 2 has a gravity well — launch toward it */
  game.pointer('pointerdown', 12.5, 33.33);
  game.pointer('pointermove', 5, 40);
  game.pointer('pointerup', 5, 40);
  game.frames(200);

  /* dialogs and menu actions */
  game.SZ.MenuBar.onAction('high-scores');
  await game.settle();
  game.dispatch('dialog:result', { type: 'dialog:result', detail: 'reset' });
  await game.settle();
  game.SZ.MenuBar.onAction('controls');
  game.SZ.MenuBar.onAction('about');
  game.SZ.MenuBar.onAction('pause'); game.frames(5); game.SZ.MenuBar.onAction('pause');
  game.SZ.MenuBar.onAction('exit');

  /* fresh game and a long flight through the well field of level 1 again */
  game.key('F2');
  game.frames(30);
  game.pointer('pointerdown', 16, 20);
  game.pointer('pointermove', 10, 18);
  game.pointer('pointerup', 10, 18);
  game.frames(400);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  /* the session must walk the rich paths: launch, miss, solve with rating,
     level advance, pause, dialogs, OS hooks and the effect libraries */
  const markers = ['sfx whoosh', 'Miss!', 'repaired!', 'PAUSED', 'SPACE PUZZLE',
    'User32.SetWindowText', 'User32.RegisterWindowProc', 'Dialog.wireAll',
    'setPointerCapture', 'shake.trigger', 'text.add', 'particles.burst',
    'REPAIR', 'MenuBar'];
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
