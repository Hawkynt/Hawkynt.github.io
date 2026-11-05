/* The game namespace SZ.Snake with one empty object per module, created up front so modules
   can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  const MODULES = ['constants', 'rng', 'worlds', 'story', 'items', 'treeData', 'cosmetics', 'goals', 'seasons',
    'levels', 'rules', 'autopilot', 'save', 'audio',
    'fx', 'board', 'food', 'powerups', 'enemies', 'bosses', 'combat', 'snake', 'progress', 'run', 'cine', 'sim',
    'view', 'artKit', 'tileArt', 'snakeArt', 'itemArt', 'creatureArt', 'backdrop', 'world', 'fxRender', 'hud',
    'cineRender', 'kit', 'widgets', 'screens', 'title', 'map', 'tree', 'wardrobe', 'journal', 'results', 'help',
    'pause', 'touch', 'statusBar', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
