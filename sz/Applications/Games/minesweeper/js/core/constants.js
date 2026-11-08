/* Tuning constants: the 1280 x 720 view plane and the board area in it, the classic difficulties
   (Beginner 9 x 9 with 10 mines, Intermediate 16 x 16 with 40, Expert 30 x 16 with 99 - the
   original sizes), the custom limits, the classic number colours, the powers, pool sizes, storage
   keys (including the old game's best times and statistics) and the UI palette. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});

  const DIFFS = {
    beginner: { id: 'beginner', name: 'Beginner', w: 9, h: 9, mines: 10 },
    intermediate: { id: 'intermediate', name: 'Intermediate', w: 16, h: 16, mines: 40 },
    expert: { id: 'expert', name: 'Expert', w: 30, h: 16, mines: 99 },
  };

  /* the classic colours of the numbers 1 to 8 */
  const NUMBERS = ['', '#1a3aff', '#2a8a2a', '#ff2a2a', '#1a1a8a', '#8a1a1a', '#1a8a8a', '#2a2a2a', '#8a8a8a'];

  const POWERS = [
    { id: 'scan', name: 'Scanner', desc: 'Opens a safe cell next to what you know', color: '#5ad0ff', icon: 'eye' },
    { id: 'sonar', name: 'Sonar', desc: 'Flags a mine next to what you know', color: '#ff9a3a', icon: 'ping' },
    { id: 'lantern', name: 'Lantern', desc: 'Lights a 3 x 3 area: safe cells open, mines get flags', color: '#ffd25a', icon: 'lamp' },
    { id: 'shield', name: 'Shield', desc: 'Survive one mine', color: '#c8a0ff', icon: 'shield' },
  ];
  const POWER_BY_ID = {};
  for (const p of POWERS) POWER_BY_ID[p.id] = p;

  const UI = {
    accent: '#7be08a', gold: '#ffd25a', good: '#7be08a', bad: '#ff6a6a', shard: '#8fe0ff', gem: '#ff7ad8', xp: '#c8a0ff',
    text: '#f0fff0', textDim: '#b0c8b0', textMute: '#6a806a', panelTop: 'rgba(24,46,34,0.94)', panelBottom: 'rgba(8,20,14,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  NS.constants = {
    VIEW_W: 1280, VIEW_H: 720, TAU: Math.PI * 2,
    BOARD_X0: 292, BOARD_X1: 988, BOARD_Y0: 72, BOARD_Y1: 692, CELL_MAX: 46, CELL_MIN: 14,
    DIFFS, NUMBERS, POWERS, POWER_BY_ID, UI,
    CUSTOM: { wMin: 9, wMax: 30, hMin: 9, hMax: 24, minMines: 10, maxDensity: 0.8 },
    MAX_POWERS: 3, LONG_PRESS: 0.42,
    STEP: 1 / 60, MAX_DT: 0.1, AUTOSAVE: 3,
    MAX_PARTICLES: 1000, MAX_TEXTS: 40, MAX_RINGS: 40,
    PROFILE_KEY: 'sz-minesweeper-profile', RUN_KEY: 'sz-minesweeper-run',
    LEGACY_TIMES_KEY: 'sz-minesweeper-best-times', LEGACY_STATS_KEY: 'sz-minesweeper-stats', SAVE_VERSION: 1,
  };
})();
