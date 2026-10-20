/* D, the long-lived page objects: the game canvas with its 2d context, the status
   bar displays, the high-score table body and the User32 handle. setupCanvas sizes
   the canvas to the frame, shrinking it for small windows but never growing it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const D = NS.dom = NS.dom || {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    statusLevel: document.getElementById('statusLevel'),
    statusGems: document.getElementById('statusGems'),
    statusMoves: document.getElementById('statusMoves'),
    highScoresBody: document.getElementById('highScoresBody'),
    User32: (SZ?.Dlls ?? {}).User32
  };
  D.ctx = D.canvas.getContext('2d');

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    // shrink the board to fit a small window (a phone), never grow it past its design size
    const frame = D.canvas.parentElement;
    const fit = frame ? Math.min(1, frame.clientWidth / C.CANVAS_W, frame.clientHeight / C.CANVAS_H) || 1 : 1;
    const cssW = Math.max(1, Math.floor(C.CANVAS_W * fit));
    const cssH = Math.max(1, Math.floor(C.CANVAS_H * fit));
    const dpr = window.devicePixelRatio || 1;
    D.canvas.width = Math.round(cssW * dpr);
    D.canvas.height = Math.round(cssH * dpr);
    D.canvas.style.width = cssW + 'px';
    D.canvas.style.height = cssH + 'px';
    D.ctx.setTransform(D.canvas.width / C.CANVAS_W, 0, 0, D.canvas.height / C.CANVAS_H, 0, 0);
  }

  Object.assign(NS.dom, { setupCanvas });
})();
