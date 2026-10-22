/* The game namespace SZ.FantasyCards with one empty object per module, created up front so
   modules can keep references to modules that load after them. State and DOM objects are
   owned by the modules that create them. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});

  const MODULES = ['constants', 'tables', 'util', 'deck', 'game', 'turn', 'ai', 'deckbuilder',
    'storage', 'cards', 'hud', 'screens', 'scene', 'status', 'menu', 'input', 'os', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
