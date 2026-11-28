/* Tuning constants: the 1280 x 720 view plane and the highway in it, the timing windows (Perfect 45 ms,
   Great 90 ms, Good 135 ms), judgement values and accuracy weights, the combo multiplier steps, the
   lane keys and colours, pool sizes, storage keys (including the old game's high scores) and the UI
   palette. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const UI = {
    accent: '#5af0ff', gold: '#ffd25a', good: '#7bf0a0', bad: '#ff5a7a', disc: '#ffc85a', crystal: '#c48aff', xp: '#8ab4ff',
    text: '#f4f0ff', textDim: '#b8b0d8', textMute: '#6e6890', panelTop: 'rgba(36,22,64,0.94)', panelBottom: 'rgba(12,6,28,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  NS.constants = {
    VIEW_W: 1280, VIEW_H: 720, TAU: Math.PI * 2,
    LANES: 4,
    /* the highway: hit line at HIT_Y, horizon at TOP_Y, widths at both ends */
    HW_X: 640, HIT_Y: 610, TOP_Y: 70, HW_BOTTOM: 520, HW_TOP: 150,
    LANE_COLORS: ['#ff4a8a', '#4ae0ff', '#7bff6a', '#ffcc3a'],
    KEYS: [['d', 'arrowleft'], ['f', 'arrowdown'], ['j', 'arrowup'], ['k', 'arrowright']],
    KEY_LABELS: ['D', 'F', 'J', 'K'],
    WINDOWS: { perfect: 0.045, great: 0.09, good: 0.135 },
    VALUES: { perfect: 300, great: 200, good: 100, hold: 60 },
    ACC: { perfect: 1, great: 0.7, good: 0.4, miss: 0 },
    MULT_STEPS: [10, 25, 50],
    LOOK: 1.6, /* seconds a note is on screen at scroll speed 5 */
    STEP: 1 / 60, MAX_DT: 0.1, AUTOSAVE: 3,
    MAX_PARTICLES: 900, MAX_TEXTS: 40, MAX_RINGS: 48,
    PROFILE_KEY: 'sz-rhythm-game-profile', RUN_KEY: 'sz-rhythm-game-run', LEGACY_SCORES_KEY: 'sz-rhythm-game-highscores', SAVE_VERSION: 1,
    UI,
  };
})();
