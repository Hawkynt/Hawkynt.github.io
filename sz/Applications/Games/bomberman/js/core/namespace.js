/* The game namespace SZ.Bomberman with one empty object per module, created up front so a
   module can keep a reference to a module that loads after it. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  const MODULES = [
    'constants', 'rng', 'story', 'content', 'meta', 'season', 'rules', 'save',
    'levelgen', 'arena', 'fx', 'bombs', 'items', 'player', 'enemies', 'bosses', 'run', 'tracker', 'sim',
    'view', 'artKit', 'icons', 'tileArt', 'actorArt', 'bossArt', 'itemArt', 'backdrop', 'world', 'fxRender', 'hud', 'cineRender', 'frame',
    'kit', 'screens', 'title', 'modes', 'map', 'cine', 'tree', 'wardrobe', 'goals', 'stats', 'results', 'pause', 'help',
    'input', 'touch', 'statusBar', 'app'
  ];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
