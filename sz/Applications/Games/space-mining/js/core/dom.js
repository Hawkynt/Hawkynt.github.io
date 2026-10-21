/* The canvas and its context, the status-bar and dialog element refs, the OS
   window handle and the shared effect singletons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom = NS.dom || {};

  /* ── DOM ── */
  D.canvas = document.getElementById('gameCanvas');
  D.ctx = D.canvas.getContext('2d');
  D.statusCredits = document.getElementById('statusCredits');
  D.statusCargo = document.getElementById('statusCargo');
  D.statusState = document.getElementById('statusState');
  D.highScoresBody = document.getElementById('highScoresBody');

  /* ── API ── */
  const { User32 } = window.SZ?.Dlls ?? {};
  D.User32 = User32;

  /* ── Effects ── */
  D.particles = new SZ.GameEffects.ParticleSystem();
  D.screenShake = new SZ.GameEffects.ScreenShake();
  D.floatingText = new SZ.GameEffects.FloatingText();

  /* ── Canvas Setup ── */
  D.setupCanvas = function setupCanvas() {
    S.dpr = window.devicePixelRatio || 1;
    D.canvas.width = C.CANVAS_W * S.dpr;
    D.canvas.height = C.CANVAS_H * S.dpr;
    D.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  };
})();
