;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TILE_W = 96;
  const TILE_H = 48;
  const BOARD_ORIGIN_Y = 160;
  const PLAYER_SPEED = 6;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-illusion-puzzle';
  const STORAGE_PROGRESS = STORAGE_PREFIX + '-progress';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ══════════════════════════════════════════════════════════════════
     ISOMETRIC HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function toIso(col, row) {
    const isoX = (col - row) * (TILE_W / 2) + CANVAS_W / 2;
    const isoY = (col + row) * (TILE_H / 2) + BOARD_ORIGIN_Y;
    return { x: isoX, y: isoY };
  }

  function toScreen(col, row, elevation) {
    const iso = toIso(col, row);
    return { x: iso.x, y: iso.y - (elevation || 0) * TILE_H };
  }

  /* ══════════════════════════════════════════════════════════════════
     LEVEL DATA — 16 impossible-geometry levels
     Each level: grid layout, goal position, collectibles, Penrose stair links
     Grid cell types: 0=void, 1=floor, 2=raised, 3=Penrose stair, 4=goal
     ══════════════════════════════════════════════════════════════════ */

  const LEVELS = [
    { name: 'First Steps', grid: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [], perspective: 0 },
    { name: 'The Rise', grid: [[1,1,1,0,0],[1,2,2,2,0],[0,2,1,2,0],[0,2,2,2,0],[0,0,0,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:1,col:3},to:{row:4,col:4},perspective:1}], perspective: 0 },
    { name: 'Penrose Gateway', grid: [[1,1,3,0,0],[1,1,1,0,0],[3,1,1,1,0],[0,0,1,1,1],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [{from:{row:0,col:2},to:{row:2,col:0},perspective:0}], perspective: 0 },
    { name: 'Escher Bridge', grid: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0}], illusionLinks: [], perspective: 0 },
    { name: 'Spiral Tower', grid: [[1,1,0,0,0],[1,2,2,0,0],[0,2,3,2,0],[0,0,2,2,1],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:3,col:4},perspective:1}], perspective: 0 },
    { name: 'Double Illusion', grid: [[1,1,1,1,1],[1,0,0,0,1],[1,0,3,0,1],[1,0,0,0,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 },
    { name: 'Floating Paths', grid: [[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [{from:{row:0,col:2},to:{row:2,col:0},perspective:1},{from:{row:2,col:4},to:{row:4,col:2},perspective:1}], perspective: 0 },
    { name: 'The Paradox', grid: [[2,2,1,1,0],[2,3,1,0,0],[1,1,1,1,0],[0,0,1,3,2],[0,0,1,2,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:4,col:3}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0}], perspective: 0 },
    { name: 'Mirror Stairs', grid: [[1,1,1,1,1],[1,3,0,3,1],[1,0,2,0,1],[1,3,0,3,1],[1,1,1,1,4]], playerStart: {row:0,col:2},
      collectibles: [{row:2,col:2},{row:0,col:0},{row:0,col:4}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:1},{from:{row:1,col:3},to:{row:3,col:1},perspective:2}], perspective: 0 },
    { name: 'Gravity Well', grid: [[1,1,1,0,0],[1,2,1,0,0],[1,1,1,1,1],[0,0,1,2,1],[0,0,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [], perspective: 0 },
    { name: 'Impossible Fork', grid: [[1,1,0,1,1],[1,0,0,0,1],[0,0,3,0,0],[1,0,0,0,1],[1,1,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:4,col:0}], illusionLinks: [{from:{row:2,col:2},to:{row:0,col:4},perspective:1},{from:{row:2,col:2},to:{row:4,col:0},perspective:2}], perspective: 0 },
    { name: 'Cascade', grid: [[2,1,1,1,0],[0,0,0,1,0],[0,0,2,1,0],[0,0,0,1,0],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:2,col:2}], illusionLinks: [{from:{row:0,col:0},to:{row:2,col:2},perspective:1}], perspective: 0 },
    { name: 'Möbius Walk', grid: [[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0},{from:{row:1,col:3},to:{row:3,col:1},perspective:1}], perspective: 0 },
    { name: 'The Void', grid: [[1,0,0,0,1],[0,1,0,1,0],[0,0,3,0,0],[0,1,0,1,0],[1,0,0,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 },
    { name: 'Architect\'s Dream', grid: [[2,2,1,2,2],[2,1,1,1,2],[1,1,3,1,1],[2,1,1,1,2],[2,2,1,2,4]], playerStart: {row:0,col:2},
      collectibles: [{row:0,col:0},{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:2},perspective:1}], perspective: 0 },
    { name: 'Final Illusion', grid: [[1,1,1,1,1],[1,3,2,3,1],[1,2,3,2,1],[1,3,2,3,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2},{row:1,col:2}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0},{from:{row:1,col:3},to:{row:3,col:1},perspective:1},{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusLevel = document.getElementById('statusLevel');
  const statusGems = document.getElementById('statusGems');
  const statusMoves = document.getElementById('statusMoves');
  const highScoresBody = document.getElementById('highScoresBody');

  const { User32 } = SZ?.Dlls ?? {};

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_READY;
  let currentLevel = 0;
  let player = { row: 0, col: 0, x: 0, y: 0, targetX: 0, targetY: 0, moveProgress: 1 };
  let collected = [];
  let moves = 0;
  let trail = [];
  let highScores = [];
  let levelProgress = {};

  /* ── Perspective rotation ── */
  let perspective = 0;
  let rotationProgress = 1;
  let rotationFrom = 0;
  let rotationTo = 0;

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
        levelProgress = data.levels || {};
        currentLevel = data.currentLevel || 0;
      }
    } catch (_) {
      levelProgress = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify({
        levels: levelProgress,
        currentLevel
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

  function addHighScore(level, moveCount) {
    highScores.push({ level: level + 1, moves: moveCount });
    highScores.sort((a, b) => a.moves - b.moves || a.level - b.level);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].level}</td><td>${highScores[i].moves}</td>`;
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

    player.row = def.playerStart.row;
    player.col = def.playerStart.col;
    const startPos = toScreen(player.col, player.row);
    player.x = startPos.x;
    player.y = startPos.y;
    player.targetX = startPos.x;
    player.targetY = startPos.y;
    player.moveProgress = 1;

    collected = [];
    moves = 0;
    trail = [{ row: player.row, col: player.col }];

    perspective = def.perspective || 0;
    rotationProgress = 1;
    rotationFrom = perspective;
    rotationTo = perspective;

    state = STATE_PLAYING;
    SZ.GameAudio.play('select');
    updateWindowTitle();
    saveProgress();
  }

  function nextLevel() {
    if (currentLevel + 1 < LEVELS.length)
      loadLevel(currentLevel + 1);
    else {
      state = STATE_GAME_OVER;
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'ALL LEVELS COMPLETE!', { color: '#ffd700', font: 'bold 20px sans-serif' });
      particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40, { speed: 6, gravity: 0.08 });
      screenShake.trigger(6, 300);
      SZ.GameAudio.play('win');
      updateWindowTitle();
    }
  }

  function completeLevel() {
    state = STATE_LEVEL_COMPLETE;
    levelProgress[currentLevel] = { moves, gems: collected.length };
    addHighScore(currentLevel, moves);
    saveProgress();

    const goalPos = toScreen(LEVELS[currentLevel].grid[0].length - 1, LEVELS[currentLevel].grid.length - 1);
    particles.burst(goalPos.x, goalPos.y, 20, { color: '#0f0', speed: 4, life: 0.8 });
    particles.sparkle(goalPos.x, goalPos.y, 15, { color: '#ff0', speed: 3 });
    screenShake.trigger(4, 200);
    SZ.GameAudio.play('levelup');
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSPECTIVE ROTATION
     ══════════════════════════════════════════════════════════════════ */

  function rotatePerspective(dir) {
    if (rotationProgress < 1) return;
    rotationFrom = perspective;
    rotationTo = (perspective + dir + 4) % 4;
    rotationProgress = 0;

    screenShake.trigger(3, 120);
    floatingText.add(CANVAS_W / 2, 30, dir > 0 ? 'Rotate Right' : 'Rotate Left', { color: '#88f', font: 'bold 12px sans-serif' });
    particles.burst(CANVAS_W / 2, CANVAS_H / 2, 10, { color: '#66f', speed: 2, life: 0.4 });
    SZ.GameAudio.play('whoosh', { pitch: dir > 0 ? 1.2 : 0.9 });
  }

  function updateRotation(dt) {
    if (rotationProgress < 1) {
      rotationProgress = Math.min(1, rotationProgress + dt * 3);
      if (smoothstep(rotationProgress) >= 1) {
        rotationProgress = 1;
        perspective = rotationTo;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WALKABILITY — perspective determines which paths are passable
     ══════════════════════════════════════════════════════════════════ */

  function isWalkable(row, col) {
    const def = LEVELS[currentLevel];
    if (row < 0 || row >= def.grid.length || col < 0 || col >= def.grid[0].length)
      return false;

    const cell = def.grid[row][col];
    if (cell === 0) return false;
    if (cell === 1 || cell === 2 || cell === 4) return true;

    // Penrose stair cells: walkable depends on perspective
    if (cell === 3) {
      // Check illusion links
      for (const link of def.illusionLinks) {
        if (link.from.row === row && link.from.col === col)
          return link.perspective === perspective;
      }
      return true;
    }

    return false;
  }

  function checkIllusionLink(row, col) {
    const def = LEVELS[currentLevel];
    for (const link of def.illusionLinks) {
      if (link.from.row === row && link.from.col === col && link.perspective === perspective)
        return link.to;
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER MOVEMENT
     ══════════════════════════════════════════════════════════════════ */

  function movePlayer(dRow, dCol) {
    if (state !== STATE_PLAYING || player.moveProgress < 1) return;

    const newRow = player.row + dRow;
    const newCol = player.col + dCol;

    // Check illusion teleport first
    const teleport = checkIllusionLink(player.row, player.col);
    if (teleport) {
      player.row = teleport.row;
      player.col = teleport.col;
      const pos = toScreen(player.col, player.row);
      player.targetX = pos.x;
      player.targetY = pos.y;
      player.moveProgress = 0;
      ++moves;
      trail.push({ row: player.row, col: player.col });

      particles.burst(player.x, player.y, 12, { color: '#a0f', speed: 3, life: 0.5 });
      floatingText.add(player.x, player.y - 20, 'Warp!', { color: '#a0f', font: 'bold 12px sans-serif' });
      screenShake.trigger(3, 80);
      SZ.GameAudio.play('zap');
      checkCollectibles();
      checkGoal();
      return;
    }

    if (!isWalkable(newRow, newCol)) {
      SZ.GameAudio.play('click', { pitch: 0.5, volume: 0.5 });
      return;
    }

    player.row = newRow;
    player.col = newCol;
    const pos = toScreen(player.col, player.row);
    player.targetX = pos.x;
    player.targetY = pos.y;
    player.moveProgress = 0;
    ++moves;
    SZ.GameAudio.play('click', { pitch: 0.8 + (moves % 2) * 0.1, volume: 0.6 });

    trail.push({ row: player.row, col: player.col });
    checkCollectibles();
    checkGoal();
  }

  function updatePlayerAnimation(dt) {
    if (player.moveProgress < 1) {
      player.moveProgress = Math.min(1, player.moveProgress + dt * PLAYER_SPEED);
      const eased = smoothstep(player.moveProgress);
      player.x += (player.targetX - player.x) * eased;
      player.y += (player.targetY - player.y) * eased;
      if (player.moveProgress >= 1) {
        player.x = player.targetX;
        player.y = player.targetY;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     COLLECTIBLES & GOAL
     ══════════════════════════════════════════════════════════════════ */

  function checkCollectibles() {
    const def = LEVELS[currentLevel];
    if (!def.collectibles || def.collectibles.length === 0) return;
    for (let i = 0; i < def.collectibles.length; ++i) {
      const gem = def.collectibles[i];
      if (gem.row === player.row && gem.col === player.col && !collected.includes(i)) {
        collected.push(i);
        const pos = toScreen(gem.col, gem.row);
        particles.sparkle(pos.x, pos.y, 10, { color: '#ff0', speed: 3 });
        particles.burst(pos.x, pos.y, 8, { color: '#fa0', speed: 2, life: 0.4 });
        floatingText.add(pos.x, pos.y - 20, 'Gem!', { color: '#ff0', font: 'bold 12px sans-serif' });
        screenShake.trigger(2, 60);
        SZ.GameAudio.play('pickup', { pitch: 1 + collected.length * 0.06 });
      }
    }
  }

  function checkGoal() {
    if (LEVELS[currentLevel].grid[player.row]?.[player.col] === 4)
      completeLevel();
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;
    updatePlayerAnimation(dt);
    updateRotation(dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  /* ── Palette ── */
  const PAL = {
    skyTop: '#1d1640',
    skyMid: '#3b2763',
    skyLow: '#7a4775',
    star: 'rgba(255,240,220,',
    floorTop: ['#f7e7cf', '#e7c9a2'],
    floorLeft: '#c7798a',
    floorRight: '#9b5269',
    raisedTop: ['#fbefdc', '#edd3ae'],
    stairTop: ['#d9ccff', '#a690ea'],
    stairDim: ['#8a82a8', '#6c6390'],
    stairLeft: '#7d68c4',
    stairRight: '#5c4a9e',
    goalTop: ['#b9f7e9', '#4fd3b8'],
    goalLeft: '#3aa892',
    goalRight: '#2a8072',
    edge: 'rgba(255,255,255,0.55)',
    gem: ['#fff4b8', '#ffd24a', '#e8962a'],
    ink: '#2a1f45',
    text: '#f6ecff',
    textDim: 'rgba(246,236,255,0.65)',
    accent: '#ffcf6b'
  };

  const BLOCK_DEPTH = 22;
  const ELEVATION_RAISED = 0.5;

  /* Twinkling background stars (fixed positions) */
  const STARS = [];
  for (let i = 0; i < 70; ++i)
    STARS.push({ x: (i * 197) % CANVAS_W, y: (i * 89 + (i % 7) * 31) % (CANVAS_H * 0.75), r: 0.6 + (i % 3) * 0.5, p: i * 0.7 });

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

  function panel(x, y, w, h, alpha) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    roundRectPath(x, y, w, h, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(58,40,98,${alpha})`);
    g.addColorStop(1, `rgba(30,22,60,${alpha})`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.6, PAL.skyMid);
    g.addColorStop(1, PAL.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const t = performance.now() / 1000;
    for (const s of STARS) {
      const a = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p);
      ctx.fillStyle = PAL.star + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft glow behind the board
    const glow = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H * 0.55, 20, CANVAS_W / 2, CANVAS_H * 0.55, 330);
    glow.addColorStop(0, 'rgba(255,200,170,0.20)');
    glow.addColorStop(1, 'rgba(255,200,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /* An isometric block: top diamond centred at (x, yTop), sides down to yBase */
  function drawBlock(x, yTop, yBase, hw, hh, top, left, right) {
    // Left face
    let g = ctx.createLinearGradient(0, yTop, 0, yBase + hh * 2);
    g.addColorStop(0, left);
    g.addColorStop(1, shade(left, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - hw, yTop);
    ctx.lineTo(x, yTop + hh);
    ctx.lineTo(x, yBase + hh);
    ctx.lineTo(x - hw, yBase);
    ctx.closePath();
    ctx.fill();

    // Right face
    g = ctx.createLinearGradient(0, yTop, 0, yBase + hh * 2);
    g.addColorStop(0, right);
    g.addColorStop(1, shade(right, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + hw, yTop);
    ctx.lineTo(x, yTop + hh);
    ctx.lineTo(x, yBase + hh);
    ctx.lineTo(x + hw, yBase);
    ctx.closePath();
    ctx.fill();

    // Top face
    g = ctx.createLinearGradient(x - hw, yTop - hh, x + hw, yTop + hh);
    g.addColorStop(0, top[0]);
    g.addColorStop(1, top[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, yTop - hh);
    ctx.lineTo(x + hw, yTop);
    ctx.lineTo(x, yTop + hh);
    ctx.lineTo(x - hw, yTop);
    ctx.closePath();
    ctx.fill();

    // Lit back edges
    ctx.strokeStyle = PAL.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - hw, yTop);
    ctx.lineTo(x, yTop - hh);
    ctx.lineTo(x + hw, yTop);
    ctx.stroke();
    // Front edge line
    ctx.strokeStyle = 'rgba(40,20,60,0.35)';
    ctx.beginPath();
    ctx.moveTo(x - hw, yTop);
    ctx.lineTo(x, yTop + hh);
    ctx.lineTo(x + hw, yTop);
    ctx.stroke();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function cellElevation(row, col) {
    const cell = LEVELS[currentLevel].grid[row]?.[col];
    return cell === 2 ? ELEVATION_RAISED : 0;
  }

  function drawIsometricTile(col, row, cellType, elevation) {
    const pos = toScreen(col, row, elevation);
    const base = toScreen(col, row, 0);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const yBase = base.y + BLOCK_DEPTH;

    switch (cellType) {
      case 1:
        drawBlock(pos.x, pos.y, yBase, hw, hh, PAL.floorTop, PAL.floorLeft, PAL.floorRight);
        break;
      case 2:
        drawBlock(pos.x, pos.y, yBase, hw, hh, PAL.raisedTop, shade(PAL.floorLeft, 0.08), shade(PAL.floorRight, 0.08));
        // Small inset square marks a raised terrace
        ctx.strokeStyle = 'rgba(160,100,90,0.35)';
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - hh * 0.55);
        ctx.lineTo(pos.x + hw * 0.55, pos.y);
        ctx.lineTo(pos.x, pos.y + hh * 0.55);
        ctx.lineTo(pos.x - hw * 0.55, pos.y);
        ctx.closePath();
        ctx.stroke();
        break;
      case 3: {
        const open = isWalkable(row, col);
        drawBlock(pos.x, pos.y, yBase, hw, hh, open ? PAL.stairTop : PAL.stairDim, PAL.stairLeft, PAL.stairRight);
        // Penrose steps drawn on the top face, glowing while the stair is usable
        ctx.save();
        if (open) {
          ctx.shadowColor = '#c8b6ff';
          ctx.shadowBlur = 10 + Math.sin(performance.now() / 300) * 4;
        }
        ctx.strokeStyle = open ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; ++i) {
          const f = 0.75 - i * 0.18;
          const y = pos.y - i * 3;
          ctx.beginPath();
          ctx.moveTo(pos.x - hw * f, y);
          ctx.lineTo(pos.x, y - hh * f);
          ctx.lineTo(pos.x + hw * f, y);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 4: {
        drawBlock(pos.x, pos.y, yBase, hw, hh, PAL.goalTop, PAL.goalLeft, PAL.goalRight);
        drawArch(pos.x, pos.y);
        break;
      }
    }
  }

  function drawArch(x, y) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400);
    const archW = 18, archH = 40;
    ctx.save();
    ctx.shadowColor = '#7fffe0';
    ctx.shadowBlur = 18 * pulse;
    const g = ctx.createLinearGradient(0, y - archH, 0, y);
    g.addColorStop(0, 'rgba(220,255,248,0.95)');
    g.addColorStop(1, 'rgba(90,230,200,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - archW / 2, y);
    ctx.lineTo(x - archW / 2, y - archH + archW / 2);
    ctx.arc(x, y - archH + archW / 2, archW / 2, Math.PI, 0);
    ctx.lineTo(x + archW / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,110,95,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTrail() {
    if (trail.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,236,190,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 7]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < trail.length; ++i) {
      const pos = toScreen(trail[i].col, trail[i].row, cellElevation(trail[i].row, trail[i].col));
      if (i === 0) ctx.moveTo(pos.x, pos.y);
      else ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGem(x, y, size, bob) {
    // Shadow on the tile
    ctx.fillStyle = 'rgba(60,30,60,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, size * 0.8, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const gy = y - size * 1.6 - bob;
    ctx.save();
    ctx.shadowColor = 'rgba(255,210,90,0.9)';
    ctx.shadowBlur = 12;
    // Crown and pavilion facets
    ctx.fillStyle = PAL.gem[1];
    ctx.beginPath();
    ctx.moveTo(x - size, gy);
    ctx.lineTo(x - size * 0.5, gy - size * 0.6);
    ctx.lineTo(x + size * 0.5, gy - size * 0.6);
    ctx.lineTo(x + size, gy);
    ctx.lineTo(x, gy + size * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PAL.gem[0];
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, gy - size * 0.6);
    ctx.lineTo(x + size * 0.1, gy - size * 0.6);
    ctx.lineTo(x - size * 0.2, gy);
    ctx.lineTo(x - size, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.gem[2];
    ctx.beginPath();
    ctx.moveTo(x + size, gy);
    ctx.lineTo(x, gy + size * 1.2);
    ctx.lineTo(x + size * 0.2, gy);
    ctx.closePath();
    ctx.fill();
  }

  function drawCollectibles() {
    const def = LEVELS[currentLevel];
    if (!def.collectibles) return;
    const t = performance.now() / 1000;
    for (let i = 0; i < def.collectibles.length; ++i) {
      if (collected.includes(i)) continue;
      const gem = def.collectibles[i];
      const pos = toScreen(gem.col, gem.row, cellElevation(gem.row, gem.col));
      drawGem(pos.x, pos.y, 10, 4 + Math.sin(t * 2.4 + i) * 3);
    }
  }

  let playerLift = 0;

  function drawPlayer() {
    // Ease the figure up and down terraces
    const targetLift = cellElevation(player.row, player.col) * TILE_H;
    playerLift += (targetLift - playerLift) * 0.2;
    const x = player.x;
    const y = player.y - playerLift;
    const bob = player.moveProgress < 1 ? Math.sin(player.moveProgress * Math.PI) * 5 : 0;

    drawFigure(x, y, bob);
  }

  function drawFigure(x, y, bob) {
    // Shadow
    ctx.fillStyle = 'rgba(50,20,60,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const fy = y - bob;
    // Robe
    const robe = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    robe.addColorStop(0, '#ffffff');
    robe.addColorStop(1, '#cfc8e8');
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(x - 9, fy);
    ctx.quadraticCurveTo(x - 7, fy - 16, x - 3, fy - 22);
    ctx.lineTo(x + 3, fy - 22);
    ctx.quadraticCurveTo(x + 7, fy - 16, x + 9, fy);
    ctx.quadraticCurveTo(x, fy + 4, x - 9, fy);
    ctx.closePath();
    ctx.fill();
    // Head
    ctx.fillStyle = '#fbe3cf';
    ctx.beginPath();
    ctx.arc(x, fy - 25, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Pointed hat
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(x - 6, fy - 26);
    ctx.lineTo(x + 6, fy - 26);
    ctx.lineTo(x + 1, fy - 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.accent;
    ctx.beginPath();
    ctx.arc(x + 1, fy - 40, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrid() {
    const def = LEVELS[currentLevel];
    const rows = def.grid.length;
    const cols = def.grid[0].length;

    // Apply perspective rotation visual
    if (rotationProgress < 1) {
      ctx.save();
      const angle = (rotationTo - rotationFrom) * (1 - rotationProgress) * Math.PI * 0.02;
      ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
      ctx.rotate(angle);
      ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
    }

    // Draw tiles back-to-front for proper isometric overlap
    for (let r = 0; r < rows; ++r)
      for (let c = 0; c < cols; ++c) {
        const cell = def.grid[r][c];
        if (cell === 0) continue;
        const elevation = cell === 2 ? ELEVATION_RAISED : 0;
        drawIsometricTile(c, r, cell, elevation);
      }

    drawTrail();
    drawCollectibles();
    drawPlayer();

    if (rotationProgress < 1)
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
    ctx.fillText(text, CANVAS_W / 2, y);
    ctx.restore();
  }

  function pill(text, y) {
    ctx.save();
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 36;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 350);
    roundRectPath(CANVAS_W / 2 - w / 2, y - 16, w, 32, 16);
    ctx.fillStyle = `rgba(255,207,107,${0.18 + 0.12 * pulse})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,207,107,${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PAL.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CANVAS_W / 2, y + 1);
    ctx.restore();
  }

  /* Title art: a small floating island built from the game's own pieces */
  function drawTitleIsland(cx, cy) {
    const hw = 34, hh = 17;
    const cells = [[1, 1, 2], [3, 1, 1], [2, 1, 4]];
    const at = (r, c, lift) => ({ x: cx + (c - r) * hw, y: cy + (c + r) * hh - lift });
    for (let r = 0; r < 3; ++r)
      for (let c = 0; c < 3; ++c) {
        const cell = cells[r][c];
        const lift = cell === 2 ? hh : 0;
        const p = at(r, c, lift);
        const yBase = cy + (c + r) * hh + 26;
        if (cell === 1)
          drawBlock(p.x, p.y, yBase, hw, hh, PAL.floorTop, PAL.floorLeft, PAL.floorRight);
        else if (cell === 2)
          drawBlock(p.x, p.y, yBase, hw, hh, PAL.raisedTop, shade(PAL.floorLeft, 0.08), shade(PAL.floorRight, 0.08));
        else if (cell === 3)
          drawBlock(p.x, p.y, yBase, hw, hh, PAL.stairTop, PAL.stairLeft, PAL.stairRight);
        else {
          drawBlock(p.x, p.y, yBase, hw, hh, PAL.goalTop, PAL.goalLeft, PAL.goalRight);
          drawArch(p.x, p.y);
        }
      }
    const t = performance.now() / 1000;
    const gem = at(1, 2, 0);
    drawGem(gem.x, gem.y, 9, 4 + Math.sin(t * 2.4) * 3);
    const hero = at(0, 0, 0);
    drawFigure(hero.x, hero.y, 0);
  }

  function drawHUD() {
    if (state === STATE_READY) {
      drawTitleIsland(CANVAS_W / 2, 105);
      centeredText('OPTICAL ILLUSION PUZZLE', 270, 'bold 30px "Segoe UI", system-ui, sans-serif', PAL.text, 'rgba(200,170,255,0.9)');
      centeredText('Navigate impossible architecture', 306, 'italic 15px "Segoe UI", system-ui, sans-serif', PAL.textDim);
      pill('Tap or press F2 to start', 360);
      centeredText('Arrows / WASD move   ·   Q / E rotate the view   ·   Esc pause', 420, '12px "Segoe UI", system-ui, sans-serif', PAL.textDim);
    }

    if (state === STATE_PLAYING || state === STATE_PAUSED) {
      const def = LEVELS[currentLevel];
      // Level card
      panel(10, 10, 230, 46, 0.78);
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.accent;
      ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`LEVEL ${currentLevel + 1} / ${LEVELS.length}`, 22, 25);
      ctx.fillStyle = PAL.text;
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(def.name, 22, 42);
      ctx.restore();

      // Gems and moves
      const total = def.collectibles.length;
      const w = 34 + total * 22 + 70;
      panel(CANVAS_W - w - 10, 10, w, 46, 0.78);
      for (let i = 0; i < total; ++i) {
        const gx = CANVAS_W - w + 12 + i * 22;
        if (i < collected.length)
          drawGem(gx, 44, 6, 0);
        else {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(gx - 6, 34);
          ctx.lineTo(gx, 27);
          ctx.lineTo(gx + 6, 34);
          ctx.lineTo(gx, 41);
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.textDim;
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('MOVES', CANVAS_W - 22, 24);
      ctx.fillStyle = PAL.text;
      ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(String(moves), CANVAS_W - 22, 42);
      ctx.restore();

      // View indicator: which of the four perspectives is active
      const cx = CANVAS_W / 2;
      panel(cx - 64, CANVAS_H - 40, 128, 30, 0.7);
      ctx.save();
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.textDim;
      ctx.fillText('VIEW', cx - 52, CANVAS_H - 25);
      for (let i = 0; i < 4; ++i) {
        const dx = cx - 8 + i * 17;
        const active = i === (rotationProgress < 1 ? rotationTo : perspective);
        ctx.fillStyle = active ? PAL.stairTop[0] : 'rgba(255,255,255,0.18)';
        if (active) {
          ctx.shadowColor = '#b9a6ff';
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.moveTo(dx, CANVAS_H - 32);
        ctx.lineTo(dx + 6, CANVAS_H - 25);
        ctx.lineTo(dx, CANVAS_H - 18);
        ctx.lineTo(dx - 6, CANVAS_H - 25);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(15,10,35,0.55)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      panel(CANVAS_W / 2 - 130, CANVAS_H / 2 - 55, 260, 110, 0.92);
      centeredText('PAUSED', CANVAS_H / 2 - 15, 'bold 28px "Segoe UI", system-ui, sans-serif', PAL.text, 'rgba(200,170,255,0.8)');
      centeredText('Press Esc to resume', CANVAS_H / 2 + 22, '13px "Segoe UI", system-ui, sans-serif', PAL.textDim);
    }

    if (state === STATE_LEVEL_COMPLETE) {
      ctx.fillStyle = 'rgba(15,10,35,0.45)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      panel(CANVAS_W / 2 - 160, CANVAS_H / 2 - 80, 320, 160, 0.92);
      centeredText('LEVEL COMPLETE', CANVAS_H / 2 - 45, 'bold 24px "Segoe UI", system-ui, sans-serif', PAL.accent, 'rgba(255,200,100,0.7)');
      const def = LEVELS[currentLevel];
      centeredText(def.name, CANVAS_H / 2 - 15, 'italic 14px "Segoe UI", system-ui, sans-serif', PAL.textDim);
      centeredText(`Moves ${moves}   ·   Gems ${collected.length} / ${def.collectibles.length}`, CANVAS_H / 2 + 12, 'bold 14px "Segoe UI", system-ui, sans-serif', PAL.text);
      pill('Tap or press any key', CANVAS_H / 2 + 50);
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(15,10,35,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      panel(CANVAS_W / 2 - 180, CANVAS_H / 2 - 80, 360, 160, 0.94);
      centeredText('ALL LEVELS COMPLETE!', CANVAS_H / 2 - 40, 'bold 26px "Segoe UI", system-ui, sans-serif', PAL.accent, 'rgba(255,200,100,0.8)');
      centeredText('The impossible is now familiar ground.', CANVAS_H / 2 - 6, 'italic 14px "Segoe UI", system-ui, sans-serif', PAL.textDim);
      pill('Tap or press F2 to play again', CANVAS_H / 2 + 45);
    }
  }

  function drawGame() {
    drawBackground();

    if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_LEVEL_COMPLETE || state === STATE_GAME_OVER)
      drawGrid();

    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusLevel) statusLevel.textContent = `Level: ${currentLevel + 1}/${LEVELS.length}`;
    if (statusGems) {
      const total = LEVELS[currentLevel]?.collectibles?.length || 0;
      statusGems.textContent = `Gems: ${collected.length}/${total}`;
    }
    if (statusMoves) statusMoves.textContent = `Moves: ${moves}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;

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
    screenShake.restore(ctx);
    ctx.restore();

    updateStatusBar();

    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  function togglePause() {
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
    else
      return;
    SZ.GameAudio.play('click');
  }

  function resetAndStart() {
    collected = [];
    levelProgress = {};
    loadLevel(0);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault();
      resetAndStart();
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (state === STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    if (state === STATE_GAME_OVER) {
      resetAndStart();
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Movement
    if (e.code === 'ArrowUp' || e.code === 'KeyW') movePlayer(-1, 0);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') movePlayer(1, 0);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePlayer(0, -1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') movePlayer(0, 1);

    // Perspective rotation
    else if (e.code === 'KeyQ') rotatePerspective(-1);
    else if (e.code === 'KeyE') rotatePerspective(1);
  });

  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_READY || state === STATE_GAME_OVER)
      resetAndStart();
    else if (state === STATE_LEVEL_COMPLETE)
      nextLevel();
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
        togglePause();
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
      ? 'Optical Illusion Puzzle — All Complete!'
      : `Optical Illusion Puzzle — Level ${currentLevel + 1}: ${levelName}`;
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
  SZ.GameAudio.attachMuteButton();
  SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'four',
    repeat: 170,
    buttons: [
      { label: '\u21BB', code: 'KeyE', title: 'Rotate right' },
      { label: '\u21BA', code: 'KeyQ', title: 'Rotate left' }
    ],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });
  loadProgress();
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
