/* The game namespace SZ.RhythmGame with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  /* state and dom are owned by their own modules, not pre-created here */
  const MODULES = ['constants', 'songs', 'audio', 'rules', 'scoring', 'song', 'flow',
    'lanes', 'notes', 'screens', 'board', 'highscores', 'status', 'menu', 'os', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
