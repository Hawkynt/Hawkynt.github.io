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
  const game = createGame(path.join(__dirname, '..'), { seed: 42, dialogResult: 'reset' });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* first play: the tutorial overlay greets us -- page through it, help back in,
     step back a page, close with Escape */
  game.frames(4);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key('h');
  game.frames(2);
  game.key('ArrowLeft', { code: 'ArrowLeft' });
  game.frames(2);
  game.key('Escape');
  game.frames(2);

  /* start the run and steer: lanes, jump to landing, slide */
  game.key(' ', { code: 'Space' });
  game.frames(30);
  game.key('ArrowLeft', { code: 'ArrowLeft' });
  game.frames(20);
  game.key('ArrowRight', { code: 'ArrowRight' });
  game.frames(20);
  game.key('ArrowUp', { code: 'ArrowUp' });
  game.frames(50);
  game.key('ArrowDown', { code: 'ArrowDown' });
  game.frames(40);

  /* tap the lanes: left edge, right edge, same lane jumps */
  game.pointer('pointerdown', 10, 300);
  game.frames(20);
  game.pointer('pointerdown', 90, 300);
  game.frames(20);
  game.pointer('pointerdown', 50, 300);
  game.frames(30);

  /* pause, auto-pause toggle, resume */
  game.key('Escape');
  game.frames(5);
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.key('Escape');
  game.frames(5);
  game.key('Escape');
  game.frames(5);

  /* menu actions: high scores dialog (reset branch), help, controls, about,
     pause twice, new game */
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  await game.settle();
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
  game.SZ.MenuBar.onAction('new');
  game.frames(5);

  /* OS integration: window procedure messages and the resize listener */
  for (const proc of game.SZ.Dlls.User32.windowProcs) {
    proc('WM_THEMECHANGED');
    proc('WM_SIZE');
  }
  game.dispatch('resize', { type: 'resize' });
  game.frames(3);

  /* long weave at clamped dt: lane switches and hops dodge most obstacles, so the
     speed ramp reaches the tier change while coins and power-ups get collected */
  game.key(' ', { code: 'Space' });
  for (let i = 0; i < 60; ++i) {
    game.key(' ', { code: 'Space' });
    game.frames(14, 50);
    if (i % 2 === 0) game.key('ArrowRight', { code: 'ArrowRight' });
    else game.key('ArrowLeft', { code: 'ArrowLeft' });
    game.frames(10, 50);
  }

  /* dead -> restart -> run on */
  game.frames(5);
  game.key(' ', { code: 'Space' });
  game.frames(5);
  game.key(' ', { code: 'Space' });
  game.frames(200, 50);

  /* exit through the menu */
  game.SZ.MenuBar.onAction('exit');
  game.frames(200);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  /* the tier-change sfx is deliberately not pinned: blind scripted play never
     survives the 50 s needed for the speed ramp to cross the first tier */
  for (const marker of ['sfx select', 'sfx whoosh', 'sfx jump', 'sfx thud',
    'sfx coin', 'sfx powerup', 'sfx hurt', 'sfx lose', 'fx.burst', 'fx.sparkle', 'ftext', 'shake 8 400',
    'store sz-endless-runner-tutorial-seen', 'store sz-endless-runner-highscores',
    'store sz-endless-runner-coins', 'User32.SetWindowText Endless Runner',
    'User32.RegisterWindowProc', 'User32.DestroyWindow', 'Dialog.show highScoresBackdrop',
    'Dialog.show controlsBackdrop', 'Dialog.show dlg-about', 'Dialog.wireAll', 'MenuBar',
    'GameAutoPause.attach', 'GameAudio.attachMuteButton'])
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
