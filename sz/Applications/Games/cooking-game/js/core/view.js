;(function() {
  'use strict';

  /* The game canvas and its 2D context, the shared drawing kit, and the
     mapping between the backing store and logical 1280 x 720 coordinates.
     Owns the view scale and offsets; reads nothing else. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const { VIEW_W, VIEW_H } = NS.C;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;
  const ui = SZ.KitchenUI.create(ctx);
  let viewScale = 1, viewOffX = 0, viewOffY = 0, dpr = 1; // backing-store mapping

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewOffX = Math.round((canvas.width - VIEW_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - VIEW_H * viewScale) / 2);
  }

  /* Visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -viewOffX / viewScale, y0: -viewOffY / viewScale, x1: (canvas.width - viewOffX) / viewScale, y1: (canvas.height - viewOffY) / viewScale };
  }

  /* Start of every frame: clear, then logical 1280 x 720 coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120c08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  /* Pointer event -> logical 1280 x 720 coordinates */
  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - viewOffX) / viewScale, y: ((e.clientY - rect.top) * d - viewOffY) / viewScale };
  }

  function fillVisibleRect() {
    const v = visibleRect();
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  NS.view = { canvas, ctx, User32, ui, setupCanvas, visibleRect, beginFrame, pointerToView,
    fillVisibleRect };

})();
