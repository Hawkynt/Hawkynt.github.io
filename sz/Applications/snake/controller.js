;(function() {
  'use strict';

  /* ---- Constants ---- */
  const CELL = 20;
  const STORAGE_KEY = 'sz-snake-high-scores';
  const CONFIG_KEY = 'sz-snake-config';
  const MAX_HIGH_SCORES = 5;
  const INITIAL_LENGTH = 3;
  const FOODS_PER_LEVEL = 5;
  const FOOD_SCORE_BASE = 10;
  const INTERVAL_STEP = 10;
  const AI_KILL_BONUS = 50;
  const AI_RESPAWN_DELAY = 3000;
  const POWERUP_SPAWN_DELAY = 3000;
  const POWERUP_LIFETIME = 15000;
  const POWERUP_BLINK_START = 12000;

  const SPEED_PRESETS = {
    slow:   { base: 200, min: 100 },
    normal: { base: 150, min: 50 },
    fast:   { base: 100, min: 40 },
    insane: { base: 60,  min: 30 }
  };

  const FIELD_SIZES = {
    small:  { cols: 15, rows: 15 },
    medium: { cols: 20, rows: 20 },
    large:  { cols: 80, rows: 60 }
  };

  const DIR = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 }
  };
  const ALL_DIRS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];

  const AI_COLORS = [
    { head: '#e88a2a', body: '#c76f1a' },
    { head: '#9c27b0', body: '#7b1fa2' },
    { head: '#00bcd4', body: '#0097a7' }
  ];

  const TRON_COLORS = {
    player: '#00e5ff',
    ai: ['#ff6d00', '#d500f9', '#ff1744'],
    bg: '#050510',
    grid: 'rgba(0,100,255,0.06)',
    width: 5
  };

  const ZEN_COLORS = {
    bg: '#0a1a0a',
    grid: 'rgba(34,139,34,0.06)',
    leafColors: ['#2e7d32', '#388e3c', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7']
  };

  const MAZE_COLORS = {
    bg: '#1a1208',
    brick: '#8d6e4f',
    mortar: '#3e2723',
    darkBrick: '#5d4037',
    flame: ['#ff6d00', '#ff9100', '#ffab00', '#ffd600'],
    ember: ['#ff6d00', '#e65100', '#bf360c', '#4e342e'],
    coin: '#ffd700',
    coinHighlight: '#fff8e1'
  };

  const POWERUP_TYPES = [
    { id: 'speed',  name: 'Speed+',  color: '#ffeb3b', icon: 'lightning', duration: 8000 },
    { id: 'slow',   name: 'Slow',    color: '#00e5ff', icon: 'clock',     duration: 8000 },
    { id: 'shield', name: 'Shield',  color: '#448aff', icon: 'star',      duration: Infinity },
    { id: 'shrink', name: 'Shrink',  color: '#e040fb', icon: 'minus',     duration: 0 },
    { id: 'magnet', name: 'Magnet',  color: '#ff9100', icon: 'diamond',   duration: 10000 },
    { id: 'ghost',  name: 'Ghost',   color: '#ffffff', icon: 'circle',    duration: 5000 }
  ];

  const PRESETS = {
    classic:      { walls: 'solid', obstacles: 'none',    enemies: 0, powerups: false, fieldSize: 'medium', speed: 'normal' },
    tron:         { walls: 'wrap',  obstacles: 'none',    enemies: 2, powerups: false, fieldSize: 'medium', speed: 'fast', visualTheme: 'tron' },
    mazeRunner:   { walls: 'solid', obstacles: 'maze',    enemies: 0, powerups: true,  fieldSize: 'large',  speed: 'normal', visualTheme: 'maze' },
    battleRoyale: { walls: 'wrap',  obstacles: 'random',  enemies: 3, powerups: true,  fieldSize: 'large',  speed: 'fast' },
    zen:          { walls: 'wrap',  obstacles: 'none',    enemies: 0, powerups: true,  fieldSize: 'medium', speed: 'slow', visualTheme: 'zen' }
  };

  const DEFAULT_CONFIG = { ...PRESETS.classic };

  /* ---- DOM ---- */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusScore = document.getElementById('statusScore');
  const statusLength = document.getElementById('statusLength');
  const statusLevel = document.getElementById('statusLevel');
  const statusEffects = document.getElementById('statusEffects');

  /* ---- Effects ---- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ---- Game Config ---- */
  let gameConfig = { ...DEFAULT_CONFIG };
  let cols, rows, canvasW, canvasH;

  /* ---- State ---- */
  let snake, prevSnake;
  let direction, nextDirection, inputQueue;
  let food;
  let score, level, foodsEaten;
  let gameActive, gamePaused, gameOverFlag, waitingToStart;
  let lastMoveTime, animFrameId, lastTimestamp;
  let lerpT, dpr;
  let pausedForDialog;
  let obstacles;
  let aiSnakes;
  let fieldPowerup;
  let activePowerups;
  let lastPowerupTime;
  let dialogGen;
  let pendingVisualTheme;
  let zenLeaves;
  let mazeBrickCanvas;

  /* ---- Canvas Setup ---- */
  function setupCanvas() {
    const field = FIELD_SIZES[gameConfig.fieldSize] || FIELD_SIZES.medium;
    cols = field.cols;
    rows = field.rows;
    canvasW = cols * CELL;
    canvasH = rows * CELL;
    dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- Config Persistence ---- */
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.tronMode && !saved.visualTheme) {
          saved.visualTheme = 'tron';
          delete saved.tronMode;
        }
        gameConfig = { ...DEFAULT_CONFIG, ...saved };
      }
    } catch (_) {
      gameConfig = { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(gameConfig)); } catch (_) {}
  }

  /* ---- Helpers ---- */
  function getMoveInterval() {
    const spd = SPEED_PRESETS[gameConfig.speed] || SPEED_PRESETS.normal;
    let interval = Math.max(spd.min, spd.base - (level - 1) * INTERVAL_STEP);
    if (hasActiveEffect('speed'))
      interval = Math.round(interval * 0.6);
    else if (hasActiveEffect('slow'))
      interval = Math.round(interval * 1.4);
    return interval;
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function cellKey(x, y) {
    return x + ',' + y;
  }

  function isOpposite(d1, d2) {
    return d1.x + d2.x === 0 && d1.y + d2.y === 0;
  }

  function wrapCoord(val, max) {
    return val < 0 ? max - 1 : val >= max ? 0 : val;
  }

  function hasActiveEffect(id) {
    return activePowerups.some(p => p.type.id === id);
  }

  function cellBlocked(x, y) {
    if (obstacles.has(cellKey(x, y)))
      return true;
    for (const seg of snake)
      if (seg.x === x && seg.y === y)
        return true;
    for (const ai of aiSnakes)
      if (ai.alive)
        for (const seg of ai.body)
          if (seg.x === x && seg.y === y)
            return true;
    return false;
  }

  function cellBlockedForSpawn(x, y) {
    return cellBlocked(x, y) ||
      (food && food.x === x && food.y === y) ||
      (fieldPowerup && fieldPowerup.x === x && fieldPowerup.y === y);
  }

  function isTron() {
    return (gameConfig.visualTheme || null) === 'tron';
  }

  function isZen() {
    return (gameConfig.visualTheme || null) === 'zen';
  }

  function isMaze() {
    return (gameConfig.visualTheme || null) === 'maze';
  }

  function spawnFood() {
    const empty = [];
    for (let x = 0; x < cols; ++x)
      for (let y = 0; y < rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          empty.push({ x, y });
    if (empty.length === 0)
      return;

    if (hasActiveEffect('magnet') && snake.length > 0) {
      const head = snake[0];
      const adjacent = [];
      for (const d of ALL_DIRS) {
        let nx = head.x + d.x, ny = head.y + d.y;
        if (gameConfig.walls === 'wrap') {
          nx = wrapCoord(nx, cols);
          ny = wrapCoord(ny, rows);
        }
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cellBlockedForSpawn(nx, ny))
          adjacent.push({ x: nx, y: ny });
      }
      if (adjacent.length > 0) {
        food = adjacent[randomInt(adjacent.length)];
        return;
      }
    }

    food = empty[randomInt(empty.length)];
  }

  function getPointsForFood() {
    return FOOD_SCORE_BASE * level;
  }

  function updateDisplays() {
    statusScore.textContent = 'Score: ' + score;
    statusLength.textContent = 'Length: ' + snake.length;
    statusLevel.textContent = 'Level: ' + level;
  }

  function updateEffectDisplay() {
    if (!statusEffects)
      return;
    if (!activePowerups || activePowerups.length === 0) {
      statusEffects.style.display = 'none';
      return;
    }
    const now = performance.now();
    const parts = activePowerups.map(p => {
      if (p.expireTime === Infinity)
        return p.type.name;
      const remaining = Math.max(0, Math.ceil((p.expireTime - now) / 1000));
      return p.type.name + ' ' + remaining + 's';
    });
    statusEffects.textContent = parts.join(' | ');
    statusEffects.style.display = '';
  }

  /* ---- Obstacles ---- */
  function generateObstacles() {
    obstacles = new Set();
    if (gameConfig.obstacles === 'none' || gameConfig.obstacles === 'growing')
      return;

    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    const safe = new Set();
    for (let dx = -3; dx <= 3; ++dx)
      for (let dy = -2; dy <= 2; ++dy)
        safe.add(cellKey(cx + dx, cy + dy));

    if (gameConfig.obstacles === 'random') {
      const count = Math.floor(cols * rows * 0.04) + 5;
      let placed = 0;
      while (placed < count) {
        const x = randomInt(cols), y = randomInt(rows);
        const key = cellKey(x, y);
        if (!safe.has(key) && !obstacles.has(key)) {
          obstacles.add(key);
          ++placed;
        }
      }
    } else if (gameConfig.obstacles === 'maze')
      generateMaze(safe);
  }

  function generateMaze(safe) {
    function addWall(x, y) {
      if (x < 0 || x >= cols || y < 0 || y >= rows)
        return;
      const key = cellKey(x, y);
      if (!safe.has(key))
        obstacles.add(key);
    }

    function addSym(x, y) {
      addWall(x, y);
      addWall(cols - 1 - x, y);
      addWall(x, rows - 1 - y);
      addWall(cols - 1 - x, rows - 1 - y);
    }

    const barLen = Math.max(2, Math.floor(cols * 0.2));
    const off1 = Math.floor(rows * 0.25);
    const off2 = Math.floor(cols * 0.25);
    for (let i = 0; i < barLen; ++i) {
      addSym(2 + i, off1);
      addSym(off2, 2 + i);
    }

    const innerLen = Math.max(1, Math.floor(cols * 0.12));
    const innerOff = Math.floor(cols * 0.35);
    for (let i = 0; i < innerLen; ++i)
      addSym(innerOff, off1 + 2 + i);

    addSym(2, 2);
    addSym(3, 2);
    addSym(2, 3);
  }

  function addGrowingWall() {
    let attempts = 0;
    while (attempts < 100) {
      const x = randomInt(cols), y = randomInt(rows);
      const key = cellKey(x, y);
      if (!obstacles.has(key) && !cellBlocked(x, y) &&
          !(food && food.x === x && food.y === y)) {
        obstacles.add(key);
        particles.burst(x * CELL + CELL / 2, y * CELL + CELL / 2, 5, {
          speed: 2, color: '#666', life: 0.5, size: 2
        });
        return;
      }
      ++attempts;
    }
  }

  /* ---- AI Snakes ---- */
  function initAISnakes() {
    aiSnakes = [];
    for (let i = 0; i < gameConfig.enemies; ++i) {
      const pos = findEmptySpawn();
      aiSnakes.push({
        body: [pos, { x: pos.x, y: pos.y }, { x: pos.x, y: pos.y }],
        prevBody: null,
        dir: ALL_DIRS[randomInt(4)],
        alive: true,
        respawnTime: 0,
        colorIdx: i
      });
    }
  }

  function findEmptySpawn() {
    for (let attempt = 0; attempt < 200; ++attempt) {
      const x = 3 + randomInt(Math.max(1, cols - 6));
      const y = 3 + randomInt(Math.max(1, rows - 6));
      let ok = true;
      for (let dx = -2; dx <= 0 && ok; ++dx)
        if (cellBlockedForSpawn(x + dx, y))
          ok = false;
      if (ok)
        return { x, y };
    }
    for (let x = 0; x < cols; ++x)
      for (let y = 0; y < rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          return { x, y };
    return { x: 0, y: 0 };
  }

  function moveAISnakes(timestamp) {
    for (const ai of aiSnakes) {
      if (!ai.alive) {
        if (timestamp >= ai.respawnTime) {
          const pos = findEmptySpawn();
          ai.body = [pos, { x: pos.x, y: pos.y }, { x: pos.x, y: pos.y }];
          ai.prevBody = null;
          ai.dir = ALL_DIRS[randomInt(4)];
          ai.alive = true;
        }
        continue;
      }

      ai.prevBody = ai.body.map(s => ({ x: s.x, y: s.y }));
      const nextDir = bfsDirection(ai);
      if (nextDir)
        ai.dir = nextDir;

      const head = ai.body[0];
      let nx = head.x + ai.dir.x, ny = head.y + ai.dir.y;

      if (gameConfig.walls === 'wrap') {
        nx = wrapCoord(nx, cols);
        ny = wrapCoord(ny, rows);
      } else if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
        ai.body.unshift({ x: Math.max(0, Math.min(cols - 1, nx)), y: Math.max(0, Math.min(rows - 1, ny)) });
        killAI(ai, timestamp);
        continue;
      }

      if (obstacles.has(cellKey(nx, ny)) || snakeAt(nx, ny) || aiCollides(ai, nx, ny)) {
        ai.body.unshift({ x: nx, y: ny });
        killAI(ai, timestamp);
        continue;
      }

      ai.body.unshift({ x: nx, y: ny });

      if (food && nx === food.x && ny === food.y)
        spawnFood();
      else if (!isTron())
        ai.body.pop();
    }
  }

  function snakeAt(x, y) {
    for (const seg of snake)
      if (seg.x === x && seg.y === y)
        return true;
    return false;
  }

  function aiCollides(self, x, y) {
    for (let i = 0; i < self.body.length; ++i)
      if (self.body[i].x === x && self.body[i].y === y)
        return true;
    for (const ai of aiSnakes)
      if (ai !== self && ai.alive)
        for (const seg of ai.body)
          if (seg.x === x && seg.y === y)
            return true;
    return false;
  }

  function killAI(ai, timestamp) {
    ai.alive = false;
    ai.respawnTime = timestamp + AI_RESPAWN_DELAY;

    if (ai.body.length > 0) {
      const h = ai.body[0];
      const deathColor = isTron() ? (TRON_COLORS.ai[ai.colorIdx] || TRON_COLORS.ai[0]) : AI_COLORS[ai.colorIdx].head;
      particles.burst(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2, 15, {
        speed: 4, color: deathColor, life: 0.8, size: 3, gravity: 0.08
      });
    }

    score += AI_KILL_BONUS;
    if (snake.length > 0) {
      const h = snake[0];
      floatingText.add(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2 - 10, '+' + AI_KILL_BONUS, {
        color: '#ff0', font: 'bold 12px sans-serif', decay: 0.02, vy: -1.5
      });
    }
    updateDisplays();
  }

  function bfsDirection(ai) {
    if (!food)
      return null;

    const head = ai.body[0];
    const blocked = new Set(obstacles);
    for (const seg of snake)
      blocked.add(cellKey(seg.x, seg.y));
    for (const other of aiSnakes)
      if (other.alive)
        for (let i = (other === ai ? 1 : 0); i < other.body.length; ++i)
          blocked.add(cellKey(other.body[i].x, other.body[i].y));

    const visited = new Set();
    const queue = [{ x: head.x, y: head.y, firstDir: null }];
    visited.add(cellKey(head.x, head.y));

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.x === food.x && cur.y === food.y)
        return cur.firstDir;

      for (const d of ALL_DIRS) {
        let nx = cur.x + d.x, ny = cur.y + d.y;
        if (gameConfig.walls === 'wrap') {
          nx = wrapCoord(nx, cols);
          ny = wrapCoord(ny, rows);
        } else if (nx < 0 || nx >= cols || ny < 0 || ny >= rows)
          continue;

        const key = cellKey(nx, ny);
        if (!visited.has(key) && !blocked.has(key)) {
          visited.add(key);
          queue.push({ x: nx, y: ny, firstDir: cur.firstDir || d });
        }
      }
    }

    const shuffled = ALL_DIRS.slice().sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      let nx = head.x + d.x, ny = head.y + d.y;
      if (gameConfig.walls === 'wrap') {
        nx = wrapCoord(nx, cols);
        ny = wrapCoord(ny, rows);
      } else if (nx < 0 || nx >= cols || ny < 0 || ny >= rows)
        continue;
      if (!blocked.has(cellKey(nx, ny)) && !isOpposite(d, ai.dir))
        return d;
    }
    return ai.dir;
  }

  /* ---- Power-ups ---- */
  function updatePowerups(timestamp) {
    if (!gameConfig.powerups)
      return;

    if (fieldPowerup && timestamp - fieldPowerup.spawnTime >= POWERUP_LIFETIME) {
      fieldPowerup = null;
      lastPowerupTime = timestamp;
    }

    if (!fieldPowerup && timestamp - lastPowerupTime >= POWERUP_SPAWN_DELAY)
      spawnPowerup(timestamp);

    activePowerups = activePowerups.filter(p =>
      p.expireTime === Infinity || timestamp < p.expireTime
    );
  }

  function spawnPowerup(timestamp) {
    const empty = [];
    for (let x = 0; x < cols; ++x)
      for (let y = 0; y < rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          empty.push({ x, y });
    if (empty.length === 0)
      return;

    const pos = empty[randomInt(empty.length)];
    fieldPowerup = {
      x: pos.x,
      y: pos.y,
      type: POWERUP_TYPES[randomInt(POWERUP_TYPES.length)],
      spawnTime: timestamp
    };
  }

  function collectPowerup(timestamp) {
    if (!fieldPowerup || !gameConfig.powerups)
      return;
    const head = snake[0];
    if (head.x !== fieldPowerup.x || head.y !== fieldPowerup.y)
      return;

    const type = fieldPowerup.type;
    const cx = head.x * CELL + CELL / 2, cy = head.y * CELL + CELL / 2;

    particles.burst(cx, cy, 12, {
      speed: 4, color: type.color, life: 0.8, size: 3, gravity: 0.05, shrink: 0.96
    });
    floatingText.add(cx, cy - 10, type.name, {
      color: type.color, font: 'bold 12px sans-serif', decay: 0.02, vy: -1.5
    });

    applyPowerupEffect(type, timestamp);
    fieldPowerup = null;
    lastPowerupTime = timestamp;
  }

  function applyPowerupEffect(type, timestamp) {
    switch (type.id) {
      case 'shrink':
        if (snake.length > INITIAL_LENGTH) {
          const n = Math.min(3, snake.length - INITIAL_LENGTH);
          for (let i = 0; i < n; ++i)
            snake.pop();
          score += 30;
          updateDisplays();
        }
        break;
      case 'shield':
        activePowerups = activePowerups.filter(p => p.type.id !== 'shield');
        activePowerups.push({ type, expireTime: Infinity });
        break;
      case 'speed':
      case 'slow':
        activePowerups = activePowerups.filter(p => p.type.id !== 'speed' && p.type.id !== 'slow');
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      default:
        activePowerups = activePowerups.filter(p => p.type.id !== type.id);
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
    }
  }

  function useShield() {
    const idx = activePowerups.findIndex(p => p.type.id === 'shield');
    if (idx < 0)
      return false;
    activePowerups.splice(idx, 1);

    const h = snake[0];
    const cx = h.x * CELL + CELL / 2, cy = h.y * CELL + CELL / 2;
    floatingText.add(cx, cy - 10, 'Shield!', {
      color: '#448aff', font: 'bold 14px sans-serif', decay: 0.02, vy: -1.5
    });
    particles.burst(cx, cy, 20, {
      speed: 5, color: '#448aff', life: 0.6, size: 3, shrink: 0.95
    });
    return true;
  }

  /* ---- Zen Leaves ---- */
  function initZenLeaves() {
    zenLeaves = [];
    for (let i = 0; i < 18; ++i)
      zenLeaves.push({
        x: Math.random() * canvasW,
        y: Math.random() * canvasH,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.2 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        size: 4 + Math.random() * 5,
        colorIdx: Math.floor(Math.random() * ZEN_COLORS.leafColors.length),
        opacity: 0.3 + Math.random() * 0.4,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.001 + Math.random() * 0.002
      });
  }

  function updateZenLeaves(timestamp) {
    if (!zenLeaves) return;
    for (const leaf of zenLeaves) {
      leaf.x += leaf.vx + Math.sin(timestamp * leaf.wobbleSpeed + leaf.wobblePhase) * 0.3;
      leaf.y += leaf.vy;
      leaf.rotation += leaf.rotSpeed;

      if (leaf.y > canvasH + 10) {
        leaf.y = -10;
        leaf.x = Math.random() * canvasW;
      }
      if (leaf.x < -10) leaf.x = canvasW + 10;
      else if (leaf.x > canvasW + 10) leaf.x = -10;
    }
  }

  function drawZenLeaves() {
    if (!zenLeaves) return;
    for (const leaf of zenLeaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      ctx.globalAlpha = leaf.opacity;

      const color = ZEN_COLORS.leafColors[leaf.colorIdx];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.globalAlpha = leaf.opacity * 0.5;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-leaf.size, 0);
      ctx.lineTo(leaf.size, 0);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = leaf.opacity * 0.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(leaf.size + 2, -1.5);
      ctx.stroke();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Maze Brick ---- */
  function buildMazeBrickCanvas() {
    mazeBrickCanvas = document.createElement('canvas');
    mazeBrickCanvas.width = canvasW;
    mazeBrickCanvas.height = canvasH;
    const mc = mazeBrickCanvas.getContext('2d');

    mc.fillStyle = MAZE_COLORS.mortar;
    mc.fillRect(0, 0, canvasW, canvasH);

    const brickW = CELL;
    const brickH = CELL / 2;
    const mortarSize = 1;

    for (let row = 0; row * brickH < canvasH; ++row) {
      const offsetX = (row % 2 === 1) ? brickW / 2 : 0;
      for (let col = -1; col * brickW < canvasW + brickW; ++col) {
        const bx = col * brickW + offsetX;
        const by = row * brickH;
        const seed = (row * 137 + col * 59) & 0xff;
        const shade = (seed % 30) - 15;
        const r = Math.max(0, Math.min(255, parseInt(MAZE_COLORS.brick.slice(1, 3), 16) + shade));
        const g = Math.max(0, Math.min(255, parseInt(MAZE_COLORS.brick.slice(3, 5), 16) + shade));
        const b = Math.max(0, Math.min(255, parseInt(MAZE_COLORS.brick.slice(5, 7), 16) + shade));
        mc.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        mc.fillRect(bx + mortarSize, by + mortarSize, brickW - mortarSize * 2, brickH - mortarSize * 2);

        mc.fillStyle = 'rgba(255,255,255,0.06)';
        mc.fillRect(bx + mortarSize, by + mortarSize, brickW - mortarSize * 2, 1);
        mc.fillRect(bx + mortarSize, by + mortarSize, 1, brickH - mortarSize * 2);

        mc.fillStyle = 'rgba(0,0,0,0.1)';
        mc.fillRect(bx + mortarSize, by + brickH - mortarSize - 1, brickW - mortarSize * 2, 1);
        mc.fillRect(bx + brickW - mortarSize - 1, by + mortarSize, 1, brickH - mortarSize * 2);
      }
    }
  }

  function drawMazeBrickBackground() {
    if (mazeBrickCanvas)
      ctx.drawImage(mazeBrickCanvas, 0, 0);
  }

  function drawMazeBrickObstacles() {
    if (obstacles.size === 0) return;
    for (const key of obstacles) {
      const parts = key.split(',');
      const x = +parts[0], y = +parts[1];
      const px = x * CELL, py = y * CELL;

      ctx.fillStyle = MAZE_COLORS.darkBrick;
      ctx.fillRect(px, py, CELL, CELL);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(px, py, CELL, 1);
      ctx.fillRect(px, py, 1, CELL);

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(px, py + CELL - 1, CELL, 1);
      ctx.fillRect(px + CELL - 1, py, 1, CELL);

      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    }
  }

  function drawTorchFlame(cx, cy, dir, timestamp) {
    ctx.save();
    const t = timestamp * 0.006;
    for (let i = 0; i < MAZE_COLORS.flame.length; ++i) {
      const phase = t + i * 1.3;
      const scaleX = (0.6 - i * 0.1) + Math.sin(phase) * 0.15;
      const scaleY = (0.8 - i * 0.12) + Math.cos(phase * 1.3) * 0.12;
      const rx = (CELL / 2 - 1) * scaleX;
      const ry = (CELL / 2 - 1) * scaleY;
      const offsetX = Math.sin(phase * 0.7) * 1.5;
      const offsetY = Math.cos(phase * 0.9) * 1.5;
      ctx.fillStyle = MAZE_COLORS.flame[i];
      ctx.globalAlpha = 0.8 - i * 0.15;
      ctx.beginPath();
      ctx.ellipse(cx + offsetX, cy + offsetY, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff8e1';
    const coreR = 2 + Math.sin(t * 1.7) * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEmberTrail(body, prevBody, t, timestamp) {
    if (body.length === 0) return;
    for (let i = body.length - 1; i >= 1; --i) {
      const prev = prevBody && i < prevBody.length ? prevBody[i] : null;
      const { x: cx, y: cy } = lerpPos(body[i], prev, t);
      const frac = i / body.length;
      const emberIdx = Math.min(Math.floor(frac * MAZE_COLORS.ember.length), MAZE_COLORS.ember.length - 1);
      const color = MAZE_COLORS.ember[emberIdx];
      const radius = CELL / 2 - 2 - frac * 2;

      ctx.globalAlpha = 1 - frac * 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(radius, 2), 0, Math.PI * 2);
      ctx.fill();

      if (i <= 3) {
        ctx.globalAlpha = (0.3 - i * 0.08);
        ctx.fillStyle = '#ff9100';
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCoin(cx, cy, timestamp) {
    const t = timestamp * 0.003;
    const scaleX = Math.abs(Math.cos(t));
    const pulse = Math.sin(t * 2) * 0.1 + 0.9;
    const r = (CELL / 2 - 2) * pulse;

    ctx.save();
    ctx.fillStyle = MAZE_COLORS.coin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(r * scaleX, 1), r, 0, 0, Math.PI * 2);
    ctx.fill();

    if (scaleX > 0.3) {
      ctx.strokeStyle = 'rgba(184,134,11,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max((r - 2) * scaleX, 0.5), r - 2, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (scaleX > 0.5) {
        ctx.fillStyle = 'rgba(184,134,11,0.8)';
        ctx.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
      }
    }

    const glintAngle = t * 1.5;
    const glintX = cx + Math.cos(glintAngle) * r * 0.4 * scaleX;
    const glintY = cy + Math.sin(glintAngle) * r * 0.4;
    ctx.fillStyle = MAZE_COLORS.coinHighlight;
    ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.beginPath();
    ctx.arc(glintX, glintY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ---- Drawing ---- */
  function drawGrid() {
    if (isMaze()) {
      drawMazeBrickBackground();
      return;
    }

    const tron = isTron();
    const zen = isZen();

    if (tron) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,100,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.shadowColor = 'rgba(0,100,255,0.4)';
      ctx.shadowBlur = 2;
      for (let x = 0; x <= cols; ++x) {
        if (x % 5 === 0) continue;
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvasH);
        ctx.stroke();
      }
      for (let y = 0; y <= rows; ++y) {
        if (y % 5 === 0) continue;
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(canvasW, y * CELL);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(0,120,255,0.2)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0,120,255,0.6)';
      ctx.shadowBlur = 6;
      for (let x = 0; x <= cols; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvasH);
        ctx.stroke();
      }
      for (let y = 0; y <= rows; y += 5) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(canvasW, y * CELL);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(0,140,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0,140,255,0.7)';
      ctx.shadowBlur = 8;
      ctx.strokeRect(0.5, 0.5, canvasW - 1, canvasH - 1);
      ctx.restore();
      return;
    }

    const gridColor = zen ? ZEN_COLORS.grid : 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; ++x) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; ++y) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvasW, y * CELL);
      ctx.stroke();
    }

    ctx.strokeStyle = zen ? 'rgba(34,139,34,0.15)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvasW - 1, canvasH - 1);
  }

  function lerpPos(cur, prev, t) {
    if (!prev)
      return { x: cur.x * CELL + CELL / 2, y: cur.y * CELL + CELL / 2 };

    let px = prev.x, py = prev.y;
    if (Math.abs(cur.x - px) > cols / 2)
      px = cur.x;
    if (Math.abs(cur.y - py) > rows / 2)
      py = cur.y;

    const pxPx = px * CELL + CELL / 2, pyPx = py * CELL + CELL / 2;
    const nxPx = cur.x * CELL + CELL / 2, nyPx = cur.y * CELL + CELL / 2;
    return { x: pxPx + (nxPx - pxPx) * t, y: pyPx + (nyPx - pyPx) * t };
  }

  function isBlinking(timestamp) {
    const cycle = timestamp % 3500;
    return cycle > 3350;
  }

  function drawSnakeBody(body, prevBody, dir, headColor, bodyColor, t, ghostAlpha, timestamp) {
    if (body.length === 0)
      return;

    const blinking = isBlinking(timestamp || 0);

    for (let i = body.length - 1; i >= 0; --i) {
      const prev = prevBody && i < prevBody.length ? prevBody[i] : null;
      const { x: cx, y: cy } = lerpPos(body[i], prev, t);
      const frac = i / body.length;

      if (i === 0) {
        if (ghostAlpha < 1)
          ctx.globalAlpha = ghostAlpha;
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        const dx = dir.x, dy = dir.y;
        const perpX = -dy, perpY = dx;

        if (blinking) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          const eyeR = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + dx * 3 + perpX * 3 - eyeR, cy + dy * 3 + perpY * 3);
          ctx.lineTo(cx + dx * 3 + perpX * 3 + eyeR, cy + dy * 3 + perpY * 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + dx * 3 - perpX * 3 - eyeR, cy + dy * 3 - perpY * 3);
          ctx.lineTo(cx + dx * 3 - perpX * 3 + eyeR, cy + dy * 3 - perpY * 3);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(cx + dx * 3 + perpX * 3, cy + dy * 3 + perpY * 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx + dx * 3 - perpX * 3, cy + dy * 3 - perpY * 3, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(cx + dx * 4.5 + perpX * 3, cy + dy * 4.5 + perpY * 3, 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx + dx * 4.5 - perpX * 3, cy + dy * 4.5 - perpY * 3, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        if (ghostAlpha < 1)
          ctx.globalAlpha = ghostAlpha * (1 - frac * 0.3);
        else
          ctx.globalAlpha = 1 - frac * 0.3;

        const r = parseInt(bodyColor.slice(1, 3), 16);
        const g = parseInt(bodyColor.slice(3, 5), 16);
        const b = parseInt(bodyColor.slice(5, 7), 16);
        const dr = Math.round(r + frac * 10);
        const dg = Math.round(g - frac * 40);
        const db = Math.round(b + frac * 10);
        ctx.fillStyle = 'rgb(' + dr + ',' + dg + ',' + db + ')';

        const radius = CELL / 2 - 1.5 - frac * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(radius, 3), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, Math.max(radius * 0.5, 1.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function dirAngle(d) {
    if (d === DIR.UP)    return 0;
    if (d === DIR.RIGHT) return Math.PI / 2;
    if (d === DIR.DOWN)  return Math.PI;
    return -Math.PI / 2;
  }

  function drawTronRider(cx, cy, d, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirAngle(d));

    ctx.shadowColor = color;
    ctx.shadowBlur = 16;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-3, -4);
    ctx.lineTo(-3, 2);
    ctx.quadraticCurveTo(-2, 7, 0, 7);
    ctx.quadraticCurveTo(2, 7, 3, 2);
    ctx.lineTo(3, -4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -1);
    ctx.lineTo(-6, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -1);
    ctx.lineTo(6, -1);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawTronTrail(body, dir, color, prevHead, t) {
    if (body.length === 0)
      return;

    const headPos = prevHead
      ? lerpPos(body[0], prevHead, t)
      : { x: body[0].x * CELL + CELL / 2, y: body[0].y * CELL + CELL / 2 };

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = TRON_COLORS.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.7;

    ctx.beginPath();
    let started = false;
    for (let i = body.length - 1; i >= 0; --i) {
      let px, py;
      if (i === 0) {
        px = headPos.x;
        py = headPos.y;
      } else {
        px = body[i].x * CELL + CELL / 2;
        py = body[i].y * CELL + CELL / 2;
      }

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        const prevSeg = i < body.length - 1 ? body[i + 1] : null;
        if (prevSeg && (Math.abs(body[i].x - prevSeg.x) > 1 || Math.abs(body[i].y - prevSeg.y) > 1)) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px, py);
        } else
          ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();

    drawTronRider(headPos.x, headPos.y, dir, color);
  }

  function drawSnake(timestamp) {
    if (snake.length === 0)
      return;
    const t = gameActive && !gameOverFlag ? lerpT : 1;

    const prevHead = prevSnake && prevSnake.length > 0 ? prevSnake[0] : null;
    const headPos = lerpPos(snake[0], prevHead, t);

    if (isTron()) {
      drawTronTrail(snake, direction, TRON_COLORS.player, prevHead, t);
      if (hasActiveEffect('shield')) {
        ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, CELL / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (isMaze()) {
      drawEmberTrail(snake, prevSnake, t, timestamp);
      drawTorchFlame(headPos.x, headPos.y, direction, timestamp);
      if (hasActiveEffect('shield')) {
        ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, CELL / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    const ghostAlpha = hasActiveEffect('ghost') ? 0.5 : 1;

    drawSnakeBody(snake, prevSnake, direction, '#4caf50', '#2d8f30', t, ghostAlpha, timestamp);

    if (hasActiveEffect('shield')) {
      ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(headPos.x, headPos.y, CELL / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAISnakes(timestamp) {
    const t = gameActive && !gameOverFlag ? lerpT : 1;
    for (const ai of aiSnakes) {
      if (!ai.alive)
        continue;
      const aiPrevHead = ai.prevBody && ai.prevBody.length > 0 ? ai.prevBody[0] : null;
      if (isTron()) {
        const color = TRON_COLORS.ai[ai.colorIdx] || TRON_COLORS.ai[0];
        drawTronTrail(ai.body, ai.dir, color, aiPrevHead, t);
      } else {
        const col = AI_COLORS[ai.colorIdx];
        drawSnakeBody(ai.body, ai.prevBody, ai.dir, col.head, col.body, t, 1, timestamp);
      }
    }
  }

  function drawFood(timestamp) {
    if (!food)
      return;
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    const pulse = Math.sin(timestamp * 0.004) * 0.3 + 0.7;

    if (isTron()) {
      const half = CELL / 2 - 2;
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10 + pulse * 8;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      ctx.globalAlpha = 0.15 + pulse * 0.15;
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.restore();
      return;
    }

    if (isMaze()) {
      drawCoin(cx, cy, timestamp);
      return;
    }

    SZ.GameEffects.drawGlow(ctx, function(c) {
      c.fillStyle = 'rgba(244, 67, 54, 0.6)';
      c.beginPath();
      c.arc(cx, cy, CELL / 2 + 2 + pulse * 3, 0, Math.PI * 2);
      c.fill();
    }, '#f44336', 10 + pulse * 5);

    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - CELL / 2 + 3);
    ctx.lineTo(cx + 2, cy - CELL / 2 - 1);
    ctx.stroke();

    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy - CELL / 2, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacles() {
    if (obstacles.size === 0)
      return;

    if (isMaze()) {
      drawMazeBrickObstacles();
      return;
    }

    for (const key of obstacles) {
      const parts = key.split(',');
      const x = +parts[0], y = +parts[1];
      const px = x * CELL, py = y * CELL;

      ctx.fillStyle = '#444';
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(px + 1, py + 1, CELL - 2, 1);
      ctx.fillRect(px + 1, py + 1, 1, CELL - 2);
    }
  }

  function drawPowerups(timestamp) {
    if (!fieldPowerup || !gameConfig.powerups)
      return;

    const age = timestamp - fieldPowerup.spawnTime;
    if (age >= POWERUP_BLINK_START && Math.floor(timestamp / 200) % 2 === 0)
      return;

    const cx = fieldPowerup.x * CELL + CELL / 2;
    const cy = fieldPowerup.y * CELL + CELL / 2;
    const type = fieldPowerup.type;
    const pulse = Math.sin(timestamp * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(ctx, function(c) {
      c.fillStyle = type.color;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.arc(cx, cy, CELL / 2 + 2 + pulse * 2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }, type.color, 8 + pulse * 4);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    drawPowerupIcon(cx, cy, type, CELL / 2 - 3);
  }

  function drawPowerupIcon(cx, cy, type, size) {
    ctx.fillStyle = type.color;
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1.5;

    switch (type.icon) {
      case 'lightning':
        ctx.beginPath();
        ctx.moveTo(cx + 1, cy - size);
        ctx.lineTo(cx - 3, cy);
        ctx.lineTo(cx + 1, cy);
        ctx.lineTo(cx - 1, cy + size);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx - 1, cy);
        ctx.closePath();
        ctx.fill();
        break;
      case 'clock':
        ctx.beginPath();
        ctx.arc(cx, cy, size - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - size + 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + size - 4, cy);
        ctx.stroke();
        break;
      case 'star': {
        const spikes = 5, outer = size, inner = size * 0.4;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; ++i) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (i * Math.PI / spikes) - Math.PI / 2;
          if (i === 0)
            ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
          else
            ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'minus':
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - size + 2, cy);
        ctx.lineTo(cx + size - 2, cy);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size, cy);
        ctx.closePath();
        ctx.fill();
        break;
      case 'circle':
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        break;
    }
  }

  function drawOverlay(text, subtext) {
    const tron = isTron();
    const zen = isZen();
    const maze = isMaze();

    if (maze)
      ctx.fillStyle = 'rgba(26,18,8,0.85)';
    else if (tron)
      ctx.fillStyle = 'rgba(2,2,8,0.8)';
    else if (zen)
      ctx.fillStyle = 'rgba(10,26,10,0.8)';
    else
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (maze)
      ctx.fillStyle = MAZE_COLORS.coin;
    else if (tron)
      ctx.fillStyle = '#00e5ff';
    else if (zen)
      ctx.fillStyle = '#81c784';
    else
      ctx.fillStyle = '#fff';

    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (tron) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 20;
    } else if (maze) {
      ctx.shadowColor = MAZE_COLORS.coin;
      ctx.shadowBlur = 15;
    }

    ctx.fillText(text, canvasW / 2, canvasH / 2 - 12);

    if (subtext) {
      if (maze)
        ctx.fillStyle = '#8d6e4f';
      else if (tron)
        ctx.fillStyle = '#0097a7';
      else if (zen)
        ctx.fillStyle = '#4caf50';
      else
        ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      ctx.fillText(subtext, canvasW / 2, canvasH / 2 + 16);
    }

    ctx.shadowBlur = 0;
  }

  function render(timestamp) {
    ctx.save();
    if (isTron())
      ctx.fillStyle = TRON_COLORS.bg;
    else if (isZen())
      ctx.fillStyle = ZEN_COLORS.bg;
    else if (isMaze())
      ctx.fillStyle = MAZE_COLORS.bg;
    else
      ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvasW, canvasH);

    screenShake.apply(ctx);
    drawZenLeaves();
    drawGrid();
    drawObstacles();
    drawFood(timestamp || 0);
    drawPowerups(timestamp || 0);
    drawAISnakes(timestamp);
    drawSnake(timestamp);

    particles.draw(ctx);
    floatingText.draw(ctx);
    ctx.restore();

    const overlayTitle = isTron() ? 'TRON' : isMaze() ? 'DUNGEON' : isZen() ? 'ZEN' : 'SNAKE';
    if (waitingToStart)
      drawOverlay(overlayTitle, 'Press Space or F2 for New Game');
    else if (gamePaused)
      drawOverlay('PAUSED', 'Press P to resume');
    else if (gameOverFlag)
      drawOverlay('GAME OVER', 'Score: ' + score + '  --  Press F2 for New Game');
  }

  /* ---- Game Logic ---- */
  function moveSnake(timestamp) {
    prevSnake = snake.map(s => ({ x: s.x, y: s.y }));

    if (inputQueue.length > 0) {
      const next = inputQueue.shift();
      if (!isOpposite(next, direction))
        nextDirection = next;
    }
    direction = nextDirection;
    const head = snake[0];
    let nx = head.x + direction.x;
    let ny = head.y + direction.y;

    if (gameConfig.walls === 'wrap') {
      nx = wrapCoord(nx, cols);
      ny = wrapCoord(ny, rows);
    } else if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
      if (useShield())
        return;
      snake.unshift({ x: Math.max(0, Math.min(cols - 1, nx)), y: Math.max(0, Math.min(rows - 1, ny)) });
      doDeath();
      return;
    }

    if (obstacles.has(cellKey(nx, ny))) {
      if (useShield())
        return;
      snake.unshift({ x: nx, y: ny });
      doDeath();
      return;
    }

    if (!hasActiveEffect('ghost'))
      for (let i = 0; i < snake.length; ++i)
        if (snake[i].x === nx && snake[i].y === ny) {
          if (useShield())
            return;
          snake.unshift({ x: nx, y: ny });
          doDeath();
          return;
        }

    for (const ai of aiSnakes)
      if (ai.alive)
        for (const seg of ai.body)
          if (seg.x === nx && seg.y === ny) {
            if (useShield())
              return;
            snake.unshift({ x: nx, y: ny });
            doDeath();
            return;
          }

    const newHead = { x: nx, y: ny };
    snake.unshift(newHead);

    if (food && nx === food.x && ny === food.y)
      eatFood(nx, ny);
    else if (!isTron()) {
      const tail = snake.pop();
      const trailColor = isMaze() ? 'rgba(255,109,0,0.4)' : 'rgba(76,175,80,0.4)';
      particles.trail(tail.x * CELL + CELL / 2, tail.y * CELL + CELL / 2, {
        color: trailColor, life: 0.3, decay: 0.04, size: 2, shrink: 0.9
      });
    }

    collectPowerup(timestamp);
  }

  function eatFood(fx, fy) {
    const pts = getPointsForFood();
    score += pts;
    ++foodsEaten;

    const cx = fx * CELL + CELL / 2, cy = fy * CELL + CELL / 2;
    particles.burst(cx, cy, 15, {
      speed: 5, color: '#ff0', life: 0.8, size: 3, gravity: 0.05, shrink: 0.96
    });

    const colors = ['#f44', '#ff0', '#4f4', '#4ff', '#f4f', '#fa0'];
    for (let i = 0; i < 8; ++i)
      particles.burst(cx, cy, 1, {
        speed: 3 + Math.random() * 3,
        color: colors[randomInt(colors.length)],
        life: 0.6 + Math.random() * 0.4,
        size: 2 + Math.random() * 2,
        gravity: 0.08
      });

    floatingText.add(cx, cy, '+' + pts, {
      color: '#ff0', font: 'bold 14px sans-serif', decay: 0.02, vy: -1.5
    });

    if (gameConfig.obstacles === 'growing' && foodsEaten % 3 === 0)
      addGrowingWall();

    if (foodsEaten % FOODS_PER_LEVEL === 0) {
      ++level;
      floatingText.add(canvasW / 2, canvasH / 2, 'LEVEL ' + level + '!', {
        color: '#fff', font: 'bold 20px sans-serif', decay: 0.015, vy: -1
      });
    }

    updateDisplays();
    spawnFood();
  }

  function doDeath() {
    gameActive = false;
    gameOverFlag = true;

    const tron = isTron();
    const maze = isMaze();
    const head = snake[0];
    const cx = head.x * CELL + CELL / 2, cy = head.y * CELL + CELL / 2;

    let headColor, bodyColor;
    if (tron) {
      headColor = TRON_COLORS.player;
      bodyColor = TRON_COLORS.player;
    } else if (maze) {
      headColor = '#ff6d00';
      bodyColor = '#e65100';
    } else {
      headColor = '#f44';
      bodyColor = '#4caf50';
    }

    particles.burst(cx, cy, 30, {
      speed: 6, color: headColor, life: 1, size: 4, gravity: 0.1, shrink: 0.97
    });

    for (let i = 1; i < snake.length; i += 2) {
      const seg = snake[i];
      particles.burst(seg.x * CELL + CELL / 2, seg.y * CELL + CELL / 2, 3, {
        speed: 3, color: bodyColor, life: 0.6, size: 2, gravity: 0.05
      });
    }

    screenShake.trigger(8, 400);
    checkHighScore();
  }

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    const dt = lastTimestamp ? timestamp - lastTimestamp : 16;
    lastTimestamp = timestamp;

    particles.update();
    floatingText.update();
    screenShake.update(dt);
    updateZenLeaves(timestamp);

    if (gameActive && !gamePaused && !gameOverFlag && !waitingToStart) {
      updatePowerups(timestamp);
      const interval = getMoveInterval();
      const elapsed = timestamp - lastMoveTime;
      if (elapsed >= interval) {
        moveSnake(timestamp);
        if (gameActive)
          moveAISnakes(timestamp);
        lastMoveTime = timestamp;
        lerpT = 0;
      } else
        lerpT = Math.min(1, elapsed / interval);

      updateEffectDisplay();
    }

    render(timestamp);
  }

  /* ---- Pause ---- */
  function togglePause() {
    if (!gameActive || gameOverFlag || waitingToStart)
      return;
    gamePaused = !gamePaused;
    if (!gamePaused)
      lastMoveTime = performance.now();
  }

  /* ---- High Scores ---- */
  let highScores = [];

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        highScores = JSON.parse(raw);
      if (!Array.isArray(highScores))
        highScores = [];
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores)); } catch (_) {}
  }

  function checkHighScore() {
    if (score <= 0)
      return;
    const entry = { score, length: snake.length };
    if (highScores.length < MAX_HIGH_SCORES || score > highScores[highScores.length - 1].score) {
      highScores.push(entry);
      highScores.sort((a, b) => b.score - a.score);
      if (highScores.length > MAX_HIGH_SCORES)
        highScores.length = MAX_HIGH_SCORES;
      saveHighScores();
    }
  }

  function resetHighScores() {
    highScores = [];
    saveHighScores();
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    body.innerHTML = '';
    if (highScores.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      for (let i = 0; i < highScores.length; ++i) {
        const e = highScores[i];
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.length + '</td>';
        body.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        resetHighScores();
        showHighScores();
      }
    });
  }

  /* ---- Options Dialog ---- */
  function applyConfigToDialog() {
    const cfg = gameConfig;
    const q = (sel) => document.querySelector(sel);
    q('input[name="walls"][value="' + cfg.walls + '"]').checked = true;
    q('input[name="obstacles"][value="' + cfg.obstacles + '"]').checked = true;
    q('input[name="enemies"][value="' + cfg.enemies + '"]').checked = true;
    document.getElementById('optPowerups').checked = cfg.powerups;
    q('input[name="fieldSize"][value="' + cfg.fieldSize + '"]').checked = true;
    q('input[name="speed"][value="' + cfg.speed + '"]').checked = true;
    pendingVisualTheme = cfg.visualTheme || null;
  }

  function readDialogConfig() {
    const q = (sel) => document.querySelector(sel);
    return {
      walls:     q('input[name="walls"]:checked').value,
      obstacles: q('input[name="obstacles"]:checked').value,
      enemies:   parseInt(q('input[name="enemies"]:checked').value, 10),
      powerups:  document.getElementById('optPowerups').checked,
      fieldSize: q('input[name="fieldSize"]:checked').value,
      speed:     q('input[name="speed"]:checked').value
    };
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset)
      return;
    const q = (sel) => document.querySelector(sel);
    q('input[name="walls"][value="' + preset.walls + '"]').checked = true;
    q('input[name="obstacles"][value="' + preset.obstacles + '"]').checked = true;
    q('input[name="enemies"][value="' + preset.enemies + '"]').checked = true;
    document.getElementById('optPowerups').checked = preset.powerups;
    q('input[name="fieldSize"][value="' + preset.fieldSize + '"]').checked = true;
    q('input[name="speed"][value="' + preset.speed + '"]').checked = true;
    pendingVisualTheme = preset.visualTheme || null;
  }

  function showOptionsDialog() {
    if (gameActive && !gamePaused && !gameOverFlag) {
      gamePaused = true;
      pausedForDialog = true;
    }

    applyConfigToDialog();
    const gen = ++dialogGen;

    SZ.Dialog.show('optionsBackdrop').then(result => {
      if (gen !== dialogGen)
        return;
      if (result === 'start') {
        gameConfig = readDialogConfig();
        gameConfig.visualTheme = pendingVisualTheme;
        saveConfig();
        pausedForDialog = false;
        newGame();
      } else {
        if (pausedForDialog) {
          gamePaused = false;
          pausedForDialog = false;
          lastMoveTime = performance.now();
        }
      }
    });
  }

  function setupPresetButtons() {
    const container = document.getElementById('optionsBackdrop');
    if (!container)
      return;
    container.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-preset]');
      if (btn)
        applyPreset(btn.dataset.preset);
    });
  }

  /* ---- Menu System ---- */
  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        showOptionsDialog();
        break;
      case 'pause':
        togglePause();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  /* ---- Keyboard Input ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      SZ.Dialog.close('optionsBackdrop');
      if (pausedForDialog) {
        gamePaused = false;
        pausedForDialog = false;
        lastMoveTime = performance.now();
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      showOptionsDialog();
      return;
    }

    if (e.key === ' ' && (waitingToStart || gameOverFlag)) {
      e.preventDefault();
      showOptionsDialog();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (!gameActive || gamePaused || gameOverFlag || waitingToStart)
      return;

    let qDir = null;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': qDir = DIR.UP;    break;
      case 'ArrowDown':  case 's': case 'S': qDir = DIR.DOWN;  break;
      case 'ArrowLeft':  case 'a': case 'A': qDir = DIR.LEFT;  break;
      case 'ArrowRight': case 'd': case 'D': qDir = DIR.RIGHT; break;
    }
    if (qDir) {
      e.preventDefault();
      const ref = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : direction;
      if (!isOpposite(qDir, ref) && inputQueue.length < 3)
        inputQueue.push(qDir);
    }
  });

  /* ---- New Game ---- */
  function newGame() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    particles.clear();
    floatingText.clear();
    setupCanvas();

    obstacles = new Set();
    aiSnakes = [];
    activePowerups = [];
    fieldPowerup = null;
    lastPowerupTime = performance.now();

    generateObstacles();

    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    snake = [];
    for (let i = 0; i < INITIAL_LENGTH; ++i)
      snake.push({ x: startX - i, y: startY });

    direction = DIR.RIGHT;
    nextDirection = DIR.RIGHT;
    inputQueue = [];
    prevSnake = null;
    lerpT = 1;
    score = 0;
    level = 1;
    foodsEaten = 0;
    gameActive = true;
    gamePaused = false;
    gameOverFlag = false;
    waitingToStart = false;
    pausedForDialog = false;
    lastMoveTime = performance.now();
    lastTimestamp = 0;

    if (isZen())
      initZenLeaves();
    else
      zenLeaves = null;

    if (isMaze())
      buildMazeBrickCanvas();
    else
      mazeBrickCanvas = null;

    spawnFood();
    initAISnakes();
    updateDisplays();

    if (statusEffects)
      statusEffects.style.display = 'none';

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    loadConfig();
    setupCanvas();
    loadHighScores();
    setupPresetButtons();

    snake = [];
    prevSnake = null;
    direction = DIR.RIGHT;
    nextDirection = DIR.RIGHT;
    inputQueue = [];
    food = null;
    score = 0;
    level = 1;
    foodsEaten = 0;
    gameActive = false;
    gamePaused = false;
    gameOverFlag = false;
    waitingToStart = true;
    pausedForDialog = false;
    lastMoveTime = 0;
    lastTimestamp = 0;
    lerpT = 1;
    obstacles = new Set();
    aiSnakes = [];
    activePowerups = [];
    fieldPowerup = null;
    lastPowerupTime = 0;
    dialogGen = 0;
    pendingVisualTheme = gameConfig.visualTheme || null;

    updateDisplays();

    if (statusEffects)
      statusEffects.style.display = 'none';

    animFrameId = requestAnimationFrame(gameLoop);
    showOptionsDialog();
  }

  init();

})();
