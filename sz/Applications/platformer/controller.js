;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 640;
  const CANVAS_H = 480;
  const MAX_DT = 0.05;
  const GRAVITY = 800;
  const JUMP_FORCE = -380;
  const PLAYER_SPEED = 200;
  const TILE_SIZE = 32;
  const STOMP_SCORE = 100;
  const COIN_SCORE = 50;
  const BOSS_STOMP_SCORE = 500;
  const CONFETTI_COLORS = ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0'];

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* Storage */
  const STORAGE_PREFIX = 'sz-platformer';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 5;
  const MAX_LIVES = 3;

  /* ── API bootstrap ── */
  const { User32 } = window.SZ?.Dlls ?? {};
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Status bar ── */
  const elScore = document.getElementById('statusScore');
  const elLevel = document.getElementById('statusLevel');
  const elLives = document.getElementById('statusLives');
  const elState = document.getElementById('statusState');

  /* ── Game state ── */
  let state = STATE_READY;
  let score = 0;
  let lives = MAX_LIVES;
  let currentLevel = 1;
  let highScores = [];
  let coinCount = 0;

  /* Camera */
  let cameraX = 0;

  /* Player */
  let player = {
    x: 64, y: 0, vx: 0, vy: 0,
    w: 24, h: 28,
    facingRight: true,
    grounded: false,
    isJumping: false,
    animFrame: 0,
    animTimer: 0,
    alive: true,
    invincible: 0
  };

  /* Power-up state */
  let powerUpDoubleJump = false;
  let powerUpInvincible = false;
  let powerUpFireball = false;
  let powerTimer = 0;
  let hasDoubleJumped = false;

  /* Collections */
  let tiles = [];
  let platforms = [];
  let enemies = [];
  let coins = [];
  let powerUps = [];
  let fireballs = [];
  let levelWidth = 0;

  /* Input */
  const keysDown = {};

  /* ── High score persistence ── */
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      highScores = raw ? JSON.parse(raw) : [];
    } catch (e) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (e) {
      // storage unavailable
    }
  }

  function addHighScore(s, lvl) {
    highScores.push({ score: s, level: lvl, date: Date.now() });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  /* ── Level generation ── */
  function generateLevel(level) {
    tiles = [];
    platforms = [];
    enemies = [];
    coins = [];
    powerUps = [];
    fireballs = [];
    coinCount = 0;

    const cols = 60 + level * 10;
    const rows = Math.ceil(CANVAS_H / TILE_SIZE);
    levelWidth = cols * TILE_SIZE;

    // Floor tiles
    for (let c = 0; c < cols; ++c)
      tiles.push({ x: c * TILE_SIZE, y: (rows - 1) * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE, type: 'ground' });

    // Platforms scattered — variety per level
    const numPlatforms = 8 + level * 3;
    for (let i = 0; i < numPlatforms; ++i) {
      const px = 120 + Math.floor(Math.random() * (levelWidth - 300));
      const py = 120 + Math.floor(Math.random() * (CANVAS_H - 200));
      const pw = TILE_SIZE * (2 + Math.floor(Math.random() * 4));
      platforms.push({ x: px, y: py, w: pw, h: 12 });
    }

    // Coins along the level
    const numCoins = 15 + level * 5;
    for (let i = 0; i < numCoins; ++i) {
      coins.push({
        x: 100 + Math.floor(Math.random() * (levelWidth - 200)),
        y: 80 + Math.floor(Math.random() * (CANVAS_H - 200)),
        w: 16, h: 16,
        collected: false,
        bobPhase: Math.random() * Math.PI * 2
      });
    }

    // Enemies — walker, flyer, shooter types
    const numEnemies = 5 + level * 2;
    for (let i = 0; i < numEnemies; ++i) {
      const types = ['walker', 'flyer', 'shooter'];
      const type = types[Math.floor(Math.random() * types.length)];
      const ex = 200 + Math.floor(Math.random() * (levelWidth - 400));
      const ey = type === 'flyer' ? 80 + Math.floor(Math.random() * 200) : (rows - 2) * TILE_SIZE;
      enemies.push({
        x: ex, y: ey, vx: (30 + level * 5) * (Math.random() < 0.5 ? 1 : -1), vy: 0,
        w: 24, h: 24,
        type: type,
        alive: true,
        isBoss: false,
        bossHealth: 0,
        animFrame: 0,
        patrolMin: ex - 80,
        patrolMax: ex + 80,
        shootTimer: 2
      });
    }

    // Boss every 5 levels
    if (level % 5 === 0) {
      const bossX = levelWidth - 200;
      enemies.push({
        x: bossX, y: (rows - 2) * TILE_SIZE - 24, vx: 30, vy: 0,
        w: 48, h: 48,
        type: 'walker',
        alive: true,
        isBoss: true,
        bossHealth: 3 + Math.floor(level / 5),
        animFrame: 0,
        patrolMin: bossX - 120,
        patrolMax: bossX + 120,
        shootTimer: 0
      });
    }

    // Power-ups
    if (level >= 2) {
      const puTypes = ['doubleJump', 'invincible', 'fireball'];
      const puType = puTypes[Math.floor(Math.random() * puTypes.length)];
      powerUps.push({
        x: 200 + Math.floor(Math.random() * (levelWidth - 400)),
        y: 100 + Math.floor(Math.random() * (CANVAS_H - 250)),
        w: 20, h: 20,
        type: puType,
        active: true
      });
    }

    // Goal at end of level
    tiles.push({ x: levelWidth - TILE_SIZE * 2, y: (rows - 3) * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE * 2, type: 'goal' });

    // Reset player position
    player.x = 64;
    player.y = (rows - 2) * TILE_SIZE - player.h;
    player.vx = 0;
    player.vy = 0;
    player.alive = true;
    player.grounded = false;
    cameraX = 0;
  }

  /* ── Collision helpers ── */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function checkTileCollision(entity, dt) {
    entity.grounded = false;

    // Check ground tiles
    for (const t of tiles) {
      if (t.type === 'goal') continue;
      if (!aabb(entity, t)) continue;
      const prevBottom = entity.y + entity.h - entity.vy * dt;
      if (entity.vy >= 0 && prevBottom <= t.y) {
        entity.y = t.y - entity.h;
        entity.vy = 0;
        entity.grounded = true;
        entity.isJumping = false;
      }
    }

    // Check platforms — land on top only
    for (const p of platforms) {
      if (entity.vy < 0) continue;
      const prevBottom = entity.y + entity.h - entity.vy * dt;
      if (entity.x + entity.w > p.x && entity.x < p.x + p.w &&
          prevBottom <= p.y && entity.y + entity.h >= p.y) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.grounded = true;
        entity.isJumping = false;
      }
    }
  }

  /* ── Update ── */
  function update(dt) {
    if (state !== STATE_PLAYING) return;

    // Power-up timer
    if (powerTimer > 0) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerUpDoubleJump = false;
        powerUpInvincible = false;
        powerUpFireball = false;
      }
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateFireballs(dt);
    checkCoinCollection();
    checkPowerUpCollection();
    checkGoal();

    particles.update(dt);
    screenShake.update(dt);
    floatingText.update(dt);
  }

  function updatePlayer(dt) {
    if (!player.alive) {
      player.invincible -= dt;
      if (player.invincible <= 0) {
        player.alive = true;
        player.x = 64;
        player.y = 300;
        player.vx = 0;
        player.vy = 0;
        player.invincible = 2;
        cameraX = 0;
      }
      return;
    }

    player.invincible -= dt;

    // Horizontal movement
    player.vx = 0;
    if (keysDown['ArrowLeft'] || keysDown['a']) {
      player.vx = -PLAYER_SPEED;
      player.facingRight = false;
    }
    if (keysDown['ArrowRight'] || keysDown['d']) {
      player.vx = PLAYER_SPEED;
      player.facingRight = true;
    }

    // Jump
    if ((keysDown['ArrowUp'] || keysDown['w'] || keysDown[' ']) && player.grounded) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
      player.grounded = false;
      hasDoubleJumped = false;
    } else if ((keysDown['ArrowUp'] || keysDown['w'] || keysDown[' ']) && powerUpDoubleJump && !hasDoubleJumped && !player.grounded) {
      player.vy = JUMP_FORCE * 0.8;
      hasDoubleJumped = true;
      particles.burst(player.x + 12, player.y + player.h, 6, { color: '#ffd700', life: 0.3, speed: 30 });
    }

    // Fireball
    if (keysDown['z'] && powerUpFireball && fireballs.length < 3) {
      keysDown['z'] = false;
      const dir = player.facingRight ? 1 : -1;
      fireballs.push({
        x: player.x + (dir > 0 ? player.w : -8),
        y: player.y + 10,
        vx: 300 * dir,
        w: 10, h: 8,
        age: 0
      });
    }

    // Gravity
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Tile collision — prevents falling through floor
    checkTileCollision(player, dt);

    // Clamp to level bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > levelWidth) player.x = levelWidth - player.w;

    // Death pit
    if (player.y > CANVAS_H + 50)
      playerDeath();

    // Camera scrolling follows player
    cameraX = player.x - CANVAS_W / 3;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > levelWidth - CANVAS_W) cameraX = levelWidth - CANVAS_W;
    // Animation
    player.animTimer += dt;
    if (player.animTimer > 0.12) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }

    // Enemy collision
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (!aabb(player, enemy)) continue;

      // Stomp from above — defeat enemy
      if (player.vy > 0 && player.y + player.h - player.vy * dt <= enemy.y + 8) {
        stompEnemy(enemy);
        player.vy = JUMP_FORCE * 0.5;
      } else if (player.invincible <= 0 && !powerUpInvincible) {
        playerDeath();
      }
    }
  }

  function stompEnemy(enemy) {
    if (enemy.isBoss) {
      // Boss takes damage
      --enemy.bossHealth;
      // Boss hit — screen shake + particles
      screenShake.trigger(8, 0.4);
      particles.burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 10, { color: '#ff4400', life: 0.5, speed: 60 });
      floatingText.add(enemy.x + enemy.w / 2, enemy.y - 10, 'HIT!', { color: '#ff4400' });

      if (enemy.bossHealth <= 0) {
        enemy.alive = false;
        score += BOSS_STOMP_SCORE;
        floatingText.add(enemy.x + enemy.w / 2, enemy.y - 20, '+' + BOSS_STOMP_SCORE, { color: '#ffd700' });
        // Boss defeat — big shake + confetti
        screenShake.trigger(12, 0.6);
        for (let i = 0; i < 5; ++i) {
          particles.burst(
            enemy.x + Math.random() * enemy.w,
            enemy.y + Math.random() * enemy.h,
            15, { color: CONFETTI_COLORS[i], life: 1.0, speed: 80 }
          );
        }
      }
    } else {
      // Regular enemy defeat with particle burst
      enemy.alive = false;
      score += STOMP_SCORE;
      particles.burst(enemy.x + 12, enemy.y + 12, 10, { color: '#ff6600', life: 0.4, speed: 50 });
      floatingText.add(enemy.x + 12, enemy.y - 10, '+' + STOMP_SCORE, { color: '#ff6600' });
    }
  }

  function patrolBounce(enemy, dt) {
    enemy.x += enemy.vx * dt;
    if (enemy.x < enemy.patrolMin || enemy.x > enemy.patrolMax)
      enemy.vx = -enemy.vx;
  }

  function applyGravity(enemy, dt) {
    enemy.vy += GRAVITY * dt;
    enemy.y += enemy.vy * dt;
    checkTileCollision(enemy, dt);
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Patrol back and forth — all types share this
      patrolBounce(enemy, dt);

      if (enemy.type === 'walker' || enemy.isBoss) {
        // Gravity for walkers
        applyGravity(enemy, dt);
      } else if (enemy.type === 'flyer') {
        // Flyer bobs up and down
        enemy.y += Math.sin(Date.now() / 500 + enemy.patrolMin) * 0.5;
      } else if (enemy.type === 'shooter') {
        // Shooter patrols and fires projectiles
        applyGravity(enemy, dt);
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && !enemy.isBoss) {
          enemy.shootTimer = 2 + Math.random();
          // Shoot a projectile at the player direction
          const dir = player.x > enemy.x ? 1 : -1;
          fireballs.push({
            x: enemy.x + (dir > 0 ? enemy.w : -8),
            y: enemy.y + 8,
            vx: 150 * dir,
            w: 8, h: 6,
            age: 0,
            hostile: true
          });
        }
      }

      enemy.animFrame = (enemy.animFrame + dt * 4) % 2;
    }
  }

  function updateFireballs(dt) {
    for (let i = fireballs.length - 1; i >= 0; --i) {
      const fb = fireballs[i];
      fb.x += fb.vx * dt;
      fb.age += dt;

      if (fb.age > 3 || fb.x < cameraX - 50 || fb.x > cameraX + CANVAS_W + 50) {
        fireballs.splice(i, 1);
        continue;
      }

      // Player fireball hits enemy
      if (!fb.hostile) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (aabb(fb, enemy)) {
            stompEnemy(enemy);
            fireballs.splice(i, 1);
            break;
          }
        }
      } else {
        // Hostile fireball hits player
        if (player.alive && player.invincible <= 0 && !powerUpInvincible && aabb(fb, player)) {
          playerDeath();
          fireballs.splice(i, 1);
        }
      }
    }
  }

  function checkCoinCollection() {
    for (const coin of coins) {
      if (coin.collected) continue;
      if (!aabb(player, coin)) continue;

      coin.collected = true;
      ++coinCount;
      score += COIN_SCORE;
      // Coin collect sparkle particles
      particles.sparkle(coin.x + 8, coin.y + 8, 8, { color: '#ffd700', life: 0.4 });
      floatingText.add(coin.x + 8, coin.y - 10, '+' + COIN_SCORE, { color: '#ffd700' });
    }
  }

  function checkPowerUpCollection() {
    for (const pu of powerUps) {
      if (!pu.active) continue;
      if (!aabb(player, pu)) continue;

      pu.active = false;
      // Power-up collect sparkle
      particles.sparkle(pu.x + 10, pu.y + 10, 12, { color: '#00ffaa', life: 0.5 });
      floatingText.add(pu.x + 10, pu.y - 10, 'POWER UP!', { color: '#00ffaa' });

      if (pu.type === 'doubleJump') powerUpDoubleJump = true;
      else if (pu.type === 'invincible') powerUpInvincible = true;
      else if (pu.type === 'fireball') powerUpFireball = true;
      powerTimer = 15;
    }
  }

  function checkGoal() {
    for (const t of tiles) {
      if (t.type !== 'goal') continue;
      if (aabb(player, t))
        levelComplete();
    }
  }

  /* ── Level complete ── */
  function levelComplete() {
    // Level-clear confetti
    for (let i = 0; i < 5; ++i) {
      const cx = player.x - cameraX + Math.random() * 200 - 100;
      const cy = Math.random() * CANVAS_H;
      particles.burst(cx + cameraX, cy, 15, {
        color: CONFETTI_COLORS[i],
        life: 1.2,
        speed: 60
      });
    }

    ++currentLevel;
    generateLevel(currentLevel);
    updateTitle();
  }

  /* ── Player death ── */
  function playerDeath() {
    if (!player.alive || player.invincible > 0 || powerUpInvincible) return;
    player.alive = false;
    --lives;

    particles.burst(player.x + 12, player.y + 14, 20, { color: '#ff2200', life: 0.8, speed: 80 });
    screenShake.trigger(6, 0.3);

    if (lives <= 0) {
      state = STATE_DEAD;
      addHighScore(score, currentLevel);
      updateTitle();
    } else {
      player.invincible = 1.5;
    }
  }

  /* ── Toggle pause ── */
  function togglePause() {
    if (state === STATE_PLAYING) state = STATE_PAUSED;
    else if (state === STATE_PAUSED) state = STATE_PLAYING;
  }

  /* ── Game reset ── */
  function resetGame() {
    state = STATE_PLAYING;
    score = 0;
    lives = MAX_LIVES;
    currentLevel = 1;
    coinCount = 0;
    powerUpDoubleJump = false;
    powerUpInvincible = false;
    powerUpFireball = false;
    powerTimer = 0;
    generateLevel(currentLevel);
    particles.clear();
    floatingText.clear();
    updateTitle();
  }

  /* ── Title ── */
  function updateTitle() {
    const title = state === STATE_DEAD
      ? `Platformer - Game Over (Score: ${score})`
      : `Platformer - Level ${currentLevel} - Score: ${score}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  /* ── Rendering ── */
  function draw() {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    ctx.save();
    screenShake.apply(ctx);

    // Sky gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a2a5a');
    grad.addColorStop(1, '#3a6a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Cloud layer (slow parallax)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 8; ++i) {
      const cx = i * 180 - (cameraX * 0.15) % 180;
      const cy = 40 + (i % 3) * 30;
      ctx.beginPath();
      ctx.ellipse(cx + 40, cy, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 70, cy - 6, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 20, cy + 2, 25, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Distant mountains (behind hills)
    ctx.fillStyle = '#1a3a2a';
    for (let i = 0; i < 5; ++i) {
      const mx = i * 260 - (cameraX * 0.2) % 260;
      ctx.beginPath();
      ctx.moveTo(mx, CANVAS_H - 30);
      ctx.lineTo(mx + 130, CANVAS_H - 180 - (i % 2) * 40);
      ctx.lineTo(mx + 260, CANVAS_H - 30);
      ctx.closePath();
      ctx.fill();
    }

    // Parallax hills
    ctx.fillStyle = '#2a4a3a';
    for (let i = 0; i < 6; ++i) {
      const hx = i * 200 - (cameraX * 0.3) % 200;
      ctx.beginPath();
      ctx.arc(hx + 100, CANVAS_H - 20, 120, Math.PI, 0);
      ctx.fill();
    }

    // Tree silhouettes (medium parallax)
    ctx.fillStyle = '#1e3e28';
    for (let i = 0; i < 10; ++i) {
      const tx = i * 140 - (cameraX * 0.4) % 140;
      const th = 40 + (i % 3) * 15;
      // Trunk
      ctx.fillRect(tx + 8, CANVAS_H - 40, 6, 20);
      // Canopy (triangle)
      ctx.beginPath();
      ctx.moveTo(tx + 11, CANVAS_H - 40 - th);
      ctx.lineTo(tx - 10, CANVAS_H - 40);
      ctx.lineTo(tx + 32, CANVAS_H - 40);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Ground tiles
    for (const t of tiles) {
      if (t.x + t.w < cameraX - 10 || t.x > cameraX + CANVAS_W + 10) continue;
      if (t.type === 'ground') {
        // Gradient brown fill
        const gGrad = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
        gGrad.addColorStop(0, '#6a4a2a');
        gGrad.addColorStop(1, '#3a2a10');
        ctx.fillStyle = gGrad;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        // Subtle stone texture
        for (let sy = t.y + 6; sy < t.y + t.h - 2; sy += 7)
          for (let sx = t.x + 2; sx < t.x + t.w - 2; sx += 6) {
            ctx.fillStyle = ((sx + sy) & 1) ? '#5a3a18' : '#4a3020';
            ctx.fillRect(sx, sy, 3, 2);
          }
        // Grass strip on top
        ctx.fillStyle = '#4a8a2a';
        ctx.fillRect(t.x, t.y, t.w, 4);
        // Grass blades
        ctx.fillStyle = '#5aaa30';
        for (let gx = t.x; gx < t.x + t.w; gx += 4) {
          ctx.beginPath();
          ctx.moveTo(gx, t.y);
          ctx.lineTo(gx + 2, t.y - 4);
          ctx.lineTo(gx + 4, t.y);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t.type === 'goal') {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.fillStyle = '#ffee44';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GOAL', t.x + t.w / 2, t.y + t.h / 2 + 5);
        ctx.textAlign = 'start';
      }
    }

    // Platforms
    for (const p of platforms) {
      if (p.x + p.w < cameraX - 10 || p.x > cameraX + CANVAS_W + 10) continue;
      ctx.save();
      // Underside shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(p.x + 2, p.y + p.h, p.w - 4, 4);
      // Main platform body with rounded edges
      ctx.beginPath();
      ctx.moveTo(p.x + 4, p.y);
      ctx.lineTo(p.x + p.w - 4, p.y);
      ctx.arc(p.x + p.w - 4, p.y + p.h / 2, p.h / 2, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(p.x + 4, p.y + p.h);
      ctx.arc(p.x + 4, p.y + p.h / 2, p.h / 2, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = '#886644';
      ctx.fill();
      // Wood grain lines
      const grainColors = ['#7a5c3a', '#937050', '#80604a'];
      for (let gy = p.y + 3; gy < p.y + p.h - 1; gy += 3) {
        ctx.strokeStyle = grainColors[((gy / 3) | 0) % grainColors.length];
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x + 4, gy);
        ctx.lineTo(p.x + p.w - 4, gy);
        ctx.stroke();
      }
      // Green moss strip on top
      ctx.fillStyle = '#66aa44';
      ctx.fillRect(p.x + 4, p.y, p.w - 8, 3);
      ctx.restore();
    }

    // Coins
    for (const coin of coins) {
      if (coin.collected) continue;
      if (coin.x + coin.w < cameraX - 10 || coin.x > cameraX + CANVAS_W + 10) continue;
      const bob = Math.sin(Date.now() / 300 + coin.bobPhase) * 3;
      const spin = Math.cos(Date.now() / 200 + coin.bobPhase);
      const scaleX = Math.abs(spin) * 0.7 + 0.3;
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ffd700';
      ctx.translate(coin.x + 8, coin.y + 8 + bob);
      ctx.scale(scaleX, 1);
      // Outer coin
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      // Inner rim
      ctx.fillStyle = '#daa520';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      // 4-point star emblem
      if (scaleX > 0.5) {
        ctx.fillStyle = '#ffee88';
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(1, -1);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(1, 1);
        ctx.lineTo(0, 3.5);
        ctx.lineTo(-1, 1);
        ctx.lineTo(-3.5, 0);
        ctx.lineTo(-1, -1);
        ctx.closePath();
        ctx.fill();
      }
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-2, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Power-ups
    for (const pu of powerUps) {
      if (!pu.active) continue;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffaa';
      ctx.fillStyle = pu.type === 'doubleJump' ? '#00ccff' : pu.type === 'invincible' ? '#ffd700' : '#ff4400';
      ctx.fillRect(pu.x, pu.y, pu.w, pu.h);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pu.type === 'doubleJump' ? 'DJ' : pu.type === 'invincible' ? 'INV' : 'FB', pu.x + 10, pu.y + 14);
      ctx.textAlign = 'start';
      ctx.restore();
    }

    // Enemies
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.x + enemy.w < cameraX - 10 || enemy.x > cameraX + CANVAS_W + 10) continue;
      ctx.save();
      const ex = enemy.x;
      let ey = enemy.y;
      if (enemy.isBoss) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff0000';
        // Boss idle bob
        ey += Math.sin(Date.now() / 300) * 3;
      }
      const bodyColor = enemy.isBoss ? '#cc0000' : enemy.type === 'flyer' ? '#6644aa' : enemy.type === 'shooter' ? '#aa4400' : '#dd3333';

      if (enemy.type === 'flyer' && !enemy.isBoss) {
        // Flyer: rounded body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(ex + enemy.w / 2, ey + enemy.h / 2, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Flapping wings
        const wingFlap = Math.sin(Date.now() / 200) * 0.4;
        ctx.fillStyle = '#8866cc';
        ctx.save();
        // Left wing
        ctx.beginPath();
        ctx.moveTo(ex + 2, ey + enemy.h / 2);
        ctx.lineTo(ex - 8, ey + 4 + wingFlap * 10);
        ctx.lineTo(ex - 2, ey + enemy.h / 2 + 4);
        ctx.closePath();
        ctx.fill();
        // Right wing
        ctx.beginPath();
        ctx.moveTo(ex + enemy.w - 2, ey + enemy.h / 2);
        ctx.lineTo(ex + enemy.w + 8, ey + 4 + wingFlap * 10);
        ctx.lineTo(ex + enemy.w + 2, ey + enemy.h / 2 + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (enemy.type === 'shooter' && !enemy.isBoss) {
        // Shooter: body with rounded corners
        ctx.fillStyle = bodyColor;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(ex, ey, enemy.w, enemy.h, 4);
          ctx.fill();
        } else {
          ctx.fillRect(ex, ey, enemy.w, enemy.h);
        }
        // Gun barrel pointing toward player
        const gunDir = player.x > ex ? 1 : -1;
        ctx.strokeStyle = '#663300';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex + enemy.w / 2 + gunDir * (enemy.w / 2 - 2), ey + enemy.h / 2);
        ctx.lineTo(ex + enemy.w / 2 + gunDir * (enemy.w / 2 + 8), ey + enemy.h / 2);
        ctx.stroke();
        // Gun tip
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(ex + enemy.w / 2 + gunDir * (enemy.w / 2 + 8), ey + enemy.h / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Walker / Boss: body with rounded corners
        ctx.fillStyle = bodyColor;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(ex, ey, enemy.w, enemy.h, enemy.isBoss ? 6 : 4);
          ctx.fill();
        } else {
          ctx.fillRect(ex, ey, enemy.w, enemy.h);
        }
        if (enemy.isBoss) {
          // Boss crown/horns
          ctx.fillStyle = '#ffcc00';
          for (let ci = 0; ci < 3; ++ci) {
            const cx = ex + 8 + ci * 14;
            ctx.beginPath();
            ctx.moveTo(cx, ey);
            ctx.lineTo(cx + 4, ey - 10);
            ctx.lineTo(cx + 8, ey);
            ctx.closePath();
            ctx.fill();
          }
          // Crown band
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(ex + 4, ey - 2, enemy.w - 8, 4);
        } else {
          // Walker spikes/horns on top
          ctx.fillStyle = '#aa1111';
          for (let si = 0; si < 3; ++si) {
            const sx = ex + 4 + si * 8;
            ctx.beginPath();
            ctx.moveTo(sx, ey);
            ctx.lineTo(sx + 3, ey - 6);
            ctx.lineTo(sx + 6, ey);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // Eyes (common to all types)
      const ew = enemy.isBoss ? 8 : 4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex + 4, ey + 4, ew, ew);
      ctx.fillRect(ex + enemy.w - 4 - ew, ey + 4, ew, ew);
      ctx.fillStyle = '#000';
      ctx.fillRect(ex + 5, ey + 5, ew / 2, ew / 2);
      ctx.fillRect(ex + enemy.w - 3 - ew, ey + 5, ew / 2, ew / 2);
      // Boss health bar
      if (enemy.isBoss && enemy.bossHealth > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(ex, ey - 16, enemy.w, 6);
        ctx.fillStyle = '#ff0000';
        const hpFraction = enemy.bossHealth / (3 + Math.floor(currentLevel / 5));
        ctx.fillRect(ex, ey - 16, enemy.w * hpFraction, 6);
      }
      ctx.restore();
    }

    // Fireballs
    for (const fb of fireballs) {
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = fb.hostile ? '#ff4400' : '#ff8800';
      ctx.fillStyle = fb.hostile ? '#ff2200' : '#ff6600';
      ctx.beginPath();
      ctx.arc(fb.x + 5, fb.y + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw player
    if (player.alive && (player.invincible <= 0 || Math.floor(player.invincible * 10) % 2 === 0))
      drawPlayer();

    // Effects (in world space)
    particles.draw(ctx);
    floatingText.draw(ctx);

    ctx.restore(); // end camera transform

    ctx.restore(); // end shake

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, 22);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`Level: ${currentLevel}  Score: ${score}  Coins: ${coinCount}  Lives: ${lives}`, 6, 15);

    // Status bar
    if (elScore) elScore.textContent = 'Score: ' + score;
    if (elLevel) elLevel.textContent = 'Level: ' + currentLevel;
    if (elLives) elLives.textContent = 'Lives: ' + lives;
    if (elState) elState.textContent = state === STATE_PAUSED ? 'Paused' : state === STATE_DEAD ? 'Game Over' : 'Playing';

    // Overlays
    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign = 'start';
    } else if (state === STATE_DEAD) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Score: ' + score + '  |  Tap or press F2 for New Game', CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.textAlign = 'start';
    } else if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#66ddff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PLATFORMER', CANVAS_W / 2, CANVAS_H / 2 - 15);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press F2 or click New Game to start', CANVAS_W / 2, CANVAS_H / 2 + 15);
      ctx.textAlign = 'start';
    }
  }

  let _prevGrounded = false;

  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const centerX = px + player.w / 2;
    const centerY = py + player.h / 2;

    // Landing dust: emit particles when transitioning to grounded
    if (player.grounded && !_prevGrounded) {
      particles.burst(px + player.w / 2, py + player.h, 5, { color: '#aa9977', life: 0.3, speed: 25 });
    }
    _prevGrounded = player.grounded;

    ctx.save();

    // Jump squash/stretch
    let scaleX = 1;
    let scaleY = 1;
    if (player.vy < -100) {
      // Jumping up: compress x, stretch y
      scaleX = 0.9;
      scaleY = 1.1;
    } else if (player.vy > 100) {
      // Falling: stretch x, compress y
      scaleX = 1.1;
      scaleY = 0.9;
    }

    ctx.translate(centerX, centerY);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -centerY);

    // Power-up glow aura
    if (powerUpInvincible) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffd700';
    } else if (powerUpDoubleJump) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ccff';
    } else if (powerUpFireball) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff4400';
    }

    // Body — rounded torso
    ctx.fillStyle = '#3366cc';
    ctx.beginPath();
    ctx.ellipse(px + 12, py + 14, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belt/waist detail
    ctx.fillStyle = '#2a55aa';
    ctx.fillRect(px + 5, py + 18, 14, 3);

    // Head
    ctx.fillStyle = '#ffcc88';
    ctx.beginPath();
    ctx.arc(px + 12, py + 5, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hat/cap
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    if (player.facingRight) {
      ctx.arc(px + 12, py + 1, 8, Math.PI, 0);
      // Brim
      ctx.fillRect(px + 12, py - 2, 10, 3);
    } else {
      ctx.arc(px + 12, py + 1, 8, Math.PI, 0);
      ctx.fillRect(px + 2, py - 2, 10, 3);
    }
    ctx.fill();

    // Eyes
    const eyeOff = player.facingRight ? 2 : -2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + 8 + eyeOff, py + 3, 3, 3);
    ctx.fillRect(px + 13 + eyeOff, py + 3, 3, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(px + 9 + eyeOff, py + 4, 2, 2);
    ctx.fillRect(px + 14 + eyeOff, py + 4, 2, 2);

    // Arms — swing opposite to legs while running
    ctx.strokeStyle = '#3366cc';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (player.vx !== 0 && player.grounded) {
      const armSwing = Math.sin(player.animFrame * Math.PI / 2) * 5;
      // Left arm
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 10);
      ctx.lineTo(px + 1, py + 18 - armSwing);
      ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.moveTo(px + 20, py + 10);
      ctx.lineTo(px + 23, py + 18 + armSwing);
      ctx.stroke();
    } else {
      // Arms at rest
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 10);
      ctx.lineTo(px + 2, py + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 20, py + 10);
      ctx.lineTo(px + 22, py + 18);
      ctx.stroke();
    }

    // Legs — animate while running
    ctx.fillStyle = '#224488';
    if (player.vx !== 0 && player.grounded) {
      const legOff = Math.sin(player.animFrame * Math.PI / 2) * 3;
      ctx.fillRect(px + 5, py + 22 + legOff, 5, 6);
      ctx.fillRect(px + 14, py + 22 - legOff, 5, 6);
    } else {
      ctx.fillRect(px + 5, py + 22, 5, 6);
      ctx.fillRect(px + 14, py + 22, 5, 6);
    }
    // Shoes
    ctx.fillStyle = '#553311';
    if (player.vx !== 0 && player.grounded) {
      const legOff = Math.sin(player.animFrame * Math.PI / 2) * 3;
      ctx.fillRect(px + 4, py + 26 + legOff, 7, 2);
      ctx.fillRect(px + 13, py + 26 - legOff, 7, 2);
    } else {
      ctx.fillRect(px + 4, py + 26, 7, 2);
      ctx.fillRect(px + 13, py + 26, 7, 2);
    }
    ctx.restore();
  }

  /* ── Game loop ── */
  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT);
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ── Input ── */
  document.addEventListener('keydown', (e) => {
    keysDown[e.key] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
  });

  document.addEventListener('keyup', (e) => {
    keysDown[e.key] = false;
  });

  /* ── Click/Tap to start ── */
  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_READY || state === STATE_DEAD)
      resetGame();
  });

  /* ── Menu bar ── */
  const menuActions = {
    'new': () => resetGame(),
    'pause': togglePause,
    'high-scores': () => {
      renderHighScores();
      SZ.Dialog.show('highScoresBackdrop');
    },
    'exit': () => { if (User32?.DestroyWindow) User32.DestroyWindow(); },
    'controls': () => SZ.Dialog.show('controlsBackdrop'),
    'about': () => SZ.Dialog.show('dlg-about')
  };

  new SZ.MenuBar({ onAction: (action) => menuActions[action]?.() });

  /* ── Dialog wiring ── */
  SZ.Dialog.wireAll();

  const highScoresDialog = document.getElementById('highScoresBackdrop');
  if (highScoresDialog) {
    highScoresDialog.addEventListener('dialog:result', (e) => {
      if (e.detail === 'reset') {
        highScores = [];
        saveHighScores();
        renderHighScores();
      }
    });
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = '';
    for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
      const hs = highScores[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${hs ? hs.score : '---'}</td><td>${hs ? hs.level : '-'}</td>`;
      body.appendChild(tr);
    }
  }

  /* ── OS integration ── */
  function handleResize() {
    // Canvas size is fixed; CSS scales it
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg, wParam, lParam) => {
      if (msg === 'WM_THEMECHANGED') {
        // Theme changed — canvas game needs no action
      }
      if (msg === 'WM_SIZE')
        handleResize();
    });
  }

  /* ── Init ── */
  loadHighScores();
  generateLevel(currentLevel);
  updateTitle();
  handleResize();
  requestAnimationFrame(gameLoop);

})();
