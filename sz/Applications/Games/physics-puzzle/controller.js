;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  let canvasW = 700;
  let canvasH = 500;
  const MAX_DT = 0.05;
  const GRAVITY = 400;
  const RESTITUTION = 0.5;
  const FRICTION = 0.98;
  const MIN_POWER = 50;
  const MAX_POWER = 600;
  const PROJECTILE_RADIUS = 8;
  const TRAIL_INTERVAL = 0.02;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_BUILDING = 'BUILDING';
  const STATE_AIMING = 'AIMING';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Placeable object types ── */
  const OBJ_RAMP = 'ramp';
  const OBJ_BLOCK = 'block';
  const OBJ_SPRING = 'spring';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-physics-puzzle';
  const STORAGE_PROGRESS = STORAGE_PREFIX + '-progress';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 10;

  /* ══════════════════════════════════════════════════════════════════
     LEVEL DATA — 15+ puzzles
     ══════════════════════════════════════════════════════════════════ */

  const LEVELS = [
    { name: 'First Launch', target: { x: 550, y: 400, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 400, y: 380, w: 20, h: 60, hp: 1 }
    ], placeable: [], optimal: 1 },
    { name: 'Over the Wall', target: { x: 600, y: 420, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 300, y: 320, w: 20, h: 140, hp: 2 }
    ], placeable: [], optimal: 1 },
    { name: 'Ramp Assist', target: { x: 600, y: 300, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [], placeable: [OBJ_RAMP], optimal: 1 },
    { name: 'Block Builder', target: { x: 550, y: 200, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 400, y: 300, w: 80, h: 20, hp: 1 }
    ], placeable: [OBJ_BLOCK], optimal: 2 },
    { name: 'Spring Bounce', target: { x: 600, y: 100, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [], placeable: [OBJ_SPRING], optimal: 1 },
    { name: 'Double Barrier', target: { x: 620, y: 420, w: 30, h: 30 }, launcher: { x: 60, y: 420 }, structures: [
      { x: 250, y: 300, w: 20, h: 160, hp: 2 },
      { x: 450, y: 340, w: 20, h: 120, hp: 2 }
    ], placeable: [OBJ_RAMP], optimal: 2 },
    { name: 'Tower Topple', target: { x: 500, y: 420, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 490, y: 340, w: 60, h: 20, hp: 1 },
      { x: 490, y: 300, w: 60, h: 20, hp: 1 },
      { x: 490, y: 260, w: 60, h: 20, hp: 1 },
      { x: 490, y: 220, w: 60, h: 20, hp: 1 }
    ], placeable: [], optimal: 2 },
    { name: 'Precision Shot', target: { x: 350, y: 100, w: 30, h: 30 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 200, y: 150, w: 120, h: 20, hp: 3 }
    ], placeable: [], optimal: 1 },
    { name: 'Canyon Gap', target: { x: 600, y: 400, w: 40, h: 40 }, launcher: { x: 60, y: 200 }, structures: [
      { x: 280, y: 100, w: 20, h: 360, hp: 3 },
      { x: 420, y: 100, w: 20, h: 360, hp: 3 }
    ], placeable: [OBJ_SPRING], optimal: 2 },
    { name: 'Ricochet Room', target: { x: 600, y: 420, w: 30, h: 30 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 300, y: 200, w: 200, h: 20, hp: 3 },
      { x: 500, y: 200, w: 20, h: 260, hp: 3 }
    ], placeable: [], optimal: 1 },
    { name: 'Springboard', target: { x: 350, y: 60, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 250, y: 350, w: 80, h: 20, hp: 2 }
    ], placeable: [OBJ_SPRING, OBJ_RAMP], optimal: 2 },
    { name: 'Fortress', target: { x: 550, y: 360, w: 30, h: 30 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 480, y: 300, w: 20, h: 160, hp: 2 },
      { x: 620, y: 300, w: 20, h: 160, hp: 2 },
      { x: 480, y: 280, w: 160, h: 20, hp: 2 }
    ], placeable: [OBJ_BLOCK], optimal: 3 },
    { name: 'Sky Target', target: { x: 400, y: 50, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 250, y: 150, w: 20, h: 310, hp: 3 }
    ], placeable: [OBJ_SPRING], optimal: 2 },
    { name: 'Maze Runner', target: { x: 620, y: 420, w: 30, h: 30 }, launcher: { x: 60, y: 100 }, structures: [
      { x: 200, y: 0, w: 20, h: 350, hp: 3 },
      { x: 400, y: 110, w: 20, h: 350, hp: 3 }
    ], placeable: [OBJ_RAMP, OBJ_SPRING], optimal: 2 },
    { name: 'Chain Reaction', target: { x: 600, y: 420, w: 40, h: 40 }, launcher: { x: 80, y: 420 }, structures: [
      { x: 300, y: 380, w: 40, h: 20, hp: 1 },
      { x: 350, y: 340, w: 40, h: 20, hp: 1 },
      { x: 400, y: 300, w: 40, h: 20, hp: 1 },
      { x: 450, y: 260, w: 40, h: 20, hp: 1 },
      { x: 500, y: 380, w: 20, h: 80, hp: 1 }
    ], placeable: [], optimal: 2 },
    { name: 'Gravity Well', target: { x: 600, y: 250, w: 40, h: 40 }, launcher: { x: 80, y: 250 }, structures: [
      { x: 350, y: 100, w: 20, h: 300, hp: 3 }
    ], placeable: [OBJ_RAMP, OBJ_BLOCK, OBJ_SPRING], optimal: 2 },
    { name: 'Final Challenge', target: { x: 620, y: 60, w: 30, h: 30 }, launcher: { x: 60, y: 420 }, structures: [
      { x: 200, y: 200, w: 20, h: 260, hp: 2 },
      { x: 400, y: 0, w: 20, h: 350, hp: 2 },
      { x: 200, y: 200, w: 220, h: 20, hp: 2 },
      { x: 550, y: 100, w: 100, h: 20, hp: 2 }
    ], placeable: [OBJ_RAMP, OBJ_SPRING, OBJ_BLOCK], optimal: 3 }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusLevel = document.getElementById('statusLevel');
  const statusShots = document.getElementById('statusShots');
  const statusStars = document.getElementById('statusStars');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Launch a projectile to hit the green target!', 'Click + drag on the launcher to aim & set power,', 'then release to fire.', '', 'Click + Drag = Aim  |  Release = Launch', 'F2 = Restart  |  Esc = Pause'] },
    { title: 'Tips', lines: ['Some levels let you place objects first:', 'ramps deflect upward, springs bounce,', 'blocks provide solid walls.', '', 'Fewer shots = more stars (up to 3).', 'Press H anytime to see this help again.'] }
  ];

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_READY;
  let currentLevel = 0;
  let shots = 0;
  let levelStars = {};
  let highScores = [];

  /* ── Physics objects ── */
  let projectile = null;
  let structures = [];
  let placedObjects = [];
  let target = null;
  let launcher = null;

  /* ── Aiming ── */
  let aimAngle = -Math.PI / 4;
  let aimPower = 300;
  let isDragging = false;

  /* ── Trail ── */
  let trailPoints = [];
  let trailTimer = 0;

  /* ── Building ── */
  let selectedPlaceable = null;
  let draggedObject = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    const parent = canvas.parentElement;
    if (parent) {
      canvasW = parent.clientWidth || canvasW;
      canvasH = parent.clientHeight || canvasH;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS);
      if (raw) levelStars = JSON.parse(raw);
    } catch (_) {
      levelStars = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(levelStars));
    } catch (_) {}
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw) highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(level, stars) {
    highScores.push({ level: level + 1, stars });
    highScores.sort((a, b) => b.stars - a.stars || a.level - b.level);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].level}</td><td>${'★'.repeat(highScores[i].stars)}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LEVEL LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;

    currentLevel = index;
    const def = LEVELS[currentLevel];

    shots = 0;
    projectile = null;
    trailPoints = [];
    trailTimer = 0;
    placedObjects = [];
    selectedPlaceable = null;
    draggedObject = null;

    target = { ...def.target };
    launcher = { ...def.launcher };
    structures = def.structures.map(s => ({ ...s, destroyed: false }));

    aimAngle = -Math.PI / 4;
    aimPower = 300;
    isDragging = false;

    state = def.placeable.length > 0 ? STATE_BUILDING : STATE_AIMING;
    updateWindowTitle();
  }

  function nextLevel() {
    if (currentLevel + 1 < LEVELS.length)
      loadLevel(currentLevel + 1);
    else {
      state = STATE_GAME_OVER;
      floatingText.add(canvasW / 2, canvasH / 2 - 40, 'ALL LEVELS COMPLETE!', { color: '#ff0', font: 'bold 20px sans-serif' });
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     STAR RATING
     ══════════════════════════════════════════════════════════════════ */

  function calculateStars() {
    const optimal = LEVELS[currentLevel].optimal;
    if (shots <= optimal) return 3;
    if (shots <= optimal + 1) return 2;
    return 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     LAUNCH
     ══════════════════════════════════════════════════════════════════ */

  function launchProjectile() {
    if (state !== STATE_AIMING) return;

    const clampedAngle = Math.max(-Math.PI, Math.min(0, aimAngle));
    const clampedPower = Math.max(MIN_POWER, Math.min(MAX_POWER, aimPower));

    projectile = {
      x: launcher.x,
      y: launcher.y,
      vx: Math.cos(clampedAngle) * clampedPower,
      vy: Math.sin(clampedAngle) * clampedPower,
      radius: PROJECTILE_RADIUS,
      active: true
    };

    trailPoints = [];
    trailTimer = 0;
    ++shots;
    state = STATE_PLAYING;

    particles.burst(launcher.x, launcher.y, 8, { color: '#fa0', speed: 3, life: 0.4 });
    floatingText.add(launcher.x, launcher.y - 20, 'Launch!', { color: '#fa0', font: 'bold 12px sans-serif' });
    screenShake.trigger(3, 100);
  }

  /* ══════════════════════════════════════════════════════════════════
     PHYSICS UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updatePhysics(dt) {
    if (!projectile || !projectile.active) return;

    // Apply gravity
    projectile.vy += GRAVITY * dt;

    // Apply velocity
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    // Trail
    trailTimer += dt;
    if (trailTimer >= TRAIL_INTERVAL) {
      trailTimer = 0;
      trailPoints.push({ x: projectile.x, y: projectile.y, life: 1 });
      particles.trail(projectile.x, projectile.y, { color: '#fa0', life: 0.3, size: 2 });
    }

    // Floor/ceiling/wall bounce
    if (projectile.y + projectile.radius > canvasH) {
      projectile.y = canvasH - projectile.radius;
      projectile.vy = -projectile.vy * RESTITUTION;
      projectile.vx *= FRICTION;
      emitCollisionSparks(projectile.x, canvasH);
    }
    if (projectile.y - projectile.radius < 0) {
      projectile.y = projectile.radius;
      projectile.vy = -projectile.vy * RESTITUTION;
      emitCollisionSparks(projectile.x, 0);
    }
    if (projectile.x + projectile.radius > canvasW) {
      projectile.x = canvasW - projectile.radius;
      projectile.vx = -projectile.vx * RESTITUTION;
      emitCollisionSparks(canvasW, projectile.y);
    }
    if (projectile.x - projectile.radius < 0) {
      projectile.x = projectile.radius;
      projectile.vx = -projectile.vx * RESTITUTION;
      emitCollisionSparks(0, projectile.y);
    }

    // Structure collisions
    for (const s of structures) {
      if (s.destroyed) continue;
      if (circleRectCollision(projectile, s)) {
        handleStructureCollision(s);
      }
    }

    // Placed object interactions
    for (const obj of placedObjects) {
      if (obj.type === OBJ_SPRING && circleRectCollision(projectile, obj)) {
        projectile.vy = -Math.abs(projectile.vy) * 1.5 - 200;
        particles.burst(obj.x + obj.w / 2, obj.y, 10, { color: '#0f0', speed: 3, life: 0.4 });
        floatingText.add(obj.x + obj.w / 2, obj.y - 15, 'Bounce!', { color: '#0f0', font: 'bold 11px sans-serif' });
        screenShake.trigger(3, 80);
      } else if (obj.type === OBJ_RAMP && circleRectCollision(projectile, obj)) {
        // Ramp deflects upward
        projectile.vy = -Math.abs(projectile.vy) * 0.8 - 100;
        projectile.vx *= 1.1;
        particles.burst(obj.x + obj.w / 2, obj.y, 6, { color: '#88f', speed: 2, life: 0.3 });
      } else if (obj.type === OBJ_BLOCK && circleRectCollision(projectile, obj)) {
        // Block — solid bounce
        projectile.vx = -projectile.vx * RESTITUTION;
        emitCollisionSparks(obj.x + obj.w / 2, obj.y + obj.h / 2);
      }
    }

    // Check target hit
    if (circleRectCollision(projectile, target)) {
      projectile.active = false;
      completeLevel();
      return;
    }

    // Check if projectile stopped (low velocity)
    const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
    if (speed < 5 && Math.abs(projectile.y - (canvasH - projectile.radius)) < 2) {
      projectile.active = false;
      floatingText.add(projectile.x, projectile.y - 20, 'Missed!', { color: '#f44', font: 'bold 12px sans-serif' });
      // Go back to aiming
      state = STATE_AIMING;
    }

    // Off-screen check
    if (projectile.x < -50 || projectile.x > canvasW + 50 || projectile.y > canvasH + 50) {
      projectile.active = false;
      state = STATE_AIMING;
    }
  }

  function circleRectCollision(circle, rect) {
    const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
  }

  function handleStructureCollision(s) {
    --s.hp;
    const sx = s.x + s.w / 2;
    const sy = s.y + s.h / 2;

    // Spark particles on collision impact
    emitCollisionSparks(sx, sy);
    screenShake.trigger(4, 150);

    if (s.hp <= 0) {
      s.destroyed = true;
      // Dust/debris particles on structure collapse
      emitCollapseDust(sx, sy);
      floatingText.add(sx, sy - 15, 'Destroyed!', { color: '#f80', font: 'bold 12px sans-serif' });
    } else {
      floatingText.add(sx, sy - 15, 'Hit!', { color: '#ff0', font: 'bold 11px sans-serif' });
    }

    // Bounce projectile off structure
    projectile.vx = -projectile.vx * RESTITUTION;
    projectile.vy = -projectile.vy * RESTITUTION * 0.5;
  }

  function emitCollisionSparks(x, y) {
    particles.burst(x, y, 8, { color: '#ff0', speed: 4, life: 0.3 });
    particles.sparkle(x, y, 5, { color: '#fa0', speed: 2 });
  }

  function emitCollapseDust(x, y) {
    particles.burst(x, y, 15, { color: '#a86', speed: 3, life: 0.6, gravity: 0.1 });
    particles.burst(x, y, 10, { color: '#864', speed: 2, life: 0.5 });
  }

  /* ══════════════════════════════════════════════════════════════════
     LEVEL COMPLETION
     ══════════════════════════════════════════════════════════════════ */

  function completeLevel() {
    state = STATE_LEVEL_COMPLETE;
    const stars = calculateStars();

    if (!levelStars[currentLevel] || stars > levelStars[currentLevel]) {
      levelStars[currentLevel] = stars;
      saveProgress();
    }

    addHighScore(currentLevel, stars);

    // Celebration effects
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    particles.burst(tx, ty, 20, { color: '#0f0', speed: 4, life: 0.8 });
    particles.sparkle(tx, ty, 12, { color: '#ff0', speed: 3 });
    floatingText.add(canvasW / 2, canvasH / 2 - 60, `Level ${currentLevel + 1} Complete!`, { color: '#ff0', font: 'bold 18px sans-serif' });
    floatingText.add(canvasW / 2, canvasH / 2 - 30, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { color: '#fc0', font: 'bold 24px sans-serif' });
    screenShake.trigger(5, 250);

    // Confetti on 3-star
    if (stars === 3)
      particles.confetti(canvasW / 2, canvasH / 2, 40, { speed: 6, gravity: 0.08 });

    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     PLACING OBJECTS
     ══════════════════════════════════════════════════════════════════ */

  function placeObject(x, y) {
    if (!selectedPlaceable) return;
    const obj = { type: selectedPlaceable, x: x - 20, y: y - 10, w: 40, h: 20 };
    placedObjects.push(obj);
    particles.sparkle(x, y, 6, { color: '#4f4', speed: 1.5 });
    floatingText.add(x, y - 15, `Placed ${selectedPlaceable}!`, { color: '#4f4', font: 'bold 11px sans-serif' });
    selectedPlaceable = null;
  }

  function startAimingPhase() {
    state = STATE_AIMING;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state === STATE_PLAYING)
      updatePhysics(dt);

    // Decay trail
    for (let i = trailPoints.length - 1; i >= 0; --i) {
      trailPoints[i].life -= dt * 2;
      if (trailPoints[i].life <= 0)
        trailPoints.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawBackground() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
    skyGrad.addColorStop(0, '#0a0a2e');
    skyGrad.addColorStop(0.4, '#0d1240');
    skyGrad.addColorStop(0.7, '#131850');
    skyGrad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle grid for depth perception
    ctx.strokeStyle = 'rgba(80,80,140,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < canvasW; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvasH);
      ctx.stroke();
    }
    for (let gy = 0; gy < canvasH; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvasW, gy);
      ctx.stroke();
    }

    // Distant stars (static, seeded by position)
    ctx.fillStyle = 'rgba(200,200,255,0.4)';
    for (let i = 0; i < 30; ++i) {
      const sx = ((i * 137 + 53) % canvasW);
      const sy = ((i * 89 + 17) % (canvasH * 0.5));
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(gameTime * 1.5 + i * 0.8));
      ctx.globalAlpha = twinkle * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    // Ground body gradient
    const groundGrad = ctx.createLinearGradient(0, canvasH - 16, 0, canvasH);
    groundGrad.addColorStop(0, '#3a5a3a');
    groundGrad.addColorStop(0.3, '#2e4a2e');
    groundGrad.addColorStop(1, '#1a2e1a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, canvasH - 16, canvasW, 16);

    // Grass edge line
    ctx.strokeStyle = '#5a8a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvasH - 16);
    ctx.lineTo(canvasW, canvasH - 16);
    ctx.stroke();

    // Small grass tufts
    ctx.strokeStyle = 'rgba(90,140,90,0.5)';
    ctx.lineWidth = 1;
    for (let gx = 5; gx < canvasW; gx += 18) {
      const h = 3 + (gx * 7 % 5);
      const sway = Math.sin(gameTime * 2 + gx * 0.1) * 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, canvasH - 16);
      ctx.lineTo(gx + sway, canvasH - 16 - h);
      ctx.stroke();
    }
  }

  function drawLauncher() {
    if (!launcher) return;
    const lx = launcher.x;
    const ly = launcher.y;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(lx, ly + 8, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Circular base with metallic gradient
    const baseGrad = ctx.createRadialGradient(lx - 3, ly - 3, 2, lx, ly, 14);
    baseGrad.addColorStop(0, '#aab');
    baseGrad.addColorStop(0.5, '#778');
    baseGrad.addColorStop(1, '#445');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(lx, ly, 12, 0, Math.PI * 2);
    ctx.fill();

    // Base rim
    ctx.strokeStyle = '#556';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Specular highlight on base
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(lx - 3, ly - 4, 6, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Barrel (rotated toward aim direction)
    if (state === STATE_AIMING || state === STATE_BUILDING) {
      const barrelLen = 22;
      const barrelW = 6;
      const cosA = Math.cos(aimAngle);
      const sinA = Math.sin(aimAngle);
      const perpX = -sinA * barrelW;
      const perpY = cosA * barrelW;
      const endX = lx + cosA * barrelLen;
      const endY = ly + sinA * barrelLen;

      // Barrel body gradient
      const barrelGrad = ctx.createLinearGradient(
        lx + perpX, ly + perpY,
        lx - perpX, ly - perpY
      );
      barrelGrad.addColorStop(0, '#999');
      barrelGrad.addColorStop(0.3, '#bbb');
      barrelGrad.addColorStop(0.5, '#ccc');
      barrelGrad.addColorStop(0.7, '#aaa');
      barrelGrad.addColorStop(1, '#777');
      ctx.fillStyle = barrelGrad;
      ctx.beginPath();
      ctx.moveTo(lx + perpX, ly + perpY);
      ctx.lineTo(endX + perpX, endY + perpY);
      ctx.lineTo(endX - perpX, endY - perpY);
      ctx.lineTo(lx - perpX, ly - perpY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#556';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Muzzle ring
      ctx.strokeStyle = '#aab';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endX + perpX * 1.2, endY + perpY * 1.2);
      ctx.lineTo(endX - perpX * 1.2, endY - perpY * 1.2);
      ctx.stroke();

      // Aim trajectory (dashed, glowing)
      const len = aimPower / MAX_POWER * 80;
      const farX = lx + cosA * (barrelLen + len);
      const farY = ly + sinA * (barrelLen + len);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#fa0';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fa0';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(farX, farY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Arrowhead at end
      const arrowSize = 6;
      const ax1 = farX - cosA * arrowSize + sinA * arrowSize * 0.5;
      const ay1 = farY - sinA * arrowSize - cosA * arrowSize * 0.5;
      const ax2 = farX - cosA * arrowSize - sinA * arrowSize * 0.5;
      const ay2 = farY - sinA * arrowSize + cosA * arrowSize * 0.5;
      ctx.fillStyle = '#fa0';
      ctx.beginPath();
      ctx.moveTo(farX, farY);
      ctx.lineTo(ax1, ay1);
      ctx.lineTo(ax2, ay2);
      ctx.closePath();
      ctx.fill();

      // Power indicator with background pill
      const powerText = `${Math.round(aimPower)}`;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(powerText).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, lx - tw / 2, ly - 28, tw, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#fa0';
      ctx.fillText(powerText, lx, ly - 17);
    }
  }

  /** Utility: draw a rounded rectangle path */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function drawTarget() {
    if (!target) return;
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const pulse = 1 + 0.08 * Math.sin(gameTime * 4);
    const glowPulse = 12 + 6 * Math.sin(gameTime * 3);

    // Outer glow (animated)
    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, target.w * 1.2);
    outerGlow.addColorStop(0, 'rgba(255,215,0,0.25)');
    outerGlow.addColorStop(0.5, 'rgba(0,255,0,0.08)');
    outerGlow.addColorStop(1, 'rgba(0,255,0,0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, target.w * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Target body gradient
    const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, target.w / 2);
    grad.addColorStop(0, '#6f6');
    grad.addColorStop(0.4, '#0d0');
    grad.addColorStop(1, '#080');
    ctx.fillStyle = grad;

    ctx.shadowBlur = glowPulse;
    ctx.shadowColor = '#0f0';
    roundRect(ctx, -target.w / 2, -target.h / 2, target.w, target.h, 6);
    ctx.fill();

    // Inner border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -target.w / 2 + 2, -target.h / 2 + 2, target.w - 4, target.h - 4, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Star with rotation
    const starRot = gameTime * 0.8;
    ctx.save();
    ctx.rotate(starRot);
    drawStar(ctx, 0, 0, 5, target.w * 0.32, target.w * 0.15, '#ffd700', '#ff8c00');
    ctx.restore();

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(-2, -target.h / 4, target.w * 0.3, target.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Draw a filled star with gradient fill */
  function drawStar(c, cx, cy, points, outerR, innerR, colorOuter, colorInner) {
    const grad = c.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, outerR);
    grad.addColorStop(0, colorOuter);
    grad.addColorStop(1, colorInner);
    c.fillStyle = grad;
    c.beginPath();
    for (let i = 0; i < points * 2; ++i) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / 2 * 3) + (i * Math.PI / points);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0)
        c.moveTo(px, py);
      else
        c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    // Star outline glow
    c.strokeStyle = 'rgba(255,255,200,0.6)';
    c.lineWidth = 1;
    c.stroke();
  }

  function drawStructures() {
    for (const s of structures) {
      if (s.destroyed) continue;

      const sx = s.x;
      const sy = s.y;
      const sw = s.w;
      const sh = s.h;
      const maxHp = LEVELS[currentLevel].structures.find(
        st => st.x === sx && st.y === sy
      )?.hp || s.hp;
      const dmgRatio = 1 - s.hp / maxHp;

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx + 3, sy + 3, sw, sh);

      // Stone/concrete body gradient
      const baseLight = s.hp > 2 ? '#9aa' : s.hp > 1 ? '#888' : '#776';
      const baseDark = s.hp > 2 ? '#667' : s.hp > 1 ? '#445' : '#443';
      const bodyGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
      bodyGrad.addColorStop(0, baseLight);
      bodyGrad.addColorStop(0.5, baseDark);
      bodyGrad.addColorStop(1, baseLight);
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(sx, sy, sw, sh);

      // Top highlight edge
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy + 0.5);
      ctx.lineTo(sx + sw, sy + 0.5);
      ctx.stroke();

      // Left highlight edge
      ctx.beginPath();
      ctx.moveTo(sx + 0.5, sy);
      ctx.lineTo(sx + 0.5, sy + sh);
      ctx.stroke();

      // Bottom/right shadow edge
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(sx + sw - 0.5, sy);
      ctx.lineTo(sx + sw - 0.5, sy + sh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, sy + sh - 0.5);
      ctx.lineTo(sx + sw, sy + sh - 0.5);
      ctx.stroke();

      // Brick/stone pattern (subtle)
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.5;
      const brickH = 10;
      for (let by = sy + brickH; by < sy + sh; by += brickH) {
        ctx.beginPath();
        ctx.moveTo(sx, by);
        ctx.lineTo(sx + sw, by);
        ctx.stroke();
      }
      const brickW = 15;
      let row = 0;
      for (let by = sy; by < sy + sh; by += brickH) {
        const offset = (row % 2) * brickW * 0.5;
        for (let bx = sx + offset + brickW; bx < sx + sw; bx += brickW) {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx, Math.min(by + brickH, sy + sh));
          ctx.stroke();
        }
        ++row;
      }

      // Cracks for damaged structures
      if (dmgRatio > 0) {
        ctx.strokeStyle = `rgba(40,20,10,${0.3 + dmgRatio * 0.5})`;
        ctx.lineWidth = 1 + dmgRatio;
        const cmx = sx + sw / 2;
        const cmy = sy + sh / 2;

        ctx.beginPath();
        ctx.moveTo(cmx, cmy);
        ctx.lineTo(cmx - sw * 0.3 * dmgRatio, cmy - sh * 0.4 * dmgRatio);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cmx, cmy);
        ctx.lineTo(cmx + sw * 0.35 * dmgRatio, cmy + sh * 0.3 * dmgRatio);
        ctx.stroke();

        if (dmgRatio > 0.5) {
          ctx.beginPath();
          ctx.moveTo(cmx + sw * 0.1, cmy - sh * 0.1);
          ctx.lineTo(cmx - sw * 0.2, cmy + sh * 0.35);
          ctx.stroke();
        }
      }

      // Outer border
      ctx.strokeStyle = '#334';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, sw, sh);
    }
  }

  function drawPlacedObjects() {
    for (const obj of placedObjects) {
      // Drop shadow for all placed objects
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(obj.x + 2, obj.y + 2, obj.w, obj.h);

      switch (obj.type) {
        case OBJ_RAMP: {
          // Metallic ramp with sheen
          const rampGrad = ctx.createLinearGradient(obj.x, obj.y, obj.x, obj.y + obj.h);
          rampGrad.addColorStop(0, '#8899cc');
          rampGrad.addColorStop(0.3, '#6677bb');
          rampGrad.addColorStop(0.6, '#5566aa');
          rampGrad.addColorStop(1, '#334488');

          ctx.fillStyle = rampGrad;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y);
          ctx.closePath();
          ctx.fill();

          // Surface highlight line along slope
          ctx.strokeStyle = 'rgba(180,200,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obj.x + 2, obj.y + obj.h - 2);
          ctx.lineTo(obj.x + obj.w - 2, obj.y + 2);
          ctx.stroke();

          // Edge outline
          ctx.strokeStyle = '#334';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y);
          ctx.closePath();
          ctx.stroke();

          // Directional arrows on surface
          ctx.fillStyle = 'rgba(200,220,255,0.3)';
          const midX = obj.x + obj.w * 0.6;
          const midY = obj.y + obj.h * 0.6;
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX - 5, midY + 3);
          ctx.lineTo(midX - 2, midY - 3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case OBJ_BLOCK: {
          // Wooden block with grain
          const woodGrad = ctx.createLinearGradient(obj.x, obj.y, obj.x + obj.w, obj.y);
          woodGrad.addColorStop(0, '#c49a6c');
          woodGrad.addColorStop(0.2, '#b8895e');
          woodGrad.addColorStop(0.4, '#c9a070');
          woodGrad.addColorStop(0.6, '#b08050');
          woodGrad.addColorStop(0.8, '#c49a6c');
          woodGrad.addColorStop(1, '#a07040');

          ctx.fillStyle = woodGrad;
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

          // Wood grain lines
          ctx.strokeStyle = 'rgba(80,50,20,0.15)';
          ctx.lineWidth = 0.8;
          for (let gy = obj.y + 3; gy < obj.y + obj.h; gy += 4) {
            ctx.beginPath();
            ctx.moveTo(obj.x, gy);
            const wave = Math.sin(gy * 0.5) * 2;
            ctx.quadraticCurveTo(obj.x + obj.w / 2, gy + wave, obj.x + obj.w, gy);
            ctx.stroke();
          }

          // Top highlight
          ctx.strokeStyle = 'rgba(255,230,180,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obj.x + 1, obj.y + 1);
          ctx.lineTo(obj.x + obj.w - 1, obj.y + 1);
          ctx.stroke();

          // Bottom shadow
          ctx.strokeStyle = 'rgba(60,30,10,0.3)';
          ctx.beginPath();
          ctx.moveTo(obj.x + 1, obj.y + obj.h - 1);
          ctx.lineTo(obj.x + obj.w - 1, obj.y + obj.h - 1);
          ctx.stroke();

          // Border
          ctx.strokeStyle = '#6a4a2a';
          ctx.lineWidth = 1;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          break;
        }
        case OBJ_SPRING: {
          // Spring base plate
          const springBaseGrad = ctx.createLinearGradient(obj.x, obj.y + obj.h - 4, obj.x, obj.y + obj.h);
          springBaseGrad.addColorStop(0, '#4a4a4a');
          springBaseGrad.addColorStop(1, '#2a2a2a');
          ctx.fillStyle = springBaseGrad;
          ctx.fillRect(obj.x - 2, obj.y + obj.h - 4, obj.w + 4, 4);

          // Top plate
          ctx.fillStyle = springBaseGrad;
          ctx.fillRect(obj.x - 2, obj.y, obj.w + 4, 3);

          // Animated spring coils
          const bounce = Math.sin(gameTime * 6) * 1.5;
          ctx.lineWidth = 2.5;
          const coilCount = 5;
          const coilH = obj.h - 6;
          for (let i = 0; i < coilCount; ++i) {
            const t = i / coilCount;
            const ny = obj.y + 3 + t * coilH + bounce * (1 - t);
            const coilGrad = ctx.createLinearGradient(obj.x, 0, obj.x + obj.w, 0);
            coilGrad.addColorStop(0, '#00aa00');
            coilGrad.addColorStop(0.3, '#44ff44');
            coilGrad.addColorStop(0.5, '#66ff66');
            coilGrad.addColorStop(0.7, '#44ff44');
            coilGrad.addColorStop(1, '#00aa00');
            ctx.strokeStyle = coilGrad;

            ctx.beginPath();
            ctx.moveTo(obj.x + 3, ny);
            ctx.quadraticCurveTo(obj.x + obj.w / 2, ny - 3, obj.x + obj.w - 3, ny);
            ctx.stroke();
          }

          // Glow around spring
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(0,255,0,0.3)';
          ctx.strokeStyle = 'rgba(0,255,0,0.1)';
          ctx.lineWidth = 1;
          ctx.strokeRect(obj.x - 1, obj.y - 1, obj.w + 2, obj.h + 2);
          ctx.shadowBlur = 0;
          break;
        }
      }
    }
  }

  function drawProjectile() {
    if (!projectile || !projectile.active) return;
    const px = projectile.x;
    const py = projectile.y;
    const r = projectile.radius;
    const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);

    // Motion blur lines when moving fast
    if (speed > 100) {
      const blur = Math.min(speed / 400, 1);
      const nx = -projectile.vx / speed;
      const ny = -projectile.vy / speed;
      ctx.globalAlpha = blur * 0.3;
      ctx.strokeStyle = '#f80';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; ++i) {
        const len = i * r * 0.8;
        ctx.beginPath();
        ctx.moveTo(px + nx * r + ny * i * 1.5, py + ny * r - nx * i * 1.5);
        ctx.lineTo(px + nx * (r + len) + ny * i * 1.5, py + ny * (r + len) - nx * i * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + nx * r - ny * i * 1.5, py + ny * r + nx * i * 1.5);
        ctx.lineTo(px + nx * (r + len) - ny * i * 1.5, py + ny * (r + len) + nx * i * 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Outer glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fa0';

    // Rubber ball with radial gradient
    const ballGrad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    ballGrad.addColorStop(0, '#ffe080');
    ballGrad.addColorStop(0.3, '#ff9920');
    ballGrad.addColorStop(0.7, '#dd6600');
    ballGrad.addColorStop(1, '#993300');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rubber surface line (equator)
    ctx.strokeStyle = 'rgba(100,40,0,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.9, r * 0.3, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(px - r * 0.25, py - r * 0.3, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Rim light
    ctx.strokeStyle = 'rgba(255,200,100,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, r - 0.5, -0.8, 0.8);
    ctx.stroke();
  }

  function drawTrail() {
    for (let i = 0; i < trailPoints.length; ++i) {
      const p = trailPoints[i];
      const life = p.life;
      const size = 1.5 + life * 2;
      ctx.globalAlpha = life * 0.6;

      // Gradient trail dots
      const tGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      tGrad.addColorStop(0, '#ffe080');
      tGrad.addColorStop(0.5, '#fa0');
      tGrad.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBuildUI() {
    if (state !== STATE_BUILDING) return;

    const def = LEVELS[currentLevel];
    const barY = canvasH - 54;

    // Build bar background with gradient
    const barGrad = ctx.createLinearGradient(0, barY, 0, canvasH);
    barGrad.addColorStop(0, 'rgba(10,10,50,0.92)');
    barGrad.addColorStop(0.1, 'rgba(15,15,60,0.95)');
    barGrad.addColorStop(1, 'rgba(5,5,30,0.98)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, barY, canvasW, 54);

    // Top edge highlight
    ctx.strokeStyle = 'rgba(100,120,200,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(canvasW, barY);
    ctx.stroke();

    ctx.fillStyle = '#bbc';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Place objects, then click "Ready" to aim:', 10, barY + 16);

    // Type icons with hover-like styling
    const typeColors = {
      [OBJ_RAMP]: { bg: '#334488', sel: '#4466bb', icon: '#8899cc', label: 'Ramp' },
      [OBJ_BLOCK]: { bg: '#604020', sel: '#805530', icon: '#c49a6c', label: 'Block' },
      [OBJ_SPRING]: { bg: '#084008', sel: '#0a6a0a', icon: '#44ff44', label: 'Spring' }
    };

    const types = def.placeable;
    for (let i = 0; i < types.length; ++i) {
      const bx = 10 + i * 95;
      const isSelected = types[i] === selectedPlaceable;
      const tc = typeColors[types[i]] || { bg: '#223', sel: '#446', icon: '#aaa', label: types[i] };

      // Button with rounded corners
      const btnGrad = ctx.createLinearGradient(bx, barY + 22, bx, barY + 48);
      btnGrad.addColorStop(0, isSelected ? tc.sel : tc.bg);
      btnGrad.addColorStop(1, isSelected ? tc.bg : 'rgba(0,0,0,0.4)');
      ctx.fillStyle = btnGrad;
      roundRect(ctx, bx, barY + 22, 85, 26, 4);
      ctx.fill();

      // Selection glow
      if (isSelected) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = tc.icon;
        ctx.strokeStyle = tc.icon;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, barY + 22, 85, 26, 4);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(100,100,140,0.3)';
        ctx.lineWidth = 1;
        roundRect(ctx, bx, barY + 22, 85, 26, 4);
        ctx.stroke();
      }

      ctx.fillStyle = isSelected ? '#fff' : '#aab';
      ctx.font = isSelected ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tc.label, bx + 42, barY + 39);
    }

    // Ready button with glow
    const rbx = canvasW - 90;
    const readyGrad = ctx.createLinearGradient(rbx, barY + 22, rbx, barY + 48);
    readyGrad.addColorStop(0, '#0a8a0a');
    readyGrad.addColorStop(1, '#044');
    ctx.fillStyle = readyGrad;
    roundRect(ctx, rbx, barY + 22, 80, 26, 4);
    ctx.fill();

    ctx.shadowBlur = 6;
    ctx.shadowColor = '#0f0';
    ctx.strokeStyle = '#0c0';
    ctx.lineWidth = 1;
    roundRect(ctx, rbx, barY + 22, 80, 26, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ready  \u25B6', rbx + 40, barY + 39);
  }

  /** Draw a centered panel with rounded corners and vignette overlay */
  function drawOverlayPanel(alpha) {
    // Vignette overlay
    const vigGrad = ctx.createRadialGradient(canvasW / 2, canvasH / 2, canvasW * 0.2, canvasW / 2, canvasH / 2, canvasW * 0.7);
    vigGrad.addColorStop(0, `rgba(0,0,0,${alpha * 0.6})`);
    vigGrad.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  /** Draw text with a subtle drop shadow */
  function drawTextShadowed(text, x, y, color, font) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawHUD() {
    if (state === STATE_READY) {
      drawOverlayPanel(0.88);
      const cx = canvasW / 2;
      const cy = canvasH / 2;

      // Title with glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fa0';
      drawTextShadowed('PHYSICS PUZZLE', cx, cy - 55, '#fa0', 'bold 32px sans-serif');
      ctx.shadowBlur = 0;

      // Decorative line
      const lineGrad = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0);
      lineGrad.addColorStop(0, 'rgba(255,170,0,0)');
      lineGrad.addColorStop(0.3, 'rgba(255,170,0,0.6)');
      lineGrad.addColorStop(0.5, 'rgba(255,200,60,0.8)');
      lineGrad.addColorStop(0.7, 'rgba(255,170,0,0.6)');
      lineGrad.addColorStop(1, 'rgba(255,170,0,0)');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 120, cy - 30);
      ctx.lineTo(cx + 120, cy - 30);
      ctx.stroke();

      drawTextShadowed('Aim and launch projectiles to hit targets!', cx, cy - 5, '#bbc', '14px sans-serif');

      // Pulsing start prompt
      const promptAlpha = 0.5 + 0.5 * Math.sin(gameTime * 3);
      ctx.globalAlpha = promptAlpha;
      drawTextShadowed('Tap or press F2 to Start', cx, cy + 30, '#ff0', 'bold 14px sans-serif');
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      drawOverlayPanel(0.65);
      const cx = canvasW / 2;
      const cy = canvasH / 2;

      // Pause icon (two bars)
      ctx.fillStyle = 'rgba(255,255,0,0.3)';
      ctx.fillRect(cx - 18, cy - 20, 10, 40);
      ctx.fillRect(cx + 8, cy - 20, 10, 40);

      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff0';
      drawTextShadowed('PAUSED', cx, cy + 40, '#ff0', 'bold 32px sans-serif');
      ctx.shadowBlur = 0;

      const promptAlpha = 0.5 + 0.5 * Math.sin(gameTime * 2.5);
      ctx.globalAlpha = promptAlpha;
      drawTextShadowed('Press ESC to resume', cx, cy + 70, '#aab', '13px sans-serif');
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    if (state === STATE_LEVEL_COMPLETE) {
      drawOverlayPanel(0.55);
      const cx = canvasW / 2;
      const cy = canvasH / 2;

      ctx.shadowBlur = 16;
      ctx.shadowColor = '#0f0';
      drawTextShadowed('TARGET HIT!', cx, cy - 15, '#4f4', 'bold 24px sans-serif');
      ctx.shadowBlur = 0;

      const promptAlpha = 0.5 + 0.5 * Math.sin(gameTime * 3);
      ctx.globalAlpha = promptAlpha;
      drawTextShadowed('Tap or press any key for next level', cx, cy + 20, '#ccd', '14px sans-serif');
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      drawOverlayPanel(0.8);
      const cx = canvasW / 2;
      const cy = canvasH / 2;

      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fa0';
      drawTextShadowed('ALL LEVELS COMPLETE!', cx, cy - 40, '#fa0', 'bold 30px sans-serif');
      ctx.shadowBlur = 0;

      const totalStars = Object.values(levelStars).reduce((a, b) => a + b, 0);
      drawTextShadowed(`Total Stars: ${totalStars} / ${LEVELS.length * 3}`, cx, cy + 5, '#ffd700', 'bold 18px sans-serif');

      const promptAlpha = 0.5 + 0.5 * Math.sin(gameTime * 2.5);
      ctx.globalAlpha = promptAlpha;
      drawTextShadowed('Tap or press F2 to play again', cx, cy + 40, '#ccd', '14px sans-serif');
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    // Level info (top) with panel background
    if (state === STATE_AIMING || state === STATE_PLAYING || state === STATE_BUILDING) {
      // Info panel background
      const infoGrad = ctx.createLinearGradient(canvasW - 260, 0, canvasW, 0);
      infoGrad.addColorStop(0, 'rgba(0,0,0,0)');
      infoGrad.addColorStop(0.3, 'rgba(0,0,20,0.4)');
      infoGrad.addColorStop(1, 'rgba(0,0,20,0.6)');
      ctx.fillStyle = infoGrad;
      ctx.fillRect(canvasW - 260, 0, 260, 44);

      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';

      // Level name
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(`Level ${currentLevel + 1}/${LEVELS.length}: ${LEVELS[currentLevel].name}`, canvasW - 9, 19);
      ctx.fillStyle = '#ccd';
      ctx.fillText(`Level ${currentLevel + 1}/${LEVELS.length}: ${LEVELS[currentLevel].name}`, canvasW - 10, 18);

      // Shots info
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(`Shots: ${shots} | Best: ${LEVELS[currentLevel].optimal}`, canvasW - 9, 35);
      ctx.fillStyle = shots <= LEVELS[currentLevel].optimal ? '#6f6' : '#fa0';
      ctx.fillText(`Shots: ${shots} | Best: ${LEVELS[currentLevel].optimal}`, canvasW - 10, 34);

      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    drawBackground();

    if (state === STATE_AIMING || state === STATE_PLAYING || state === STATE_BUILDING || state === STATE_LEVEL_COMPLETE) {
      drawGround();
      drawStructures();
      drawPlacedObjects();
      drawTarget();
      drawTrail();
      drawProjectile();
      drawLauncher();
      drawBuildUI();
    }

    drawHUD();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = canvasW / 2, pw = 400, ph = 220, px = cx - pw / 2, py = (canvasH - ph) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#fa0';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#fa0';
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

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusLevel) statusLevel.textContent = `Level: ${currentLevel + 1}/${LEVELS.length}`;
    if (statusShots) statusShots.textContent = `Shots: ${shots}`;
    if (statusStars) {
      const s = levelStars[currentLevel] || 0;
      statusStars.textContent = `Stars: ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;
  let gameTime = 0;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    gameTime += dt;

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
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
      if (state === STATE_READY || state === STATE_AIMING || state === STATE_BUILDING || state === STATE_PAUSED) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (e.code === 'F2') {
      e.preventDefault();
      loadLevel(state === STATE_GAME_OVER ? 0 : currentLevel);
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING || state === STATE_AIMING || state === STATE_BUILDING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_AIMING;
      return;
    }

    if (state === STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    // Build mode: select placeable
    if (state === STATE_BUILDING) {
      if (e.key === '1' || e.code === 'KeyR') selectedPlaceable = OBJ_RAMP;
      if (e.key === '2' || e.code === 'KeyB') selectedPlaceable = OBJ_BLOCK;
      if (e.key === '3' || e.code === 'KeyS') selectedPlaceable = OBJ_SPRING;
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY) {
      loadLevel(0);
      return;
    }

    if (state === STATE_GAME_OVER) {
      loadLevel(0);
      return;
    }

    if (state === STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Build mode click
    if (state === STATE_BUILDING) {
      const barY = canvasH - 50;
      if (my >= barY) {
        // Check type buttons
        const def = LEVELS[currentLevel];
        for (let i = 0; i < def.placeable.length; ++i) {
          const bx = 10 + i * 90;
          if (mx >= bx && mx <= bx + 80 && my >= barY + 24)
            selectedPlaceable = def.placeable[i];
        }
        // Check ready button
        if (mx >= canvasW - 80 && my >= barY + 24)
          startAimingPhase();
        return;
      }
      // Hit-test already-placed objects for dragging (last placed = on top)
      for (let i = placedObjects.length - 1; i >= 0; --i) {
        const obj = placedObjects[i];
        if (mx >= obj.x && mx <= obj.x + obj.w && my >= obj.y && my <= obj.y + obj.h) {
          draggedObject = obj;
          dragOffsetX = mx - obj.x;
          dragOffsetY = my - obj.y;
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
      // Place new object on field
      if (selectedPlaceable)
        placeObject(mx, my);
      return;
    }

    // Aiming mode
    if (state === STATE_AIMING) {
      isDragging = true;
      return;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Drag placed object during building phase
    if (draggedObject && state === STATE_BUILDING) {
      draggedObject.x = mx - dragOffsetX;
      draggedObject.y = my - dragOffsetY;
      return;
    }

    if (!isDragging || state !== STATE_AIMING) return;

    const dx = mx - launcher.x;
    const dy = my - launcher.y;
    aimAngle = Math.max(-Math.PI, Math.min(0, Math.atan2(dy, dx)));
    aimPower = Math.max(MIN_POWER, Math.min(MAX_POWER, Math.sqrt(dx * dx + dy * dy) * 2));
  });

  canvas.addEventListener('pointerup', () => {
    if (draggedObject) {
      draggedObject = null;
      return;
    }
    if (isDragging && state === STATE_AIMING) {
      isDragging = false;
      launchProjectile();
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        loadLevel(state === STATE_GAME_OVER ? 0 : currentLevel);
        break;
      case 'pause':
        if (state === STATE_PLAYING || state === STATE_AIMING || state === STATE_BUILDING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_AIMING;
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'tutorial':
        showTutorial = true;
        tutorialPage = 0;
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const levelName = LEVELS[currentLevel]?.name || '';
    const title = state === STATE_GAME_OVER
      ? 'Physics Puzzle — All Complete!'
      : `Physics Puzzle — Level ${currentLevel + 1}: ${levelName}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadProgress();
  loadHighScores();
  updateWindowTitle();

  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
