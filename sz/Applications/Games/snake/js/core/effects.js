/* FX, the shared effect singletons: the particle system, the screen shake, the
   floating score text and the audio handle. Constructed once, at load. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  NS.effects = NS.effects || {
    particles: new SZ.GameEffects.ParticleSystem(),
    screenShake: new SZ.GameEffects.ScreenShake(),
    floatingText: new SZ.GameEffects.FloatingText(),
    sfx: SZ.GameAudio
  };
})();
