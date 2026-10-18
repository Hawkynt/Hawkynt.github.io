/* The alien fleet: march speed and steps, divers, alien fire, alien bullets and the bonus UFO.
   Owns G.aliens, G.divers, G.alienBullets, G.ufo and their timers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    GAME_W, GAME_H, PLAYER_W, PLAYER_H, ALIEN_BULLET_SPEED, ALIEN_BULLET_W, ALIEN_BULLET_H, UFO_W, UFO_H,
    UFO_SPEED, UFO_MIN_INTERVAL, UFO_MAX_INTERVAL, ALIEN_DROP, BASE_MOVE_INTERVAL, MIN_MOVE_INTERVAL,
    MARCH_PITCHES
  } = NS.constants;
  const { rectsOverlap } = NS.data;
  const { playSfx } = NS.audio;
  const { particles, addFlare } = NS.fx;
  const { killPlayer } = NS.combat;

  let ufoBlipTimer = 0;

  function calcMoveInterval() {
    const aliveCount = G.aliens.filter(a => a.alive && !a.diving).length;
    const total = G.aliens.length || 1;
    if (aliveCount === 0)
      return BASE_MOVE_INTERVAL;
    const ratio = aliveCount / total;
    const speedBoost = Math.max(0, (G.level - 1) * 30);
    const interval = Math.max(MIN_MOVE_INTERVAL, BASE_MOVE_INTERVAL * ratio - speedBoost);
    if (G.gameMode === 'campaign' && G.stageInfo)
      return interval / G.stageInfo.speed;
    return interval;
  }

  function moveAliens() {
    let hitEdge = false;
    const alive = G.aliens.filter(a => a.alive && !a.diving);
    if (alive.length > 0)
      playSfx('thud', { pitch: MARCH_PITCHES[G.marchStep++ % MARCH_PITCHES.length], volume: 0.35 });

    for (const a of alive) {
      a.x += G.alienDir * 6;
      if (a.x + a.w > GAME_W - 15 || a.x < 15)
        hitEdge = true;
    }

    if (hitEdge) {
      G.alienDir *= -1;
      for (const a of alive) {
        a.x += G.alienDir * 6;
        a.y += ALIEN_DROP;
      }
    }

    G.alienFrame = 1 - G.alienFrame;
    G.alienMoveInterval = calcMoveInterval();
  }

  function tryDiveAttack() {
    if (G.divers.length >= 2) return;
    if (G.level < 3 && G.gameMode === 'classic' && !G.aliens.some(a => a.isDiver)) return;

    const diveChance = 0.015 + G.level * 0.003;
    if (G.rand() > diveChance) return;

    const candidates = G.aliens.filter(a => a.alive && !a.diving);
    if (candidates.length === 0) return;

    const diverCandidates = candidates.filter(a => a.isDiver);
    const pool = diverCandidates.length > 0 && G.rand() < 0.7 ? diverCandidates : candidates;
    const alien = pool[Math.floor(G.rand() * pool.length)];

    alien.diving = true;
    alien.divePhase = 0;
    playSfx('whoosh', { pitch: 0.7, volume: 0.6 });
    G.divers.push(alien);
  }

  function updateDivers(dt) {
    for (let i = G.divers.length - 1; i >= 0; --i) {
      const d = G.divers[i];
      if (!d.alive) {
        G.divers.splice(i, 1);
        continue;
      }

      d.divePhase += dt * 0.005;
      const targetX = G.player.alive ? G.player.x + PLAYER_W / 2 : GAME_W / 2;
      const dx = targetX - (d.x + d.w / 2);
      d.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.02, 2.25) + Math.sin(d.divePhase * 4) * 3;
      d.y += 3.75 + G.level * 0.225;

      particles.trail(d.x + d.w / 2, d.y + d.h, {
        vy: 0.5,
        color: d.color,
        size: 1.5,
        life: 0.2,
      });

      if (G.player.alive && rectsOverlap(d.x, d.y, d.w, d.h, G.player.x, G.player.y, PLAYER_W, PLAYER_H)) {
        d.alive = false;
        G.divers.splice(i, 1);
        killPlayer();
        continue;
      }

      if (d.y > GAME_H + 30) {
        d.alive = false;
        G.divers.splice(i, 1);
      }
    }
  }

  function alienShoot() {
    const alive = G.aliens.filter(a => a.alive && !a.diving);
    if (alive.length === 0) return;

    const bottomAliens = new Map();
    for (const a of alive) {
      const existing = bottomAliens.get(a.col);
      if (!existing || a.y > existing.y)
        bottomAliens.set(a.col, a);
    }

    const shooters = [...bottomAliens.values()];
    const shooter = shooters[Math.floor(G.rand() * shooters.length)];
    playSfx('shoot', { pitch: 0.6, volume: 0.2 });
    addFlare(shooter.x + shooter.w / 2, shooter.y + shooter.h, 'orange', 8, 0.05);

    G.alienBullets.push({
      x: shooter.x + shooter.w / 2 - ALIEN_BULLET_W / 2,
      y: shooter.y + shooter.h,
      w: ALIEN_BULLET_W,
      h: ALIEN_BULLET_H,
      vx: 0,
      vy: ALIEN_BULLET_SPEED,
    });
  }

  function spawnUfo() {
    const goRight = G.rand() < 0.5;
    G.ufo = {
      x: goRight ? -UFO_W : GAME_W,
      y: 37.5,
      w: UFO_W,
      h: UFO_H,
      dir: goRight ? 1 : -1,
      points: [50, 100, 150, 200, 300][Math.floor(G.rand() * 5)],
    };
    ufoBlipTimer = 0;
    playSfx('whoosh', { pitch: 1.6 });
  }

  function updateFleet(alienDt) {
    // Alien movement
    G.alienMoveTimer += alienDt;
    if (G.alienMoveTimer >= G.alienMoveInterval) {
      G.alienMoveTimer = 0;
      moveAliens();
      tryDiveAttack();
    }

    // Alien shooting
    G.alienShootTimer += alienDt;
    if (G.alienShootTimer >= G.alienShootInterval) {
      G.alienShootTimer = 0;
      alienShoot();
    }
  }

  function moveAlienBullets(slowMoActive) {
    // Alien bullets
    const barrierOn = G.specialActive > 0 && G.specialKind === 'barrier';
    for (let i = G.alienBullets.length - 1; i >= 0; --i) {
      const b = G.alienBullets[i];
      b.x += (b.vx || 0) * (slowMoActive ? 0.4 : 1);
      b.y += (b.vy || ALIEN_BULLET_SPEED) * (slowMoActive ? 0.4 : 1);
      if (b.y > GAME_H + 15 || b.x < -45 || b.x > GAME_W + 45) {
        G.alienBullets.splice(i, 1);
        continue;
      }
      if (barrierOn && G.player.alive) {
        const bcx = b.x + b.w / 2 - (G.player.x + PLAYER_W / 2);
        const bcy = b.y + b.h / 2 - (G.player.y + PLAYER_H / 2);
        if (bcx * bcx + bcy * bcy <= 70 * 70) {
          particles.sparkle(b.x + b.w / 2, b.y + b.h / 2, 4, { color: '#3af2ff' });
          G.alienBullets.splice(i, 1);
        }
      }
    }
  }

  function updateUfo(dt) {
    // UFO
    if (!G.ufo && !G.bossActive) {
      G.ufoTimer += dt;
      if (G.ufoTimer >= G.ufoNextSpawn) {
        spawnUfo();
        G.ufoTimer = 0;
        G.ufoNextSpawn = UFO_MIN_INTERVAL + G.rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
      }
    } else if (G.ufo) {
      G.ufo.x += G.ufo.dir * UFO_SPEED;
      /* soft sonar ping while the bonus UFO crosses the screen */
      ufoBlipTimer += dt;
      if (ufoBlipTimer >= 500) {
        ufoBlipTimer = 0;
        playSfx('blip', { volume: 0.15 });
      }
      if ((G.ufo.dir > 0 && G.ufo.x > GAME_W + UFO_W) || (G.ufo.dir < 0 && G.ufo.x + UFO_W < -UFO_W))
        G.ufo = null;
    }
  }

  Object.assign(NS.fleet, {
    calcMoveInterval, moveAliens, updateDivers, updateFleet, moveAlienBullets, updateUfo
  });
})();
