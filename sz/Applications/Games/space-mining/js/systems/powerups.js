/* Floating powerups: periodic spawning, lifetime, the magnet pull effect,
   collection and the active-duration bookkeeping. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const P = NS.powerups;

  P.spawnPowerup = function spawnPowerup() {
    if (S.powerups.length >= C.MAX_POWERUPS) return;
    const type = T.POWERUP_KEYS[Math.floor(Math.random() * T.POWERUP_KEYS.length)];
    let x, y, attempts = 0;
    do {
      x = 150 + Math.random() * (C.WORLD_W - 300);
      y = 150 + Math.random() * (C.WORLD_H - 300);
      ++attempts;
    } while (Math.hypot(x - C.STATION_X, y - C.STATION_Y) < 150 && attempts < 15);

    S.powerups.push({
      x, y, type,
      lifetime: C.POWERUP_LIFETIME,
      bobPhase: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2
    });
  };

  P.collectPowerup = function collectPowerup(pu) {
    const def = T.POWERUP_DEFS[pu.type];
    const sx = pu.x - S.camera.x;
    const sy = pu.y - S.camera.y;
    D.particles.burst(sx, sy, 15, { color: def.color, speed: 3, life: 0.8 });
    D.floatingText.add(sx, sy - 20, def.label + '!', { color: def.glowColor, font: 'bold 13px sans-serif' });
    SZ.GameAudio.play('powerup');

    switch (pu.type) {
      case 'shield':
        S.activePowerups.shield = (S.activePowerups.shield || 0) + def.duration;
        break;
      case 'speed':
        S.activePowerups.speed = (S.activePowerups.speed || 0) + def.duration;
        break;
      case 'magnet':
        S.activePowerups.magnet = (S.activePowerups.magnet || 0) + def.duration;
        break;
      case 'bonusOre':
        if (!NS.economy.cargoIsFull()) {
          const oreKey = T.ORE_KEYS[Math.floor(Math.random() * T.ORE_KEYS.length)];
          const amount = Math.min(2, S.cargoMax - NS.economy.totalCargo());
          S.cargo[oreKey] += amount;
          S.totalOreMined += amount;
        }
        break;
      case 'repair':
        S.hull = Math.min(S.hullMax, S.hull + 30);
        break;
    }
  };

  P.updatePowerups = function updatePowerups(dt) {
    S.powerupSpawnTimer += dt;
    if (S.powerupSpawnTimer >= C.POWERUP_SPAWN_INTERVAL) {
      S.powerupSpawnTimer = 0;
      P.spawnPowerup();
    }

    /* Update active powerup durations */
    for (const key of Object.keys(S.activePowerups)) {
      S.activePowerups[key] -= dt;
      if (S.activePowerups[key] <= 0)
        delete S.activePowerups[key];
    }

    /* Magnet effect: pull nearby powerups toward ship */
    const magnetActive = S.activePowerups.magnet > 0;

    for (let i = S.powerups.length - 1; i >= 0; --i) {
      const pu = S.powerups[i];
      pu.lifetime -= dt;
      pu.bobPhase += dt * 2;
      pu.pulsePhase += dt * 3;

      if (magnetActive) {
        const dx = S.ship.x - pu.x;
        const dy = S.ship.y - pu.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 300 && dist > 5) {
          const pull = 120 / dist;
          pu.x += (dx / dist) * pull * dt * 60;
          pu.y += (dy / dist) * pull * dt * 60;
        }
      }

      /* Collect */
      const dist = Math.hypot(S.ship.x - pu.x, S.ship.y - pu.y);
      if (dist < C.POWERUP_COLLECT_RANGE) {
        P.collectPowerup(pu);
        S.powerups.splice(i, 1);
        continue;
      }

      /* Expire */
      if (pu.lifetime <= 0) {
        S.powerups.splice(i, 1);
      }
    }
  };
})();
