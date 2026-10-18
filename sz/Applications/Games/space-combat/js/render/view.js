/* The canvas and its 2D context: fits the 1280 x 720 view plane into the window (letterboxed
   for menus, with the world and scenery filling every extra pixel), follows resize and
   maximize, caps the backing resolution, and maps pointer positions into the plane.
   Owns the canvas size, scale and offsets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const { VIEW_W, VIEW_H } = NS.constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const v = { cssW: VIEW_W, cssH: VIEW_H, dpr: 1, scale: 1, ox: 0, oy: 0 };
  const rect = { x0: 0, y0: 0, x1: VIEW_W, y1: VIEW_H, w: VIEW_W, h: VIEW_H };

  function resize() {
    const parent = canvas.parentElement;
    const cs = getComputedStyle(parent);
    v.cssW = Math.max(1, parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    v.cssH = Math.max(1, parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    const fit = Math.min(v.cssW / VIEW_W, v.cssH / VIEW_H);
    /* never more than ~1.6 backing pixels per plane pixel: big windows stay fast */
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

  /* Reset to plane coordinates for a new frame */
  function begin() {
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);
  }

  /* The part of the plane the canvas shows (wider or taller than 1280 x 720 off-aspect) */
  function visible() {
    return rect;
  }

  function toPlane(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - v.ox) / v.scale,
      y: (clientY - r.top - v.oy) / v.scale,
    };
  }

  resize();

  Object.assign(NS.view, {
    canvas, ctx, resize, begin, visible, toPlane, info: v
  });
})();
