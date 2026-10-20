/* V, the long-lived page and effect objects: the OS window handle, the game canvas
   with its 2d context, the particle / screen-shake / floating-text singletons and the
   status-bar elements. Constructed once, at load. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  const { User32 } = window.SZ?.Dlls ?? {};
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  NS.view = NS.view || {
    User32: User32,
    canvas: canvas,
    ctx: ctx,
    particles: new SZ.GameEffects.ParticleSystem(),
    screenShake: new SZ.GameEffects.ScreenShake(),
    floatingText: new SZ.GameEffects.FloatingText(),
    elScore: document.getElementById('statusScore'),
    elLevel: document.getElementById('statusLevel'),
    elLives: document.getElementById('statusLives'),
    elState: document.getElementById('statusState')
  };
})();
