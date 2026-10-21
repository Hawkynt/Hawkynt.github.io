/* One collision pass per simulation step: bullets against rocks, enemies and
   the ship, hulls against everything, and powerup pickup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;

  function checkCollisions() {
    const isPiercing = S.powerupState.piercing.active && !S.empActive;

    /* Bullets vs Asteroids */
    for (let bi = S.bullets.length - 1; bi >= 0; --bi) {
      const b = S.bullets[bi];
      let hit = false;
      for (let ai = S.asteroids.length - 1; ai >= 0; --ai) {
        const a = S.asteroids[ai];
        if (NS.rules.distWrapped(b, a) < a.radius) {
          ++S.stats.shotsHit;
          if (!isPiercing) {
            S.bullets.splice(bi, 1);
            hit = true;
          }
          NS.destruction.damageAsteroid(a, ai);
          if (hit) break;
        }
      }
      if (hit) continue;

      /* Bullets vs Enemies */
      if (bi < S.bullets.length)
        for (let ei = S.enemies.length - 1; ei >= 0; --ei) {
          const e = S.enemies[ei];
          if (e.type === 'stealth' && !e.visible) continue;
          if (NS.rules.distWrapped(S.bullets[bi], e) < e.radius) {
            ++S.stats.shotsHit;
            if (!isPiercing)
              S.bullets.splice(bi, 1);
            NS.destruction.damageEnemy(e, ei, 1);
            hit = true;
            break;
          }
        }
    }

    /* Ally bullets vs Asteroids and Enemies */
    for (let bi = S.allyBullets.length - 1; bi >= 0; --bi) {
      const b = S.allyBullets[bi];
      let hit = false;
      for (let ai = S.asteroids.length - 1; ai >= 0; --ai) {
        if (NS.rules.distWrapped(b, S.asteroids[ai]) < S.asteroids[ai].radius) {
          S.allyBullets.splice(bi, 1);
          NS.destruction.damageAsteroid(S.asteroids[ai], ai);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let ei = S.enemies.length - 1; ei >= 0; --ei) {
        const e = S.enemies[ei];
        if (e.type === 'stealth' && !e.visible) continue;
        if (NS.rules.distWrapped(b, e) < e.radius) {
          S.allyBullets.splice(bi, 1);
          NS.destruction.damageEnemy(e, ei, 1);
          break;
        }
      }
    }

    /* Enemy bullets vs Ship */
    if (S.ship && S.invulnTimer <= 0)
      for (let i = S.enemyBullets.length - 1; i >= 0; --i)
        if (NS.rules.distWrapped(S.enemyBullets[i], S.ship) < C.SHIP_SIZE) {
          S.enemyBullets.splice(i, 1);
          NS.destruction.destroyShip();
          return;
        }

    /* Enemy bullets vs Allies */
    for (let bi = S.enemyBullets.length - 1; bi >= 0; --bi)
      for (let ai = S.allies.length - 1; ai >= 0; --ai)
        if (NS.rules.distWrapped(S.enemyBullets[bi], S.allies[ai]) < 10) {
          S.enemyBullets.splice(bi, 1);
          S.allies[ai].hp -= 1;
          if (S.allies[ai].hp <= 0)
            NS.destruction.destroyAlly(S.allies[ai], ai);
          break;
        }

    /* Ship vs Asteroids (bypasses HP -- instant destroy) */
    if (S.ship && S.invulnTimer <= 0)
      for (let ai = S.asteroids.length - 1; ai >= 0; --ai) {
        const a = S.asteroids[ai];
        if (NS.rules.distWrapped(S.ship, a) < a.radius * 0.8 + C.SHIP_SIZE * 0.6) {
          NS.destruction.destroyAsteroid(a, ai);
          NS.destruction.destroyShip();
          return;
        }
      }

    /* Ship vs Enemies */
    if (S.ship && S.invulnTimer <= 0)
      for (let ei = S.enemies.length - 1; ei >= 0; --ei) {
        const e = S.enemies[ei];
        if (e.type === 'stealth' && !e.visible) continue;
        if (NS.rules.distWrapped(S.ship, e) < e.radius + C.SHIP_SIZE * 0.6) {
          if (e.type === 'drone')
            NS.destruction.destroyEnemy(e, ei);
          else
            NS.destruction.damageEnemy(e, ei, 1);
          NS.destruction.destroyShip();
          return;
        }
      }

    /* Allies vs Asteroids */
    for (let ai = S.allies.length - 1; ai >= 0; --ai)
      for (let ri = S.asteroids.length - 1; ri >= 0; --ri) {
        if (NS.rules.distWrapped(S.allies[ai], S.asteroids[ri]) < S.asteroids[ri].radius * 0.8 + 8) {
          S.allies[ai].hp -= 1;
          NS.destruction.damageAsteroid(S.asteroids[ri], ri);
          if (S.allies[ai].hp <= 0) {
            NS.destruction.destroyAlly(S.allies[ai], ai);
            break;
          }
        }
      }

    /* Ship vs Powerups */
    if (S.ship)
      for (let i = S.collectiblePowerups.length - 1; i >= 0; --i) {
        const p = S.collectiblePowerups[i];
        if (NS.rules.distWrapped(S.ship, p) < C.POWERUP_COLLECT_RADIUS) {
          S.collectiblePowerups.splice(i, 1);
          NS.powerups.activatePowerup(p.type);
        }
      }
  }

  Object.assign(NS.collision, { checkCollisions });
})();
