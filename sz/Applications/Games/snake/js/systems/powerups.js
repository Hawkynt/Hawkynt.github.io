/* The power-up engine: field power-up spawning and expiry, collection with its
   effects, the timed active-effect list and the shield consumption. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const { particles, floatingText, sfx } = NS.effects;
  const { randomInt, cellBlockedForSpawn } = NS.rules;

  /* ---- Power-ups ---- */
  function updatePowerups(timestamp) {
    if (!S.gameConfig.powerups)
      return;

    if (S.fieldPowerup && timestamp - S.fieldPowerup.spawnTime >= C.POWERUP_LIFETIME) {
      S.fieldPowerup = null;
      S.lastPowerupTime = timestamp;
    }

    if (!S.fieldPowerup && timestamp - S.lastPowerupTime >= C.POWERUP_SPAWN_DELAY)
      spawnPowerup(timestamp);

    S.activePowerups = S.activePowerups.filter(p =>
      p.expireTime === Infinity || timestamp < p.expireTime
    );
  }

  function spawnPowerup(timestamp) {
    const empty = [];
    for (let x = 0; x < S.cols; ++x)
      for (let y = 0; y < S.rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          empty.push({ x, y });
    if (empty.length === 0)
      return;

    const pos = empty[randomInt(empty.length)];
    S.fieldPowerup = {
      x: pos.x,
      y: pos.y,
      type: C.POWERUP_TYPES[randomInt(C.POWERUP_TYPES.length)],
      spawnTime: timestamp
    };
  }

  function collectPowerup(timestamp) {
    if (!S.fieldPowerup || !S.gameConfig.powerups)
      return;
    const head = S.snake[0];
    if (head.x !== S.fieldPowerup.x || head.y !== S.fieldPowerup.y)
      return;

    const type = S.fieldPowerup.type;
    const cx = head.x * C.CELL + C.CELL / 2, cy = head.y * C.CELL + C.CELL / 2;

    particles.burst(cx, cy, 12, {
      speed: 4, color: type.color, life: 0.8, size: 3, gravity: 0.05, shrink: 0.96
    });
    floatingText.add(cx, cy - 10, type.name, {
      color: type.color, font: 'bold 12px sans-serif', decay: 0.02, vy: -1.5
    });

    sfx.play('powerup');
    applyPowerupEffect(type, timestamp);
    S.fieldPowerup = null;
    S.lastPowerupTime = timestamp;
  }

  function applyPowerupEffect(type, timestamp) {
    switch (type.id) {
      case 'shrink':
        if (S.snake.length > C.INITIAL_LENGTH) {
          const n = Math.min(3, S.snake.length - C.INITIAL_LENGTH);
          for (let i = 0; i < n; ++i)
            S.snake.pop();
          S.score += 30;
          NS.board.updateDisplays();
        }
        break;
      case 'shield':
        S.activePowerups = S.activePowerups.filter(p => p.type.id !== 'shield');
        S.activePowerups.push({ type, expireTime: Infinity });
        break;
      case 'speed':
      case 'slow':
        S.activePowerups = S.activePowerups.filter(p => p.type.id !== 'speed' && p.type.id !== 'slow');
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      default:
        S.activePowerups = S.activePowerups.filter(p => p.type.id !== type.id);
        S.activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
    }
  }

  function useShield() {
    const idx = S.activePowerups.findIndex(p => p.type.id === 'shield');
    if (idx < 0)
      return false;
    S.activePowerups.splice(idx, 1);
    sfx.play('bounce');

    const h = S.snake[0];
    const cx = h.x * C.CELL + C.CELL / 2, cy = h.y * C.CELL + C.CELL / 2;
    floatingText.add(cx, cy - 10, 'Shield!', {
      color: '#448aff', font: 'bold 14px sans-serif', decay: 0.02, vy: -1.5
    });
    particles.burst(cx, cy, 20, {
      speed: 5, color: '#448aff', life: 0.6, size: 3, shrink: 0.95
    });
    return true;
  }

  Object.assign(NS.powerups, { updatePowerups, spawnPowerup, collectPowerup, applyPowerupEffect, useShield });
})();
