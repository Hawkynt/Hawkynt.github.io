/* Fixed numbers: the 1280 x 720 view plane, the simulation clock, pool and grid sizes, flight,
   mining and cargo tuning, feel timings and the UI palette. Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 2.5,

    /* world, spatial grid and pools */
    WORLD_W: 6400,
    WORLD_H: 4600,
    GRID_CELL: 192,
    MAX_PARTICLES: 2600,
    MAX_ROCKS: 460,
    MAX_NUGGETS: 420,
    ROCK_RADII: [0, 16, 30, 52, 84],

    /* flight */
    SHIP_R: 20,
    SHIP_DRAG: 0.42,
    BOOST_MUL: 1.9,
    BOUNDARY_PUSH: 700,
    COLLIDE_DMG: 0.05,

    /* mining */
    LASER_RANGE: 300,
    TRACTOR_RANGE: 170,
    COLLECT_R: 26,
    NUGGET_LIFE: 40,
    DOCK_R: 110,
    DOCK_SPEED: 260,

    /* feel */
    MAX_SHAKE: 18,
    CAM_LERP: 6,
    LOOK_VEL: 0.38,
    LOOK_AIM: 0.16,
    RADAR_R: 78,

    FONT: '"Segoe UI", "Trebuchet MS", Tahoma, Arial, sans-serif',
    MONO: 'Consolas, "Courier New", monospace',

    UI: {
      bg0: '#04070f',
      panelTop: 'rgba(20,30,44,0.94)',
      panelBottom: 'rgba(7,11,18,0.96)',
      line: 'rgba(255,190,110,0.32)',
      accent: '#ffb44a',
      accentDeep: '#b8661a',
      cyan: '#4fd8ff',
      gold: '#ffd25a',
      goldDeep: '#b8860b',
      text: '#eef3ff',
      textDim: '#a4b2c8',
      textMute: '#5f6d84',
      good: '#5cff9a',
      bad: '#ff5c6c',
      warn: '#ffb347',
      hull: '#ff6a5c',
      shield: '#58c8ff',
      fuel: '#ffc84a',
      data: '#b48aff',
    },
  });
})();
