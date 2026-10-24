;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects = NS.effects || {};
  E.particles = new SZ.GameEffects.ParticleSystem();
  E.screenShake = new SZ.GameEffects.ScreenShake();
  E.floatingText = new SZ.GameEffects.FloatingText();

})();
