/* The game namespace SZ.IllusionPuzzle with one empty object per module, created up
   front so modules can keep references to modules that load after them. Owns nothing
   else: state, dom and effects are owned by their own modules, not pre-created here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});

  const MODULES = ['constants', 'levels', 'iso', 'rules', 'perspective', 'player',
    'objectives', 'persistence', 'level', 'game', 'highscores', 'statusbar', 'os',
    'palette', 'shapes', 'background', 'tiles', 'entities', 'hud', 'board',
    'menu', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
