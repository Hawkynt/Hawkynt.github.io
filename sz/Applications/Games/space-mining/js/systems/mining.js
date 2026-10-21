/* The mining loop: asteroid spawning and respawning, the drill targeting and
   extraction, and the depletion break-apart effect. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const M = NS.mining;

  /* ── Asteroids ── */
  M.spawnAsteroids = function spawnAsteroids() {
    S.asteroids = [];
    for (let i = 0; i < C.ASTEROID_COUNT; ++i) {
      const def = M.pickAsteroidDef();
      const radius = def.minRadius + Math.random() * (def.maxRadius - def.minRadius);
      let x, y;
      do {
        x = 100 + Math.random() * (C.WORLD_W - 200);
        y = 100 + Math.random() * (C.WORLD_H - 200);
      } while (Math.hypot(x - C.STATION_X, y - C.STATION_Y) < 200);

      S.asteroids.push(M.createAsteroid(x, y, radius, def));
    }
  };

  M.pickAsteroidDef = function pickAsteroidDef() {
    const r = Math.random();
    let cumulative = 0;
    for (const def of T.ASTEROID_DEFS) {
      cumulative += def.abundance;
      if (r <= cumulative) return def;
    }
    return T.ASTEROID_DEFS[0];
  };

  M.createAsteroid = function createAsteroid(x, y, radius, def) {
    const vertices = [];
    const vertexCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < vertexCount; ++i) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const jitter = 0.7 + Math.random() * 0.3;
      vertices.push({ angle, dist: radius * jitter });
    }
    return {
      x, y, radius,
      oreType: def.oreType,
      resources: def.resourceAmount * def.richness,
      maxResources: def.resourceAmount * def.richness,
      vertices,
      rotationAngle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3
    };
  };

  let drillSoundTick = 0;

  M.updateDrilling = function updateDrilling(dt) {
    S.isDrilling = false;
    S.drillTarget = null;

    if (!S.keys['Space'] && !S.mouseDrilling) return;
    if (NS.economy.cargoIsFull()) return;

    /* Find nearest asteroid in drill range */
    let nearest = null;
    let nearestDist = Infinity;
    for (const a of S.asteroids) {
      if (a.resources <= 0) continue;
      const dist = Math.hypot(S.ship.x - a.x, S.ship.y - a.y);
      if (dist < C.DRILL_RANGE + a.radius && dist < nearestDist) {
        nearest = a;
        nearestDist = dist;
      }
    }

    if (!nearest) return;

    S.isDrilling = true;
    S.drillTarget = nearest;
    S.drillTimer += dt;

    /* Extract resources over time */
    const extractRate = S.drillSpeed * dt;
    const extracted = Math.min(extractRate, nearest.resources);
    const remainingCapacity = S.cargoMax - NS.economy.totalCargo();
    const actual = Math.min(extracted, remainingCapacity);

    if (actual > 0) {
      nearest.resources -= actual;
      S.cargo[nearest.oreType] += actual;
      S.totalOreMined += actual;

      if (NS.economy.cargoIsFull())
        SZ.GameAudio.play('error', { volume: 0.7 });

      /* Drill particle spray */
      if (S.drillTimer > 0.08) {
        S.drillTimer = 0;
        if (++drillSoundTick % 3 === 0)
          SZ.GameAudio.play('click', { pitch: 0.35 + Math.random() * 0.1, volume: 0.8 });
        const drillX = nearest.x - S.camera.x;
        const drillY = nearest.y - S.camera.y;
        D.particles.burst(drillX, drillY, 3, { color: T.ORE_TYPES[nearest.oreType].color, speed: 2, life: 0.5 });
      }
    }

    /* Check if asteroid is depleted */
    if (nearest.resources <= 0)
      M.depleteAsteroid(nearest);
  };

  M.depleteAsteroid = function depleteAsteroid(asteroid) {
    /* Asteroid break apart - debris particles + screen shake */
    const sx = asteroid.x - S.camera.x;
    const sy = asteroid.y - S.camera.y;
    D.particles.burst(sx, sy, 25, { color: T.ORE_TYPES[asteroid.oreType].color, speed: 4, life: 1.2 });
    D.particles.burst(sx, sy, 15, { color: '#888', speed: 3, life: 1.0 });
    D.screenShake.trigger(6, 400);
    SZ.GameAudio.play('explode', { volume: 0.6 });
    D.floatingText.add(sx, sy - 20, 'DEPLETED', { color: '#f88', font: 'bold 14px sans-serif' });
  };

  M.updateAsteroidRotations = function updateAsteroidRotations(dt) {
    for (const a of S.asteroids)
      a.rotationAngle += a.rotationSpeed * dt;
  };

  M.checkAsteroidRespawn = function checkAsteroidRespawn() {
    /* Respawn depleted asteroids far from player */
    for (let i = 0; i < S.asteroids.length; ++i) {
      const a = S.asteroids[i];
      if (a.resources > 0) continue;

      const def = M.pickAsteroidDef();
      const radius = def.minRadius + Math.random() * (def.maxRadius - def.minRadius);
      let x, y, attempts = 0;
      do {
        x = 100 + Math.random() * (C.WORLD_W - 200);
        y = 100 + Math.random() * (C.WORLD_H - 200);
        ++attempts;
      } while ((Math.hypot(x - S.ship.x, y - S.ship.y) < 400 || Math.hypot(x - C.STATION_X, y - C.STATION_Y) < 200) && attempts < 20);

      S.asteroids[i] = M.createAsteroid(x, y, radius, def);
    }
  };
})();
