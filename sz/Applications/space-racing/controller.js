;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_RACE_OVER = 'RACE_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-racing';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 5;

  /* ── Ship physics ── */
  const SHIP_ACCEL = 320;
  const SHIP_BRAKE = 200;
  const SHIP_FRICTION = 0.985;
  const SHIP_TURN_SPEED = 3.0;
  const SHIP_MAX_SPEED = 400;
  const SHIP_RADIUS = 10;

  /* ── Boost ── */
  const BOOST_SPEED_MULT = 1.8;
  const BOOST_DURATION = 1.5;

  /* ── Race ── */
  const TOTAL_LAPS = 3;
  const NUM_OPPONENTS = 3;
  const CHECKPOINT_RADIUS = 40;

  /* ── AI ── */
  const AI_ACCEL = 280;
  const AI_TURN_SPEED = 2.8;
  const AI_SPEED_VARIANCE = 0.15;

  /* ══════════════════════════════════════════════════════════════════
     TRACK DEFINITIONS (5+ tracks)
     ══════════════════════════════════════════════════════════════════ */

  const TRACK_DEFS = [
    {
      name: 'Nebula Circuit',
      color: '#224',
      checkpoints: [
        { x: 350, y: 100 }, { x: 600, y: 200 }, { x: 550, y: 400 },
        { x: 200, y: 450 }, { x: 100, y: 250 }
      ],
      boostPads: [{ x: 480, y: 150, angle: 0.8 }],
      hazards: [{ x: 400, y: 300, radius: 20, type: 'asteroid' }],
      startX: 250, startY: 100, startAngle: 0
    },
    {
      name: 'Ion Storm Speedway',
      color: '#214',
      checkpoints: [
        { x: 350, y: 80 }, { x: 650, y: 150 }, { x: 650, y: 400 },
        { x: 350, y: 480 }, { x: 50, y: 400 }, { x: 50, y: 150 }
      ],
      boostPads: [{ x: 500, y: 120, angle: 0.4 }, { x: 200, y: 440, angle: 3.5 }],
      hazards: [
        { x: 350, y: 280, radius: 25, type: 'barrier' },
        { x: 600, y: 300, radius: 18, type: 'asteroid' }
      ],
      startX: 200, startY: 80, startAngle: 0
    },
    {
      name: 'Pulsar Drift',
      color: '#142',
      checkpoints: [
        { x: 350, y: 60 }, { x: 620, y: 180 }, { x: 500, y: 380 },
        { x: 200, y: 420 }, { x: 80, y: 220 }
      ],
      boostPads: [{ x: 560, y: 280, angle: 2.2 }],
      hazards: [
        { x: 300, y: 250, radius: 22, type: 'asteroid' },
        { x: 450, y: 200, radius: 16, type: 'barrier' }
      ],
      startX: 220, startY: 60, startAngle: 0.3
    },
    {
      name: 'Quasar Loop',
      color: '#221',
      checkpoints: [
        { x: 350, y: 70 }, { x: 630, y: 120 }, { x: 670, y: 350 },
        { x: 450, y: 470 }, { x: 200, y: 470 }, { x: 50, y: 300 },
        { x: 100, y: 120 }
      ],
      boostPads: [
        { x: 500, y: 90, angle: 0.2 },
        { x: 100, y: 210, angle: 4.5 }
      ],
      hazards: [
        { x: 550, y: 240, radius: 20, type: 'asteroid' },
        { x: 320, y: 470, radius: 24, type: 'barrier' },
        { x: 150, y: 400, radius: 18, type: 'asteroid' }
      ],
      startX: 220, startY: 70, startAngle: 0
    },
    {
      name: 'Supernova Ring',
      color: '#312',
      checkpoints: [
        { x: 350, y: 50 }, { x: 600, y: 100 }, { x: 680, y: 280 },
        { x: 550, y: 450 }, { x: 350, y: 490 }, { x: 150, y: 450 },
        { x: 30, y: 280 }, { x: 100, y: 100 }
      ],
      boostPads: [
        { x: 470, y: 75, angle: 0.3 },
        { x: 640, y: 380, angle: 2.5 },
        { x: 75, y: 190, angle: 4.7 }
      ],
      hazards: [
        { x: 350, y: 270, radius: 30, type: 'barrier' },
        { x: 500, y: 180, radius: 18, type: 'asteroid' },
        { x: 200, y: 380, radius: 20, type: 'asteroid' }
      ],
      startX: 220, startY: 50, startAngle: 0
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusPosition = document.getElementById('statusPosition');
  const statusLap = document.getElementById('statusLap');
  const statusSpeed = document.getElementById('statusSpeed');
  const statusTime = document.getElementById('statusTime');
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
  let currentTrackIndex = 0;
  let track = TRACK_DEFS[0];

  // Player ship
  let ship = { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0 };
  let boostTimer = 0;
  let boostActive = false;

  // Camera
  let camX = 0;
  let camY = 0;

  // Race state
  let playerCheckpoint = 0;
  let playerLap = 0;
  let raceTime = 0;
  let playerPlace = 1;
  let raceFinished = false;

  // AI opponents
  let opponents = [];

  // Speed-line effect
  let speedLines = [];

  // High scores
  let highScores = [];

  // Input
  const keys = {};

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

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(time, trackName) {
    highScores.push({ time, track: trackName });
    highScores.sort((a, b) => a.time - b.time);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${formatTime(highScores[i].time)}</td><td>${highScores[i].track}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  function formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  function resetGame() {
    track = TRACK_DEFS[currentTrackIndex];

    ship.x = track.startX;
    ship.y = track.startY;
    ship.angle = track.startAngle;
    ship.speed = 0;
    ship.vx = 0;
    ship.vy = 0;
    boostTimer = 0;
    boostActive = false;

    camX = ship.x - CANVAS_W / 2;
    camY = ship.y - CANVAS_H / 2;

    playerCheckpoint = 0;
    playerLap = 0;
    raceTime = 0;
    playerPlace = 1;
    raceFinished = false;

    // Create AI opponents
    opponents = [];
    for (let i = 0; i < NUM_OPPONENTS; ++i) {
      const speedFactor = 1 - AI_SPEED_VARIANCE + Math.random() * AI_SPEED_VARIANCE * 2;
      opponents.push({
        x: track.startX + (i + 1) * 25,
        y: track.startY + (i + 1) * 15,
        angle: track.startAngle,
        speed: 0,
        vx: 0,
        vy: 0,
        checkpoint: 0,
        lap: 0,
        speedFactor,
        color: ['#f55', '#fa0', '#5f5'][i] || '#f55',
        finished: false,
        finishTime: 0
      });
    }

    speedLines = [];
    state = STATE_PLAYING;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     SHIP PHYSICS
     ══════════════════════════════════════════════════════════════════ */

  function updateShip(dt) {
    if (state !== STATE_PLAYING) return;

    // Steering
    if (keys['ArrowLeft'] || keys['KeyA'])
      ship.angle -= SHIP_TURN_SPEED * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      ship.angle += SHIP_TURN_SPEED * dt;

    // Acceleration / braking
    const maxSpeed = boostActive ? SHIP_MAX_SPEED * BOOST_SPEED_MULT : SHIP_MAX_SPEED;
    if (keys['ArrowUp'] || keys['KeyW']) {
      ship.vx += Math.cos(ship.angle) * SHIP_ACCEL * dt;
      ship.vy += Math.sin(ship.angle) * SHIP_ACCEL * dt;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      ship.vx -= Math.cos(ship.angle) * SHIP_BRAKE * dt;
      ship.vy -= Math.sin(ship.angle) * SHIP_BRAKE * dt;
    }

    // Friction
    ship.vx *= SHIP_FRICTION;
    ship.vy *= SHIP_FRICTION;

    // Clamp speed
    ship.speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (ship.speed > maxSpeed) {
      const ratio = maxSpeed / ship.speed;
      ship.vx *= ratio;
      ship.vy *= ratio;
      ship.speed = maxSpeed;
    }

    // Move
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // Clamp within world bounds
    if (ship.x < 0) ship.x = 0;
    if (ship.y < 0) ship.y = 0;
    if (ship.x > CANVAS_W) ship.x = CANVAS_W;
    if (ship.y > CANVAS_H) ship.y = CANVAS_H;

    // Boost timer
    if (boostActive) {
      boostTimer -= dt;
      if (boostTimer <= 0) {
        boostActive = false;
        boostTimer = 0;
      }
      // Boost flame trail particles
      particles.trail(
        ship.x - Math.cos(ship.angle) * 14,
        ship.y - Math.sin(ship.angle) * 14,
        { color: '#f80', speed: 1.5, life: 0.4, count: 2 }
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI OPPONENTS
     ══════════════════════════════════════════════════════════════════ */

  function updateAI(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if (ai.finished) continue;

      // steerToward next checkpoint
      const targetCP = track.checkpoints[ai.checkpoint];
      const dx = targetCP.x - ai.x;
      const dy = targetCP.y - ai.y;
      const targetAngle = Math.atan2(dy, dx);

      // Smooth steering
      let angleDiff = targetAngle - ai.angle;
      while (angleDiff > Math.PI) angleDiff -= TWO_PI;
      while (angleDiff < -Math.PI) angleDiff += TWO_PI;

      if (angleDiff > 0)
        ai.angle += Math.min(AI_TURN_SPEED * dt, angleDiff);
      else
        ai.angle += Math.max(-AI_TURN_SPEED * dt, angleDiff);

      // Accelerate toward waypoint
      const accel = AI_ACCEL * ai.speedFactor;
      ai.vx += Math.cos(ai.angle) * accel * dt;
      ai.vy += Math.sin(ai.angle) * accel * dt;

      // Friction
      ai.vx *= SHIP_FRICTION;
      ai.vy *= SHIP_FRICTION;

      // Clamp speed
      ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
      const aiMax = SHIP_MAX_SPEED * ai.speedFactor;
      if (ai.speed > aiMax) {
        const ratio = aiMax / ai.speed;
        ai.vx *= ratio;
        ai.vy *= ratio;
        ai.speed = aiMax;
      }

      // Move
      ai.x += ai.vx * dt;
      ai.y += ai.vy * dt;

      // Check checkpoint crossing
      const distToCP = Math.sqrt(dx * dx + dy * dy);
      if (distToCP < CHECKPOINT_RADIUS) {
        ++ai.checkpoint;
        if (ai.checkpoint >= track.checkpoints.length) {
          ai.checkpoint = 0;
          ++ai.lap;
          if (ai.lap >= TOTAL_LAPS) {
            ai.finished = true;
            ai.finishTime = raceTime;
          }
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CHECKPOINT / LAP / FINISH
     ══════════════════════════════════════════════════════════════════ */

  function updateRace(dt) {
    if (state !== STATE_PLAYING || raceFinished) return;

    raceTime += dt;

    // Check player checkpoint
    const cp = track.checkpoints[playerCheckpoint];
    const dx = cp.x - ship.x;
    const dy = cp.y - ship.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CHECKPOINT_RADIUS) {
      ++playerCheckpoint;
      if (playerCheckpoint >= track.checkpoints.length) {
        playerCheckpoint = 0;
        ++playerLap;
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, `Lap ${playerLap}/${TOTAL_LAPS}`, {
          color: '#ff0',
          font: 'bold 18px sans-serif'
        });
        if (playerLap >= TOTAL_LAPS)
          finishRace();
      }
    }

    // Calculate position/placement
    let place = 1;
    const playerProgress = playerLap * track.checkpoints.length + playerCheckpoint;
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      const aiProgress = ai.lap * track.checkpoints.length + ai.checkpoint;
      if (aiProgress > playerProgress)
        ++place;
    }
    playerPlace = place;
  }

  function finishRace() {
    raceFinished = true;
    state = STATE_RACE_OVER;

    // Determine final placement
    let finalPlace = 1;
    for (let i = 0; i < opponents.length; ++i)
      if (opponents[i].finished && opponents[i].finishTime < raceTime)
        ++finalPlace;

    playerPlace = finalPlace;

    const resultText = `${getOrdinal(finalPlace)} Place — ${formatTime(raceTime)}`;
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2, resultText, {
      color: finalPlace <= 3 ? '#ff0' : '#fff',
      font: 'bold 22px sans-serif'
    });

    // Confetti for podium finishes (1st, 2nd, 3rd)
    if (finalPlace <= 3) {
      for (let i = 0; i < 60; ++i) {
        const cx = CANVAS_W / 2 + (Math.random() - 0.5) * 200;
        const cy = CANVAS_H / 2 + (Math.random() - 0.5) * 100;
        particles.burst(cx, cy, 3, {
          color: ['#f44', '#ff0', '#4f4', '#44f', '#f4f', '#0ff'][Math.floor(Math.random() * 6)],
          speed: 2 + Math.random() * 3,
          life: 1.5 + Math.random()
        });
      }
    }

    addHighScore(raceTime, track.name);
    updateWindowTitle();
  }

  function getOrdinal(n) {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return n + 'th';
  }

  /* ══════════════════════════════════════════════════════════════════
     BOOST PADS
     ══════════════════════════════════════════════════════════════════ */

  function checkBoostPads() {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < track.boostPads.length; ++i) {
      const pad = track.boostPads[i];
      const dx = pad.x - ship.x;
      const dy = pad.y - ship.y;
      if (dx * dx + dy * dy < 30 * 30) {
        boostActive = true;
        boostTimer = BOOST_DURATION;
        floatingText.add(ship.x, ship.y - 20, 'BOOST!', {
          color: '#0ff',
          font: 'bold 16px sans-serif'
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HAZARD COLLISIONS
     ══════════════════════════════════════════════════════════════════ */

  function checkHazards() {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < track.hazards.length; ++i) {
      const h = track.hazards[i];
      const dx = h.x - ship.x;
      const dy = h.y - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < h.radius + SHIP_RADIUS) {
        // Collision! Speed penalty
        ship.speed *= 0.4;
        ship.vx *= 0.4;
        ship.vy *= 0.4;

        // Push ship away
        const pushAngle = Math.atan2(-dy, -dx);
        ship.x += Math.cos(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);
        ship.y += Math.sin(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);

        // Collision spark particles
        particles.burst(ship.x, ship.y, 12, {
          color: '#ff0',
          speed: 3,
          life: 0.3
        });

        // Screen shake on crash
        screenShake.trigger(8, 300);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SPEED-LINE EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  function updateSpeedLines() {
    const ratio = ship.speed / SHIP_MAX_SPEED;
    if (ratio > 0.5 && state === STATE_PLAYING) {
      const count = Math.floor(ratio * 4);
      for (let i = 0; i < count; ++i) {
        speedLines.push({
          x: Math.random() * CANVAS_W,
          y: Math.random() * CANVAS_H,
          len: 10 + ratio * 30,
          alpha: 0.2 + ratio * 0.4,
          life: 0.15 + Math.random() * 0.1
        });
      }
    }

    for (let i = speedLines.length - 1; i >= 0; --i) {
      speedLines[i].life -= 0.016;
      if (speedLines[i].life <= 0)
        speedLines.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CAMERA
     ══════════════════════════════════════════════════════════════════ */

  function updateCamera() {
    // Smooth camera follow via lerp
    const targetX = ship.x - CANVAS_W / 2;
    const targetY = ship.y - CANVAS_H / 2;
    camX += (targetX - camX) * 0.08;
    camY += (targetY - camY) * 0.08;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state === STATE_PAUSED) return;

    updateShip(dt);
    updateAI(dt);
    checkBoostPads();
    checkHazards();
    updateRace(dt);
    updateCamera();
    updateSpeedLines();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawTrack() {
    // Background
    ctx.fillStyle = track.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; ++i) {
      const sx = ((i * 137 + 50) % CANVAS_W);
      const sy = ((i * 191 + 80) % CANVAS_H);
      ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Track path (connect checkpoints)
    ctx.strokeStyle = '#556';
    ctx.lineWidth = 50;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(track.checkpoints[0].x, track.checkpoints[0].y);
    for (let i = 1; i < track.checkpoints.length; ++i)
      ctx.lineTo(track.checkpoints[i].x, track.checkpoints[i].y);
    ctx.closePath();
    ctx.stroke();

    // Track borders with glow
    ctx.strokeStyle = '#889';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#88f';
    ctx.beginPath();
    ctx.moveTo(track.checkpoints[0].x, track.checkpoints[0].y);
    for (let i = 1; i < track.checkpoints.length; ++i)
      ctx.lineTo(track.checkpoints[i].x, track.checkpoints[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Checkpoints
    for (let i = 0; i < track.checkpoints.length; ++i) {
      const cp = track.checkpoints[i];
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 6, 0, TWO_PI);
      ctx.fillStyle = i === playerCheckpoint ? '#0f0' : '#555';
      ctx.fill();
    }

    // Finish line at first checkpoint
    const fp = track.checkpoints[0];
    ctx.fillStyle = '#fff';
    ctx.fillRect(fp.x - 12, fp.y - 2, 24, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(fp.x - 12, fp.y - 2, 6, 2);
    ctx.fillRect(fp.x, fp.y - 2, 6, 2);
    ctx.fillRect(fp.x - 6, fp.y, 6, 2);
    ctx.fillRect(fp.x + 6, fp.y, 6, 2);
  }

  function drawBoostPads() {
    for (let i = 0; i < track.boostPads.length; ++i) {
      const pad = track.boostPads[i];
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);
      ctx.fillStyle = '#0ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#0ff';
      ctx.fillRect(-15, -5, 30, 10);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('>>>', 0, 0);
      ctx.restore();
    }
  }

  function drawHazards() {
    for (let i = 0; i < track.hazards.length; ++i) {
      const h = track.hazards[i];
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, TWO_PI);
      if (h.type === 'barrier') {
        ctx.fillStyle = '#f22';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f00';
      } else {
        ctx.fillStyle = '#665';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#aa8';
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Detail
      if (h.type === 'asteroid') {
        ctx.fillStyle = '#887';
        ctx.beginPath();
        ctx.arc(h.x - 3, h.y - 2, h.radius * 0.3, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  function drawShip(x, y, angle, color, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Ship body
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();

    ctx.fillStyle = color;
    if (isPlayer) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
    }
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Thruster flame
    if (isPlayer && (keys['ArrowUp'] || keys['KeyW'])) {
      ctx.fillStyle = '#f80';
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(-12 - Math.random() * 6, 0);
      ctx.lineTo(-5, 3);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawSpeedLines() {
    for (let i = 0; i < speedLines.length; ++i) {
      const sl = speedLines[i];
      ctx.strokeStyle = `rgba(255,255,255,${sl.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y);
      ctx.lineTo(sl.x - Math.cos(ship.angle) * sl.len, sl.y - Math.sin(ship.angle) * sl.len);
      ctx.stroke();
    }
  }

  function drawHUD() {
    // Minimap
    const mmW = 120;
    const mmH = 80;
    const mmX = CANVAS_W - mmW - 8;
    const mmY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Track on minimap
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mmX + track.checkpoints[0].x / CANVAS_W * mmW, mmY + track.checkpoints[0].y / CANVAS_H * mmH);
    for (let i = 1; i < track.checkpoints.length; ++i)
      ctx.lineTo(mmX + track.checkpoints[i].x / CANVAS_W * mmW, mmY + track.checkpoints[i].y / CANVAS_H * mmH);
    ctx.closePath();
    ctx.stroke();

    // Player dot
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(mmX + ship.x / CANVAS_W * mmW, mmY + ship.y / CANVAS_H * mmH, 3, 0, TWO_PI);
    ctx.fill();

    // AI dots
    for (let i = 0; i < opponents.length; ++i) {
      ctx.fillStyle = opponents[i].color;
      ctx.beginPath();
      ctx.arc(mmX + opponents[i].x / CANVAS_W * mmW, mmY + opponents[i].y / CANVAS_H * mmH, 2, 0, TWO_PI);
      ctx.fill();
    }

    // Race info overlay
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(track.name, CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.font = '16px sans-serif';
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign = 'start';
    }

    if (state === STATE_RACE_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Race Complete — ${getOrdinal(playerPlace)} Place`, CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Time: ${formatTime(raceTime)}`, CANVAS_W / 2, CANVAS_H / 2 + 15);
      ctx.font = '13px sans-serif';
      ctx.fillText('Tap or press F2 for next track', CANVAS_W / 2, CANVAS_H / 2 + 45);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    drawTrack();
    drawBoostPads();
    drawHazards();

    // Draw AI opponents
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      drawShip(ai.x, ai.y, ai.angle, ai.color, false);
    }

    // Draw player ship
    drawShip(ship.x, ship.y, ship.angle, '#4af', true);

    drawSpeedLines();
    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusPosition) statusPosition.textContent = `Pos: ${getOrdinal(playerPlace)}`;
    if (statusLap) statusLap.textContent = `Lap: ${Math.min(playerLap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`;
    if (statusSpeed) statusSpeed.textContent = `Speed: ${Math.round(ship.speed)}`;
    if (statusTime) statusTime.textContent = `Time: ${formatTime(raceTime)}`;
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
    keys[e.code] = true;

    if (e.code === 'F2') {
      e.preventDefault();
      if (state === STATE_RACE_OVER)
        currentTrackIndex = (currentTrackIndex + 1) % TRACK_DEFS.length;
      resetGame();
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Click/Tap to start ── */
  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_READY || state === STATE_RACE_OVER) {
      if (state === STATE_RACE_OVER)
        currentTrackIndex = (currentTrackIndex + 1) % TRACK_DEFS.length;
      resetGame();
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        currentTrackIndex = (currentTrackIndex + 1) % TRACK_DEFS.length;
        resetGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
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
    const title = state === STATE_RACE_OVER
      ? `Space Racing — ${getOrdinal(playerPlace)} Place — ${track.name}`
      : `Space Racing — ${track.name}`;
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
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
