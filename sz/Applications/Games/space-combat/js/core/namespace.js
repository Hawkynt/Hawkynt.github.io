/* The game namespace SZ.SpaceCombat with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  const MODULES = ['constants', 'rng', 'ships', 'enemyData', 'campaign', 'treeData', 'rules', 'save', 'audio',
    'grid', 'waves', 'fx', 'camera', 'player', 'weapons', 'projectiles', 'enemies', 'bosses', 'hazards',
    'pickups', 'combat', 'missions', 'sim', 'artKit', 'shipArt', 'enemyArt', 'propArt', 'backdropArt', 'view', 'backdrop', 'actors',
    'world', 'fxRender', 'hud', 'kit', 'widgets', 'screens', 'title', 'map', 'briefing', 'hangar', 'tree',
    'results', 'pause', 'help', 'touch', 'statusBar', 'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
