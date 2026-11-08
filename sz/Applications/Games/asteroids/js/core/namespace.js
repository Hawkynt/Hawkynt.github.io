/* The game namespace SZ.Asteroids with one empty object per module, created up front so modules
   can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const MODULES = ['constants', 'rng', 'rockData', 'enemyData', 'powerData', 'campaign', 'treeData', 'cosmetics', 'goalData',
    'seasons', 'rules', 'save', 'audio', 'music',
    'grid', 'fx', 'ship', 'weapons', 'rocks', 'enemies', 'bosses', 'powerups', 'hazards', 'collision', 'waves', 'progress',
    'cinematics', 'snapshot', 'sim', 'bot',
    'artKit', 'rockArt', 'shipArt', 'enemyArt', 'propArt', 'view', 'backdrop', 'world', 'fxRender', 'cineRender',
    'kit', 'widgets', 'screens', 'hud', 'title', 'map', 'story', 'tree', 'wardrobe', 'goals', 'results', 'pause', 'help',
    'touch', 'statusBar', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
