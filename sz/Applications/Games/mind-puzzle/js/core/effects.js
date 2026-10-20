/* FX, the shared effect singletons: the particle system, the screen shake and the
   floating text. Constructed once, at load. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});

  NS.effects = NS.effects || {
    particles: new SZ.GameEffects.ParticleSystem(),
    screenShake: new SZ.GameEffects.ScreenShake(),
    floatingText: new SZ.GameEffects.FloatingText()
  };
})();
