;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  let canvasW = 700;
  let canvasH = 500;
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
    if (currentRoom + 1 < ROOMS.length) {
      loadRoom(currentRoom + 1);
      SZ.GameAudio.play('levelup');
    } else {
      state = STATE_GAME_OVER;
      elapsedTime = (performance.now() - startTime) / 1000;
      addHighScore(currentRoom, elapsedTime);
      floatingText.add(canvasW / 2, canvasH / 2 - 40, 'ALL ROOMS COMPLETE!', { color: '#ffd700', font: 'bold 20px sans-serif' });
      particles.confetti(canvasW / 2, canvasH / 2, 40, { speed: 6, gravity: 0.08 });
      updateWindowTitle();
      SZ.GameAudio.play('win');
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

  // standing on a fracture re-triggers every frame; keep its sound to one
  const lastSoundAt = {};
  function playThrottled(name, opts) {
    const now = performance.now();
    if (now - (lastSoundAt[name] || 0) < 600)
      return;
    lastSoundAt[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  function shiftPerspective() {
    transitionTo = (currentView + 1) % 3;
    transitionProgress = 0;
    shiftTimer = 0;

    screenShake.trigger(4, 150);
    floatingText.add(canvasW / 2, 40, 'Perspective Shift!', { color: '#ff0', font: 'bold 14px sans-serif' });
    particles.burst(canvasW / 2, canvasH / 2, 15, { color: '#88f', speed: 3, life: 0.6 });
    playThrottled('whoosh', { pitch: 0.8 + transitionTo * 0.25 });
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
    floatingText.add(canvasW / 2, canvasH / 2, 'Reality Warped!', { color: '#f44', font: 'bold 16px sans-serif' });
    particles.burst(player.x, player.y, 20, { color: '#f04', speed: 5, life: 0.8 });
    playThrottled('zap', { pitch: 0.6 });
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
      const rx = Math.random() * canvasW;
      const ry = Math.random() * canvasH;
      particles.trail(rx, ry, { color: def.accentColor || '#446', life: 1.5, size: 1.5 });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     RULE DISCOVERY
     ══════════════════════════════════════════════════════════════════ */

  function discoverRule() {
    if (discoveredRules[currentRoom]) return false;
    discoveredRules[currentRoom] = true;
    saveProgress();

    const def = ROOMS[currentRoom];
    particles.sparkle(player.x, player.y - 20, 12, { color: '#ff0', speed: 3 });
    particles.burst(player.x, player.y, 15, { color: def.accentColor, speed: 4, life: 0.6 });
    floatingText.add(player.x, player.y - 30, 'Rule Discovered!', { color: '#0f0', font: 'bold 14px sans-serif' });
    screenShake.trigger(3, 100);
    SZ.GameAudio.play('pickup');
    return true;
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

  let touchedHint = null;
  let hintTouchedNow = false;

  function touchHint(obj) {
    hintTouchedNow = true;
    if (!discoverRule() && obj !== touchedHint)
      SZ.GameAudio.play('blip', { volume: 0.6 });
    touchedHint = obj;
  }

  function checkObjects() {
    const def = ROOMS[currentRoom];
    const half = PLAYER_SIZE / 2;
    hintTouchedNow = false;

    for (const obj of def.objects) {
      if (!rectOverlap(player.x - half, player.y - half, PLAYER_SIZE, PLAYER_SIZE, obj.x, obj.y, obj.w, obj.h))
        continue;

      switch (obj.type) {
        case 'clue':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#ff0', font: '11px sans-serif' });
          break;

        case 'goal':
          discoverRule();
          completeGame();
          break;

        case 'fracture':
          discoverRule();
          triggerWarp();
          shiftPerspective();
          break;

        case 'echo':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#0cf', font: '11px sans-serif' });
          particles.burst(obj.x + obj.w / 2, obj.y + obj.h / 2, 10, { color: '#00ccff', speed: 3, life: 0.5 });
          break;

        case 'nexusOrb':
          discoverRule();
          floatingText.add(obj.x, obj.y - 15, 'The Nexus responds...', { color: '#fff', font: 'bold 12px sans-serif' });
          particles.sparkle(obj.x + obj.w / 2, obj.y + obj.h / 2, 15, { color: '#fff', speed: 4 });
          nextRoom();
          break;

        case 'shadow':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#678', font: '11px sans-serif' });
          break;

        case 'colorTile':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: obj.tileColor || '#ff0', font: '11px sans-serif' });
          break;

        case 'phantomBridge':
          touchHint(obj);
          floatingText.add(obj.x + obj.w / 2, obj.y - 15, def.ruleHint, { color: '#8f4', font: '11px sans-serif' });
          break;
      }
    }
    if (!hintTouchedNow)
      touchedHint = null;
  }

  function completeGame() {
    state = STATE_GAME_OVER;
    elapsedTime = (performance.now() - startTime) / 1000;
    addHighScore(currentRoom, elapsedTime);

    particles.confetti(canvasW / 2, canvasH / 2, 50, { speed: 6, gravity: 0.08 });
    particles.burst(canvasW / 2, canvasH / 2, 25, { color: '#ffd700', speed: 5, life: 1 });
    floatingText.add(canvasW / 2, canvasH / 2 - 60, 'AWAKENED!', { color: '#ffd700', font: 'bold 24px sans-serif' });
    screenShake.trigger(8, 400);
    updateWindowTitle();
    SZ.GameAudio.play('win');
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER MOVEMENT
     ══════════════════════════════════════════════════════════════════ */

  function isSolid(obj) {
    return obj.type === 'wall' || obj.type === 'platform' || obj.type === 'stairPlatform';
  }

  function resolveCollisions() {
    const def = ROOMS[currentRoom];
    const half = PLAYER_SIZE / 2;

    for (const obj of def.objects) {
      if (!isSolid(obj))
        continue;

      const px = player.x - half;
      const py = player.y - half;
      if (!rectOverlap(px, py, PLAYER_SIZE, PLAYER_SIZE, obj.x, obj.y, obj.w, obj.h))
        continue;

      // Compute overlap on each axis and push out by the smallest penetration
      const overlapLeft = (px + PLAYER_SIZE) - obj.x;
      const overlapRight = (obj.x + obj.w) - px;
      const overlapTop = (py + PLAYER_SIZE) - obj.y;
      const overlapBottom = (obj.y + obj.h) - py;

      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);

      if (minX < minY) {
        if (overlapLeft < overlapRight)
          player.x = obj.x - half;
        else
          player.x = obj.x + obj.w + half;
      } else {
        if (overlapTop < overlapBottom)
          player.y = obj.y - half;
        else
          player.y = obj.y + obj.h + half;
      }
    }
  }

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

    // Move on X axis and resolve collisions, then Y axis separately
    // This prevents corner-clipping and allows sliding along walls
    player.x += dx * PLAYER_SPEED * dt;
    player.x = Math.max(PLAYER_SIZE / 2, Math.min(canvasW - PLAYER_SIZE / 2, player.x));
    resolveCollisions();

    player.y += dy * PLAYER_SPEED * dt;
    player.y = Math.max(PLAYER_SIZE / 2, Math.min(canvasH - PLAYER_SIZE / 2, player.y));
    resolveCollisions();
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

  /* ── Drawing helpers ── */
  const UI = {
    panelTop: 'rgba(30,28,60,',
    panelBottom: 'rgba(14,12,32,',
    text: '#eef0ff',
    textDim: 'rgba(225,228,255,0.62)',
    gold: '#ffd76a',
    good: '#7dffb2',
    font: '"Segoe UI", system-ui, sans-serif'
  };

  function shade(hex, amount) {
    const n = parseInt(hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3').slice(1) : hex.slice(1, 7), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function withAlpha(hex, a) {
    const full = shade(hex, 0);
    const n = parseInt(full.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function panel(x, y, w, h, alpha, accent) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    roundRectPath(x, y, w, h, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, UI.panelTop + alpha + ')');
    g.addColorStop(1, UI.panelBottom + alpha + ')');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = accent ? withAlpha(accent, 0.55) : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function centeredText(text, y, font, color, glow) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, canvasW / 2, y);
    ctx.restore();
  }

  function pill(text, y, color) {
    ctx.save();
    ctx.font = 'bold 14px ' + UI.font;
    const w = ctx.measureText(text).width + 36;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 350);
    roundRectPath(canvasW / 2 - w / 2, y - 16, w, 32, 16);
    ctx.fillStyle = withAlpha(color, 0.16 + 0.1 * pulse);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.5 + 0.4 * pulse);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasW / 2, y + 1);
    ctx.restore();
  }

  /* Floor: soft-lit room with tiles, seams in the room's accent and a vignette */
  function drawFloor(def) {
    const base = def.color;
    const g = ctx.createRadialGradient(canvasW / 2, canvasH / 2, 40, canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75);
    g.addColorStop(0, shade(base, 0.16));
    g.addColorStop(1, shade(base, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Checkered floor tiles
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < canvasH; y += TILE)
      for (let x = ((y / TILE) % 2) * TILE; x < canvasW; x += TILE * 2)
        ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = withAlpha(def.accentColor, 0.09);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < canvasW; x += TILE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
    }
    for (let y = 0.5; y < canvasH; y += TILE) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
    }
    ctx.stroke();

    // Room border: a recessed frame
    ctx.strokeStyle = withAlpha(def.accentColor, 0.25);
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, canvasW - 12, canvasH - 12);

    const v = ctx.createRadialGradient(canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.35, canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  /* Beveled stone block with a cast shadow */
  function drawStone(x, y, w, h, tint) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 5, y + 6, w, h);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(tint, 0.25));
    g.addColorStop(1, shade(tint, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);
    // Mortar lines on long blocks
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w >= h)
      for (let sx = x + 40; sx < x + w - 4; sx += 40) {
        ctx.moveTo(sx + 0.5, y + 2);
        ctx.lineTo(sx + 0.5, y + h - 2);
      }
    else
      for (let sy = y + 40; sy < y + h - 4; sy += 40) {
        ctx.moveTo(x + 2, sy + 0.5);
        ctx.lineTo(x + w - 2, sy + 0.5);
      }
    ctx.stroke();
  }

  function glowCircle(x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Arched doorway with a swirling portal inside */
  function drawDoor(p, accent, t) {
    const cx = p.x + p.w / 2;
    const top = p.y + p.w / 2;
    // Light spill on the floor
    glowCircle(cx, p.y + p.h, p.w * 1.3, withAlpha(accent, 0.28), withAlpha(accent, 0));
    // Frame
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 + Math.sin(t * 2.5) * 5;
    ctx.fillStyle = shade(accent, -0.55);
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y + p.h + 2);
    ctx.lineTo(p.x - 4, top);
    ctx.arc(cx, top, p.w / 2 + 4, Math.PI, 0);
    ctx.lineTo(p.x + p.w + 4, p.y + p.h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Portal surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x, top);
    ctx.arc(cx, top, p.w / 2, Math.PI, 0);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, shade(accent, 0.55));
    g.addColorStop(1, shade(accent, -0.15));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    const sy = p.y + p.h * 0.55;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, sy, 4 + i * 6, 3 + i * 5, t * (1.2 + i * 0.4), 0.4, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // Threshold
    ctx.fillStyle = shade(accent, -0.35);
    ctx.fillRect(p.x - 6, p.y + p.h, p.w + 12, 4);
  }

  function drawWisp(x, y, color, alpha, dir) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + PLAYER_SIZE / 2 + 3, PLAYER_SIZE * 0.55, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    glowCircle(x, y, PLAYER_SIZE * 1.4, withAlpha(color, 0.35), withAlpha(color, 0));
    const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, PLAYER_SIZE / 2 + 1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, shade(color, 0.35));
    g.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_SIZE / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    // Eyes look where the wisp is heading
    ctx.fillStyle = '#1b1b3a';
    const ex = dir.x * 2.5, ey = dir.y * 2;
    ctx.beginPath();
    ctx.arc(x - 3 + ex, y - 1 + ey, 1.7, 0, Math.PI * 2);
    ctx.arc(x + 3 + ex, y - 1 + ey, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoom() {
    const def = ROOMS[currentRoom];
    const t = performance.now() / 1000;

    drawFloor(def);

    // Warp distortion overlay
    if (warpActive) {
      const time = performance.now() / 200;
      for (let y = 0; y < canvasH; y += 4) {
        const offset = Math.sin(y * 0.05 + time) * waveAmplitude * warpEffect;
        ctx.save();
        ctx.translate(offset, 0);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = def.accentColor;
        ctx.fillRect(0, y, canvasW, 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Perspective transition visual
    if (transitionProgress < 1) {
      ctx.save();
      const scale = 0.8 + 0.2 * transitionProgress;
      const rotation = (1 - transitionProgress) * Math.PI * 0.1;
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-canvasW / 2, -canvasH / 2);
    }

    // Objects
    for (const obj of def.objects) {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      switch (obj.type) {
        case 'clue': {
          // Floating rune stone with a question mark
          const bob = Math.sin(t * 2.2 + obj.x) * 3;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(cx, obj.y + obj.h + 4, 9, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          glowCircle(cx, cy + bob, 26, 'rgba(255,230,120,0.35)', 'rgba(255,230,120,0)');
          ctx.save();
          ctx.translate(cx, cy + bob);
          ctx.rotate(Math.PI / 4);
          const g = ctx.createLinearGradient(-10, -10, 10, 10);
          g.addColorStop(0, '#fff6c0');
          g.addColorStop(1, '#e0a92a');
          ctx.fillStyle = g;
          ctx.fillRect(-10, -10, 20, 20);
          ctx.strokeStyle = 'rgba(120,70,0,0.6)';
          ctx.strokeRect(-10, -10, 20, 20);
          ctx.restore();
          ctx.fillStyle = '#6a3d00';
          ctx.font = 'bold 14px ' + UI.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', cx, cy + bob + 1);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
          break;
        }
        case 'platform':
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.45));
          break;
        case 'stairPlatform': {
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.5));
          // Step notches that seem to climb forever
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          for (let sx = obj.x + 6; sx < obj.x + obj.w - 10; sx += 24)
            ctx.fillRect(sx, obj.y + 4 + ((sx - obj.x) / 24 % 4), 14, 3);
          break;
        }
        case 'wall':
          drawStone(obj.x, obj.y, obj.w, obj.h, shade(def.accentColor, -0.55));
          break;
        case 'colorTile': {
          const c = obj.tileColor || '#888';
          ctx.save();
          ctx.shadowColor = c;
          ctx.shadowBlur = 10 + Math.sin(t * 3 + obj.x) * 4;
          roundRectPath(obj.x + 2, obj.y + 2, obj.w - 4, obj.h - 4, 6);
          const g = ctx.createLinearGradient(obj.x, obj.y, obj.x + obj.w, obj.y + obj.h);
          g.addColorStop(0, shade(c, 0.35));
          g.addColorStop(1, shade(c, -0.25));
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          roundRectPath(obj.x + 6, obj.y + 5, obj.w - 12, 6, 3);
          ctx.fill();
          break;
        }
        case 'shadow': {
          glowCircle(cx, cy, obj.w, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
          ctx.fillStyle = 'rgba(160,180,200,0.5)';
          ctx.beginPath();
          ctx.arc(cx - 5, cy - 2, 1.6, 0, Math.PI * 2);
          ctx.arc(cx + 5, cy - 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fracture': {
          // Jagged glowing crack; its shape shifts a few times per second
          const seed = Math.floor(t * 6);
          ctx.save();
          ctx.shadowColor = '#ff3040';
          ctx.shadowBlur = 14;
          for (const [w, col] of [[6, 'rgba(255,60,80,0.35)'], [2, '#ffd0d0']]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(obj.x + obj.w / 2, obj.y);
            for (let fy = obj.y + 10, i = 0; fy <= obj.y + obj.h; fy += 10, ++i) {
              const n = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
              ctx.lineTo(obj.x + obj.w / 2 + (n - Math.floor(n) - 0.5) * 12, fy);
            }
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'phantomBridge': {
          const a = 0.3 + Math.sin(t * 2) * 0.2;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = def.accentColor;
          for (let px = obj.x; px < obj.x + obj.w; px += 18)
            ctx.fillRect(px, obj.y, 14, obj.h);
          ctx.globalAlpha = a * 0.6;
          ctx.fillRect(obj.x, obj.y - 3, obj.w, 2);
          ctx.fillRect(obj.x, obj.y + obj.h + 1, obj.w, 2);
          ctx.restore();
          break;
        }
        case 'nexusOrb': {
          glowCircle(cx, cy, obj.w * 1.6, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)');
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 2; ++i) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, obj.w * 0.95, obj.w * 0.35, t * (i ? -1.1 : 0.8) + i, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          glowCircle(cx, cy, obj.w / 2, '#ffffff', '#b8c4ff');
          break;
        }
        case 'echo':
          drawWisp(cx, cy, '#00ccff', 0.35 + Math.sin(t * 3) * 0.15, { x: Math.sin(t), y: 0 });
          break;
        case 'goal': {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * 0.4);
          ctx.fillStyle = 'rgba(255,215,0,0.35)';
          for (let i = 0; i < 12; ++i) {
            ctx.rotate(Math.PI / 6);
            ctx.beginPath();
            ctx.moveTo(-3, obj.w * 0.55);
            ctx.lineTo(0, obj.w * 1.15);
            ctx.lineTo(3, obj.w * 0.55);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
          ctx.save();
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 20;
          glowCircle(cx, cy, obj.w / 2, '#fffbe0', '#ffb300');
          ctx.restore();
          break;
        }
      }
    }

    // Portals / Doors
    if (def.portals)
      for (const p of def.portals)
        drawDoor(p, def.accentColor, t);

    if (transitionProgress < 1)
      ctx.restore();
  }

  function drawPlayer() {
    const dir = { x: 0, y: 0 };
    if (keys['ArrowLeft'] || keys['KeyA']) dir.x = -1;
    if (keys['ArrowRight'] || keys['KeyD']) dir.x = 1;
    if (keys['ArrowUp'] || keys['KeyW']) dir.y = -1;
    if (keys['ArrowDown'] || keys['KeyS']) dir.y = 1;
    drawWisp(player.x, player.y, '#3cc8ff', 1, dir);
  }

  /* Title art: a door standing alone, opening onto another room */
  function drawTitleArt(cx, cy, t) {
    // Floor ellipse
    glowCircle(cx, cy + 62, 120, 'rgba(120,140,255,0.25)', 'rgba(120,140,255,0)');
    ctx.strokeStyle = 'rgba(160,170,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 62, 40 * i, 9 * i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawDoor({ x: cx - 30, y: cy - 50, w: 60, h: 110 }, '#9d7bff', t);
    // Stairs drifting through the doorway
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; ++i)
      ctx.fillRect(cx - 18 + i * 7, cy + 40 - i * 12, 14, 4);
    drawWisp(cx - 70, cy + 52 + Math.sin(t * 2) * 3, '#3cc8ff', 1, { x: 1, y: 0 });
  }

  function drawHUD() {
    const t = performance.now() / 1000;

    if (state === STATE_READY) {
      const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
      bg.addColorStop(0, '#0f0e2a');
      bg.addColorStop(1, '#2a1846');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvasW, canvasH);
      drawTitleArt(canvasW / 2, canvasH / 2 - 80, t);
      centeredText('MIND-BENDING PUZZLE', canvasH / 2 + 60, 'bold 30px ' + UI.font, UI.text, 'rgba(150,130,255,0.9)');
      centeredText('Discover the hidden rule of each surreal room', canvasH / 2 + 94, 'italic 15px ' + UI.font, UI.textDim);
      pill('Tap or press F2 to start', canvasH / 2 + 140, UI.gold);
      centeredText('Arrows / WASD move   ·   E / Space interact   ·   Q shift perspective   ·   Esc pause', canvasH / 2 + 190, '12px ' + UI.font, UI.textDim);
    }

    if (state === STATE_EXPLORING || state === STATE_PAUSED) {
      const def = ROOMS[currentRoom];
      const known = !!discoveredRules[currentRoom];
      const roomLabel = `ROOM ${currentRoom + 1} / ${ROOMS.length}`;
      const ruleText = known ? def.rule : 'Rule unknown';
      ctx.save();
      ctx.font = 'bold 11px ' + UI.font;
      const labelW = ctx.measureText(roomLabel).width;
      ctx.font = 'bold 15px ' + UI.font;
      const headW = labelW + 12 + ctx.measureText(def.name).width;
      ctx.font = '12px ' + UI.font;
      const w = Math.max(220, ctx.measureText(ruleText).width + 54, headW + 36);
      ctx.restore();
      panel(12, 12, w, 52, 0.8, def.accentColor);
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = def.accentColor;
      ctx.font = 'bold 11px ' + UI.font;
      ctx.fillText(roomLabel, 24, 26);
      ctx.fillStyle = UI.text;
      ctx.font = 'bold 15px ' + UI.font;
      ctx.fillText(def.name, 24 + labelW + 12, 26);
      // Rule line with a lock or check mark
      ctx.font = '12px ' + UI.font;
      ctx.fillStyle = known ? UI.good : UI.textDim;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (known) {
        // check mark
        ctx.moveTo(25, 48);
        ctx.lineTo(29, 52);
        ctx.lineTo(36, 43);
        ctx.stroke();
      } else {
        // padlock
        ctx.arc(30, 46, 3.5, Math.PI, 0);
        ctx.stroke();
        ctx.fillRect(25, 46, 10, 7);
      }
      ctx.fillText(ruleText, 42, 48);
      ctx.restore();

      // Discovered rules counter
      const discovered = Object.keys(discoveredRules).length;
      panel(canvasW - 120, 12, 108, 52, 0.8);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = UI.textDim;
      ctx.font = 'bold 10px ' + UI.font;
      ctx.fillText('RULES FOUND', canvasW - 66, 27);
      ctx.fillStyle = UI.gold;
      ctx.font = 'bold 18px ' + UI.font;
      ctx.fillText(`${discovered} / ${ROOMS.length}`, canvasW - 66, 47);
      ctx.restore();
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(8,6,24,0.55)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      panel(canvasW / 2 - 130, canvasH / 2 - 55, 260, 110, 0.92);
      centeredText('PAUSED', canvasH / 2 - 15, 'bold 28px ' + UI.font, UI.text, 'rgba(150,130,255,0.8)');
      centeredText('Press Esc to resume', canvasH / 2 + 22, '13px ' + UI.font, UI.textDim);
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(8,6,24,0.6)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      panel(canvasW / 2 - 180, canvasH / 2 - 90, 360, 180, 0.94, '#ffd700');
      centeredText('AWAKENED', canvasH / 2 - 50, 'bold 30px ' + UI.font, UI.gold, 'rgba(255,200,80,0.8)');
      const discovered = Object.keys(discoveredRules).length;
      centeredText(`Rules discovered: ${discovered} / ${ROOMS.length}`, canvasH / 2 - 12, 'bold 15px ' + UI.font, UI.text);
      centeredText(`Time: ${Math.floor(elapsedTime / 60)}:${String(Math.floor(elapsedTime % 60)).padStart(2, '0')}`, canvasH / 2 + 14, '14px ' + UI.font, UI.textDim);
      pill('Tap or press F2 to play again', canvasH / 2 + 55, UI.gold);
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (state === STATE_EXPLORING || state === STATE_PAUSED || state === STATE_GAME_OVER) {
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

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_EXPLORING,
    pause: () => {
      state = STATE_PAUSED;
    }
  });

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
  SZ.GameAudio.attachMuteButton();
  SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'eight',
    buttons: [
      { label: 'Use', code: 'KeyE' },
      { label: 'Shift', code: 'KeyQ' }
    ],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
