;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const PLAYER_SPEED = 160;
  const PLAYER_SIZE = 16;
  const DOOR_W = 32;
  const DOOR_H = 48;
  const TILE = 40;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_EXPLORING = 'EXPLORING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-mind-puzzle';
  const STORAGE_PROGRESS = STORAGE_PREFIX + '-progress';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── Perspective modes ── */
  const VIEW_NORMAL = 0;
  const VIEW_FLIPPED = 1;
  const VIEW_ROTATED = 2;

  /* ══════════════════════════════════════════════════════════════════
     ROOM DATA — 17 surreal rooms with hidden rules
     Each room has: name, rule (hidden), doors/portals, objects, colors
     Doors can lead to non-sequential rooms (non-Euclidean connections)
     ══════════════════════════════════════════════════════════════════ */

  const ROOMS = [
    { name: 'The Entrance', rule: 'Walk through the only door', ruleHint: 'Doors lead somewhere...', color: '#1a1a2e', accentColor: '#4a90d9',
      portals: [{ x: 600, y: 200, w: DOOR_W, h: DOOR_H, target: 1 }],
      objects: [], playerStart: { x: 100, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Mirror Hall', rule: 'Movement is reversed horizontally', ruleHint: 'Things are not what they seem...', color: '#1e1e3a', accentColor: '#d94a90',
      portals: [{ x: 600, y: 200, w: DOOR_W, h: DOOR_H, target: 2 }, { x: 50, y: 400, w: DOOR_W, h: DOOR_H, target: 0 }],
      objects: [{ x: 350, y: 250, w: 20, h: 20, type: 'clue' }], playerStart: { x: 350, y: 400 }, viewMode: VIEW_FLIPPED },
    { name: 'Gravity Shift', rule: 'Perspective rotation changes gravity', ruleHint: 'Try a new angle...', color: '#2e1a1a', accentColor: '#d9c84a',
      portals: [{ x: 350, y: 30, w: DOOR_W, h: DOOR_H, target: 3 }],
      objects: [{ x: 200, y: 300, w: 80, h: 20, type: 'platform' }], playerStart: { x: 100, y: 400 }, viewMode: VIEW_ROTATED },
    { name: 'Infinite Corridor', rule: 'Walking right loops you back', ruleHint: 'Are you going in circles?', color: '#1a2e1a', accentColor: '#4ad990',
      portals: [{ x: 650, y: 400, w: DOOR_W, h: DOOR_H, target: 3 }, { x: 350, y: 100, w: DOOR_W, h: DOOR_H, target: 4 }],
      objects: [{ x: 300, y: 350, w: 20, h: 20, type: 'clue' }], playerStart: { x: 50, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Color Chamber', rule: 'Walk on matching color tiles only', ruleHint: 'Watch your step...', color: '#2a1a3e', accentColor: '#d94aff',
      portals: [{ x: 600, y: 100, w: DOOR_W, h: DOOR_H, target: 5 }],
      objects: [{ x: 150, y: 300, w: TILE, h: TILE, type: 'colorTile', tileColor: '#d94aff' }, { x: 300, y: 200, w: TILE, h: TILE, type: 'colorTile', tileColor: '#d94aff' }, { x: 450, y: 150, w: TILE, h: TILE, type: 'colorTile', tileColor: '#d94aff' }],
      playerStart: { x: 80, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Shadow Room', rule: 'Only doors visible in shadows are real', ruleHint: 'Trust the darkness...', color: '#0a0a0a', accentColor: '#667788',
      portals: [{ x: 500, y: 300, w: DOOR_W, h: DOOR_H, target: 6 }, { x: 200, y: 100, w: DOOR_W, h: DOOR_H, target: 3 }],
      objects: [{ x: 350, y: 250, w: 40, h: 40, type: 'shadow' }], playerStart: { x: 100, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Echoing Void', rule: 'Interact with echoes of yourself', ruleHint: 'You are not alone...', color: '#1a1a40', accentColor: '#00ccff',
      portals: [{ x: 600, y: 400, w: DOOR_W, h: DOOR_H, target: 7 }],
      objects: [{ x: 350, y: 250, w: 20, h: 20, type: 'echo' }], playerStart: { x: 100, y: 250 }, viewMode: VIEW_NORMAL },
    { name: 'Penrose Steps', rule: 'Stairs loop forever unless you shift perspective', ruleHint: 'Step back and look again...', color: '#2e2e1a', accentColor: '#ffd700',
      portals: [{ x: 600, y: 80, w: DOOR_W, h: DOOR_H, target: 8 }],
      objects: [{ x: 100, y: 100, w: 500, h: 20, type: 'stairPlatform' }, { x: 100, y: 200, w: 500, h: 20, type: 'stairPlatform' }, { x: 100, y: 300, w: 500, h: 20, type: 'stairPlatform' }],
      playerStart: { x: 80, y: 400 }, viewMode: VIEW_ROTATED },
    { name: 'Whispering Walls', rule: 'Walls shift when you are not looking', ruleHint: 'Turn around...', color: '#301a30', accentColor: '#ff66aa',
      portals: [{ x: 350, y: 30, w: DOOR_W, h: DOOR_H, target: 9 }],
      objects: [{ x: 200, y: 150, w: 20, h: 200, type: 'wall' }, { x: 500, y: 150, w: 20, h: 200, type: 'wall' }],
      playerStart: { x: 350, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Tesseract', rule: 'Four exits lead to the same room from different angles', ruleHint: 'Which dimension are you in?', color: '#0a1a2e', accentColor: '#44ffdd',
      portals: [{ x: 650, y: 250, w: DOOR_W, h: DOOR_H, target: 10 }, { x: 10, y: 250, w: DOOR_W, h: DOOR_H, target: 10 }, { x: 330, y: 10, w: DOOR_W, h: DOOR_H, target: 10 }, { x: 330, y: 440, w: DOOR_W, h: DOOR_H, target: 10 }],
      objects: [], playerStart: { x: 350, y: 250 }, viewMode: VIEW_NORMAL },
    { name: 'Reality Fracture', rule: 'Walking through the fracture warps reality', ruleHint: 'The crack calls to you...', color: '#1a0a1a', accentColor: '#ff4444',
      portals: [{ x: 600, y: 400, w: DOOR_W, h: DOOR_H, target: 11 }],
      objects: [{ x: 350, y: 100, w: 8, h: 300, type: 'fracture' }], playerStart: { x: 100, y: 250 }, viewMode: VIEW_NORMAL },
    { name: 'Time Loop', rule: 'Objects reset every few seconds unless placed correctly', ruleHint: 'Hurry, or start over...', color: '#2e1a2e', accentColor: '#ff8800',
      portals: [{ x: 600, y: 200, w: DOOR_W, h: DOOR_H, target: 12 }],
      objects: [{ x: 300, y: 300, w: 20, h: 20, type: 'clue' }], playerStart: { x: 80, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Phantom Bridge', rule: 'Bridges appear only when you believe they are there', ruleHint: 'Have faith...', color: '#1a1a2e', accentColor: '#88ff44',
      portals: [{ x: 600, y: 100, w: DOOR_W, h: DOOR_H, target: 13 }],
      objects: [{ x: 250, y: 250, w: 200, h: 10, type: 'phantomBridge' }], playerStart: { x: 80, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Möbius Strip', rule: 'The room is its own mirror, flipped on return', ruleHint: 'Everything twists...', color: '#2e2a1a', accentColor: '#ddaa44',
      portals: [{ x: 600, y: 400, w: DOOR_W, h: DOOR_H, target: 14 }],
      objects: [], playerStart: { x: 100, y: 400 }, viewMode: VIEW_FLIPPED },
    { name: 'Quantum Door', rule: 'The door changes destination when observed', ruleHint: 'Look away and back...', color: '#1a2e2e', accentColor: '#44ddff',
      portals: [{ x: 350, y: 80, w: DOOR_W, h: DOOR_H, target: 15 }, { x: 500, y: 300, w: DOOR_W, h: DOOR_H, target: 12 }],
      objects: [{ x: 200, y: 200, w: 20, h: 20, type: 'clue' }], playerStart: { x: 100, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'Void Nexus', rule: 'All paths converge here if you found the pattern', ruleHint: 'The pattern reveals itself...', color: '#0a0a20', accentColor: '#ffffff',
      portals: [{ x: 350, y: 200, w: DOOR_W, h: DOOR_H, target: 16 }],
      objects: [{ x: 350, y: 350, w: 30, h: 30, type: 'nexusOrb' }], playerStart: { x: 100, y: 400 }, viewMode: VIEW_NORMAL },
    { name: 'The Awakening', rule: 'Reach the center to awaken', ruleHint: 'You are almost free...', color: '#2e2e2e', accentColor: '#ffd700',
      portals: [],
      objects: [{ x: 330, y: 230, w: 40, h: 40, type: 'goal' }], playerStart: { x: 100, y: 400 }, viewMode: VIEW_NORMAL }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusRoom = document.getElementById('statusRoom');
  const statusDiscovered = document.getElementById('statusDiscovered');
  const statusProgress = document.getElementById('statusProgress');
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
  let currentRoom = 0;
  let player = { x: 100, y: 400 };
  let discoveredRules = {};
  let roomsVisited = {};
  let highScores = [];
  let startTime = 0;
  let elapsedTime = 0;

  /* ── Input ── */
  const keys = {};

  /* ── Perspective / view transition ── */
  let currentView = VIEW_NORMAL;
  let transitionProgress = 1;
  let transitionTo = VIEW_NORMAL;
  let shiftTimer = 0;

  /* ── Warp effect ── */
  let warpActive = false;
  let warpEffect = 0;
  let waveAmplitude = 0;

  /* ── Ambient particles ── */
  let ambientTimer = 0;

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
      if (raw) {
        const data = JSON.parse(raw);
        discoveredRules = data.discovered || {};
        roomsVisited = data.visited || {};
        currentRoom = data.currentRoom || 0;
      }
    } catch (_) {
      discoveredRules = {};
      roomsVisited = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify({
        discovered: discoveredRules,
        visited: roomsVisited,
        currentRoom
      }));
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

  function addHighScore(room, time) {
    highScores.push({ room: room + 1, time: Math.round(time) });
    highScores.sort((a, b) => a.time - b.time || a.room - b.room);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].room}</td><td>${highScores[i].time}s</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     ROOM LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadRoom(index) {
    if (index < 0 || index >= ROOMS.length) return;

    currentRoom = index;
    const def = ROOMS[currentRoom];

    player.x = def.playerStart.x;
    player.y = def.playerStart.y;

    currentView = def.viewMode;
    transitionProgress = 1;
    transitionTo = currentView;

    warpActive = false;
    warpEffect = 0;
    waveAmplitude = 0;
    ambientTimer = 0;

    roomsVisited[currentRoom] = true;
    state = STATE_EXPLORING;
    updateWindowTitle();
    saveProgress();
  }

  function nextRoom() {
    if (currentRoom + 1 < ROOMS.length)
      loadRoom(currentRoom + 1);
    else {
      state = STATE_GAME_OVER;
      elapsedTime = (performance.now() - startTime) / 1000;
      addHighScore(currentRoom, elapsedTime);
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'ALL ROOMS COMPLETE!', { color: '#ffd700', font: 'bold 20px sans-serif' });
      particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40, { speed: 6, gravity: 0.08 });
      updateWindowTitle();
    }
  }

  function resetAndStart() {
    startTime = performance.now();
    discoveredRules = {};
    roomsVisited = {};
    loadRoom(0);
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSPECTIVE SHIFTING
     ══════════════════════════════════════════════════════════════════ */

  function shiftPerspective() {
    transitionTo = (currentView + 1) % 3;
    transitionProgress = 0;
    shiftTimer = 0;

    screenShake.trigger(4, 150);
    floatingText.add(CANVAS_W / 2, 40, 'Perspective Shift!', { color: '#ff0', font: 'bold 14px sans-serif' });
    particles.burst(CANVAS_W / 2, CANVAS_H / 2, 15, { color: '#88f', speed: 3, life: 0.6 });
  }

  function updateTransition(dt) {
    if (transitionProgress < 1) {
      shiftTimer += dt;
      // Ease-in-out with smoothstep
      const t = Math.min(shiftTimer / 0.5, 1);
      transitionProgress = t * t * (3 - 2 * t);
      if (transitionProgress >= 1) {
        transitionProgress = 1;
        currentView = transitionTo;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     REALITY WARP
     ══════════════════════════════════════════════════════════════════ */

  function triggerWarp() {
    warpActive = true;
    warpEffect = 1;
    waveAmplitude = 15;
    screenShake.trigger(6, 300);
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Reality Warped!', { color: '#f44', font: 'bold 16px sans-serif' });
    particles.burst(player.x, player.y, 20, { color: '#f04', speed: 5, life: 0.8 });
  }

  function updateWarp(dt) {
    if (warpActive) {
      warpEffect -= dt * 1.5;
      waveAmplitude *= 0.95;
      if (warpEffect <= 0) {
        warpActive = false;
        warpEffect = 0;
        waveAmplitude = 0;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AMBIENT ATMOSPHERICS
     ══════════════════════════════════════════════════════════════════ */

  function updateAmbient(dt) {
    ambientTimer += dt;
    if (ambientTimer >= 0.15) {
      ambientTimer = 0;
      const def = ROOMS[currentRoom];
      const rx = Math.random() * CANVAS_W;
      const ry = Math.random() * CANVAS_H;
      particles.trail(rx, ry, { color: def.accentColor || '#446', life: 1.5, size: 1.5 });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     RULE DISCOVERY
     ══════════════════════════════════════════════════════════════════ */

  function discoverRule() {
    if (discoveredRules[currentRoom]) return;
    discoveredRules[currentRoom] = true;
    saveProgress();

    const def = ROOMS[currentRoom];
    particles.sparkle(player.x, player.y - 20, 12, { color: '#ff0', speed: 3 });
    particles.burst(player.x, player.y, 15, { color: def.accentColor, speed: 4, life: 0.6 });
    floatingText.add(player.x, player.y - 30, 'Rule Discovered!', { color: '#0f0', font: 'bold 14px sans-serif' });
    screenShake.trigger(3, 100);
  }

  /* ══════════════════════════════════════════════════════════════════
     COLLISION & INTERACTION
     ══════════════════════════════════════════════════════════════════ */

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function checkPortals() {
    const def = ROOMS[currentRoom];
    if (!def.portals || def.portals.length === 0) return;
    for (const p of def.portals) {
      if (rectOverlap(player.x - PLAYER_SIZE / 2, player.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, p.x, p.y, p.w, p.h)) {
        triggerWarp();
        discoverRule();
        loadRoom(p.target);
        return;
      }
    }
  }

  function checkObjects() {
    const def = ROOMS[currentRoom];
    for (const obj of def.objects) {
      if (!rectOverlap(player.x - PLAYER_SIZE / 2, player.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, obj.x, obj.y, obj.w, obj.h))
        continue;

      if (obj.type === 'clue') {
        discoverRule();
        floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#ff0', font: '11px sans-serif' });
      } else if (obj.type === 'goal') {
        discoverRule();
        completeGame();
      }
    }
  }

  function completeGame() {
    state = STATE_GAME_OVER;
    elapsedTime = (performance.now() - startTime) / 1000;
    addHighScore(currentRoom, elapsedTime);

    particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50, { speed: 6, gravity: 0.08 });
    particles.burst(CANVAS_W / 2, CANVAS_H / 2, 25, { color: '#ffd700', speed: 5, life: 1 });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AWAKENED!', { color: '#ffd700', font: 'bold 24px sans-serif' });
    screenShake.trigger(8, 400);
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER MOVEMENT
     ══════════════════════════════════════════════════════════════════ */

  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx = -1;
    if (keys['ArrowRight'] || keys['KeyD']) dx = 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy = -1;
    if (keys['ArrowDown'] || keys['KeyS']) dy = 1;

    // Normalize diagonal
    if (dx && dy) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }

    // Mirror room: reverse horizontal
    const def = ROOMS[currentRoom];
    if (def.viewMode === VIEW_FLIPPED)
      dx = -dx;

    player.x += dx * PLAYER_SPEED * dt;
    player.y += dy * PLAYER_SPEED * dt;

    // Clamp to canvas
    player.x = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_W - PLAYER_SIZE / 2, player.x));
    player.y = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_H - PLAYER_SIZE / 2, player.y));
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state !== STATE_EXPLORING) return;

    updatePlayer(dt);
    updateTransition(dt);
    updateWarp(dt);
    updateAmbient(dt);
    checkPortals();
    checkObjects();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawRoom() {
    const def = ROOMS[currentRoom];

    // Room background
    ctx.fillStyle = def.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Warp distortion overlay
    if (warpActive) {
      const time = performance.now() / 200;
      for (let y = 0; y < CANVAS_H; y += 4) {
        const offset = Math.sin(y * 0.05 + time) * waveAmplitude * warpEffect;
        ctx.save();
        ctx.translate(offset, 0);
        ctx.globalAlpha = 0.03;
        ctx.fillStyle = def.accentColor;
        ctx.fillRect(0, y, CANVAS_W, 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Perspective transition visual
    if (transitionProgress < 1) {
      ctx.save();
      const scale = 0.8 + 0.2 * transitionProgress;
      const rotation = (1 - transitionProgress) * Math.PI * 0.1;
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
    }

    // Draw grid lines for atmosphere
    ctx.strokeStyle = def.accentColor + '22';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // Objects
    for (const obj of def.objects) {
      switch (obj.type) {
        case 'clue':
          ctx.fillStyle = '#ff0';
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#ff0';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.shadowBlur = 0;
          break;
        case 'platform':
        case 'stairPlatform':
          ctx.fillStyle = '#555';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          break;
        case 'wall':
          ctx.fillStyle = '#444';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          break;
        case 'colorTile':
          ctx.fillStyle = obj.tileColor || '#888';
          ctx.globalAlpha = 0.6;
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.globalAlpha = 1;
          break;
        case 'shadow':
          ctx.fillStyle = '#000';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.globalAlpha = 1;
          break;
        case 'fracture':
          ctx.strokeStyle = '#f00';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#f00';
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          for (let fy = obj.y; fy < obj.y + obj.h; fy += 10) {
            ctx.lineTo(obj.x + (Math.random() - 0.5) * 6, fy);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        case 'phantomBridge':
          ctx.fillStyle = def.accentColor;
          ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 500) * 0.2;
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.globalAlpha = 1;
          break;
        case 'nexusOrb':
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#fff';
          ctx.beginPath();
          ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'echo':
          ctx.fillStyle = '#00ccff';
          ctx.globalAlpha = 0.4;
          ctx.fillRect(obj.x, obj.y, PLAYER_SIZE, PLAYER_SIZE);
          ctx.globalAlpha = 1;
          break;
        case 'goal':
          ctx.fillStyle = '#ffd700';
          ctx.shadowBlur = 16;
          ctx.shadowColor = '#ffd700';
          ctx.beginPath();
          ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
      }
    }

    // Portals / Doors
    if (def.portals) {
      for (const p of def.portals) {
        ctx.fillStyle = def.accentColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = def.accentColor;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.shadowBlur = 0;

        // Door glow pulse
        const pulse = 0.5 + Math.sin(performance.now() / 400) * 0.3;
        ctx.strokeStyle = def.accentColor;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
        ctx.globalAlpha = 1;
      }
    }

    if (transitionProgress < 1)
      ctx.restore();
  }

  function drawPlayer() {
    // Player glow
    ctx.fillStyle = '#0af';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0af';
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#88f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MIND-BENDING PUZZLE', CANVAS_W / 2, CANVAS_H / 2 - 50);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Discover hidden rules in surreal rooms', CANVAS_W / 2, CANVAS_H / 2 - 10);
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

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AWAKENED', CANVAS_W / 2, CANVAS_H / 2 - 40);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      const discovered = Object.keys(discoveredRules).length;
      ctx.fillText(`Rules Discovered: ${discovered} / ${ROOMS.length}`, CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 30);
      ctx.textAlign = 'start';
    }

    // Room info HUD (top)
    if (state === STATE_EXPLORING) {
      const def = ROOMS[currentRoom];
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Room ${currentRoom + 1}/${ROOMS.length}: ${def.name}`, CANVAS_W - 10, 18);

      // Show rule hint if discovered
      if (discoveredRules[currentRoom]) {
        ctx.fillStyle = '#0f0';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Rule: ${def.rule}`, CANVAS_W - 10, 34);
      } else {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.fillText('Rule: ???', CANVAS_W - 10, 34);
      }
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_EXPLORING || state === STATE_GAME_OVER) {
      drawRoom();
      drawPlayer();
    }

    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusRoom) statusRoom.textContent = `Room: ${currentRoom + 1}/${ROOMS.length}`;
    const discovered = Object.keys(discoveredRules).length;
    if (statusDiscovered) statusDiscovered.textContent = `Discovered: ${discovered}/${ROOMS.length}`;
    const visited = Object.keys(roomsVisited).length;
    if (statusProgress) statusProgress.textContent = `Visited: ${visited}/${ROOMS.length}`;
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
      resetAndStart();
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_EXPLORING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_EXPLORING;
      return;
    }

    // Perspective shift
    if (e.code === 'KeyQ' && state === STATE_EXPLORING) {
      shiftPerspective();
      return;
    }

    // Interact
    if ((e.code === 'KeyE' || e.code === 'Space') && state === STATE_EXPLORING) {
      checkPortals();
      checkObjects();
      return;
    }

    if (state === STATE_GAME_OVER)
      resetAndStart();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_READY || state === STATE_GAME_OVER)
      resetAndStart();
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        resetAndStart();
        break;
      case 'pause':
        if (state === STATE_EXPLORING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_EXPLORING;
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
    const roomName = ROOMS[currentRoom]?.name || '';
    const title = state === STATE_GAME_OVER
      ? 'Mind-Bending Puzzle — Awakened!'
      : `Mind-Bending Puzzle — Room ${currentRoom + 1}: ${roomName}`;
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
