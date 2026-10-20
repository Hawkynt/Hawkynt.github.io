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
    seed: 42,
    /* the launch dialog starts a small, fast Zen game with power-ups straight away */
    storage: {
      'sz-snake-config': JSON.stringify({
        walls: 'wrap', obstacles: 'none', enemies: 0, powerups: true,
        fieldSize: 'small', speed: 'fast', visualTheme: 'zen'
      })
    },
    dialogResults: { optionsBackdrop: 'start' }
  });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* the launch options dialog resolves -> first game starts */
  await game.settle();

  /* sweep the wrapped field row by row, alternating direction: food, growth,
     levels, power-ups; Space restarts a dead run and is a no-op while alive */
  for (let row = 0; row < 6; ++row) {
    game.key('ArrowDown'); game.frames(8);
    game.key(row % 2 ? 'ArrowLeft' : 'ArrowRight'); game.frames(100);
  }

  /* pause and resume */
  game.key('p'); game.frames(10);
  game.key('p'); game.frames(10);

  /* the auto-pause handler pauses, P resumes */
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.key('p'); game.frames(10);

  /* F2 opens the options dialog (pausing the run), Escape resumes before it resolves */
  game.key('F2');
  game.key('Escape');
  await game.settle();

  /* keep sweeping the fresh game, restarting whenever the run has ended */
  for (let row = 0; row < 40; ++row) {
    if (row % 4 === 0) { game.key(' '); await game.settle(); }
    game.key('ArrowDown'); game.frames(8);
    game.key(row % 2 ? 'ArrowLeft' : 'ArrowRight'); game.frames(100);
  }

  /* wasd steering and pointer steering */
  game.key('w'); game.frames(8);
  game.key('a'); game.frames(50);
  game.key('s'); game.frames(50);
  game.key('d'); game.frames(50);
  game.pointer('pointerdown', 150, 120);
  game.pointer('pointermove', 190, 130);
  game.frames(20);
  game.pointer('pointerup', 190, 130);
  game.frames(20);

  /* Tron preset: pick it while the dialog is open, then let it resolve */
  game.key('F2');
  game.clickPreset('tron');
  await game.settle();
  game.key('ArrowUp'); game.frames(140);
  game.key(' '); await game.settle();
  game.key('ArrowLeft'); game.frames(140);
  game.key(' '); await game.settle();
  game.key('ArrowDown'); game.frames(140);

  /* Battle Royale preset: AI snakes, random obstacles, power-ups, wrap;
     Space revives a dead run so the AI keep moving, and is a no-op while alive */
  game.key('F2');
  game.clickPreset('battleRoyale');
  await game.settle();
  game.key('ArrowUp'); game.frames(80);
  game.key('ArrowLeft'); game.frames(70);
  game.key(' '); await game.settle();
  game.key('ArrowDown'); game.frames(80);
  game.key('ArrowRight'); game.frames(70);
  game.key(' '); await game.settle();
  game.key('ArrowUp'); game.frames(80);
  game.key('ArrowLeft'); game.frames(70);

  /* Maze Runner preset: maze obstacles, coin food, torch head */
  game.key('F2');
  game.clickPreset('mazeRunner');
  await game.settle();
  game.key('ArrowUp'); game.frames(100);
  game.key('ArrowLeft'); game.frames(100);

  /* Classic preset: drive into a solid wall -> game over -> Space restarts */
  game.key('F2');
  game.clickPreset('classic');
  await game.settle();
  game.key('ArrowRight');
  game.frames(150);
  game.key(' ');
  await game.settle();
  game.frames(30);

  /* menu actions: dialogs, pause, exit */
  game.SZ.MenuBar.onAction('high-scores');
  await game.settle();
  game.SZ.MenuBar.onAction('controls');
  await game.settle();
  game.SZ.MenuBar.onAction('about');
  await game.settle();
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
  game.SZ.MenuBar.onAction('pause'); game.frames(5);
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
