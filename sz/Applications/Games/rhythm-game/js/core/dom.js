/* The canvas and its 2d context, the OS window handle and the shared effect
   library instances — the note trail system is separate for layering. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  NS.dom = NS.dom || {
    canvas: document.getElementById('gameCanvas'),
    User32: SZ.Dlls?.User32
  };

  NS.dom.ctx = NS.dom.canvas.getContext('2d');
  NS.dom.particles = new SZ.GameEffects.ParticleSystem();
  NS.dom.screenShake = new SZ.GameEffects.ScreenShake();
  NS.dom.floatingText = new SZ.GameEffects.FloatingText();
  NS.dom.trailParticles = new SZ.GameEffects.ParticleSystem();
})();
