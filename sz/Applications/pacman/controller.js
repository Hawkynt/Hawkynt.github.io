;(function() {
  'use strict';

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const COLS = 28;
  const ROWS = 31;
  const TILE = 16;
  const CANVAS_W = COLS * TILE;   // 448
  const CANVAS_H = ROWS * TILE;   // 496

  const STORAGE_KEY = 'sz-pacman-high-scores';
  const MAX_HIGH_SCORES = 5;

  /* Tile types */
  const T_WALL  = 0;
  const T_DOT   = 1;
  const T_POWER = 2;
  const T_EMPTY = 3;
  const T_GHOST_HOUSE = 4;
  const T_GATE  = 5;

  /* Directions */
  const DIR_LEFT  = 0;
  const DIR_UP    = 1;
  const DIR_RIGHT = 2;
  const DIR_DOWN  = 3;
  const DIR_NONE  = -1;

  const DX = [-1, 0, 1, 0];
  const DY = [0, -1, 0, 1];

  /* Ghost modes */
  const MODE_SCATTER    = 0;
  const MODE_CHASE      = 1;
  const MODE_FRIGHTENED = 2;
  const MODE_EATEN      = 3;

  /* Ghost colors */
  const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'];
  const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

  /* Scatter corners (tile coords) */
  const SCATTER_TARGETS = [
    { x: 25, y: -3 },  // Blinky: top-right
    { x: 2,  y: -3 },  // Pinky: top-left
    { x: 27, y: 34 },  // Inky: bottom-right
    { x: 0,  y: 34 }   // Clyde: bottom-left
  ];

  /* Ghost house entry/exit */
  const GHOST_HOUSE_DOOR = { x: 13, y: 11 };
  const GHOST_HOUSE_EXIT = { x: 13, y: 14 };
  const GHOST_START_POS = [
    { x: 13, y: 11 },  // Blinky starts outside
    { x: 13, y: 14 },  // Pinky in house center
    { x: 11, y: 14 },  // Inky in house left
    { x: 15, y: 14 }   // Clyde in house right
  ];

  /* Pac-Man start */
  const PACMAN_START = { x: 13, y: 23 };

  /* Fruit config */
  const FRUIT_POS = { x: 13, y: 17 };
  const FRUIT_TABLE = [
    { name: 'cherry',     pts: 100,  color: '#FF0000' },
    { name: 'strawberry', pts: 300,  color: '#FF4488' },
    { name: 'orange',     pts: 500,  color: '#FFB852' },
    { name: 'apple',      pts: 700,  color: '#FF0000' },
    { name: 'melon',      pts: 1000, color: '#00FF00' },
    { name: 'galaxian',   pts: 2000, color: '#0088FF' },
    { name: 'bell',       pts: 3000, color: '#FFD700' },
    { name: 'key',        pts: 5000, color: '#00FFFF' }
  ];

  /* Mode alternation timings (seconds): [scatter, chase, scatter, chase, ...] */
  const MODE_TIMINGS = [7, 20, 7, 20, 5, 20, 5, Infinity];

  /* Frightened flash warning time */
  const FRIGHTENED_FLASH_TIME = 2000;

  /* Ghost eating sequence points */
  const GHOST_EAT_POINTS = [200, 400, 800, 1600];

  /* --- World Themes --- */
  const WORLD_THEMES = [
    { wall: '#2121DE', wallGlow: '#4444FF', bg: '#000000', dotColor: '#FFB8AE' },
    { wall: '#DE2121', wallGlow: '#FF4444', bg: '#0A0000', dotColor: '#FFDDAA' },
    { wall: '#21DE21', wallGlow: '#44FF44', bg: '#000A00', dotColor: '#FFFFAA' },
    { wall: '#DE21DE', wallGlow: '#FF44FF', bg: '#0A000A', dotColor: '#FFB8FF' },
    { wall: '#DEDE21', wallGlow: '#FFFF44', bg: '#0A0A00', dotColor: '#FFFFFF' },
    { wall: '#21DEDE', wallGlow: '#44FFFF', bg: '#000A0A', dotColor: '#FFE0B8' },
    { wall: '#FF6600', wallGlow: '#FF8844', bg: '#0A0500', dotColor: '#FFD700' },
    { wall: '#8844FF', wallGlow: '#AA66FF', bg: '#050008', dotColor: '#EEDDFF' }
  ];
  const WORLD_SIZE = 4;
  const TRAIL_INTERVAL = 3;

  /* --- Dot Chains --- */
  const DOT_CHAIN_WINDOW = 500;
  const DOT_CHAIN_THRESHOLDS = [5, 10, 20, 50];

  /* --- Powerups --- */
  const POWERUP_TYPES = [
    { id: 'speed',      name: 'Speed+',    color: '#FFEB3B', icon: 'lightning', duration: 5000 },
    { id: 'freeze',     name: 'Freeze',    color: '#00E5FF', icon: 'snowflake', duration: 4000 },
    { id: 'multiplier', name: '2x Score',  color: '#FF9100', icon: 'star',      duration: 8000 },
    { id: 'extralife',  name: 'Extra Life', color: '#4CAF50', icon: 'heart',    duration: 0 },
    { id: 'magnet',     name: 'Magnet',    color: '#E040FB', icon: 'diamond',   duration: 6000 },
    { id: 'phase',      name: 'Phase',     color: '#FFFFFF', icon: 'circle',    duration: 3000 }
  ];
  const POWERUP_SPAWN_INTERVAL = 15000;
  const POWERUP_LIFETIME = 10000;
  const POWERUP_BLINK_START = 7000;
  const POWERUP_MIN_DOTS = 30;

  /* --- Level Config --- */
  const LEVEL_CONFIG = [
    { pac: 0.80, ghost: 0.75, fright: 6000, tunnel: 0.40, elroy1Dots: 20, elroy1Spd: 0.80, elroy2Dots: 10, elroy2Spd: 0.85 },
    { pac: 0.90, ghost: 0.85, fright: 5000, tunnel: 0.45, elroy1Dots: 30, elroy1Spd: 0.90, elroy2Dots: 15, elroy2Spd: 0.95 },
    { pac: 0.90, ghost: 0.85, fright: 4000, tunnel: 0.45, elroy1Dots: 40, elroy1Spd: 0.90, elroy2Dots: 20, elroy2Spd: 0.95 },
    { pac: 0.90, ghost: 0.85, fright: 3000, tunnel: 0.45, elroy1Dots: 40, elroy1Spd: 0.90, elroy2Dots: 20, elroy2Spd: 0.95 },
    { pac: 1.00, ghost: 0.95, fright: 2000, tunnel: 0.50, elroy1Dots: 40, elroy1Spd: 1.00, elroy2Dots: 20, elroy2Spd: 1.05 }
  ];
  const INTERMISSION_DURATION = 4000;

  /* --- Boss --- */
  const BOSS_EVERY = 4;
  const BOSS_BASE_HP = 8;
  const BOSS_HP_PER_BOSS = 4;
  const BOSS_SIZE = 2.5;
  const BOSS_SPEED_BASE = 1.2;
  const BOSS_WARNING_DURATION = 2500;
  const BOSS_VICTORY_DURATION = 3000;
  const BOSS_TYPES = [
    { name: 'Shadow King',   color: '#FF0000', ability: 'summon' },
    { name: 'Phantom Queen',  color: '#FFB8FF', ability: 'teleport' },
    { name: 'Spectral Lord',  color: '#00FFFF', ability: 'freeze' },
    { name: 'Clyde Supreme',  color: '#FFB852', ability: 'split' }
  ];

  /* ================================================================
   *  MAZE DEFINITION
   *  0=wall, 1=dot, 2=power pellet, 3=empty, 4=ghost house, 5=gate
   * ================================================================ */

  const MAZE_TEMPLATE = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    [0,2,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,2,0],
    [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
    [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,3,0,0,3,0,0,0,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,3,0,0,3,0,0,0,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,3,3,3,3,3,3,3,3,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,0,0,0,5,5,0,0,0,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,0,4,4,4,4,4,4,0,3,0,0,1,0,0,0,0,0,0],
    [3,3,3,3,3,3,1,3,3,3,0,4,4,4,4,4,4,0,3,3,3,1,3,3,3,3,3,3],
    [0,0,0,0,0,0,1,0,0,3,0,4,4,4,4,4,4,0,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,3,3,3,3,3,3,3,3,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    [0,2,1,1,0,0,1,1,1,1,1,1,1,3,3,1,1,1,1,1,1,1,0,0,1,1,2,0],
    [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
    [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
    [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
    [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let maze;
  let totalDots;
  let dotsEaten;
  let score;
  let lives;
  let level;
  let gameState; // 'idle' | 'ready' | 'playing' | 'dying' | 'paused' | 'gameover' | 'levelcomplete' | 'intermission' | 'bossIntro' | 'bossVictory'
  let animFrameId;
  let lastTime;

  /* Pac-Man state */
  let pacman;

  /* Ghost state */
  let ghosts;

  /* Mode alternation */
  let modeTimer;
  let modeIndex;
  let currentMode;

  /* Frightened */
  let frightenedTimer;
  let ghostsEatenThisRound;

  /* Fruit */
  let fruitActive;
  let fruitTimer;
  let fruitDotsThreshold1;
  let fruitDotsThreshold2;
  let fruitShown;

  /* Ready/dying animations */
  let readyTimer;
  let dyingTimer;
  let levelCompleteTimer;
  let levelFlashCount;

  /* Theme & visual cache */
  let currentTheme;
  let mazeCache;
  let trailCounter;

  /* Dot chains */
  let dotChainCount;
  let dotChainTimer;
  let electricArcs;

  /* Powerups */
  let fieldPowerup;
  let lastPowerupTime;
  let activePowerups;
  let scoreMultiplier;
  let pacmanPhasing;
  let ghostsFrozen;

  /* Level config */
  let levelConfig;
  let intermissionTimer;

  /* Boss */
  let boss;
  let bossActive;
  let bossWarningTimer;
  let bossVictoryTimer;
  let bossMinions;
  let pacmanSlowed;
  let pacmanSlowTimer;

  /* ================================================================
   *  CANVAS & DPR
   * ================================================================ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitCanvasToFrame();
    const frame = document.querySelector('.game-frame');
    if (frame)
      new ResizeObserver(() => fitCanvasToFrame()).observe(frame);
  }

  function fitCanvasToFrame() {
    const frame = document.querySelector('.game-frame');
    if (!frame)
      return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const aspect = CANVAS_W / CANVAS_H;
    let dw, dh;
    if (fw / fh > aspect) {
      dh = fh;
      dw = Math.floor(fh * aspect);
    } else {
      dw = fw;
      dh = Math.floor(fw / aspect);
    }
    canvas.style.width = dw + 'px';
    canvas.style.height = dh + 'px';
  }

  /* ================================================================
   *  SZ.GameEffects
   * ================================================================ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ================================================================
   *  MAZE HELPERS
   * ================================================================ */

  function cloneMaze() {
    return MAZE_TEMPLATE.map(row => [...row]);
  }

  function countDots(m) {
    let count = 0;
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (m[y][x] === T_DOT || m[y][x] === T_POWER)
          ++count;
    return count;
  }

  function isWall(tx, ty) {
    if (ty < 0 || ty >= ROWS)
      return true;
    if (tx < 0 || tx >= COLS)
      return false;
    return maze[ty][tx] === T_WALL;
  }

  function isWalkable(tx, ty, allowGate) {
    if (ty < 0 || ty >= ROWS)
      return false;
    if (tx < 0 || tx >= COLS)
      return true; // tunnel
    const t = maze[ty][tx];
    if (t === T_WALL)
      return false;
    if (t === T_GATE)
      return !!allowGate;
    return true;
  }

  function wrapX(tx) {
    if (tx < 0)
      return COLS - 1;
    if (tx >= COLS)
      return 0;
    return tx;
  }

  /* ================================================================
   *  ENTITY CREATION
   * ================================================================ */

  function createPacman() {
    return {
      x: PACMAN_START.x * TILE + TILE / 2,
      y: PACMAN_START.y * TILE + TILE / 2,
      tileX: PACMAN_START.x,
      tileY: PACMAN_START.y,
      dir: DIR_LEFT,
      nextDir: DIR_LEFT,
      speed: 2,
      mouthAngle: 0,
      mouthOpening: true,
      moving: false
    };
  }

  function createGhost(index) {
    const start = GHOST_START_POS[index];
    return {
      index,
      x: start.x * TILE + TILE / 2,
      y: start.y * TILE + TILE / 2,
      tileX: start.x,
      tileY: start.y,
      dir: index === 0 ? DIR_LEFT : DIR_UP,
      speed: 1.5,
      mode: MODE_SCATTER,
      inHouse: index !== 0,
      releaseTimer: index * 2000,
      targetX: 0,
      targetY: 0,
      frightenedFlash: false,
      _lastDecTileX: -1,
      _lastDecTileY: -1
    };
  }

  /* ================================================================
   *  MOVEMENT HELPERS
   * ================================================================ */

  function getTile(px, py) {
    return {
      x: Math.floor(px / TILE),
      y: Math.floor(py / TILE)
    };
  }

  function isCentered(entity) {
    const cx = entity.tileX * TILE + TILE / 2;
    const cy = entity.tileY * TILE + TILE / 2;
    return Math.abs(entity.x - cx) < entity.speed + 0.5 &&
           Math.abs(entity.y - cy) < entity.speed + 0.5;
  }

  function snapToCenter(entity) {
    entity.x = entity.tileX * TILE + TILE / 2;
    entity.y = entity.tileY * TILE + TILE / 2;
  }

  function canMove(tileX, tileY, dir, allowGate) {
    const nx = tileX + DX[dir];
    const ny = tileY + DY[dir];
    return isWalkable(nx, ny, allowGate);
  }

  function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  function distanceSq(x1, y1, x2, y2) {
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  }

  function oppositeDir(dir) {
    return (dir + 2) % 4;
  }

  function isActivePowerup(id) {
    return activePowerups.some(ap => ap.type.id === id);
  }

  /* ================================================================
   *  PAC-MAN MOVEMENT
   * ================================================================ */

  function movePacman(dt) {
    if (!pacman.moving && pacman.nextDir !== DIR_NONE)
      pacman.dir = pacman.nextDir;

    /* Check if queued direction is now possible */
    if (pacman.nextDir !== pacman.dir && isCentered(pacman)) {
      if (canMove(pacman.tileX, pacman.tileY, pacman.nextDir, false) || pacmanPhasing) {
        pacman.dir = pacman.nextDir;
        snapToCenter(pacman);
      }
    }

    /* Check if current direction is possible */
    if (isCentered(pacman) && !canMove(pacman.tileX, pacman.tileY, pacman.dir, false)) {
      if (!pacmanPhasing) {
        snapToCenter(pacman);
        pacman.moving = false;
        return;
      }
    }

    pacman.moving = true;

    let spdMult = 1;
    if (pacmanSlowed)
      spdMult *= 0.5;
    const spd = pacman.speed * spdMult * (60 * dt);
    pacman.x += DX[pacman.dir] * spd;
    pacman.y += DY[pacman.dir] * spd;

    /* Tunnel wrap */
    if (pacman.x < -TILE / 2)
      pacman.x += COLS * TILE;
    else if (pacman.x >= COLS * TILE + TILE / 2)
      pacman.x -= COLS * TILE;

    /* Update tile position */
    const tile = getTile(pacman.x, pacman.y);
    pacman.tileX = wrapX(tile.x);
    pacman.tileY = Math.max(0, Math.min(ROWS - 1, tile.y));

    /* Snap at center of next tile */
    const cx = pacman.tileX * TILE + TILE / 2;
    const cy = pacman.tileY * TILE + TILE / 2;
    const prevX = pacman.x - DX[pacman.dir] * spd;
    const prevY = pacman.y - DY[pacman.dir] * spd;

    if (DX[pacman.dir] !== 0) {
      if ((prevX - cx) * (pacman.x - cx) <= 0)
        pacman.y = cy;
    }
    if (DY[pacman.dir] !== 0) {
      if ((prevY - cy) * (pacman.y - cy) <= 0)
        pacman.x = cx;
    }

    /* Animate mouth */
    if (pacman.mouthOpening)
      pacman.mouthAngle += 5 * (60 * dt);
    else
      pacman.mouthAngle -= 5 * (60 * dt);

    if (pacman.mouthAngle >= 45)
      pacman.mouthOpening = false;
    if (pacman.mouthAngle <= 2)
      pacman.mouthOpening = true;

    pacman.mouthAngle = Math.max(0, Math.min(45, pacman.mouthAngle));

    /* Trail particles */
    if (pacman.moving) {
      ++trailCounter;
      if (trailCounter % TRAIL_INTERVAL === 0)
        particles.trail(pacman.x, pacman.y, { color: '#FFD700', size: 1.5, life: 0.3, decay: 0.04, shrink: 0.93 });
    }
  }

  /* ================================================================
   *  MAGNET PULL
   * ================================================================ */

  function magnetPull() {
    let ate = false;
    for (let dy = -3; dy <= 3; ++dy)
      for (let dx = -3; dx <= 3; ++dx) {
        if (Math.abs(dx) + Math.abs(dy) > 3)
          continue;
        const tx = pacman.tileX + dx;
        const ty = pacman.tileY + dy;
        if (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS) {
          if (maze[ty][tx] === T_DOT) {
            maze[ty][tx] = T_EMPTY;
            score += 10 * scoreMultiplier;
            ++dotsEaten;
            ate = true;
            const cx = tx * TILE + TILE / 2;
            const cy = ty * TILE + TILE / 2;
            particles.trail(cx, cy, { color: currentTheme.dotColor, vx: (pacman.x - cx) * 0.1, vy: (pacman.y - cy) * 0.1 });
          }
        }
      }
    if (ate) {
      checkFruitAppearance();
      if (dotsEaten >= totalDots) {
        if (bossActive) {
          maze = cloneMaze();
          totalDots = countDots(maze);
          dotsEaten = 0;
          fruitShown = 0;
        } else {
          startLevelComplete();
        }
      }
      updateStatus();
    }
  }

  /* ================================================================
   *  GHOST AI
   * ================================================================ */

  function getGhostTarget(ghost) {
    if (ghost.mode === MODE_SCATTER)
      return SCATTER_TARGETS[ghost.index];

    if (ghost.mode === MODE_FRIGHTENED)
      return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };

    if (ghost.mode === MODE_EATEN)
      return GHOST_HOUSE_DOOR;

    /* CHASE mode */
    switch (ghost.index) {
      case 0:
        return { x: pacman.tileX, y: pacman.tileY };

      case 1: {
        let tx = pacman.tileX + DX[pacman.dir] * 4;
        let ty = pacman.tileY + DY[pacman.dir] * 4;
        if (pacman.dir === DIR_UP)
          tx -= 4;
        return { x: tx, y: ty };
      }

      case 2: {
        const blinky = ghosts[0];
        const aheadX = pacman.tileX + DX[pacman.dir] * 2;
        const aheadY = pacman.tileY + DY[pacman.dir] * 2;
        return {
          x: aheadX + (aheadX - blinky.tileX),
          y: aheadY + (aheadY - blinky.tileY)
        };
      }

      case 3: {
        const dist = distance(ghost.tileX, ghost.tileY, pacman.tileX, pacman.tileY);
        if (dist > 8)
          return { x: pacman.tileX, y: pacman.tileY };
        return SCATTER_TARGETS[3];
      }
    }

    return { x: pacman.tileX, y: pacman.tileY };
  }

  function chooseGhostDirection(ghost) {
    if (ghost.inHouse)
      return ghost.dir;

    const target = getGhostTarget(ghost);
    ghost.targetX = target.x;
    ghost.targetY = target.y;

    const opposite = oppositeDir(ghost.dir);
    let bestDir = ghost.dir;
    let bestDist = Infinity;
    const allowGate = ghost.mode === MODE_EATEN;

    for (let d = 0; d < 4; ++d) {
      if (d === opposite && ghost.mode !== MODE_FRIGHTENED)
        continue;

      const nx = ghost.tileX + DX[d];
      const ny = ghost.tileY + DY[d];

      if (!isWalkable(nx, ny, allowGate))
        continue;

      if (d === DIR_UP && !allowGate && (
        (ghost.tileY === 11 && (ghost.tileX === 12 || ghost.tileX === 15)) ||
        (ghost.tileY === 23 && (ghost.tileX === 12 || ghost.tileX === 15))
      ))
        continue;

      const dist = distanceSq(nx, ny, target.x, target.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = d;
      }
    }

    return bestDir;
  }

  function moveGhost(ghost, dt) {
    /* Frozen by powerup */
    if (ghostsFrozen && ghost.mode !== MODE_EATEN)
      return;

    /* Handle ghost house behavior */
    if (ghost.inHouse) {
      ghost.releaseTimer -= dt * 1000;
      if (ghost.releaseTimer <= 0) {
        ghost.inHouse = false;
        ghost.x = GHOST_HOUSE_DOOR.x * TILE + TILE / 2;
        ghost.y = GHOST_HOUSE_DOOR.y * TILE + TILE / 2;
        ghost.tileX = GHOST_HOUSE_DOOR.x;
        ghost.tileY = GHOST_HOUSE_DOOR.y;
        ghost.dir = DIR_LEFT;
        ghost._lastDecTileX = -1;
        ghost._lastDecTileY = -1;
        return;
      }
      ghost.y += Math.sin(performance.now() * 0.005) * 0.5;
      return;
    }

    /* Base speed */
    let baseSpeed = ghost.speed;

    /* Cruise Elroy for Blinky */
    if (ghost.index === 0 && ghost.mode !== MODE_FRIGHTENED && ghost.mode !== MODE_EATEN) {
      const remaining = totalDots - dotsEaten;
      if (remaining <= levelConfig.elroy2Dots)
        baseSpeed = 1.5 * levelConfig.elroy2Spd;
      else if (remaining <= levelConfig.elroy1Dots)
        baseSpeed = 1.5 * levelConfig.elroy1Spd;
    }

    /* Mode modifiers */
    if (ghost.mode === MODE_FRIGHTENED)
      baseSpeed *= 0.6;
    else if (ghost.mode === MODE_EATEN)
      baseSpeed *= 2;

    /* Tunnel slowdown */
    if ((ghost.tileX < 6 || ghost.tileX > 21) && ghost.mode !== MODE_EATEN)
      baseSpeed = Math.min(baseSpeed, 1.5 * levelConfig.tunnel);

    const spd = baseSpeed * (60 * dt);

    /* If at center of tile and haven't decided here yet, choose new direction */
    if (isCentered(ghost) && (ghost.tileX !== ghost._lastDecTileX || ghost.tileY !== ghost._lastDecTileY)) {
      snapToCenter(ghost);
      ghost._lastDecTileX = ghost.tileX;
      ghost._lastDecTileY = ghost.tileY;

      if (ghost.mode === MODE_EATEN &&
          ghost.tileX === GHOST_HOUSE_DOOR.x && ghost.tileY === GHOST_HOUSE_DOOR.y) {
        ghost.mode = currentMode;
        ghost.x = GHOST_START_POS[ghost.index].x * TILE + TILE / 2;
        ghost.y = GHOST_START_POS[ghost.index].y * TILE + TILE / 2;
        ghost.tileX = GHOST_START_POS[ghost.index].x;
        ghost.tileY = GHOST_START_POS[ghost.index].y;
        ghost.inHouse = true;
        ghost.releaseTimer = 500;
        ghost._lastDecTileX = -1;
        ghost._lastDecTileY = -1;
        return;
      }

      ghost.dir = chooseGhostDirection(ghost);
    }

    ghost.x += DX[ghost.dir] * spd;
    ghost.y += DY[ghost.dir] * spd;

    /* Tunnel wrap */
    if (ghost.x < -TILE / 2)
      ghost.x += COLS * TILE;
    else if (ghost.x >= COLS * TILE + TILE / 2)
      ghost.x -= COLS * TILE;

    const tile = getTile(ghost.x, ghost.y);
    ghost.tileX = wrapX(tile.x);
    ghost.tileY = Math.max(0, Math.min(ROWS - 1, tile.y));
  }

  function reverseGhosts() {
    for (const g of ghosts) {
      if (!g.inHouse && g.mode !== MODE_EATEN) {
        g.dir = oppositeDir(g.dir);
        g._lastDecTileX = -1;
        g._lastDecTileY = -1;
      }
    }
  }

  /* ================================================================
   *  MODE MANAGEMENT
   * ================================================================ */

  function updateModeTimer(dt) {
    if (currentMode === MODE_FRIGHTENED)
      return;

    modeTimer -= dt * 1000;
    if (modeTimer <= 0) {
      ++modeIndex;
      if (modeIndex >= MODE_TIMINGS.length)
        modeIndex = MODE_TIMINGS.length - 1;

      currentMode = (modeIndex % 2 === 0) ? MODE_SCATTER : MODE_CHASE;
      modeTimer = MODE_TIMINGS[modeIndex] * 1000;

      for (const g of ghosts) {
        if (g.mode !== MODE_EATEN && g.mode !== MODE_FRIGHTENED)
          g.mode = currentMode;
      }
      reverseGhosts();
    }
  }

  function enterFrightenedMode() {
    const duration = levelConfig.fright;
    if (duration <= 0) {
      reverseGhosts();
      return;
    }

    frightenedTimer = duration;
    ghostsEatenThisRound = 0;

    for (const g of ghosts) {
      if (g.mode !== MODE_EATEN && !g.inHouse) {
        g.mode = MODE_FRIGHTENED;
        g.dir = oppositeDir(g.dir);
        g.frightenedFlash = false;
      }
    }

    /* Boss vulnerability during stun */
    if (bossActive && boss && boss.stunned) {
      boss.vulnerable = true;
      boss.vulnerableTimer = duration;
    }
  }

  function updateFrightenedTimer(dt) {
    if (frightenedTimer <= 0)
      return;

    frightenedTimer -= dt * 1000;

    const flashing = frightenedTimer <= FRIGHTENED_FLASH_TIME && frightenedTimer > 0;
    for (const g of ghosts) {
      if (g.mode === MODE_FRIGHTENED)
        g.frightenedFlash = flashing;
    }

    if (frightenedTimer <= 0) {
      frightenedTimer = 0;
      for (const g of ghosts) {
        if (g.mode === MODE_FRIGHTENED)
          g.mode = currentMode;
      }
    }
  }

  /* ================================================================
   *  COLLISIONS & EATING
   * ================================================================ */

  function checkDotEating() {
    const t = maze[pacman.tileY] && maze[pacman.tileY][pacman.tileX];
    if (t === T_DOT) {
      maze[pacman.tileY][pacman.tileX] = T_EMPTY;
      score += 10 * scoreMultiplier;
      ++dotsEaten;

      /* Chain tracking */
      ++dotChainCount;
      dotChainTimer = DOT_CHAIN_WINDOW;

      const sparkleCount = Math.min(3 + Math.floor(dotChainCount / 5), 10);
      particles.sparkle(pacman.x, pacman.y, sparkleCount, { color: currentTheme.dotColor, speed: 1.5 });

      for (const thresh of DOT_CHAIN_THRESHOLDS) {
        if (dotChainCount === thresh) {
          particles.confetti(pacman.x, pacman.y - 10, 15);
          floatingText.add(pacman.x, pacman.y - 15, dotChainCount + 'x CHAIN!', {
            color: '#FFD700', font: 'bold 14px sans-serif', decay: 0.012
          });
          break;
        }
      }

      checkFruitAppearance();
      if (dotsEaten >= totalDots) {
        if (bossActive) {
          maze = cloneMaze();
          totalDots = countDots(maze);
          dotsEaten = 0;
          fruitShown = 0;
        } else {
          startLevelComplete();
        }
      }
    } else if (t === T_POWER) {
      maze[pacman.tileY][pacman.tileX] = T_EMPTY;
      score += 50 * scoreMultiplier;
      ++dotsEaten;
      enterFrightenedMode();
      particles.sparkle(pacman.x, pacman.y, 6, { color: '#fff', speed: 2 });
      if (dotsEaten >= totalDots) {
        if (bossActive) {
          maze = cloneMaze();
          totalDots = countDots(maze);
          dotsEaten = 0;
          fruitShown = 0;
        } else {
          startLevelComplete();
        }
      }
    }
    updateStatus();
  }

  function checkGhostCollisions() {
    for (const g of ghosts) {
      if (g.inHouse)
        continue;

      const dist = distance(pacman.x, pacman.y, g.x, g.y);
      if (dist < TILE * 0.8) {
        if (g.mode === MODE_FRIGHTENED) {
          eatGhost(g);
        } else if (g.mode !== MODE_EATEN) {
          startDying();
          return;
        }
      }
    }
  }

  function eatGhost(ghost) {
    ghost.mode = MODE_EATEN;
    const pts = GHOST_EAT_POINTS[Math.min(ghostsEatenThisRound, 3)] * scoreMultiplier;
    score += pts;
    ++ghostsEatenThisRound;
    floatingText.add(ghost.x, ghost.y, String(pts), {
      color: '#00FFFF', font: 'bold 12px sans-serif', decay: 0.015
    });
    particles.burst(ghost.x, ghost.y, 25, { color: '#4488FF', speed: 3 });
    particles.confetti(ghost.x, ghost.y - 5, 10);
    screenShake.trigger(4, 200);

    electricArcs.push({
      x1: pacman.x, y1: pacman.y,
      x2: ghost.x, y2: ghost.y,
      life: 300
    });

    updateStatus();
  }

  function checkFruitAppearance() {
    if (fruitActive || fruitShown >= 2)
      return;
    if ((dotsEaten === 70 && fruitShown === 0) || (dotsEaten === 170 && fruitShown === 1)) {
      fruitActive = true;
      fruitTimer = 9000;
      ++fruitShown;
    }
  }

  function checkFruitCollision() {
    if (!fruitActive)
      return;
    const fx = FRUIT_POS.x * TILE + TILE / 2;
    const fy = FRUIT_POS.y * TILE + TILE / 2;
    const dist = distance(pacman.x, pacman.y, fx, fy);
    if (dist < TILE) {
      const fruitIndex = Math.min(level - 1, FRUIT_TABLE.length - 1);
      const fruit = FRUIT_TABLE[fruitIndex];
      score += fruit.pts * scoreMultiplier;
      fruitActive = false;
      floatingText.add(fx, fy, String(fruit.pts), {
        color: fruit.color, font: 'bold 12px sans-serif', decay: 0.012
      });
      particles.burst(fx, fy, 12, { color: fruit.color, speed: 2.5 });
      updateStatus();
    }
  }

  function updateFruit(dt) {
    if (!fruitActive)
      return;
    fruitTimer -= dt * 1000;
    if (fruitTimer <= 0)
      fruitActive = false;
  }

  /* ================================================================
   *  POWERUP SYSTEM
   * ================================================================ */

  function spawnPowerup(timestamp) {
    const candidates = [];
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (maze[y][x] === T_EMPTY && !(y >= 11 && y <= 17 && x >= 9 && x <= 18))
          candidates.push({ x, y });

    if (candidates.length === 0)
      return;

    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

    fieldPowerup = {
      tileX: tile.x,
      tileY: tile.y,
      type: type,
      spawnTime: timestamp
    };
  }

  function updatePowerups(dt, timestamp) {
    /* Spawn timing */
    if (!fieldPowerup && dotsEaten >= POWERUP_MIN_DOTS) {
      if (timestamp - lastPowerupTime >= POWERUP_SPAWN_INTERVAL) {
        spawnPowerup(timestamp);
        lastPowerupTime = timestamp;
      }
    }

    /* Field powerup expiry */
    if (fieldPowerup && timestamp - fieldPowerup.spawnTime >= POWERUP_LIFETIME)
      fieldPowerup = null;

    /* Active effect expiry */
    for (let i = activePowerups.length - 1; i >= 0; --i) {
      if (timestamp >= activePowerups[i].expireTime) {
        expirePowerup(activePowerups[i]);
        activePowerups.splice(i, 1);
      }
    }
  }

  function collectPowerup(timestamp) {
    if (!fieldPowerup)
      return;
    if (pacman.tileX !== fieldPowerup.tileX || pacman.tileY !== fieldPowerup.tileY)
      return;

    const type = fieldPowerup.type;
    const px = fieldPowerup.tileX * TILE + TILE / 2;
    const py = fieldPowerup.tileY * TILE + TILE / 2;

    fieldPowerup = null;

    applyPowerup(type, timestamp);
    particles.burst(px, py, 15, { color: type.color, speed: 3 });
    floatingText.add(px, py, type.name, { color: type.color, font: 'bold 12px sans-serif' });
  }

  function applyPowerup(type, timestamp) {
    switch (type.id) {
      case 'speed':
        pacman.speed *= 1.4;
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'freeze':
        ghostsFrozen = true;
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'multiplier':
        scoreMultiplier = 2;
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'extralife':
        ++lives;
        updateStatus();
        break;
      case 'magnet':
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
      case 'phase':
        pacmanPhasing = true;
        activePowerups.push({ type, expireTime: timestamp + type.duration });
        break;
    }
  }

  function expirePowerup(ap) {
    switch (ap.type.id) {
      case 'speed':
        pacman.speed = 2 * levelConfig.pac;
        break;
      case 'freeze':
        ghostsFrozen = false;
        break;
      case 'multiplier':
        scoreMultiplier = 1;
        break;
      case 'phase':
        pacmanPhasing = false;
        break;
    }
  }

  /* ================================================================
   *  BOSS SYSTEM
   * ================================================================ */

  function startBossIntro() {
    bossWarningTimer = BOSS_WARNING_DURATION;
    gameState = 'bossIntro';

    /* Prepare maze for boss fight */
    maze = cloneMaze();
    totalDots = countDots(maze);
    dotsEaten = 0;
    fruitActive = false;
    fruitTimer = 0;
    fruitShown = 0;
    resetPositions();

    pacman.speed = 2 * levelConfig.pac;
    for (const g of ghosts)
      g.speed = 1.5 * levelConfig.ghost;

    /* Create boss */
    const bossIndex = Math.floor((level - 1) / BOSS_EVERY) % BOSS_TYPES.length;
    const bossNum = Math.floor((level - 1) / BOSS_EVERY) + 1;
    boss = {
      x: CANVAS_W / 2,
      y: 6 * TILE,
      hp: BOSS_BASE_HP + (bossNum - 1) * BOSS_HP_PER_BOSS,
      maxHp: BOSS_BASE_HP + (bossNum - 1) * BOSS_HP_PER_BOSS,
      speed: BOSS_SPEED_BASE,
      type: BOSS_TYPES[bossIndex],
      bossNumber: bossNum,
      vulnerable: false,
      stunned: false,
      stunTimer: 0,
      vulnerableTimer: 0,
      invulnTimer: 0,
      abilityTimer: 5000,
      abilityCD: 5000,
      phase2: false
    };
    bossActive = true;
    bossMinions = [];

    /* Reset powerup state */
    fieldPowerup = null;
    activePowerups = [];
    scoreMultiplier = 1;
    pacmanPhasing = false;
    ghostsFrozen = false;
    pacmanSlowed = false;
    pacmanSlowTimer = 0;
  }

  function updateBoss(dt) {
    if (!boss)
      return;

    const ms = dt * 1000;

    /* Invulnerability cooldown */
    if (boss.invulnTimer > 0)
      boss.invulnTimer -= ms;

    /* Stun timer */
    if (boss.stunned) {
      boss.stunTimer -= ms;
      if (boss.stunTimer <= 0) {
        boss.stunned = false;
        boss.vulnerable = false;
      }
    }

    /* Vulnerability timer */
    if (boss.vulnerable) {
      boss.vulnerableTimer -= ms;
      if (boss.vulnerableTimer <= 0)
        boss.vulnerable = false;
    }

    /* Don't move when stunned */
    if (boss.stunned) {
      updateBossMinions(dt);
      return;
    }

    /* Ability timer */
    boss.abilityTimer -= ms;
    if (boss.abilityTimer <= 0) {
      useBossAbility();
      boss.stunned = true;
      boss.stunTimer = 1500;
      boss.abilityTimer = boss.phase2 ? boss.abilityCD * 0.7 : boss.abilityCD;
    }

    /* Movement: gravitate toward Pac-Man */
    const dx = pacman.x - boss.x;
    const dy = pacman.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      const spd = boss.speed * (boss.phase2 ? 1.3 : 1.0);
      boss.x += nx * spd * (60 * dt);
      boss.y += ny * spd * (60 * dt);
    }

    /* Clamp to maze bounds */
    const halfSize = TILE * BOSS_SIZE / 2;
    boss.x = Math.max(halfSize, Math.min(CANVAS_W - halfSize, boss.x));
    boss.y = Math.max(halfSize + 2 * TILE, Math.min(CANVAS_H - halfSize - TILE, boss.y));

    updateBossMinions(dt);
  }

  function updateBossMinions(dt) {
    for (let i = bossMinions.length - 1; i >= 0; --i) {
      const m = bossMinions[i];
      const mdx = pacman.x - m.x;
      const mdy = pacman.y - m.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist > 1) {
        m.x += (mdx / mdist) * 1.5 * (60 * dt);
        m.y += (mdy / mdist) * 1.5 * (60 * dt);
      }
      m.life -= dt * 1000;
      if (m.life <= 0)
        bossMinions.splice(i, 1);
    }
  }

  function useBossAbility() {
    switch (boss.type.ability) {
      case 'summon':
        for (let i = 0; i < 2; ++i) {
          bossMinions.push({
            x: boss.x + (Math.random() - 0.5) * TILE * 2,
            y: boss.y + (Math.random() - 0.5) * TILE * 2,
            color: boss.type.color,
            life: 8000
          });
        }
        break;
      case 'teleport':
        boss.x = (4 + Math.random() * (COLS - 8)) * TILE;
        boss.y = (4 + Math.random() * (ROWS - 8)) * TILE;
        particles.burst(boss.x, boss.y, 20, { color: boss.type.color, speed: 4 });
        break;
      case 'freeze':
        pacmanSlowed = true;
        pacmanSlowTimer = 3000;
        break;
      case 'split':
        for (let i = 0; i < 2; ++i) {
          bossMinions.push({
            x: boss.x + (i === 0 ? -TILE * 2 : TILE * 2),
            y: boss.y,
            color: boss.type.color,
            life: 6000
          });
        }
        break;
    }

    particles.burst(boss.x, boss.y, 15, { color: boss.type.color, speed: 3 });
    floatingText.add(boss.x, boss.y - TILE, boss.type.ability.toUpperCase() + '!', {
      color: boss.type.color, font: 'bold 14px sans-serif'
    });
  }

  function checkBossCollision() {
    if (!bossActive || !boss)
      return;

    const dist = distance(pacman.x, pacman.y, boss.x, boss.y);
    const hitDist = TILE * BOSS_SIZE / 2 + TILE / 2;

    if (dist < hitDist) {
      if (boss.vulnerable && boss.invulnTimer <= 0)
        damageBoss();
      else if (!boss.vulnerable && !boss.stunned)
        startDying();
    }

    /* Check minions */
    for (const m of bossMinions) {
      const mdist = distance(pacman.x, pacman.y, m.x, m.y);
      if (mdist < TILE * 0.8) {
        if (frightenedTimer > 0) {
          m.life = 0;
          score += 200 * scoreMultiplier;
          particles.burst(m.x, m.y, 10, { color: m.color, speed: 3 });
        } else {
          startDying();
          return;
        }
      }
    }
  }

  function damageBoss() {
    --boss.hp;
    boss.invulnTimer = 2000;
    boss.vulnerable = false;

    screenShake.trigger(6, 300);
    particles.burst(boss.x, boss.y, 30, { color: '#FFFFFF', speed: 5 });
    floatingText.add(boss.x, boss.y, '-1 HP', { color: '#FF4444', font: 'bold 16px sans-serif' });

    if (boss.hp <= boss.maxHp / 2 && !boss.phase2) {
      boss.phase2 = true;
      floatingText.add(boss.x, boss.y - 20, 'PHASE 2!', { color: '#FF0000', font: 'bold 18px sans-serif' });
    }

    if (boss.hp <= 0)
      defeatBoss();
  }

  function defeatBoss() {
    const pts = 5000 * boss.bossNumber;
    score += pts * scoreMultiplier;

    screenShake.trigger(12, 800);
    particles.burst(boss.x, boss.y, 60, { color: boss.type.color, speed: 6, gravity: 0.03, life: 1 });
    particles.confetti(boss.x, boss.y, 40);
    floatingText.add(boss.x, boss.y, String(pts), { color: '#FFD700', font: 'bold 20px sans-serif', decay: 0.008 });

    bossActive = false;
    boss = null;
    bossMinions = [];

    gameState = 'bossVictory';
    bossVictoryTimer = BOSS_VICTORY_DURATION;
    updateStatus();
  }

  /* ================================================================
   *  GAME FLOW
   * ================================================================ */

  function startDying() {
    gameState = 'dying';
    dyingTimer = 1500;
    screenShake.trigger(12, 600);
    particles.burst(pacman.x, pacman.y, 50, {
      color: '#FFD700', speed: 4, gravity: 0.05, life: 0.8
    });
  }

  function finishDying() {
    --lives;
    updateStatus();
    if (lives <= 0) {
      gameState = 'gameover';
      bossActive = false;
      boss = null;
      bossMinions = [];
      checkHighScore();
      return;
    }
    resetPositions();
    pacman.speed = 2 * levelConfig.pac;
    for (const g of ghosts)
      g.speed = 1.5 * levelConfig.ghost;

    /* Clear powerup effects on death */
    activePowerups = [];
    scoreMultiplier = 1;
    pacmanPhasing = false;
    ghostsFrozen = false;
    pacmanSlowed = false;
    pacmanSlowTimer = 0;
    fieldPowerup = null;

    startReady();
  }

  function startReady() {
    gameState = 'ready';
    readyTimer = 2000;
  }

  function startLevelComplete() {
    gameState = 'levelcomplete';
    levelCompleteTimer = 2000;
    levelFlashCount = 0;

    particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
    particles.sparkle(50, 50, 10, { color: '#FFD700', speed: 3 });
    particles.sparkle(CANVAS_W - 50, 50, 10, { color: '#FFD700', speed: 3 });
    particles.sparkle(50, CANVAS_H - 50, 10, { color: '#FFD700', speed: 3 });
    particles.sparkle(CANVAS_W - 50, CANVAS_H - 50, 10, { color: '#FFD700', speed: 3 });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'LEVEL COMPLETE!', {
      color: '#FFD700', font: 'bold 18px sans-serif', decay: 0.008
    });
  }

  function finishLevelComplete() {
    if (level % BOSS_EVERY === 0) {
      startBossIntro();
      return;
    }
    advanceLevel();
  }

  function advanceLevel() {
    const prevLevel = level;
    ++level;
    initLevel();

    if (prevLevel % WORLD_SIZE === 0) {
      gameState = 'intermission';
      intermissionTimer = INTERMISSION_DURATION;
    } else {
      startReady();
    }
  }

  function resetPositions() {
    pacman = createPacman();
    ghosts = [createGhost(0), createGhost(1), createGhost(2), createGhost(3)];
    modeTimer = MODE_TIMINGS[0] * 1000;
    modeIndex = 0;
    currentMode = MODE_SCATTER;
    frightenedTimer = 0;
    ghostsEatenThisRound = 0;
  }

  function initLevel() {
    maze = cloneMaze();
    totalDots = countDots(maze);
    dotsEaten = 0;
    fruitActive = false;
    fruitTimer = 0;
    fruitShown = 0;

    /* Level config */
    levelConfig = LEVEL_CONFIG[Math.min(level - 1, LEVEL_CONFIG.length - 1)];

    /* World theme */
    currentTheme = WORLD_THEMES[Math.floor((level - 1) / WORLD_SIZE) % WORLD_THEMES.length];

    /* Build maze cache */
    buildMazeCache();

    resetPositions();

    /* Apply level speeds */
    pacman.speed = 2 * levelConfig.pac;
    for (const g of ghosts)
      g.speed = 1.5 * levelConfig.ghost;

    /* Reset enhanced state */
    trailCounter = 0;
    dotChainCount = 0;
    dotChainTimer = 0;
    electricArcs = [];
    fieldPowerup = null;
    lastPowerupTime = performance.now();
    activePowerups = [];
    scoreMultiplier = 1;
    pacmanPhasing = false;
    ghostsFrozen = false;
    pacmanSlowed = false;
    pacmanSlowTimer = 0;
  }

  function newGame() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    score = 0;
    lives = 3;
    level = 1;
    particles.clear();
    floatingText.clear();
    bossActive = false;
    boss = null;
    bossMinions = [];
    initLevel();
    updateStatus();
    startReady();
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ================================================================
   *  MAZE CACHE
   * ================================================================ */

  function buildMazeCache() {
    const mc = document.createElement('canvas');
    mc.width = CANVAS_W * dpr;
    mc.height = CANVAS_H * dpr;
    const mctx = mc.getContext('2d');
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Draw walls with glow */
    mctx.save();
    mctx.shadowColor = currentTheme.wallGlow;
    mctx.shadowBlur = 6;

    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (MAZE_TEMPLATE[y][x] === T_WALL)
          drawWallTileOnCtx(mctx, x, y, currentTheme.wall);

    /* Second pass for stronger glow */
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (MAZE_TEMPLATE[y][x] === T_WALL)
          drawWallTileOnCtx(mctx, x, y, currentTheme.wall);

    mctx.restore();

    /* Draw gate */
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (MAZE_TEMPLATE[y][x] === T_GATE) {
          mctx.fillStyle = '#FFB8FF';
          mctx.fillRect(x * TILE, y * TILE + TILE / 2 - 1, TILE, 2);
        }

    mazeCache = mc;
  }

  /* ================================================================
   *  DRAWING -- WALL TILE (parameterized)
   * ================================================================ */

  function drawWallTileOnCtx(c, tx, ty, color) {
    const ref = MAZE_TEMPLATE;
    const x = tx * TILE;
    const y = ty * TILE;

    const up    = ty > 0 && ref[ty - 1][tx] === T_WALL;
    const down  = ty < ROWS - 1 && ref[ty + 1][tx] === T_WALL;
    const left  = tx > 0 && ref[ty][tx - 1] === T_WALL;
    const right = tx < COLS - 1 && ref[ty][tx + 1] === T_WALL;

    c.strokeStyle = color;
    c.lineWidth = 2;

    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const r = TILE / 2 - 1;

    if (!up) {
      c.beginPath();
      c.moveTo(left ? x : cx, cy - r);
      c.lineTo(right ? x + TILE : cx, cy - r);
      c.stroke();
    }
    if (!down) {
      c.beginPath();
      c.moveTo(left ? x : cx, cy + r);
      c.lineTo(right ? x + TILE : cx, cy + r);
      c.stroke();
    }
    if (!left) {
      c.beginPath();
      c.moveTo(cx - r, up ? y : cy);
      c.lineTo(cx - r, down ? y + TILE : cy);
      c.stroke();
    }
    if (!right) {
      c.beginPath();
      c.moveTo(cx + r, up ? y : cy);
      c.lineTo(cx + r, down ? y + TILE : cy);
      c.stroke();
    }

    /* Rounded outer corners -- quarter-circle arcs connecting adjacent edge endpoints */
    if (!up && !left) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI, Math.PI * 1.5);
      c.stroke();
    }
    if (!up && !right) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 2);
      c.stroke();
    }
    if (!down && !left) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.5, Math.PI);
      c.stroke();
    }
    if (!down && !right) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 0.5);
      c.stroke();
    }

    /* Inner corners */
    const upLeft    = ty > 0 && tx > 0 && ref[ty - 1][tx - 1] === T_WALL;
    const upRight   = ty > 0 && tx < COLS - 1 && ref[ty - 1][tx + 1] === T_WALL;
    const downLeft  = ty < ROWS - 1 && tx > 0 && ref[ty + 1][tx - 1] === T_WALL;
    const downRight = ty < ROWS - 1 && tx < COLS - 1 && ref[ty + 1][tx + 1] === T_WALL;

    if (up && left && !upLeft) {
      c.beginPath();
      c.arc(cx - r, cy - r, r, 0, Math.PI * 0.5);
      c.stroke();
    }
    if (up && right && !upRight) {
      c.beginPath();
      c.arc(cx + r, cy - r, r, Math.PI * 0.5, Math.PI);
      c.stroke();
    }
    if (down && left && !downLeft) {
      c.beginPath();
      c.arc(cx - r, cy + r, r, Math.PI * 1.5, Math.PI * 2);
      c.stroke();
    }
    if (down && right && !downRight) {
      c.beginPath();
      c.arc(cx + r, cy + r, r, Math.PI, Math.PI * 1.5);
      c.stroke();
    }
  }

  /* ================================================================
   *  DRAWING -- MAZE
   * ================================================================ */

  function drawMaze() {
    /* Draw cached walls (at physical resolution, mapped to logical coords) */
    ctx.drawImage(mazeCache, 0, 0, CANVAS_W, CANVAS_H);

    /* Draw dots and power pellets */
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        const t = maze[y][x];
        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        if (t === T_DOT) {
          ctx.fillStyle = currentTheme.dotColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (t === T_POWER) {
          const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
          SZ.GameEffects.drawGlow(ctx, c => {
            c.fillStyle = currentTheme.dotColor;
            c.beginPath();
            c.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
            c.fill();
          }, '#FFFFFF', 8 * pulse);
        }
      }
  }

  function drawMazeFlash() {
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x)
        if (MAZE_TEMPLATE[y][x] === T_WALL)
          drawWallTileOnCtx(ctx, x, y, '#FFFFFF');
  }

  /* ================================================================
   *  DRAWING -- PAC-MAN
   * ================================================================ */

  function drawPacman() {
    const angle = pacman.mouthAngle * Math.PI / 180;
    let rotation = 0;
    switch (pacman.dir) {
      case DIR_RIGHT: rotation = 0; break;
      case DIR_DOWN:  rotation = Math.PI / 2; break;
      case DIR_LEFT:  rotation = Math.PI; break;
      case DIR_UP:    rotation = -Math.PI / 2; break;
    }

    if (pacmanPhasing) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.01) * 0.2;
    }

    SZ.GameEffects.drawGlow(ctx, c => {
      c.save();
      c.translate(pacman.x, pacman.y);
      c.rotate(rotation);
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, TILE / 2 - 1, angle, Math.PI * 2 - angle);
      c.closePath();
      c.fill();
      c.restore();
    }, '#FFD700', 8);

    if (pacmanPhasing)
      ctx.restore();
  }

  /* ================================================================
   *  DRAWING -- GHOSTS
   * ================================================================ */

  function drawGhosts() {
    for (const g of ghosts)
      drawGhost(g);
  }

  function drawGhost(ghost) {
    const x = ghost.x;
    const y = ghost.y;
    const r = TILE / 2 - 1;

    if (ghost.mode === MODE_EATEN) {
      drawGhostEyes(x, y, ghost.dir);
      return;
    }

    let bodyColor;
    const isFrightened = ghost.mode === MODE_FRIGHTENED;

    if (isFrightened) {
      if (ghost.frightenedFlash) {
        const flash = Math.floor(performance.now() / 150) % 2;
        bodyColor = flash ? '#FFFFFF' : '#2121DE';
      } else {
        bodyColor = '#2121DE';
      }
      /* Frightened glow aura */
      SZ.GameEffects.drawGlow(ctx, c => {
        c.fillStyle = bodyColor;
        c.globalAlpha = 0.3;
        c.beginPath();
        c.arc(x, y, r + 3, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
      }, '#4488FF', 6);
    } else {
      bodyColor = GHOST_COLORS[ghost.index];
    }

    /* Glow for normal ghosts */
    if (!isFrightened) {
      ctx.save();
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 6;
    }

    /* Ghost body: rounded top, wavy bottom */
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(x, y - 2, r, Math.PI, 0, false);
    ctx.lineTo(x + r, y + r);

    const waveTime = performance.now() * 0.008;
    const segments = 3;
    const segW = (r * 2) / segments;
    for (let i = segments - 1; i >= 0; --i) {
      const sx = x + r - i * segW;
      const sy = y + r;
      const cp = Math.sin(waveTime + i * 2) * 2;
      ctx.lineTo(sx - segW / 2, sy + cp - 2);
      ctx.lineTo(sx - segW, sy);
    }

    ctx.closePath();
    ctx.fill();

    if (!isFrightened)
      ctx.restore();

    /* Eyes */
    if (isFrightened)
      drawFrightenedFace(x, y);
    else
      drawGhostEyes(x, y, ghost.dir);
  }

  function drawGhostEyes(x, y, dir) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 3, y - 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    let px = 0, py = 0;
    switch (dir) {
      case DIR_LEFT:  px = -1.5; break;
      case DIR_RIGHT: px = 1.5;  break;
      case DIR_UP:    py = -2;   break;
      case DIR_DOWN:  py = 2;    break;
    }

    ctx.fillStyle = '#2121DE';
    ctx.beginPath();
    ctx.arc(x - 3 + px, y - 3 + py, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3 + px, y - 3 + py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFrightenedFace(x, y) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 3);
    for (let i = 0; i < 5; ++i) {
      const sx = x - 5 + i * 2.5;
      const sy = y + 3 + (i % 2 === 0 ? 0 : -2);
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  /* ================================================================
   *  DRAWING -- FRUIT
   * ================================================================ */

  function drawFruit(timestamp) {
    if (!fruitActive)
      return;
    const fruitIndex = Math.min(level - 1, FRUIT_TABLE.length - 1);
    const fruit = FRUIT_TABLE[fruitIndex];
    const fx = FRUIT_POS.x * TILE + TILE / 2;
    const ts = timestamp || performance.now();
    const bob = Math.sin(ts * 0.004) * 2;
    const fy = FRUIT_POS.y * TILE + TILE / 2 + bob;
    const pulse = Math.sin(ts * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(ctx, c => {
      c.fillStyle = fruit.color;
      c.beginPath();
      c.arc(fx, fy, 5 * pulse, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#00AA00';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(fx, fy - 5 * pulse);
      c.lineTo(fx + 1, fy - 8 * pulse);
      c.stroke();
    }, fruit.color, 6 * pulse);
  }

  /* ================================================================
   *  DRAWING -- POWERUP ITEM
   * ================================================================ */

  function drawPowerupItem(timestamp) {
    if (!fieldPowerup)
      return;

    const x = fieldPowerup.tileX * TILE + TILE / 2;
    const y = fieldPowerup.tileY * TILE + TILE / 2;
    const type = fieldPowerup.type;
    const ts = timestamp || performance.now();
    const age = ts - fieldPowerup.spawnTime;

    /* Blinking when about to expire */
    if (age >= POWERUP_BLINK_START) {
      if (Math.floor(ts / 150) % 2 === 0)
        return;
    }

    const pulse = Math.sin(ts * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(ctx, c => {
      c.fillStyle = type.color;
      c.strokeStyle = type.color;
      drawPowerupIcon(c, x, y, type.icon, TILE * pulse);
    }, type.color, 8 * pulse);
  }

  function drawPowerupIcon(c, x, y, icon, size) {
    const s = size * 0.3;
    switch (icon) {
      case 'lightning':
        c.beginPath();
        c.moveTo(x + s * 0.1, y - s);
        c.lineTo(x - s * 0.3, y + s * 0.1);
        c.lineTo(x + s * 0.1, y + s * 0.1);
        c.lineTo(x - s * 0.1, y + s);
        c.lineTo(x + s * 0.3, y - s * 0.1);
        c.lineTo(x - s * 0.1, y - s * 0.1);
        c.closePath();
        c.fill();
        break;
      case 'snowflake':
        c.lineWidth = 1.5;
        for (let i = 0; i < 6; ++i) {
          const a = i * Math.PI / 3;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          c.stroke();
        }
        break;
      case 'star':
        c.beginPath();
        for (let i = 0; i < 5; ++i) {
          const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
          if (i === 0) c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          else c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        c.closePath();
        c.fill();
        break;
      case 'heart':
        c.beginPath();
        c.moveTo(x, y + s * 0.6);
        c.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.3);
        c.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.6);
        c.fill();
        break;
      case 'diamond':
        c.beginPath();
        c.moveTo(x, y - s);
        c.lineTo(x + s * 0.6, y);
        c.lineTo(x, y + s);
        c.lineTo(x - s * 0.6, y);
        c.closePath();
        c.fill();
        break;
      case 'circle':
        c.beginPath();
        c.arc(x, y, s * 0.7, 0, Math.PI * 2);
        c.fill();
        break;
    }
  }

  /* ================================================================
   *  DRAWING -- BOSS
   * ================================================================ */

  function drawBoss() {
    if (!boss)
      return;

    const x = boss.x;
    const y = boss.y;
    const r = TILE * BOSS_SIZE / 2;
    const glowColor = boss.vulnerable ? '#FFFFFF' : boss.type.color;
    const pulsePhase2 = boss.phase2 ? Math.sin(performance.now() * 0.01) * 0.3 + 0.7 : 1;

    ctx.save();

    if (boss.stunned)
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;

    SZ.GameEffects.drawGlow(ctx, c => {
      c.fillStyle = boss.vulnerable ? '#2121DE' : boss.type.color;
      c.beginPath();
      c.arc(x, y - r * 0.15, r, Math.PI, 0, false);
      c.lineTo(x + r, y + r * 0.7);

      const waveTime = performance.now() * 0.006;
      const segments = 5;
      const segW = (r * 2) / segments;
      for (let i = segments - 1; i >= 0; --i) {
        const sx = x + r - i * segW;
        const sy = y + r * 0.7;
        const cp = Math.sin(waveTime + i * 2) * 3;
        c.lineTo(sx - segW / 2, sy + cp - 3);
        c.lineTo(sx - segW, sy);
      }
      c.closePath();
      c.fill();
    }, glowColor, 12 * pulsePhase2);

    /* Crown */
    if (!boss.vulnerable) {
      ctx.fillStyle = '#FFD700';
      const crownY = y - r - 4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, crownY);
      ctx.lineTo(x - r * 0.4, crownY - 8);
      ctx.lineTo(x - r * 0.15, crownY - 3);
      ctx.lineTo(x, crownY - 10);
      ctx.lineTo(x + r * 0.15, crownY - 3);
      ctx.lineTo(x + r * 0.4, crownY - 8);
      ctx.lineTo(x + r * 0.5, crownY);
      ctx.closePath();
      ctx.fill();
    }

    /* Eyes */
    const eyeScale = BOSS_SIZE * 0.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.15, 4 * eyeScale, 5 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y - r * 0.15, 4 * eyeScale, 5 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Pupils tracking Pac-Man */
    const pdx = pacman.x - x;
    const pdy = pacman.y - y;
    const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
    const ppx = (pdx / pd) * 2;
    const ppy = (pdy / pd) * 2;

    ctx.fillStyle = boss.vulnerable ? '#FF0000' : '#2121DE';
    ctx.beginPath();
    ctx.arc(x - r * 0.25 + ppx, y - r * 0.15 + ppy, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.25 + ppx, y - r * 0.15 + ppy, 2.5 * eyeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    /* Draw minions */
    for (const m of bossMinions)
      drawMinion(m);
  }

  function drawMinion(m) {
    const r = TILE / 3;
    ctx.save();
    ctx.globalAlpha = Math.min(1, m.life / 1000);
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(m.x, m.y - 1, r, Math.PI, 0, false);
    ctx.lineTo(m.x + r, m.y + r * 0.8);
    ctx.lineTo(m.x, m.y + r * 0.5);
    ctx.lineTo(m.x - r, m.y + r * 0.8);
    ctx.closePath();
    ctx.fill();

    /* Small eyes */
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(m.x - 2, m.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.x + 2, m.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBossHealthBar() {
    if (!boss)
      return;

    const barW = 200;
    const barH = 12;
    const bx = (CANVAS_W - barW) / 2;
    const by = 6;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    const hpFrac = boss.hp / boss.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#4CAF50' : hpFrac > 0.25 ? '#FFEB3B' : '#F44336';
    ctx.fillRect(bx, by, barW * hpFrac, barH);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);

    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(boss.type.name + ' (' + boss.hp + '/' + boss.maxHp + ')', CANVAS_W / 2, by + barH + 12);
  }

  function drawBossIntro() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const flash = Math.floor(performance.now() / 200) % 2;
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = flash ? '#FF0000' : '#FF4444';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('WARNING', CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.fillText('WARNING', CANVAS_W / 2, CANVAS_H / 2 - 30);

    const bossIndex = Math.floor((level - 1) / BOSS_EVERY) % BOSS_TYPES.length;
    const bossType = BOSS_TYPES[bossIndex];
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = bossType.color;
    ctx.strokeText(bossType.name, CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.fillText(bossType.name, CANVAS_W / 2, CANVAS_H / 2 + 10);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('BOSS APPROACHING', CANVAS_W / 2, CANVAS_H / 2 + 35);
  }

  /* ================================================================
   *  DRAWING -- INTERMISSION
   * ================================================================ */

  function drawIntermission() {
    ctx.fillStyle = currentTheme.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const progress = 1 - (intermissionTimer / INTERMISSION_DURATION);
    const cy = CANVAS_H / 2;

    /* Ghost running from Pac-Man */
    const ghostX = CANVAS_W + 50 - progress * (CANVAS_W + 150);
    const pacX = ghostX + 40;

    /* Draw frightened ghost */
    if (ghostX > -20 && ghostX < CANVAS_W + 20) {
      const r = TILE / 2 - 1;
      ctx.fillStyle = '#2121DE';
      ctx.beginPath();
      ctx.arc(ghostX, cy - 2, r, Math.PI, 0, false);
      ctx.lineTo(ghostX + r, cy + r);
      ctx.lineTo(ghostX + r / 2, cy + r - 3);
      ctx.lineTo(ghostX, cy + r);
      ctx.lineTo(ghostX - r / 2, cy + r - 3);
      ctx.lineTo(ghostX - r, cy + r);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ghostX - 3, cy - 3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ghostX + 3, cy - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Draw chasing Pac-Man */
    if (pacX > -20 && pacX < CANVAS_W + 20) {
      const mouth = Math.abs(Math.sin(performance.now() * 0.01)) * 45 * Math.PI / 180;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(pacX, cy);
      ctx.arc(pacX, cy, TILE / 2 - 1, Math.PI + mouth, Math.PI - mouth);
      ctx.closePath();
      ctx.fill();
    }

    /* World transition text */
    const worldNum = Math.floor((level - 1) / WORLD_SIZE) + 1;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('WORLD ' + worldNum, CANVAS_W / 2, CANVAS_H / 2 - 60);
    ctx.fillText('WORLD ' + worldNum, CANVAS_W / 2, CANVAS_H / 2 - 60);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = currentTheme.wall;
    ctx.fillText(currentTheme === WORLD_THEMES[0] ? '' : 'New theme!', CANVAS_W / 2, CANVAS_H / 2 + 60);
  }

  /* ================================================================
   *  DRAWING -- OVERLAY TEXT
   * ================================================================ */

  function drawOverlayText(text, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);

    if (sub) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 15);
    }
  }

  function drawReadyText() {
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('READY!', CANVAS_W / 2, 17 * TILE + TILE / 2);
  }

  /* ================================================================
   *  DRAWING -- MAIN DRAW
   * ================================================================ */

  function draw(timestamp) {
    ctx.fillStyle = currentTheme ? currentTheme.bg : '#000000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    screenShake.apply(ctx);

    /* Intermission renders its own scene */
    if (gameState === 'intermission') {
      ctx.restore();
      drawIntermission();
      return;
    }

    /* Boss intro overlay */
    if (gameState === 'bossIntro') {
      drawMaze();
      ctx.restore();
      drawBossIntro();
      return;
    }

    /* Draw maze (with flashing for level complete) */
    if (gameState === 'levelcomplete') {
      const flash = Math.floor(performance.now() / 200) % 2;
      if (flash)
        drawMazeFlash();
      else
        drawMaze();
    } else {
      drawMaze();
    }

    /* Draw fruit */
    drawFruit(timestamp);

    /* Draw powerup item */
    drawPowerupItem(timestamp);

    /* Draw Pac-Man */
    if (gameState !== 'dying' || dyingTimer > 1000)
      drawPacman();
    else {
      const progress = 1 - dyingTimer / 1000;
      ctx.save();
      ctx.translate(pacman.x, pacman.y);
      ctx.scale(1 - progress, 1 - progress);
      ctx.translate(-pacman.x, -pacman.y);
      drawPacman();
      ctx.restore();
    }

    /* Draw ghosts */
    if (gameState !== 'dying')
      drawGhosts();

    /* Draw boss */
    if (bossActive)
      drawBoss();

    /* Draw electric arcs */
    for (const arc of electricArcs)
      SZ.GameEffects.drawElectricArc(ctx, arc.x1, arc.y1, arc.x2, arc.y2);

    /* Draw effects */
    particles.draw(ctx);
    floatingText.draw(ctx);

    ctx.restore();

    /* Draw boss health bar outside shake transform */
    if (bossActive)
      drawBossHealthBar();

    /* Draw overlays */
    if (gameState === 'ready')
      drawReadyText();
    else if (gameState === 'paused')
      drawOverlayText('PAUSED', 'Press P to resume');
    else if (gameState === 'gameover')
      drawOverlayText('GAME OVER', 'Press Space or F2 for new game');
    else if (gameState === 'idle')
      drawOverlayText('PAC-MAN', 'Press Space to start');
    else if (gameState === 'bossVictory')
      drawOverlayText('BOSS DEFEATED!', 'Well done!');

    updateEffectDisplay(timestamp);
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  function updateStatus() {
    statusScore.textContent = 'Score: ' + score;
    statusLives.textContent = 'Lives: ' + lives;
    statusLevel.textContent = 'Level: ' + level;
  }

  function updateEffectDisplay(timestamp) {
    const el = document.getElementById('statusEffects');
    if (!el)
      return;

    if (!activePowerups || activePowerups.length === 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    const ts = timestamp || performance.now();
    const parts = activePowerups.map(ap => {
      const remaining = Math.max(0, Math.ceil((ap.expireTime - ts) / 1000));
      return ap.type.name + ' ' + remaining + 's';
    });
    el.textContent = parts.join(' | ');
  }

  /* ================================================================
   *  GAME LOOP
   * ================================================================ */

  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    switch (gameState) {
      case 'ready':
        readyTimer -= dt * 1000;
        if (readyTimer <= 0)
          gameState = 'playing';
        break;

      case 'playing':
        updateModeTimer(dt);
        updateFrightenedTimer(dt);

        /* Boss slow effect */
        if (pacmanSlowed) {
          pacmanSlowTimer -= dt * 1000;
          if (pacmanSlowTimer <= 0)
            pacmanSlowed = false;
        }

        movePacman(dt);
        if (isActivePowerup('magnet'))
          magnetPull();

        for (const g of ghosts)
          moveGhost(g, dt);

        checkDotEating();
        checkGhostCollisions();
        if (bossActive) {
          updateBoss(dt);
          checkBossCollision();
        }
        checkFruitCollision();
        updateFruit(dt);
        updatePowerups(dt, timestamp);
        collectPowerup(timestamp);

        /* Dot chain timer */
        if (dotChainTimer > 0) {
          dotChainTimer -= dt * 1000;
          if (dotChainTimer <= 0)
            dotChainCount = 0;
        }

        break;

      case 'dying':
        dyingTimer -= dt * 1000;
        if (dyingTimer <= 0)
          finishDying();
        break;

      case 'levelcomplete':
        levelCompleteTimer -= dt * 1000;
        if (levelCompleteTimer <= 0)
          finishLevelComplete();
        break;

      case 'intermission':
        intermissionTimer -= dt * 1000;
        if (intermissionTimer <= 0)
          startReady();
        break;

      case 'bossIntro':
        bossWarningTimer -= dt * 1000;
        if (bossWarningTimer <= 0)
          gameState = 'playing';
        break;

      case 'bossVictory':
        bossVictoryTimer -= dt * 1000;
        if (bossVictoryTimer <= 0)
          advanceLevel();
        break;

      case 'paused':
      case 'gameover':
      case 'idle':
        break;
    }

    screenShake.update(dt * 1000);
    particles.update();
    floatingText.update();

    /* Update electric arcs */
    for (let i = electricArcs.length - 1; i >= 0; --i) {
      electricArcs[i].life -= dt * 1000;
      if (electricArcs[i].life <= 0)
        electricArcs.splice(i, 1);
    }

    draw(timestamp);
  }

  /* ================================================================
   *  PAUSE
   * ================================================================ */

  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'playing';
      lastTime = performance.now();
    }
  }

  /* ================================================================
   *  HIGH SCORES
   * ================================================================ */

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
    } catch (_) { /* storage full or unavailable */ }
  }

  function checkHighScore() {
    if (score <= 0)
      return;
    const entry = { score, level };
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
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.level + '</td>';
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

  /* ================================================================
   *  MENU SYSTEM
   * ================================================================ */

  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        newGame();
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

  /* ================================================================
   *  KEYBOARD INPUT
   * ================================================================ */

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (gameState === 'idle' || gameState === 'gameover')
        newGame();
      return;
    }

    if (gameState !== 'playing')
      return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        pacman.nextDir = DIR_LEFT;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        pacman.nextDir = DIR_UP;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        pacman.nextDir = DIR_RIGHT;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        pacman.nextDir = DIR_DOWN;
        break;
    }
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    setupCanvas();
    loadHighScores();

    gameState = 'idle';
    score = 0;
    lives = 3;
    level = 1;
    bossActive = false;
    boss = null;
    bossMinions = [];
    initLevel();
    updateStatus();

    lastTime = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  init();

})();
