/* The ball entities: creation with the level-scaled speed and the launch angle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;

  /* ---- Ball ---- */
  function createBall(attached) {
    const speed = Math.min(C.BALL_SPEED_INITIAL + (S.level - 1) * C.BALL_SPEED_INCREMENT, C.BALL_SPEED_MAX);
    return {
      x: S.paddle.x + S.paddle.width / 2,
      y: S.paddle.y - C.BALL_RADIUS,
      vx: 0,
      vy: 0,
      speed,
      radius: C.BALL_RADIUS,
      attached: attached !== false,
      fire: false,
      chargeTime: 0
    };
  }

  function launchBall(ball) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.attached = false;
  }

  Object.assign(NS.balls, { createBall, launchBall });
})();
