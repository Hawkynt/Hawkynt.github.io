/* The game namespace SZ.BubbleBobble with one empty object per function module,
   created up front so modules can keep references to modules that load after them.
   state and view are owned by their own modules, not pre-created here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  const MODULES = ['constants', 'rules', 'level', 'player', 'bubbles', 'enemies',
    'items', 'flow', 'scene', 'playerview', 'highscores', 'menu', 'input', 'os', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
