/* The game namespace SZ.BoulderDash with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  const MODULES = [
    'constants', 'rng', 'story', 'items', 'meta', 'progression', 'save', 'music',
    'levels', 'cavegen', 'solver', 'physics', 'creatures', 'boss', 'player', 'run', 'fx', 'sim', 'bot',
    'view', 'artKit', 'tileArt', 'spriteArt', 'backdrop', 'world', 'fxRender', 'hud', 'frame',
    'creatureArt', 'kit', 'screens', 'title', 'map', 'cinema', 'tree', 'wardrobe', 'journal', 'overlays', 'help',
    'input', 'touch', 'dom', 'app'
  ];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
