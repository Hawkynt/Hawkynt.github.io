/* The game flow: the per-step simulation update, level starts and warps, level
   advance, pause and game over -- plus the auto-pause hook for hidden windows. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function spawnLevelAsteroids() {
    const cfg = NS.rules.modeConfig();
    S.asteroids = [];
    const fieldScale = Math.sqrt(S.W * S.H / (520 * 520));

    if (S.level === 1) {
      let x, y;
      const minDist = Math.max(120, S.W * 0.2);
      do {
        x = Math.random() * S.W;
        y = Math.random() * S.H;
      } while (S.ship && NS.rules.dist({ x, y }, S.ship) < minDist);
      S.asteroids.push(NS.entities.createAsteroid(x, y, 'medium', 'normal'));
      return;
    }

    const baseCount = Math.min(1 + S.level, 12) + cfg.extraAsteroids;
    const count = Math.max(2, Math.round(baseCount * fieldScale));

    for (let i = 0; i < count; ++i)
      S.asteroids.push(NS.entities.spawnAsteroidAwayFromShip());
  }

  function checkLevelAdvance() {
    if (S.gameMode === 'survival') return;
    if (S.warpState) return;
    if (S.bossActive) return;
    if (S.asteroids.length === 0 && S.enemies.length === 0) {
      ++S.level;
      S.allySpawnedForLevel = false;
      NS.status.updateDisplays();
      SZ.GameAudio.play('levelup');
      NS.warp.startWarp();
    }
  }

  function update(dt) {
    S.gameTime += dt;

    /* Respawn counts game time only, so it holds while paused */
    if (!S.ship && S.respawnTimer > 0) {
      S.respawnTimer -= dt;
      if (S.respawnTimer <= 0) {
        S.ship = NS.entities.createShip();
        S.invulnTimer = C.INVULN_DURATION;
      }
    }

    /* Ship controls */
    if (S.ship) {
      if (S.keys['ArrowLeft'] || S.keys['a'] || S.keys['A'])
        S.ship.angle -= C.SHIP_ROTATION_SPEED;
      if (S.keys['ArrowRight'] || S.keys['d'] || S.keys['D'])
        S.ship.angle += C.SHIP_ROTATION_SPEED;

      /* Mouse: rotate ship toward cursor */
      if (S.mouseActive) {
        const target = Math.atan2(S.mouseY - S.ship.y, S.mouseX - S.ship.x);
        let diff = target - S.ship.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.min(Math.abs(diff), C.SHIP_ROTATION_SPEED) * Math.sign(diff);
        S.ship.angle += turn;
      }

      /* Right-mouse thrust toward cursor */
      if (S.mouseRightDown && S.mouseActive && S.ship) {
        const thrustAngle = Math.atan2(S.mouseY - S.ship.y, S.mouseX - S.ship.x);
        S.ship.vx += Math.cos(thrustAngle) * C.SHIP_THRUST;
        S.ship.vy += Math.sin(thrustAngle) * C.SHIP_THRUST;
        S.ship.thrusting = true;

        const exhaust = thrustAngle + Math.PI;
        const ex = S.ship.x + Math.cos(exhaust) * C.SHIP_SIZE * 0.8;
        const ey = S.ship.y + Math.sin(exhaust) * C.SHIP_SIZE * 0.8;
        const trailColors = ['#f80', '#ff0', '#fa0', '#f60'];
        D.particles.trail(ex, ey, {
          vx: Math.cos(exhaust) * 2 + (Math.random() - 0.5),
          vy: Math.sin(exhaust) * 2 + (Math.random() - 0.5),
          color: trailColors[Math.floor(Math.random() * trailColors.length)],
          size: 2 + Math.random() * 2.5,
          life: 0.45, decay: 0.04, shrink: 0.93
        });
      } else {
        S.ship.thrusting = !!(S.keys['ArrowUp'] || S.keys['w'] || S.keys['W']);
        if (S.ship.thrusting) {
          S.ship.vx += Math.cos(S.ship.angle) * C.SHIP_THRUST;
          S.ship.vy += Math.sin(S.ship.angle) * C.SHIP_THRUST;

          const exhaust = S.ship.angle + Math.PI;
          const ex = S.ship.x + Math.cos(exhaust) * C.SHIP_SIZE * 0.8;
          const ey = S.ship.y + Math.sin(exhaust) * C.SHIP_SIZE * 0.8;
          const trailColors = ['#f80', '#ff0', '#fa0', '#f60'];
          D.particles.trail(ex, ey, {
            vx: Math.cos(exhaust) * 2 + (Math.random() - 0.5),
            vy: Math.sin(exhaust) * 2 + (Math.random() - 0.5),
            color: trailColors[Math.floor(Math.random() * trailColors.length)],
            size: 2 + Math.random() * 2.5,
            life: 0.45, decay: 0.04, shrink: 0.93
          });
        }
      }

      S.ship.vx *= C.SHIP_FRICTION;
      S.ship.vy *= C.SHIP_FRICTION;
      S.ship.x += S.ship.vx;
      S.ship.y += S.ship.vy;
      NS.rules.wrap(S.ship);

      if (S.invulnTimer > 0) S.invulnTimer -= dt;
      if (S.hyperspaceCooldown > 0) S.hyperspaceCooldown -= dt;

      /* Auto-fire on held space or held mouse button (not during warp) */
      if ((S.keys[' '] || S.mouseDown) && !S.warpState) {
        S.shootCooldownTimer -= dt;
        if (S.shootCooldownTimer <= 0) {
          NS.shooting.shoot();
          S.shootCooldownTimer = (!S.empActive && S.powerupState.rapid.active) ? C.SHOOT_COOLDOWN_RAPID : C.SHOOT_COOLDOWN;
        }
      }
    }

    /* Star drift / warp */
    NS.background.updateStars();

    /* During warp, skip normal entity updates */
    if (S.warpState) {
      S.warpState.timer -= dt;

      D.particles.update();
      D.shake.update(dt);
      D.floatingText.update();
      NS.shockwaves.updateShockwaves();
      if (S.screenFlashAlpha > 0)
        S.screenFlashAlpha = Math.max(0, S.screenFlashAlpha - 0.02);

      if (S.warpState.timer <= 0)
        NS.warp.endWarp();
      return;
    }

    /* Asteroids */
    for (const a of S.asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.rotationSpeed;
      NS.rules.wrap(a);
      if (a.hitFlash > 0) a.hitFlash -= dt;

      /* Lava trail */
      if (a.rockType === 'lava') {
        a.lavaTrailTimer -= dt;
        if (a.lavaTrailTimer <= 0) {
          a.lavaTrailTimer = C.LAVA_TRAIL_INTERVAL;
          S.zones.push(NS.entities.createZone('fire', a.x, a.y, { radius: 12, duration: 2000 }));
        }
        D.particles.trail(a.x, a.y, {
          vx: (Math.random() - 0.5) * 0.5, vy: -0.5 - Math.random(),
          color: Math.random() < 0.5 ? '#ff4400' : '#ff8800', size: 1.5 + Math.random(), life: 0.3, decay: 0.05
        });
      }

      /* Ice sparkle */
      if (a.rockType === 'ice') {
        a.sparkleTimer -= dt;
        if (a.sparkleTimer <= 0) {
          a.sparkleTimer = 200 + Math.random() * 300;
          const sa = NS.rules.randomAngle();
          const sr = a.radius * 0.6 * Math.random();
          D.particles.sparkle(a.x + Math.cos(sa) * sr, a.y + Math.sin(sa) * sr, 1, { color: '#cceeFF', speed: 0.5 });
        }
      }
    }

    /* Bullets */
    for (let i = S.bullets.length - 1; i >= 0; --i) {
      const b = S.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      NS.rules.wrap(b);
      if (b.life <= 0) S.bullets.splice(i, 1);
    }

    /* Homing adjustment */
    NS.homing.updateHomingBullets();

    /* Enemy bullets */
    for (let i = S.enemyBullets.length - 1; i >= 0; --i) {
      const b = S.enemyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      NS.rules.wrap(b);
      if (b.life <= 0) S.enemyBullets.splice(i, 1);
    }

    /* Ally bullets */
    for (let i = S.allyBullets.length - 1; i >= 0; --i) {
      const b = S.allyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      NS.rules.wrap(b);
      if (b.life <= 0) S.allyBullets.splice(i, 1);
    }

    /* Enemies */
    const cfg = NS.rules.modeConfig();
    for (let i = S.enemies.length - 1; i >= 0; --i) {
      const e = S.enemies[i];
      e.pulsePhase += dt / 1000 * 4;
      e.lightPhase += dt / 1000 * 8;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      switch (e.type) {
        case 'ufo':
        case 'ufoSmall':
          e.x += e.vx;
          e.y += e.vy;
          if (Math.random() < 0.01) e.vy = (Math.random() - 0.5) * 2;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            NS.shooting.enemyShoot(e);
            e.shootTimer = cfg.ufoShootInterval * (0.7 + Math.random() * 0.6);
          }
          if (e.x < -40 || e.x > S.W + 40) {
            S.enemies.splice(i, 1);
            continue;
          }
          break;

        case 'drone':
          if (S.ship) {
            const da = Math.atan2(S.ship.y - e.y, S.ship.x - e.x);
            e.vx += Math.cos(da) * 0.15;
            e.vy += Math.sin(da) * 0.15;
            const dspd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
            if (dspd > 4) {
              e.vx = (e.vx / dspd) * 4;
              e.vy = (e.vy / dspd) * 4;
            }
          }
          e.x += e.vx;
          e.y += e.vy;
          NS.rules.wrap(e);
          D.particles.trail(e.x, e.y, { color: '#ff4444', size: 1.5, life: 0.2, decay: 0.06 });
          break;

        case 'gunship':
          e.x += e.vx;
          e.y += e.vy;
          e.vy = Math.sin(e.pulsePhase * 0.5) * 1.5 * e.strafeDir;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            NS.shooting.enemyShoot(e);
            e.shootTimer = cfg.ufoShootInterval * 1.2;
          }
          if (e.x < -40 || e.x > S.W + 40) {
            S.enemies.splice(i, 1);
            continue;
          }
          break;

        case 'minelayer':
          e.weavePhase += dt / 1000;
          e.x += e.vx;
          e.y += Math.sin(e.weavePhase * 2) * 2;
          e.mineTimer -= dt;
          if (e.mineTimer <= 0) {
            e.mineTimer = 3000;
            S.zones.push(NS.entities.createZone('mine', e.x, e.y, { radius: C.MINE_RADIUS, duration: C.MINE_DURATION }));
          }
          if (e.x < -40 || e.x > S.W + 40) {
            S.enemies.splice(i, 1);
            continue;
          }
          break;

        case 'stealth':
          e.x += e.vx;
          e.y += e.vy;
          e.cloakTimer -= dt;
          if (e.cloakTimer <= 0) {
            e.visible = !e.visible;
            e.cloakTimer = e.cloakCycle;
            if (e.visible && S.ship)
              NS.shooting.enemyShoot(e);
          }
          if (e.x < -40 || e.x > S.W + 40) {
            S.enemies.splice(i, 1);
            continue;
          }
          break;

        case 'boss':
          if (!e.entered) {
            e.y += e.vy;
            if (e.y >= S.H * 0.2) {
              e.entered = true;
              e.vy = 0;
            }
          } else {
            e.x += Math.sin(e.pulsePhase * 0.3) * 1.5;
            e.y += Math.cos(e.pulsePhase * 0.2) * 0.5;
            e.x = NS.rules.clamp(e.x, 40, S.W - 40);
            e.y = NS.rules.clamp(e.y, 40, S.H * 0.5);
          }
          if (e.shieldFlash > 0) e.shieldFlash -= dt;
          e.attackTimer -= dt;
          if (e.attackTimer <= 0 && e.entered) {
            e.attackPattern = (e.attackPattern + 1) % 3;
            NS.shooting.enemyShoot(e);
            e.attackTimer = 2500;
          }
          break;
      }
    }

    /* Enemy spawning */
    if (!S.bossActive) {
      S.enemySpawnTimer -= dt;
      const nonBossEnemies = S.enemies.filter(e => e.type !== 'boss').length;
      if (S.enemySpawnTimer <= 0 && nonBossEnemies < C.MAX_ENEMIES && S.asteroids.length > 0) {
        NS.spawn.spawnEnemy();
        S.enemySpawnTimer = cfg.ufoInterval * (0.7 + Math.random() * 0.6);
      }
    }

    /* Allies */
    for (const ally of S.allies) {
      if (!ally.entered) {
        ally.x += ally.vx;
        if (ally.x > 40 && ally.x < S.W - 40) {
          ally.entered = true;
          ally.vx = 0;
          ally.vy = 0;
        }
        continue;
      }

      /* Follow player */
      if (S.ship) {
        const dx = S.ship.x + Math.cos(S.ship.angle + Math.PI) * C.ALLY_FOLLOW_DIST - ally.x;
        const dy = S.ship.y + Math.sin(S.ship.angle + Math.PI) * C.ALLY_FOLLOW_DIST - ally.y;
        ally.vx += dx * 0.005;
        ally.vy += dy * 0.005;
        ally.vx *= 0.96;
        ally.vy *= 0.96;
      }
      ally.x += ally.vx;
      ally.y += ally.vy;
      NS.rules.wrap(ally);

      /* Find target */
      let nearest = null, nearestDist = Infinity;
      for (const a of S.asteroids) {
        const d = NS.rules.distWrapped(ally, a);
        if (d < nearestDist) { nearestDist = d; nearest = a; }
      }
      for (const e of S.enemies) {
        const d = NS.rules.distWrapped(ally, e);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      if (nearest)
        ally.angle = Math.atan2(nearest.y - ally.y, nearest.x - ally.x);

      /* Shoot */
      ally.shootTimer -= dt;
      if (ally.shootTimer <= 0 && nearest) {
        ally.shootTimer = C.ALLY_SHOOT_INTERVAL;
        const tipX = ally.x + Math.cos(ally.angle) * 8;
        const tipY = ally.y + Math.sin(ally.angle) * 8;
        S.allyBullets.push({
          x: tipX, y: tipY,
          vx: Math.cos(ally.angle) * C.BULLET_SPEED * 0.9,
          vy: Math.sin(ally.angle) * C.BULLET_SPEED * 0.9,
          life: C.BULLET_LIFETIME * 0.7
        });
      }

      /* Engine trail */
      D.particles.trail(ally.x - Math.cos(ally.angle) * 6, ally.y - Math.sin(ally.angle) * 6, {
        color: '#44ffaa', size: 1.2, life: 0.2, decay: 0.06
      });
    }

    /* Collectible powerups */
    for (let i = S.collectiblePowerups.length - 1; i >= 0; --i) {
      const p = S.collectiblePowerups[i];
      p.x += p.vx;
      p.y += p.vy;
      p.phase += dt / 1000 * 3;
      p.lifetime -= dt;
      NS.rules.wrap(p);
      if (p.lifetime <= 0) S.collectiblePowerups.splice(i, 1);
    }

    /* Zones */
    NS.zones.updateZones(dt);
    if (S.fireDamageCooldown > 0) S.fireDamageCooldown -= dt;

    /* EMP timer */
    if (S.empActive) {
      S.empTimer -= dt;
      if (S.empTimer <= 0)
        S.empActive = false;
    }

    /* Survival mode: spawn asteroids continuously */
    if (S.gameMode === 'survival') {
      S.survivalSpawnTimer -= dt;
      if (S.survivalSpawnTimer <= 0) {
        const speedMult = 1 + S.gameTime / 60000 * 0.3;
        const a = NS.entities.spawnAsteroidAwayFromShip();
        a.vx *= speedMult;
        a.vy *= speedMult;
        S.asteroids.push(a);
        S.survivalSpawnTimer = Math.max(2000, cfg.spawnInterval - S.gameTime / 1000 * 50);
      }
    }

    /* Zen mode timer */
    if (S.gameMode === 'zen') {
      S.zenTimer -= dt;
      NS.status.updateDisplays();
      if (S.zenTimer <= 0) {
        S.zenTimer = 0;
        doGameOver();
        return;
      }
    }

    /* Collisions */
    NS.collision.checkCollisions();

    /* Boss defeated: spawn level asteroids */
    if (S.bossActive && S.enemies.filter(e => e.type === 'boss').length === 0) {
      S.bossActive = false;
      spawnLevelAsteroids();
    }

    /* Effects */
    D.particles.update();
    D.shake.update(dt);
    D.floatingText.update();
    NS.shockwaves.updateShockwaves();
    NS.combo.updateCombo(dt);
    if (!S.empActive)
      NS.powerups.updatePowerupTimers(dt);

    if (S.screenFlashAlpha > 0)
      S.screenFlashAlpha = Math.max(0, S.screenFlashAlpha - 0.02);

    /* Level advance */
    checkLevelAdvance();
  }

  function doGameOver() {
    S.gameActive = false;
    S.gameOverFlag = true;
    SZ.GameAudio.play('lose');
    NS.highscores.checkHighScore();
  }

  function togglePause() {
    if (!S.gameActive || S.gameOverFlag || S.modeSelectActive) return;
    S.gamePaused = !S.gamePaused;
    if (!S.gamePaused)
      S.lastTime = performance.now();
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.gameActive && !S.gamePaused && !S.gameOverFlag && !S.modeSelectActive,
    pause: togglePause
  });

  Object.assign(NS.flow, {
    spawnLevelAsteroids, checkLevelAdvance, update, doGameOver, togglePause
  });
})();
