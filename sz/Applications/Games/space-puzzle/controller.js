;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 640;
  const CANVAS_H = 480;
  const MAX_DT = 0.05;
  const LAUNCH_SPEED_SCALE = 3.5;
  const OBJECT_RADIUS = 10;
  const GOAL_RADIUS = 20;
  const WELL_VISUAL_SCALE = 2.5;
  const TRAIL_MAX_LENGTH = 40;
  const STAR_COUNT = 120;
  const CONFETTI_COLORS = ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0', '#f44', '#44f', '#4f4'];

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_AIMING = 'AIMING';
  const STATE_LAUNCHED = 'LAUNCHED';
  const STATE_SOLVED = 'SOLVED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* Storage */
  const STORAGE_PREFIX = 'sz-space-puzzle';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 5;

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
  const elMoves = document.getElementById('statusMoves');
  const elState = document.getElementById('statusState');

  /* ── Game state ── */
  let state = STATE_READY;
  let currentLevel = 0;
  let highScores = [];
  let totalScore = 0;

  /* Drag/aim state */
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragEndX = 0;
  let dragEndY = 0;

  /* Level timer */
  let levelStartTime = 0;
  let elapsed = 0;

  /* Move counter */
  let moveCount = 0;

  /* Launched object */
  let obj = { x: 0, y: 0, vx: 0, vy: 0, active: false };
  let trail = [];

  /* Level data */
  let wells = [];
  let asteroids = [];
  let goal = { x: 0, y: 0 };
  let startPos = { x: 0, y: 0 };

  /* Stars background — varied sizes, some large bright stars */
  const stars = [];
  for (let i = 0; i < STAR_COUNT; ++i) {
    const sizeRoll = Math.random();
    const size = sizeRoll < 0.85 ? Math.random() * 1.2 + 0.4 : Math.random() * 1.5 + 1.5;
    stars.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, s: size, b: Math.random() });
  }

  /* ── Level definitions — 12 handcrafted levels ── */
  // Each level: start, goal, wells (with strength/mass), asteroids, par moves
  const LEVELS = [
    // Level 1: straight shot, no obstacles — spacecraft repair tutorial
    {
      start: { x: 100, y: 240 }, goal: { x: 540, y: 240 }, par: 1,
      wells: [],
      asteroids: [],
      repair: { component: 'Navigation Module' }
    },
    // Level 2: one gravity well bends path
    {
      start: { x: 80, y: 400 }, goal: { x: 560, y: 80 }, par: 1,
      wells: [{ x: 320, y: 240, strength: 4000, mass: 40 }],
      asteroids: [],
      repair: { component: 'Thruster Assembly' }
    },
    // Level 3: asteroid field
    {
      start: { x: 80, y: 240 }, goal: { x: 560, y: 240 }, par: 1,
      wells: [],
      asteroids: [
        { x: 250, y: 200, r: 20 }, { x: 300, y: 300, r: 18 },
        { x: 400, y: 180, r: 22 }, { x: 350, y: 280, r: 16 }
      ],
      repair: { component: 'Hull Plating' }
    },
    // Level 4: gravity well + asteroids
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 2,
      wells: [{ x: 300, y: 240, strength: 3500, mass: 35 }],
      asteroids: [{ x: 450, y: 150, r: 25 }, { x: 200, y: 350, r: 20 }],
      repair: { component: 'Shield Generator' }
    },
    // Level 5: two wells creating a slingshot
    {
      start: { x: 60, y: 240 }, goal: { x: 580, y: 240 }, par: 1,
      wells: [
        { x: 220, y: 160, strength: 3000, mass: 30 },
        { x: 420, y: 320, strength: 3000, mass: 30 }
      ],
      asteroids: [{ x: 320, y: 240, r: 30 }],
      repair: { component: 'Fuel Cell' }
    },
    // Level 6: obstacle course with tight gaps
    {
      start: { x: 60, y: 60 }, goal: { x: 580, y: 420 }, par: 2,
      wells: [{ x: 320, y: 100, strength: 2500, mass: 25 }],
      asteroids: [
        { x: 200, y: 200, r: 40 }, { x: 400, y: 300, r: 35 },
        { x: 150, y: 380, r: 20 }, { x: 500, y: 150, r: 18 }
      ],
      repair: { component: 'Oxygen Recycler' }
    },
    // Level 7: strong central well — orbit required
    {
      start: { x: 60, y: 240 }, goal: { x: 60, y: 100 }, par: 2,
      wells: [{ x: 320, y: 240, strength: 6000, mass: 60 }],
      asteroids: [{ x: 200, y: 100, r: 15 }, { x: 440, y: 380, r: 15 }],
      repair: { component: 'Comm Array' }
    },
    // Level 8: three wells — gravitational maze
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 2,
      wells: [
        { x: 180, y: 180, strength: 2500, mass: 25 },
        { x: 460, y: 320, strength: 3000, mass: 30 },
        { x: 320, y: 120, strength: 2000, mass: 20 }
      ],
      asteroids: [{ x: 280, y: 280, r: 25 }, { x: 400, y: 180, r: 20 }],
      repair: { component: 'Warp Coil' }
    },
    // Level 9: dense asteroid field with weak wells
    {
      start: { x: 60, y: 240 }, goal: { x: 580, y: 240 }, par: 2,
      wells: [
        { x: 200, y: 150, strength: 1500, mass: 15 },
        { x: 450, y: 350, strength: 1500, mass: 15 }
      ],
      asteroids: [
        { x: 180, y: 280, r: 18 }, { x: 260, y: 180, r: 16 },
        { x: 340, y: 300, r: 20 }, { x: 420, y: 200, r: 17 },
        { x: 500, y: 280, r: 15 }, { x: 300, y: 120, r: 22 }
      ],
      repair: { component: 'Sensor Array' }
    },
    // Level 10: final spacecraft repair — all elements combined
    {
      start: { x: 60, y: 60 }, goal: { x: 580, y: 420 }, par: 3,
      wells: [
        { x: 200, y: 300, strength: 4000, mass: 40 },
        { x: 450, y: 150, strength: 3500, mass: 35 },
        { x: 320, y: 400, strength: 2500, mass: 25 }
      ],
      asteroids: [
        { x: 150, y: 180, r: 20 }, { x: 370, y: 260, r: 25 },
        { x: 520, y: 320, r: 18 }, { x: 280, y: 100, r: 15 }
      ],
      repair: { component: 'Main Engine' }
    },
    // Level 11: bonus — repulsive well trick
    {
      start: { x: 320, y: 420 }, goal: { x: 320, y: 60 }, par: 1,
      wells: [
        { x: 160, y: 240, strength: 3000, mass: 30 },
        { x: 480, y: 240, strength: 3000, mass: 30 }
      ],
      asteroids: [
        { x: 320, y: 300, r: 20 }, { x: 250, y: 150, r: 15 },
        { x: 390, y: 150, r: 15 }
      ],
      repair: { component: 'Life Support' }
    },
    // Level 12: gauntlet — maximal difficulty
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 3,
      wells: [
        { x: 160, y: 160, strength: 4000, mass: 40 },
        { x: 480, y: 340, strength: 4500, mass: 45 },
        { x: 320, y: 240, strength: 3000, mass: 30 },
        { x: 400, y: 100, strength: 2000, mass: 20 }
      ],
      asteroids: [
        { x: 240, y: 300, r: 22 }, { x: 400, y: 200, r: 20 },
        { x: 160, y: 380, r: 18 }, { x: 500, y: 120, r: 16 },
        { x: 300, y: 350, r: 15 }, { x: 440, y: 280, r: 19 }
      ],
      repair: { component: 'Quantum Core' }
    }
  ];

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

  function addHighScore(s) {
    highScores.push({ score: s, level: currentLevel + 1, date: Date.now() });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  /* ── Load level ── */
  function loadLevel(idx) {
    if (idx >= LEVELS.length) {
      // All levels complete — game over with victory
      state = STATE_GAME_OVER;
      addHighScore(totalScore);
      updateTitle();
      return;
    }

    const lvl = LEVELS[idx];
    currentLevel = idx;
    startPos = { x: lvl.start.x, y: lvl.start.y };
    goal = { x: lvl.goal.x, y: lvl.goal.y };
    wells = lvl.wells.map(w => ({ ...w }));
    asteroids = lvl.asteroids.map(a => ({ ...a, glow: Math.random() * Math.PI * 2 }));
    moveCount = 0;
    elapsed = 0;
    levelStartTime = performance.now();
    trail = [];
    resetObject();
    state = STATE_PLAYING;
    updateTitle();
  }

  function resetObject() {
    obj.x = startPos.x;
    obj.y = startPos.y;
    obj.vx = 0;
    obj.vy = 0;
    obj.active = false;
    trail = [];
    state = STATE_PLAYING;
  }

  /* ── Rating calculation ── */
  function calculateRating(moves, par) {
    if (moves <= par) return 3; // 3 stars — perfect
    if (moves <= par + 1) return 2; // 2 stars — good
    return 1; // 1 star — completed
  }

  function ratingToStars(rating) {
    return '\u2605'.repeat(rating) + '\u2606'.repeat(3 - rating);
  }

  /* ── Physics update ── */
  function update(dt) {
    if (state === STATE_LAUNCHED) {
      // Apply gravity from each well
      for (const well of wells) {
        const dx = well.x - obj.x;
        const dy = well.y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) continue;
        const force = well.strength / (dist * dist);
        obj.vx += (dx / dist) * force * dt;
        obj.vy += (dy / dist) * force * dt;
      }

      // Update position
      obj.x += obj.vx * dt;
      obj.y += obj.vy * dt;

      // Trail — asteroid glow trail effect
      trail.push({ x: obj.x, y: obj.y, age: 0 });
      if (trail.length > TRAIL_MAX_LENGTH)
        trail.shift();
      for (const t of trail)
        t.age += dt;

      // Check goal — object reached goal zone
      const gDx = obj.x - goal.x;
      const gDy = obj.y - goal.y;
      if (Math.sqrt(gDx * gDx + gDy * gDy) < GOAL_RADIUS + OBJECT_RADIUS)
        puzzleSolved();

      // Check asteroid collision — bounce off
      for (const ast of asteroids) {
        const aDx = obj.x - ast.x;
        const aDy = obj.y - ast.y;
        const aDist = Math.sqrt(aDx * aDx + aDy * aDy);
        if (aDist < ast.r + OBJECT_RADIUS) {
          // Reflect velocity — asteroid collision bounce
          const nx = aDx / aDist;
          const ny = aDy / aDist;
          const dot = obj.vx * nx + obj.vy * ny;
          obj.vx -= 2 * dot * nx * 0.8;
          obj.vy -= 2 * dot * ny * 0.8;
          // Push out of collision
          obj.x = ast.x + nx * (ast.r + OBJECT_RADIUS + 1);
          obj.y = ast.y + ny * (ast.r + OBJECT_RADIUS + 1);
          // Impact effects
          screenShake.trigger(4, 0.2);
          particles.burst(obj.x, obj.y, 8, { color: '#ff8844', life: 0.4, speed: 40 });
        }
      }

      // Check well collision — fail
      for (const well of wells) {
        const wDx = obj.x - well.x;
        const wDy = obj.y - well.y;
        if (Math.sqrt(wDx * wDx + wDy * wDy) < 12) {
          // Absorbed by gravity well — object lost, reset
          screenShake.trigger(8, 0.4);
          particles.burst(well.x, well.y, 15, { color: '#8844ff', life: 0.6, speed: 50 });
          floatingText.add(well.x, well.y - 20, 'Absorbed!', { color: '#ff4444' });
          resetObject();
        }
      }

      // Check out of bounds — object missed, off-screen reset
      if (obj.x < -50 || obj.x > CANVAS_W + 50 || obj.y < -50 || obj.y > CANVAS_H + 50) {
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Miss!', { color: '#ff6644' });
        resetObject();
      }
    }

    // Update elapsed time
    if (state === STATE_PLAYING || state === STATE_AIMING || state === STATE_LAUNCHED)
      elapsed = (performance.now() - levelStartTime) / 1000;

    particles.update(dt);
    screenShake.update(dt);
    floatingText.update(dt);
  }

  /* ── Puzzle solved ── */
  function puzzleSolved() {
    state = STATE_SOLVED;
    const rating = calculateRating(moveCount, LEVELS[currentLevel].par);
    const stars = ratingToStars(rating);
    const levelScore = rating * 100 + Math.max(0, Math.floor(300 - elapsed * 10));
    totalScore += levelScore;

    // Spacecraft repair progress — component found!
    const repairComponent = LEVELS[currentLevel].repair.component;
    floatingText.add(goal.x, goal.y - 30, repairComponent + ' repaired!', { color: '#00ffaa' });
    floatingText.add(goal.x, goal.y - 50, stars + ' (' + levelScore + ' pts)', { color: '#ffd700' });

    // Solution-reveal particle cascade — confetti celebration
    for (let i = 0; i < 8; ++i) {
      const cx = goal.x + (Math.random() - 0.5) * 100;
      const cy = goal.y + (Math.random() - 0.5) * 80;
      particles.burst(cx, cy, 12, {
        color: CONFETTI_COLORS[i],
        life: 1.0, speed: 60
      });
    }
    screenShake.trigger(6, 0.3);
    updateTitle();

    // Advance to next level after delay
    setTimeout(() => {
      if (state === STATE_SOLVED)
        loadLevel(currentLevel + 1);
    }, 2000);
  }

  /* ── Toggle pause ── */
  function togglePause() {
    if (state === STATE_PLAYING || state === STATE_AIMING || state === STATE_LAUNCHED) {
      state = STATE_PAUSED;
    } else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
  }

  /* ── Reset game ── */
  function resetGame() {
    totalScore = 0;
    loadLevel(0);
    particles.clear();
    floatingText.clear();
  }

  /* ── Title ── */
  function updateTitle() {
    const title = state === STATE_GAME_OVER
      ? `Space Puzzle - All Levels Complete! (Score: ${totalScore})`
      : `Space Puzzle - Level ${currentLevel + 1} - Score: ${totalScore}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  /* ── Rendering ── */
  function draw() {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    ctx.save();
    screenShake.apply(ctx);

    // Deep space background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Nebula patches — large semi-transparent colored blobs behind everything
    ctx.save();
    const nebulaPatches = [
      { x: 150, y: 120, r: 130, color: 'rgba(80,40,120,0.06)' },
      { x: 480, y: 350, r: 110, color: 'rgba(40,80,120,0.05)' },
      { x: 320, y: 400, r: 100, color: 'rgba(120,40,60,0.04)' },
      { x: 530, y: 100, r: 90, color: 'rgba(40,120,80,0.05)' }
    ];
    for (const neb of nebulaPatches) {
      const nebGrad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      nebGrad.addColorStop(0, neb.color);
      nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Twinkling stars — enhanced with varied sizes and glow
    const now = Date.now() / 1000;
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(now * 2 + star.b * 10);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      const size = star.s;
      if (size > 1.5) {
        // Larger stars get a faint glow halo
        ctx.save();
        ctx.globalAlpha = twinkle * 0.25;
        ctx.fillStyle = '#aaccff';
        ctx.beginPath();
        ctx.arc(star.x + size * 0.5, star.y + size * 0.5, size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#fff';
        ctx.fillRect(star.x, star.y, size, size);
      } else
        ctx.fillRect(star.x, star.y, size, size);
    }
    ctx.globalAlpha = 1;

    // Shooting stars — occasional fast-moving streaks
    ctx.save();
    const shootingEpoch = Math.floor(Date.now() / 3000);
    for (let si = 0; si < 3; ++si) {
      const seed = shootingEpoch * 7 + si * 131;
      const sx = ((seed * 37) % CANVAS_W);
      const sy = ((seed * 53) % CANVAS_H);
      const angle = 0.6 + si * 0.3;
      const len = 30 + (seed % 40);
      const progress = (Date.now() % 3000) / 3000;
      const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = '#cceeff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + progress * 80, sy + progress * 40);
      ctx.lineTo(sx + progress * 80 + Math.cos(angle) * len, sy + progress * 40 + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Gravity wells — distortion ripple effect with glow, spirals, and orbital debris
    for (const well of wells) {
      const wellRadius = Math.sqrt(well.mass) * WELL_VISUAL_SCALE;
      const wellRotation = Date.now() / 2000;

      // Gravitational lensing hint — faint dashed circle at full influence radius
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#8866ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(well.x, well.y, wellRadius * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Gravity well distortion rings
      for (let r = 3; r >= 1; --r) {
        const rr = wellRadius * r * 0.8 + Math.sin(now * 3 + r) * 3;
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.05 * r;
        ctx.strokeStyle = '#6644cc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(well.x, well.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Animated spiral inside well radius
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#9977ee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s < 60; ++s) {
        const t = s / 60;
        const spiralAngle = wellRotation + t * Math.PI * 4;
        const spiralR = t * wellRadius * 0.9;
        const sx = well.x + Math.cos(spiralAngle) * spiralR;
        const sy = well.y + Math.sin(spiralAngle) * spiralR;
        if (s === 0)
          ctx.moveTo(sx, sy);
        else
          ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      // Orbital debris — 3 small dots orbiting at different speeds/radii
      ctx.save();
      for (let d = 0; d < 3; ++d) {
        const orbitSpeed = 1500 + d * 700;
        const orbitRadius = wellRadius * (0.4 + d * 0.25);
        const orbitAngle = Date.now() / orbitSpeed + d * 2.1;
        const dx = well.x + Math.cos(orbitAngle) * orbitRadius;
        const dy = well.y + Math.sin(orbitAngle) * orbitRadius;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#aa88ff';
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Well core glow — stronger event horizon gradient
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#8866ff';
      const grad = ctx.createRadialGradient(well.x, well.y, 1, well.x, well.y, wellRadius * 0.6);
      grad.addColorStop(0, 'rgba(180,140,255,0.95)');
      grad.addColorStop(0.2, 'rgba(136,102,255,0.7)');
      grad.addColorStop(0.5, 'rgba(100,60,200,0.3)');
      grad.addColorStop(1, 'rgba(68,34,136,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(well.x, well.y, wellRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // Well center dot
      ctx.fillStyle = '#ddbbff';
      ctx.beginPath();
      ctx.arc(well.x, well.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Asteroids — irregular polygon with rotation, shadow, texture, and craters
    for (const ast of asteroids) {
      ctx.save();
      const astSeed = ast.x * 7 + ast.y * 13;
      const astRotation = Date.now() / 3000 + astSeed * 0.1;
      const vertexCount = 8;

      // Build irregular polygon vertices
      const vertices = [];
      for (let vi = 0; vi < vertexCount; ++vi) {
        const jitter = ((astSeed + vi * 31) % 17) / 17 * 0.4;
        const vr = ast.r * (0.8 + jitter);
        const va = (vi / vertexCount) * Math.PI * 2;
        vertices.push({ x: Math.cos(va) * vr, y: Math.sin(va) * vr });
      }

      ctx.translate(ast.x, ast.y);
      ctx.rotate(astRotation);

      // Shadow — darker half to suggest lighting direction
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let vi = 1; vi < vertexCount; ++vi)
        ctx.lineTo(vertices[vi].x, vertices[vi].y);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, -ast.r * 1.5, ast.r * 1.5, ast.r * 3);
      ctx.restore();

      // Main asteroid body — irregular polygon
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#886644';
      ctx.fillStyle = '#665544';
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let vi = 1; vi < vertexCount; ++vi)
        ctx.lineTo(vertices[vi].x, vertices[vi].y);
      ctx.closePath();
      ctx.fill();

      // Surface texture — noise-like dots with slightly different shade
      ctx.shadowBlur = 0;
      const textureDots = [
        { ox: -0.15, oy: 0.25, sr: 0.08, color: '#776655' },
        { ox: 0.3, oy: -0.15, sr: 0.06, color: '#554433' },
        { ox: -0.25, oy: -0.3, sr: 0.07, color: '#7a6b5a' },
        { ox: 0.1, oy: 0.35, sr: 0.05, color: '#605040' }
      ];
      for (const td of textureDots) {
        ctx.fillStyle = td.color;
        ctx.beginPath();
        ctx.arc(td.ox * ast.r, td.oy * ast.r, ast.r * td.sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crater details (kept from original, adjusted for rotated context)
      ctx.fillStyle = '#554433';
      ctx.beginPath();
      ctx.arc(-ast.r * 0.3, -ast.r * 0.2, ast.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ast.r * 0.2, ast.r * 0.3, ast.r * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Goal zone — pulsing target with rotating ring, beacon pulse, and inner glow
    ctx.save();
    const goalPulse = 0.5 + 0.5 * Math.sin(now * 4);
    const goalGlowIntensity = 0.3 + 0.2 * Math.sin(Date.now() / 800);

    // Inner glow gradient — pulses in intensity
    const goalGrad = ctx.createRadialGradient(goal.x, goal.y, 0, goal.x, goal.y, GOAL_RADIUS);
    goalGrad.addColorStop(0, `rgba(0, 255, 136, ${goalGlowIntensity})`);
    goalGrad.addColorStop(0.6, `rgba(0, 200, 100, ${goalGlowIntensity * 0.4})`);
    goalGrad.addColorStop(1, 'rgba(0, 150, 80, 0)');
    ctx.fillStyle = goalGrad;
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, GOAL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Beacon pulse — expanding circle that fades every 2 seconds
    const beaconPhase = (Date.now() % 2000) / 2000;
    const beaconRadius = GOAL_RADIUS + beaconPhase * GOAL_RADIUS * 1.5;
    const beaconAlpha = (1 - beaconPhase) * 0.5;
    ctx.globalAlpha = beaconAlpha;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, beaconRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Rotating outer ring — dashed pattern that slowly rotates
    ctx.save();
    ctx.translate(goal.x, goal.y);
    ctx.rotate(Date.now() / 2000);
    ctx.shadowBlur = 10 + goalPulse * 8;
    ctx.shadowColor = '#00ff88';
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + goalPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, GOAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Inner ring (static)
    ctx.shadowBlur = 10 + goalPulse * 8;
    ctx.shadowColor = '#00ff88';
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + goalPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, GOAL_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Goal label — spacecraft repair objective target
    ctx.fillStyle = '#00ff88';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REPAIR', goal.x, goal.y + GOAL_RADIUS + 14);
    ctx.textAlign = 'start';
    ctx.restore();

    // Trail — object glow trail with engine glow dots
    if (trail.length > 1) {
      ctx.save();
      for (let i = 1; i < trail.length; ++i) {
        const alpha = (i / trail.length) * 0.6;
        ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.lineWidth = 2 + (i / trail.length) * 2;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      // Engine trail glowing dots — 6 dots at evenly spaced trail positions
      const dotCount = 6;
      for (let d = 0; d < dotCount; ++d) {
        const idx = Math.floor((d / dotCount) * trail.length);
        if (idx >= trail.length) continue;
        const t = trail[idx];
        const dotAlpha = (1 - d / dotCount) * 0.7;
        const dotRadius = (1 - d / dotCount) * 3 + 1;
        ctx.globalAlpha = dotAlpha;
        ctx.fillStyle = '#88ddff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Launched object — ship/arrow shape facing velocity direction
    if (obj.active || state === STATE_LAUNCHED) {
      ctx.save();
      const shipAngle = Math.atan2(obj.vy, obj.vx);
      ctx.translate(obj.x, obj.y);
      ctx.rotate(shipAngle);
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#44aaff';
      // Ship body — arrowhead triangle
      ctx.fillStyle = '#66ccff';
      ctx.beginPath();
      ctx.moveTo(OBJECT_RADIUS, 0);
      ctx.lineTo(-OBJECT_RADIUS * 0.7, -OBJECT_RADIUS * 0.6);
      ctx.lineTo(-OBJECT_RADIUS * 0.3, 0);
      ctx.lineTo(-OBJECT_RADIUS * 0.7, OBJECT_RADIUS * 0.6);
      ctx.closePath();
      ctx.fill();
      // Ship cockpit highlight
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(OBJECT_RADIUS * 0.3, 0, OBJECT_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Engine glow at the back
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff8844';
      ctx.fillStyle = 'rgba(255,150,50,0.7)';
      ctx.beginPath();
      ctx.arc(-OBJECT_RADIUS * 0.5, 0, OBJECT_RADIUS * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (state === STATE_PLAYING || state === STATE_AIMING) {
      // Probe at start position — ship shape pointing upward
      ctx.save();
      ctx.translate(startPos.x, startPos.y);
      ctx.rotate(-Math.PI / 2); // point upward
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#44aaff';
      // Ship body — arrowhead triangle
      ctx.fillStyle = '#66ccff';
      ctx.beginPath();
      ctx.moveTo(OBJECT_RADIUS, 0);
      ctx.lineTo(-OBJECT_RADIUS * 0.7, -OBJECT_RADIUS * 0.6);
      ctx.lineTo(-OBJECT_RADIUS * 0.3, 0);
      ctx.lineTo(-OBJECT_RADIUS * 0.7, OBJECT_RADIUS * 0.6);
      ctx.closePath();
      ctx.fill();
      // Ship cockpit highlight
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(OBJECT_RADIUS * 0.3, 0, OBJECT_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Aim direction indicator — arrow line while isDragging
    if (isDragging && (state === STATE_PLAYING || state === STATE_AIMING)) {
      const launchDx = dragStartX - dragEndX;
      const launchDy = dragStartY - dragEndY;
      const launchDist = Math.sqrt(launchDx * launchDx + launchDy * launchDy);
      if (launchDist > 5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        const arrowLen = Math.min(launchDist * LAUNCH_SPEED_SCALE * 0.3, 120);
        const nx = launchDx / launchDist;
        const ny = launchDy / launchDist;
        ctx.lineTo(startPos.x + nx * arrowLen, startPos.y + ny * arrowLen);
        ctx.stroke();
        // Arrow head
        ctx.setLineDash([]);
        const headX = startPos.x + nx * arrowLen;
        const headY = startPos.y + ny * arrowLen;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - nx * 8 - ny * 5, headY - ny * 8 + nx * 5);
        ctx.lineTo(headX - nx * 8 + ny * 5, headY - ny * 8 - nx * 5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.fill();
        ctx.restore();
      }
    }

    // Effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);
    ctx.restore(); // end shake

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, 22);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`Level: ${currentLevel + 1}/${LEVELS.length}  Moves: ${moveCount}  Time: ${elapsed.toFixed(1)}s  Score: ${totalScore}`, 6, 15);

    // Level repair objective info
    if (currentLevel < LEVELS.length) {
      const repairInfo = LEVELS[currentLevel].repair.component;
      ctx.fillStyle = '#66ffaa';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Repair: ' + repairInfo, CANVAS_W - 6, 15);
      ctx.textAlign = 'start';
    }

    // Status bar
    if (elScore) elScore.textContent = 'Score: ' + totalScore;
    if (elLevel) elLevel.textContent = 'Level: ' + (currentLevel + 1);
    if (elMoves) elMoves.textContent = 'Moves: ' + moveCount;
    if (elState) elState.textContent = state === STATE_PAUSED ? 'Paused' : state === STATE_SOLVED ? 'Solved!' : state === STATE_GAME_OVER ? 'Complete!' : 'Playing';

    // Overlays
    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign = 'start';
    } else if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#66ffaa';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPACECRAFT FULLY REPAIRED!', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Total Score: ' + totalScore + '  |  Tap or press F2 for New Game', CANVAS_W / 2, CANVAS_H / 2 + 15);
      ctx.textAlign = 'start';
    } else if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#66aaff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE PUZZLE', CANVAS_W / 2, CANVAS_H / 2 - 25);
      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.fillText('Drag from the probe to launch it toward the repair goal', CANVAS_W / 2, CANVAS_H / 2 + 5);
      ctx.fillText('Press F2 or click New Game to start', CANVAS_W / 2, CANVAS_H / 2 + 25);
      ctx.textAlign = 'start';
    }
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

  /* ── Pointer input for drag & launch ── */
  canvas.addEventListener('pointerdown', (e) => {
    // Click to start from READY or restart from GAME_OVER
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      resetGame();
      return;
    }

    if (state !== STATE_PLAYING && state !== STATE_AIMING) return;
    if (obj.active) return;

    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    // Must click near the object start position to begin aiming
    const distToObj = Math.sqrt((mx - startPos.x) ** 2 + (my - startPos.y) ** 2);
    if (distToObj > 40) return;

    isDragging = true;
    dragStartX = mx;
    dragStartY = my;
    dragEndX = mx;
    dragEndY = my;
    state = STATE_AIMING;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    dragEndX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    dragEndY = (e.clientY - rect.top) * (CANVAS_H / rect.height);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    // Compute launchSpeed from drag distance and direction
    const launchDx = dragStartX - dragEndX;
    const launchDy = dragStartY - dragEndY;
    const launchDist = Math.sqrt(launchDx * launchDx + launchDy * launchDy);

    if (launchDist < 10) {
      state = STATE_PLAYING;
      return;
    }

    // Launch the object with launchForce based on drag
    const launchForce = launchDist * LAUNCH_SPEED_SCALE;
    const launchSpeed = Math.min(launchForce, 500);
    obj.x = startPos.x;
    obj.y = startPos.y;
    obj.vx = (launchDx / launchDist) * launchSpeed;
    obj.vy = (launchDy / launchDist) * launchSpeed;
    obj.active = true;
    ++moveCount;
    state = STATE_LAUNCHED;

    particles.burst(startPos.x, startPos.y, 6, { color: '#44aaff', life: 0.3, speed: 30 });
  });

  /* ── Keyboard input ── */
  document.addEventListener('keydown', (e) => {
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

    // R to retry current level
    if (e.key === 'r' || e.key === 'R') {
      if (state === STATE_PLAYING || state === STATE_LAUNCHED || state === STATE_AIMING) {
        resetObject();
        moveCount = 0;
        levelStartTime = performance.now();
        state = STATE_PLAYING;
      }
    }
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
  loadLevel(0);
  state = STATE_READY;
  updateTitle();
  handleResize();
  requestAnimationFrame(gameLoop);

})();
