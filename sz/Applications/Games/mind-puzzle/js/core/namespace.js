/* The game namespace SZ.MindPuzzle with one empty object per function module, created
   up front so modules can keep references to modules that load after them. The state,
   dom, effects and room-data objects are owned by their own modules, not pre-created
   here, so their `||` initializers actually run. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});

  const MODULES = ['constants', 'rules', 'persist', 'flow', 'primitives', 'scene', 'hud',
    'statusbar', 'input', 'menu', 'os', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
