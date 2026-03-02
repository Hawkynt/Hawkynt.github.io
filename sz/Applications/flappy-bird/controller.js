;(function() {
  'use strict';

  /* ── Constants ── */
  const STORAGE_KEY = 'sz-flappy-bird-highscores';
  const MAX_HIGH_SCORES = 5;
  const CANVAS_W = 400;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;

  /* Physics */
  const GRAVITY = 0.4;
  const FLAP_IMPULSE = -7.5;
  const TERMINAL_VELOCITY = 12;

  /* Bird */
  const BIRD_X = 80;
  const BIRD_W = 34;
  const BIRD_H = 24;
  const BIRD_HITBOX_SCALE = 0.8;

  /* Pipes */
  const PIPE_WIDTH = 52;
  const PIPE_CAP_H = 8;
  const INITIAL_GAP = 155;
  const MIN_GAP = 100;
  const GAP_REDUCTION = 2;
  const INITIAL_SCROLL_SPEED = 2.2;
  const MAX_SCROLL_SPEED = 4.5;
  const SPEED_INCREMENT = 0.15;
  const INITIAL_PIPE_SPACING = 300;
  const MIN_PIPE_SPACING = 210;
  const SPACING_REDUCTION = 4;
  const DIFFICULTY_INTERVAL = 12;
  const PIPE_SAFE_MARGIN = 60;

  /* Ground */
  const GROUND_HEIGHT = 60;

  /* Medal tiers */
  const MEDAL_TIERS = [
    { name: 'Platinum', min: 100, color: '#e5e4e2' },
    { name: 'Gold', min: 50, color: '#ffd700' },
    { name: 'Silver', min: 25, color: '#c0c0c0' },
    { name: 'Bronze', min: 10, color: '#cd7f32' }
  ];

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DYING = 'DYING';
  const STATE_DEAD = 'DEAD';

  /* Parallax layers */
  const PARALLAX_LAYERS = [
    { speed: 0.3, color: 'rgba(100,150,200,0.3)', y: 0.2, h: 0.15 },
    { speed: 0.6, color: 'rgba(60,100,60,0.4)', y: 0.55, h: 0.15 }
  ];

  /* Procedural clouds (seeded positions) */
  const CLOUDS = [
    { baseX: 50, y: 40, r1: 40, r2: 20 },
    { baseX: 180, y: 70, r1: 35, r2: 18 },
    { baseX: 310, y: 30, r1: 45, r2: 22 },
    { baseX: 430, y: 55, r1: 38, r2: 19 }
  ];

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusScore = document.getElementById('statusScore');
  const statusBest = document.getElementById('statusBest');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Game State ── */
  let state = STATE_READY;
  let bird = { x: BIRD_X, y: 0, vy: 0, angle: 0 };
  let pipes = [];
  let score = 0;
  let highScores = [];
  let pipeTimer = 0;
  let scrollOffset = 0;
  let layerOffsets = PARALLAX_LAYERS.map(() => 0);
  let cloudOffset = 0;
  let hillsOffset = 0;
  let animFrameId = null;
  let lastTimestamp = 0;
  let readyBobT = 0;
  let dyingTimer = 0;
  let dpr = 1;
  let scorePopTimer = 0;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Difficulty ── */
  function difficultyTier() {
    return Math.floor(score / DIFFICULTY_INTERVAL);
  }

  function currentGap() {
    return Math.max(MIN_GAP, INITIAL_GAP - difficultyTier() * GAP_REDUCTION);
  }

  function currentScrollSpeed() {
    return Math.min(MAX_SCROLL_SPEED, INITIAL_SCROLL_SPEED + difficultyTier() * SPEED_INCREMENT);
  }

  function currentPipeSpacing() {
    return Math.max(MIN_PIPE_SPACING, INITIAL_PIPE_SPACING - difficultyTier() * SPACING_REDUCTION);
  }

  /* ── Medal ── */
  function getMedal(s) {
    for (const tier of MEDAL_TIERS)
      if (s >= tier.min)
        return tier;
    return null;
  }

  /* ── High Score Persistence ── */
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(s) {
    highScores.push(s);
    highScores.sort((a, b) => b - a);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function getBestScore() {
    return highScores.length > 0 ? highScores[0] : 0;
  }

  /* ── Pipe Spawning ── */
  function spawnPipe() {
    const gap = currentGap();
    const minGapY = PIPE_SAFE_MARGIN + gap / 2;
    const maxGapY = CANVAS_H - GROUND_HEIGHT - PIPE_SAFE_MARGIN - gap / 2;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);
    pipes.push({
      x: CANVAS_W + PIPE_WIDTH,
      gapY,
      gapHeight: gap,
      scored: false
    });
  }

  /* ── Collision Detection ── */
  function checkCollision() {
    const bx = bird.x - BIRD_W * BIRD_HITBOX_SCALE / 2;
    const by = bird.y - BIRD_H * BIRD_HITBOX_SCALE / 2;
    const bw = BIRD_W * BIRD_HITBOX_SCALE;
    const bh = BIRD_H * BIRD_HITBOX_SCALE;

    // Ground collision
    if (bird.y + BIRD_H / 2 >= CANVAS_H - GROUND_HEIGHT)
      return true;

    for (const pipe of pipes) {
      const topPipeBottom = pipe.gapY - pipe.gapHeight / 2;
      const botPipeTop = pipe.gapY + pipe.gapHeight / 2;

      // Top pipe overlap check
      if (bx + bw > pipe.x && bx < pipe.x + PIPE_WIDTH &&
          by < topPipeBottom)
        return true;

      // Bottom pipe overlap check
      if (bx + bw > pipe.x && bx < pipe.x + PIPE_WIDTH &&
          by + bh > botPipeTop)
        return true;
    }

    return false;
  }

  /* ── Reset ── */
  function resetGame() {
    bird = { x: BIRD_X, y: CANVAS_H * 0.4, vy: 0, angle: 0 };
    pipes = [];
    score = 0;
    pipeTimer = 0;
    scrollOffset = 0;
    layerOffsets = PARALLAX_LAYERS.map(() => 0);
    cloudOffset = 0;
    hillsOffset = 0;
    readyBobT = 0;
    dyingTimer = 0;
    scorePopTimer = 0;
    particles.clear();
    floatingText.clear();
    state = STATE_READY;
    updateStatus();
    SZ.Dlls.User32.SetWindowText('Flappy Bird');
  }

  /* ── Flap ── */
  function flap() {
    bird.vy = FLAP_IMPULSE;
    // Flap particle puff effect
    particles.burst(bird.x, bird.y + BIRD_H / 2, 6, {
      color: '#ddd',
      speed: 2,
      gravity: 0.05,
      size: 2,
      life: 0.5,
      decay: 0.03
    });
  }

  /* ── Die ── */
  function die() {
    state = STATE_DYING;
    dyingTimer = 0;
    // Screen shake on death
    screenShake.trigger(6, 300);
    addHighScore(score);
  }

  /* ── Update ── */
  function update(dt) {
    if (state === STATE_READY) {
      readyBobT += dt * 3;
      bird.y = CANVAS_H * 0.4 + Math.sin(readyBobT) * 8;
      bird.angle = 0;
      return;
    }

    if (state === STATE_DYING) {
      dyingTimer += dt;
      screenShake.update(dt * 1000);
      const step = dt * 60;
      bird.vy += GRAVITY * step;
      bird.vy = Math.min(bird.vy, TERMINAL_VELOCITY);
      bird.y += bird.vy * step;
      bird.angle = Math.min(Math.PI / 2, bird.angle + 0.1 * step);
      particles.update();
      floatingText.update();
      if (dyingTimer > 0.5)
        state = STATE_DEAD;
      return;
    }

    if (state !== STATE_PLAYING)
      return;

    // dt * 60 normalizes all per-frame values to 60 fps behaviour
    const step = dt * 60;
    const speed = currentScrollSpeed();

    // Bird physics
    bird.vy += GRAVITY * step;
    bird.vy = Math.min(bird.vy, TERMINAL_VELOCITY);
    bird.y += bird.vy * step;

    // Ceiling clamp — bird does not die from ceiling
    bird.y = Math.max(BIRD_H / 2, bird.y);
    if (bird.y <= BIRD_H / 2)
      bird.vy = Math.max(0, bird.vy);

    // Bird rotation based on velocity
    const rotTarget = (bird.vy / TERMINAL_VELOCITY) * (Math.PI / 2);
    bird.angle += (rotTarget - bird.angle) * (1 - Math.pow(0.85, step));
    bird.angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 2, bird.angle));

    // Pipe movement
    for (let i = pipes.length - 1; i >= 0; --i) {
      pipes[i].x -= speed * step;

      // Score on pipe pass
      if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
        pipes[i].scored = true;
        ++score;
        scorePopTimer = 0.2;

        // Pipe-pass sparkle effect
        const gap = pipes[i];
        particles.sparkle(gap.x + PIPE_WIDTH, gap.gapY - gap.gapHeight / 2, 6, { color: '#ffd700' });
        particles.sparkle(gap.x + PIPE_WIDTH, gap.gapY + gap.gapHeight / 2, 6, { color: '#ffd700' });
        floatingText.add(bird.x, bird.y - 20, '+1', { color: '#fff', decay: 0.03 });
        updateStatus();
      }

      // Remove off-screen pipes
      if (pipes[i].x + PIPE_WIDTH < -10)
        pipes.splice(i, 1);
    }

    // Spawn new pipes
    pipeTimer += speed * step;
    if (pipeTimer >= currentPipeSpacing()) {
      pipeTimer = 0;
      spawnPipe();
    }

    // Parallax scrolling
    for (let i = 0; i < PARALLAX_LAYERS.length; ++i)
      layerOffsets[i] = (layerOffsets[i] + speed * PARALLAX_LAYERS[i].speed * step) % CANVAS_W;

    cloudOffset = (cloudOffset + speed * 0.15 * step) % (CANVAS_W + 200);
    hillsOffset = (hillsOffset + speed * 0.45 * step) % CANVAS_W;
    scrollOffset = (scrollOffset + speed * step) % 24;

    // Score pop timer
    if (scorePopTimer > 0)
      scorePopTimer -= dt;

    // Collision
    if (checkCollision())
      die();

    // Effects
    particles.update();
    floatingText.update();
    screenShake.update(dt * 1000);
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H - GROUND_HEIGHT);
    skyGrad.addColorStop(0, '#4ec0ca');
    skyGrad.addColorStop(1, '#71c5cf');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Sun glow (upper-right corner)
    ctx.save();
    const sunX = CANVAS_W - 60;
    const sunY = 50;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 80);
    sunGrad.addColorStop(0, 'rgba(255,255,200,0.8)');
    sunGrad.addColorStop(0.3, 'rgba(255,240,150,0.3)');
    sunGrad.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - 80, sunY - 80, 160, 160);
    ctx.restore();

    // Apply screen shake
    screenShake.apply(ctx);

    // Procedural clouds (slow parallax)
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#fff';
    for (const cloud of CLOUDS) {
      const cx = ((cloud.baseX - cloudOffset) % (CANVAS_W + 200) + CANVAS_W + 200) % (CANVAS_W + 200) - 100;
      ctx.beginPath();
      ctx.ellipse(cx, cloud.y, cloud.r1, cloud.r2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - cloud.r1 * 0.6, cloud.y + 4, cloud.r1 * 0.6, cloud.r2 * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cloud.r1 * 0.5, cloud.y + 3, cloud.r1 * 0.5, cloud.r2 * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Parallax background layers — first layer (distant mountains)
    {
      const layer = PARALLAX_LAYERS[0];
      const off = layerOffsets[0];
      ctx.fillStyle = layer.color;
      const baseY = CANVAS_H * layer.y;
      const h = CANVAS_H * layer.h;
      for (let x = -off; x < CANVAS_W + 60; x += 60) {
        ctx.beginPath();
        ctx.ellipse(x, baseY + h, 30, h, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // Distant hills parallax layer (between existing layers)
    ctx.save();
    ctx.fillStyle = 'rgba(40,80,50,0.3)';
    const hillBaseY = CANVAS_H * 0.42;
    const hillH = CANVAS_H * 0.1;
    for (let x = -hillsOffset; x < CANVAS_W + 80; x += 80) {
      ctx.beginPath();
      ctx.ellipse(x, hillBaseY + hillH, 40, hillH, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();

    // Parallax background layers — second layer (near hills)
    {
      const layer = PARALLAX_LAYERS[1];
      const off = layerOffsets[1];
      ctx.fillStyle = layer.color;
      const baseY = CANVAS_H * layer.y;
      const h = CANVAS_H * layer.h;
      for (let x = -off; x < CANVAS_W + 60; x += 60) {
        ctx.beginPath();
        ctx.ellipse(x, baseY + h, 30, h, 0, Math.PI, 0);
        ctx.fill();
      }
    }

    // Pipes
    for (const pipe of pipes) {
      const topBottom = pipe.gapY - pipe.gapHeight / 2;
      const botTop = pipe.gapY + pipe.gapHeight / 2;

      // Cylindrical gradient for pipe bodies
      const pipeGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      pipeGrad.addColorStop(0, '#5a9e1e');
      pipeGrad.addColorStop(0.4, '#8ed038');
      pipeGrad.addColorStop(1, '#5a9e1e');

      // Top pipe body
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topBottom - PIPE_CAP_H);

      // Top pipe cap with gradient
      const capGrad = ctx.createLinearGradient(pipe.x - 3, 0, pipe.x + PIPE_WIDTH + 3, 0);
      capGrad.addColorStop(0, '#4a8e0e');
      capGrad.addColorStop(0.4, '#7ec028');
      capGrad.addColorStop(1, '#4a8e0e');
      ctx.fillStyle = capGrad;
      ctx.fillRect(pipe.x - 3, topBottom - PIPE_CAP_H, PIPE_WIDTH + 6, PIPE_CAP_H);

      // Top pipe cap rim stroke
      ctx.strokeStyle = '#3a7e0e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pipe.x - 3, topBottom - PIPE_CAP_H, PIPE_WIDTH + 6, PIPE_CAP_H);

      // Inner shadow at top pipe opening
      ctx.save();
      const topShadow = ctx.createLinearGradient(0, topBottom - PIPE_CAP_H - 12, 0, topBottom - PIPE_CAP_H);
      topShadow.addColorStop(0, 'rgba(0,0,0,0)');
      topShadow.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = topShadow;
      ctx.fillRect(pipe.x, topBottom - PIPE_CAP_H - 12, PIPE_WIDTH, 12);
      ctx.restore();

      // Bottom pipe body
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(pipe.x, botTop + PIPE_CAP_H, PIPE_WIDTH, CANVAS_H - GROUND_HEIGHT - botTop - PIPE_CAP_H);

      // Bottom pipe cap with gradient
      ctx.fillStyle = capGrad;
      ctx.fillRect(pipe.x - 3, botTop, PIPE_WIDTH + 6, PIPE_CAP_H);

      // Bottom pipe cap rim stroke
      ctx.strokeStyle = '#3a7e0e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pipe.x - 3, botTop, PIPE_WIDTH + 6, PIPE_CAP_H);

      // Inner shadow at bottom pipe opening
      ctx.save();
      const botShadow = ctx.createLinearGradient(0, botTop + PIPE_CAP_H, 0, botTop + PIPE_CAP_H + 12);
      botShadow.addColorStop(0, 'rgba(0,0,0,0.35)');
      botShadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = botShadow;
      ctx.fillRect(pipe.x, botTop + PIPE_CAP_H, PIPE_WIDTH, 12);
      ctx.restore();

      // Pipe glow highlight (specular)
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#a0e050';
      ctx.fillRect(pipe.x + 4, 0, 5, topBottom - PIPE_CAP_H);
      ctx.fillRect(pipe.x + 4, botTop + PIPE_CAP_H, 5, CANVAS_H - GROUND_HEIGHT - botTop - PIPE_CAP_H);
      ctx.restore();

      // Vine/moss details on pipe cap edges (seeded by gapY)
      ctx.save();
      ctx.fillStyle = '#3d7a12';
      const seed = pipe.gapY;
      for (let v = 0; v < 3; ++v) {
        const vx = pipe.x + ((seed * (17 + v * 7)) % PIPE_WIDTH);
        // Top cap vines
        ctx.beginPath();
        ctx.arc(vx, topBottom, 4 + (v % 2) * 2, Math.PI * 0.8, Math.PI * 0.2, true);
        ctx.stroke();
        // Bottom cap vines
        ctx.beginPath();
        ctx.arc(vx, botTop + PIPE_CAP_H, 4 + (v % 2) * 2, Math.PI * 1.8, Math.PI * 1.2, true);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Ground base
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, CANVAS_H - GROUND_HEIGHT, CANVAS_W, GROUND_HEIGHT);

    // Stone/brick texture below grass line
    const stoneY = CANVAS_H - GROUND_HEIGHT + 8;
    const stoneH = GROUND_HEIGHT - 8;
    const brickW = 24;
    const brickH = 12;
    for (let row = 0; row < Math.ceil(stoneH / brickH); ++row) {
      const rowOffset = (row % 2) * (brickW / 2);
      for (let x = -scrollOffset - rowOffset; x < CANVAS_W + brickW; x += brickW) {
        const isLight = ((Math.floor(x / brickW) + row) % 2) === 0;
        ctx.fillStyle = isLight ? '#d4c880' : '#c4b870';
        ctx.fillRect(x, stoneY + row * brickH, brickW - 1, brickH - 1);
      }
    }

    // Grass strip
    ctx.fillStyle = '#54a030';
    ctx.fillRect(0, CANVAS_H - GROUND_HEIGHT, CANVAS_W, 6);

    // Grass blade details
    ctx.save();
    const grassTop = CANVAS_H - GROUND_HEIGHT;
    for (let x = -scrollOffset; x < CANVAS_W + 10; x += 6) {
      const bladeH = 4 + ((x * 7) & 3);
      ctx.fillStyle = ((x * 13) & 1) ? '#66b840' : '#48902a';
      ctx.beginPath();
      ctx.moveTo(x, grassTop);
      ctx.lineTo(x + 2, grassTop - bladeH);
      ctx.lineTo(x + 4, grassTop);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ground pattern (original diagonal lines)
    ctx.strokeStyle = '#c9bf78';
    ctx.lineWidth = 1;
    for (let x = -scrollOffset; x < CANVAS_W + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_H - GROUND_HEIGHT + 14);
      ctx.lineTo(x + 12, CANVAS_H - GROUND_HEIGHT + 24);
      ctx.stroke();
    }

    // Bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.angle);

    // Tail feathers (behind body, opposite beak direction)
    ctx.save();
    ctx.fillStyle = '#c8891a';
    ctx.beginPath();
    ctx.moveTo(-BIRD_W / 2 + 2, -3);
    ctx.lineTo(-BIRD_W / 2 - 8, -6);
    ctx.lineTo(-BIRD_W / 2 + 1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-BIRD_W / 2 + 2, 1);
    ctx.lineTo(-BIRD_W / 2 - 10, 2);
    ctx.lineTo(-BIRD_W / 2 + 1, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bird body with radial gradient
    ctx.save();
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 8;
    const bodyGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, BIRD_W / 2);
    bodyGrad.addColorStop(0, '#fce38a');
    bodyGrad.addColorStop(1, '#d4a017');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Belly highlight
    ctx.save();
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, BIRD_H * 0.15, BIRD_W / 2 - 4, BIRD_H / 2 - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bird wing with flap animation
    ctx.save();
    const wingFlap = state === STATE_PLAYING ? Math.sin(Date.now() / 100) * 2 : 0;
    ctx.fillStyle = '#e6a817';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 10, 6 + wingFlap, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bird eye (white)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Pupil (slightly thicker)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(10, -4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eyelid line (small arc above eye)
    ctx.save();
    ctx.strokeStyle = '#8b6508';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(8, -4, 5.5, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    ctx.restore();

    // Bird beak with two-tone fill
    ctx.save();
    // Upper beak
    const beakGrad = ctx.createLinearGradient(14, 0, 22, 2);
    beakGrad.addColorStop(0, '#e8882a');
    beakGrad.addColorStop(1, '#f0a030');
    ctx.fillStyle = beakGrad;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 2.5);
    ctx.closePath();
    ctx.fill();
    // Lower beak (darker)
    ctx.fillStyle = '#cc6a18';
    ctx.beginPath();
    ctx.moveTo(14, 2.5);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();
    // Lower beak line stroke
    ctx.strokeStyle = '#a05510';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(14, 2.5);
    ctx.lineTo(21, 2.2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Particles and floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    // Score display during play
    if (state === STATE_PLAYING || state === STATE_DYING || state === STATE_DEAD) {
      ctx.save();
      const popScale = scorePopTimer > 0 ? 1 + 0.2 * (scorePopTimer / 0.2) : 1;
      ctx.font = `bold ${Math.round(36 * popScale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(score, CANVAS_W / 2, 30);
      ctx.fillStyle = '#fff';
      ctx.fillText(score, CANVAS_W / 2, 30);
      ctx.restore();
    }

    // Ready screen overlay
    if (state === STATE_READY) {
      ctx.save();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('Tap to Start', CANVAS_W / 2, CANVAS_H * 0.25);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap to Start', CANVAS_W / 2, CANVAS_H * 0.25);
      ctx.restore();
    }

    // Paused overlay
    if (state === STATE_PAUSED) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    // Death screen
    if (state === STATE_DEAD) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Score card
      const cardW = 200;
      const cardH = 160;
      const cx = (CANVAS_W - cardW) / 2;
      const cy = (CANVAS_H - cardH) / 2 - 20;
      ctx.fillStyle = '#deb887';
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('Game Over', CANVAS_W / 2, cy - 10);
      ctx.fillText('Game Over', CANVAS_W / 2, cy - 10);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#333';
      ctx.fillText('Score: ' + score, CANVAS_W / 2, cy + 30);
      ctx.fillText('Best: ' + getBestScore(), CANVAS_W / 2, cy + 55);

      const medal = getMedal(score);
      if (medal) {
        ctx.save();
        ctx.shadowColor = medal.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, cy + 95, 20, 0, Math.PI * 2);
        ctx.fillStyle = medal.color;
        ctx.fill();
        ctx.restore();
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#333';
        ctx.fillText(medal.name, CANVAS_W / 2, cy + 125);
      }

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('Tap or Space to Restart', CANVAS_W / 2, cy + cardH + 20);
      ctx.fillText('Tap or Space to Restart', CANVAS_W / 2, cy + cardH + 20);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    update(dt);
    draw();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Status Bar ── */
  function updateStatus() {
    statusScore.textContent = 'Score: ' + score;
    statusBest.textContent = 'Best: ' + getBestScore();
    statusState.textContent = state === STATE_PAUSED ? 'Paused' :
      state === STATE_DEAD || state === STATE_DYING ? 'Game Over' :
      state === STATE_PLAYING ? 'Playing' : 'Ready';
  }

  /* ── Input Handling ── */
  function togglePause() {
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
    updateStatus();
  }

  function handleInput() {
    if (state === STATE_READY) {
      state = STATE_PLAYING;
      flap();
      updateStatus();
    } else if (state === STATE_PLAYING) {
      flap();
    } else if (state === STATE_DEAD) {
      resetGame();
    }
  }

  document.addEventListener('keydown', function(e) {
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

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      handleInput();
    }
  });

  canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    handleInput();
  });

  /* ── Resize Handling ── */
  window.addEventListener('resize', setupCanvas);

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => resetGame(),
      pause: togglePause,
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
          const s = highScores[i] || 0;
          const medal = getMedal(s);
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${s}</td><td>${medal ? medal.name : '-'}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          highScores = [];
          saveHighScores();
          updateStatus();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — nothing specific needed, CSS handles it
    }
  });

  SZ.Dlls.User32.SetWindowText('Flappy Bird');

  /* ── Init ── */
  loadHighScores();
  setupCanvas();
  updateStatus();
  resetGame();
  animFrameId = requestAnimationFrame(gameLoop);

})();
