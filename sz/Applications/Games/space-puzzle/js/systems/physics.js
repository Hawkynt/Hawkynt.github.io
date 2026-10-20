/* The flight physics: gravitational pull from every well, the probe's motion and
   trail, goal detection, asteroid bounces, well capture, out-of-bounds misses and
   the per-frame update of the effect libraries. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  /* ── Physics update ── */
  function update(dt) {
    if (S.state === C.STATE_LAUNCHED) {
      // Apply gravity from each well
      for (const well of S.wells) {
        const dx = well.x - S.obj.x;
        const dy = well.y - S.obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) continue;
        const force = well.strength / (dist * dist);
        S.obj.vx += (dx / dist) * force * dt;
        S.obj.vy += (dy / dist) * force * dt;
      }

      // Update position
      S.obj.x += S.obj.vx * dt;
      S.obj.y += S.obj.vy * dt;

      // Trail — asteroid glow trail effect
      S.trail.push({ x: S.obj.x, y: S.obj.y, age: 0 });
      if (S.trail.length > C.TRAIL_MAX_LENGTH)
        S.trail.shift();
      for (const t of S.trail)
        t.age += dt;

      // Check goal — object reached goal zone
      const gDx = S.obj.x - S.goal.x;
      const gDy = S.obj.y - S.goal.y;
      if (Math.sqrt(gDx * gDx + gDy * gDy) < C.GOAL_RADIUS + C.OBJECT_RADIUS)
        NS.game.puzzleSolved();

      // Check asteroid collision — bounce off
      for (const ast of S.asteroids) {
        const aDx = S.obj.x - ast.x;
        const aDy = S.obj.y - ast.y;
        const aDist = Math.sqrt(aDx * aDx + aDy * aDy);
        if (aDist < ast.r + C.OBJECT_RADIUS) {
          // Reflect velocity — asteroid collision bounce
          const nx = aDx / aDist;
          const ny = aDy / aDist;
          const dot = S.obj.vx * nx + S.obj.vy * ny;
          S.obj.vx -= 2 * dot * nx * 0.8;
          S.obj.vy -= 2 * dot * ny * 0.8;
          // Push out of collision
          S.obj.x = ast.x + nx * (ast.r + C.OBJECT_RADIUS + 1);
          S.obj.y = ast.y + ny * (ast.r + C.OBJECT_RADIUS + 1);
          // Impact effects
          D.screenShake.trigger(4, 0.2);
          SZ.GameAudio.play('bounce');
          D.particles.burst(S.obj.x, S.obj.y, 8, { color: '#ff8844', life: 0.4, speed: 40 });
        }
      }

      // Check well collision — fail
      for (const well of S.wells) {
        const wDx = S.obj.x - well.x;
        const wDy = S.obj.y - well.y;
        if (Math.sqrt(wDx * wDx + wDy * wDy) < 12) {
          // Absorbed by gravity well — object lost, reset
          D.screenShake.trigger(8, 0.4);
          SZ.GameAudio.play('hurt');
          D.particles.burst(well.x, well.y, 15, { color: '#8844ff', life: 0.6, speed: 50 });
          D.floatingText.add(well.x, well.y - 20, 'Absorbed!', { color: '#ff4444' });
          NS.game.resetObject();
        }
      }

      // Check out of bounds — object missed, off-screen reset
      if (S.obj.x < -50 || S.obj.x > C.CANVAS_W + 50 || S.obj.y < -50 || S.obj.y > C.CANVAS_H + 50) {
        D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2, 'Miss!', { color: '#ff6644' });
        SZ.GameAudio.play('error');
        NS.game.resetObject();
      }
    }

    // Update elapsed time
    if (S.state === C.STATE_PLAYING || S.state === C.STATE_AIMING || S.state === C.STATE_LAUNCHED)
      S.elapsed = (performance.now() - S.levelStartTime) / 1000;

    D.particles.update(dt);
    D.screenShake.update(dt);
    D.floatingText.update(dt);
  }

  Object.assign(NS.physics, { update });
})();
