/* Fixed numbers: the 1280 x 720 view plane (which is also the wrapping play field), the
   simulation clock, pools, flight and weapon tuning, rock sizes, feel timings and the UI palette.
   Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    /* the toroidal play field: leaving one edge enters the opposite one */
    FIELD_W: 1280,
    FIELD_H: 720,
    TAU: Math.PI * 2,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 2.5,

    /* pools and broad phase */
    MAX_PARTICLES: 2200,
    MAX_ROCKS: 160,
    MAX_MOTES: 260,
    GRID_CELL: 96,

    /* flight */
    SHIP_R: 15,
    THRUST: 520,
    TURN: 4.6,
    DRAG: 0.55,
    MAX_SPEED: 560,
    INVULN: 2.4,
    HYPER_CD: 3,
    HYPER_TIME: 0.5,

    /* weapons */
    BULLET_SPEED: 720,
    BULLET_LIFE: 0.95,
    FIRE_DELAY: 0.16,
    BULLETS_MAX: 5,

    /* rocks: radius, base score, speed, debris per size class 1..3 (4 = colossal) */
    ROCK_R: [0, 15, 27, 46, 74],
    ROCK_SCORE: [0, 100, 50, 20, 10],
    ROCK_SPEED: [0, 92, 64, 44, 26],

    /* combo and overdrive */
    COMBO_WINDOW: 2.2,
    OVERDRIVE_PER_KILL: 0.045,
    OVERDRIVE_R: 270,

    /* autosave cadence while flying */
    AUTOSAVE_EVERY: 4,

    /* feel */
    MAX_SHAKE: 16,

    FONT: '"Segoe UI", "Trebuchet MS", Tahoma, Arial, sans-serif',
    MONO: 'Consolas, "Courier New", monospace',

    UI: {
      bg0: '#03050c',
      panelTop: 'rgba(18,24,46,0.94)',
      panelBottom: 'rgba(6,9,20,0.96)',
      accent: '#5ad8ff',
      accentDeep: '#1a6a9a',
      gold: '#ffd25a',
      goldDeep: '#c08a10',
      good: '#6dff9a',
      bad: '#ff5a6a',
      warn: '#ffb04a',
      text: '#e8f0ff',
      textDim: '#9fb0d0',
      textMute: '#5a6888',
      violet: '#c08aff',
    },
  });
})();
