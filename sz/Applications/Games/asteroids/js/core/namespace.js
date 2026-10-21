/* The SZ.Asteroids namespace: every function module gets its empty object here,
   in the order the later modules fill them. State and DOM objects are owned by
   the modules that create them. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  NS.MODULES = [
    'constants', 'tables', 'rules', 'entities', 'zones', 'powerups', 'combo',
    'shockwaves', 'warp', 'shooting', 'destruction', 'collision', 'spawn', 'homing',
    'background', 'flow', 'os', 'starfield', 'shipView', 'asteroidView', 'bulletView',
    'enemyView', 'powerupView', 'zoneView', 'effectView', 'hud', 'screens', 'scene',
    'status', 'highscores', 'menu', 'input', 'app'
  ];
  for (const name of NS.MODULES)
    NS[name] = NS[name] || {};
})();
