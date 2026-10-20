/* Tunables, game-state names and storage keys — the numbers that define how the
   probe flies, how levels are rated and where scores are kept. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  /* Storage */
  const STORAGE_PREFIX = 'sz-space-puzzle';

  Object.assign(NS.constants, {
    CANVAS_W: 640,
    CANVAS_H: 480,
    MAX_DT: 0.05,
    LAUNCH_SPEED_SCALE: 3.5,
    OBJECT_RADIUS: 10,
    GOAL_RADIUS: 20,
    WELL_VISUAL_SCALE: 2.5,
    TRAIL_MAX_LENGTH: 40,
    STAR_COUNT: 120,
    CONFETTI_COLORS: ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0', '#f44', '#44f', '#4f4'],

    /* States */
    STATE_READY: 'READY',
    STATE_PLAYING: 'PLAYING',
    STATE_PAUSED: 'PAUSED',
    STATE_AIMING: 'AIMING',
    STATE_LAUNCHED: 'LAUNCHED',
    STATE_SOLVED: 'SOLVED',
    STATE_GAME_OVER: 'GAME_OVER',

    STORAGE_PREFIX: STORAGE_PREFIX,
    STORAGE_HIGHSCORES: STORAGE_PREFIX + '-highscores',
    MAX_HIGH_SCORES: 5
  });
})();
