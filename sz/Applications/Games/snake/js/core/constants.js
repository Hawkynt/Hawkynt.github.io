/* Fixed numbers: the 1280 x 720 view plane and the 30 x 17 board inside it, the simulation
   clock, snake and combo timings, pool sizes, storage keys and the UI palette and fonts.
   Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,

    /* the board: cells of 38 plane pixels, centred below the HUD strip */
    COLS: 30,
    ROWS: 17,
    CELL: 38,
    BX: 70,
    BY: 64,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,

    /* the snake */
    START_LEN: 4,
    INPUT_QUEUE: 3,
    RESPAWN_IFRAMES: 2.2,
    DEATH_TIME: 1.3,

    /* scoring */
    COMBO_WINDOW: 3.2,
    COMBO_PER_STEP: 3,
    COMBO_STEP_MUL: 0.5,
    COMBO_CAP: 4,
    FOOD_SCORE: 10,

    /* power-ups on the field */
    POWER_LIFE: 12,
    POWER_BLINK: 3,
    POWER_EVERY: 10,

    /* effects */
    MAX_PARTICLES: 1400,
    MAX_TEXTS: 40,
    MAX_RINGS: 40,
    MAX_SHAKE: 18,

    /* autosave cadence while playing, seconds */
    AUTOSAVE_EVERY: 3,

    SAVE_KEY: 'sz-snake-save-v2',
    RUN_KEY: 'sz-snake-run-v2',
    OLD_SCORES_KEY: 'sz-snake-high-scores',
    OLD_CONFIG_KEY: 'sz-snake-config',
    MAX_HIGH_SCORES: 10,

    FONT: '"Segoe UI", "Trebuchet MS", Tahoma, Arial, sans-serif',
    TITLE_FONT: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',

    UI: {
      panelTop: 'rgba(22,40,30,0.94)',
      panelBottom: 'rgba(8,18,14,0.96)',
      accent: '#7ee07a',
      accentDeep: '#2e8b3e',
      gold: '#ffd25a',
      goldDeep: '#b8860b',
      text: '#eef8ea',
      textDim: '#a8c4a6',
      textMute: '#62786a',
      good: '#7cff9a',
      bad: '#ff6a6a',
      warn: '#ffb347',
      sky: '#6fd3ff',
      violet: '#c08cff',
    },
  });
})();
