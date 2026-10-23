/* The canvas, its context and the window handle the controller queries at load time. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const D = NS.dom = NS.dom || {};

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  // variants capture the pointer that started a drag; remember its id
  canvas.addEventListener('pointerdown', (e) => { canvas.szPointerId = e.pointerId; }, true);
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const frame = canvas.parentElement;
    const fw = frame.clientWidth || K.CANVAS_W;
    const fh = frame.clientHeight || K.CANVAS_H;
    const scale = Math.min(fw / K.CANVAS_W, fh / K.CANVAS_H);
    const cssW = K.CANVAS_W * scale;
    const cssH = K.CANVAS_H * scale;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  D.canvas = canvas;
  D.ctx = ctx;
  D.User32 = User32;
  D.setupCanvas = setupCanvas;
})();
