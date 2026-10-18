/*
 * Canvas and camera: backing-store size and letterbox, frame clear, full-canvas
 * background, camera follow and zoom, world/screen transforms and culling.
 * Writes G.viewScale / G.viewOff* and the camera fields in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, BASE_MAX_SPEED } = NS.constants;
  const { frameRate } = NS.util;
  const { canvas, ctx, screenShake } = NS.runtime;

  function setupCanvas() {
    // never render more than ~1.5 logical pixels per game pixel; the browser upscales the rest
    const dprRaw = window.devicePixelRatio || 1;
    const cssWv = Math.max(1, canvas.clientWidth);
    const cssHv = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssWv / CANVAS_W, cssHv / CANVAS_H);
    const dpr = Math.max(0.5, Math.min(dprRaw, 1.5 / Math.max(fit, 0.01)) * G.renderScale);
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    G.viewScale = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H);
    G.viewOffX = Math.round((canvas.width - CANVAS_W * G.viewScale) / 2);
    G.viewOffY = Math.round((canvas.height - CANVAS_H * G.viewScale) / 2);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
    ctx.imageSmoothingEnabled = true;
  }

  /* Fill the whole canvas (letterbox bars too), then return to logical coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
  }

  /* Paint the star field over the whole canvas, letterbox bars included */
  function drawFullBackground(camXv, camYv, zoom) {
    const padX = G.viewOffX / G.viewScale;
    const padY = G.viewOffY / G.viewScale;
    ctx.save();
    ctx.translate(-padX, -padY);
    G.trackArt.drawBackground(ctx, camXv - padX, camYv - padY, zoom, G.globalTime, CANVAS_W + 2 * padX, CANVAS_H + 2 * padY);
    ctx.restore();
  }

  function updateCamera(dt) {
    const look = 0.35;
    const targetX = G.ship.x + G.ship.vx * look;
    const targetY = G.ship.y + G.ship.vy * look;
    const follow = frameRate(0.1, dt);
    G.camX += (targetX - G.camX) * follow;
    G.camY += (targetY - G.camY) * follow;
    const maxSpeed = BASE_MAX_SPEED * (G.ship.stats ? G.ship.stats.speed : 1);
    const zoomTarget = 1 - Math.min(0.25, (G.ship.speed / maxSpeed) * 0.25) - (G.boostActive ? 0.08 : 0);
    G.camZoom += (zoomTarget - G.camZoom) * frameRate(0.05, dt);
    if (G.boostActive && !G.prevBoostActive)
      screenShake.trigger(3, 120);
    G.prevBoostActive = G.boostActive;
  }

  function applyWorldTransform() {
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.scale(G.camZoom, G.camZoom);
    ctx.translate(-G.camX, -G.camY);
  }

  function worldToScreen(x, y) {
    return { x: (x - G.camX) * G.camZoom + CANVAS_W / 2, y: (y - G.camY) * G.camZoom + CANVAS_H / 2 };
  }

  /* True when a world point with radius r can be visible this frame */
  function inView(x, y, r) {
    const hw = CANVAS_W / 2 / G.camZoom + r;
    const hh = CANVAS_H / 2 / G.camZoom + r;
    return Math.abs(x - G.camX) < hw && Math.abs(y - G.camY) < hh;
  }

  Object.assign(NS.module('view'), {
    setupCanvas, beginFrame, drawFullBackground, updateCamera, applyWorldTransform, worldToScreen, inView
  });
})();
