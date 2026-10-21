/* The game namespace SZ.SpaceMining with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* state and dom are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'data', 'world', 'economy', 'mining', 'ship', 'powerups',
    'hints', 'flow', 'os', 'background', 'entities', 'hud', 'overlays', 'scene',
    'input', 'highscores', 'menu', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
