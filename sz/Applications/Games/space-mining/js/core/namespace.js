/* The game namespace SZ.SpaceMining with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const MODULES = ['constants', 'rng', 'ores', 'ships', 'treeData', 'goals', 'rules', 'economy', 'save', 'audio',
    'grid', 'fx', 'camera', 'ship', 'asteroids', 'mining', 'hazards', 'pirates', 'drones', 'trip', 'cinematics', 'sim',
    'artKit', 'shipArt', 'rockArt', 'propArt', 'stationArt', 'backdropArt', 'view', 'backdrop', 'world', 'fxRender',
    'hud', 'cineRender', 'kit', 'widgets', 'screens', 'statusBar', 'touch', 'title', 'station', 'shipyard', 'map',
    'tree', 'help', 'pause', 'results', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
