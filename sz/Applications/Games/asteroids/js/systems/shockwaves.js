/* Expanding shockwave rings and the decaying full-screen flash. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;

  function addShockwave(x, y, opts = {}) {
    S.shockwaves.push({
      x, y,
      radius: opts.radius ?? 5,
      maxRadius: opts.maxRadius ?? 60,
      speed: opts.speed ?? 3,
      life: 1,
      color: opts.color ?? '#fff',
      lineWidth: opts.lineWidth ?? 2
    });
  }

  function updateShockwaves() {
    for (let i = S.shockwaves.length - 1; i >= 0; --i) {
      const s = S.shockwaves[i];
      s.radius += s.speed;
      s.life = 1 - s.radius / s.maxRadius;
      if (s.life <= 0)
        S.shockwaves.splice(i, 1);
    }
  }

  function triggerScreenFlash(alpha) {
    S.screenFlashAlpha = alpha ?? 0.3;
  }

  Object.assign(NS.shockwaves, { addShockwave, updateShockwaves, triggerScreenFlash });
})();
