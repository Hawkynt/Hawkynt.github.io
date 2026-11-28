/* The game namespace SZ.RhythmGame with one empty object per module, created up front so modules
   can hold references to modules that load after them. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const MODULES = ['constants', 'rng', 'songData', 'chart', 'engine', 'bot', 'worldData', 'storyData', 'metaData', 'seasons', 'progress',
    'save', 'audio', 'music', 'fx', 'conductor', 'play', 'cine', 'demo',
    'view', 'artKit', 'backdrop', 'notesArt', 'highway', 'actors', 'hud', 'fxRender', 'cineRender', 'frame',
    'kit', 'widgets', 'screens', 'title', 'map', 'library', 'shop', 'tree', 'wardrobe', 'journal', 'results', 'pause', 'settings', 'help',
    'input', 'statusBar', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
