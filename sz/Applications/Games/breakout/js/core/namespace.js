/* The game namespace SZ.Breakout with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  /* state, view and the level data are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'rules', 'effects', 'field', 'balls', 'bricks', 'powerups',
    'lasers', 'game', 'drawBricks', 'drawPaddle', 'drawPowerUps', 'scene', 'sim',
    'highscores', 'menu', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
