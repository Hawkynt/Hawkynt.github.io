/* Power-ups: the drop chance, the six capsule effects, their timers and expiry. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const FX = NS.effects;

  /* ---- Power-up Helpers ---- */
  function maybeSpawnPowerUp(brick) {
    if (Math.random() > C.POWERUP_CHANCE)
      return;
    const def = C.POWERUP_TYPES[Math.floor(Math.random() * C.POWERUP_TYPES.length)];
    S.powerUps.push({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      type: def.type,
      label: def.label,
      color: def.color,
      vy: C.POWERUP_SPEED,
      time: 0,
      rotation: 0
    });
  }

  function activatePowerUp(pu) {
    FX.floatingText.add(pu.x, pu.y, pu.label, { color: pu.color, font: 'bold 16px sans-serif' });
    SZ.GameAudio.play('powerup');

    if (pu.type === 'W') {
      S.paddle.width = C.PADDLE_WIDTH_WIDE;
      if (S.paddle.x + S.paddle.width > S.CANVAS_W)
        S.paddle.x = S.CANVAS_W - S.paddle.width;
      setPowerUpTimer('W');
    } else if (pu.type === 'M') {
      const newBalls = [];
      for (const b of S.balls) {
        if (b.attached)
          continue;
        for (let i = 0; i < 2; ++i) {
          const nb = {
            x: b.x,
            y: b.y,
            vx: b.speed * (Math.random() - 0.5) * 1.5,
            vy: -b.speed * (0.5 + Math.random() * 0.5),
            speed: b.speed,
            radius: b.radius,
            attached: false,
            fire: b.fire,
            chargeTime: 0
          };
          const mag = Math.sqrt(nb.vx * nb.vx + nb.vy * nb.vy);
          nb.vx = (nb.vx / mag) * nb.speed;
          nb.vy = (nb.vy / mag) * nb.speed;
          newBalls.push(nb);
        }
      }
      S.balls.push(...newBalls);
    } else if (pu.type === 'S') {
      for (const b of S.balls) {
        const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (mag > 0) {
          const factor = 0.6;
          b.vx *= factor;
          b.vy *= factor;
          b.speed *= factor;
        }
      }
      setPowerUpTimer('S');
    } else if (pu.type === 'F') {
      for (const b of S.balls)
        b.fire = true;
      setPowerUpTimer('F', 8000);
    } else if (pu.type === 'L') {
      S.activePowerUps.L = true;
      setPowerUpTimer('L');
    } else if (pu.type === 'B') {
      S.barrier = { life: 1, flashTime: 0 };
    }
  }

  function setPowerUpTimer(type, duration) {
    S.activePowerUps[type + '_timer'] = duration ?? C.POWERUP_DURATION;
  }

  function updatePowerUpTimers(dt) {
    for (const key of Object.keys(S.activePowerUps)) {
      if (!key.endsWith('_timer'))
        continue;
      S.activePowerUps[key] -= dt;
      if (S.activePowerUps[key] <= 0)
        expirePowerUp(key.slice(0, -6));
    }
  }

  function expirePowerUp(type) {
    if (type === 'W') {
      S.paddle.width = C.PADDLE_WIDTH_DEFAULT;
      if (S.paddle.x + S.paddle.width > S.CANVAS_W)
        S.paddle.x = S.CANVAS_W - S.paddle.width;
    } else if (type === 'S') {
      const targetSpeed = Math.min(C.BALL_SPEED_INITIAL + (S.level - 1) * C.BALL_SPEED_INCREMENT, C.BALL_SPEED_MAX);
      for (const b of S.balls) {
        const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (mag > 0) {
          b.vx = (b.vx / mag) * targetSpeed;
          b.vy = (b.vy / mag) * targetSpeed;
          b.speed = targetSpeed;
        }
      }
    } else if (type === 'F') {
      for (const b of S.balls)
        b.fire = false;
    } else if (type === 'L') {
      delete S.activePowerUps.L;
    }
    delete S.activePowerUps[type + '_timer'];
  }

  Object.assign(NS.powerups, { maybeSpawnPowerUp, activatePowerUp, setPowerUpTimer, updatePowerUpTimers, expirePowerUp });
})();
