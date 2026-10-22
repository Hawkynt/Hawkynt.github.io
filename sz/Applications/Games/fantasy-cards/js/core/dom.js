/* The canvas and its context, the OS window handle and the shared effect
   singletons, plus the canvas scaling setup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  /* ── Visual effects from shared library ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Canvas Setup ── */
  function setupCanvas() {
    // shrink the table to fit a small window (a phone), never grow it past its design size
    const frame = canvas.parentElement;
    const fit = frame ? Math.min(1, frame.clientWidth / C.CANVAS_W, frame.clientHeight / C.CANVAS_H) || 1 : 1;
    const cssW = Math.max(1, Math.floor(C.CANVAS_W * fit));
    const cssH = Math.max(1, Math.floor(C.CANVAS_H * fit));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(canvas.width / C.CANVAS_W, 0, 0, canvas.height / C.CANVAS_H, 0, 0);
  }

  NS.dom = NS.dom || {
    canvas, ctx, User32,
    particles, screenShake, floatingText,
    setupCanvas
  };
})();
