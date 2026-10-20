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
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* the first-run tutorial overlay is up: page through it (ArrowRight = next,
     the second next closes it) */
  game.key('ArrowRight'); game.frames(2);
  game.keyUp('ArrowRight');
  game.key('ArrowRight'); game.frames(2);
  game.keyUp('ArrowRight');

  /* F2 starts a game (READY -> PLAYING) */
  game.key('F2'); game.frames(2);

  /* run right while shooting and bouncing, then back left: traps, pops, fruit,
     power-ups, level flow */
  game.key('d'); game.key(' '); game.key('w');
  game.frames(260);
  game.keyUp('d'); game.key('a');
  game.frames(260);
  game.keyUp('a'); game.key('d');
  game.frames(260);

  /* pause and resume via Escape */
  game.key('Escape'); game.frames(5);
  game.key('Escape'); game.frames(5);

  /* H opens the help overlay mid-run, page through and close it */
  game.key('h'); game.frames(2);
  game.key('ArrowRight'); game.frames(2);
  game.key('ArrowRight'); game.frames(2);
  game.keyUp('ArrowRight');

  /* keep firing and roaming until the run ends (lives run out -> DEAD) */
  game.frames(1400);
  game.keyUp(' '); game.keyUp('w'); game.keyUp('d');

  /* the high-score dialog: open it, reset the table, close it */
  game.SZ.MenuBar.onAction('high-scores');
  await game.settle();
  game.dispatch('dialog:result', { type: 'dialog:result', detail: 'reset' });
  await game.settle();

  /* restart from the game-over screen and play a fresh run */
  game.key('F2'); game.frames(2);
  game.key('a'); game.key(' '); game.key('w');
  game.frames(500);
  game.keyUp('a'); game.keyUp(' '); game.keyUp('w');

  /* menu actions: dialogs, help, pause toggles, new game, exit */
  game.SZ.MenuBar.onAction('controls');
  await game.settle();
  game.SZ.MenuBar.onAction('about');
  await game.settle();
  game.SZ.MenuBar.onAction('tutorial');
  game.frames(2);
  game.key('Escape'); game.frames(2);
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('new'); game.frames(5);
  game.SZ.MenuBar.onAction('exit');
  await game.settle();

  /* the auto-pause handler pauses a running game, Escape resumes */
  game.key('F2'); game.frames(2);
  game.key('d'); game.frames(40);
  game.SZ.GameAutoPause.handlers[0].pause(); game.frames(5);
  game.key('Escape'); game.frames(5);
  game.keyUp('d');

  /* a final long roam so the loop keeps ticking across levels and deaths */
  game.key(' '); game.key('w'); game.key('d');
  game.frames(1200);

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
