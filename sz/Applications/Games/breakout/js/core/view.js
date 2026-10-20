/* V, the page objects and canvas plumbing: the canvas, its 2D context, the device
   pixel ratio, the game frame and the status bar cells; sizes and fits the canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const S = NS.state;

  NS.view = NS.view || {
    /* ---- Canvas Setup ---- */
    canvas: document.getElementById('gameCanvas'),
    dpr: window.devicePixelRatio || 1,
    gameFrame: document.querySelector('.game-frame'),

    /* ---- DOM ---- */
    statusScore: document.getElementById('statusScore'),
    statusLives: document.getElementById('statusLives'),
    statusLevel: document.getElementById('statusLevel')
  };
  const V = NS.view;
  V.ctx = V.canvas.getContext('2d');

  function applyCanvasSize() {
    V.canvas.width = S.CANVAS_W * V.dpr;
    V.canvas.height = S.CANVAS_H * V.dpr;
    V.canvas.style.aspectRatio = S.CANVAS_W + ' / ' + S.CANVAS_H;
    V.ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    fitCanvasToFrame();
  }

  function fitCanvasToFrame() {
    const fw = V.gameFrame.clientWidth;
    const fh = V.gameFrame.clientHeight;
    const aspect = S.CANVAS_W / S.CANVAS_H;
    let displayW, displayH;
    if (fw / fh > aspect) {
      displayH = fh;
      displayW = fh * aspect;
    } else {
      displayW = fw;
      displayH = fw / aspect;
    }
    V.canvas.style.width = Math.floor(displayW) + 'px';
    V.canvas.style.height = Math.floor(displayH) + 'px';
  }

  Object.assign(NS.view, { applyCanvasSize, fitCanvasToFrame });

  applyCanvasSize();
})();
