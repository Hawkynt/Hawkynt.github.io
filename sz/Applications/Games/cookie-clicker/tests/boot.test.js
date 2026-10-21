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

/* A fat save pre-seeded into localStorage: it exercises the full load path, the
   offline-progress branch and gives enough lifetime cookies for a real prestige. */
const SEED_SAVE = {
  cookies: 5e14,
  cookiesBaked: 9e14,
  cookiesBakedAllTime: 1e15,
  totalClicks: 1234,
  clickMultiplier: 2,
  globalMultiplier: 1.1,
  heavenlyChips: 3,
  prestigeCount: 1,
  buildings: {
    cursor: 100, grandma: 50, farm: 50, mine: 25, factory: 10, bank: 5, temple: 2,
    'wizard-tower': 1, shipment: 1, 'alchemy-lab': 1, portal: 1, 'time-machine': 1,
    condenser: 1, prism: 1
  },
  buildingMultipliers: {
    cursor: 4, grandma: 2, farm: 2, mine: 2, factory: 2, bank: 2, temple: 1,
    'wizard-tower': 1, shipment: 1, 'alchemy-lab': 1, portal: 1, 'time-machine': 1,
    condenser: 1, prism: 1
  },
  upgradePurchased: {
    u01: true, u02: true, u03: true, u04: true, u05: true, u07: true,
    u10: true, u13: true, u16: true, u20: true, u23: true
  },
  achievementUnlocked: { a01: true, a02: true, a11: true, a16: true },
  lastMilestone: 1e12,
  lastSaveTime: 1
};

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 7, startClock: 100000, dialogResult: 'ok' });
  game.window.localStorage.setItem('sz-cookie-clicker', JSON.stringify(SEED_SAVE));
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  const canvas = game.document.getElementById('gameCanvas');
  canvas.clientWidth = 800;
  canvas.clientHeight = 600;

  /* offline progress, welcome-back text, first achievement/milestone sweeps */
  game.frames(70);

  /* click the big cookie */
  for (let i = 0; i < 25; ++i) { game.pointer('pointerdown', 200, 250); game.frames(3); }

  /* hover a building row, then buy cursor, grandma, farm and bank */
  game.pointer('pointermove', 600, 75); game.frames(4);
  game.pointer('pointerdown', 600, 75); game.frames(2);
  game.pointer('pointerdown', 600, 130); game.frames(2);
  game.pointer('pointerdown', 600, 185); game.frames(2);
  game.pointer('pointerdown', 600, 350); game.frames(2);

  /* scroll the buildings panel down, buy the condenser, fail the prism, scroll back */
  for (let i = 0; i < 5; ++i)
    game.dispatch('wheel', { type: 'wheel', clientX: 600, clientY: 300, deltaY: 120, preventDefault() {} });
  game.frames(3);
  game.pointer('pointerdown', 600, 505); game.frames(2);
  game.pointer('pointerdown', 600, 560); game.frames(2);
  for (let i = 0; i < 5; ++i)
    game.dispatch('wheel', { type: 'wheel', clientX: 600, clientY: 300, deltaY: -120, preventDefault() {} });
  game.frames(3);

  /* hover an upgrade slot and buy three upgrades */
  game.pointer('pointermove', 210, 474); game.frames(3);
  game.pointer('pointerdown', 80, 474); game.frames(2);
  game.pointer('pointerdown', 210, 474); game.frames(2);
  game.pointer('pointerdown', 80, 529); game.frames(2);

  /* hover the cookie, then leave the canvas */
  game.pointer('pointermove', 200, 250); game.frames(3);
  game.dispatch('pointerleave', { type: 'pointerleave', preventDefault() {} });
  game.frames(3);

  /* dialogs and a real prestige through the menu */
  game.SZ.MenuBar.onAction('controls'); await game.settle();
  game.SZ.MenuBar.onAction('about'); await game.settle();
  game.SZ.MenuBar.onAction('prestige'); await game.settle();
  game.frames(30);

  /* rebuild from nothing: click up, buy a cursor, buy the first upgrade, miss a cost */
  for (let i = 0; i < 120; ++i) { game.pointer('pointerdown', 200, 250); game.frames(1); }
  game.pointer('pointerdown', 600, 75); game.frames(2);
  game.pointer('pointerdown', 80, 474); game.frames(2);
  game.pointer('pointerdown', 80, 474); game.frames(2);

  /* long idle run: production ticks, achievement sweeps and the 30s auto-save */
  game.frames(1900);

  /* blur saves, resize re-scales the canvas */
  game.dispatch('blur', { type: 'blur' });
  game.dispatch('resize', { type: 'resize' });
  game.frames(10);

  /* F2 new game, click a little, then New Game through the menu */
  game.key('F2'); game.frames(60);
  for (let i = 0; i < 10; ++i) { game.pointer('pointerdown', 200, 250); game.frames(2); }
  game.SZ.MenuBar.onAction('new'); game.frames(30);
  game.key('Escape');
  game.SZ.MenuBar.onAction('save');
  game.SZ.MenuBar.onAction('exit');
  game.frames(20);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  /* the session must walk the rich paths: clicks, purchases, a failed purchase,
     scrolling, upgrades, offline progress, prestige, achievements, milestones,
     auto-save, dialogs, OS integration and exit */
  const markers = ['sfx bounce', 'sfx coin', 'sfx powerup', 'sfx error', 'sfx win', 'sfx levelup',
    'store sz-cookie-clicker', 'Welcome back!', 'heavenly chips', 'text prestigeInfo',
    'Dialog.show prestigeBackdrop', 'Dialog.show controlsBackdrop', 'Dialog.show dlg-about',
    'Dialog.wireAll', 'User32.RegisterWindowProc', 'User32.SetWindowText Cookie Clicker',
    'User32.DestroyWindow', 'GameAudio.attachMuteButton', 'particles.burst', 'text.add',
    'scroll down', 'ctx.setTransform'];
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
