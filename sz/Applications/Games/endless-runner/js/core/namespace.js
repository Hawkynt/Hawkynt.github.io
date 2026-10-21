/* The game namespace SZ.EndlessRunner with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  /* state and view are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'rules', 'spawn', 'collision', 'flow', 'background',
    'entities', 'hud', 'scene', 'status', 'highscores', 'input', 'menu', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
