;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * The canvas view: fits the 1280 x 720 logical view into the canvas,
   * letterboxed and DPR aware, and maps pointer positions into it.
   * Owns G.viewScale, G.viewOffX, G.viewOffY and G.dpr; resets G.layerKey
   * so the baked layer is redrawn at the new size.
   */

  const G = NS.G;
  const VIEW_W = NS.C.VIEW_W, VIEW_H = NS.C.VIEW_H;
  const canvas = G.canvas, ctx = G.ctx, Art = G.Art;

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    G.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * G.dpr);
    canvas.height = Math.round(cssH * G.dpr);
    G.viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    G.viewOffX = Math.round((canvas.width - VIEW_W * G.viewScale) / 2);
    G.viewOffY = Math.round((canvas.height - VIEW_H * G.viewScale) / 2);
    Art.setScale(G.viewScale);
    G.layerKey = '';
  }

  /* visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -G.viewOffX / G.viewScale, y0: -G.viewOffY / G.viewScale, x1: (canvas.width - G.viewOffX) / G.viewScale, y1: (canvas.height - G.viewOffY) / G.viewScale };
  }

  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
  }

  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - G.viewOffX) / G.viewScale, y: ((e.clientY - rect.top) * d - G.viewOffY) / G.viewScale };
  }

  G.visibleRect = visibleRect;

  NS.view = { setupCanvas: setupCanvas, visibleRect: visibleRect, beginFrame: beginFrame, pointerToView: pointerToView };
})();
