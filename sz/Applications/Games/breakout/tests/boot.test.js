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

  const canvas = game.document.getElementById('gameCanvas');

  /* level transition entry animation, then launch */
  game.frames(120);
  game.key(' ');

  /* sweep the paddle to keep the ball alive */
  for (let i = 0; i < 60; ++i) {
    game.key('ArrowLeft'); game.frames(25); game.keyUp('ArrowLeft');
    game.key('ArrowRight'); game.frames(25); game.keyUp('ArrowRight');
    if (i % 8 === 7) game.key(' ');
  }

  /* pointer lock, mouse paddle movement, click launch/laser */
  canvas.click();
  game.dispatch('mousemove', { type: 'mousemove', movementX: 40, movementY: 0, preventDefault() {} });
  game.frames(120);
  game.key(' ');
  game.frames(200);
  game.dispatch('mousedown', { type: 'mousedown', button: 0, preventDefault() {} });
  game.frames(200);

  /* pause and resume */
  game.key('p'); game.frames(10); game.key('p'); game.frames(150);

  /* high scores dialog, closed with Escape */
  game.SZ.MenuBar.onAction('high-scores'); await game.settle(); game.key('Escape');

  /* large field: new starfield, new game, window resize */
  game.SZ.MenuBar.onAction('size-large');
  game.frames(150);
  game.key(' ');

  /* park the paddle left and drain the lives to game over */
  game.key('ArrowLeft');
  for (let i = 0; i < 120; ++i) { game.frames(20); game.key(' '); }
  game.keyUp('ArrowLeft');

  /* restart from game over, back to the small field, zen mode on */
  game.key('Enter'); game.frames(60);
  game.SZ.MenuBar.onAction('size-small'); game.frames(120);
  game.SZ.MenuBar.onAction('zen');
  game.key(' ');

  /* zen auto-relaunch keeps balls coming; sweep until a level clears */
  for (let i = 0; i < 240; ++i) {
    game.key('ArrowLeft'); game.frames(25); game.keyUp('ArrowLeft');
    game.key('ArrowRight'); game.frames(25); game.keyUp('ArrowRight');
  }
  game.SZ.MenuBar.onAction('zen');
  game.frames(300);

  /* fresh game via F2 */
  game.key('F2'); game.frames(300);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  /* the session must walk the rich paths: power-ups, a level clear, life loss,
     game over with high-score save, pointer lock, field switch, dialogs, restart */
  const markers = ['sfx powerup', 'sfx levelup', 'sfx lose', 'sfx hurt', 'store sz-breakout',
    'LEVEL COMPLETE', 'requestPointerLock', 'exitPointerLock', 'starfield.new', 'User32.MoveWindow'];
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
