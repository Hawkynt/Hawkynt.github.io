/* The game namespace SZ.SpaceMining with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const MODULES = ['constants', 'rng', 'ores', 'ships', 'treeData', 'goals', 'colonyData', 'fleetData', 'eventData', 'opsData', 'weaponData', 'syndicateData', 'ops', 'tiers', 'skill', 'budget', 'pacing', 'combat', 'fuel', 'escort', 'syndicate', 'rules',
    'economy', 'supply', 'colony', 'trade', 'production', 'outbreak', 'calendar', 'cosmeticData', 'cosmetics', 'save', 'saveFile', 'audio', 'music',
    'grid', 'fx', 'camera', 'ship', 'asteroids', 'mining', 'hazards', 'pirates', 'drones', 'formations', 'orders', 'base',
    'supplies', 'turrets', 'hardpoints', 'freighters', 'units', 'abilities', 'aiBase', 'allies', 'enemies', 'waves', 'life', 'refuel', 'events', 'operation', 'command', 'resume', 'trip', 'cinematics', 'sim',
    'artKit', 'shipArt', 'rockArt', 'propArt', 'stationArt', 'backdropArt', 'colonyArt', 'fleetArt', 'view', 'backdrop',
    'world', 'baseRender', 'fleetRender', 'fxRender', 'weaponRender', 'escortRender', 'abilityRender', 'opHud', 'hud', 'cineRender', 'kit', 'widgets', 'screens', 'statusBar', 'touch',
    'title', 'station', 'shipyard', 'hangar', 'colonies', 'supplyUi', 'saveUi', 'map', 'tree', 'help', 'pause', 'results', 'commandHud', 'buildMenu', 'selPanel',
    'frame', 'commandInput', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
