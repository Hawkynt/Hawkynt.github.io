/* C, the fixed game parameters: canvas and tile geometry, the movement and rotation
   speeds, the game-state names and the storage keys. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TILE_W = 96;
  const TILE_H = 48;
  const BOARD_ORIGIN_Y = 160;
  const PLAYER_SPEED = 6;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-illusion-puzzle';
  const STORAGE_PROGRESS = STORAGE_PREFIX + '-progress';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  Object.assign(NS.constants, {
    CANVAS_W, CANVAS_H, MAX_DT, TILE_W, TILE_H, BOARD_ORIGIN_Y, PLAYER_SPEED,
    STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_LEVEL_COMPLETE, STATE_GAME_OVER,
    STORAGE_PREFIX, STORAGE_PROGRESS, STORAGE_HIGHSCORES, MAX_HIGH_SCORES
  });
})();
