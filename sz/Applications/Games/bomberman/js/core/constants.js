/* Every tunable number: the 1280 x 720 view plane and the arena placement in it, tile codes,
   the fixed simulation step, bomb, fire and movement tuning, scoring, autosave cadence,
   storage keys and the UI palette. Pure data; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  const COLS = 19, ROWS = 13, TILE = 48;
  const VIEW_W = 1280, VIEW_H = 720;

  Object.assign(NS.constants, {
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    COLS: COLS,
    ROWS: ROWS,
    TILE: TILE,
    ARENA_W: COLS * TILE,
    ARENA_H: ROWS * TILE,
    ARENA_X: (VIEW_W - COLS * TILE) / 2,
    ARENA_Y: 84,
    TAU: Math.PI * 2,

    /* fixed simulation step */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 1.2,

    /* tile codes: blocks and floor features share one layer */
    T_EMPTY: 0,
    T_HARD: 1,
    T_SOFT: 2,
    T_CRATE: 3,
    T_ICE: 4,
    T_BELT_U: 5,
    T_BELT_D: 6,
    T_BELT_L: 7,
    T_BELT_R: 8,
    T_TELE: 9,

    /* directions: 0 down, 1 up, 2 left, 3 right */
    DIRS: [[0, 1], [0, -1], [-1, 0], [1, 0]],

    /* bombs and fire */
    FUSE: 2.6,
    FUSE_MIN: 1.6,
    FIRE_TIME: 0.55,
    CHAIN_DELAY: 0.06,
    SLIDE_SPEED: 9,
    THROW_TIME: 0.45,
    MAX_BOMBS: 9,
    MAX_FIRE: 10,

    /* the player */
    SPEED_BASE: 3.6,
    SPEED_STEP: 0.42,
    SPEED_MAX: 7.2,
    LANE_ASSIST: 0.42,
    RESPAWN_INV: 2.4,
    DASH_TIME: 0.16,
    DASH_SPEED: 14,
    DASH_COOLDOWN: 2.4,
    SUPER_COST: 100,

    /* timed power-ups (seconds before the overclock perk) */
    FREEZE_TIME: 6,
    MAGNET_TIME: 12,
    CURSE_TIME: 10,
    SHIELD_HITS: 1,

    /* scoring and combo */
    COMBO_WINDOW: 2.4,
    COMBO_MAX: 8,
    ENEMY_POINTS: 100,
    BLOCK_POINTS: 10,
    LEVEL_TIME: 200,
    HURRY_INTERVAL: 9,

    /* persistence */
    SAVE_KEY: 'sz-bomberman-save-v2',
    RUN_KEY: 'sz-bomberman-run-v2',
    OLD_SCORES_KEY: 'sz-bomberman-highscores',
    OLD_TUTORIAL_KEY: 'sz-bomberman-tutorial-seen',
    AUTOSAVE_EVERY: 4,
    MAX_SCORES: 10,

    FONT: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
    UI: {
      text: '#fff6e8',
      textDim: '#c9b9a4',
      textMute: '#8a7c6c',
      accent: '#ffb347',
      gold: '#ffd84a',
      good: '#7cf08a',
      bad: '#ff6b5e',
      cool: '#6fd3ff',
      panelTop: 'rgba(52,34,40,0.95)',
      panelBottom: 'rgba(24,16,24,0.95)',
      ink: '#1b1020'
    }
  });
})();
