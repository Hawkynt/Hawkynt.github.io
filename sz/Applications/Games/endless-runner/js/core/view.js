/* V, the long-lived page objects: the canvas and its 2D context, the shared effect
   systems (particles, screen shake, floating text), the audio handle, the status bar
   elements and the canvas sizing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;

  const V = NS.view || (NS.view = {});

  /* ── DOM ── */
  V.canvas = document.getElementById('gameCanvas');
  V.ctx = V.canvas.getContext('2d');
  V.elStatusDistance = document.getElementById('statusDistance');
  V.elStatusCoins = document.getElementById('statusCoins');
  V.elStatusSpeed = document.getElementById('statusSpeed');
  V.elStatusState = document.getElementById('statusState');

  /* ── Effects ── */
  V.particles = new SZ.GameEffects.ParticleSystem();
  V.screenShake = new SZ.GameEffects.ScreenShake();
  V.floatingText = new SZ.GameEffects.FloatingText();
  V.sfx = SZ.GameAudio;

  V.dpr = 1;

  /* ── Canvas Setup ── */
  V.setupCanvas = function() {
    V.dpr = window.devicePixelRatio || 1;
    V.canvas.width = C.CANVAS_W * V.dpr;
    V.canvas.height = C.CANVAS_H * V.dpr;
    V.ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  };
})();
