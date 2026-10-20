/* The game namespace SZ.Snake with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  /* state, dom and effects are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'rules', 'obstacles', 'ai', 'powerups',
    'themes', 'snakeview', 'board', 'game', 'highscores', 'options', 'menu', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
