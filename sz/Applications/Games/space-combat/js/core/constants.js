/* Fixed numbers: the 1280 x 720 view plane with the 720 x 720 arcade play field centred in it,
   the scroll speed, the simulation clock, pool and grid sizes, player handling, combo and feel
   timings, and the UI palette. Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,

    /* the play field: world units, drawn centred in the plane between the two HUD panels */
    PF_W: 720,
    PF_H: 720,
    PF_X: 280,
    SCROLL_SPEED: 70,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 2.5,

    /* spatial grid and pools */
    GRID_CELL: 120,
    MAX_PARTICLES: 2600,
    MAX_PLAYER_BULLETS: 700,
    MAX_ENEMY_BULLETS: 900,
    MAX_ENEMIES: 180,

    /* player handling (base values, the tree and ships scale them) */
    PLAYER_RADIUS: 18,
    PLAYER_HITBOX: 8,
    PLAYER_RESPONSE: 40,
    PLAYER_TOP: 130,
    FOCUS_MUL: 0.45,
    DASH_DIST: 150,
    DASH_TIME: 0.16,
    DASH_IFRAMES: 0.34,
    HIT_IFRAMES: 0.5,
    EXT_DECAY: 4.5,
    GRAZE_R: 22,

    /* enemy shots fly slower than in open space so patterns stay readable; bosses take longer to
       break because every shot from below finds them */
    ENEMY_SHOT_SPEED: 0.68,
    BOSS_HP: 1.6,

    /* combo: kills within the window keep the chain; multiplier steps */
    COMBO_WINDOW: 2.6,
    COMBO_STEPS: [0, 5, 12, 22, 36, 55, 80],

    /* feel */
    MAX_SHAKE: 22,

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
