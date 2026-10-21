/* The view singletons: canvas and 2d context, the status-bar element refs, the
   particle and floating-text effect instances, and the DPR-aware canvas setup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, CANVAS_H } = NS.constants;

  /* ── DOM ── */
  NS.dom = NS.dom || {};
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCookies = document.getElementById('statusCookies');
  const statusCps = document.getElementById('statusCps');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Canvas Setup ── */
  function setupCanvas() {
    S.dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * S.dpr;
    canvas.height = CANVAS_H * S.dpr;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  }

  Object.assign(NS.dom, { canvas, ctx, statusCookies, statusCps, statusState,
    particles, floatingText, setupCanvas });
})();
