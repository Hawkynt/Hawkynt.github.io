/* The game namespace SZ.Pacman with one empty object per module, created up front so modules
   can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  const MODULES = ['constants', 'rng', 'worlds', 'items', 'treeData', 'cosmetics', 'goals', 'mazes', 'rules', 'seasons',
    'state', 'save', 'audio', 'fx', 'grid', 'pac', 'ghosts', 'boss', 'powerups', 'pickups', 'hazards', 'level', 'run',
    'autopilot', 'cinematics', 'sim', 'artKit', 'view', 'mazeArt', 'actorArt', 'itemArt', 'backdrop', 'fxRender',
    'world', 'hud', 'cineRender', 'kit', 'widgets', 'screens', 'statusBar', 'touch', 'title', 'map', 'tree',
    'wardrobe', 'goalsScreen', 'season', 'help', 'pause', 'results', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
