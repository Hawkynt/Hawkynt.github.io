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

/* the fake canvas is 100x40 CSS px for an 800x560 canvas: map canvas coords to client coords */
const aim = (cx, cy) => [cx / 8, cy / 14];

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 7 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  const ended = () => game.log.some((l) => l === 'sfx win {}' || l === 'sfx lose {}');

  /* menu renders, difficulty picked by click: Easy then back to Normal */
  game.frames(4);
  game.pointer('pointerdown', ...aim(400, 199));
  game.frames(2);
  game.pointer('pointerdown', ...aim(400, 247));
  game.frames(2);

  /* deck builder: swap two preset cards out and pull a buff and a debuff card
     in, so the deck holds all five card types and stays exactly 30 cards */
  game.key('d'); game.frames(2);
  game.pointer('pointerdown', ...aim(72, 70));   /* id 1  -> remove */
  game.frames(1);
  game.pointer('pointerdown', ...aim(165, 70));  /* id 2  -> remove */
  game.frames(1);
  game.pointer('pointerdown', ...aim(258, 70));  /* id 3  -> remove */
  game.frames(1);
  game.pointer('pointerdown', ...aim(351, 254)); /* id 36 Battle Cry -> add */
  game.frames(1);
  game.pointer('pointerdown', ...aim(537, 300)); /* id 46 Weaken -> add */
  game.frames(1);
  game.pointer('pointerdown', ...aim(723, 300)); /* id 48 Slow -> add */
  game.frames(1);
  game.key('d'); game.frames(2);

  /* how to play from the menu with H */
  game.key('h');
  game.resolveDialog('ok');
  await game.settle(); game.frames(2);

  /* start the game with the Start Game button */
  game.pointer('pointerdown', ...aim(400, 439));
  game.frames(5);

  /* play up to 60 rounds: throw every affordable card at the opponent, end the
     turn, let the AI play out; pause and resume once mid-fight */
  for (let round = 0; round < 60 && !ended(); ++round) {
    for (let k = 1; k <= 7; ++k) game.key(String(k));
    game.frames(2);
    if (round === 3) {
      game.key('Escape'); game.frames(30);
      game.key('Escape'); game.frames(2);
    }
    game.key('e');
    game.frames(240);
  }
  game.frames(120);

  /* restart with F2 and fight a few more rounds with a fresh shuffle */
  game.key('F2'); game.frames(5);
  for (let round = 0; round < 8 && !ended(); ++round) {
    for (let k = 1; k <= 7; ++k) game.key(String(k));
    game.key('e');
    game.frames(240);
  }
  game.frames(120);

  /* menu actions: high scores dialog, reset it, controls, about, pause twice */
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  game.resolveDialog('reset');
  await game.settle(); game.frames(2);
  game.SZ.MenuBar.onAction('high-scores');
  game.frames(2);
  game.resolveDialog('ok');
  await game.settle(); game.frames(2);
  game.SZ.MenuBar.onAction('controls');
  game.SZ.MenuBar.onAction('about');
  game.resolveDialog('ok');
  game.resolveDialog('ok');
  await game.settle();
  game.SZ.MenuBar.onAction('pause');
  game.frames(30);
  game.SZ.MenuBar.onAction('pause');
  game.frames(3);

  /* window procedure resize and the browser resize event re-run the canvas setup */
  game.SZ.User32Proc('WM_SIZE');
  game.SZ.User32Proc('WM_THEMECHANGED');
  game.dispatch('resize', { type: 'resize' });
  game.frames(2);

  /* exit posts sz:close to the frame host */
  game.SZ.MenuBar.onAction('exit');
  game.frames(20);
  await game.settle();

  const d = game.digest();
  if (process.env.DUMP) fs.writeFileSync('/tmp/fc.log', game.log.join('\n'));
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  check('session reached a win or a defeat', ended(), 'no win/lose sfx');
  check('session landed a heavy hit', game.log.some((l) => l.startsWith('sfx thud')), 'no thud');
  check('session drew the end overlay',
    game.log.some((l) => l.startsWith('ctx.fillText') && (l.includes('VICTORY!') || l.includes('DEFEAT'))),
    'no victory/defeat text');
  for (const marker of [
    'MenuBar', 'Dialog.wireAll', 'GameAudio.attachMuteButton',
    'GameEffects.ParticleSystem', 'GameEffects.ScreenShake', 'GameEffects.FloatingText',
    'User32.RegisterWindowProc', 'User32.SetWindowText',
    'sfx select', 'sfx click', 'sfx drop', 'sfx error', 'sfx blip', 'sfx hit',
    'sfx pickup', 'sfx powerup', 'sfx zap',
    'store sz-fantasy-cards-highscores',
    'Dialog.show highScoresBackdrop', 'Dialog.show howToPlayBackdrop',
    'Dialog.show controlsBackdrop', 'Dialog.show dlg-about',
    'html highScoresBody',
    'text statusTurn', 'text statusMana', 'text statusDeck',
    'particles.burst', 'particles.sparkle', 'ftext', 'shake.trigger',
    'postMessage',
    'ctx.fillText Start Game', 'ctx.fillText Deck Builder', 'ctx.fillText End Turn'
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
