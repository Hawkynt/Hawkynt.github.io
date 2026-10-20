/* The game namespace SZ.SpacePuzzle with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  /* state and dom are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'levels', 'rules', 'sky', 'scene', 'hud', 'board',
    'physics', 'highscores', 'game', 'menu', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
