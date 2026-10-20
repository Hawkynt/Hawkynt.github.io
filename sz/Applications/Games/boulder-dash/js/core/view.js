/* V, the long-lived page objects: the canvas and its 2D context, the shared effect
   systems (particles, screen shake, floating text) and the status bar elements. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  const V = NS.view || (NS.view = {});

  V.canvas = document.getElementById('gameCanvas');
  V.ctx = V.canvas.getContext('2d');
  V.particles = new SZ.GameEffects.ParticleSystem();
  V.screenShake = new SZ.GameEffects.ScreenShake();
  V.floatingText = new SZ.GameEffects.FloatingText();

  /* ── Status bar elements ── */
  V.elScore = document.getElementById('statusScore');
  V.elLevel = document.getElementById('statusLevel');
  V.elLives = document.getElementById('statusLives');
  V.elState = document.getElementById('statusState');
  V.elTime = document.getElementById('statusTime');
  V.elGems = document.getElementById('statusGems');
})();
