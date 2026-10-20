/* Field size switching and zen mode: the derived brick metrics, the starfield
   rebuild, the menu check marks and the new game a size switch implies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const FX = NS.effects;

  /* ---- Field Size Switching ---- */
  function recalcFieldDerived() {
    S.BRICK_COLS = S.currentField.cols;
    S.BRICK_OFFSET_LEFT = (S.CANVAS_W - (S.BRICK_COLS * (C.BRICK_WIDTH + C.BRICK_PADDING) - C.BRICK_PADDING)) / 2;
  }

  function setFieldSize(preset) {
    if (preset === S.currentField)
      return;
    S.currentField = preset;
    S.CANVAS_W = preset.w;
    S.CANVAS_H = preset.h;
    recalcFieldDerived();
    FX.starfield = new SZ.GameEffects.Starfield(S.CANVAS_W, S.CANVAS_H, preset === C.FIELD_LARGE ? 150 : 80);
    V.applyCanvasSize();
    updateMenuChecks();
    NS.game.newGame();
    NS.app.requestWindowResize();
  }

  function toggleZenMode() {
    S.zenMode = !S.zenMode;
    updateMenuChecks();
    NS.game.updateStatus();
  }

  function updateMenuChecks() {
    const small = document.getElementById('menu-size-small');
    const large = document.getElementById('menu-size-large');
    if (small) small.classList.toggle('checked', S.currentField === C.FIELD_SMALL);
    if (large) large.classList.toggle('checked', S.currentField === C.FIELD_LARGE);
    const zen = document.getElementById('menu-zen');
    if (zen) zen.classList.toggle('checked', S.zenMode);
  }

  Object.assign(NS.field, { recalcFieldDerived, setFieldSize, toggleZenMode, updateMenuChecks });
})();
