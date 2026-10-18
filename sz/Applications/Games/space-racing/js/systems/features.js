/*
 * Track features in play: boost pads, hazards, gravity wells and wormholes acting
 * on the player and the AI. Reads the race* feature lists in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STATE_PLAYING, GRAVITY_CONSTANT, GRAVITY_MIN_DIST, GRAVITY_MAX_DIST, WORMHOLE_RADIUS,
    WORMHOLE_COOLDOWN, SHIP_RADIUS, BASE_BOOST_DURATION } = NS.constants;
  const { particles, screenShake, floatingText } = NS.runtime;

  function checkBoostPads() {
    if (G.state !== STATE_PLAYING) return;

    const stats = G.ship.stats;
    for (let i = 0; i < G.raceBoostPads.length; ++i) {
      const pad = G.raceBoostPads[i];
      const dx = pad.x - G.ship.x;
      const dy = pad.y - G.ship.y;
      if (dx * dx + dy * dy < 30 * 30) {
        if (!G.boostActive)
          SZ.GameAudio.play('whoosh', { pitch: 1.5 });
        G.boostActive = true;
        G.boostTimer = BASE_BOOST_DURATION * stats.boost;
        floatingText.add(G.ship.x, G.ship.y - 20, 'BOOST!', {
          color: '#0ff',
          font: 'bold 16px sans-serif'
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HAZARD COLLISIONS
     ══════════════════════════════════════════════════════════════════ */

  function checkHazards() {
    if (G.state !== STATE_PLAYING) return;

    for (let i = 0; i < G.raceHazards.length; ++i) {
      const h = G.raceHazards[i];
      const dx = h.x - G.ship.x;
      const dy = h.y - G.ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < h.radius + SHIP_RADIUS) {
        G.ship.speed *= 0.4;
        G.ship.vx *= 0.4;
        G.ship.vy *= 0.4;

        const pushAngle = Math.atan2(-dy, -dx);
        G.ship.x += Math.cos(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);
        G.ship.y += Math.sin(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);

        particles.burst(G.ship.x, G.ship.y, 12, {
          color: '#ff0',
          speed: 3,
          life: 0.3
        });

        screenShake.trigger(8, 300);
        SZ.GameAudio.play('thud');
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GRAVITY WELLS
     ══════════════════════════════════════════════════════════════════ */

  function applyGravity(dt) {
    if (G.state !== STATE_PLAYING) return;
    const bodies = G.raceGravity;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];

      // Apply to player
      const pdx = body.x - G.ship.x;
      const pdy = body.y - G.ship.y;
      const pDistSq = pdx * pdx + pdy * pdy;
      const pDist = Math.sqrt(pDistSq);
      if (pDist > GRAVITY_MIN_DIST && pDist < GRAVITY_MAX_DIST) {
        const force = GRAVITY_CONSTANT * body.mass / pDistSq;
        G.ship.vx += (pdx / pDist) * force * dt;
        G.ship.vy += (pdy / pDist) * force * dt;
      }

      // Apply to AI opponents
      for (let i = 0; i < G.opponents.length; ++i) {
        const ai = G.opponents[i];
        if (ai.finished) continue;
        const adx = body.x - ai.x;
        const ady = body.y - ai.y;
        const aDistSq = adx * adx + ady * ady;
        const aDist = Math.sqrt(aDistSq);
        if (aDist > GRAVITY_MIN_DIST && aDist < GRAVITY_MAX_DIST) {
          const force = GRAVITY_CONSTANT * body.mass / aDistSq;
          ai.vx += (adx / aDist) * force * dt;
          ai.vy += (ady / aDist) * force * dt;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WORMHOLES
     ══════════════════════════════════════════════════════════════════ */

  function checkWormholes(dt) {
    if (G.state !== STATE_PLAYING) return;
    const holes = G.raceWormholes;
    if (!holes || !holes.length) return;

    // Player wormhole cooldown
    if (G.wormholeCooldown > 0) G.wormholeCooldown -= dt;

    // Check player
    if (G.wormholeCooldown <= 0) {
      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - G.ship.x;
        const dy = wh.y - G.ship.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          // Particle burst at entry
          particles.burst(G.ship.x, G.ship.y, 20, {
            color: wh.color, speed: 4, life: 0.6, size: 3
          });

          // Teleport
          G.ship.x = dest.x + Math.cos(G.ship.angle) * (WORMHOLE_RADIUS + 5);
          G.ship.y = dest.y + Math.sin(G.ship.angle) * (WORMHOLE_RADIUS + 5);

          // Particle burst at exit
          particles.burst(G.ship.x, G.ship.y, 20, {
            color: dest.color, speed: 4, life: 0.6, size: 3
          });

          floatingText.add(G.ship.x, G.ship.y - 25, 'WARP!', {
            color: '#fff', font: 'bold 14px sans-serif'
          });

          screenShake.trigger(6, 250);
          SZ.GameAudio.play('zap', { pitch: 0.6 });
          G.wormholeCooldown = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }

    // AI wormhole cooldowns
    for (let ai_i = 0; ai_i < G.opponents.length; ++ai_i) {
      if (G.aiWormholeCooldowns[ai_i] > 0)
        G.aiWormholeCooldowns[ai_i] -= dt;
    }

    // Check AI ships
    for (let ai_i = 0; ai_i < G.opponents.length; ++ai_i) {
      const ai = G.opponents[ai_i];
      if (ai.finished || G.aiWormholeCooldowns[ai_i] > 0) continue;

      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - ai.x;
        const dy = wh.y - ai.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          particles.burst(ai.x, ai.y, 10, {
            color: wh.color, speed: 3, life: 0.4, size: 2
          });

          ai.x = dest.x + Math.cos(ai.angle) * (WORMHOLE_RADIUS + 5);
          ai.y = dest.y + Math.sin(ai.angle) * (WORMHOLE_RADIUS + 5);

          particles.burst(ai.x, ai.y, 10, {
            color: dest.color, speed: 3, life: 0.4, size: 2
          });

          G.aiWormholeCooldowns[ai_i] = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }
  }

  Object.assign(NS.module('features'), {
    checkBoostPads, checkHazards, applyGravity, checkWormholes
  });
})();
