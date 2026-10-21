/* Zone effects: ice slows, fire burns the ship, proximity mines detonate on
   contact or bullet hit. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function updateZones(dt) {
    for (let i = S.zones.length - 1; i >= 0; --i) {
      const z = S.zones[i];
      z.timer -= dt;
      if (z.timer <= 0) {
        S.zones.splice(i, 1);
        continue;
      }

      if (z.type === 'ice') {
        for (const a of S.asteroids) {
          if (NS.rules.distWrapped(a, z) < z.radius) {
            a.vx *= 0.98;
            a.vy *= 0.98;
          }
        }
        for (const e of S.enemies)
          if (NS.rules.distWrapped(e, z) < z.radius) {
            e.vx *= 0.98;
            e.vy *= 0.98;
          }
        if (S.ship && NS.rules.distWrapped(S.ship, z) < z.radius) {
          S.ship.vx *= 0.98;
          S.ship.vy *= 0.98;
        }
      }

      if (z.type === 'fire' && S.ship && S.invulnTimer <= 0 && S.fireDamageCooldown <= 0) {
        if (NS.rules.distWrapped(S.ship, z) < z.radius) {
          S.fireDamageCooldown = C.FIRE_DAMAGE_COOLDOWN;
          NS.destruction.destroyShip();
        }
      }

      if (z.type === 'mine') {
        if (S.ship && S.invulnTimer <= 0 && NS.rules.distWrapped(S.ship, z) < z.radius) {
          detonateMine(z, i);
          continue;
        }
        for (let bi = S.bullets.length - 1; bi >= 0; --bi) {
          if (NS.rules.distWrapped(S.bullets[bi], z) < z.radius) {
            S.bullets.splice(bi, 1);
            detonateMine(z, i);
            break;
          }
        }
      }
    }
  }

  function detonateMine(mine, index) {
    S.zones.splice(index, 1);
    D.particles.burst(mine.x, mine.y, 20, { speed: 4, color: '#ffcc00', size: 3, life: 0.6, decay: 0.02 });
    NS.shockwaves.addShockwave(mine.x, mine.y, { maxRadius: 60, speed: 4, color: '#ffcc00' });
    D.shake.trigger(5, 200);
    SZ.GameAudio.play('explode', { pitch: 1.3, volume: 0.7 });
    if (S.ship && S.invulnTimer <= 0 && NS.rules.distWrapped(S.ship, mine) < 60) {
      S.fireDamageCooldown = C.FIRE_DAMAGE_COOLDOWN;
      NS.destruction.destroyShip();
    }
  }

  Object.assign(NS.zones, { updateZones, detonateMine });
})();
