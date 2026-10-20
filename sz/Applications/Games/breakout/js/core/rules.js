/* Collision and physics math: the ball/brick and ball/paddle tests and bounce
   resolutions, the all-cleared check and the color helpers the renderer shares. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const S = NS.state;
  const FX = NS.effects;

  /* ---- Collision ---- */
  function ballBrickCollision(ball, brick) {
    const bx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
    const by = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
    const dx = ball.x - bx;
    const dy = ball.y - by;
    return dx * dx + dy * dy <= ball.radius * ball.radius;
  }

  function resolveBrickBounce(ball, brick) {
    const cx = ball.x;
    const cy = ball.y;
    const nearX = Math.max(brick.x, Math.min(cx, brick.x + brick.width));
    const nearY = Math.max(brick.y, Math.min(cy, brick.y + brick.height));
    const dx = cx - nearX;
    const dy = cy - nearY;

    if (Math.abs(dx) > Math.abs(dy))
      ball.vx = Math.abs(ball.vx) * (dx >= 0 ? 1 : -1);
    else
      ball.vy = Math.abs(ball.vy) * (dy >= 0 ? 1 : -1);
  }

  function ballPaddleCollision(ball) {
    if (ball.vy < 0)
      return false;
    if (ball.y + ball.radius < S.paddle.y)
      return false;
    if (ball.y - ball.radius > S.paddle.y + S.paddle.height)
      return false;
    if (ball.x + ball.radius < S.paddle.x)
      return false;
    if (ball.x - ball.radius > S.paddle.x + S.paddle.width)
      return false;
    return true;
  }

  function resolvePaddleBounce(ball) {
    const hitPos = (ball.x - S.paddle.x) / S.paddle.width;
    const angle = -Math.PI / 2 + (hitPos - 0.5) * (Math.PI * 0.7);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.y = S.paddle.y - ball.radius;

    SZ.GameAudio.play('bounce');
    FX.particles.burst(ball.x, S.paddle.y, 8, {
      color: '#6cf', speed: 3, gravity: 0.02, life: 0.4, size: 2
    });
  }

  function allBricksCleared() {
    return S.bricks.every(b => !b.alive || b.type === 'indestructible');
  }

  /* Color utilities */
  function lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function darkenColor(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  Object.assign(NS.rules, { ballBrickCollision, resolveBrickBounce, ballPaddleCollision, resolvePaddleBounce, allBricksCleared, lightenColor, darkenColor });
})();
