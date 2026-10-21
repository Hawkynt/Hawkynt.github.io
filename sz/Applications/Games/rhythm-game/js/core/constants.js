/* Tunables: canvas size, lane geometry, the timing windows that grade a hit,
   scoring values, scroll speed, state names, storage keys and the neon palette. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-rhythm-game';

  const laneWidth = 900 / (4 + 2);

  Object.assign(NS.constants, {
    CANVAS_W: 900,
    CANVAS_H: 640,
    MAX_DT: 0.05,

    /* ── Game states ── */
    STATE_SONG_SELECT: 'SONG_SELECT',
    STATE_PLAYING: 'PLAYING',
    STATE_PAUSED: 'PAUSED',
    STATE_RESULTS: 'RESULTS',

    STORAGE_PREFIX: STORAGE_PREFIX,
    STORAGE_HIGHSCORES: STORAGE_PREFIX + '-highscores',
    MAX_HIGH_SCORES: 20,

    /* ── Lane config ── */
    LANE_COUNT: 4,
    LANE_KEYS: ['d', 'f', 'j', 'k'],
    LANE_COLORS: ['#f44', '#4f4', '#44f', '#ff4'],
    LANE_LABELS: ['D', 'F', 'J', 'K'],
    laneWidth: laneWidth,
    LANE_START_X: laneWidth,
    HIT_ZONE_Y: 640 - 80,
    NOTE_RADIUS: 18,

    /* ── Timing windows (seconds) — generous for casual play ── */
    PERFECT_WINDOW: 0.07,
    GREAT_WINDOW: 0.14,
    GOOD_WINDOW: 0.22,
    MISS_WINDOW: 0.32,

    /* ── Scoring ── */
    SCORE_PERFECT: 300,
    SCORE_GREAT: 200,
    SCORE_GOOD: 100,

    /* ── Note scroll speed (pixels per second) — slower for readability ── */
    NOTE_SPEED: 260,

    /* ── Neon glow colors (brighter saturated versions of lane colors) ── */
    NEON_COLORS: ['#ff2255', '#22ff66', '#2266ff', '#ffee22'],
    NEON_GLOW_COLORS: ['#ff0044', '#00ff44', '#0044ff', '#ffdd00']
  });
})();
