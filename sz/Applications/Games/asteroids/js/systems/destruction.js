/* Destruction: asteroid damage and splits with rock-type death effects, ship
   loss with shield save and respawn, enemy and ally deaths, bonus lives. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;

  function damageAsteroid(asteroid, index) {
    --asteroid.hp;
    asteroid.hitFlash = 150;

    if (asteroid.hp > 0) {
      if (asteroid.damageCracks.length === 0)
        asteroid.damageCracks = NS.rules.generateCrackPattern(asteroid.radius);
      else
        asteroid.damageCracks.push(...NS.rules.generateCrackPattern(asteroid.radius).slice(0, 2));

      D.particles.burst(asteroid.x, asteroid.y, 4, {
        speed: 2, color: asteroid.palette.edge, size: 2, life: 0.3, decay: 0.05
      });
      SZ.GameAudio.play('hit', { pitch: 1.6, volume: 0.5 });
      return;
    }

    destroyAsteroid(asteroid, index);
  }

  function destroyAsteroid(asteroid, index) {
    S.asteroids.splice(index, 1);
    ++S.stats.asteroidsDestroyed;
    NS.combo.addKill();

    const p = asteroid.palette;
    D.particles.burst(asteroid.x, asteroid.y, 14, {
      speed: 3.5, color: p.light, size: 3, life: 0.7,
      decay: 0.02, shape: 'square', rotationSpeed: (Math.random() - 0.5) * 0.3
    });
    D.particles.burst(asteroid.x, asteroid.y, 6, {
      speed: 2, color: p.edge, size: 2, life: 0.5, decay: 0.03
    });
    NS.shockwaves.addShockwave(asteroid.x, asteroid.y, {
      maxRadius: asteroid.radius * 1.8, speed: 2.5, color: p.edge, lineWidth: 1.5
    });

    if (asteroid.size === 'large')
      NS.shockwaves.triggerScreenFlash(0.08);

    const comboPitch = 1 + Math.min(S.combo.count - 1, 8) * 0.04;
    if (asteroid.rockType === 'exploding')
      SZ.GameAudio.play('explode');
    else if (asteroid.rockType === 'electric')
      SZ.GameAudio.play('zap', { pitch: 0.8 });
    else if (asteroid.size === 'large')
      SZ.GameAudio.play('explode', { pitch: comboPitch * 1.2, volume: 0.6 });
    else
      SZ.GameAudio.play('smallExplode', { pitch: comboPitch * (asteroid.size === 'small' ? 1.4 : 1) });

    /* Rock-type-specific death effects */
    if (asteroid.rockType === 'exploding') {
      NS.shockwaves.addShockwave(asteroid.x, asteroid.y, { maxRadius: C.EXPLOSION_RADIUS, speed: 5, color: '#ff6600', lineWidth: 3 });
      D.particles.burst(asteroid.x, asteroid.y, 30, { speed: 6, color: '#ff8800', size: 4, life: 0.8, decay: 0.015 });
      D.particles.burst(asteroid.x, asteroid.y, 15, { speed: 3, color: '#ffcc00', size: 3, life: 0.6, decay: 0.025 });
      NS.shockwaves.triggerScreenFlash(0.25);
      D.shake.trigger(8, 400);
      for (let ai = S.asteroids.length - 1; ai >= 0; --ai) {
        if (NS.rules.distWrapped(S.asteroids[ai], asteroid) < C.EXPLOSION_RADIUS)
          damageAsteroid(S.asteroids[ai], ai);
      }
      if (S.ship && S.invulnTimer <= 0 && NS.rules.distWrapped(S.ship, asteroid) < C.EXPLOSION_RADIUS)
        destroyShip();
      for (let ei = S.enemies.length - 1; ei >= 0; --ei) {
        if (NS.rules.distWrapped(S.enemies[ei], asteroid) < C.EXPLOSION_RADIUS)
          damageEnemy(S.enemies[ei], ei, 1);
      }
    }

    if (asteroid.rockType === 'ice')
      S.zones.push(NS.entities.createZone('ice', asteroid.x, asteroid.y, { radius: C.ICE_ZONE_RADIUS, duration: C.ICE_ZONE_DURATION }));

    if (asteroid.rockType === 'lava') {
      const patchCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < patchCount; ++i) {
        const ox = asteroid.x + (Math.random() - 0.5) * 60;
        const oy = asteroid.y + (Math.random() - 0.5) * 60;
        S.zones.push(NS.entities.createZone('fire', ox, oy, { radius: C.FIRE_PATCH_RADIUS, duration: C.FIRE_PATCH_DURATION }));
      }
      D.particles.burst(asteroid.x, asteroid.y, 20, { speed: 4, color: '#ff4400', size: 3, life: 0.6, decay: 0.02 });
    }

    if (asteroid.rockType === 'electric') {
      S.empActive = true;
      S.empTimer = C.EMP_DURATION;
      NS.shockwaves.addShockwave(asteroid.x, asteroid.y, { maxRadius: 150, speed: 6, color: '#88ccff', lineWidth: 2 });
      D.particles.burst(asteroid.x, asteroid.y, 25, { speed: 5, color: '#aaddff', size: 2, life: 0.5, decay: 0.03 });
      D.floatingText.add(asteroid.x, asteroid.y - 30, 'EMP!', { color: '#88ccff', decay: 0.015, font: NS.rules.scaledFont(16) });
      NS.shockwaves.triggerScreenFlash(0.15);
    }

    const mult = NS.combo.getComboMultiplier() * NS.rules.modeConfig().scoreMult;
    const pts = Math.round(asteroid.points * mult);
    S.score += pts;

    const comboText = mult > 1 ? ' x' + mult : '';
    D.floatingText.add(asteroid.x, asteroid.y, '+' + pts + comboText, {
      color: mult > 1 ? '#ffd700' : '#ff0',
      decay: 0.02,
      font: NS.rules.scaledFont(mult >= 4 ? 16 : 14)
    });

    NS.status.updateDisplays();
    checkBonusLife();
    NS.powerups.trySpawnPowerup(asteroid.x, asteroid.y, C.ASTEROID_SIZES[asteroid.size].dropRate);

    if (asteroid.size === 'large') {
      S.asteroids.push(NS.entities.createAsteroid(asteroid.x, asteroid.y, 'medium', asteroid.rockType));
      S.asteroids.push(NS.entities.createAsteroid(asteroid.x, asteroid.y, 'medium', asteroid.rockType));
    } else if (asteroid.size === 'medium') {
      S.asteroids.push(NS.entities.createAsteroid(asteroid.x, asteroid.y, 'small', asteroid.rockType));
      S.asteroids.push(NS.entities.createAsteroid(asteroid.x, asteroid.y, 'small', asteroid.rockType));
    }
  }

  function destroyShip() {
    if (!S.ship) return;

    if (S.powerupState.shield.active && !S.empActive) {
      S.powerupState.shield.active = false;
      S.powerupState.shield.timer = 0;
      D.particles.burst(S.ship.x, S.ship.y, 20, { speed: 4, color: '#44aaff', size: 2, life: 0.5, decay: 0.03 });
      NS.shockwaves.addShockwave(S.ship.x, S.ship.y, { maxRadius: 40, speed: 3, color: '#44aaff' });
      S.invulnTimer = 500;
      D.floatingText.add(S.ship.x, S.ship.y - 20, 'SHIELD!', { color: '#44aaff', decay: 0.02, font: NS.rules.scaledFont(14) });
      SZ.GameAudio.play('zap', { pitch: 0.6 });
      return;
    }

    D.particles.burst(S.ship.x, S.ship.y, 35, { speed: 5, color: '#fff', size: 3, life: 0.8, decay: 0.015 });
    D.particles.burst(S.ship.x, S.ship.y, 20, { speed: 3, color: '#f80', size: 4, life: 0.6, decay: 0.02 });
    D.particles.burst(S.ship.x, S.ship.y, 10, { speed: 2, color: '#f44', size: 5, life: 0.5, decay: 0.025 });
    NS.shockwaves.addShockwave(S.ship.x, S.ship.y, { maxRadius: 80, speed: 3, color: '#f80' });
    NS.shockwaves.triggerScreenFlash(0.3);
    D.shake.trigger(10, 500);
    SZ.GameAudio.play('explode', { pitch: 0.7 });

    if (S.lives !== Infinity)
      --S.lives;
    S.combo.count = 0;
    NS.status.updateDisplays();
    S.ship = null;

    if (S.lives <= 0) {
      NS.flow.doGameOver();
      return;
    }

    S.respawnTimer = C.RESPAWN_DELAY;
  }

  function damageEnemy(enemy, index, amount) {
    enemy.hp -= amount;
    enemy.hitFlash = 150;
    if (enemy.type === 'boss')
      enemy.shieldFlash = 200;
    if (enemy.hp <= 0)
      destroyEnemy(enemy, index);
  }

  function destroyEnemy(enemy, index) {
    S.enemies.splice(index, 1);
    NS.combo.addKill();

    const color = T.ENEMY_TYPES[enemy.type]?.color ?? '#0f0';
    const isBoss = enemy.type === 'boss';
    const burstCount = isBoss ? 50 : 25;
    const shockRadius = isBoss ? 100 : 50;

    D.particles.burst(enemy.x, enemy.y, burstCount, { speed: isBoss ? 6 : 4, color, size: 3, life: 0.6, decay: 0.02 });
    D.particles.burst(enemy.x, enemy.y, Math.round(burstCount / 2), { speed: 2, color: '#fff', size: 2, life: 0.4, decay: 0.03 });
    NS.shockwaves.addShockwave(enemy.x, enemy.y, { maxRadius: shockRadius, speed: 3, color });
    NS.shockwaves.triggerScreenFlash(isBoss ? 0.3 : 0.12);
    SZ.GameAudio.play('explode', { pitch: isBoss ? 0.5 : 1.1, volume: isBoss ? 1 : 0.7 });

    if (isBoss) {
      D.shake.trigger(12, 600);
      D.particles.confetti(enemy.x, enemy.y, 40);
      S.bossActive = false;
    }

    if (enemy.type === 'minelayer') {
      for (let i = S.zones.length - 1; i >= 0; --i)
        if (S.zones[i].type === 'mine')
          NS.zones.detonateMine(S.zones[i], i);
    }

    const mult = NS.combo.getComboMultiplier() * NS.rules.modeConfig().scoreMult;
    const pts = Math.round(enemy.points * mult);
    S.score += pts;

    const comboText = mult > 1 ? ' x' + mult : '';
    D.floatingText.add(enemy.x, enemy.y, '+' + pts + comboText, { color, decay: 0.02, font: NS.rules.scaledFont(isBoss ? 18 : 14) });

    NS.status.updateDisplays();
    checkBonusLife();
    NS.powerups.trySpawnPowerup(enemy.x, enemy.y, isBoss ? 0.80 : 0.30);
  }

  function destroyAlly(ally, index) {
    S.allies.splice(index, 1);
    D.particles.burst(ally.x, ally.y, 20, { speed: 4, color: '#44ffaa', size: 3, life: 0.6, decay: 0.02 });
    NS.shockwaves.addShockwave(ally.x, ally.y, { maxRadius: 40, speed: 3, color: '#44ffaa' });
    D.floatingText.add(ally.x, ally.y - 20, 'ALLY LOST!', { color: '#ff4444', decay: 0.015, font: NS.rules.scaledFont(14) });
    SZ.GameAudio.play('hurt');
    NS.powerups.trySpawnPowerup(ally.x, ally.y, 0.50);
  }

  function checkBonusLife() {
    if (!S.nextExtraLife || S.lives === Infinity) return;
    if (S.score >= S.nextExtraLife) {
      ++S.lives;
      NS.status.updateDisplays();
      D.floatingText.add(S.W / 2, S.H / 3, 'EXTRA LIFE!', { color: '#44ff44', decay: 0.012, font: NS.rules.scaledFont(20) });
      D.particles.sparkle(S.W / 2, S.H / 3, 20, { color: '#44ff44', speed: 3 });
      SZ.GameAudio.play('powerup');
      S.nextExtraLife += NS.rules.modeConfig().bonusLifeEvery;
    }
  }

  Object.assign(NS.destruction, {
    damageAsteroid, destroyAsteroid, destroyShip,
    damageEnemy, destroyEnemy, destroyAlly, checkBonusLife
  });
})();
