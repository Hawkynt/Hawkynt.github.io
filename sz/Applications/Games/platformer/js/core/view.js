/*
 * The canvas: a 1280 x 720 logical view, letterboxed into the window and devicePixelRatio aware, the
 * world zoom and the mapping of pointer events into view space.
 * Owns G.viewScale, G.viewOffX, G.viewOffY, G.dpr. Reads G.run (zoom, tile caches).
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, ZOOM } = NS.config;
  const canvas = G.canvas;
  const ctx = G.ctx;

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    G.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * G.dpr);
    canvas.height = Math.round(cssH * G.dpr);
    G.viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    G.viewOffX = Math.round((canvas.width - VIEW_W * G.viewScale) / 2);
    G.viewOffY = Math.round((canvas.height - VIEW_H * G.viewScale) / 2);
    if (G.run && G.run.tiles)
      G.run.tiles.setScale(bakeScale());
  }

  function bakeScale() {
    return Math.max(0.75, Math.min(1.5, G.viewScale * ZOOM));
  }

  /* the visible rect in world units relative to the camera */
  function zoomNow() {
    return G.run ? G.run.zoom : ZOOM;
  }

  function zoomRect(v) {
    const z = zoomNow();
    return { x0: v.x0 / z, y0: v.y0 / z, x1: v.x1 / z, y1: v.y1 / z };
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

  /* a scratch context for warming chunk caches without painting anything visible */
  let scratch = null;
  function bakeCtx() {
    if (!scratch) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      scratch = c.getContext('2d');
    }
    return scratch;
  }

  Object.assign(NS.module('view'), {
    setupCanvas,
    bakeScale,
    zoomNow,
    zoomRect,
    visibleRect,
    beginFrame,
    pointerToView,
    bakeCtx
  });
})();
