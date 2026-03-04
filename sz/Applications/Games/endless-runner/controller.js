;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 400;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;

  /* Storage */
  const STORAGE_PREFIX = 'sz-endless-runner';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_COINS = STORAGE_PREFIX + '-coins';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* Lanes */
  const NUM_LANES = 3;
  const LANE_WIDTH = 80;
  const LANE_Y_BOTTOM = CANVAS_H - 80;
  const LANE_SWITCH_DURATION = 0.15;

  /* Player */
  const PLAYER_W = 30;
  const PLAYER_H = 50;
  const JUMP_DURATION = 0.6;
  const SLIDE_DURATION = 0.5;
  const JUMP_HEIGHT = 80;

  /* Speed */
  const BASE_SPEED = 8;
  const SPEED_ACCELERATION = 0.08;
  const MAX_SPEED = 24;

  /* Speed tiers — visual themes change at these thresholds */
  const SPEED_TIERS = [
    { name: 'day',    minSpeed: 0,  skyTop: '#87ceeb', skyBot: '#e0f0ff', ground: '#8fbc8f', road: '#666' },
    { name: 'sunset', minSpeed: 12, skyTop: '#ff6b35', skyBot: '#ffd700', ground: '#9b7653', road: '#555' },
    { name: 'night',  minSpeed: 16, skyTop: '#191970', skyBot: '#2f2f4f', ground: '#2d4a2d', road: '#333' },
    { name: 'neon',   minSpeed: 20, skyTop: '#0a0a2e', skyBot: '#1a0a3e', ground: '#0d1a0d', road: '#111' }
  ];

  /* Obstacles */
  const OBSTACLE_TYPES = ['barrier-low', 'barrier-high', 'full-block'];
  const OBSTACLE_MIN_GAP = 18;
  const OBSTACLE_SPAWN_RANGE = 12;

  /* Coins */
  const COIN_VALUE = 10;
  const COIN_RADIUS = 8;
  const COIN_SPAWN_CHANCE = 0.4;

  /* Power-ups */
  const POWERUP_TYPES = ['magnet', 'shield', 'multiplier'];
  const POWERUP_SPAWN_CHANCE = 0.08;
  const MAGNET_DURATION = 8;
  const SHIELD_DURATION = 15;
  const MULTIPLIER_DURATION = 10;
  const MAGNET_RANGE = 120;

  /* Scrolling */
  const SPAWN_Y = -60;
  const SCROLL_FACTOR = 10;

  /* States */
  const STATE_READY = 'READY';
  const STATE_RUNNING = 'RUNNING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusDistance = document.getElementById('statusDistance');
  const statusCoins = document.getElementById('statusCoins');
  const statusSpeed = document.getElementById('statusSpeed');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Run as far as you can!', 'Dodge obstacles by switching lanes,', 'jumping, and sliding.', '', 'Left/Right or A/D = Switch lanes', 'Up / W / Space = Jump  |  Down / S = Slide'] },
    { title: 'Tips', lines: ['Collect coins for your total score.', 'Grab power-ups: magnet, shield, multiplier.', 'Speed increases over time -- stay alert!', '', 'The visual theme shifts as you progress.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Game State ── */
  let state = STATE_READY;
  let distance = 0;
  let score = 0;
  let coinCount = 0;
  let totalCoins = 0;
  let currentSpeed = BASE_SPEED;
  let highScores = [];

  /* Player */
  let targetLane = 1;
  let currentLane = 1;
  let laneTransitionTimer = 0;
  let previousLane = 1;
  let transitionStartX = 200;
  let isJumping = false;
  let jumpTimer = 0;
  let isSliding = false;
  let slideTimer = 0;

  /* Entities */
  let obstacles = [];
  let coins = [];
  let powerUps = [];
  let speedLines = [];
  let lastSpawnZ = 0;

  /* Power-up timers */
  let magnetTimer = 0;
  let shieldTimer = 0;
  let multiplierTimer = 0;

  /* Rendering */
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;
  let roadOffset = 0;
  let skylineOffset = 0;

  /* Dust puffs for running effect */
  let dustPuffs = [];

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Lane Helpers ── */
  function laneX(lane) {
    const roadLeft = (CANVAS_W - NUM_LANES * LANE_WIDTH) / 2;
    return roadLeft + lane * LANE_WIDTH + LANE_WIDTH / 2;
  }

  function getPlayerX() {
    if (laneTransitionTimer > 0) {
      const t = 1 - laneTransitionTimer / LANE_SWITCH_DURATION;
      return transitionStartX + (laneX(targetLane) - transitionStartX) * t;
    }
    return laneX(targetLane);
  }

  function getPlayerY() {
    if (isJumping) {
      const halfDur = JUMP_DURATION / 2;
      const t = jumpTimer < halfDur ? jumpTimer / halfDur : 1 - (jumpTimer - halfDur) / halfDur;
      return LANE_Y_BOTTOM - JUMP_HEIGHT * Math.sin(t * Math.PI / 2);
    }
    return LANE_Y_BOTTOM;
  }

  function getPlayerHeight() {
    return isSliding ? PLAYER_H * 0.4 : PLAYER_H;
  }

  /* ── Speed Tier ── */
  function getCurrentTier() {
    let tier = SPEED_TIERS[0];
    for (const t of SPEED_TIERS)
      if (currentSpeed >= t.minSpeed)
        tier = t;
    return tier;
  }

  /* ── Persistence ── */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
      const c = localStorage.getItem(STORAGE_COINS);
      if (c)
        totalCoins = parseInt(c, 10) || 0;
    } catch (_) {
      highScores = [];
      totalCoins = 0;
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
      localStorage.setItem(STORAGE_COINS, String(totalCoins));
    } catch (_) {}
  }

  function addHighScore(dist, collected) {
    highScores.push({ distance: dist, coins: collected });
    highScores.sort((a, b) => b.distance - a.distance);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveData();
  }

  function getBestDistance() {
    return highScores.length > 0 ? highScores[0].distance : 0;
  }

  /* ── Obstacle Spawning ── */
  function spawnObstacle(y) {
    const occupiedLanes = [];
    const count = 1 + (currentSpeed > 14 ? 1 : 0);
    for (let i = 0; i < count; ++i) {
      let lane;
      do {
        lane = Math.floor(Math.random() * NUM_LANES);
      } while (occupiedLanes.includes(lane));
      occupiedLanes.push(lane);
    }
    // Guarantee at least one safeLane is free
    const safeLane = [];
    for (let i = 0; i < NUM_LANES; ++i)
      if (!occupiedLanes.includes(i))
        safeLane.push(i);
    if (safeLane.length === 0)
      occupiedLanes.pop();

    for (const lane of occupiedLanes) {
      const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      obstacles.push({ lane, y, type });
    }
  }

  function spawnCoin(y) {
    if (Math.random() > COIN_SPAWN_CHANCE)
      return;
    const lane = Math.floor(Math.random() * NUM_LANES);
    coins.push({ lane, y, collected: false });
  }

  function spawnPowerUp(y) {
    if (Math.random() > POWERUP_SPAWN_CHANCE)
      return;
    const lane = Math.floor(Math.random() * NUM_LANES);
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerUps.push({ lane, y, type, collected: false });
  }

  /* ── Collision Detection ── */
  function checkCollisions() {
    const px = getPlayerX();
    const py = getPlayerY();
    const ph = getPlayerHeight();

    for (const obs of obstacles) {
      const obsH = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;

      // Skip far obstacles
      if (obs.y + obsH < py - ph - 20 || obs.y > py + 20)
        continue;

      const ox = laneX(obs.lane);
      const laneOverlap = Math.abs(px - ox) < LANE_WIDTH * 0.4;
      if (!laneOverlap)
        continue;

      if (obs.type === 'barrier-low' && isJumping)
        continue;
      if (obs.type === 'barrier-high' && isSliding)
        continue;

      // Vertical overlap
      if (obs.y < py && obs.y + obsH > py - ph) {
        if (shieldTimer > 0) {
          shieldTimer = 0;
          particles.burst(px, py, 12, { color: '#00bfff', speed: 4, life: 0.6, size: 3, decay: 0.02 });
          screenShake.trigger(3, 150);
          obs.y = CANVAS_H + 200;
          continue;
        }
        return true;
      }
    }
    return false;
  }

  function checkCoinCollect() {
    const px = getPlayerX();
    const py = getPlayerY();

    for (const coin of coins) {
      if (coin.collected || coin.y < py - PLAYER_H - 30 || coin.y > py + 30)
        continue;

      const cx = laneX(coin.lane);
      let effectiveRange = LANE_WIDTH * 0.5;

      if (magnetTimer > 0)
        effectiveRange = MAGNET_RANGE;

      if (Math.abs(px - cx) < effectiveRange && coin.y > py - PLAYER_H - 10 && coin.y < py + 10) {
        coin.collected = true;
        ++coinCount;
        ++totalCoins;
        const mult = multiplierTimer > 0 ? 2 : 1;
        const points = COIN_VALUE * mult;
        score += points;
        particles.sparkle(cx, coin.y, 8, { color: '#ffd700' });
        floatingText.add(cx, coin.y - 10, '+' + points, { color: '#ffd700', decay: 0.03 });
      }
    }
  }

  function checkPowerUpCollect() {
    const px = getPlayerX();
    const py = getPlayerY();

    for (const pu of powerUps) {
      if (pu.collected || pu.y < py - PLAYER_H - 30 || pu.y > py + 30)
        continue;

      const pux = laneX(pu.lane);
      if (Math.abs(px - pux) < LANE_WIDTH * 0.5 && pu.y > py - PLAYER_H - 10 && pu.y < py + 10) {
        pu.collected = true;
        if (pu.type === 'magnet') {
          magnetTimer = MAGNET_DURATION;
          floatingText.add(pux, pu.y - 10, 'MAGNET', { color: '#ff00ff', decay: 0.02 });
        } else if (pu.type === 'shield') {
          shieldTimer = SHIELD_DURATION;
          floatingText.add(pux, pu.y - 10, 'SHIELD', { color: '#00bfff', decay: 0.02 });
        } else if (pu.type === 'multiplier') {
          multiplierTimer = MULTIPLIER_DURATION;
          floatingText.add(pux, pu.y - 10, '2x SCORE', { color: '#ff4500', decay: 0.02 });
        }
        particles.burst(pux, pu.y, 10, { color: '#fff', speed: 3, life: 0.5, size: 3, decay: 0.02 });
      }
    }
  }

  /* ── Reset ── */
  function resetGame() {
    state = STATE_READY;
    distance = 0;
    score = 0;
    coinCount = 0;
    currentSpeed = BASE_SPEED;
    targetLane = 1;
    currentLane = 1;
    laneTransitionTimer = 0;
    previousLane = 1;
    transitionStartX = laneX(1);
    isJumping = false;
    jumpTimer = 0;
    isSliding = false;
    slideTimer = 0;
    obstacles = [];
    coins = [];
    powerUps = [];
    speedLines = [];
    lastSpawnZ = 0;
    magnetTimer = 0;
    shieldTimer = 0;
    multiplierTimer = 0;
    roadOffset = 0;
    skylineOffset = 0;
    dustPuffs = [];
    particles.clear();
    floatingText.clear();
    updateStatus();
    SZ.Dlls.User32.SetWindowText('Endless Runner');
  }

  /* ── Die ── */
  function die() {
    state = STATE_DEAD;
    // death shake
    screenShake.trigger(8, 400);
    particles.burst(getPlayerX(), getPlayerY(), 20, { color: '#f44', speed: 5, life: 0.8, size: 3, decay: 0.02 });
    addHighScore(Math.floor(distance), coinCount);
    updateStatus();
  }

  /* ── Speed Lines ── */
  function spawnSpeedLine() {
    if (currentSpeed < 12)
      return;
    const intensity = Math.min(1, (currentSpeed - 12) / 8);
    if (Math.random() > intensity * 0.5)
      return;
    speedLines.push({
      x: Math.random() * CANVAS_W,
      y: -10,
      length: 20 + Math.random() * 40,
      speed: currentSpeed * 8 + Math.random() * 100,
      alpha: 0.3 + Math.random() * 0.4
    });
  }

  /* ── Update ── */
  function update(dt) {
    if (state === STATE_READY || state === STATE_PAUSED || state === STATE_DEAD) {
      screenShake.update(dt * 1000);
      particles.update();
      floatingText.update();
      return;
    }

    if (state !== STATE_RUNNING)
      return;

    // Speed ramp
    currentSpeed = Math.min(MAX_SPEED, currentSpeed + SPEED_ACCELERATION * dt);

    // Distance
    const mult = multiplierTimer > 0 ? 2 : 1;
    distance += currentSpeed * dt;
    score += currentSpeed * dt * mult;

    // Lane transition
    if (laneTransitionTimer > 0) {
      laneTransitionTimer -= dt;
      if (laneTransitionTimer <= 0) {
        laneTransitionTimer = 0;
        currentLane = targetLane;
      }
    }

    // Jump
    if (isJumping) {
      jumpTimer += dt;
      if (jumpTimer >= JUMP_DURATION) {
        isJumping = false;
        jumpTimer = 0;
      }
    }

    // Slide
    if (isSliding) {
      slideTimer += dt;
      if (slideTimer >= SLIDE_DURATION) {
        isSliding = false;
        slideTimer = 0;
      }
    }

    // Power-up timers
    if (magnetTimer > 0)
      magnetTimer = Math.max(0, magnetTimer - dt);
    if (shieldTimer > 0)
      shieldTimer = Math.max(0, shieldTimer - dt);
    if (multiplierTimer > 0)
      multiplierTimer = Math.max(0, multiplierTimer - dt);

    // Spawn obstacles/coins/power-ups
    const spawnDist = distance;
    while (lastSpawnZ < spawnDist) {
      lastSpawnZ += OBSTACLE_MIN_GAP + Math.random() * OBSTACLE_SPAWN_RANGE;
      spawnObstacle(SPAWN_Y);
      spawnCoin(SPAWN_Y + Math.random() * 80 - 40);
      spawnPowerUp(SPAWN_Y + Math.random() * 40 - 20);
    }

    // Move entities downward
    const dy = currentSpeed * SCROLL_FACTOR * dt;
    for (const obs of obstacles)
      obs.y += dy;
    for (const coin of coins)
      coin.y += dy;
    for (const pu of powerUps)
      pu.y += dy;

    // Remove off-screen entities
    obstacles = obstacles.filter(o => o.y < CANVAS_H + 60);
    coins = coins.filter(c => c.y < CANVAS_H + 60 && !c.collected);
    powerUps = powerUps.filter(p => p.y < CANVAS_H + 60 && !p.collected);

    // Collision
    checkCoinCollect();
    checkPowerUpCollect();
    if (checkCollisions())
      die();

    // Speed lines
    spawnSpeedLine();
    for (const sl of speedLines)
      sl.y += sl.speed * dt;
    speedLines = speedLines.filter(sl => sl.y < CANVAS_H + 50);

    // Road scroll
    roadOffset = (roadOffset + currentSpeed * dt * 20) % 40;

    // Skyline parallax scroll (much slower than road)
    skylineOffset += currentSpeed * dt * 2;

    // Dust puffs
    if (!isJumping && !isSliding && state === STATE_RUNNING) {
      const legAngle = Math.sin(Date.now() / 80) * 0.4;
      if (Math.abs(legAngle) > 0.2 && Math.random() > 0.5) {
        const dpx = getPlayerX();
        dustPuffs.push({ x: dpx + (Math.random() - 0.5) * 10, y: LANE_Y_BOTTOM + 2, alpha: 0.6, radius: 2 + Math.random() * 3 });
      }
    }
    for (let i = dustPuffs.length - 1; i >= 0; --i) {
      dustPuffs[i].alpha -= 0.03;
      dustPuffs[i].radius += 0.3;
      dustPuffs[i].y += 0.2;
      if (dustPuffs[i].alpha <= 0)
        dustPuffs.splice(i, 1);
    }

    // Effects
    particles.update();
    floatingText.update();
    screenShake.update(dt * 1000);
    updateStatus();
  }

  /* ── Draw ── */
  function draw() {
    const tier = getCurrentTier();
    ctx.save();

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, tier.skyTop);
    skyGrad.addColorStop(1, tier.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Apply screen shake
    screenShake.apply(ctx);

    // City skyline silhouette (parallax layer behind everything)
    {
      ctx.save();
      const skylineY = CANVAS_H - 100;
      const buildings = [
        { w: 30, h: 60 }, { w: 20, h: 90 }, { w: 40, h: 50 }, { w: 25, h: 75 },
        { w: 35, h: 110 }, { w: 18, h: 45 }, { w: 28, h: 80 }, { w: 22, h: 55 },
        { w: 38, h: 95 }, { w: 15, h: 40 }, { w: 32, h: 70 }, { w: 26, h: 85 },
        { w: 20, h: 60 }, { w: 34, h: 100 }, { w: 24, h: 65 }
      ];
      // Compute total tile width for seamless wrapping
      const GAP = 6;
      let tileWidth = 0;
      for (const b of buildings)
        tileWidth += b.w + GAP;

      const buildingColor = tier.name === 'neon' ? 'rgba(30,10,60,0.7)' :
                       tier.name === 'night' ? 'rgba(10,10,30,0.6)' :
                       tier.name === 'sunset' ? 'rgba(60,20,10,0.4)' : 'rgba(80,80,120,0.25)';
      ctx.fillStyle = buildingColor;
      const wrappedOffset = skylineOffset % tileWidth;
      let bx = -wrappedOffset;
      for (let i = 0; bx < CANVAS_W + 50; ++i) {
        const b = buildings[i % buildings.length];
        ctx.fillRect(bx, skylineY - b.h, b.w, b.h);
        // Window dots on taller buildings
        if (b.h > 50 && (tier.name === 'night' || tier.name === 'neon')) {
          ctx.fillStyle = 'rgba(255,255,150,0.4)';
          for (let wy = skylineY - b.h + 8; wy < skylineY - 5; wy += 12)
            for (let wx = bx + 4; wx < bx + b.w - 4; wx += 8)
              ctx.fillRect(wx, wy, 3, 4);
          ctx.fillStyle = buildingColor;
        }
        bx += b.w + GAP;
      }
      ctx.restore();
    }

    // Ground
    ctx.fillStyle = tier.ground;
    ctx.fillRect(0, CANVAS_H - 100, CANVAS_W, 100);

    // Grass blades along road edges
    {
      const roadLeft = (CANVAS_W - NUM_LANES * LANE_WIDTH) / 2;
      const roadW = NUM_LANES * LANE_WIDTH;
      const grassY = CANVAS_H - 100;
      ctx.save();
      ctx.fillStyle = tier.name === 'neon' ? '#0f3f0f' :
                       tier.name === 'night' ? '#1a4a1a' :
                       tier.name === 'sunset' ? '#6a8a3a' : '#3a7a3a';
      // Left side grass
      for (let gx = roadLeft - 30; gx < roadLeft + 4; gx += 5) {
        const gh = 6 + Math.sin(gx * 0.7 + roadOffset * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(gx - 2, grassY);
        ctx.lineTo(gx, grassY - gh);
        ctx.lineTo(gx + 2, grassY);
        ctx.fill();
      }
      // Right side grass
      for (let gx = roadLeft + roadW - 4; gx < roadLeft + roadW + 30; gx += 5) {
        const gh = 6 + Math.sin(gx * 0.7 + roadOffset * 0.1) * 3;
        ctx.beginPath();
        ctx.moveTo(gx - 2, grassY);
        ctx.lineTo(gx, grassY - gh);
        ctx.lineTo(gx + 2, grassY);
        ctx.fill();
      }
      ctx.restore();
    }

    // Road
    const roadLeft = (CANVAS_W - NUM_LANES * LANE_WIDTH) / 2;
    const roadW = NUM_LANES * LANE_WIDTH;
    ctx.fillStyle = tier.road;
    ctx.fillRect(roadLeft, 0, roadW, CANVAS_H);

    // Road noise texture — subtle speckle dots
    {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      // Use a seeded-ish pattern based on position so it doesn't flicker
      for (let ny = 0; ny < CANVAS_H; ny += 6)
        for (let nx = roadLeft + 3; nx < roadLeft + roadW - 3; nx += 7) {
          const hash = (nx * 31 + ny * 17 + Math.floor(roadOffset) * 3) & 0xff;
          if (hash < 40)
            ctx.fillRect(nx + (hash % 5), ny + (hash % 4), 1, 1);
        }
      ctx.restore();
    }

    // Lane dividers
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.lineDashOffset = -roadOffset;
    for (let i = 1; i < NUM_LANES; ++i) {
      const x = roadLeft + i * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Road edges
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0);
    ctx.lineTo(roadLeft, CANVAS_H);
    ctx.moveTo(roadLeft + roadW, 0);
    ctx.lineTo(roadLeft + roadW, CANVAS_H);
    ctx.stroke();

    // Guardrail posts along road edges
    {
      ctx.save();
      ctx.fillStyle = '#888';
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      const postSpacing = 80;
      const postOffset = roadOffset % postSpacing;
      for (let py = postOffset - postSpacing; py < CANVAS_H; py += postSpacing) {
        // Left guardrail post
        ctx.fillRect(roadLeft - 6, py, 4, 12);
        ctx.strokeRect(roadLeft - 6, py, 4, 12);
        // Right guardrail post
        ctx.fillRect(roadLeft + roadW + 2, py, 4, 12);
        ctx.strokeRect(roadLeft + roadW + 2, py, 4, 12);
      }
      // Guardrail rails (horizontal bars between posts)
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(roadLeft - 5, 0);
      ctx.lineTo(roadLeft - 5, CANVAS_H);
      ctx.moveTo(roadLeft + roadW + 3, 0);
      ctx.lineTo(roadLeft + roadW + 3, CANVAS_H);
      ctx.stroke();
      ctx.restore();
    }

    // Road edge reflections — faint mirrored obstacle silhouettes
    for (const obs of obstacles) {
      if (obs.y > CANVAS_H + 30 || obs.y < -80)
        continue;
      const ox = laneX(obs.lane);
      const ow = LANE_WIDTH * 0.7;
      const oh = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#000';
      ctx.translate(ox, obs.y + oh);
      ctx.scale(1, -0.4);
      ctx.fillRect(-ow / 2, 0, ow, oh);
      ctx.restore();
    }

    // Obstacles with beveled 3D look
    for (const obs of obstacles) {
      if (obs.y > CANVAS_H + 30 || obs.y < -80)
        continue;

      const ox = laneX(obs.lane);
      const ow = LANE_WIDTH * 0.7;
      const oh = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;
      const bevel = 4;

      const baseColor = obs.type === 'barrier-low' ? '#e74c3c' :
                         obs.type === 'barrier-high' ? '#e67e22' : '#c0392b';
      const lightColor = obs.type === 'barrier-low' ? '#f08070' :
                          obs.type === 'barrier-high' ? '#f0a050' : '#e05040';
      const darkColor = obs.type === 'barrier-low' ? '#b03028' :
                         obs.type === 'barrier-high' ? '#b05a10' : '#8a1a10';

      // Warning glow for nearby obstacles
      const distToPlayer = LANE_Y_BOTTOM - obs.y;
      if (distToPlayer > 0 && distToPlayer < 150) {
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15 * (1 - distToPlayer / 150);
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.fillRect(ox - ow / 2 - 5, obs.y - 5, ow + 10, oh + 10);
        ctx.restore();
      }

      // Pulsing warning glow for full-block
      if (obs.type === 'full-block') {
        ctx.save();
        const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 * pulse;
        ctx.strokeStyle = `rgba(255,50,50,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox - ow / 2 - 3, obs.y - 3, ow + 6, oh + 6);
        ctx.restore();
      }

      // Main body
      ctx.fillStyle = baseColor;
      ctx.fillRect(ox - ow / 2, obs.y, ow, oh);

      // Lighter top face (bevel)
      ctx.fillStyle = lightColor;
      ctx.fillRect(ox - ow / 2, obs.y, ow, bevel);

      // Darker right side face (bevel)
      ctx.fillStyle = darkColor;
      ctx.fillRect(ox + ow / 2 - bevel, obs.y + bevel, bevel, oh - bevel);

      // Darker bottom edge
      ctx.fillStyle = darkColor;
      ctx.fillRect(ox - ow / 2, obs.y + oh - bevel, ow, bevel);

      // Lighter left edge
      ctx.fillStyle = lightColor;
      ctx.fillRect(ox - ow / 2, obs.y, bevel, oh - bevel);

      // Type-specific patterns
      if (obs.type === 'barrier-low') {
        // Yellow/black chevron stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox - ow / 2, obs.y, ow, oh);
        ctx.clip();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        for (let s = -ow; s < ow * 2; s += 12) {
          ctx.beginPath();
          ctx.moveTo(ox - ow / 2 + s, obs.y + oh);
          ctx.lineTo(ox - ow / 2 + s + oh, obs.y);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        for (let s = -ow + 6; s < ow * 2; s += 12) {
          ctx.beginPath();
          ctx.moveTo(ox - ow / 2 + s, obs.y + oh);
          ctx.lineTo(ox - ow / 2 + s + oh, obs.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (obs.type === 'barrier-high') {
        // Red/white horizontal stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox - ow / 2, obs.y, ow, oh);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let sy = 0; sy < oh; sy += 10)
          ctx.fillRect(ox - ow / 2, obs.y + sy, ow, 5);
        ctx.restore();
      }

      // Bolt/rivet details at corners
      ctx.fillStyle = '#333';
      const rivetR = 2.5;
      const rivetInset = 5;
      const corners = [
        [ox - ow / 2 + rivetInset, obs.y + rivetInset],
        [ox + ow / 2 - rivetInset, obs.y + rivetInset],
        [ox - ow / 2 + rivetInset, obs.y + oh - rivetInset],
        [ox + ow / 2 - rivetInset, obs.y + oh - rivetInset]
      ];
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, rivetR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Rivet highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx - 0.5, cy - 0.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Coins
    for (const coin of coins) {
      if (coin.collected || coin.y > CANVAS_H + 20 || coin.y < -30)
        continue;

      const cx = laneX(coin.lane);

      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(cx, coin.y, COIN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Coin sparkle shimmer
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 150 + coin.y);
      ctx.beginPath();
      ctx.arc(cx - COIN_RADIUS * 0.3, coin.y - COIN_RADIUS * 0.3, COIN_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Power-ups
    for (const pu of powerUps) {
      if (pu.collected || pu.y > CANVAS_H + 20 || pu.y < -30)
        continue;

      const pux = laneX(pu.lane);
      const color = pu.type === 'magnet' ? '#ff00ff' :
                    pu.type === 'shield' ? '#00bfff' : '#ff4500';

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pux, pu.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Icon letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = pu.type === 'magnet' ? 'M' : pu.type === 'shield' ? 'S' : '2x';
      ctx.fillText(label, pux, pu.y);
    }

    // Player
    const px = getPlayerX();
    const py = getPlayerY();
    const ph = getPlayerHeight();

    // Power-up aura / shimmer / bubble
    if (shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#00bfff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, PLAYER_W * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 200);
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, MAGNET_RANGE * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (multiplierTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,69,0,0.15)';
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, PLAYER_W * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Running afterimage trail (2-3 semi-transparent copies behind player)
    if (state === STATE_RUNNING && !isSliding) {
      const trailCount = 3;
      for (let ti = trailCount; ti >= 1; --ti) {
        ctx.save();
        ctx.globalAlpha = 0.08 * (trailCount - ti + 1);
        ctx.fillStyle = '#4ec0ca';
        const trailOff = ti * 6;
        // Simplified trail silhouette
        ctx.beginPath();
        ctx.arc(px, py - ph + 8 + trailOff, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 8, py - ph + 16 + trailOff, 16, ph - 24);
        ctx.restore();
      }
    }

    // Dust puffs when grounded and running
    if (dustPuffs.length > 0) {
      ctx.save();
      for (const dp of dustPuffs) {
        ctx.globalAlpha = dp.alpha;
        ctx.fillStyle = '#c8b88a';
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player body
    ctx.save();
    ctx.fillStyle = '#4ec0ca';
    ctx.shadowColor = '#4ec0ca';
    ctx.shadowBlur = 6;

    if (isSliding) {
      // Sliding — low rounded rectangle
      const slideW = PLAYER_W + 4;
      const slideH = ph;
      const slideX = px - slideW / 2;
      const slideY = py - ph;
      const sr = 4;
      ctx.beginPath();
      ctx.moveTo(slideX + sr, slideY);
      ctx.lineTo(slideX + slideW - sr, slideY);
      ctx.arcTo(slideX + slideW, slideY, slideX + slideW, slideY + sr, sr);
      ctx.lineTo(slideX + slideW, slideY + slideH - sr);
      ctx.arcTo(slideX + slideW, slideY + slideH, slideX + slideW - sr, slideY + slideH, sr);
      ctx.lineTo(slideX + sr, slideY + slideH);
      ctx.arcTo(slideX, slideY + slideH, slideX, slideY + slideH - sr, sr);
      ctx.lineTo(slideX, slideY + sr);
      ctx.arcTo(slideX, slideY, slideX + sr, slideY, sr);
      ctx.fill();
      // Headband on sliding form
      ctx.fillStyle = '#e63946';
      ctx.fillRect(slideX + 2, slideY + 1, slideW - 4, 3);
    } else {
      // Head
      ctx.beginPath();
      ctx.arc(px, py - ph + 8, 8, 0, Math.PI * 2);
      ctx.fill();

      // Headband — red arc across head
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(px, py - ph + 8, 8, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineTo(px + 8 * Math.cos(-Math.PI * 0.15), py - ph + 8 + 8 * Math.sin(-Math.PI * 0.15) - 2);
      ctx.arc(px, py - ph + 6, 8, -Math.PI * 0.15, -Math.PI * 0.85, true);
      ctx.fill();
      // Headband tail
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 7, py - ph + 5);
      ctx.lineTo(px + 13, py - ph + 3);
      ctx.lineTo(px + 11, py - ph + 7);
      ctx.stroke();

      // Body — wider rounded torso
      ctx.fillStyle = '#4ec0ca';
      const torsoX = px - 8;
      const torsoY = py - ph + 16;
      const torsoW = 16;
      const torsoH = ph - 28;
      const tr = 3;
      ctx.beginPath();
      ctx.moveTo(torsoX + tr, torsoY);
      ctx.lineTo(torsoX + torsoW - tr, torsoY);
      ctx.arcTo(torsoX + torsoW, torsoY, torsoX + torsoW, torsoY + tr, tr);
      ctx.lineTo(torsoX + torsoW, torsoY + torsoH - tr);
      ctx.arcTo(torsoX + torsoW, torsoY + torsoH, torsoX + torsoW - tr, torsoY + torsoH, tr);
      ctx.lineTo(torsoX + tr, torsoY + torsoH);
      ctx.arcTo(torsoX, torsoY + torsoH, torsoX, torsoY + torsoH - tr, tr);
      ctx.lineTo(torsoX, torsoY + tr);
      ctx.arcTo(torsoX, torsoY, torsoX + tr, torsoY, tr);
      ctx.fill();

      // Legs — running animation
      const legAngle = Math.sin(Date.now() / 80) * 0.4;
      ctx.strokeStyle = '#4ec0ca';
      ctx.lineWidth = 3;
      const legStartY = py - 8;
      const leftFootX = px - 8 * Math.sin(legAngle);
      const rightFootX = px + 8 * Math.sin(legAngle);
      ctx.beginPath();
      ctx.moveTo(px, legStartY);
      ctx.lineTo(leftFootX, py);
      ctx.moveTo(px, legStartY);
      ctx.lineTo(rightFootX, py);
      ctx.stroke();

      // Shoes — small darker rectangles at leg endpoints
      ctx.fillStyle = '#2a6a6e';
      ctx.fillRect(leftFootX - 4, py - 3, 8, 4);
      ctx.fillRect(rightFootX - 4, py - 3, 8, 4);
      // Shoe sole highlight
      ctx.fillStyle = '#1a4a4e';
      ctx.fillRect(leftFootX - 4, py, 8, 1);
      ctx.fillRect(rightFootX - 4, py, 8, 1);

      // Arms
      ctx.strokeStyle = '#4ec0ca';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py - ph + 22);
      ctx.lineTo(px - 10 * Math.sin(-legAngle), py - ph + 32);
      ctx.moveTo(px, py - ph + 22);
      ctx.lineTo(px + 10 * Math.sin(-legAngle), py - ph + 32);
      ctx.stroke();

      // Hands — small circles at arm endpoints
      ctx.fillStyle = '#4ec0ca';
      ctx.beginPath();
      ctx.arc(px - 10 * Math.sin(-legAngle), py - ph + 32, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 10 * Math.sin(-legAngle), py - ph + 32, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Speed lines
    if (speedLines.length > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (const sl of speedLines) {
        ctx.globalAlpha = sl.alpha;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x, sl.y + sl.length);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    // HUD — distance
    ctx.save();
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(Math.floor(distance) + ' m', CANVAS_W / 2, 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.floor(distance) + ' m', CANVAS_W / 2, 10);
    ctx.restore();

    // HUD — coins
    ctx.save();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Coins: ' + coinCount, CANVAS_W - 10, 20);
    ctx.restore();

    // Active power-up indicators
    const indicators = [];
    if (magnetTimer > 0)
      indicators.push({ label: 'MAGNET ' + Math.ceil(magnetTimer) + 's', color: '#ff00ff' });
    if (shieldTimer > 0)
      indicators.push({ label: 'SHIELD ' + Math.ceil(shieldTimer) + 's', color: '#00bfff' });
    if (multiplierTimer > 0)
      indicators.push({ label: '2x ' + Math.ceil(multiplierTimer) + 's', color: '#ff4500' });

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < indicators.length; ++i) {
      ctx.fillStyle = indicators[i].color;
      ctx.fillText(indicators[i].label, 10, 20 + i * 16);
    }

    // Ready overlay
    if (state === STATE_READY) {
      ctx.save();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('Tap or Space to Start', CANVAS_W / 2, CANVAS_H * 0.35);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap or Space to Start', CANVAS_W / 2, CANVAS_H * 0.35);

      ctx.font = '16px sans-serif';
      ctx.strokeText('Arrow Keys to move, Up=Jump, Down=Slide', CANVAS_W / 2, CANVAS_H * 0.45);
      ctx.fillText('Arrow Keys to move, Up=Jump, Down=Slide', CANVAS_W / 2, CANVAS_H * 0.45);
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

    // Dead overlay
    if (state === STATE_DEAD) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const cardW = 220;
      const cardH = 140;
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
      ctx.fillText('Distance: ' + Math.floor(distance) + ' m', CANVAS_W / 2, cy + 30);
      ctx.fillText('Score: ' + Math.floor(score), CANVAS_W / 2, cy + 50);
      ctx.fillText('Coins: ' + coinCount, CANVAS_W / 2, cy + 70);
      ctx.fillText('Best: ' + Math.floor(getBestDistance()) + ' m', CANVAS_W / 2, cy + 90);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('Tap or Space to Restart', CANVAS_W / 2, cy + cardH + 20);
      ctx.fillText('Tap or Space to Restart', CANVAS_W / 2, cy + cardH + 20);
      ctx.restore();
    }

    ctx.restore();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 360, ph = 210, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#4ec0ca';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#4ec0ca';
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
    statusDistance.textContent = 'Distance: ' + Math.floor(distance) + ' m';
    statusCoins.textContent = 'Coins: ' + coinCount;
    statusSpeed.textContent = 'Speed: ' + currentSpeed.toFixed(1) + ' m/s';
    statusState.textContent = state === STATE_PAUSED ? 'Paused' :
      state === STATE_DEAD ? 'Game Over' :
      state === STATE_RUNNING ? 'Running' : 'Ready';
  }

  /* ── Input ── */
  function switchLane(dir) {
    if (state !== STATE_RUNNING)
      return;
    const next = Math.max(0, Math.min(2, targetLane + dir));
    if (next === targetLane)
      return;
    transitionStartX = getPlayerX();
    previousLane = targetLane;
    targetLane = next;
    laneTransitionTimer = LANE_SWITCH_DURATION;
  }

  function startJump() {
    if (state !== STATE_RUNNING || isJumping || isSliding)
      return;
    isJumping = true;
    jumpTimer = 0;
    particles.burst(getPlayerX(), LANE_Y_BOTTOM, 6, { color: '#ddd', speed: 2, life: 0.3, size: 2, decay: 0.03 });
  }

  function startSlide() {
    if (state !== STATE_RUNNING || isJumping || isSliding)
      return;
    isSliding = true;
    slideTimer = 0;
  }

  function handleAction() {
    if (state === STATE_READY) {
      state = STATE_RUNNING;
      updateStatus();
    } else if (state === STATE_DEAD) {
      resetGame();
    } else if (state === STATE_RUNNING) {
      startJump();
    }
  }

  function togglePause() {
    if (state === STATE_RUNNING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_RUNNING;
    updateStatus();
  }

  document.addEventListener('keydown', function(e) {
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
      if (state === STATE_RUNNING || state === STATE_PAUSED || state === STATE_READY) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

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
      handleAction();
      return;
    }

    if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      switchLane(-1);
      return;
    }

    if (e.key === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      switchLane(1);
      return;
    }

    if (e.key === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      startJump();
      return;
    }

    if (e.key === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      startSlide();
      return;
    }
  });

  canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_DEAD) {
      handleAction();
      return;
    }

    if (state !== STATE_RUNNING)
      return;

    // Touch controls: click target lane directly, or jump if same lane
    const rect = canvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clickedLane = Math.min(2, Math.floor(relX * NUM_LANES));
    if (clickedLane !== targetLane) {
      const dir = clickedLane - targetLane;
      switchLane(dir);
    } else
      startJump();
  });

  /* ── Resize ── */
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
          const entry = highScores[i] || { distance: 0, coins: 0 };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${Math.floor(entry.distance)} m</td><td>${entry.coins}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          highScores = [];
          totalCoins = 0;
          saveData();
          updateStatus();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      tutorial: () => { showTutorial = true; tutorialPage = 0; },
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
      // Theme changed — CSS handles it
    }
    if (msg === 'WM_SIZE') {
      setupCanvas();
    }
  });

  SZ.Dlls.User32.SetWindowText('Endless Runner');

  /* ── Init ── */
  loadData();
  setupCanvas();
  updateStatus();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  animFrameId = requestAnimationFrame(gameLoop);

})();
