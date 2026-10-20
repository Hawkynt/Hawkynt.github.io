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
  const game = createGame(path.join(__dirname, '..'), { seed: 42 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* first play: the tutorial overlay greets us -- page through it, then help back in */
  game.frames(4);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key('ArrowRight', { code: 'ArrowRight' });
  game.frames(2);
  game.key('h');
  game.frames(2);
  game.key('Escape');
  game.frames(2);

  /* start the game and dig: down, right, down, left, up */
  game.key('F2');
  game.frames(20);
  game.key('ArrowDown');
  game.frames(30);
  game.keyUp('ArrowDown');
  game.key('ArrowRight');
  game.frames(40);
  game.keyUp('ArrowRight');
  game.key('ArrowDown');
  game.frames(35);
  game.keyUp('ArrowDown');
  game.key('ArrowLeft');
  game.frames(25);
  game.keyUp('ArrowLeft');
  game.key('ArrowUp');
  game.frames(15);
  game.keyUp('ArrowUp');

  /* click-to-move across the cave */
  game.pointer('pointerdown', 700, 500);
  game.frames(25);
  game.pointer('pointermove', 300, 200);
  game.frames(25);
  game.pointer('pointerup', 300, 200);

  /* pause, auto-pause, resume */
  game.key('Escape');
  game.frames(5);
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.key('Escape');
  game.frames(5);

  /* menu actions: high scores dialog, reset it, help, controls, about, pause twice */
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  game.dispatch('dialog:result', { type: 'dialog:result', detail: 'reset' });
  game.SZ.MenuBar.onAction('tutorial');
  game.frames(2);
  game.key('Escape');
  game.frames(2);
  game.SZ.MenuBar.onAction('controls');
  game.SZ.MenuBar.onAction('about');
  game.SZ.MenuBar.onAction('pause');
  game.frames(3);
  game.SZ.MenuBar.onAction('pause');
  game.frames(3);

  /* snake through the cave: sweep rows to dig, collect gems and open the exit */
  for (let pass = 0; pass < 6; ++pass) {
    game.key('ArrowDown');
    game.frames(24);
    game.keyUp('ArrowDown');
    game.key('ArrowRight');
    game.frames(330);
    game.keyUp('ArrowRight');
    game.key('ArrowDown');
    game.frames(24);
    game.keyUp('ArrowDown');
    game.key('ArrowLeft');
    game.frames(330);
    game.keyUp('ArrowLeft');
  }

  /* head for the exit in the bottom-right corner */
  game.key('ArrowRight');
  game.frames(330);
  game.keyUp('ArrowRight');
  game.key('ArrowDown');
  game.frames(200);
  game.keyUp('ArrowDown');

  /* let the clock run out: deaths, respawn timers, game over */
  game.frames(3000, 50);

  /* restart and play on */
  game.key('F2');
  game.frames(60);
  game.key('ArrowDown');
  game.frames(40);
  game.keyUp('ArrowDown');
  game.key('ArrowRight');
  game.frames(60);
  game.keyUp('ArrowRight');
  game.SZ.MenuBar.onAction('exit');
  game.frames(200);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of ['sfx pickup', 'sfx thud', 'sfx explode', 'sfx lose', 'sfx click',
    'store sz-boulder-dash-highscores', 'User32.SetWindowText', 'Dialog.show',
    'fx.burst', 'ftext', 'GameAutoPause.attach'])
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
