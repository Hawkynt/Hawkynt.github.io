/* The canvas and its 2d context, the shared effect-library instances and the
   status bar elements — every handle into the page, grabbed once at load. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  const D = NS.dom = NS.dom || {
    canvas: document.getElementById('gameCanvas'),
    elScore: document.getElementById('statusScore'),
    elLevel: document.getElementById('statusLevel'),
    elMoves: document.getElementById('statusMoves'),
    elState: document.getElementById('statusState')
  };

  D.ctx = D.canvas.getContext('2d');
  D.particles = new SZ.GameEffects.ParticleSystem();
  D.screenShake = new SZ.GameEffects.ScreenShake();
  D.floatingText = new SZ.GameEffects.FloatingText();
})();
