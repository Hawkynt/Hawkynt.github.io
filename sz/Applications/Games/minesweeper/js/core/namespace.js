/* The game namespace SZ.Minesweeper with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});

  /* state and dom are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'data', 'store', 'menu', 'scale', 'marks', 'icons', 'dialogs',
    'led', 'flash', 'smiley', 'timer', 'grid', 'mines', 'effects', 'field', 'reveal', 'gameover',
    'game', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
