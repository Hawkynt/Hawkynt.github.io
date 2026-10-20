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
  const game = createGame(path.join(__dirname, '..'), {
    seed: 7,
    /* the high-scores dialog resolves with Reset so the reset branch runs */
    dialogResults: { highScoresBackdrop: 'reset' }
  });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  await game.settle();

  /* the title screen renders a few frames before the run starts */
  game.frames(3);

  /* a serpentine sweep of the floor: hold a direction long enough to reach the wall,
     step down, reverse. This walks the player across portals and objects, triggering
     room transitions, rule discovery, warps and perspective shifts. Q shifts the
     perspective, E interacts; both are no-ops outside the exploring state. */
  function sweep() {
    game.key('ArrowUp'); game.frames(120); game.keyUp('ArrowUp');
    for (let row = 0; row < 9; ++row) {
      const dir = row % 2 ? 'ArrowLeft' : 'ArrowRight';
      game.key(dir); game.frames(220); game.keyUp(dir);
      game.key('ArrowDown'); game.frames(14); game.keyUp('ArrowDown');
      if (row % 3 === 0) { game.key('KeyQ'); game.frames(2); }
      if (row % 2 === 1) { game.key('KeyE'); game.frames(2); }
    }
  }

  /* start from the title screen by tapping the canvas (READY -> new run) */
  game.pointer('pointerdown', 120, 120);
  game.frames(5);
  sweep();

  /* pause and resume via Escape, then the auto-pause handler pauses and Escape resumes */
  game.key('Escape'); game.frames(6);
  game.key('Escape'); game.frames(6);
  game.SZ.GameAutoPause.handlers[0].pause(); game.frames(6);
  game.key('Escape'); game.frames(6);

  /* F2 starts a fresh run; sweep again, this time steering with WASD as well */
  game.key('F2'); game.frames(5);
  sweep();
  game.key('KeyA'); game.frames(40); game.keyUp('KeyA');
  game.key('KeyW'); game.frames(40); game.keyUp('KeyW');
  game.key('KeyD'); game.frames(40); game.keyUp('KeyD');
  game.key('KeyS'); game.frames(40); game.keyUp('KeyS');

  /* restart mid-run and sweep once more so several rooms get re-explored */
  game.key('F2'); game.frames(5);
  sweep();

  /* menu actions: high scores (reset branch), controls, about, pause toggle, new game, exit */
  game.SZ.MenuBar.onAction('high-scores');
  await game.settle();
  game.SZ.MenuBar.onAction('controls');
  await game.settle();
  game.SZ.MenuBar.onAction('about');
  await game.settle();
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('new'); game.frames(5);
  game.SZ.MenuBar.onAction('exit');
  await game.settle();

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
