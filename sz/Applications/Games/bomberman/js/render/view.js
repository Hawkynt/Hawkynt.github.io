/* The canvas and its 2D context: fits the 1280 x 720 view plane into the window (letterboxed,
   with the scenery filling every extra pixel), follows resize and maximize, caps the backing
   resolution so big windows stay fast, and maps pointer positions into the plane.
   Owns the canvas size, scale and offsets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const { VIEW_W, VIEW_H } = NS.constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const v = { cssW: VIEW_W, cssH: VIEW_H, dpr: 1, scale: 1, ox: 0, oy: 0 };
  const rect = { x0: 0, y0: 0, x1: VIEW_W, y1: VIEW_H, w: VIEW_W, h: VIEW_H };

  function resize() {
    const parent = canvas.parentElement;
    const cs = getComputedStyle(parent);
    v.cssW = Math.max(1, parent.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
    v.cssH = Math.max(1, parent.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    const fit = Math.min(v.cssW / VIEW_W, v.cssH / VIEW_H);
    v.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.6 / Math.max(fit, 0.01)));
    canvas.width = Math.round(v.cssW * v.dpr);
    canvas.height = Math.round(v.cssH * v.dpr);
    canvas.style.width = v.cssW + 'px';
    canvas.style.height = v.cssH + 'px';
    v.scale = fit;
    v.ox = (v.cssW - VIEW_W * fit) / 2;
    v.oy = (v.cssH - VIEW_H * fit) / 2;
    rect.x0 = -v.ox / fit;
    rect.y0 = -v.oy / fit;
    rect.x1 = (v.cssW - v.ox) / fit;
    rect.y1 = (v.cssH - v.oy) / fit;
    rect.w = rect.x1 - rect.x0;
    rect.h = rect.y1 - rect.y0;
  }

  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(resize).observe(canvas.parentElement);

  /* Plane coordinates for a new frame */
  function begin() {
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);
  }

  function visible() {
    return rect;
  }

  function toPlane(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    /* the canvas element may be stretched by CSS: map through its displayed size */
    const sx = r.width ? v.cssW / r.width : 1, sy = r.height ? v.cssH / r.height : 1;
    return {
      x: ((clientX - r.left) * sx - v.ox) / v.scale,
      y: ((clientY - r.top) * sy - v.oy) / v.scale
    };
  }

  resize();

  Object.assign(NS.view, {
    canvas, ctx, resize, begin, visible, toPlane, info: v
  });
})();
