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
  const game = createGame(path.join(__dirname, '..'), { seed: 13 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  const canvas = game.document.getElementById('gameCanvas');
  const mouse = (type, x, y, button) => game.dispatch(type, {
    type, clientX: x, clientY: y, pointerId: 1, button: button || 0,
    preventDefault() {}, stopPropagation() {}, target: canvas
  });

  /* mode select renders; the window resize request lands on the first frames */
  game.frames(3);

  /* cycle the field size small -> medium -> large, then click the Classic card */
  game.key('ArrowRight');
  game.key('ArrowRight');
  game.frames(2);
  mouse('pointerdown', 33, 15);
  mouse('pointerup', 33, 15);
  game.frames(2);

  /* hold to auto-fire while sweeping the turret around: clears levels,
     splits rocks, collects powerups and eventually meets an asteroid */
  game.key(' ');
  for (let sweep = 0; sweep < 25; ++sweep) {
    game.key('ArrowLeft');
    game.frames(14);
    game.keyUp('ArrowLeft');
    game.frames(70);
    game.key('ArrowRight');
    game.frames(14);
    game.keyUp('ArrowRight');
    game.frames(70);
    if (sweep % 5 === 4) {
      game.key('s');
      game.keyUp('s');
    }
  }

  /* pause, auto-pause both ways, resume -- while the ship is still alive */
  game.key('p');
  game.frames(5);
  game.key('p');
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.SZ.GameAutoPause.handlers[0].pause();

  /* mouse: aim, left click shoots, right click thrusts toward the cursor */
  mouse('pointermove', 30, 20);
  mouse('pointerdown', 30, 20);
  game.frames(30);
  mouse('pointerup', 30, 20);
  mouse('pointerdown', 60, 40, 2);
  game.frames(30);
  mouse('pointerup', 60, 40, 2);

  /* keep the guns hot with thrust: kills, splits, powerups, enemies, level warps */
  for (let sweep = 0; sweep < 20; ++sweep) {
    game.key('ArrowLeft');
    game.frames(16);
    game.keyUp('ArrowLeft');
    game.frames(90);
    game.key('ArrowRight');
    game.frames(16);
    game.keyUp('ArrowRight');
    game.frames(90);
  }
  game.keyUp(' ');

  /* dialogs: high scores, controls, Escape closes them */
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  game.SZ.MenuBar.onAction('controls');
  game.frames(2);
  game.key('Escape');
  game.frames(2);

  /* new game via the menu, then Zen on the keyboard */
  game.SZ.MenuBar.onAction('new');
  game.frames(2);
  game.key('3');
  game.key(' ');
  for (let sweep = 0; sweep < 15; ++sweep) {
    game.key('ArrowLeft');
    game.frames(14);
    game.keyUp('ArrowLeft');
    game.frames(60);
    game.key('ArrowRight');
    game.frames(14);
    game.keyUp('ArrowRight');
    game.frames(60);
  }
  game.keyUp(' ');
  /* the three-minute Zen timer runs out: game over with a score to post */
  game.frames(11000);

  /* F2 back to mode select, start Hardcore with the keyboard */
  game.key('F2');
  game.frames(2);
  game.key('4');
  game.frames(300);

  /* and Survival: one life, endless waves */
  game.key('F2');
  game.frames(2);
  game.key('2');
  game.key(' ');
  for (let dive = 0; dive < 10; ++dive) {
    game.key('ArrowUp');
    game.frames(24);
    game.keyUp('ArrowUp');
    game.key('ArrowLeft');
    game.frames(10);
    game.keyUp('ArrowLeft');
    game.frames(40);
  }
  game.keyUp(' ');
  game.frames(400);

  /* exit through the menu */
  game.SZ.MenuBar.onAction('exit');
  game.frames(5);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  for (const marker of ['sfx select', 'sfx click', 'sfx shoot', 'sfx levelup', 'sfx lose',
    'store sz-asteroids-field-size', 'store sz-asteroids-high-scores',
    'fx.burst', 'fx.trail', 'shake ', 'ftext ',
    'GameAudio.attachMuteButton', 'GameAutoPause.attach', 'MenuBar',
    'User32.EnableVisualStyles', 'User32.MoveWindow', 'window.close',
    'Dialog.show highScoresBackdrop', 'Dialog.close',
    'text statusScore', 'text statusMode'])
    check('session covers ' + marker, game.log.some((l) => l.startsWith(marker)), 'no line starts with ' + marker);

  for (const text of ['ASTEROIDS', 'Field Size', 'PAUSED', 'GAME OVER', 'LEVEL ',
    'COMBO', '∞', 'Time', 'Wave', 'Score:'])
    check('session shows ' + text, game.log.some((l) => l.includes(text)), 'no line contains ' + text);

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
