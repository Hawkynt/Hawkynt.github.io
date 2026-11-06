/* Tuning constants: the 1280 x 720 view plane and its layout regions, loop clamps, save and
   offline windows, cost scaling, combo and golden-event timing and the UI palette. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const TAU = Math.PI * 2;

  /* layout regions of the bakery screen */
  const LAYOUT = {
    treatX: 232, treatY: 372, treatR: 132,
    sceneX: 470, sceneY: 92, sceneW: 440, sceneH: 560, rowH: 92,
    storeX: 924, storeY: 92, storeW: 344, storeH: 616,
    topH: 78,
  };

  const UI = {
    accent: '#e8a64a', gold: '#ffd25a', good: '#7be08a', bad: '#ff6a6a', notes: '#8fd0ff', crystal: '#e59cff',
    text: '#fff3e0', textDim: '#d8bfa0', textMute: '#8d7660', panelTop: 'rgba(58,36,24,0.94)', panelBottom: 'rgba(30,18,12,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  NS.constants = {
    VIEW_W, VIEW_H, TAU, LAYOUT, UI,
    STORAGE_KEY: 'sz-cookie-clicker-save',
    LEGACY_KEY: 'sz-cookie-clicker',
    SAVE_VERSION: 2,
    MAX_DT: 0.1,
    AUTOSAVE_SECONDS: 5,
    OFFLINE_BASE_HOURS: 8,
    OFFLINE_BASE_EFFICIENCY: 0.5,
    OFFLINE_MIN_SECONDS: 30,
    COST_SCALE: 1.15,
    SELL_BACK: 0.25,
    COMBO_WINDOW: 1.1,
    COMBO_BASE_CAP: 50,
    GOLDEN_MIN: 70,
    GOLDEN_MAX: 170,
    GOLDEN_LIFE: 13,
    BAKEOFF_SECONDS: 180,
    BAKEOFF_SPEED: 12,
    BUY_STEPS: [1, 10, 100, -1],
  };
})();
