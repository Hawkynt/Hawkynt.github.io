;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Long-lived services shared by all modules: the canvas and its 2D context, the
     drawing kit, the status-bar cells, the effect systems and the rate-limited sound. */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.FlappyUI.create(ctx);
  const statusScore = document.getElementById('statusScore');
  const statusBest = document.getElementById('statusBest');
  const statusState = document.getElementById('statusState');

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  // one gate per name so nothing spams: the same sound plays at most once per 45 ms
  const sfxLast = {};
  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || -45) < 45)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  Object.assign(NS.services, {
    canvas, ctx, ui, statusScore, statusBest, statusState,
    particles, screenShake, floatingText, sfx
  });
})();
