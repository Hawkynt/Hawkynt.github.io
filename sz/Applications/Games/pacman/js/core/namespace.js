/* The game namespace SZ.Pacman with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  /* state, dom and effects are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'data', 'maze', 'entities', 'movement', 'pacman', 'ghosts', 'modes', 'collisions', 'powerups', 'boss', 'flow', 'pause', 'walltile', 'mazecache', 'mazeview', 'pacview', 'ghostview', 'fruitview', 'powerupview', 'bossview', 'intermission', 'overlay', 'scene', 'status', 'highscores', 'menu', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
