/* The fixed-step simulation: level transition entry animation, paddle movement,
   lasers, ball physics and collisions, power-up drops, the game-over chain
   explosion and the effect updates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const FX = NS.effects;
  const { ballBrickCollision, resolveBrickBounce, ballPaddleCollision, resolvePaddleBounce, allBricksCleared } = NS.rules;
  const { createBall, launchBall } = NS.balls;
  const { hitBrick } = NS.bricks;
  const { activatePowerUp, updatePowerUpTimers } = NS.powerups;
  const { nextLevel, updateStatus, exitPointerLock } = NS.game;
  const { checkHighScore } = NS.highscores;

  /* ---- Update ---- */
  function update(dt) {
    S.gameTime += dt;
    FX.starfield.update(dt);

    if (S.state === C.STATE_LEVEL_TRANSITION) {
      S.levelTransitionTimer += dt;
      if (S.levelTransitionPhase === 0) {
        if (S.levelTransitionTimer > 800) {
          S.levelTransitionPhase = 1;
          S.levelTransitionTimer = 0;
        }
      } else {
        let allIn = true;
        for (const brick of S.bricks) {
          brick.entryProgress = Math.min(1, (S.levelTransitionTimer - brick.entryDelay) / 300);
          if (brick.entryProgress < 1)
            allIn = false;
        }
        if (allIn) {
          S.levelTransitionPhase = 0;
          if (S.zenMode) {
            S.state = C.STATE_PLAYING;
            for (const b of S.balls)
              if (b.attached)
                launchBall(b);
          } else
            S.state = C.STATE_IDLE;
        }
      }
      FX.particles.update();
      FX.floatingText.update();
      return;
    }

    if (S.state !== C.STATE_PLAYING)
      return;

    /* Combo decay */
    if (S.comboTimer > 0) {
      --S.comboTimer;
      if (S.comboTimer <= 0)
        S.comboCount = 0;
    }

    /* Laser cooldown */
    if (S.laserCooldown > 0)
      --S.laserCooldown;

    /* Power-up durations count game time only, so they hold while paused */
    updatePowerUpTimers(dt);

    /* Paddle movement via keyboard */
    if (S.keysDown.ArrowLeft || S.keysDown.a || S.keysDown.A) {
      S.paddle.x -= C.PADDLE_SPEED;
      if (S.paddle.x < 0)
        S.paddle.x = 0;
    }
    if (S.keysDown.ArrowRight || S.keysDown.d || S.keysDown.D) {
      S.paddle.x += C.PADDLE_SPEED;
      if (S.paddle.x + S.paddle.width > S.CANVAS_W)
        S.paddle.x = S.CANVAS_W - S.paddle.width;
    }

    /* Update lasers */
    let laserCleared = false;
    for (let i = S.lasers.length - 1; i >= 0; --i) {
      const laser = S.lasers[i];
      laser.y -= 8;
      if (laser.y < 0) {
        S.lasers.splice(i, 1);
        continue;
      }
      for (const brick of S.bricks) {
        if (!brick.alive)
          continue;
        if (laser.x >= brick.x && laser.x <= brick.x + brick.width &&
            laser.y >= brick.y && laser.y <= brick.y + brick.height) {
          hitBrick(brick, null);
          S.lasers.splice(i, 1);
          if (allBricksCleared())
            laserCleared = true;
          break;
        }
      }
    }
    if (laserCleared) {
      FX.particles.confetti(S.CANVAS_W / 2, S.CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
      FX.floatingText.add(S.CANVAS_W / 2, S.CANVAS_H / 2, 'LEVEL COMPLETE!', {
        color: '#ff0', font: 'bold 22px sans-serif', decay: 0.01, vy: -0.5
      });
      nextLevel();
      return;
    }

    /* Update balls */
    for (let i = S.balls.length - 1; i >= 0; --i) {
      const ball = S.balls[i];

      if (ball.attached) {
        ball.x = S.paddle.x + S.paddle.width / 2;
        ball.y = S.paddle.y - ball.radius;
        ball.chargeTime += dt;
        continue;
      }

      /* Ball trail */
      if (ball.fire) {
        FX.particles.trail(ball.x, ball.y, {
          color: Math.random() > 0.5 ? '#f80' : '#ff0',
          life: 0.4,
          size: 3,
          decay: 0.04,
          shrink: 0.92,
          gravity: -0.02
        });
      } else {
        FX.particles.trail(ball.x, ball.y, {
          color: '#8bf',
          life: 0.35,
          size: 2.5,
          decay: 0.04,
          shrink: 0.9
        });
        if (Math.random() > 0.6)
          FX.particles.trail(ball.x, ball.y, {
            color: '#fff',
            life: 0.2,
            size: 1.5,
            decay: 0.06,
            shrink: 0.85
          });
      }

      ball.x += ball.vx;
      ball.y += ball.vy;

      /* Wall collisions */
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.radius >= S.CANVAS_W) {
        ball.x = S.CANVAS_W - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      /* Ball lost */
      if (ball.y - ball.radius > S.CANVAS_H) {
        /* Check barrier */
        if (S.barrier && S.barrier.life > 0) {
          ball.vy = -Math.abs(ball.vy);
          ball.y = S.CANVAS_H - ball.radius - 4;
          S.barrier.life = 0;
          S.barrier.flashTime = 15;
          SZ.GameAudio.play('bounce', { pitch: 0.7 });
          FX.particles.burst(ball.x, S.CANVAS_H - 4, 15, {
            color: '#88f', speed: 3, gravity: 0.02, life: 0.5, size: 2
          });
          continue;
        }

        S.balls.splice(i, 1);
        if (S.balls.length === 0) {
          FX.screenShake.trigger(8, 400);
          SZ.GameAudio.play(!S.zenMode && S.lives <= 1 ? 'lose' : 'hurt');
          if (S.zenMode) {
            const nb = createBall(false);
            launchBall(nb);
            S.balls.push(nb);
          } else {
            --S.lives;
            updateStatus();
            if (S.lives <= 0) {
              S.state = C.STATE_GAME_OVER;
              S.gameOverChainTimer = 0;
              S.gameOverChainIndex = 0;
              exitPointerLock();
              checkHighScore();
            } else {
              S.balls.push(createBall(true));
              S.state = C.STATE_IDLE;
            }
          }
        }
        continue;
      }

      /* Paddle collision */
      if (ballPaddleCollision(ball))
        resolvePaddleBounce(ball);

      /* Brick collisions */
      for (const brick of S.bricks) {
        if (!brick.alive)
          continue;
        if (!ballBrickCollision(ball, brick))
          continue;

        if (brick.type === 'glass') {
          hitBrick(brick, ball);
        } else if (ball.fire && brick.type !== 'indestructible') {
          hitBrick(brick, ball);
        } else {
          resolveBrickBounce(ball, brick);
          hitBrick(brick, ball);
        }

        if (allBricksCleared()) {
          FX.particles.confetti(S.CANVAS_W / 2, S.CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
          FX.floatingText.add(S.CANVAS_W / 2, S.CANVAS_H / 2, 'LEVEL COMPLETE!', {
            color: '#ff0',
            font: 'bold 22px sans-serif',
            decay: 0.01,
            vy: -0.5
          });
          nextLevel();
          return;
        }

        if (brick.type !== 'glass' && !ball.fire)
          break;
      }
    }

    /* Update power-ups */
    for (let i = S.powerUps.length - 1; i >= 0; --i) {
      const pu = S.powerUps[i];
      pu.y += pu.vy;
      pu.time += dt;
      pu.rotation += 0.03;

      if (
        pu.y + C.POWERUP_SIZE / 2 >= S.paddle.y &&
        pu.y - C.POWERUP_SIZE / 2 <= S.paddle.y + S.paddle.height &&
        pu.x + C.POWERUP_SIZE / 2 >= S.paddle.x &&
        pu.x - C.POWERUP_SIZE / 2 <= S.paddle.x + S.paddle.width
      ) {
        activatePowerUp(pu);
        S.powerUps.splice(i, 1);
        continue;
      }

      if (pu.y - C.POWERUP_SIZE / 2 > S.CANVAS_H)
        S.powerUps.splice(i, 1);
    }

    /* Safety net: check if all bricks cleared (catches any missed path) */
    if (S.state === C.STATE_PLAYING && allBricksCleared()) {
      FX.particles.confetti(S.CANVAS_W / 2, S.CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
      FX.floatingText.add(S.CANVAS_W / 2, S.CANVAS_H / 2, 'LEVEL COMPLETE!', {
        color: '#ff0', font: 'bold 22px sans-serif', decay: 0.01, vy: -0.5
      });
      nextLevel();
      return;
    }

    /* Barrier flash decay */
    if (S.barrier && S.barrier.flashTime > 0)
      --S.barrier.flashTime;

    /* Game over chain explosion */
    if (S.state === C.STATE_GAME_OVER) {
      S.gameOverChainTimer += dt;
      if (S.gameOverChainTimer > 80) {
        S.gameOverChainTimer = 0;
        const alive = S.bricks.filter(b => b.alive && b.type !== 'indestructible');
        if (alive.length > 0) {
          const brick = alive[Math.floor(Math.random() * alive.length)];
          brick.alive = false;
          FX.particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 15, {
            color: brick.color, speed: 4, gravity: 0.06, life: 0.5, size: 3
          });
          FX.screenShake.trigger(3, 100);
        }
      }
    }

    /* Update effects */
    FX.particles.update();
    FX.floatingText.update();
    FX.screenShake.update(dt);
  }

  Object.assign(NS.sim, { update });
})();
