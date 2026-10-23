;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION A: STORAGE & ACTIVE THEME STATE
   * ================================================================ */

  const STORAGE_TABLE = 'sz-card-games-table';
  const STORAGE_CARDBACK = 'sz-card-games-cardback';
  const STORAGE_CARDFACE = 'sz-card-games-cardface';
  const STORAGE_BACKCOLOR = 'sz-card-games-backcolor';

  const activeTheme = {
    table: 'green',
    cardBack: 'navy_diamonds',
    cardFace: 'french',
    customBackColor: '#1a237e'
  };

  function loadTheme() {
    try {
      const t = localStorage.getItem(STORAGE_TABLE);
      const b = localStorage.getItem(STORAGE_CARDBACK);
      const f = localStorage.getItem(STORAGE_CARDFACE);
      const c = localStorage.getItem(STORAGE_BACKCOLOR);
      if (t && CT.TABLE_THEMES[t]) activeTheme.table = t;
      if (b && CT.CARD_BACK_DESIGNS[b]) activeTheme.cardBack = b;
      if (f && CT.CARD_FACE_TEMPLATES[f]) activeTheme.cardFace = f;
      if (c) activeTheme.customBackColor = c;
    } catch (_) {}
  }

  function saveTheme() {
    try {
      localStorage.setItem(STORAGE_TABLE, activeTheme.table);
      localStorage.setItem(STORAGE_CARDBACK, activeTheme.cardBack);
      localStorage.setItem(STORAGE_CARDFACE, activeTheme.cardFace);
      localStorage.setItem(STORAGE_BACKCOLOR, activeTheme.customBackColor);
    } catch (_) {}
  }

  function setTheme(opts) {
    if (opts.table && CT.TABLE_THEMES[opts.table]) activeTheme.table = opts.table;
    if (opts.cardBack && CT.CARD_BACK_DESIGNS[opts.cardBack]) activeTheme.cardBack = opts.cardBack;
    if (opts.cardFace && CT.CARD_FACE_TEMPLATES[opts.cardFace]) activeTheme.cardFace = opts.cardFace;
    if (opts.customBackColor) activeTheme.customBackColor = opts.customBackColor;
    saveTheme();
  }

  CT.activeTheme = activeTheme;
  CT.loadTheme = loadTheme;
  CT.saveTheme = saveTheme;
  CT.setTheme = setTheme;

})();
