/* The between-level warp: it clears the field, streaks the stars outward, then
   delivers allies, bosses or the next wave of asteroids. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function startWarp() {
    S.warpState = { timer: C.WARP_DURATION, duration: C.WARP_DURATION };
    S.invulnTimer = C.WARP_DURATION + 1000;
    S.bullets = [];
    S.enemyBullets = [];
    S.allyBullets = [];
    S.collectiblePowerups = [];
    S.enemies = [];
    S.zones = [];
    S.bossActive = false;
  }

  function endWarp() {
    S.warpState = null;
    NS.shockwaves.triggerScreenFlash(0.25);
    D.shake.trigger(5, 300);
    for (const s of S.stars) {
      s.x = Math.random() * S.W;
      s.y = Math.random() * S.H;
    }

    /* Spawn ally every 5 levels starting at 5 */
    if (S.level >= 5 && S.level % 5 === 0 && S.allies.length < C.MAX_ALLIES && !S.allySpawnedForLevel) {
      S.allySpawnedForLevel = true;
      const a = NS.entities.createAlly();
      S.allies.push(a);
      D.floatingText.add(S.W / 2, S.H / 2 + 40, 'ALLY INCOMING!', { color: '#44ffaa', decay: 0.012, font: NS.rules.scaledFont(18) });
    }

    /* Boss every 5 levels starting at 10 */
    if (S.level >= 10 && S.level % 5 === 0) {
      S.bossActive = true;
      const boss = NS.entities.createEnemy('boss');
      S.enemies.push(boss);
      D.floatingText.add(S.W / 2, S.H / 2 - 40, 'BOSS FIGHT!', { color: '#ff44ff', decay: 0.01, font: NS.rules.scaledFont(22) });
    } else
      NS.flow.spawnLevelAsteroids();
  }

  function updateWarpStars() {
    if (!S.warpState) return;
    const progress = 1 - S.warpState.timer / S.warpState.duration;
    const intensity = Math.sin(progress * Math.PI);
    const speed = intensity * 8;
    const cx = S.W / 2, cy = S.H / 2;

    for (const s of S.stars) {
      const dx = s.x - cx, dy = s.y - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      s.x += (dx / len) * speed;
      s.y += (dy / len) * speed;

      if (s.x < -20 || s.x > S.W + 20 || s.y < -20 || s.y > S.H + 20) {
        const a = NS.rules.randomAngle();
        const r = 10 + Math.random() * 50;
        s.x = cx + Math.cos(a) * r;
        s.y = cy + Math.sin(a) * r;
      }
    }
  }

  Object.assign(NS.warp, { startWarp, endWarp, updateWarpStars });
})();
