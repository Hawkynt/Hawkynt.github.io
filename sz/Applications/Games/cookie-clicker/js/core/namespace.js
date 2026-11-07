/* The game namespace SZ.CookieClicker with one empty object per module, created up front so
   modules can hold references to modules that load after them. Pure data tables and the
   state object are owned by their own files. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const MODULES = ['constants', 'rng', 'format', 'calendar', 'economy', 'save', 'audio', 'music',
    'production', 'clicking', 'golden', 'purchasing', 'progression', 'prestige', 'garden', 'trials', 'modes', 'cinematics', 'fx',
    'view', 'artKit', 'planetArt', 'treatArt', 'buildingArt', 'gardenArt', 'sceneRender', 'backdrop', 'fxRender', 'hud', 'cineRender', 'frame',
    'kit', 'widgets', 'store', 'screens', 'title', 'tree', 'collection', 'journal', 'gardenUi', 'pause', 'input', 'statusBar', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
