/* Homing powerup: bullets steer toward the nearest rock or visible enemy. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;

  function updateHomingBullets() {
    if (!S.powerupState.homing.active || S.empActive) return;
    for (const b of S.bullets) {
      let nearest = null, nearestDist = Infinity;
      for (const a of S.asteroids) {
        const d = NS.rules.distWrapped(b, a);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = a;
        }
      }
      for (const e of S.enemies) {
        if (e.type === 'stealth' && !e.visible) continue;
        const d = NS.rules.distWrapped(b, e);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (!nearest) continue;

      const targetAngle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
      const currentAngle = Math.atan2(b.vy, b.vx);
      let diff = targetAngle - currentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const turn = NS.rules.clamp(diff, -0.04, 0.04);
      const newAngle = currentAngle + turn;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.vx = Math.cos(newAngle) * speed;
      b.vy = Math.sin(newAngle) * speed;
    }
  }

  Object.assign(NS.homing, { updateHomingBullets });
})();
