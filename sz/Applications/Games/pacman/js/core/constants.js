/* Fixed numbers: the 1280 x 720 view plane and where the maze sits on it, the simulation clock,
   tile and direction codes, base speeds and timings, scoring, pool sizes and the UI palette.
   Owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  const COLS = 28, ROWS = 31, TILE = 22;

  Object.assign(NS.constants, {
    VIEW_W: 1280,
    VIEW_H: 720,
    TAU: Math.PI * 2,
    FONT: '"Trebuchet MS", "Segoe UI", Tahoma, Verdana, sans-serif',

    /* fixed 60 Hz simulation, at most 5 catch-up steps after a stall */
    STEP: 1 / 60,
    STEP_MS: 1000 / 60,
    MAX_STEPS: 5,
    STEP_SNAP_MS: 2.5,

    /* the maze grid and its place on the plane */
    COLS: COLS,
    ROWS: ROWS,
    TILE: TILE,
    MAZE_W: COLS * TILE,
    MAZE_H: ROWS * TILE,
    MAZE_X: Math.round((1280 - COLS * TILE) / 2),
    MAZE_Y: Math.round((720 - ROWS * TILE) / 2),

    /* wall codes */
    W_OPEN: 0,
    W_WALL: 1,
    W_HOUSE: 2,
    W_GATE: 3,

    /* dot codes */
    D_NONE: 0,
    D_DOT: 1,
    D_POWER: 2,

    /* feature codes (tile twists) */
    F_NONE: 0,
    F_PAD_L: 1,
    F_PAD_U: 2,
    F_PAD_R: 3,
    F_PAD_D: 4,
    F_TAFFY: 5,
    F_PORTAL: 6,
    F_VENT: 7,
    F_ICE: 8,

    /* directions: left, up, right, down */
    DX: [-1, 0, 1, 0],
    DY: [0, -1, 0, 1],
    NONE: -1,

    /* the ghost house (identical in every maze) */
    DOOR: { x: 13, y: 11 },
    HOUSE_SLOTS: [{ x: 14, y: 11.5 }, { x: 14, y: 14.5 }, { x: 12, y: 14.5 }, { x: 16, y: 14.5 }],
    HOUSE_CENTER: { x: 14, y: 14.5 },
    PAC_START: { x: 14, y: 23.5 },

    /* speeds in tiles per second */
    PAC_SPEED: 7.6,
    GHOST_SPEED: 6.9,
    FRIGHT_SPEED: 4.3,
    EYES_SPEED: 15,
    TUNNEL_SPEED: 3.9,

    /* classic scatter/chase rhythm (seconds) */
    MODE_TIMES: [7, 20, 7, 20, 5, 20, 5, Infinity],

    /* scoring */
    DOT_POINTS: 10,
    POWER_POINTS: 50,
    GHOST_POINTS: [200, 400, 800, 1600],
    EXTRA_LIFE_EVERY: 10000,
    CHAIN_WINDOW: 0.55,
    MULT_STEPS: [0, 20, 50, 90, 140, 200, 280, 380],

    /* pools */
    MAX_PARTICLES: 1400,
    MAX_FLOATERS: 40,

    /* autosave cadence while playing (seconds) */
    AUTOSAVE_EVERY: 4,

    UI: {
      text: '#eef2ff',
      textDim: '#9aa6cc',
      textMute: '#5c6688',
      accent: '#ffd23a',
      accent2: '#4ad8ff',
      good: '#5cff9a',
      bad: '#ff5a6a',
      gold: '#ffcc33',
      goldDeep: '#b07a00',
      shard: '#7af0ff',
      token: '#ff9ad8',
      panelTop: 'rgba(24,22,58,0.94)',
      panelBottom: 'rgba(8,8,26,0.96)',
    },
  });
})();
