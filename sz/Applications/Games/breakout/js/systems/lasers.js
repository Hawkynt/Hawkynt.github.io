/* The laser power-up ability: the twin shots from the paddle emitters. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const FX = NS.effects;

  /* ---- Laser Fire ---- */
  function fireLaser() {
    if (!S.activePowerUps.L || S.laserCooldown > 0)
      return;
    S.laserCooldown = 10;
    const lx = S.paddle.x + C.EMITTER_RADIUS;
    const rx = S.paddle.x + S.paddle.width - C.EMITTER_RADIUS;
    const py = S.paddle.y;
    S.lasers.push({ x: lx, y: py - 10 });
    S.lasers.push({ x: rx, y: py - 10 });
    SZ.GameAudio.play('laser', { volume: 0.6 });
    FX.particles.sparkle(lx, py - 10, 3, { color: '#f88' });
    FX.particles.sparkle(rx, py - 10, 3, { color: '#f88' });
  }

  Object.assign(NS.lasers, { fireLaser });
})();
