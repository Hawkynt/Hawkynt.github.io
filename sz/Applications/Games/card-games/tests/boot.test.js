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

  /* the fake canvas is 100x40 for a 900x600 logical board: the controller maps
     client coords to canvas coords with scaleX=9, scaleY=15 */
  function pev(type, mx, my) {
    return {
      type, clientX: mx / 9, clientY: my / 15, pointerId: 1, button: 0,
      preventDefault() {}, stopPropagation() {}, target: game.document.body
    };
  }
  function click(mx, my) {
    game.dispatch('pointerdown', pev('pointerdown', mx, my));
    game.dispatch('pointerup', pev('pointerup', mx, my));
  }

  /* menu screen */
  game.frames(5);

  /* menu bar: high scores on an empty table */
  game.SZ.MenuBar.onAction('high-scores');

  /* ---- Solitaire (solitaire family) ---- */
  click(386, 80);            /* menu button "Solitaire" */
  game.frames(40);           /* deal animation */
  click(69, 89); game.frames(10);   /* stock */
  click(69, 89); game.frames(10);
  click(69, 89); game.frames(10);
  click(195, 89); click(195, 89); game.frames(20);  /* double-click waste -> foundation */
  click(69, 263); game.frames(10);  /* tableau column 0 */
  click(821, 375); game.frames(30); /* tableau column 6 */
  click(772, 22); game.frames(3);   /* hint toggle */
  click(690, 22); game.frames(3);   /* auto-sort toggle */

  /* card style settings panel: table, back, custom color, face, close */
  click(608, 22); game.frames(3);   /* Style button */
  click(398, 162); game.frames(3);  /* table: Midnight Blue */
  click(602, 230); game.frames(3);  /* card back: Custom Color */
  click(466, 298); game.frames(3);  /* card face: German */
  click(348, 364); game.frames(3);  /* custom color swatch 1 */
  click(450, 479); game.frames(3);  /* Close */

  /* pause / resume */
  game.key('Escape'); game.frames(5);
  game.key('Escape'); game.frames(5);

  /* F2 restarts the current variant, then back to the menu via the canvas button */
  game.key('F2'); game.frames(30);
  click(854, 22); game.frames(5);

  /* ---- Blackjack (casino family) ---- */
  click(258, 124); game.frames(30);
  click(385, 553); game.frames(10); /* Hit */
  click(385, 553); game.frames(10);
  click(515, 553); game.frames(60); /* Stand -> dealer plays, round over */
  click(450, 300); game.frames(30); /* click to continue -> next round */
  click(385, 553); game.frames(10);
  click(515, 553); game.frames(60);
  game.SZ.MenuBar.onAction('new'); game.frames(20);
  game.SZ.MenuBar.onAction('back-to-menu'); game.frames(5);

  /* ---- Hearts (trick-taking family) ---- */
  click(514, 299); game.frames(60);
  for (const hx of [300, 400, 500, 600]) {
    click(hx, 520);
    game.frames(20);
  }
  game.frames(300); /* let the AI play tricks */
  game.SZ.MenuBar.onAction('new'); game.frames(50);
  game.SZ.MenuBar.onAction('back-to-menu'); game.frames(5);

  /* ---- Memory (matching / children family) ---- */
  click(514, 445); game.frames(30);
  for (let r = 0; r < 4; ++r)
    for (let c = 0; c < 6; ++c) {
      click(220 + c * 92, 137 + r * 122);
      game.frames(3);
    }
  for (let r = 3; r >= 0; --r)
    for (let c = 5; c >= 0; --c) {
      click(220 + c * 92, 137 + r * 122);
      game.frames(3);
    }
  game.frames(60);
  game.SZ.MenuBar.onAction('new'); game.frames(10);
  game.SZ.MenuBar.onAction('back-to-menu'); game.frames(5);

  /* ---- Uno (shedding family) ---- */
  click(386, 226); game.frames(40);
  click(390, 295); game.frames(15); /* draw pile */
  for (const hx of [120, 175, 230, 285]) {
    click(hx, 495);
    game.frames(15);
  }
  game.frames(200); /* AI turns */
  game.SZ.MenuBar.onAction('new'); game.frames(10);
  game.SZ.MenuBar.onAction('back-to-menu'); game.frames(5);

  /* ---- War (simple family): flip until the game finishes ---- */
  click(642, 474); game.frames(30);
  for (let i = 0; i < 1500; ++i) {
    click(450, 300); /* FLIP button */
    game.frames(100); /* let the flip/show/collect animation cycle finish */
    if (game.log.some((l) => l.startsWith('ctx.fillText GAME OVER')))
      break;
  }
  game.frames(20);
  click(450, 300); game.frames(20); /* GAME OVER -> click -> back to menu */

  /* menu bar pause toggle and exit */
  game.SZ.MenuBar.onAction('pause'); game.frames(3);
  game.SZ.MenuBar.onAction('pause'); game.frames(3);
  game.SZ.MenuBar.onAction('exit');
  game.frames(10);
  await game.settle();

  const d = game.digest();
  if (process.env.DUMP) fs.writeFileSync('/tmp/cardgames.log', game.log.join('\n'));
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of [
    'MenuBar', 'User32.RegisterWindowProc', 'User32.SetWindowText Card Games Suite',
    'GameAudio.attachMuteButton', 'GameEffects.ParticleSystem',
    'text statusVariant Game: Solitaire', 'text statusVariant Game: Blackjack',
    'text statusVariant Game: Hearts', 'text statusVariant Game: Memory',
    'text statusVariant Game: Uno', 'text statusVariant Game: War',
    'text statusScore Score: ', 'text statusRound Round: ',
    'store sz-card-games-highscores=', 'store sz-card-games-hints=',
    'store sz-card-games-table=blue', 'store sz-card-games-cardback=custom',
    'store sz-card-games-cardface=german', 'store sz-card-games-backcolor=',
    'sfx select', 'sfx click',
    'ctx.fillText Card Games Suite', 'ctx.fillText PAUSED', 'ctx.fillText GAME OVER',
    'ftext ', 'postMessage {"type":"sz:close"}'
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
