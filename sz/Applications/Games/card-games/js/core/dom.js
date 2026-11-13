/* The canvas, its context and the letterboxed view: the canvas fills the whole
   window, the 900x600 logical board is centred and scaled to fit, and the table
   scenery bleeds into the bars. Converts pointer positions to board space. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const D = NS.dom = NS.dom || {};

  const canvas = document.getElementById('gameCanvas');
  // variants capture the pointer that started a drag; remember its id
  canvas.addEventListener('pointerdown', (e) => { canvas.szPointerId = e.pointerId; }, true);
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  /* scale/offset of the logical board inside the canvas, in CSS pixels */
  const view = D.view = { scale: 1, ox: 0, oy: 0, cssW: K.CANVAS_W, cssH: K.CANVAS_H, dpr: 1 };

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const frame = canvas.parentElement;
    const fw = Math.max(1, frame.clientWidth || K.CANVAS_W);
    const fh = Math.max(1, frame.clientHeight || K.CANVAS_H);
    /* the board plus the toolbar band above it must fit; the board starts below the band */
    const band = K.TOOLBAR_H || 0;
    const scale = Math.min(fw / K.CANVAS_W, fh / (K.CANVAS_H + band));
    view.scale = scale;
    view.cssW = fw;
    view.cssH = fh;
    view.ox = (fw - K.CANVAS_W * scale) / 2;
    view.oy = (fh - (K.CANVAS_H + band) * scale) / 2 + band * scale;
    view.dpr = dpr;
    canvas.style.width = fw + 'px';
    canvas.style.height = fh + 'px';
    canvas.width = Math.round(fw * dpr);
    canvas.height = Math.round(fh * dpr);
    if (SZ.CardEngine) SZ.CardEngine.pixelScale = scale * dpr;
    applyBoard();
  }

  /* board space: 900x600 logical units */
  function applyBoard() {
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
  }

  /* the visible area in board units (wider/taller than the board in the bars) */
  function extent() {
    const s = view.scale || 1;
    return { x: -view.ox / s, y: -view.oy / s, w: view.cssW / s, h: view.cssH / s };
  }

  function toBoard(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? view.cssW / rect.width : 1;
    const sy = rect.height ? view.cssH / rect.height : 1;
    return {
      x: ((clientX - rect.left) * sx - view.ox) / view.scale,
      y: ((clientY - rect.top) * sy - view.oy) / view.scale
    };
  }

  D.canvas = canvas;
  D.ctx = ctx;
  D.User32 = User32;
  D.setupCanvas = setupCanvas;
  D.applyBoard = applyBoard;
  D.extent = extent;
  D.toBoard = toBoard;
})();
