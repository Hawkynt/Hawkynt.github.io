;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 512;
  const CANVAS_H = 448;
  const MAX_DT = 0.05;
  const GRAVITY = 600;
  const JUMP_FORCE = -320;
  const PLAYER_SPEED = 150;
  const BUBBLE_SPEED = 200;
  const BUBBLE_FLOAT_SPEED = -30;
  const BUBBLE_LIFESPAN = 8;
  const TRAP_ESCAPE_TIME = 6;
  const WALL_THICKNESS = 16;
  const POP_SCORE = 100;
  const FRUIT_SCORE = 200;

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* Storage */
  const STORAGE_PREFIX = 'sz-bubble-bobble';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
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

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Shoot bubbles to trap enemies, then pop', 'the bubbles to defeat them!', '', 'Left/Right or A/D = Move', 'Up or W = Jump', 'Space / Z / X = Shoot bubble'] },
    { title: 'Tips', lines: ['Pop multiple enemies at once for bonus points.', 'Collect fruit items for big score bonuses.', 'Bubbles float up -- use them as platforms!', '', 'Watch for power-ups that enhance your bubbles.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Game state ── */
  let state = STATE_READY;
  let score = 0;
  let lives = MAX_LIVES;
  let currentLevel = 1;
  let highScores = [];

  /* Player */
  let player = {
    x: 32, y: 384, vx: 0, vy: 0,
    w: 24, h: 24,
    facingRight: true,
    grounded: false,
    isJumping: false,
    animFrame: 0,
    animTimer: 0,
    alive: true,
    invincible: 0
  };

  /* Bubbles, enemies, items, platforms, power-ups */
  let bubbles = [];
  let enemies = [];
  let items = [];
  let platforms = [];
  let powerUps = [];
  let shootCooldown = 0;

  /* Background sparkle dots — fixed random positions with unique seeds */
  const _sparkles = [];
  for (let i = 0; i < 25; ++i)
    _sparkles.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, seed: Math.random() * Math.PI * 2 });

  /* Power-up state */
  let powerUpSpeed = false;
  let powerUpRange = false;
  let powerUpTimer = 0;

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

  /* ── Level flow properties ── */
  let levelFlow = { windX: 0, floatSpeed: 1.0 };

  /* ── Level generation ── */
  function generateLevel(level) {
    platforms = [];
    enemies = [];
    bubbles = [];
    items = [];
    powerUps = [];

    // Level-dependent flow: wind and float speed increase with level
    const windStrength = Math.min((level - 1) * 8, 60);
    levelFlow = {
      windX: level <= 2 ? 0 : (level % 2 === 0 ? windStrength : -windStrength),
      floatSpeed: Math.min(1.0 + (level - 1) * 0.1, 2.0)
    };

    // Floor
    platforms.push({ x: 0, y: CANVAS_H - WALL_THICKNESS, w: CANVAS_W, h: WALL_THICKNESS });
    // Walls
    platforms.push({ x: 0, y: 0, w: WALL_THICKNESS, h: CANVAS_H });
    platforms.push({ x: CANVAS_W - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: CANVAS_H });

    // Platforms — layout varies by level
    const rows = 5;
    for (let r = 0; r < rows; ++r) {
      const py = 80 + r * 72;
      const offset = (r % 2 === 0) ? 40 : 100;
      const pw = CANVAS_W - 80 - offset;
      platforms.push({ x: offset, y: py, w: pw, h: 12 });
    }

    // Enemies — count increases with level
    const numEnemies = Math.min(3 + level, 10);
    for (let i = 0; i < numEnemies; ++i) {
      const ex = 60 + Math.random() * (CANVAS_W - 120);
      const ey = 60 + Math.random() * (CANVAS_H - 160);
      enemies.push({
        x: ex, y: ey, vx: (40 + level * 5) * (Math.random() < 0.5 ? 1 : -1), vy: 0,
        w: 20, h: 20,
        alive: true,
        trapped: false,
        trapTimer: 0,
        animFrame: 0
      });
    }

    // Power-up spawn (random chance per level)
    if (Math.random() < 0.5) {
      const types = ['speed', 'range', 'fire'];
      powerUps.push({
        x: 60 + Math.random() * (CANVAS_W - 120),
        y: 100 + Math.random() * (CANVAS_H - 200),
        type: types[Math.floor(Math.random() * types.length)],
        w: 16, h: 16,
        active: true
      });
    }
  }

  /* ── Collision helpers ── */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function landOnPlatform(entity, dt) {
    entity.grounded = false;
    for (const p of platforms) {
      const prevBottom = entity.y + entity.h - entity.vy * dt;
      if (entity.vy >= 0 &&
          entity.x + entity.w > p.x && entity.x < p.x + p.w &&
          prevBottom <= p.y && entity.y + entity.h >= p.y) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.grounded = true;
        entity.isJumping = false;
        return true;
      }
    }
    return false;
  }

  /* ── Bubble shooting ── */
  function shootBubble() { if (state !== STATE_PLAYING || !player.alive) return;
    if (shootCooldown > 0) return;
    shootCooldown = 0.15;

    const dir = player.facingRight ? 1 : -1;
    const range = powerUpRange ? 1.5 : 1.0;
    const lifespan = Math.max(3, BUBBLE_LIFESPAN - currentLevel * 0.3);
    bubbles.push({
      x: player.x + (dir > 0 ? player.w : -12),
      y: player.y + 4,
      vx: BUBBLE_SPEED * dir * range,
      vy: 0,
      w: 16, h: 16,
      age: 0,
      maxAge: lifespan,
      phase: 'shoot', // shoot → float → pop
      phaseTimer: 0.3,
      trappedEnemy: null
    });
  }

  /* ── Update ── */
  function update(dt) {
    if (state !== STATE_PLAYING) return;

    shootCooldown = Math.max(0, shootCooldown - dt);

    // Power-up timer
    if (powerUpTimer > 0) {
      powerUpTimer -= dt;
      if (powerUpTimer <= 0) {
        powerUpSpeed = false;
        powerUpRange = false;
      }
    }

    updatePlayer(dt);
    updateBubbles(dt);
    updateEnemies(dt);
    updateItems(dt);
    checkLevelClear();

    particles.update(dt);
    screenShake.update(dt);
    floatingText.update(dt);
  }

  function updatePlayer(dt) {
    if (!player.alive) {
      player.invincible -= dt;
      if (player.invincible <= 0) {
        player.alive = true;
        player.x = 32;
        player.y = 384;
        player.vx = 0;
        player.vy = 0;
        player.invincible = 2;
      }
      return;
    }

    player.invincible -= dt;
    const speed = powerUpSpeed ? PLAYER_SPEED * 1.5 : PLAYER_SPEED;

    // Horizontal movement
    player.vx = 0;
    if (keysDown['ArrowLeft'] || keysDown['a']) {
      player.vx = -speed;
      player.facingRight = false;
    }
    if (keysDown['ArrowRight'] || keysDown['d']) {
      player.vx = speed;
      player.facingRight = true;
    }

    // Jump
    if ((keysDown['ArrowUp'] || keysDown['w']) && player.grounded) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
      player.grounded = false;
    }

    // Gravity
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Platform collision
    landOnPlatform(player, dt);

    // Screen wrap: fall through bottom → respawn at top
    if (player.y > CANVAS_H) {
      player.y = -player.h;
    }

    // Wall clamp
    if (player.x < WALL_THICKNESS) player.x = WALL_THICKNESS;
    if (player.x + player.w > CANVAS_W - WALL_THICKNESS) player.x = CANVAS_W - WALL_THICKNESS - player.w;

    // Animation
    player.animTimer += dt;
    if (player.animTimer > 0.15) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }

    // Fire key
    if (keysDown[' '] || keysDown['z'] || keysDown['x'])
      shootBubble();

    // Check enemy-player collision (untrapped enemies)
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.trapped) continue;
      if (aabb(player, enemy) && player.invincible <= 0)
        playerDeath();
    }

    // Collect power-ups
    for (const pu of powerUps) {
      if (!pu.active) continue;
      if (aabb(player, pu)) {
        pu.active = false;
        // Power-up sparkle effect
        particles.sparkle(pu.x + 8, pu.y + 8, 10, { color: '#ffd700', life: 0.5 });
        if (pu.type === 'speed') powerUpSpeed = true;
        if (pu.type === 'range') powerUpRange = true;
        powerUpTimer = 10;
        floatingText.add(pu.x, pu.y - 10, 'POWER UP!', { color: '#ffd700' });
      }
    }

    // Collect fruit items for bonus score
    for (let i = items.length - 1; i >= 0; --i) {
      if (aabb(player, items[i])) {
        const item = items[i];
        score += item.score;
        floatingText.add(item.x, item.y - 10, '+' + item.score, { color: '#ff9900' });
        particles.sparkle(item.x + 8, item.y + 8, 6, { color: '#ff9900', life: 0.4 });
        items.splice(i, 1);
      }
    }
  }

  function updateBubbles(dt) {
    for (let i = bubbles.length - 1; i >= 0; --i) {
      const b = bubbles[i];
      b.age += dt;

      if (b.phase === 'shoot') {
        b.x += b.vx * dt;
        b.phaseTimer -= dt;
        // Wobble while shooting
        b.y += Math.sin(b.age * 12) * 0.5;
        if (b.phaseTimer <= 0) {
          b.phase = 'float';
          b.vx = 0;
        }

        // Check bubble-enemy collision for trapping
        for (const enemy of enemies) {
          if (!enemy.alive || enemy.trapped) continue;
          if (aabb(b, enemy)) {
            // Trap enemy in bubble
            enemy.trapped = true;
            enemy.trapTimer = TRAP_ESCAPE_TIME;
            b.trappedEnemy = enemy;
            b.phase = 'float';
            b.vx = 0;
            particles.burst(enemy.x + 10, enemy.y + 10, 6, { color: '#44aaff', life: 0.3, speed: 30 });
          }
        }
      } else if (b.phase === 'float') {
        // Bubbles drift upward with wobble + level flow
        b.y += BUBBLE_FLOAT_SPEED * levelFlow.floatSpeed * dt;
        b.x += Math.sin(b.age * 3) * 0.8 + levelFlow.windX * dt;

        // Platform collision for floating bubbles
        for (const p of platforms) {
          if (b.x + b.w > p.x && b.x < p.x + p.w &&
              b.y < p.y + p.h && b.y + b.h > p.y) {
            // Hit from below: stop vertical movement, slide horizontally
            if (b.y + b.h > p.y && b.y < p.y) {
              b.y = p.y - b.h;
              b.x += (levelFlow.windX !== 0 ? Math.sign(levelFlow.windX) : (Math.random() < 0.5 ? 1 : -1)) * 30 * dt;
            } else {
              // Side collision: bounce away
              if (b.x + b.w / 2 < p.x + p.w / 2)
                b.x = p.x - b.w;
              else
                b.x = p.x + p.w;
            }
          }
        }

        // Move trapped enemy with bubble
        if (b.trappedEnemy) {
          b.trappedEnemy.x = b.x - 2;
          b.trappedEnemy.y = b.y - 2;
        }

        // Bubble interaction — bounce on top or pop
        if (aabb(player, b)) {
          const prevBottom = player.y + player.h - player.vy * dt;
          const jumpHeld = keysDown['ArrowUp'] || keysDown['w'];
          const landingFromAbove = player.vy >= 0 && prevBottom <= b.y + 6;

          // Bounce off bubble when landing from above with jump held
          if (landingFromAbove && jumpHeld) {
            player.vy = JUMP_FORCE * 0.85;
            player.y = b.y - player.h;
            player.grounded = false;
            player.isJumping = true;
            // Wobble the bubble downward briefly
            b.y += 4;
            particles.burst(b.x + 8, b.y, 4, { color: '#aaddff', life: 0.2, speed: 15 });
            continue;
          }

          // Pop trapped bubble on contact (non-bounce)
          if (b.trappedEnemy) {
            const enemy = b.trappedEnemy;
            enemy.alive = false;
            enemy.trapped = false;
            score += POP_SCORE;

            // Pop particle burst
            particles.burst(b.x + 8, b.y + 8, 12, { color: '#66ddff', life: 0.5, speed: 50 });
            floatingText.add(b.x + 8, b.y - 10, '+' + POP_SCORE, { color: '#66ddff' });

            // Drop fruit item
            items.push({
              x: b.x, y: b.y,
              w: 14, h: 14,
              vy: 0,
              score: FRUIT_SCORE,
              type: 'fruit',
              age: 0
            });

            bubbles.splice(i, 1);
            continue;
          }
        }
      }

      // Bubble expire — pop
      if (b.age >= b.maxAge) {
        // If trapped enemy, it escapes
        if (b.trappedEnemy) {
          b.trappedEnemy.trapped = false;
          b.trappedEnemy.trapTimer = 0;
        }
        particles.burst(b.x + 8, b.y + 8, 4, { color: '#aaddff', life: 0.2, speed: 20 });
        bubbles.splice(i, 1);
        continue;
      }

      // Wall bounds
      if (b.x < WALL_THICKNESS || b.x + b.w > CANVAS_W - WALL_THICKNESS || b.y < -20) {
        if (b.trappedEnemy) {
          b.trappedEnemy.trapped = false;
          b.trappedEnemy.trapTimer = 0;
        }
        bubbles.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      if (enemy.trapped) {
        // Trapped enemy counts down escape timer
        enemy.trapTimer -= dt;
        if (enemy.trapTimer <= 0) {
          // Enemy breaks free and escapes from bubble
          enemy.trapped = false;
          enemy.vx = (Math.random() < 0.5 ? 1 : -1) * 60;
          particles.burst(enemy.x + 10, enemy.y + 10, 5, { color: '#ff4444', life: 0.3, speed: 25 });
        }
        continue;
      }

      // Gravity
      enemy.vy += GRAVITY * dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Platform landing
      landOnPlatform(enemy, dt);

      // Wall bounce
      if (enemy.x < WALL_THICKNESS) { enemy.x = WALL_THICKNESS; enemy.vx = Math.abs(enemy.vx); }
      if (enemy.x + enemy.w > CANVAS_W - WALL_THICKNESS) { enemy.x = CANVAS_W - WALL_THICKNESS - enemy.w; enemy.vx = -Math.abs(enemy.vx); }

      // Screen wrap bottom to top
      if (enemy.y > CANVAS_H) enemy.y = -enemy.h;

      // Enemy-player collision
      if (!enemy.trapped && player.alive && player.invincible <= 0 && aabb(player, enemy))
        playerDeath();

      // Animation
      enemy.animFrame = (enemy.animFrame + dt * 4) % 2;
    }
  }

  function updateItems(dt) {
    for (let i = items.length - 1; i >= 0; --i) {
      const item = items[i];
      item.vy += GRAVITY * dt;
      item.y += item.vy * dt;
      item.age += dt;

      // Land on platforms
      for (const p of platforms) {
        if (item.vy >= 0 &&
            item.x + item.w > p.x && item.x < p.x + p.w &&
            item.y + item.h >= p.y && item.y + item.h - item.vy * dt <= p.y) {
          item.y = p.y - item.h;
          item.vy = 0;
        }
      }

      // Despawn after 10s
      if (item.age > 10) items.splice(i, 1);
    }
  }

  /* ── Level clear ── */
  function checkLevelClear() {
    const remaining = enemies.filter(e => e.alive).length;
    if (remaining === 0 && state === STATE_PLAYING) {
      levelComplete();
    }
  }

  function levelComplete() {
    // Level-clear confetti burst
    for (let i = 0; i < 5; ++i) {
      const cx = 60 + Math.random() * (CANVAS_W - 120);
      const cy = 60 + Math.random() * (CANVAS_H - 120);
      particles.burst(cx, cy, 15, {
        color: ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0'][i],
        life: 1.2,
        speed: 60
      });
    }

    ++currentLevel;
    generateLevel(currentLevel);
    resetPlayerPosition();
    updateTitle();
  }

  /* ── Player death ── */
  function playerDeath() {
    if (!player.alive || player.invincible > 0) return;
    player.alive = false;
    --lives;

    particles.burst(player.x + 12, player.y + 12, 20, { color: '#ff2200', life: 0.8, speed: 80 });
    screenShake.trigger(6, 0.3);

    if (lives <= 0) {
      state = STATE_DEAD;
      addHighScore(score, currentLevel);
      updateTitle();
    } else {
      player.invincible = 1.5;
    }
  }

  function togglePause() {
    if (state === STATE_PLAYING) state = STATE_PAUSED;
    else if (state === STATE_PAUSED) state = STATE_PLAYING;
  }

  function resetPlayerPosition() {
    player.x = 32;
    player.y = 384;
    player.vx = 0;
    player.vy = 0;
    player.alive = true;
  }

  /* ── Game reset ── */
  function resetGame() {
    state = STATE_PLAYING;
    score = 0;
    lives = MAX_LIVES;
    currentLevel = 1;
    powerUpSpeed = false;
    powerUpRange = false;
    powerUpTimer = 0;
    generateLevel(currentLevel);
    resetPlayerPosition();
    player.invincible = 0;
    particles.clear();
    floatingText.clear();
    updateTitle();
  }

  /* ── Title ── */
  function updateTitle() {
    const title = state === STATE_DEAD
      ? `Bubble Bobble - Game Over (Score: ${score})`
      : `Bubble Bobble - Level ${currentLevel} - Score: ${score}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  /* ── Rendering ── */
  function draw() {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    ctx.save();
    screenShake.apply(ctx);

    // Background — vertical gradient with twinkling sparkle stars
    {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bgGrad.addColorStop(0, '#06061e');
      bgGrad.addColorStop(1, '#141438');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const now = Date.now() / 1000;
      for (const s of _sparkles) {
        const alpha = Math.sin(now + s.seed) * 0.4 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.fillRect(s.x, s.y, 2, 2);
      }
    }

    // Platforms — brick texture with gradient and edge highlight
    for (const p of platforms) {
      ctx.save();
      const pGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      pGrad.addColorStop(0, '#556');
      pGrad.addColorStop(1, '#334');
      ctx.fillStyle = pGrad;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // Brick pattern — staggered small rectangles
      ctx.fillStyle = 'rgba(120,120,160,0.25)';
      const brickW = 16;
      const brickH = Math.max(6, p.h / 2);
      for (let row = 0; row * brickH < p.h; ++row) {
        const offsetX = (row % 2 === 0) ? 0 : brickW / 2;
        for (let bx = 0; bx < p.w; bx += brickW) {
          const drawX = p.x + bx + offsetX;
          const drawY = p.y + row * brickH;
          if (drawX < p.x + p.w && drawY < p.y + p.h)
            ctx.fillRect(drawX + 1, drawY + 1, Math.min(brickW - 2, p.x + p.w - drawX - 1), Math.min(brickH - 1, p.y + p.h - drawY - 1));
        }
      }

      // Edge highlight — bright line on top
      ctx.strokeStyle = '#99a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 0.5);
      ctx.lineTo(p.x + p.w, p.y + 0.5);
      ctx.stroke();

      // Border
      ctx.strokeStyle = '#668';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.restore();
    }

    // Items (fruit drops) — 3D sphere with radial gradient and specular highlight
    for (const item of items) {
      ctx.save();
      const fCx = item.x + 7;
      const fCy = item.y + 7;
      const fGrad = ctx.createRadialGradient(fCx - 2, fCy - 2, 1, fCx, fCy, 8);
      fGrad.addColorStop(0, '#ffaa33');
      fGrad.addColorStop(0.7, '#ff6600');
      fGrad.addColorStop(1, '#aa3300');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(fCx, fCy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight — small white dot upper-left
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(fCx - 3, fCy - 3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Leaf / stem
      ctx.fillStyle = '#00aa00';
      ctx.fillRect(item.x + 5, item.y - 2, 4, 4);
      ctx.restore();
    }

    // Power-ups
    for (const pu of powerUps) {
      if (!pu.active) continue;
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffd700';
      ctx.fillStyle = pu.type === 'speed' ? '#00ff88' : pu.type === 'range' ? '#ff8800' : '#ff4400';
      ctx.fillRect(pu.x, pu.y, pu.w, pu.h);
      ctx.restore();
    }

    // Bubbles — glass sphere with gradient, rainbow shimmer, wobble, and trapped enemy miniature
    for (const b of bubbles) {
      ctx.save();
      ctx.globalAlpha = 0.7;

      const bCx = b.x + 8;
      const bCy = b.y + 8;

      // Wobble deformation — oscillating ellipse
      const wobbleX = Math.sin(Date.now() / 300 + b.x) * 0.08;
      const wobbleY = Math.cos(Date.now() / 400 + b.y) * 0.08;
      ctx.translate(bCx, bCy);
      ctx.scale(1 + wobbleX, 1 + wobbleY);
      ctx.translate(-bCx, -bCy);

      // Bubble glow for trapped enemy
      if (b.trappedEnemy) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#44aaff';
      }

      // Radial gradient fill — glass/sphere look
      const bubGrad = ctx.createRadialGradient(bCx, bCy, 1, bCx, bCy, 11);
      bubGrad.addColorStop(0, 'rgba(200,240,255,0.05)');
      bubGrad.addColorStop(0.6, 'rgba(100,200,255,0.12)');
      bubGrad.addColorStop(1, 'rgba(100,200,255,0.25)');
      ctx.fillStyle = bubGrad;
      ctx.beginPath();
      ctx.arc(bCx, bCy, 10, 0, Math.PI * 2);
      ctx.fill();

      // Stroke
      ctx.strokeStyle = '#88ddff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rainbow shimmer highlight — hue cycles over time
      const hue = ((Date.now() / 1000) * 60 + b.x * 3) % 360;
      ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.45)`;
      ctx.beginPath();
      ctx.arc(bCx - 3, bCy - 3, 4, 0, Math.PI * 2);
      ctx.fill();

      // Second smaller highlight for pop effect
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(bCx + 2, bCy - 5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Trapped enemy miniature inside bubble
      if (b.trappedEnemy) {
        ctx.fillStyle = 'rgba(220,60,60,0.7)';
        ctx.fillRect(bCx - 4, bCy - 3, 8, 7);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bCx - 3, bCy - 2, 2, 2);
        ctx.fillRect(bCx + 1, bCy - 2, 2, 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(bCx - 2, bCy - 1, 1, 1);
        ctx.fillRect(bCx + 2, bCy - 1, 1, 1);
      }

      ctx.restore();
    }

    // Enemies — rounded body with horns, angry eyebrows, and trapped dazed state
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      ctx.save();
      const eCx = enemy.x + enemy.w / 2;
      const eCy = enemy.y + enemy.h / 2;
      const eRad = enemy.w / 2;

      if (enemy.trapped) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#44aaff';
      }

      // Rounded body
      ctx.fillStyle = enemy.trapped ? '#7788dd' : '#ee4444';
      ctx.beginPath();
      ctx.arc(eCx, eCy, eRad, 0, Math.PI * 2);
      ctx.fill();

      // Horns / antennae — two small triangles on top
      ctx.fillStyle = enemy.trapped ? '#6677cc' : '#cc2222';
      ctx.beginPath();
      ctx.moveTo(eCx - 5, eCy - eRad + 1);
      ctx.lineTo(eCx - 7, eCy - eRad - 6);
      ctx.lineTo(eCx - 2, eCy - eRad + 1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(eCx + 5, eCy - eRad + 1);
      ctx.lineTo(eCx + 7, eCy - eRad - 6);
      ctx.lineTo(eCx + 2, eCy - eRad + 1);
      ctx.fill();

      if (enemy.trapped) {
        // Dazed eyes — white sclera with spiral arcs instead of solid pupils
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eCx - 4, eCy - 1, 3, 0, Math.PI * 2);
        ctx.arc(eCx + 4, eCy - 1, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spiral daze in pupils
        ctx.strokeStyle = '#5566aa';
        ctx.lineWidth = 1;
        const spiralT = Date.now() / 300;
        for (const sx of [eCx - 4, eCx + 4]) {
          ctx.beginPath();
          ctx.arc(sx, eCy - 1, 2, spiralT, spiralT + Math.PI * 1.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sx, eCy - 1, 1, spiralT + Math.PI, spiralT + Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Normal eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eCx - 4, eCy - 1, 3, 0, Math.PI * 2);
        ctx.arc(eCx + 4, eCy - 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eCx - 4, eCy - 1, 1.5, 0, Math.PI * 2);
        ctx.arc(eCx + 4, eCy - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows — short diagonal lines above eyes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(eCx - 6, eCy - 5);
        ctx.lineTo(eCx - 2, eCy - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eCx + 6, eCy - 5);
        ctx.lineTo(eCx + 2, eCy - 4);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw player
    if (player.alive && (player.invincible <= 0 || Math.floor(player.invincible * 10) % 2 === 0)) {
      drawPlayer();
    }

    // Effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`Level: ${currentLevel}  Score: ${score}  Lives: ${lives}`, 6, 14);

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
      ctx.fillText('BUBBLE BOBBLE', CANVAS_W / 2, CANVAS_H / 2 - 15);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press F2 or click New Game to start', CANVAS_W / 2, CANVAS_H / 2 + 15);
      ctx.textAlign = 'start';
    }

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 380, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(10,25,40,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#6df';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#6df';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
    ctx.textAlign = 'start';
  }

  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const cx = px + 12;
    const cy = py + 12;
    const dir = player.facingRight ? 1 : -1;

    ctx.save();

    // Breathing animation — subtle scale pulse
    const breathScale = Math.sin(Date.now() / 500) * 0.03 + 1;
    ctx.translate(cx, cy);
    ctx.scale(breathScale, breathScale);
    ctx.translate(-cx, -cy);

    // ── Tail ── stubby pointed tail behind body
    ctx.fillStyle = '#44bb55';
    ctx.beginPath();
    ctx.moveTo(cx - dir * 10, cy + 4);
    ctx.lineTo(cx - dir * 19, cy - 1);
    ctx.lineTo(cx - dir * 17, cy + 4);
    ctx.lineTo(cx - dir * 20, cy + 8);
    ctx.lineTo(cx - dir * 12, cy + 7);
    ctx.closePath();
    ctx.fill();

    // ── Body ── oval dinosaur body (wider than tall)
    ctx.fillStyle = '#55dd77';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Belly ── lighter oval on front
    ctx.fillStyle = '#aaffbb';
    ctx.beginPath();
    ctx.ellipse(cx + dir * 2, cy + 3, 6, 7, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Back plates ── 3 small rounded bumps along the top-back
    ctx.fillStyle = '#33aa55';
    for (let i = 0; i < 3; ++i) {
      const bumpAngle = Math.PI * 0.9 + (dir > 0 ? 1 : -1) * (i * 0.35 + 0.15);
      const bx = cx + Math.cos(bumpAngle) * 10;
      const by = cy + Math.sin(bumpAngle) * 9;
      ctx.beginPath();
      ctx.arc(bx, by, 3 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Head ── larger round head on the facing side, slightly above body
    const headX = cx + dir * 8;
    const headY = cy - 6;
    const headR = 8;
    ctx.fillStyle = '#55dd77';
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // ── Snout ── small rounded muzzle protruding forward
    const snoutX = headX + dir * 7;
    const snoutY = headY + 2;
    ctx.fillStyle = '#55dd77';
    ctx.beginPath();
    ctx.ellipse(snoutX, snoutY, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Nostril ── small dot on snout
    ctx.fillStyle = '#228844';
    ctx.beginPath();
    ctx.arc(snoutX + dir * 3, snoutY - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // ── Mouth ── gentle smile line
    ctx.strokeStyle = '#228844';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (player.facingRight)
      ctx.arc(snoutX, snoutY + 1, 3.5, 0.2, Math.PI - 0.2);
    else
      ctx.arc(snoutX, snoutY + 1, 3.5, 0.2 + Math.PI, Math.PI * 2 - 0.2);
    ctx.stroke();

    // ── Eyes ── big round cute eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(headX + dir * 2, headY - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // Pupil — large and round
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(headX + dir * 3, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye highlight — small white dot for life
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(headX + dir * 2, headY - 3.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // ── Tiny arms ── stubby T-rex arms
    ctx.strokeStyle = '#44bb55';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const armBaseX = cx + dir * 6;
    const armBaseY = cy - 1;
    const armWave = player.vx !== 0 ? Math.sin(player.animFrame * Math.PI / 2) * 3 : 0;
    ctx.beginPath();
    ctx.moveTo(armBaseX, armBaseY);
    ctx.lineTo(armBaseX + dir * 5, armBaseY + 3 + armWave);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(armBaseX, armBaseY + 4);
    ctx.lineTo(armBaseX + dir * 5, armBaseY + 7 - armWave);
    ctx.stroke();
    // Tiny claw dots at arm tips
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(armBaseX + dir * 5, armBaseY + 3 + armWave, 1, 0, Math.PI * 2);
    ctx.arc(armBaseX + dir * 5, armBaseY + 7 - armWave, 1, 0, Math.PI * 2);
    ctx.fill();

    // ── Legs ── sturdy rounded feet
    ctx.fillStyle = '#44bb55';
    if (player.vx !== 0 && player.grounded) {
      const legOff = Math.sin(player.animFrame * Math.PI / 2) * 4;
      // Left leg
      ctx.fillRect(cx - 6, cy + 7, 5, 6 + legOff);
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy + 13 + legOff, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Right leg
      ctx.fillRect(cx + 1, cy + 7, 5, 6 - legOff);
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy + 13 - legOff, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standing
      ctx.fillRect(cx - 6, cy + 7, 5, 6);
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy + 13, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx + 1, cy + 7, 5, 6);
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy + 13, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Toe claws
    ctx.fillStyle = '#fff';
    for (const footX of [cx - 4, cx + 3]) {
      for (let t = -1; t <= 1; ++t) {
        ctx.beginPath();
        ctx.arc(footX + t * 2, cy + 15 + (player.vx !== 0 && player.grounded ? (footX < cx ? Math.sin(player.animFrame * Math.PI / 2) * 4 : -Math.sin(player.animFrame * Math.PI / 2) * 4) : 0), 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
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

    /* Tutorial navigation */
    if (showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++tutorialPage;
        if (tutorialPage >= TUTORIAL_PAGES.length)
          showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && tutorialPage > 0) {
        e.preventDefault();
        --tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
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
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
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
    'tutorial': () => { showTutorial = true; tutorialPage = 0; },
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
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  generateLevel(currentLevel);
  updateTitle();
  handleResize();
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  requestAnimationFrame(gameLoop);

})();
