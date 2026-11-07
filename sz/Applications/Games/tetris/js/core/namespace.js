/* The game namespace SZ.Tetris with one empty object per module, created up front so modules
   can hold references to modules that load after them. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  const MODULES = ['constants', 'rng', 'engine', 'bot', 'progress', 'seasons', 'save', 'audio', 'music',
    'fx', 'boss', 'powers', 'run', 'play', 'cine', 'demo',
    'view', 'artKit', 'blocks', 'backdrop', 'boardRender', 'bossArt', 'hud', 'fxRender', 'cineRender', 'frame',
    'kit', 'widgets', 'screens', 'title', 'map', 'tree', 'wardrobe', 'journal', 'results', 'pause', 'help', 'input', 'statusBar', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
