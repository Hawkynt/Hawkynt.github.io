/* The game namespace SZ.EndlessRunner with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  const MODULES = ['constants', 'rng', 'worlds', 'story', 'items', 'treeData', 'cosmetics', 'goals', 'seasons',
    'physics', 'orient', 'course', 'solver', 'rules', 'state', 'audio', 'music', 'save',
    'fx', 'stream', 'player', 'hazards', 'pickups', 'powers', 'bosses', 'progress', 'run', 'autopilot', 'cine', 'sim',
    'view', 'artKit', 'backdropArt', 'vertArt', 'backdrop', 'runnerArt', 'propArt', 'bossArt', 'world', 'actors', 'fxRender', 'hud',
    'cineRender', 'kit', 'widgets', 'screens', 'title', 'map', 'tree', 'wardrobe', 'journal', 'results', 'help',
    'pause', 'touch', 'statusBar', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
