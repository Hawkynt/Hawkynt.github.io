/* Fixed numbers: the 1280 x 720 view plane, the ground line, the runner's physics (gravity,
   jumps, slide, dash), speeds in metres per second and the pixels per metre, scoring and combo
   tiers, pool sizes, autosave cadence, storage keys (new and the old game's) and the UI palette.
   Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,

    /* the world: y grows downwards, the ground surface sits at GROUND_Y */
    GROUND_Y: 580,
    FALL_Y: 900,
    PX_PER_M: 48,
    PLAYER_SCREEN_X: 300,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,

    /* the runner's body and moves */
    PW: 34,
    PH: 72,
    PH_SLIDE: 34,
    GRAVITY: 2800,
    JUMP_V: 980,
    JUMP2_V: 860,
    MAX_FALL: 1500,
    DROP_V: 1500,
    CUT_V: 420,
    COYOTE: 0.09,
    BUFFER: 0.12,
    SLIDE_T: 0.6,
    DASH_T: 0.22,
    DASH_MUL: 1.8,
    DASH_CD: 1.6,
    SPRING_V: 1450,
    BOOST_T: 1.4,
    BOOST_MUL: 1.45,
    HIT_SHRINK: 5,

    /* speeds in m/s */
    ZEN_SPEED: 10,
    ARCADE_BASE: 10.5,
    ARCADE_MAX: 23,

    /* scoring */
    COIN_SCORE: 10,
    GEM_SCORE: 50,
    NEAR_SCORE: 25,
    SMASH_SCORE: 15,
    NEAR_GAP: 22,
    COMBO_WINDOW: 2.6,
    COMBO_TIERS: [0, 25, 60, 120, 200, 320],
    COMBO_MULS: [1, 1.5, 2, 3, 4, 5],

    /* the live course: how far ahead it is generated and behind it is kept */
    GEN_AHEAD: 3200,
    KEEP_BEHIND: 700,

    /* effects */
    MAX_PARTICLES: 1600,
    MAX_TEXTS: 40,
    MAX_RINGS: 32,
    MAX_SHAKE: 22,

    /* autosave cadence while playing, seconds */
    AUTOSAVE_EVERY: 3,
    GHOST_STEP: 32,

    SAVE_KEY: 'sz-endless-runner-save-v2',
    RUN_KEY: 'sz-endless-runner-run-v2',
    OLD_SCORES_KEY: 'sz-endless-runner-highscores',
    OLD_COINS_KEY: 'sz-endless-runner-coins',
    OLD_TUTORIAL_KEY: 'sz-endless-runner-tutorial-seen',
    MAX_HIGH_SCORES: 10,

    FONT: '"Segoe UI", "Trebuchet MS", Tahoma, Arial, sans-serif',
    TITLE_FONT: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',

    UI: {
      panelTop: 'rgba(24,26,52,0.94)',
      panelBottom: 'rgba(10,10,26,0.96)',
      accent: '#5ee0ff',
      accentDeep: '#1f6f9a',
      gold: '#ffd24a',
      goldDeep: '#b8860b',
      text: '#f2f4ff',
      textDim: '#a8b0d8',
      textMute: '#6a7096',
      good: '#7cff9a',
      bad: '#ff5a6a',
      warn: '#ffb347',
      hot: '#ff6ad5',
      violet: '#b48cff',
    },
  });
})();
