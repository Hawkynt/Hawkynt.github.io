/* Fixed numbers: the 1280 x 720 view plane, the simulation clock, pool and grid sizes, player
   handling, combo and feel timings, and the UI palette. Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 2.5,

    /* spatial grid and pools */
    GRID_CELL: 160,
    MAX_PARTICLES: 2600,
    MAX_PLAYER_BULLETS: 700,
    MAX_ENEMY_BULLETS: 900,
    MAX_ENEMIES: 180,

    /* player handling (base values, the tree and ships scale them) */
    PLAYER_RADIUS: 18,
    PLAYER_DRAG: 1.35,
    BOOST_MUL: 1.75,
    BOOST_HEAT_RATE: 0.42,
    BOOST_COOL_RATE: 0.3,
    OVERHEAT_RECOVER: 0.35,
    ROLL_IMPULSE: 620,
    ROLL_TIME: 0.42,
    ROLL_IFRAMES: 0.38,
    HIT_IFRAMES: 0.18,
    BOUNDARY_PUSH: 900,

    /* combo: kills within the window keep the chain; multiplier steps */
    COMBO_WINDOW: 2.6,
    COMBO_STEPS: [0, 5, 12, 22, 36, 55, 80],

    /* feel */
    MAX_SHAKE: 22,
    LOOK_AHEAD: 0.22,
    LOOK_VEL: 0.32,
    CAM_LERP: 7,

    /* radar */
    RADAR_R: 74,

    /* power-up durations */
    OVERCHARGE_TIME: 9,
    MAGNET_TIME: 12,
    PICKUP_LIFE: 16,

    FONT: '"Segoe UI", "Trebuchet MS", Tahoma, Arial, sans-serif',
    MONO: 'Consolas, "Courier New", monospace',

    UI: {
      bg0: '#050814',
      panelTop: 'rgba(22,32,58,0.94)',
      panelBottom: 'rgba(8,12,26,0.96)',
      line: 'rgba(120,170,255,0.35)',
      accent: '#4fc3ff',
      accentDeep: '#1478c8',
      gold: '#ffd25a',
      goldDeep: '#b8860b',
      text: '#e8f0ff',
      textDim: '#9fb0d0',
      textMute: '#5f6f8f',
      good: '#5cff9a',
      bad: '#ff5c6c',
      warn: '#ffb347',
      hull: '#ff6a5c',
      shield: '#58c8ff',
      heat: '#ffa040',
    },
  });
})();
