/* The enemies: trapped enemies count down their escape timer (and break free with a
   burst), free enemies patrol under gravity with platform landing, wall bounce and
   bottom-to-top screen wrap, and collide with the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { aabb, landOnPlatform } = NS.rules;

  function updateEnemies(dt) {
    for (const enemy of S.enemies) {
      if (!enemy.alive) continue;

      if (enemy.trapped) {
        // Trapped enemy counts down escape timer
        enemy.trapTimer -= dt;
        if (enemy.trapTimer <= 0) {
          // Enemy breaks free and escapes from bubble
          enemy.trapped = false;
          enemy.vx = (Math.random() < 0.5 ? 1 : -1) * 60;
          V.particles.burst(enemy.x + 10, enemy.y + 10, 5, { color: '#ff4444', life: 0.3, speed: 25 });
          SZ.GameAudio.play('whoosh', { pitch: 0.8 });
        }
        continue;
      }

      // Gravity
      enemy.vy += C.GRAVITY * dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Platform landing
      landOnPlatform(enemy, dt);

      // Wall bounce
      if (enemy.x < C.WALL_THICKNESS) { enemy.x = C.WALL_THICKNESS; enemy.vx = Math.abs(enemy.vx); }
      if (enemy.x + enemy.w > C.CANVAS_W - C.WALL_THICKNESS) { enemy.x = C.CANVAS_W - C.WALL_THICKNESS - enemy.w; enemy.vx = -Math.abs(enemy.vx); }

      // Screen wrap bottom to top
      if (enemy.y > C.CANVAS_H) enemy.y = -enemy.h;

      // Enemy-player collision
      if (!enemy.trapped && S.player.alive && S.player.invincible <= 0 && aabb(S.player, enemy))
        NS.player.playerDeath();

      // Animation
      enemy.animFrame = (enemy.animFrame + dt * 4) % 2;
    }
  }

  Object.assign(NS.enemies, { updateEnemies });
})();
