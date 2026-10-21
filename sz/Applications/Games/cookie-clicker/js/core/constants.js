/* The tuning constants: storage key, canvas size, loop clamps, save and offline
   windows, cost scaling, the number suffixes, the building-panel row layout, the
   milestone thresholds and confetti colors, and the big cookie's geometry. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  /* ── Constants ── */
  const STORAGE_KEY = 'sz-cookie-clicker';
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;
  const AUTO_SAVE_INTERVAL = 30 * 1000;
  const MAX_OFFLINE_SECONDS = 8 * 3600; // 28800
  const OFFLINE_EFFICIENCY = 0.5;
  const COST_SCALE = 1.15;
  const WM_THEMECHANGED = 0x031A;

  /* States */
  const STATE_PLAYING = 'PLAYING';

  /* Number suffixes */
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  /* Building row layout */
  const BLDG_PANEL_X = 420;
  const BLDG_PANEL_W = CANVAS_W - BLDG_PANEL_X - 10;
  const BLDG_ROW_H = 50;
  const BLDG_ROW_PAD = 5;
  const BLDG_ROW_TOTAL = BLDG_ROW_H + BLDG_ROW_PAD;
  const BLDG_HEADER_H = 40;
  const BLDG_VISIBLE_H = CANVAS_H - 20 - BLDG_HEADER_H;
  /* ── Milestone Confetti ── */
  const MILESTONES = [1e6, 1e9, 1e12, 1e15, 1e18, 1e21];
  const CONFETTI_COLORS = [
    { r: 255, g: 50, b: 50 },
    { r: 50, g: 255, b: 50 },
    { r: 50, g: 50, b: 255 },
    { r: 255, g: 215, b: 0 },
    { r: 255, g: 100, b: 255 }
  ];
  /* ── Draw Helpers ── */
  const COOKIE_CX = 200;
  const COOKIE_CY = 250;
  const COOKIE_R = 100;

  NS.constants = { STORAGE_KEY, CANVAS_W, CANVAS_H, MAX_DT, AUTO_SAVE_INTERVAL,
    MAX_OFFLINE_SECONDS, OFFLINE_EFFICIENCY, COST_SCALE, WM_THEMECHANGED, STATE_PLAYING,
    SUFFIXES, BLDG_PANEL_X, BLDG_PANEL_W, BLDG_ROW_H, BLDG_ROW_PAD, BLDG_ROW_TOTAL,
    BLDG_HEADER_H, BLDG_VISIBLE_H, COOKIE_CX, COOKIE_CY, COOKIE_R, MILESTONES, CONFETTI_COLORS };
})();
