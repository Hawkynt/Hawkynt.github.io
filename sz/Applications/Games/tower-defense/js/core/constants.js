/* core/constants.js -- grid size, tiers, game states, storage keys, wave timing, layout sizes and small pure helpers (clamp, number checks, seeded RNG, colour maths). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const _hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const MAX_DT = 0.05;
  const CELL = 32;
  const COLS = 25;
  const ROWS = 17;
  const MAX_TIER = 5;          // I-III linear, IV picks a branch, V masters it
  const BRANCH_TIER = 4;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_BUILD = 'BUILD';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_MAP_SELECT = 'MAP_SELECT';
  const STATE_RESEARCH = 'RESEARCH';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-tower-defense';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_SAVE_V1 = STORAGE_PREFIX + '-save-v1';
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const STORAGE_META = STORAGE_PREFIX + '-meta-v1';
  const MAX_HIGH_SCORES = 10;

  /* ── Wave timing ── */
  const WARNING_DURATION = 3;
  const AUTO_WAVE_DELAY = 1;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function num(v, fallback) {
    return isFiniteNumber(v) ? v : fallback;
  }

  // Small deterministic generator so a wave can be previewed before it starts
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TWO_PI = Math.PI * 2;
  const WORLD_W = COLS * CELL;
  const WORLD_H = ROWS * CELL;
  const TOP_H = 54;            // top HUD bar (UI units)
  const BOT_H = 92;            // build bar (UI units)

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function shade(hex, f) {
    const [r, g, b] = parseHex(hex);
    const k = (v) => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
    return '#' + [k(r), k(g), k(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  NS.constants = { MAX_DT, CELL, COLS, ROWS, MAX_TIER, BRANCH_TIER, STATE_READY, STATE_PLAYING, STATE_PAUSED,
      STATE_BUILD, STATE_GAME_OVER, STATE_MAP_SELECT, STATE_RESEARCH, STORAGE_HIGHSCORES, STORAGE_SAVE_V1,
      STORAGE_SAVE, STORAGE_META, MAX_HIGH_SCORES, WARNING_DURATION, AUTO_WAVE_DELAY, AUTOSAVE_INTERVAL,
      isFiniteNumber, num, makeRng, TWO_PI, WORLD_W, WORLD_H, TOP_H, BOT_H, clamp, parseHex, hexToRgba, shade };

})();
