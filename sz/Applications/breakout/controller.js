;(function() {
  'use strict';

  /* ---- Field Size Presets ---- */
  const FIELD_SMALL = { w: 480, h: 560, cols: 10, label: 'small' };
  const FIELD_LARGE = { w: 1200, h: 840, cols: 25, label: 'large' };

  /* ---- Mutable Field Dimensions ---- */
  let currentField = FIELD_SMALL;
  let CANVAS_W = FIELD_SMALL.w;
  let CANVAS_H = FIELD_SMALL.h;

  const STORAGE_KEY = 'sz-breakout-high-scores';
  const MAX_HIGH_SCORES = 5;

  /* Paddle */
  const PADDLE_Y_OFFSET = 30;
  const PADDLE_HEIGHT = 14;
  const PADDLE_WIDTH_DEFAULT = 80;
  const PADDLE_WIDTH_WIDE = 120;
  const PADDLE_SPEED = 7;
  const EMITTER_RADIUS = 7;

  /* Ball */
  const BALL_RADIUS = 6;
  const BALL_SPEED_INITIAL = 4.5;
  const BALL_SPEED_INCREMENT = 0.3;
  const BALL_SPEED_MAX = 9;

  /* Bricks */
  let BRICK_COLS = 10;
  const BRICK_WIDTH = 44;
  const BRICK_HEIGHT = 16;
  const BRICK_PADDING = 3;
  const BRICK_OFFSET_TOP = 50;
  let BRICK_OFFSET_LEFT = (CANVAS_W - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
  const BRICK_COLORS = ['#e03030', '#e08020', '#e0c020', '#30b030', '#3070e0'];
  const BRICK_SCORES = [50, 40, 30, 20, 10];

  /* Power-ups */
  const POWERUP_CHANCE = 0.22;
  const POWERUP_SPEED = 2;
  const POWERUP_SIZE = 22;
  const POWERUP_DURATION = 10000;
  const POWERUP_TYPES = [
    { type: 'W', label: 'WIDE', color: '#4f4' },
    { type: 'M', label: 'MULTI', color: '#f4f' },
    { type: 'S', label: 'SLOW', color: '#4ff' },
    { type: 'F', label: 'FIRE', color: '#f80' },
    { type: 'L', label: 'LASER', color: '#f44' },
    { type: 'B', label: 'BARRIER', color: '#88f' }
  ];

  /* Game states */
  const STATE_IDLE = 'IDLE';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_LEVEL_TRANSITION = 'LEVEL_TRANSITION';

  /* ---- Canvas Setup ---- */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const gameFrame = document.querySelector('.game-frame');

  function applyCanvasSize() {
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.aspectRatio = CANVAS_W + ' / ' + CANVAS_H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitCanvasToFrame();
  }

  function fitCanvasToFrame() {
    const fw = gameFrame.clientWidth;
    const fh = gameFrame.clientHeight;
    const aspect = CANVAS_W / CANVAS_H;
    let displayW, displayH;
    if (fw / fh > aspect) {
      displayH = fh;
      displayW = fh * aspect;
    } else {
      displayW = fw;
      displayH = fw / aspect;
    }
    canvas.style.width = Math.floor(displayW) + 'px';
    canvas.style.height = Math.floor(displayH) + 'px';
  }

  applyCanvasSize();

  /* ---- Effects ---- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  let starfield = new SZ.GameEffects.Starfield(CANVAS_W, CANVAS_H, 80);

  /* ---- DOM ---- */
  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  /* ---- Game State ---- */
  let state;
  let score;
  let lives;
  let level;
  let paddle;
  let balls;
  let bricks;
  let powerUps;
  let activePowerUps;
  let animFrameId;
  let lastTime;
  let keysDown;
  let gameTime = 0;
  let arcFrame = 0;
  let comboCount = 0;
  let comboTimer = 0;
  let barrier = null;
  let lasers = [];
  let laserCooldown = 0;
  let levelTransitionTimer = 0;
  let levelTransitionPhase = 0;
  let gameOverChainTimer = 0;
  let gameOverChainIndex = 0;
  let zenMode = false;

  /* ---- Field Size Switching ---- */
  function recalcFieldDerived() {
    BRICK_COLS = currentField.cols;
    BRICK_OFFSET_LEFT = (CANVAS_W - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;
  }

  function setFieldSize(preset) {
    if (preset === currentField)
      return;
    currentField = preset;
    CANVAS_W = preset.w;
    CANVAS_H = preset.h;
    recalcFieldDerived();
    starfield = new SZ.GameEffects.Starfield(CANVAS_W, CANVAS_H, preset === FIELD_LARGE ? 150 : 80);
    applyCanvasSize();
    updateMenuChecks();
    newGame();
    requestWindowResize();
  }

  function toggleZenMode() {
    zenMode = !zenMode;
    updateMenuChecks();
    updateStatus();
  }

  function updateMenuChecks() {
    const small = document.getElementById('menu-size-small');
    const large = document.getElementById('menu-size-large');
    if (small) small.classList.toggle('checked', currentField === FIELD_SMALL);
    if (large) large.classList.toggle('checked', currentField === FIELD_LARGE);
    const zen = document.getElementById('menu-zen');
    if (zen) zen.classList.toggle('checked', zenMode);
  }

  /* ---- Paddle ---- */
  function createPaddle() {
    return {
      x: CANVAS_W / 2 - PADDLE_WIDTH_DEFAULT / 2,
      y: CANVAS_H - PADDLE_Y_OFFSET,
      width: PADDLE_WIDTH_DEFAULT,
      height: PADDLE_HEIGHT
    };
  }

  /* ---- Ball ---- */
  function createBall(attached) {
    const speed = Math.min(BALL_SPEED_INITIAL + (level - 1) * BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
    return {
      x: paddle.x + paddle.width / 2,
      y: paddle.y - BALL_RADIUS,
      vx: 0,
      vy: 0,
      speed,
      radius: BALL_RADIUS,
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

  /* ---- Level Loading ---- */
  function loadLevel(levelNum) {
    const def = SZ.BreakoutLevels.getLevel(levelNum);
    const srcCols = def.grid[0] ? def.grid[0].length : 10;
    const grid = [];

    /* Map source grid columns to target BRICK_COLS */
    for (let r = 0; r < def.grid.length; ++r)
      for (let tc = 0; tc < BRICK_COLS; ++tc) {
        const sc = tc % srcCols;
        const cell = def.grid[r][sc];
        if (cell === 0)
          continue;

        const brick = {
          x: BRICK_OFFSET_LEFT + tc * (BRICK_WIDTH + BRICK_PADDING),
          y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          alive: true,
          type: 'normal',
          hp: 1,
          entryDelay: r * 60 + tc * 15,
          entryProgress: 0,
          glareOffset: Math.random() * 3000
        };

        if (cell === 'G') {
          brick.type = 'glass';
          brick.color = '#aaddff';
          brick.score = 30;
        } else if (cell === 'S') {
          brick.type = 'steel';
          brick.color = '#999';
          brick.score = 60;
          brick.hp = 2;
        } else if (cell === 'X') {
          brick.type = 'indestructible';
          brick.color = '#444';
          brick.score = 0;
        } else {
          const idx = (typeof cell === 'number' ? cell - 1 : r) % BRICK_COLORS.length;
          brick.color = BRICK_COLORS[idx];
          brick.score = BRICK_SCORES[idx];
        }

        grid.push(brick);
      }
    return grid;
  }

  function allBricksCleared() {
    return bricks.every(b => !b.alive || b.type === 'indestructible');
  }

  /* ---- Power-up Helpers ---- */
  function maybeSpawnPowerUp(brick) {
    if (Math.random() > POWERUP_CHANCE)
      return;
    const def = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerUps.push({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      type: def.type,
      label: def.label,
      color: def.color,
      vy: POWERUP_SPEED,
      time: 0,
      rotation: 0
    });
  }

  function activatePowerUp(pu) {
    floatingText.add(pu.x, pu.y, pu.label, { color: pu.color, font: 'bold 16px sans-serif' });

    if (pu.type === 'W') {
      paddle.width = PADDLE_WIDTH_WIDE;
      if (paddle.x + paddle.width > CANVAS_W)
        paddle.x = CANVAS_W - paddle.width;
      setPowerUpTimer('W');
    } else if (pu.type === 'M') {
      const newBalls = [];
      for (const b of balls) {
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
      balls.push(...newBalls);
    } else if (pu.type === 'S') {
      for (const b of balls) {
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
      for (const b of balls)
        b.fire = true;
      setPowerUpTimer('F', 8000);
    } else if (pu.type === 'L') {
      activePowerUps.L = true;
      setPowerUpTimer('L');
    } else if (pu.type === 'B') {
      barrier = { life: 1, flashTime: 0 };
    }
  }

  function setPowerUpTimer(type, duration) {
    duration = duration ?? POWERUP_DURATION;
    if (activePowerUps[type + '_timer'])
      clearTimeout(activePowerUps[type + '_timer']);
    activePowerUps[type + '_timer'] = setTimeout(() => {
      if (type === 'W') {
        paddle.width = PADDLE_WIDTH_DEFAULT;
        if (paddle.x + paddle.width > CANVAS_W)
          paddle.x = CANVAS_W - paddle.width;
      } else if (type === 'S') {
        const targetSpeed = Math.min(BALL_SPEED_INITIAL + (level - 1) * BALL_SPEED_INCREMENT, BALL_SPEED_MAX);
        for (const b of balls) {
          const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (mag > 0) {
            b.vx = (b.vx / mag) * targetSpeed;
            b.vy = (b.vy / mag) * targetSpeed;
            b.speed = targetSpeed;
          }
        }
      } else if (type === 'F') {
        for (const b of balls)
          b.fire = false;
      } else if (type === 'L') {
        delete activePowerUps.L;
      }
      delete activePowerUps[type + '_timer'];
    }, duration);
  }

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
    if (ball.y + ball.radius < paddle.y)
      return false;
    if (ball.y - ball.radius > paddle.y + paddle.height)
      return false;
    if (ball.x + ball.radius < paddle.x)
      return false;
    if (ball.x - ball.radius > paddle.x + paddle.width)
      return false;
    return true;
  }

  function resolvePaddleBounce(ball) {
    const hitPos = (ball.x - paddle.x) / paddle.width;
    const angle = -Math.PI / 2 + (hitPos - 0.5) * (Math.PI * 0.7);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.y = paddle.y - ball.radius;

    particles.burst(ball.x, paddle.y, 8, {
      color: '#6cf', speed: 3, gravity: 0.02, life: 0.4, size: 2
    });
  }

  function hitBrick(brick, ball) {
    if (brick.type === 'indestructible') {
      particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 4, { color: '#888' });
      return;
    }

    --brick.hp;
    if (brick.hp <= 0) {
      brick.alive = false;
      score += brick.score;

      ++comboCount;
      comboTimer = 60;
      if (comboCount >= 2)
        floatingText.add(brick.x + brick.width / 2, brick.y, 'x' + comboCount + '!', {
          color: comboCount >= 5 ? '#f44' : comboCount >= 3 ? '#ff0' : '#4ff',
          font: 'bold ' + Math.min(14 + comboCount * 2, 28) + 'px sans-serif',
          decay: 0.025,
          vy: -1.2
        });

      score += Math.max(0, (comboCount - 1)) * 10;

      if (brick.type === 'glass') {
        particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 20, {
          color: '#cef', speed: 4, gravity: 0.04, life: 0.6, size: 2, shape: 'square'
        });
        particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, { color: '#fff' });
      } else if (brick.type === 'steel') {
        particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 18, {
          color: '#ccc', speed: 3.5, gravity: 0.06, life: 0.6, size: 3
        });
        particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 6, { color: '#ff0' });
      } else {
        particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 22, {
          color: brick.color, speed: 3.5, gravity: 0.05, life: 0.7, size: 3
        });
      }

      maybeSpawnPowerUp(brick);
    } else {
      particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 5, { color: '#ff0' });
      screenShake.trigger(2, 100);
    }
    updateStatus();
  }

  /* ---- Update ---- */
  function update(dt) {
    gameTime += dt;
    starfield.update(dt);

    if (state === STATE_LEVEL_TRANSITION) {
      levelTransitionTimer += dt;
      if (levelTransitionPhase === 0) {
        if (levelTransitionTimer > 800) {
          levelTransitionPhase = 1;
          levelTransitionTimer = 0;
        }
      } else {
        let allIn = true;
        for (const brick of bricks) {
          brick.entryProgress = Math.min(1, (levelTransitionTimer - brick.entryDelay) / 300);
          if (brick.entryProgress < 1)
            allIn = false;
        }
        if (allIn) {
          levelTransitionPhase = 0;
          if (zenMode) {
            state = STATE_PLAYING;
            for (const b of balls)
              if (b.attached)
                launchBall(b);
          } else
            state = STATE_IDLE;
        }
      }
      particles.update();
      floatingText.update();
      return;
    }

    if (state !== STATE_PLAYING)
      return;

    /* Combo decay */
    if (comboTimer > 0) {
      --comboTimer;
      if (comboTimer <= 0)
        comboCount = 0;
    }

    /* Laser cooldown */
    if (laserCooldown > 0)
      --laserCooldown;

    /* Paddle movement via keyboard */
    if (keysDown.ArrowLeft || keysDown.a || keysDown.A) {
      paddle.x -= PADDLE_SPEED;
      if (paddle.x < 0)
        paddle.x = 0;
    }
    if (keysDown.ArrowRight || keysDown.d || keysDown.D) {
      paddle.x += PADDLE_SPEED;
      if (paddle.x + paddle.width > CANVAS_W)
        paddle.x = CANVAS_W - paddle.width;
    }

    /* Update lasers */
    let laserCleared = false;
    for (let i = lasers.length - 1; i >= 0; --i) {
      const laser = lasers[i];
      laser.y -= 8;
      if (laser.y < 0) {
        lasers.splice(i, 1);
        continue;
      }
      for (const brick of bricks) {
        if (!brick.alive)
          continue;
        if (laser.x >= brick.x && laser.x <= brick.x + brick.width &&
            laser.y >= brick.y && laser.y <= brick.y + brick.height) {
          hitBrick(brick, null);
          lasers.splice(i, 1);
          if (allBricksCleared())
            laserCleared = true;
          break;
        }
      }
    }
    if (laserCleared) {
      particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'LEVEL COMPLETE!', {
        color: '#ff0', font: 'bold 22px sans-serif', decay: 0.01, vy: -0.5
      });
      nextLevel();
      return;
    }

    /* Update balls */
    for (let i = balls.length - 1; i >= 0; --i) {
      const ball = balls[i];

      if (ball.attached) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius;
        ball.chargeTime += dt;
        continue;
      }

      /* Ball trail */
      if (ball.fire) {
        particles.trail(ball.x, ball.y, {
          color: Math.random() > 0.5 ? '#f80' : '#ff0',
          life: 0.4,
          size: 3,
          decay: 0.04,
          shrink: 0.92,
          gravity: -0.02
        });
      } else {
        particles.trail(ball.x, ball.y, {
          color: '#8bf',
          life: 0.35,
          size: 2.5,
          decay: 0.04,
          shrink: 0.9
        });
        if (Math.random() > 0.6)
          particles.trail(ball.x, ball.y, {
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
      if (ball.x + ball.radius >= CANVAS_W) {
        ball.x = CANVAS_W - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      /* Ball lost */
      if (ball.y - ball.radius > CANVAS_H) {
        /* Check barrier */
        if (barrier && barrier.life > 0) {
          ball.vy = -Math.abs(ball.vy);
          ball.y = CANVAS_H - ball.radius - 4;
          barrier.life = 0;
          barrier.flashTime = 15;
          particles.burst(ball.x, CANVAS_H - 4, 15, {
            color: '#88f', speed: 3, gravity: 0.02, life: 0.5, size: 2
          });
          continue;
        }

        balls.splice(i, 1);
        if (balls.length === 0) {
          screenShake.trigger(8, 400);
          if (zenMode) {
            const nb = createBall(false);
            launchBall(nb);
            balls.push(nb);
          } else {
            --lives;
            updateStatus();
            if (lives <= 0) {
              state = STATE_GAME_OVER;
              gameOverChainTimer = 0;
              gameOverChainIndex = 0;
              exitPointerLock();
              checkHighScore();
            } else {
              balls.push(createBall(true));
              state = STATE_IDLE;
            }
          }
        }
        continue;
      }

      /* Paddle collision */
      if (ballPaddleCollision(ball))
        resolvePaddleBounce(ball);

      /* Brick collisions */
      for (const brick of bricks) {
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
          particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
          floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'LEVEL COMPLETE!', {
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
    for (let i = powerUps.length - 1; i >= 0; --i) {
      const pu = powerUps[i];
      pu.y += pu.vy;
      pu.time += dt;
      pu.rotation += 0.03;

      if (
        pu.y + POWERUP_SIZE / 2 >= paddle.y &&
        pu.y - POWERUP_SIZE / 2 <= paddle.y + paddle.height &&
        pu.x + POWERUP_SIZE / 2 >= paddle.x &&
        pu.x - POWERUP_SIZE / 2 <= paddle.x + paddle.width
      ) {
        activatePowerUp(pu);
        powerUps.splice(i, 1);
        continue;
      }

      if (pu.y - POWERUP_SIZE / 2 > CANVAS_H)
        powerUps.splice(i, 1);
    }

    /* Safety net: check if all bricks cleared (catches any missed path) */
    if (state === STATE_PLAYING && allBricksCleared()) {
      particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60, { speed: 7, gravity: 0.08 });
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'LEVEL COMPLETE!', {
        color: '#ff0', font: 'bold 22px sans-serif', decay: 0.01, vy: -0.5
      });
      nextLevel();
      return;
    }

    /* Barrier flash decay */
    if (barrier && barrier.flashTime > 0)
      --barrier.flashTime;

    /* Game over chain explosion */
    if (state === STATE_GAME_OVER) {
      gameOverChainTimer += dt;
      if (gameOverChainTimer > 80) {
        gameOverChainTimer = 0;
        const alive = bricks.filter(b => b.alive && b.type !== 'indestructible');
        if (alive.length > 0) {
          const brick = alive[Math.floor(Math.random() * alive.length)];
          brick.alive = false;
          particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 15, {
            color: brick.color, speed: 4, gravity: 0.06, life: 0.5, size: 3
          });
          screenShake.trigger(3, 100);
        }
      }
    }

    /* Update effects */
    particles.update();
    floatingText.update();
    screenShake.update(dt);
  }

  /* ---- Draw Helpers ---- */
  function drawEmitter(x, y) {
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 1, x, y, EMITTER_RADIUS);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.4, '#6cf');
    grad.addColorStop(1, '#234');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, EMITTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.5, EMITTER_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawElectricPaddle() {
    const lx = paddle.x + EMITTER_RADIUS;
    const rx = paddle.x + paddle.width - EMITTER_RADIUS;
    const py = paddle.y + paddle.height / 2;

    /* Energy field glow between arcs */
    ctx.save();
    const glow = ctx.createLinearGradient(lx, py - 6, lx, py + 6);
    glow.addColorStop(0, 'rgba(80,180,255,0)');
    glow.addColorStop(0.5, 'rgba(80,180,255,0.15)');
    glow.addColorStop(1, 'rgba(80,180,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx, py - 6, rx - lx, 12);
    ctx.restore();

    /* Draw 2-3 electric arcs */
    ++arcFrame;
    if (arcFrame % 3 === 0) {
      const colors = ['#6cf', '#4ef', '#adf'];
      const c = colors[Math.floor(Math.random() * colors.length)];
      SZ.GameEffects.drawElectricArc(ctx, lx, py, rx, py, {
        segments: 10, jitter: 5, color: c, width: 2, glowWidth: 5
      });
    }
    SZ.GameEffects.drawElectricArc(ctx, lx, py - 1, rx, py - 1, {
      segments: 8, jitter: 4, color: '#8df', width: 1.5, glowWidth: 4
    });
    SZ.GameEffects.drawElectricArc(ctx, lx, py + 1, rx, py + 1, {
      segments: 8, jitter: 4, color: '#6bf', width: 1.5, glowWidth: 4
    });

    /* Emitter nodes */
    drawEmitter(lx, py);
    drawEmitter(rx, py);

    /* Laser cannons */
    if (activePowerUps && activePowerUps.L) {
      ctx.fillStyle = '#f44';
      ctx.fillRect(lx - 2, py - 10, 4, 8);
      ctx.fillRect(rx - 2, py - 10, 4, 8);
      ctx.fillStyle = '#ff8';
      ctx.fillRect(lx - 1, py - 10, 2, 3);
      ctx.fillRect(rx - 1, py - 10, 2, 3);
    }

    /* Spark particles along paddle */
    if (Math.random() > 0.7) {
      const sx = lx + Math.random() * (rx - lx);
      particles.trail(sx, py + (Math.random() - 0.5) * 4, {
        color: '#6cf', life: 0.2, size: 1.5, decay: 0.06, shrink: 0.9
      });
    }
  }

  function drawNormalBrick(brick) {
    const { x, y, width: w, height: h, color } = brick;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.clip();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lightenColor(color, 30));
    grad.addColorStop(1, darkenColor(color, 30));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 1.5);
    ctx.stroke();

    ctx.restore();
  }

  function drawSteelBrick(brick) {
    const { x, y, width: w, height: h } = brick;

    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#bbb');
    grad.addColorStop(0.5, '#888');
    grad.addColorStop(1, '#666');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);

    /* Rivet dots */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + 5, y + h / 2, 1.5, 0, Math.PI * 2);
    ctx.arc(x + w - 5, y + h / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(x + 5, y + h / 2 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.arc(x + w - 5, y + h / 2 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    /* Crack overlay at hp=1 */
    if (brick.hp <= 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 1);
      ctx.lineTo(x + w * 0.45, y + h * 0.5);
      ctx.lineTo(x + w * 0.55, y + h * 0.3);
      ctx.lineTo(x + w * 0.7, y + h - 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.31, y + 2);
      ctx.lineTo(x + w * 0.46, y + h * 0.5 + 1);
      ctx.lineTo(x + w * 0.56, y + h * 0.3 + 1);
      ctx.lineTo(x + w * 0.71, y + h - 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawIndestructibleBrick(brick) {
    const { x, y, width: w, height: h } = brick;
    const pulse = 0.5 + 0.3 * Math.sin(gameTime * 0.003);

    ctx.save();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(200,100,255,' + pulse.toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.stroke();

    /* Inner X pattern */
    ctx.strokeStyle = 'rgba(200,100,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 3);
    ctx.lineTo(x + w - 4, y + h - 3);
    ctx.moveTo(x + w - 4, y + 3);
    ctx.lineTo(x + 4, y + h - 3);
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerUpCapsule(pu) {
    const { x, y, type, color, time, rotation } = pu;
    const halfW = POWERUP_SIZE / 2;
    const halfH = POWERUP_SIZE * 0.35;
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.005);

    ctx.save();
    ctx.translate(x, y);

    /* Outer glow */
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * pulse;

    /* Pill shape */
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85 * pulse;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, POWERUP_SIZE, halfH * 2, halfH);
    ctx.fill();
    ctx.shadowBlur = 0;

    /* Inner glow */
    const inner = ctx.createRadialGradient(0, -2, 1, 0, 0, halfW);
    inner.addColorStop(0, 'rgba(255,255,255,0.5)');
    inner.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, POWERUP_SIZE, halfH * 2, halfH);
    ctx.fill();

    /* Letter */
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type, 0, 0.5);

    ctx.restore();
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

  /* ---- Draw ---- */
  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    screenShake.apply(ctx);

    /* Background */
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    starfield.draw(ctx);

    /* Barrier */
    if (barrier) {
      if (barrier.life > 0) {
        ctx.save();
        const barGrad = ctx.createLinearGradient(0, CANVAS_H - 6, 0, CANVAS_H);
        barGrad.addColorStop(0, 'rgba(100,120,255,0.0)');
        barGrad.addColorStop(1, 'rgba(100,120,255,0.4)');
        ctx.fillStyle = barGrad;
        ctx.fillRect(0, CANVAS_H - 6, CANVAS_W, 6);
        ctx.restore();
      } else if (barrier.flashTime > 0) {
        ctx.save();
        ctx.globalAlpha = barrier.flashTime / 15;
        ctx.fillStyle = '#88f';
        ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
        ctx.restore();
      }
    }

    /* Bricks */
    for (const brick of bricks) {
      if (!brick.alive)
        continue;

      /* Entry animation */
      if (brick.entryProgress < 1) {
        const p = brick.entryProgress;
        if (p <= 0)
          continue;
        ctx.save();
        ctx.globalAlpha = p;
        ctx.translate(0, (1 - p) * -30);
      }

      if (brick.type === 'glass')
        SZ.GameEffects.drawGlassBrick(ctx, brick.x, brick.y, brick.width, brick.height, gameTime + brick.glareOffset);
      else if (brick.type === 'steel')
        drawSteelBrick(brick);
      else if (brick.type === 'indestructible')
        drawIndestructibleBrick(brick);
      else
        drawNormalBrick(brick);

      if (brick.entryProgress < 1)
        ctx.restore();
    }

    /* Lasers */
    for (const laser of lasers) {
      ctx.save();
      ctx.shadowColor = '#f44';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#f66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x, laser.y + 10);
      ctx.stroke();
      ctx.strokeStyle = '#fcc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x, laser.y + 10);
      ctx.stroke();
      ctx.restore();
    }

    /* Power-ups */
    for (const pu of powerUps)
      drawPowerUpCapsule(pu);

    /* Paddle */
    drawElectricPaddle();

    /* Balls */
    for (const ball of balls) {
      ctx.save();
      const ballColor = ball.fire ? '#f80' : '#fff';
      const glowCol = ball.fire ? '#f60' : '#8bf';

      /* Charge glow when attached */
      if (ball.attached && ball.chargeTime > 0) {
        const chargeAlpha = Math.min(0.5, ball.chargeTime / 2000);
        ctx.save();
        ctx.globalAlpha = chargeAlpha;
        ctx.fillStyle = glowCol;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      SZ.GameEffects.drawGlow(ctx, function(c) {
        c.fillStyle = ballColor;
        c.beginPath();
        c.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        c.fill();
      }, glowCol, 12);

      /* Ball highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(ball.x - 1.5, ball.y - 1.5, ball.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Particles and floating text */
    particles.draw(ctx);
    floatingText.draw(ctx);

    ctx.restore();

    /* Overlays */
    if (state === STATE_IDLE)
      drawOverlay('Press SPACE to launch', null);
    else if (state === STATE_PAUSED)
      drawOverlay('PAUSED', 'Press P to resume');
    else if (state === STATE_GAME_OVER)
      drawOverlay('GAME OVER', 'Score: ' + score + '\nPress Enter to restart');
  }

  function drawOverlay(title, subtitle) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 15);

    if (subtitle) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ccc';
      const lines = subtitle.split('\n');
      for (let i = 0; i < lines.length; ++i)
        ctx.fillText(lines[i], CANVAS_W / 2, CANVAS_H / 2 + 15 + i * 20);
    }
  }

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    if (!lastTime)
      lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();
  }

  /* ---- Level Management ---- */
  function nextLevel() {
    ++level;
    powerUps = [];
    lasers = [];
    barrier = null;

    /* Clear power-up timers */
    for (const key of Object.keys(activePowerUps)) {
      if (key.endsWith('_timer'))
        clearTimeout(activePowerUps[key]);
    }
    activePowerUps = {};
    paddle.width = PADDLE_WIDTH_DEFAULT;
    for (const b of balls)
      b.fire = false;

    bricks = loadLevel(level);
    balls = [createBall(true)];
    state = STATE_LEVEL_TRANSITION;
    levelTransitionTimer = 0;
    levelTransitionPhase = 0;
    updateStatus();
  }

  /* ---- New Game ---- */
  function newGame() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (activePowerUps)
      for (const key of Object.keys(activePowerUps))
        if (key.endsWith('_timer'))
          clearTimeout(activePowerUps[key]);

    score = 0;
    lives = 3;
    level = 1;
    keysDown = {};
    powerUps = [];
    activePowerUps = {};
    lasers = [];
    barrier = null;
    comboCount = 0;
    comboTimer = 0;
    gameTime = 0;
    arcFrame = 0;
    gameOverChainTimer = 0;
    gameOverChainIndex = 0;

    particles.clear();
    floatingText.clear();

    paddle = createPaddle();
    bricks = loadLevel(level);
    balls = [createBall(true)];
    state = STATE_LEVEL_TRANSITION;
    levelTransitionTimer = 0;
    levelTransitionPhase = 0;
    lastTime = null;

    updateStatus();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ---- Status ---- */
  function updateStatus() {
    statusScore.textContent = 'Score: ' + score;
    statusLives.textContent = 'Lives: ' + (zenMode ? '\u221E' : lives);
    statusLevel.textContent = 'Level: ' + level;
  }

  /* ---- High Scores ---- */
  let highScores = [];

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        highScores = JSON.parse(raw);
      if (!Array.isArray(highScores))
        highScores = [];
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
    } catch (_) {
      /* storage full or unavailable */
    }
  }

  function checkHighScore() {
    if (score <= 0)
      return;
    const entry = { score, level };
    if (highScores.length < MAX_HIGH_SCORES || score > highScores[highScores.length - 1].score) {
      highScores.push(entry);
      highScores.sort((a, b) => b.score - a.score);
      if (highScores.length > MAX_HIGH_SCORES)
        highScores.length = MAX_HIGH_SCORES;
      saveHighScores();
    }
  }

  function resetHighScores() {
    highScores = [];
    saveHighScores();
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    body.innerHTML = '';
    if (highScores.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      for (let i = 0; i < highScores.length; ++i) {
        const e = highScores[i];
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.level + '</td>';
        body.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        resetHighScores();
        showHighScores();
      }
    });
  }

  /* ---- Pause ---- */
  function exitPointerLock() {
    if (document.pointerLockElement === canvas)
      document.exitPointerLock();
  }

  function togglePause() {
    if (state === STATE_PAUSED) {
      state = STATE_PLAYING;
      lastTime = null;
    } else if (state === STATE_PLAYING) {
      state = STATE_PAUSED;
      exitPointerLock();
    }
  }

  /* ---- Laser Fire ---- */
  function fireLaser() {
    if (!activePowerUps.L || laserCooldown > 0)
      return;
    laserCooldown = 10;
    const lx = paddle.x + EMITTER_RADIUS;
    const rx = paddle.x + paddle.width - EMITTER_RADIUS;
    const py = paddle.y;
    lasers.push({ x: lx, y: py - 10 });
    lasers.push({ x: rx, y: py - 10 });
    particles.sparkle(lx, py - 10, 3, { color: '#f88' });
    particles.sparkle(rx, py - 10, 3, { color: '#f88' });
  }

  /* ---- Menu ---- */
  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        newGame();
        break;
      case 'pause':
        togglePause();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'size-small':
        setFieldSize(FIELD_SMALL);
        break;
      case 'size-large':
        setFieldSize(FIELD_LARGE);
        break;
      case 'zen':
        toggleZenMode();
        break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  /* ---- Input: Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'Enter' && state === STATE_GAME_OVER) {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (state === STATE_IDLE) {
        state = STATE_PLAYING;
        for (const ball of balls)
          if (ball.attached)
            launchBall(ball);
      } else if (state === STATE_PLAYING)
        fireLaser();
      return;
    }

    keysDown[e.key] = true;
  });

  document.addEventListener('keyup', e => {
    delete keysDown[e.key];
  });

  /* ---- Input: Mouse (pointer lock) ---- */
  let pointerLocked = false;

  canvas.addEventListener('click', () => {
    if (!pointerLocked)
      canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', e => {
    if (!pointerLocked || state === STATE_GAME_OVER || state === STATE_PAUSED)
      return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    paddle.x += e.movementX * scaleX;
    if (paddle.x < 0)
      paddle.x = 0;
    if (paddle.x + paddle.width > CANVAS_W)
      paddle.x = CANVAS_W - paddle.width;
  });

  document.addEventListener('mousedown', e => {
    if (!pointerLocked)
      return;
    if (state === STATE_IDLE) {
      state = STATE_PLAYING;
      for (const ball of balls)
        if (ball.attached)
          launchBall(ball);
    } else if (state === STATE_PLAYING)
      fireLaser();
  });

  /* ---- Display Resize Handling ---- */
  const resizeObserver = new ResizeObserver(() => fitCanvasToFrame());
  resizeObserver.observe(gameFrame);

  /* ---- Window Resize ---- */
  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = CANVAS_W + 28;
      const h = CANVAS_H + 80;
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    loadHighScores();
    recalcFieldDerived();
    newGame();
    requestWindowResize();
  }

  init();

})();
