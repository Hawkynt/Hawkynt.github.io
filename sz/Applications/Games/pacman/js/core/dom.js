;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom = NS.dom || {};
  const E = NS.effects;
  D.canvas = document.getElementById('gameCanvas');
  D.ctx = D.canvas.getContext('2d');
  D.dpr = 1;

  D.setupCanvas = function setupCanvas() {
    D.dpr = window.devicePixelRatio || 1;
    D.canvas.width = C.CANVAS_W * D.dpr;
    D.canvas.height = C.CANVAS_H * D.dpr;
    D.ctx.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);
    D.fitCanvasToFrame();
    const frame = document.querySelector('.game-frame');
    if (frame)
      new ResizeObserver(() => D.fitCanvasToFrame()).observe(frame);
  }

  D.fitCanvasToFrame = function fitCanvasToFrame() {
    const frame = document.querySelector('.game-frame');
    if (!frame)
      return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const aspect = C.CANVAS_W / C.CANVAS_H;
    let dw, dh;
    if (fw / fh > aspect) {
      dh = fh;
      dw = Math.floor(fh * aspect);
    } else {
      dw = fw;
      dh = Math.floor(fw / aspect);
    }
    D.canvas.style.width = dw + 'px';
    D.canvas.style.height = dh + 'px';
  }

})();
