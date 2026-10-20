/* FX, the shared effect instances: the particle system, screen shake, floating text
   and the starfield background (rebuilt when the field size changes). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const S = NS.state;

  const FX = NS.effects || (NS.effects = {});
  FX.particles = new SZ.GameEffects.ParticleSystem();
  FX.screenShake = new SZ.GameEffects.ScreenShake();
  FX.floatingText = new SZ.GameEffects.FloatingText();
  FX.starfield = new SZ.GameEffects.Starfield(S.CANVAS_W, S.CANVAS_H, 80);
})();
