/* Canvas geometry, player and door sizes, the game-state names, the storage keys and
   the perspective-mode codes. Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants || (NS.constants = {});

  C.canvasW = 700;
  C.canvasH = 500;
  C.MAX_DT = 0.05;
  C.PLAYER_SPEED = 160;
  C.PLAYER_SIZE = 16;
  C.DOOR_W = 32;
  C.DOOR_H = 48;
  C.TILE = 40;

  /* ── Game states ── */
  C.STATE_READY = 'READY';
  C.STATE_EXPLORING = 'EXPLORING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  C.STORAGE_PREFIX = 'sz-mind-puzzle';
  C.STORAGE_PROGRESS = C.STORAGE_PREFIX + '-progress';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.MAX_HIGH_SCORES = 10;

  /* ── Perspective modes ── */
  C.VIEW_NORMAL = 0;
  C.VIEW_FLIPPED = 1;
  C.VIEW_ROTATED = 2;
})();
