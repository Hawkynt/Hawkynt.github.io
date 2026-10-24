;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.powerups.spawnPowerup = function spawnPowerup(timestamp) {
    const candidates = [];
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (S.maze[y][x] === C.T_EMPTY && !(y >= 11 && y <= 17 && x >= 9 && x <= 18))
          candidates.push({ x, y });

    if (candidates.length === 0)
      return;

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const type = T.POWERUP_TYPES[Math.floor(Math.random() * T.POWERUP_TYPES.length)];

    S.fieldPowerup = {
      tileX: tile.x,
      tileY: tile.y,
      type: type,
      spawnTime: timestamp
    };
  }

  NS.powerups.updatePowerups = function updatePowerups(dt, timestamp) {
    /* Spawn timing */
    if (!S.fieldPowerup && S.dotsEaten >= C.POWERUP_MIN_DOTS) {
      if (timestamp - S.lastPowerupTime >= C.POWERUP_SPAWN_INTERVAL) {
        NS.powerups.spawnPowerup(timestamp);
        S.lastPowerupTime = timestamp;
      }
    }

    /* Field powerup expiry */
    if (S.fieldPowerup && timestamp - S.fieldPowerup.spawnTime >= C.POWERUP_LIFETIME)
      S.fieldPowerup = null;

    /* Active effect expiry */
    for (let i = S.activePowerups.length - 1; i >= 0; --i) {
      if (timestamp >= S.activePowerups[i].expireTime) {
        NS.powerups.expirePowerup(S.activePowerups[i]);
        S.activePowerups.splice(i, 1);
      }
    }
  }

  NS.powerups.collectPowerup = function collectPowerup(timestamp) {
    if (!S.fieldPowerup)
      return;
    if (S.pacman.tileX !== S.fieldPowerup.tileX || S.pacman.tileY !== S.fieldPowerup.tileY)
      return;

    const type = S.fieldPowerup.type;
    const px = S.fieldPowerup.tileX * C.TILE + C.TILE / 2;
    const py = S.fieldPowerup.tileY * C.TILE + C.TILE / 2;

    S.fieldPowerup = null;

    NS.powerups.applyPowerup(type, timestamp);
    SZ.GameAudio.play(type.id === 'extralife' ? 'levelup' : 'pickup', { pitch: 1.2 });
    E.particles.burst(px, py, 15, { color: type.color, speed: 3 });
    E.floatingText.add(px, py, type.name, { color: type.color, font: 'bold 12px sans-serif' });
  }

  NS.powerups.applyPowerup = function applyPowerup(type, timestamp) {
    switch (type.id) {
      case 'speed':
        S.pacman.speed *= 1.4;
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'freeze':
        S.ghostsFrozen = true;
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'multiplier':
        S.scoreMultiplier = 2;
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'extralife':
        ++S.lives;
        NS.status.updateStatus();
        break;
      case 'magnet':
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'phase':
        S.pacmanPhasing = true;
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
    }
  }

  NS.powerups.expirePowerup = function expirePowerup(ap) {
    switch (ap.type.id) {
      case 'speed':
        S.pacman.speed = 2 * S.levelConfig.pac;
        break;
      case 'freeze':
        S.ghostsFrozen = false;
        break;
      case 'multiplier':
        S.scoreMultiplier = 1;
        break;
      case 'phase':
        S.pacmanPhasing = false;
        break;
    }
  }

})();
