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
  const game = createGame(path.join(__dirname, '..'), { seed: 9, dialogResult: 'reset' });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* the tutorial overlay greets a first-time player: page through it,
     reopen it with H, step back and close it with Escape */
  game.frames(4);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key('h');
  game.frames(2);
  game.key('ArrowRight', { code: 'ArrowRight' });
  game.frames(2);
  game.key('ArrowLeft', { code: 'ArrowLeft' });
  game.frames(2);
  game.key('Escape');
  game.frames(2);

  /* start the game */
  game.key(' ', { code: 'Space' });
  game.frames(10);

  /* a scripted sweep of the arena: bombs along the opened row 1, the row-3
     wall line, the mouths of columns 3 and 11 and the bottom-right corner.
     every bomb is placed from a tile with a clear escape and the player keeps
     oscillating while the fuse runs out, so each bomb detonates and the blast
     reaches the wandering enemies and the destructible walls */
  function mv(k, f) { game.key(k, { code: k }); game.frames(f); game.keyUp(k); }
  function bomb() { game.key(' ', { code: 'Space' }); game.frames(1); }
  function osc(n) { for (let i = 0; i < n; ++i) { mv('ArrowDown', 16); mv('ArrowUp', 16); } }
  function homeBomb(col, fwd, back) {
    mv(fwd, Math.round(col * 15)); bomb(); mv(back, Math.round(col * 15) + 8); osc(5);
  }

  mv('ArrowRight', 16); bomb(); mv('ArrowLeft', 16); mv('ArrowDown', 16); osc(5);
  mv('ArrowUp', 16); mv('ArrowRight', 48); bomb(); mv('ArrowLeft', 48); mv('ArrowDown', 16); osc(5);
  mv('ArrowUp', 16); homeBomb(5, 'ArrowRight', 'ArrowLeft');
  homeBomb(7, 'ArrowRight', 'ArrowLeft');
  homeBomb(9, 'ArrowRight', 'ArrowLeft');
  homeBomb(11, 'ArrowRight', 'ArrowLeft');
  homeBomb(13, 'ArrowRight', 'ArrowLeft');
  mv('ArrowRight', 48); mv('ArrowDown', 32); bomb(); mv('ArrowUp', 32); mv('ArrowLeft', 48); osc(5);
  mv('ArrowRight', 80); mv('ArrowDown', 32); bomb(); mv('ArrowUp', 32); mv('ArrowLeft', 80); osc(5);
  mv('ArrowRight', 128); mv('ArrowDown', 32); bomb(); mv('ArrowUp', 32); mv('ArrowLeft', 128); osc(5);
  mv('ArrowDown', 32); mv('ArrowRight', 192); mv('ArrowUp', 32); mv('ArrowLeft', 192); osc(3);
  mv('ArrowRight', 32); mv('ArrowDown', 16); bomb(); mv('ArrowUp', 16); mv('ArrowLeft', 32); osc(5);
  mv('ArrowRight', 32); mv('ArrowDown', 64); bomb(); mv('ArrowUp', 64); mv('ArrowLeft', 32); osc(5);
  for (let i = 0; i < 6; ++i) { mv('ArrowRight', 32); mv('ArrowDown', 32); bomb(); mv('ArrowUp', 32); mv('ArrowLeft', 32); osc(5); }
  mv('ArrowRight', 32); mv('ArrowDown', 112); mv('ArrowLeft', 32); osc(3);
  mv('ArrowRight', 160); bomb(); mv('ArrowLeft', 160); osc(5);
  mv('ArrowRight', 160); mv('ArrowDown', 32); bomb(); mv('ArrowUp', 32); mv('ArrowLeft', 160); osc(5);
  mv('ArrowRight', 160); mv('ArrowDown', 64); mv('ArrowUp', 64); mv('ArrowLeft', 160); osc(3);
  for (let i = 0; i < 4; ++i) { mv('ArrowRight', 160); mv('ArrowDown', 64); bomb(); mv('ArrowUp', 64); mv('ArrowLeft', 160); osc(5); }
  mv('ArrowRight', 160); mv('ArrowDown', 150); bomb(); mv('ArrowUp', 96); osc(5);
  mv('ArrowRight', 160); mv('ArrowDown', 150); bomb(); mv('ArrowUp', 96); osc(5);
  for (let i = 0; i < 6; ++i) { mv('ArrowRight', 160); mv('ArrowDown', 150); bomb(); mv('ArrowUp', 150); mv('ArrowLeft', 160); osc(5); }
  for (let i = 0; i < 4; ++i) { mv('ArrowRight', 192); mv('ArrowDown', 150); bomb(); mv('ArrowUp', 150); mv('ArrowLeft', 192); osc(5); }

  /* make sure we are in PLAYING (two Spaces walk DEAD->READY->PLAYING),
     then pause, auto-pause, resume */
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key(' ', { code: 'Space' });
  game.frames(2);
  game.key('Escape');
  game.frames(5);
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.key('Escape');
  game.frames(5);

  /* menu actions: high scores dialog (reset it), tutorial, controls, about,
     pause twice, exit */
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

  /* window resize through the browser event and the OS window procedure */
  game.dispatch('resize', { type: 'resize' });
  game.SZ.User32Proc(game.window.WM_SIZE);
  game.SZ.User32Proc(game.window.WM_THEMECHANGED);
  game.frames(5);

  /* keep bombing and wandering on the cleared level */
  const moves = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
  for (let round = 0; round < 60; ++round) {
    const m = moves[(round + 1) % 4];
    game.key(' ', { code: 'Space' });
    game.key(m, { code: m });
    game.frames(26);
    game.keyUp(m);
    game.frames(150);
  }

  /* stand still: enemies close in, lives drain, game over */
  game.frames(2500, 50);

  /* touch-control bomb press restarts via Space, then a fresh round */
  game.key(' ', { code: 'Space' });
  game.frames(30);
  game.key(' ', { code: 'Space' });
  game.frames(60);
  game.SZ.MenuBar.onAction('exit');
  game.frames(100);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of [
    'GameAutoPause.attach', 'User32.RegisterWindowProc', 'Dialog.wireAll', 'MenuBar',
    'TouchControls.attach', 'GameAudio.attachMuteButton',
    'img.src bomb_party_v4.png', 'img.src BomberManEffect.png',
    'User32.SetWindowText Bomberman', 'User32.SetWindowText Bomberman — Game Over',
    'User32.DestroyWindow', 'Dialog.show highScoresBackdrop', 'append highScoresBody',
    'store sz-bomberman-tutorial-seen', 'store sz-bomberman-highscores',
    'sfx select', 'sfx drop', 'sfx explode', 'sfx smallExplode', 'sfx coin',
    'sfx error', 'sfx hurt', 'sfx lose', 'sfx levelup',
    'fx.burst', 'fx.sparkle', 'fx.trail', 'fx.confetti', 'shake 5 210', 'shake 10 400', 'ftext',
    'ctx.fillText BOMBERMAN', 'ctx.fillText PAUSED', 'ctx.fillText GAME OVER',
    'ctx.fillText How to Play', 'text statusState Game Over'
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
