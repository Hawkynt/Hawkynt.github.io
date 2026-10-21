/* The canvas effects layer: particle/shake singletons, their animation loop
   and the cell-center and palette helpers they need. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const EF = NS.effects;

  /* ---- Canvas Effects Layer ---- */
  EF.ensureEffectsCanvas = function ensureEffectsCanvas() {
    const fieldBorder = document.querySelector('.field-border');
    const w = fieldBorder.offsetWidth;
    const h = fieldBorder.offsetHeight;

    if (!S.effectsCanvas || S.effectsCanvas.parentElement !== fieldBorder) {
      if (S.effectsCanvas)
        S.effectsCanvas.remove();
      S.effectsCanvas = document.createElement('canvas');
      S.effectsCanvas.className = 'effects-overlay';
      fieldBorder.appendChild(S.effectsCanvas);
    }

    if (S.effectsCanvas.width !== w || S.effectsCanvas.height !== h) {
      S.effectsCanvas.width = w;
      S.effectsCanvas.height = h;
    }

    S.effectsCtx = S.effectsCanvas.getContext('2d');

    if (!S.particles)
      S.particles = new SZ.GameEffects.ParticleSystem();
    if (!S.shake)
      S.shake = new SZ.GameEffects.ScreenShake();
  };

  EF.startEffectsLoop = function startEffectsLoop() {
    if (S.effectsRunning)
      return;
    S.effectsRunning = true;
    let lastTime = performance.now();
    const loop = (now) => {
      if (!S.effectsCanvas || !S.effectsCtx) {
        S.effectsRunning = false;
        return;
      }
      const dt = now - lastTime;
      lastTime = now;
      S.effectsCtx.clearRect(0, 0, S.effectsCanvas.width, S.effectsCanvas.height);
      S.shake.update(dt);
      S.effectsCtx.save();
      S.shake.apply(S.effectsCtx);
      S.particles.update();
      S.particles.draw(S.effectsCtx);
      S.effectsCtx.restore();
      if (S.particles.count > 0 || S.shake.active)
        requestAnimationFrame(loop);
      else
        S.effectsRunning = false;
    };
    requestAnimationFrame(loop);
  };

  EF.getCellCenter = function getCellCenter(r, c) {
    return { x: c * 16 + 8, y: r * 16 + 8 };
  };

  EF.pickColor = function pickColor(palette) {
    return palette[Math.floor(Math.random() * palette.length)];
  };
})();
