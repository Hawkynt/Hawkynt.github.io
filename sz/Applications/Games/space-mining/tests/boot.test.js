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

/* the fake canvas is 100x40 CSS px for a 700x500 canvas: map canvas coords to client coords */
const aim = (cx, cy) => [cx / 7, cy / 12.5];

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 42 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* title screen, then start with SPACE -- the first-time tutorial opens */
  game.frames(4);
  game.key(' ', { code: 'Space' });
  game.frames(2);

  /* page through all four tutorial pages with SPACE (it stays held for drilling) */
  game.key(' ', { code: 'Space' }); game.frames(2);
  game.key(' ', { code: 'Space' }); game.frames(2);
  game.key(' ', { code: 'Space' }); game.frames(2);
  game.key(' ', { code: 'Space' }); game.frames(2);

  /* mine with SPACE held and the cursor 50px ahead of the ship: it parks on the
     asteroid at (1836,1417) and drills it until it depletes, then catches the
     next one at (2487,1453) and fills the cargo hold (cargo-full error) */
  game.pointer('pointerdown', ...aim(400, 250));
  game.frames(620);
  game.frames(420);

  /* aim the cursor along the straight line from the ship's traced position
     (2461,1357) to the station at (1500,1500) and sell on arrival with E */
  game.pointer('pointermove', ...aim(202, 272));
  game.frames(470);
  for (let i = 0; i < 10; ++i) {
    game.frames(12);
    game.key('e', { code: 'KeyE' });
  }
  game.frames(2);

  /* shop at the station: move selection, buy the expensive hull (error) and the
     drill upgrade with the earned credits, close with ESC */
  game.key('ArrowDown'); game.frames(1);
  game.key('ArrowUp'); game.frames(1);
  game.key('5'); game.frames(1);
  game.key('1'); game.frames(2);
  game.key('Escape'); game.frames(2);

  /* pause, auto-pause, resume */
  game.key('Escape');
  game.frames(5);
  game.SZ.GameAutoPause.handlers[0].pause();
  game.frames(5);
  game.key('Escape');
  game.frames(5);

  /* menu actions: high scores dialog, reset it, tutorial, controls, about, pause twice */
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  game.resolveDialog('reset');
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

  /* window resize re-runs the canvas setup */
  game.dispatch('resize', { type: 'resize' });
  game.frames(2);

  /* new game from the menu, then a long run: powerup spawns, shooting stars,
     asteroid respawn, hints and drilling on the way to the top-left corner */
  game.SZ.MenuBar.onAction('new');
  game.frames(2000, 50);

  /* exit posts sz:close to the frame host */
  game.SZ.MenuBar.onAction('exit');
  game.frames(200);
  await game.settle();

  const d = game.digest();
  if (process.env.DUMP) fs.writeFileSync('/tmp/sm.log', game.log.join('\n'));
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of ['sfx select', 'sfx click', 'sfx error', 'sfx coin', 'sfx levelup', 'sfx explode',
    'store sz-space-mining-tutorial-seen=1', 'store sz-space-mining-highscores', 'User32.SetWindowText',
    'Dialog.show', 'fx.burst', 'fx.trail', 'ftext', 'shake ', 'GameAutoPause.attach', 'MenuBar',
    'postMessage', 'text statusState Docked', 'html highScoresBody'])
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
