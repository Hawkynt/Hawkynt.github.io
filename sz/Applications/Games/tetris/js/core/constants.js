/* Tuning constants: the 1280 x 720 view plane and the layout of the playfield, the board size
   (ten columns, twenty visible rows under two hidden spawn rows), guideline timings (gravity
   curve, lock delay and its resets, line-clear pause, DAS and ARR), the tetromino shapes and the
   SRS wall-kick tables (copied exactly from the Super Rotation System), guideline scoring, pool
   sizes, storage keys and the UI palette. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  const VIEW_W = 1280, VIEW_H = 720;
  const COLS = 10, ROWS = 22, HIDDEN = 2;
  const CELL = 30;
  const BOARD_X = 490, BOARD_Y = 64;

  /* rotation states as matrices (SRS spawn orientation first, then clockwise) */
  const SHAPES = {
    I: [[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]], [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]],
    O: [[[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]]],
    T: [[[0, 1, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 0], [0, 1, 0]]],
    S: [[[0, 1, 1], [1, 1, 0], [0, 0, 0]], [[0, 1, 0], [0, 1, 1], [0, 0, 1]], [[0, 0, 0], [0, 1, 1], [1, 1, 0]], [[1, 0, 0], [1, 1, 0], [0, 1, 0]]],
    Z: [[[1, 1, 0], [0, 1, 1], [0, 0, 0]], [[0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 0, 0], [1, 1, 0], [0, 1, 1]], [[0, 1, 0], [1, 1, 0], [1, 0, 0]]],
    J: [[[1, 0, 0], [1, 1, 1], [0, 0, 0]], [[0, 1, 1], [0, 1, 0], [0, 1, 0]], [[0, 0, 0], [1, 1, 1], [0, 0, 1]], [[0, 1, 0], [0, 1, 0], [1, 1, 0]]],
    L: [[[0, 0, 1], [1, 1, 1], [0, 0, 0]], [[0, 1, 0], [0, 1, 0], [0, 1, 1]], [[0, 0, 0], [1, 1, 1], [1, 0, 0]], [[1, 1, 0], [0, 1, 0], [0, 1, 0]]],
  };
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  /* board cell codes: 0 empty, 1-7 the piece types in TYPES order, 8 garbage, 9 crystal */
  const CODE = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7, garbage: 8, crystal: 9 };

  /* SRS wall kicks as [dx, dy] with y pointing up */
  const KICKS = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  /* guideline scoring, multiplied by the level */
  const SCORE = {
    lines: [0, 100, 300, 500, 800],
    tspin: [400, 800, 1200, 1600],
    mini: [100, 200, 400],
    perfect: [0, 800, 1200, 1800, 2000],
    b2b: 1.5, combo: 50, soft: 1, hard: 2,
  };

  const UI = {
    accent: '#5ad0ff', gold: '#ffd25a', good: '#7be08a', bad: '#ff6a6a', shard: '#8fe0ff', gem: '#ff7ad8', xp: '#c8a0ff',
    text: '#eef4ff', textDim: '#a8b8d8', textMute: '#6a7898', panelTop: 'rgba(24,34,62,0.94)', panelBottom: 'rgba(10,14,30,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  const COLORS = {
    I: '#3ad8f0', O: '#f6d43a', T: '#b45af0', S: '#5ae05a', Z: '#f0504a', J: '#4a72f0', L: '#f09a3a', garbage: '#8a8f9a', crystal: '#bfe8ff',
  };

  NS.constants = {
    VIEW_W, VIEW_H, TAU: Math.PI * 2, COLS, ROWS, HIDDEN, CELL, BOARD_X, BOARD_Y, SHAPES, TYPES, CODE, KICKS, KICKS_I, SCORE, UI, COLORS,
    LOCK_DELAY: 0.5, LOCK_RESETS: 15, CLEAR_TIME: 0.32, SPAWN_DELAY: 0.02, DAS: 0.15, ARR: 0.033, SOFT_FACTOR: 20,
    LINES_PER_LEVEL: 10, MAX_LEVEL: 30, NEXT_MAX: 5,
    STEP: 1 / 120, MAX_DT: 0.1, AUTOSAVE: 3,
    MAX_PARTICLES: 900, MAX_TEXTS: 40, MAX_RINGS: 40,
    PROFILE_KEY: 'sz-tetris-profile', RUN_KEY: 'sz-tetris-run', LEGACY_KEY: 'sz-tetris-high-scores',
    SAVE_VERSION: 1,
  };
})();
