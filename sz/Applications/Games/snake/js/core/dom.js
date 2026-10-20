/* D, the long-lived page objects: the game canvas with its 2d context and the status
   bar displays. setupCanvas sizes the canvas to the configured field. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;

  const D = NS.dom = NS.dom || {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    statusScore: document.getElementById('statusScore'),
    statusLength: document.getElementById('statusLength'),
    statusLevel: document.getElementById('statusLevel'),
    statusEffects: document.getElementById('statusEffects')
  };
  D.ctx = D.canvas.getContext('2d');

  /* ---- Canvas Setup ---- */
  function setupCanvas() {
    const field = C.FIELD_SIZES[S.gameConfig.fieldSize] || C.FIELD_SIZES.medium;
    S.cols = field.cols;
    S.rows = field.rows;
    S.canvasW = S.cols * C.CELL;
    S.canvasH = S.rows * C.CELL;
    S.dpr = window.devicePixelRatio || 1;
    D.canvas.width = S.canvasW * S.dpr;
    D.canvas.height = S.canvasH * S.dpr;
    D.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  }

  Object.assign(NS.dom, { setupCanvas });
})();
