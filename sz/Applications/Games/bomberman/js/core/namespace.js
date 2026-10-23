/* The game namespace SZ.Bomberman with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  /* state and dom are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'data', 'arena', 'enemies', 'bombs', 'player', 'damage',
    'flow', 'sprites', 'scene', 'tutorial', 'input', 'highscores', 'menu', 'os', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
