;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TILE_W = 64;
  const TILE_H = 32;
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
    const isoY = (col + row) * (TILE_H / 2) + 60;
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
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 50, `Level ${currentLevel + 1} Complete!`, { color: '#ff0', font: 'bold 18px sans-serif' });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 20, `Moves: ${moves}`, { color: '#ccc', font: '14px sans-serif' });
    screenShake.trigger(4, 200);
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
      checkCollectibles();
      checkGoal();
      return;
    }

    if (!isWalkable(newRow, newCol)) return;

    player.row = newRow;
    player.col = newCol;
    const pos = toScreen(player.col, player.row);
    player.targetX = pos.x;
    player.targetY = pos.y;
    player.moveProgress = 0;
    ++moves;

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

  function drawIsometricTile(col, row, cellType, elevation) {
    const pos = toScreen(col, row, elevation);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    // Tile diamond
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - hh);
    ctx.lineTo(pos.x + hw, pos.y);
    ctx.lineTo(pos.x, pos.y + hh);
    ctx.lineTo(pos.x - hw, pos.y);
    ctx.closePath();

    switch (cellType) {
      case 1:
        ctx.fillStyle = '#334';
        break;
      case 2:
        ctx.fillStyle = '#445';
        break;
      case 3:
        ctx.fillStyle = '#426';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#66f';
        break;
      case 4:
        ctx.fillStyle = '#063';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0f0';
        break;
      default:
        return;
    }

    ctx.fill();
    ctx.shadowBlur = 0;

    // Tile outline
    ctx.strokeStyle = '#556';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Side faces for raised tiles
    if (cellType === 2 || cellType === 3) {
      const depth = 8;
      ctx.fillStyle = '#223';
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + hh);
      ctx.lineTo(pos.x + hw, pos.y);
      ctx.lineTo(pos.x + hw, pos.y + depth);
      ctx.lineTo(pos.x, pos.y + hh + depth);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#112';
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + hh);
      ctx.lineTo(pos.x - hw, pos.y);
      ctx.lineTo(pos.x - hw, pos.y + depth);
      ctx.lineTo(pos.x, pos.y + hh + depth);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTrail() {
    if (trail.length < 2) return;

    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#0af';
    ctx.beginPath();
    for (let i = 0; i < trail.length; ++i) {
      const pos = toScreen(trail[i].col, trail[i].row);
      if (i === 0) ctx.moveTo(pos.x, pos.y);
      else ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawCollectibles() {
    const def = LEVELS[currentLevel];
    if (!def.collectibles) return;
    for (let i = 0; i < def.collectibles.length; ++i) {
      if (collected.includes(i)) continue;
      const gem = def.collectibles[i];
      const pos = toScreen(gem.col, gem.row);
      const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.7;

      ctx.fillStyle = '#ff0';
      ctx.shadowBlur = 12 * pulse;
      ctx.shadowColor = '#ff0';
      ctx.beginPath();
      // Diamond shape
      ctx.moveTo(pos.x, pos.y - 8);
      ctx.lineTo(pos.x + 6, pos.y);
      ctx.lineTo(pos.x, pos.y + 8);
      ctx.lineTo(pos.x - 6, pos.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawPlayer() {
    ctx.fillStyle = '#0af';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0af';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 6, 3, 0, Math.PI * 2);
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
        const elevation = cell === 2 ? 0.5 : 0;
        drawIsometricTile(c, r, cell, elevation);
      }

    drawTrail();
    drawCollectibles();
    drawPlayer();

    if (rotationProgress < 1)
      ctx.restore();
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#88f';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OPTICAL ILLUSION PUZZLE', CANVAS_W / 2, CANVAS_H / 2 - 50);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Navigate impossible architecture', CANVAS_W / 2, CANVAS_H / 2 - 10);
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
      ctx.fillText('LEVEL COMPLETE!', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press any key for next level', CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ALL LEVELS COMPLETE!', CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.textAlign = 'start';
    }

    // Level info
    if (state === STATE_PLAYING) {
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Level ${currentLevel + 1}/${LEVELS.length}: ${LEVELS[currentLevel].name}`, CANVAS_W - 10, 18);
      ctx.fillText(`Moves: ${moves} | Gems: ${collected.length}/${LEVELS[currentLevel].collectibles.length}`, CANVAS_W - 10, 34);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_PLAYING || state === STATE_LEVEL_COMPLETE || state === STATE_GAME_OVER)
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
  loadProgress();
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
