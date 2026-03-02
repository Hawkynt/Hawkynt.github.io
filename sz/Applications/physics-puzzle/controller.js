;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
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

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
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
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'ALL LEVELS COMPLETE!', { color: '#ff0', font: 'bold 20px sans-serif' });
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
    if (projectile.y + projectile.radius > CANVAS_H) {
      projectile.y = CANVAS_H - projectile.radius;
      projectile.vy = -projectile.vy * RESTITUTION;
      projectile.vx *= FRICTION;
      emitCollisionSparks(projectile.x, CANVAS_H);
    }
    if (projectile.y - projectile.radius < 0) {
      projectile.y = projectile.radius;
      projectile.vy = -projectile.vy * RESTITUTION;
      emitCollisionSparks(projectile.x, 0);
    }
    if (projectile.x + projectile.radius > CANVAS_W) {
      projectile.x = CANVAS_W - projectile.radius;
      projectile.vx = -projectile.vx * RESTITUTION;
      emitCollisionSparks(CANVAS_W, projectile.y);
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
    if (speed < 5 && Math.abs(projectile.y - (CANVAS_H - projectile.radius)) < 2) {
      projectile.active = false;
      floatingText.add(projectile.x, projectile.y - 20, 'Missed!', { color: '#f44', font: 'bold 12px sans-serif' });
      // Go back to aiming
      state = STATE_AIMING;
    }

    // Off-screen check
    if (projectile.x < -50 || projectile.x > CANVAS_W + 50 || projectile.y > CANVAS_H + 50) {
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
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Level ${currentLevel + 1} Complete!`, { color: '#ff0', font: 'bold 18px sans-serif' });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { color: '#fc0', font: 'bold 24px sans-serif' });
    screenShake.trigger(5, 250);

    // Confetti on 3-star
    if (stars === 3)
      particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40, { speed: 6, gravity: 0.08 });

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

  function drawGround() {
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(0, CANVAS_H - 10, CANVAS_W, 10);
  }

  function drawLauncher() {
    if (!launcher) return;
    const lx = launcher.x;
    const ly = launcher.y;

    // Launcher base
    ctx.fillStyle = '#666';
    ctx.fillRect(lx - 15, ly - 5, 30, 10);

    // Aim line
    if (state === STATE_AIMING || state === STATE_BUILDING) {
      const len = aimPower / MAX_POWER * 80;
      const ex = lx + Math.cos(aimAngle) * len;
      const ey = ly + Math.sin(aimAngle) * len;

      ctx.strokeStyle = '#fa0';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#fa0';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Power indicator
      ctx.fillStyle = '#fa0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(aimPower)}`, lx, ly - 15);
    }
  }

  function drawTarget() {
    if (!target) return;
    ctx.fillStyle = '#0a0';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0f0';
    ctx.fillRect(target.x, target.y, target.w, target.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', target.x + target.w / 2, target.y + target.h / 2);
  }

  function drawStructures() {
    for (const s of structures) {
      if (s.destroyed) continue;
      ctx.fillStyle = s.hp > 2 ? '#888' : s.hp > 1 ? '#666' : '#555';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    }
  }

  function drawPlacedObjects() {
    for (const obj of placedObjects) {
      switch (obj.type) {
        case OBJ_RAMP:
          ctx.fillStyle = '#66a';
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
          ctx.lineTo(obj.x + obj.w, obj.y);
          ctx.closePath();
          ctx.fill();
          break;
        case OBJ_BLOCK:
          ctx.fillStyle = '#a86';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          break;
        case OBJ_SPRING:
          ctx.fillStyle = '#0a0';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.strokeStyle = '#0f0';
          ctx.lineWidth = 2;
          // Spring coil
          for (let i = 0; i < 4; ++i) {
            const sx = obj.x + 5 + i * 8;
            ctx.beginPath();
            ctx.moveTo(sx, obj.y + obj.h);
            ctx.lineTo(sx + 4, obj.y);
            ctx.stroke();
          }
          break;
      }
    }
  }

  function drawProjectile() {
    if (!projectile || !projectile.active) return;

    ctx.fillStyle = '#f80';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#fa0';
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawTrail() {
    for (const p of trailPoints) {
      ctx.globalAlpha = p.life * 0.5;
      ctx.fillStyle = '#fa0';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#fa0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawBuildUI() {
    if (state !== STATE_BUILDING) return;

    const def = LEVELS[currentLevel];
    const barY = CANVAS_H - 50;
    ctx.fillStyle = 'rgba(0,0,40,0.8)';
    ctx.fillRect(0, barY, CANVAS_W, 50);

    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Place objects, then click "Ready" to aim:', 10, barY + 18);

    const types = def.placeable;
    for (let i = 0; i < types.length; ++i) {
      const bx = 10 + i * 90;
      const isSelected = types[i] === selectedPlaceable;
      ctx.fillStyle = isSelected ? '#446' : '#223';
      ctx.fillRect(bx, barY + 24, 80, 22);
      ctx.fillStyle = isSelected ? '#ff0' : '#aaa';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(types[i], bx + 40, barY + 39);
    }

    // Ready button
    const rbx = CANVAS_W - 80;
    ctx.fillStyle = '#060';
    ctx.fillRect(rbx, barY + 24, 70, 22);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ready ▶', rbx + 35, barY + 39);
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fa0';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PHYSICS PUZZLE', CANVAS_W / 2, CANVAS_H / 2 - 50);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Aim and launch projectiles to hit targets!', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign = 'start';
    }

    if (state === STATE_LEVEL_COMPLETE) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TARGET HIT!', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press any key for next level', CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fa0';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ALL LEVELS COMPLETE!', CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      const totalStars = Object.values(levelStars).reduce((a, b) => a + b, 0);
      ctx.fillText(`Total Stars: ${totalStars} / ${LEVELS.length * 3}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'start';
    }

    // Level info (top)
    if (state === STATE_AIMING || state === STATE_PLAYING || state === STATE_BUILDING) {
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Level ${currentLevel + 1}/${LEVELS.length}: ${LEVELS[currentLevel].name}`, CANVAS_W - 10, 18);
      ctx.fillText(`Shots: ${shots} | Best: ${LEVELS[currentLevel].optimal}`, CANVAS_W - 10, 34);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

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

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    ctx.restore();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
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
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Build mode click
    if (state === STATE_BUILDING) {
      const barY = CANVAS_H - 50;
      if (my >= barY) {
        // Check type buttons
        const def = LEVELS[currentLevel];
        for (let i = 0; i < def.placeable.length; ++i) {
          const bx = 10 + i * 90;
          if (mx >= bx && mx <= bx + 80 && my >= barY + 24)
            selectedPlaceable = def.placeable[i];
        }
        // Check ready button
        if (mx >= CANVAS_W - 80 && my >= barY + 24)
          startAimingPhase();
        return;
      }
      // Place object on field
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
    if (!isDragging || state !== STATE_AIMING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const dx = mx - launcher.x;
    const dy = my - launcher.y;
    aimAngle = Math.max(-Math.PI, Math.min(0, Math.atan2(dy, dx)));
    aimPower = Math.max(MIN_POWER, Math.min(MAX_POWER, Math.sqrt(dx * dx + dy * dy) * 2));
  });

  canvas.addEventListener('pointerup', () => {
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

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
