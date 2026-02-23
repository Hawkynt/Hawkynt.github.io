;(function() {
  'use strict';

  const { User32 } = SZ.Dlls;
  const { ParticleSystem, ScreenShake, FloatingText, drawGlow, Starfield } = SZ.GameEffects;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const STORAGE_KEY = 'sz-space-invaders-high-scores';
  const MAX_HIGH_SCORES = 10;

  const GAME_W = 480;
  const GAME_H = 540;

  const ALIEN_W = 24;
  const ALIEN_H = 18;
  const ALIEN_PAD_X = 12;
  const ALIEN_PAD_Y = 10;

  const PLAYER_W = 30;
  const PLAYER_H = 16;
  const PLAYER_SPEED = 4;
  const PLAYER_Y_OFFSET = 40;

  const BULLET_W = 3;
  const BULLET_H = 10;
  const BULLET_SPEED = 7;
  const LASER_W = 6;

  const ALIEN_BULLET_SPEED = 3;
  const ALIEN_BULLET_W = 3;
  const ALIEN_BULLET_H = 12;

  const SHIELD_COUNT = 4;
  const SHIELD_BLOCK_SIZE = 4;
  const SHIELD_COLS = 16;
  const SHIELD_ROWS = 12;
  const SHIELD_Y_OFFSET = 80;

  const UFO_W = 32;
  const UFO_H = 14;
  const UFO_SPEED = 2;
  const UFO_MIN_INTERVAL = 10000;
  const UFO_MAX_INTERVAL = 25000;

  const BOSS_W = 80;
  const BOSS_H = 40;
  const BOSS_BASE_HP = 15;
  const BOSS_HP_PER_BOSS = 5;

  const DRONE_W = 16;
  const DRONE_H = 10;
  const DRONE_SHOOT_INTERVAL = 800;

  const ALIEN_DROP = 12;
  const BASE_MOVE_INTERVAL = 800;
  const MIN_MOVE_INTERVAL = 60;

  const POWERUP_SIZE = 16;
  const POWERUP_FALL_SPEED = 1.2;
  const POWERUP_DROP_CHANCE = 0.08;
  const POWERUP_DROP_CHANCE_SPECIAL = 0.20;

  const COMBO_TIMEOUT = 1500;
  const COMBO_MULTIPLIERS = [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5];

  /* ================================================================
   *  ALIEN TYPE INFO
   * ================================================================ */

  const ALIEN_TYPE_INFO = [
    null,
    { points: 30, color: '#f44', drawIndex: 0 },
    { points: 20, color: '#ff4', drawIndex: 1 },
    { points: 10, color: '#4f4', drawIndex: 2 },
    { points: 50, color: '#f80', drawIndex: 0 },
    { points: 40, color: '#4ff', drawIndex: 1 },
  ];

  /* ================================================================
   *  POWER-UP DEFINITIONS
   * ================================================================ */

  const POWERUPS = [
    { id: 'tripleShot', name: 'Triple Shot', abbr: 'TRI', color: '#0ff', duration: 8000, weight: 20 },
    { id: 'rapidFire', name: 'Rapid Fire', abbr: 'RPD', color: '#ff0', duration: 6000, weight: 20 },
    { id: 'shield', name: 'Shield', abbr: 'SHD', color: '#88f', duration: 5000, weight: 12 },
    { id: 'laser', name: 'Laser', abbr: 'LAS', color: '#f0f', duration: 4000, weight: 10 },
    { id: 'slowMo', name: 'Slow-Mo', abbr: 'SLO', color: '#aaf', duration: 5000, weight: 15 },
    { id: 'extraLife', name: 'Extra Life', abbr: '+HP', color: '#f88', duration: 0, weight: 5 },
    { id: 'bomb', name: 'Bomb', abbr: 'BOM', color: '#fa0', duration: 0, weight: 5 },
    { id: 'drone', name: 'Drone', abbr: 'DRN', color: '#8f8', duration: 10000, weight: 13 },
  ];

  const TOTAL_POWERUP_WEIGHT = POWERUPS.reduce((s, p) => s + p.weight, 0);

  function pickRandomPowerup() {
    let r = Math.random() * TOTAL_POWERUP_WEIGHT;
    for (const p of POWERUPS) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return POWERUPS[0];
  }

  /* ================================================================
   *  WAVE FORMATIONS
   * ================================================================ */

  const FORMATIONS = [
    { name: 'Classic Grid', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'V-Formation', grid: [
      [1,0,0,0,0,0,0,0,0,0,1],
      [2,2,0,0,0,0,0,0,0,2,2],
      [0,2,2,0,0,0,0,0,2,2,0],
      [0,0,3,3,0,0,0,3,3,0,0],
      [0,0,0,3,3,0,3,3,0,0,0],
    ]},
    { name: 'Diamond Strike', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,2,2,2,2,2,2,2,2,2,0],
      [0,0,0,3,3,3,3,3,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
    ]},
    { name: 'Arrow Assault', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,0,3,3,3,3,3,3,3,0,0],
      [0,3,3,0,0,0,0,0,3,3,0],
    ]},
    { name: 'Cross Attack', grid: [
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,0,0,3,3,3,0,0,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { name: 'Zigzag', grid: [
      [1,1,0,1,1,0,1,1,0,1,1],
      [0,2,2,0,2,2,0,2,2,0,0],
      [2,0,2,2,0,2,2,0,2,2,0],
      [0,3,0,3,3,0,3,3,0,3,3],
      [3,3,3,0,3,3,0,3,3,0,3],
    ]},
    { name: 'Fortress', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,2,0,0,0,0,0,2,0,0],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,0,0,0,3,3,3,0,0,0,3],
    ]},
    { name: 'Wings', grid: [
      [1,1,0,0,0,0,0,0,0,1,1],
      [2,2,2,0,0,0,0,0,2,2,2],
      [0,2,2,2,0,0,0,2,2,2,0],
      [0,0,3,3,3,0,3,3,3,0,0],
      [0,0,0,3,3,3,3,3,0,0,0],
    ]},
    { name: 'Scatter', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,0,3,0,3,0,3,0,3,0,3],
    ]},
    { name: 'Phalanx', grid: [
      [5,1,1,1,1,1,1,1,1,1,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [4,2,2,2,4,2,4,2,2,2,4],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Diver Squadron', grid: [
      [4,0,4,0,4,0,4,0,4,0,4],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Shield Wall', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [5,5,5,5,5,5,5,5,5,5,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
  ];

  const BOSS_ESCORTS = [
    { grid: [
      [0,0,2,0,2,0,2,0,2,0,0],
      [0,0,0,3,0,3,0,3,0,0,0],
    ]},
    { grid: [
      [0,4,0,0,0,0,0,0,0,4,0],
      [0,0,2,2,0,0,0,2,2,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { grid: [
      [5,0,0,5,0,0,0,5,0,0,5],
      [0,2,2,0,2,2,2,0,2,2,0],
    ]},
    { grid: [
      [4,0,4,0,0,0,0,0,4,0,4],
      [0,2,0,2,0,0,0,2,0,2,0],
      [0,0,3,0,3,0,3,0,3,0,0],
    ]},
  ];

  /* ================================================================
   *  PLAY MODES
   * ================================================================ */

  const MODES = {
    classic: { name: 'Classic', bossEvery: 5, powerupMult: 1.0 },
    survival: { name: 'Survival', bossEvery: 0, powerupMult: 1.5 },
    bossRush: { name: 'Boss Rush', bossEvery: 1, powerupMult: 2.0 },
  };

  /* ================================================================
   *  CANVAS SETUP
   * ================================================================ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = GAME_W;
  let canvasH = GAME_H;
  let dpr = 1;
  let gameScale = 1;
  let gameOffsetX = 0;
  let gameOffsetY = 0;

  function resizeCanvas() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    const scaleX = canvasW / GAME_W;
    const scaleY = canvasH / GAME_H;
    gameScale = Math.min(scaleX, scaleY);
    gameOffsetX = (canvasW - GAME_W * gameScale) / 2;
    gameOffsetY = (canvasH - GAME_H * gameScale) / 2;
  }

  window.addEventListener('resize', resizeCanvas);

  /* ================================================================
   *  GAME EFFECTS
   * ================================================================ */

  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const floatingText = new FloatingText();
  let starfield = new Starfield(GAME_W, GAME_H, 80);

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let gameMode = 'classic';
  let aliens = [];
  let alienDir = 1;
  let alienMoveTimer = 0;
  let alienMoveInterval = BASE_MOVE_INTERVAL;
  let alienBullets = [];
  let alienShootTimer = 0;
  let alienShootInterval = 2000;
  let divers = [];

  let player = { x: 0, y: 0, alive: true };
  let playerBullets = [];
  let playerShootCooldown = 0;

  let shields = [];

  let ufo = null;
  let ufoTimer = 0;
  let ufoNextSpawn = 0;
  let ufoGlowPhase = 0;

  let fallingPowerups = [];
  let activePowerups = {};

  let drone = null;
  let droneShootTimer = 0;

  let comboCount = 0;
  let comboTimer = 0;
  let comboMultiplier = 1;

  let boss = null;
  let bossActive = false;
  let bossWarningTimer = 0;
  let bossDescendY = 0;
  let bossVictoryTimer = 0;

  let screenFlashAlpha = 0;
  let screenFlashColor = '#fff';

  let score = 0;
  let lives = 3;
  let level = 1;
  let wave = 0;
  let gameState = 'idle';
  let deathTimer = 0;
  let levelCompleteTimer = 0;
  let waveNameTimer = 0;
  let waveNameText = '';

  let keys = {};
  let lastTime = 0;
  let gameTime = 0;
  let alienFrame = 0;
  let titlePulse = 0;

  /* ================================================================
   *  SHIELD SHAPE
   * ================================================================ */

  const SHIELD_SHAPE = [
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
    [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1],
  ];

  /* ================================================================
   *  ALIEN DRAWING (pixel-art paths)
   * ================================================================ */

  function drawAlienType0(ctx, x, y, w, h, frame) {
    const s = w / 8;
    ctx.beginPath();
    if (frame === 0) {
      ctx.moveTo(x + 3 * s, y);
      ctx.lineTo(x + 5 * s, y);
      ctx.lineTo(x + 5 * s, y + s);
      ctx.lineTo(x + 6 * s, y + s);
      ctx.lineTo(x + 6 * s, y + 2 * s);
      ctx.lineTo(x + 8 * s, y + 2 * s);
      ctx.lineTo(x + 8 * s, y + 5 * s);
      ctx.lineTo(x + 7 * s, y + 5 * s);
      ctx.lineTo(x + 7 * s, y + 4 * s);
      ctx.lineTo(x + 6 * s, y + 4 * s);
      ctx.lineTo(x + 6 * s, y + 5 * s);
      ctx.lineTo(x + 5 * s, y + 5 * s);
      ctx.lineTo(x + 5 * s, y + 6 * s);
      ctx.lineTo(x + 3 * s, y + 6 * s);
      ctx.lineTo(x + 3 * s, y + 5 * s);
      ctx.lineTo(x + 2 * s, y + 5 * s);
      ctx.lineTo(x + 2 * s, y + 4 * s);
      ctx.lineTo(x + 1 * s, y + 4 * s);
      ctx.lineTo(x + 1 * s, y + 5 * s);
      ctx.lineTo(x, y + 5 * s);
      ctx.lineTo(x, y + 2 * s);
      ctx.lineTo(x + 2 * s, y + 2 * s);
      ctx.lineTo(x + 2 * s, y + s);
      ctx.lineTo(x + 3 * s, y + s);
    } else {
      ctx.moveTo(x + 3 * s, y);
      ctx.lineTo(x + 5 * s, y);
      ctx.lineTo(x + 5 * s, y + s);
      ctx.lineTo(x + 6 * s, y + s);
      ctx.lineTo(x + 6 * s, y + 2 * s);
      ctx.lineTo(x + 8 * s, y + 2 * s);
      ctx.lineTo(x + 8 * s, y + 5 * s);
      ctx.lineTo(x + 6 * s, y + 5 * s);
      ctx.lineTo(x + 6 * s, y + 6 * s);
      ctx.lineTo(x + 5 * s, y + 6 * s);
      ctx.lineTo(x + 5 * s, y + 5 * s);
      ctx.lineTo(x + 3 * s, y + 5 * s);
      ctx.lineTo(x + 3 * s, y + 6 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.lineTo(x + 2 * s, y + 5 * s);
      ctx.lineTo(x, y + 5 * s);
      ctx.lineTo(x, y + 2 * s);
      ctx.lineTo(x + 2 * s, y + 2 * s);
      ctx.lineTo(x + 2 * s, y + s);
      ctx.lineTo(x + 3 * s, y + s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2 * s, y + 3 * s, s, s);
    ctx.fillRect(x + 5 * s, y + 3 * s, s, s);
  }

  function drawAlienType1(ctx, x, y, w, h, frame) {
    const s = w / 11;
    ctx.beginPath();
    if (frame === 0) {
      ctx.moveTo(x + 2 * s, y);
      ctx.lineTo(x + 3 * s, y);
      ctx.lineTo(x + 3 * s, y + s);
      ctx.lineTo(x + 5 * s, y + s);
      ctx.lineTo(x + 5 * s, y);
      ctx.lineTo(x + 6 * s, y);
      ctx.lineTo(x + 6 * s, y + s);
      ctx.lineTo(x + 8 * s, y + s);
      ctx.lineTo(x + 8 * s, y);
      ctx.lineTo(x + 9 * s, y);
      ctx.lineTo(x + 9 * s, y + s);
      ctx.lineTo(x + 10 * s, y + s);
      ctx.lineTo(x + 10 * s, y + 2 * s);
      ctx.lineTo(x + 11 * s, y + 2 * s);
      ctx.lineTo(x + 11 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 6 * s);
      ctx.lineTo(x + 9 * s, y + 6 * s);
      ctx.lineTo(x + 9 * s, y + 7 * s);
      ctx.lineTo(x + 8 * s, y + 7 * s);
      ctx.lineTo(x + 8 * s, y + 6 * s);
      ctx.lineTo(x + 3 * s, y + 6 * s);
      ctx.lineTo(x + 3 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 5 * s);
      ctx.lineTo(x, y + 5 * s);
      ctx.lineTo(x, y + 2 * s);
      ctx.lineTo(x + s, y + 2 * s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + 2 * s, y + s);
    } else {
      ctx.moveTo(x + 2 * s, y);
      ctx.lineTo(x + 3 * s, y);
      ctx.lineTo(x + 3 * s, y + s);
      ctx.lineTo(x + 5 * s, y + s);
      ctx.lineTo(x + 5 * s, y);
      ctx.lineTo(x + 6 * s, y);
      ctx.lineTo(x + 6 * s, y + s);
      ctx.lineTo(x + 8 * s, y + s);
      ctx.lineTo(x + 8 * s, y);
      ctx.lineTo(x + 9 * s, y);
      ctx.lineTo(x + 9 * s, y + s);
      ctx.lineTo(x + 10 * s, y + s);
      ctx.lineTo(x + 10 * s, y + 2 * s);
      ctx.lineTo(x + 11 * s, y + 2 * s);
      ctx.lineTo(x + 11 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 7 * s);
      ctx.lineTo(x + 9 * s, y + 7 * s);
      ctx.lineTo(x + 9 * s, y + 6 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.lineTo(x + 2 * s, y + 7 * s);
      ctx.lineTo(x + 1 * s, y + 7 * s);
      ctx.lineTo(x + 1 * s, y + 5 * s);
      ctx.lineTo(x, y + 5 * s);
      ctx.lineTo(x, y + 2 * s);
      ctx.lineTo(x + s, y + 2 * s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + 2 * s, y + s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 3 * s, y + 3 * s, 2 * s, s);
    ctx.fillRect(x + 6 * s, y + 3 * s, 2 * s, s);
  }

  function drawAlienType2(ctx, x, y, w, h, frame) {
    const s = w / 12;
    ctx.beginPath();
    if (frame === 0) {
      ctx.moveTo(x + 4 * s, y);
      ctx.lineTo(x + 8 * s, y);
      ctx.lineTo(x + 8 * s, y + s);
      ctx.lineTo(x + 12 * s, y + s);
      ctx.lineTo(x + 12 * s, y + 4 * s);
      ctx.lineTo(x + 11 * s, y + 4 * s);
      ctx.lineTo(x + 11 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 5 * s);
      ctx.lineTo(x + 10 * s, y + 6 * s);
      ctx.lineTo(x + 8 * s, y + 6 * s);
      ctx.lineTo(x + 8 * s, y + 7 * s);
      ctx.lineTo(x + 6 * s, y + 7 * s);
      ctx.lineTo(x + 6 * s, y + 8 * s);
      ctx.lineTo(x + 4 * s, y + 8 * s);
      ctx.lineTo(x + 4 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 5 * s);
      ctx.lineTo(x, y + 5 * s);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x + 4 * s, y + s);
    } else {
      ctx.moveTo(x + 4 * s, y);
      ctx.lineTo(x + 8 * s, y);
      ctx.lineTo(x + 8 * s, y + s);
      ctx.lineTo(x + 12 * s, y + s);
      ctx.lineTo(x + 12 * s, y + 4 * s);
      ctx.lineTo(x + 11 * s, y + 4 * s);
      ctx.lineTo(x + 11 * s, y + 6 * s);
      ctx.lineTo(x + 10 * s, y + 6 * s);
      ctx.lineTo(x + 10 * s, y + 7 * s);
      ctx.lineTo(x + 8 * s, y + 7 * s);
      ctx.lineTo(x + 8 * s, y + 8 * s);
      ctx.lineTo(x + 4 * s, y + 8 * s);
      ctx.lineTo(x + 4 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 7 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 6 * s);
      ctx.lineTo(x + 1 * s, y + 4 * s);
      ctx.lineTo(x, y + 4 * s);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x + 4 * s, y + s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 3 * s, y + 2 * s, 2 * s, 2 * s);
    ctx.fillRect(x + 7 * s, y + 2 * s, 2 * s, 2 * s);
  }

  const alienDrawFns = [drawAlienType0, drawAlienType1, drawAlienType2];

  /* ================================================================
   *  PLAYER DRAWING
   * ================================================================ */

  function drawPlayerShip(ctx, px, py) {
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(px + PLAYER_W / 2, py);
    ctx.lineTo(px + PLAYER_W / 2 + 3, py + 4);
    ctx.lineTo(px + PLAYER_W, py + 4);
    ctx.lineTo(px + PLAYER_W, py + PLAYER_H);
    ctx.lineTo(px, py + PLAYER_H);
    ctx.lineTo(px, py + 4);
    ctx.lineTo(px + PLAYER_W / 2 - 3, py + 4);
    ctx.closePath();
    ctx.fill();
  }

  /* ================================================================
   *  UFO DRAWING
   * ================================================================ */

  function drawUfo(ctx, ux, uy) {
    const cx = ux + UFO_W / 2;
    ctx.fillStyle = '#f0f';
    ctx.beginPath();
    ctx.ellipse(cx, uy + UFO_H / 2, UFO_W / 2, UFO_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8f';
    ctx.beginPath();
    ctx.ellipse(cx, uy + UFO_H / 2 - 2, UFO_W / 3, UFO_H / 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; ++i) {
      ctx.beginPath();
      ctx.arc(cx + i * 5, uy + UFO_H / 2 + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================================================================
   *  BOSS DRAWING
   * ================================================================ */

  function drawBossShip(ctx, bx, by) {
    const phase2 = boss && boss.hp <= boss.maxHp / 2;
    const hullColor = phase2 ? '#c33' : '#888';
    const accentColor = phase2 ? '#f44' : '#aaa';

    ctx.fillStyle = hullColor;
    ctx.beginPath();
    ctx.moveTo(bx + BOSS_W * 0.1, by + BOSS_H * 0.5);
    ctx.lineTo(bx + BOSS_W * 0.2, by + BOSS_H * 0.15);
    ctx.lineTo(bx + BOSS_W * 0.4, by);
    ctx.lineTo(bx + BOSS_W * 0.6, by);
    ctx.lineTo(bx + BOSS_W * 0.8, by + BOSS_H * 0.15);
    ctx.lineTo(bx + BOSS_W * 0.9, by + BOSS_H * 0.5);
    ctx.lineTo(bx + BOSS_W, by + BOSS_H * 0.7);
    ctx.lineTo(bx + BOSS_W * 0.85, by + BOSS_H);
    ctx.lineTo(bx + BOSS_W * 0.15, by + BOSS_H);
    ctx.lineTo(bx, by + BOSS_H * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.fillRect(bx + BOSS_W * 0.15, by + BOSS_H * 0.3, BOSS_W * 0.7, BOSS_H * 0.08);
    ctx.fillRect(bx + BOSS_W * 0.15, by + BOSS_H * 0.6, BOSS_W * 0.7, BOSS_H * 0.08);

    ctx.fillStyle = '#4ff';
    ctx.beginPath();
    ctx.ellipse(bx + BOSS_W / 2, by + BOSS_H * 0.3, BOSS_W * 0.12, BOSS_H * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const engineColor = phase2 ? '#f80' : '#08f';
    for (let i = 0; i < 3; ++i) {
      ctx.fillStyle = engineColor;
      ctx.beginPath();
      const flicker = 3 + Math.sin(gameTime * 0.015 + i * 2) * 2;
      ctx.ellipse(bx + BOSS_W * (0.3 + i * 0.2), by + BOSS_H + flicker / 2, BOSS_W * 0.06, flicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(bx + BOSS_W * 0.15, by + BOSS_H * 0.75, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + BOSS_W * 0.85, by + BOSS_H * 0.75, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBossHealthBar(ctx) {
    if (!boss) return;
    const barW = 120;
    const barH = 8;
    const x = GAME_W / 2 - barW / 2;
    const y = 8;
    const ratio = boss.hp / boss.maxHp;
    const color = ratio > 0.5 ? '#4f4' : ratio > 0.25 ? '#fa0' : '#f44';

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * ratio, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, barW, barH);

    ctx.fillStyle = '#fff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BOSS', GAME_W / 2, y - 1);
  }

  /* ================================================================
   *  DRONE DRAWING
   * ================================================================ */

  function drawDrone(ctx, dx, dy) {
    ctx.fillStyle = '#8f8';
    ctx.beginPath();
    ctx.moveTo(dx + DRONE_W / 2, dy);
    ctx.lineTo(dx + DRONE_W, dy + DRONE_H * 0.5);
    ctx.lineTo(dx + DRONE_W * 0.8, dy + DRONE_H);
    ctx.lineTo(dx + DRONE_W * 0.2, dy + DRONE_H);
    ctx.lineTo(dx, dy + DRONE_H * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cfc';
    ctx.beginPath();
    ctx.arc(dx + DRONE_W / 2, dy + DRONE_H * 0.4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ================================================================
   *  POWERUP DRAWING
   * ================================================================ */

  function drawPowerupIcon(ctx, x, y, def, time) {
    const bob = Math.sin(time * 0.004) * 3;
    const cy = y + bob;

    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x + POWERUP_SIZE / 2, cy + POWERUP_SIZE / 2, POWERUP_SIZE / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + POWERUP_SIZE / 2, cy + POWERUP_SIZE / 2, POWERUP_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    const cx = x + POWERUP_SIZE / 2;
    const ccy = cy + POWERUP_SIZE / 2;

    switch (def.id) {
      case 'tripleShot':
        for (let i = -1; i <= 1; ++i) {
          ctx.fillRect(cx + i * 3 - 0.5, ccy - 4, 1.5, 8);
          ctx.beginPath();
          ctx.moveTo(cx + i * 3, ccy - 5);
          ctx.lineTo(cx + i * 3 - 2, ccy - 2);
          ctx.lineTo(cx + i * 3 + 2, ccy - 2);
          ctx.fill();
        }
        break;
      case 'rapidFire':
        ctx.beginPath();
        ctx.moveTo(cx + 2, ccy - 5);
        ctx.lineTo(cx - 3, ccy);
        ctx.lineTo(cx + 1, ccy);
        ctx.lineTo(cx - 2, ccy + 5);
        ctx.lineTo(cx + 3, ccy);
        ctx.lineTo(cx - 1, ccy);
        ctx.closePath();
        ctx.fill();
        break;
      case 'shield':
        ctx.beginPath();
        ctx.arc(cx, ccy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, ccy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'laser':
        ctx.fillRect(cx - 1, ccy - 6, 2, 12);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - 3, ccy - 6, 6, 12);
        ctx.globalAlpha = 1;
        break;
      case 'slowMo':
        ctx.beginPath();
        ctx.arc(cx, ccy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, ccy);
        ctx.lineTo(cx, ccy - 4);
        ctx.moveTo(cx, ccy);
        ctx.lineTo(cx + 3, ccy + 1);
        ctx.stroke();
        break;
      case 'extraLife':
        ctx.beginPath();
        ctx.moveTo(cx, ccy + 4);
        ctx.bezierCurveTo(cx - 6, ccy - 1, cx - 6, ccy - 5, cx, ccy - 2);
        ctx.bezierCurveTo(cx + 6, ccy - 5, cx + 6, ccy - 1, cx, ccy + 4);
        ctx.fill();
        break;
      case 'bomb':
        ctx.beginPath();
        for (let i = 0; i < 8; ++i) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 5 : 2.5;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          ctx[method](cx + Math.cos(a) * r, ccy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'drone':
        ctx.beginPath();
        ctx.moveTo(cx, ccy - 4);
        ctx.lineTo(cx + 5, ccy + 1);
        ctx.lineTo(cx + 3, ccy + 4);
        ctx.lineTo(cx - 3, ccy + 4);
        ctx.lineTo(cx - 5, ccy + 1);
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  /* ================================================================
   *  WAVE CREATION
   * ================================================================ */

  function createWaveFromFormation(formation) {
    aliens = [];
    divers = [];
    const grid = formation.grid;
    const rows = grid.length;
    const maxCols = Math.max(...grid.map(r => r.length));

    const totalW = maxCols * (ALIEN_W + ALIEN_PAD_X) - ALIEN_PAD_X;
    const startX = (GAME_W - totalW) / 2;
    const startY = 50;

    for (let row = 0; row < rows; ++row)
      for (let col = 0; col < grid[row].length; ++col) {
        const type = grid[row][col];
        if (type === 0) continue;

        const info = ALIEN_TYPE_INFO[type];
        if (!info) continue;

        aliens.push({
          row, col,
          x: startX + col * (ALIEN_W + ALIEN_PAD_X),
          y: startY + row * (ALIEN_H + ALIEN_PAD_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          alive: true,
          points: info.points,
          color: info.color,
          typeIndex: Math.min(info.drawIndex, 2),
          shielded: type === 5,
          shieldHP: type === 5 ? 1 : 0,
          isDiver: type === 4,
          diving: false,
          divePhase: 0,
        });
      }
  }

  /* ================================================================
   *  SHIELDS
   * ================================================================ */

  function createShields() {
    shields = [];
    const totalShieldWidth = SHIELD_COUNT * SHIELD_COLS * SHIELD_BLOCK_SIZE;
    const gap = (GAME_W - totalShieldWidth) / (SHIELD_COUNT + 1);

    for (let i = 0; i < SHIELD_COUNT; ++i) {
      const sx = gap + i * (SHIELD_COLS * SHIELD_BLOCK_SIZE + gap);
      const sy = GAME_H - SHIELD_Y_OFFSET - SHIELD_ROWS * SHIELD_BLOCK_SIZE;
      const blocks = [];
      for (let r = 0; r < SHIELD_ROWS; ++r)
        for (let c = 0; c < SHIELD_COLS; ++c)
          if (SHIELD_SHAPE[r][c])
            blocks.push({
              x: sx + c * SHIELD_BLOCK_SIZE,
              y: sy + r * SHIELD_BLOCK_SIZE,
              w: SHIELD_BLOCK_SIZE,
              h: SHIELD_BLOCK_SIZE,
              alive: true,
            });
      shields.push(blocks);
    }
  }

  /* ================================================================
   *  NEW GAME / NEXT LEVEL
   * ================================================================ */

  function newGame(mode) {
    gameMode = mode || 'classic';
    score = 0;
    lives = 3;
    level = 1;
    wave = 1;
    alienDir = 1;
    alienMoveTimer = 0;
    alienMoveInterval = BASE_MOVE_INTERVAL;
    alienBullets = [];
    alienShootTimer = 0;
    alienShootInterval = 2000;
    playerBullets = [];
    playerShootCooldown = 0;
    ufo = null;
    ufoTimer = 0;
    ufoNextSpawn = UFO_MIN_INTERVAL + Math.random() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    ufoGlowPhase = 0;
    deathTimer = 0;
    levelCompleteTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];
    activePowerups = {};
    drone = null;
    droneShootTimer = 0;
    comboCount = 0;
    comboTimer = 0;
    comboMultiplier = 1;
    boss = null;
    bossActive = false;
    bossWarningTimer = 0;
    bossVictoryTimer = 0;
    screenFlashAlpha = 0;
    waveNameTimer = 0;

    player.x = GAME_W / 2 - PLAYER_W / 2;
    player.y = GAME_H - PLAYER_Y_OFFSET;
    player.alive = true;

    particles.clear();
    floatingText.clear();

    const modeConf = MODES[gameMode];
    const isBossLevel = modeConf.bossEvery > 0 && level % modeConf.bossEvery === 0;

    if (isBossLevel) {
      startBossPhase();
    } else {
      const formIdx = (level - 1) % FORMATIONS.length;
      createWaveFromFormation(FORMATIONS[formIdx]);
      createShields();
      waveNameText = FORMATIONS[formIdx].name;
      waveNameTimer = 2000;
      gameState = 'playing';
    }

    updateStatusBar();
  }

  function startNextLevel() {
    ++level;
    ++wave;
    alienDir = 1;
    alienMoveTimer = 0;
    alienBullets = [];
    alienShootTimer = 0;
    playerBullets = [];
    playerShootCooldown = 0;
    ufo = null;
    ufoTimer = 0;
    ufoNextSpawn = UFO_MIN_INTERVAL + Math.random() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    deathTimer = 0;
    levelCompleteTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];
    bossVictoryTimer = 0;

    alienShootInterval = Math.max(400, 2000 - (level - 1) * 200);

    player.x = GAME_W / 2 - PLAYER_W / 2;
    player.alive = true;

    const modeConf = MODES[gameMode];
    const isBossLevel = modeConf.bossEvery > 0 && level % modeConf.bossEvery === 0;

    if (isBossLevel) {
      startBossPhase();
    } else {
      const formIdx = (level - 1) % FORMATIONS.length;
      createWaveFromFormation(FORMATIONS[formIdx]);
      createShields();
      waveNameText = FORMATIONS[formIdx].name;
      waveNameTimer = 2000;
      gameState = 'playing';
    }

    updateStatusBar();
  }

  function startSurvivalNextWave() {
    ++wave;
    alienDir = 1;
    alienMoveTimer = 0;
    alienBullets = [];
    alienShootTimer = 0;
    alienFrame = 0;
    fallingPowerups = [];

    alienShootInterval = Math.max(400, 2000 - (wave - 1) * 100);

    const formIdx = (wave - 1) % FORMATIONS.length;
    createWaveFromFormation(FORMATIONS[formIdx]);
    waveNameText = 'Wave ' + wave + ': ' + FORMATIONS[formIdx].name;
    waveNameTimer = 2000;
    gameState = 'playing';
    updateStatusBar();
  }

  function startBossPhase() {
    const escortIdx = (level - 1) % BOSS_ESCORTS.length;
    createWaveFromFormation(BOSS_ESCORTS[escortIdx]);
    createShields();

    const bossNum = Math.ceil(level / (MODES[gameMode].bossEvery || 1));
    const hp = BOSS_BASE_HP + (bossNum - 1) * BOSS_HP_PER_BOSS;

    boss = {
      x: GAME_W / 2 - BOSS_W / 2,
      y: -BOSS_H - 20,
      targetY: 25,
      hp,
      maxHp: hp,
      movePhase: 0,
      moveSpeed: 1.5,
      attackTimer: 0,
      attackInterval: 2000,
      currentPattern: 0,
      patterns: ['spread', 'aimed', 'rain'],
    };
    bossActive = true;
    bossWarningTimer = 2000;
    bossDescendY = -BOSS_H - 20;
    gameState = 'bossIntro';
    waveNameText = 'BOSS FIGHT';
    waveNameTimer = 2500;
    updateStatusBar();
  }

  /* ================================================================
   *  COLLISION HELPERS
   * ================================================================ */

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* ================================================================
   *  ALIEN MOVEMENT + DIVING
   * ================================================================ */

  function calcMoveInterval() {
    const aliveCount = aliens.filter(a => a.alive && !a.diving).length;
    const total = aliens.length || 1;
    if (aliveCount === 0)
      return BASE_MOVE_INTERVAL;
    const ratio = aliveCount / total;
    const speedBoost = Math.max(0, (level - 1) * 30);
    return Math.max(MIN_MOVE_INTERVAL, BASE_MOVE_INTERVAL * ratio - speedBoost);
  }

  function moveAliens() {
    let hitEdge = false;
    const alive = aliens.filter(a => a.alive && !a.diving);

    for (const a of alive) {
      a.x += alienDir * 4;
      if (a.x + a.w > GAME_W - 10 || a.x < 10)
        hitEdge = true;
    }

    if (hitEdge) {
      alienDir *= -1;
      for (const a of alive) {
        a.x += alienDir * 4;
        a.y += ALIEN_DROP;
      }
    }

    alienFrame = 1 - alienFrame;
    alienMoveInterval = calcMoveInterval();
  }

  function tryDiveAttack() {
    if (divers.length >= 2) return;
    if (level < 3 && gameMode === 'classic' && !aliens.some(a => a.isDiver)) return;

    const diveChance = 0.015 + level * 0.003;
    if (Math.random() > diveChance) return;

    const candidates = aliens.filter(a => a.alive && !a.diving);
    if (candidates.length === 0) return;

    const diverCandidates = candidates.filter(a => a.isDiver);
    const pool = diverCandidates.length > 0 && Math.random() < 0.7 ? diverCandidates : candidates;
    const alien = pool[Math.floor(Math.random() * pool.length)];

    alien.diving = true;
    alien.divePhase = 0;
    divers.push(alien);
  }

  function updateDivers(dt) {
    for (let i = divers.length - 1; i >= 0; --i) {
      const d = divers[i];
      if (!d.alive) {
        divers.splice(i, 1);
        continue;
      }

      d.divePhase += dt * 0.005;
      const targetX = player.alive ? player.x + PLAYER_W / 2 : GAME_W / 2;
      const dx = targetX - (d.x + d.w / 2);
      d.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.02, 1.5) + Math.sin(d.divePhase * 4) * 2;
      d.y += 2.5 + level * 0.15;

      particles.trail(d.x + d.w / 2, d.y + d.h, {
        vy: 0.5,
        color: d.color,
        size: 1.5,
        life: 0.2,
      });

      if (player.alive && rectsOverlap(d.x, d.y, d.w, d.h, player.x, player.y, PLAYER_W, PLAYER_H)) {
        d.alive = false;
        divers.splice(i, 1);
        killPlayer();
        continue;
      }

      if (d.y > GAME_H + 20) {
        d.alive = false;
        divers.splice(i, 1);
      }
    }
  }

  /* ================================================================
   *  ALIEN SHOOTING
   * ================================================================ */

  function alienShoot() {
    const alive = aliens.filter(a => a.alive && !a.diving);
    if (alive.length === 0) return;

    const bottomAliens = new Map();
    for (const a of alive) {
      const existing = bottomAliens.get(a.col);
      if (!existing || a.y > existing.y)
        bottomAliens.set(a.col, a);
    }

    const shooters = [...bottomAliens.values()];
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];

    alienBullets.push({
      x: shooter.x + shooter.w / 2 - ALIEN_BULLET_W / 2,
      y: shooter.y + shooter.h,
      w: ALIEN_BULLET_W,
      h: ALIEN_BULLET_H,
      vx: 0,
      vy: ALIEN_BULLET_SPEED,
    });
  }

  /* ================================================================
   *  UFO
   * ================================================================ */

  function spawnUfo() {
    const goRight = Math.random() < 0.5;
    ufo = {
      x: goRight ? -UFO_W : GAME_W,
      y: 25,
      w: UFO_W,
      h: UFO_H,
      dir: goRight ? 1 : -1,
      points: [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)],
    };
  }

  /* ================================================================
   *  POWERUP LOGIC
   * ================================================================ */

  function spawnPowerup(x, y) {
    const def = pickRandomPowerup();
    fallingPowerups.push({
      x: x - POWERUP_SIZE / 2,
      y,
      def,
      time: gameTime,
    });
  }

  function updateFallingPowerups(dt) {
    for (let i = fallingPowerups.length - 1; i >= 0; --i) {
      const p = fallingPowerups[i];
      p.y += POWERUP_FALL_SPEED;
      p.time = gameTime;

      if (p.y > GAME_H + 20) {
        fallingPowerups.splice(i, 1);
        continue;
      }

      if (player.alive && rectsOverlap(
        p.x, p.y + Math.sin(gameTime * 0.004) * 3, POWERUP_SIZE, POWERUP_SIZE,
        player.x, player.y, PLAYER_W, PLAYER_H
      )) {
        collectPowerup(p.def);
        particles.sparkle(p.x + POWERUP_SIZE / 2, p.y + POWERUP_SIZE / 2, 12, { color: p.def.color });
        floatingText.add(p.x + POWERUP_SIZE / 2, p.y, p.def.name, {
          color: p.def.color,
          font: 'bold 12px sans-serif',
        });
        fallingPowerups.splice(i, 1);
      }
    }
  }

  function collectPowerup(def) {
    triggerFlash(def.color, 0.15);

    if (def.id === 'extraLife') {
      ++lives;
      updateStatusBar();
      return;
    }

    if (def.id === 'bomb') {
      activateBomb();
      return;
    }

    if (def.id === 'drone') {
      drone = {
        x: player.x + PLAYER_W / 2 - DRONE_W / 2 + 20,
        y: player.y - 20,
      };
      droneShootTimer = 0;
      activePowerups.drone = def.duration;
      return;
    }

    activePowerups[def.id] = def.duration;
  }

  function activateBomb() {
    let bombScore = 0;
    for (const a of aliens) {
      if (!a.alive) continue;
      a.alive = false;
      bombScore += a.points;
      particles.burst(a.x + a.w / 2, a.y + a.h / 2, 8, {
        speed: 3,
        color: a.color,
        gravity: 0.05,
        size: 2,
      });
    }

    for (const d of divers) {
      if (!d.alive) continue;
      d.alive = false;
      bombScore += d.points || 50;
      particles.burst(d.x + d.w / 2, d.y + d.h / 2, 8, {
        speed: 3,
        color: '#f80',
        gravity: 0.05,
        size: 2,
      });
    }
    divers = [];

    score += bombScore;
    triggerFlash('#fa0', 0.4);
    shake.trigger(6, 300);
    if (bombScore > 0)
      floatingText.add(GAME_W / 2, GAME_H / 2, '+' + bombScore, {
        color: '#fa0',
        font: 'bold 20px sans-serif',
      });
  }

  function updateActivePowerups(dt) {
    for (const id of Object.keys(activePowerups)) {
      activePowerups[id] -= dt;
      if (activePowerups[id] <= 0) {
        delete activePowerups[id];
        if (id === 'drone')
          drone = null;
      }
    }
  }

  /* ================================================================
   *  COMBO SYSTEM
   * ================================================================ */

  function addComboKill(points) {
    ++comboCount;
    comboTimer = COMBO_TIMEOUT;
    const idx = Math.min(comboCount, COMBO_MULTIPLIERS.length - 1);
    comboMultiplier = COMBO_MULTIPLIERS[idx];
    const gained = points * comboMultiplier;
    score += gained;

    if (comboMultiplier > 1 && (comboCount === 3 || comboCount === 5 || comboCount === 8 || comboCount === 12))
      floatingText.add(GAME_W / 2, 60, 'x' + comboMultiplier + ' COMBO!', {
        color: comboMultiplier >= 4 ? '#f44' : comboMultiplier >= 3 ? '#fa0' : '#ff0',
        font: 'bold 18px sans-serif',
      });

    return gained;
  }

  function updateCombo(dt) {
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboCount = 0;
        comboMultiplier = 1;
        comboTimer = 0;
      }
    }
  }

  /* ================================================================
   *  DRONE LOGIC
   * ================================================================ */

  function updateDrone(dt) {
    if (!drone) return;

    const targetX = player.x + PLAYER_W / 2 - DRONE_W / 2 + 25;
    const targetY = player.y - 22;
    drone.x += (targetX - drone.x) * 0.08;
    drone.y += (targetY - drone.y) * 0.08;

    droneShootTimer += dt;
    if (droneShootTimer >= DRONE_SHOOT_INTERVAL && player.alive) {
      droneShootTimer = 0;
      playerBullets.push({
        x: drone.x + DRONE_W / 2 - 1,
        y: drone.y - BULLET_H,
        vx: 0,
        vy: -BULLET_SPEED * 0.8,
        w: 2,
        h: BULLET_H - 2,
        piercing: false,
        fromDrone: true,
      });
    }
  }

  /* ================================================================
   *  BOSS LOGIC
   * ================================================================ */

  function updateBoss(dt) {
    if (!boss || !bossActive) return;

    if (gameState === 'bossIntro') {
      bossWarningTimer -= dt;
      bossDescendY += (boss.targetY - bossDescendY) * 0.03;
      boss.y = bossDescendY;
      if (bossWarningTimer <= 0) {
        boss.y = boss.targetY;
        gameState = 'playing';
      }
      return;
    }

    boss.movePhase += boss.moveSpeed * dt * 0.001;
    boss.x = GAME_W / 2 + Math.sin(boss.movePhase) * (GAME_W / 2 - BOSS_W / 2 - 20) - BOSS_W / 2;

    const phase2 = boss.hp <= boss.maxHp / 2;
    if (phase2) {
      boss.moveSpeed = 2.5;
      boss.attackInterval = 1200;
      if (boss.patterns.length === 3)
        boss.patterns.push('spiral');
    }

    boss.attackTimer += dt;
    if (boss.attackTimer >= boss.attackInterval) {
      boss.attackTimer = 0;
      bossAttack();
    }
  }

  function bossAttack() {
    if (!boss) return;
    const pattern = boss.patterns[boss.currentPattern % boss.patterns.length];
    const bx = boss.x + BOSS_W / 2;
    const by = boss.y + BOSS_H;

    switch (pattern) {
      case 'spread':
        for (let i = -2; i <= 2; ++i) {
          const angle = Math.PI / 2 + i * 0.2;
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W + 1,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 2.5,
            vy: Math.sin(angle) * 2.5,
          });
        }
        break;
      case 'aimed': {
        const px = player.alive ? player.x + PLAYER_W / 2 : GAME_W / 2;
        const py = player.alive ? player.y : GAME_H - 40;
        const dx = px - bx;
        const dy = py - by;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        for (let i = -1; i <= 1; ++i)
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: nx * 3.5 + i * 0.6,
            vy: ny * 3.5,
          });
        break;
      }
      case 'rain':
        for (let i = 0; i < 7; ++i)
          alienBullets.push({
            x: boss.x + (i / 6) * BOSS_W,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: 0,
            vy: 2 + Math.random() * 1.5,
          });
        break;
      case 'spiral':
        for (let i = 0; i < 8; ++i) {
          const angle = (i / 8) * Math.PI * 2 + boss.movePhase;
          alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 2,
            vy: Math.sin(angle) * 2 + 1.5,
          });
        }
        break;
    }
    ++boss.currentPattern;
  }

  function damageBoss() {
    if (!boss) return;
    --boss.hp;

    particles.burst(boss.x + BOSS_W / 2, boss.y + BOSS_H / 2, 6, {
      speed: 2,
      color: '#ff0',
      size: 2,
      life: 0.3,
    });

    if (boss.hp <= 0)
      bossDeath();
  }

  function bossDeath() {
    const bossScore = boss.maxHp * 100;
    score += bossScore;

    const bx = boss.x;
    const by = boss.y;

    for (let i = 0; i < 5; ++i)
      setTimeout(() => {
        const ox = bx + Math.random() * BOSS_W;
        const oy = by + Math.random() * BOSS_H;
        particles.burst(ox, oy, 20, {
          speed: 5,
          color: ['#f44', '#fa0', '#ff0', '#f0f'][Math.floor(Math.random() * 4)],
          gravity: 0.05,
          size: 4,
        });
      }, i * 150);

    particles.confetti(bx + BOSS_W / 2, by + BOSS_H / 2, 40);
    shake.trigger(12, 600);
    triggerFlash('#fff', 0.5);

    floatingText.add(bx + BOSS_W / 2, by, '+' + bossScore, {
      color: '#ff0',
      font: 'bold 22px sans-serif',
    });

    for (let i = 0; i < 3; ++i)
      spawnPowerup(
        bx + BOSS_W * (0.2 + i * 0.3),
        by + BOSS_H / 2
      );

    boss = null;
    bossActive = false;
    bossVictoryTimer = 2500;
    gameState = 'bossVictory';
    updateStatusBar();
  }

  /* ================================================================
   *  KILL PLAYER
   * ================================================================ */

  function killPlayer() {
    if (!player.alive) return;
    if (activePowerups.shield && activePowerups.shield > 0) {
      activePowerups.shield = 0;
      delete activePowerups.shield;
      particles.sparkle(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 15, { color: '#88f' });
      triggerFlash('#88f', 0.3);
      shake.trigger(4, 200);
      return;
    }

    player.alive = false;
    --lives;
    deathTimer = 2000;
    gameState = 'dying';

    particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 30, {
      speed: 5,
      color: '#f80',
      gravity: 0.08,
      size: 4,
    });
    particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 15, {
      speed: 3,
      color: '#f00',
      gravity: 0.05,
      size: 3,
    });
    shake.trigger(10, 500);
    triggerFlash('#f44', 0.3);
  }

  /* ================================================================
   *  SCREEN FLASH
   * ================================================================ */

  function triggerFlash(color, intensity) {
    screenFlashAlpha = intensity;
    screenFlashColor = color;
  }

  /* ================================================================
   *  UPDATE
   * ================================================================ */

  function update(dt) {
    gameTime += dt;
    starfield.update(dt);

    if (screenFlashAlpha > 0)
      screenFlashAlpha = Math.max(0, screenFlashAlpha - dt * 0.0012);

    if (gameState === 'idle' || gameState === 'gameover') {
      titlePulse += dt * 0.003;
      return;
    }

    if (gameState === 'paused')
      return;

    if (gameState === 'bossIntro') {
      updateBoss(dt);
      particles.update();
      return;
    }

    if (gameState === 'bossVictory') {
      bossVictoryTimer -= dt;
      particles.update();
      floatingText.update();
      shake.update(dt);
      if (bossVictoryTimer <= 0) {
        const allDead = aliens.every(a => !a.alive);
        if (allDead) {
          gameState = 'levelComplete';
          levelCompleteTimer = 1500;
          particles.confetti(GAME_W / 2, GAME_H / 2, 30);
        } else
          gameState = 'playing';
      }
      return;
    }

    if (gameState === 'dying') {
      deathTimer -= dt;
      particles.update();
      shake.update(dt);
      floatingText.update();
      if (deathTimer <= 0) {
        if (lives <= 0) {
          gameState = 'gameover';
          titlePulse = 0;
          checkHighScore();
        } else {
          player.x = GAME_W / 2 - PLAYER_W / 2;
          player.alive = true;
          playerBullets = [];
          alienBullets = [];
          gameState = 'playing';
        }
      }
      return;
    }

    if (gameState === 'levelComplete') {
      levelCompleteTimer -= dt;
      particles.update();
      floatingText.update();
      if (levelCompleteTimer <= 0) {
        if (gameMode === 'survival')
          startSurvivalNextWave();
        else
          startNextLevel();
      }
      return;
    }

    const slowMoActive = activePowerups.slowMo > 0;
    const alienDt = slowMoActive ? dt * 0.4 : dt;

    // Wave name fade
    if (waveNameTimer > 0)
      waveNameTimer -= dt;

    // Player movement
    if (player.alive) {
      if (keys['ArrowLeft'] || keys['KeyA'])
        player.x = Math.max(10, player.x - PLAYER_SPEED);
      if (keys['ArrowRight'] || keys['KeyD'])
        player.x = Math.min(GAME_W - 10 - PLAYER_W, player.x + PLAYER_SPEED);

      // Shooting
      if (playerShootCooldown > 0)
        playerShootCooldown -= dt;

      const cooldown = activePowerups.rapidFire > 0 ? 100 : 300;
      const maxBullets = 2
        + (activePowerups.rapidFire > 0 ? 2 : 0)
        + (activePowerups.tripleShot > 0 ? 4 : 0);
      const nonDroneBullets = playerBullets.filter(b => !b.fromDrone).length;

      if ((keys['Space'] || keys['ArrowUp']) && playerShootCooldown <= 0 && nonDroneBullets < maxBullets) {
        const isLaser = activePowerups.laser > 0;
        const bw = isLaser ? LASER_W : BULLET_W;

        if (activePowerups.tripleShot > 0) {
          playerBullets.push(
            { x: player.x + PLAYER_W / 2 - bw / 2, y: player.y - BULLET_H, vx: 0, vy: -BULLET_SPEED, w: bw, h: BULLET_H, piercing: isLaser },
            { x: player.x + PLAYER_W / 2 - bw / 2 - 8, y: player.y - BULLET_H + 4, vx: -1.2, vy: -BULLET_SPEED, w: bw, h: BULLET_H, piercing: isLaser },
            { x: player.x + PLAYER_W / 2 - bw / 2 + 8, y: player.y - BULLET_H + 4, vx: 1.2, vy: -BULLET_SPEED, w: bw, h: BULLET_H, piercing: isLaser }
          );
        } else
          playerBullets.push({
            x: player.x + PLAYER_W / 2 - bw / 2,
            y: player.y - BULLET_H,
            vx: 0,
            vy: -BULLET_SPEED,
            w: bw,
            h: BULLET_H,
            piercing: isLaser,
          });

        playerShootCooldown = cooldown;
      }
    }

    // Player bullets
    for (let i = playerBullets.length - 1; i >= 0; --i) {
      const b = playerBullets[i];
      b.x += (b.vx || 0);
      b.y += (b.vy || -BULLET_SPEED);
      if (b.y + (b.h || BULLET_H) < 0 || b.x < -20 || b.x > GAME_W + 20)
        playerBullets.splice(i, 1);
      else if (Math.random() < 0.25) {
        const bw = b.w || BULLET_W;
        particles.trail(b.x + bw / 2, b.y + (b.h || BULLET_H), {
          vy: 0.8,
          color: b.piercing ? '#f0f' : (b.fromDrone ? '#8f8' : '#0f0'),
          size: 1,
          life: 0.2,
        });
      }
    }

    // Alien movement
    alienMoveTimer += alienDt;
    if (alienMoveTimer >= alienMoveInterval) {
      alienMoveTimer = 0;
      moveAliens();
      tryDiveAttack();
    }

    // Alien shooting
    alienShootTimer += alienDt;
    if (alienShootTimer >= alienShootInterval) {
      alienShootTimer = 0;
      alienShoot();
    }

    // Alien bullets
    for (let i = alienBullets.length - 1; i >= 0; --i) {
      const b = alienBullets[i];
      b.x += (b.vx || 0) * (slowMoActive ? 0.4 : 1);
      b.y += (b.vy || ALIEN_BULLET_SPEED) * (slowMoActive ? 0.4 : 1);
      if (b.y > GAME_H + 10 || b.x < -30 || b.x > GAME_W + 30)
        alienBullets.splice(i, 1);
    }

    // Divers
    updateDivers(slowMoActive ? dt * 0.4 : dt);

    // UFO
    ufoGlowPhase += dt * 0.005;
    if (!ufo && !bossActive) {
      ufoTimer += dt;
      if (ufoTimer >= ufoNextSpawn) {
        spawnUfo();
        ufoTimer = 0;
        ufoNextSpawn = UFO_MIN_INTERVAL + Math.random() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
      }
    } else if (ufo) {
      ufo.x += ufo.dir * UFO_SPEED;
      if ((ufo.dir > 0 && ufo.x > GAME_W + UFO_W) || (ufo.dir < 0 && ufo.x + UFO_W < -UFO_W))
        ufo = null;
    }

    // Boss
    if (bossActive && gameState === 'playing')
      updateBoss(dt);

    // Drone
    updateDrone(dt);

    // Powerups
    updateFallingPowerups(dt);
    updateActivePowerups(dt);

    // Combo
    updateCombo(dt);

    // Collision: player bullets vs aliens
    for (let bi = playerBullets.length - 1; bi >= 0; --bi) {
      const b = playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let hitSomething = false;

      for (const a of aliens) {
        if (!a.alive) continue;
        if (!rectsOverlap(b.x, b.y, bw, bh, a.x, a.y, a.w, a.h)) continue;

        if (a.shielded && a.shieldHP > 0) {
          --a.shieldHP;
          if (a.shieldHP <= 0) a.shielded = false;
          particles.sparkle(a.x + a.w / 2, a.y + a.h / 2, 8, { color: '#4ff' });
          if (!b.piercing) {
            playerBullets.splice(bi, 1);
            hitSomething = true;
            break;
          }
          continue;
        }

        a.alive = false;
        const gained = addComboKill(a.points);

        particles.burst(a.x + a.w / 2, a.y + a.h / 2, 15, {
          speed: 3,
          color: a.color,
          gravity: 0.05,
          size: 3,
        });

        if (comboMultiplier > 1)
          floatingText.add(a.x + a.w / 2, a.y, '+' + gained, {
            color: '#ff0',
            font: 'bold 11px sans-serif',
          });

        const dropChance = (a.isDiver ? POWERUP_DROP_CHANCE_SPECIAL : POWERUP_DROP_CHANCE)
          * (MODES[gameMode].powerupMult || 1);
        if (Math.random() < dropChance)
          spawnPowerup(a.x + a.w / 2, a.y + a.h / 2);

        if (!b.piercing) {
          playerBullets.splice(bi, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Player bullets vs UFO
      if (ufo && rectsOverlap(b.x, b.y, bw, bh, ufo.x, ufo.y, ufo.w, ufo.h)) {
        score += ufo.points;
        particles.burst(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, 20, {
          speed: 4,
          color: '#f0f',
          gravity: 0.03,
        });
        floatingText.add(ufo.x + ufo.w / 2, ufo.y, '+' + ufo.points, {
          color: '#ff0',
          font: 'bold 16px sans-serif',
        });
        spawnPowerup(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2);
        ufo = null;
        if (!b.piercing)
          playerBullets.splice(bi, 1);
        continue;
      }

      // Player bullets vs boss
      if (bossActive && boss && rectsOverlap(b.x, b.y, bw, bh, boss.x, boss.y, BOSS_W, BOSS_H)) {
        damageBoss();
        if (!b.piercing)
          playerBullets.splice(bi, 1);
        continue;
      }
    }

    // Player bullets vs shields
    for (let bi = playerBullets.length - 1; bi >= 0; --bi) {
      if (playerBullets[bi].piercing) continue;
      const b = playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let destroyed = false;
      for (const shieldBlocks of shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, bw, bh, s.x, s.y, s.w, s.h)) {
            s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            playerBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }

    // Alien bullets vs shields
    for (let bi = alienBullets.length - 1; bi >= 0; --bi) {
      const b = alienBullets[bi];
      let destroyed = false;
      for (const shieldBlocks of shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) {
            s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            alienBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }

    // Alien bullets vs player
    if (player.alive) {
      for (let bi = alienBullets.length - 1; bi >= 0; --bi) {
        const b = alienBullets[bi];
        if (rectsOverlap(b.x, b.y, b.w, b.h, player.x, player.y, PLAYER_W, PLAYER_H)) {
          alienBullets.splice(bi, 1);
          killPlayer();
          break;
        }
      }
    }

    // Aliens reaching player row (instant game over, shield cannot save this)
    for (const a of aliens) {
      if (a.alive && !a.diving && a.y + a.h >= player.y) {
        if (activePowerups.shield > 0)
          delete activePowerups.shield;
        player.alive = false;
        lives = 0;
        deathTimer = 2000;
        gameState = 'dying';
        particles.burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 30, {
          speed: 5, color: '#f80', gravity: 0.08, size: 4,
        });
        shake.trigger(10, 500);
        triggerFlash('#f44', 0.3);
        break;
      }
    }

    // Level complete check
    const allAliensDead = aliens.every(a => !a.alive) && divers.length === 0;

    if (allAliensDead && gameState === 'playing' && !bossActive) {
      if (gameMode === 'survival') {
        gameState = 'levelComplete';
        levelCompleteTimer = 800;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 20);
      } else {
        gameState = 'levelComplete';
        levelCompleteTimer = 1500;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 30);
      }
    }

    // Boss level: if boss is active and all escorts dead, boss still fights alone
    // (boss defeat triggers bossVictory → levelComplete automatically)

    // Update effects
    particles.update();
    shake.update(dt);
    floatingText.update();

    updateStatusBar();
  }

  /* ================================================================
   *  DRAW
   * ================================================================ */

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.translate(gameOffsetX, gameOffsetY);
    ctx.scale(gameScale, gameScale);

    ctx.save();

    // Starfield background
    starfield.draw(ctx);

    shake.apply(ctx);

    // Shields
    ctx.fillStyle = '#0f0';
    for (const shieldBlocks of shields)
      for (const s of shieldBlocks)
        if (s.alive)
          ctx.fillRect(s.x, s.y, s.w, s.h);

    // Aliens
    for (const a of aliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.color;
      alienDrawFns[a.typeIndex](ctx, a.x, a.y, a.w, a.h, alienFrame);

      if (a.shielded && a.shieldHP > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(gameTime * 0.006) * 0.1;
        ctx.strokeStyle = '#4ff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#4ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7, a.h * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Boss
    if (boss) {
      const glowSize = 12 + Math.sin(gameTime * 0.005) * 4;
      drawGlow(ctx, (c) => drawBossShip(c, boss.x, boss.y), boss.hp <= boss.maxHp / 2 ? '#f44' : '#4ff', glowSize);
    }

    // Player
    if (player.alive) {
      drawPlayerShip(ctx, player.x, player.y);

      if (activePowerups.shield > 0) {
        ctx.save();
        const shieldAlpha = 0.25 + Math.sin(gameTime * 0.008) * 0.1;
        ctx.globalAlpha = shieldAlpha;
        ctx.strokeStyle = '#88f';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#88f';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, PLAYER_W * 0.8, PLAYER_H * 1.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,100,255,0.08)';
        ctx.fill();
        ctx.restore();
      }
    }

    // Drone
    if (drone) {
      drawGlow(ctx, (c) => drawDrone(c, drone.x, drone.y), '#8f8', 6);
    }

    // Player bullets
    for (const b of playerBullets) {
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      const color = b.piercing ? '#f0f' : (b.fromDrone ? '#8f8' : '#0f0');
      const blur = b.piercing ? 12 : 8;
      drawGlow(ctx, (c) => {
        c.fillStyle = color;
        c.fillRect(b.x, b.y, bw, bh);
      }, color, blur);
    }

    // Alien bullets
    for (const b of alienBullets) {
      drawGlow(ctx, (c) => {
        c.fillStyle = '#f44';
        c.fillRect(b.x, b.y, b.w, b.h);
      }, '#f00', 6);
    }

    // UFO
    if (ufo) {
      const glowSize = 10 + Math.sin(ufoGlowPhase) * 4;
      drawGlow(ctx, (c) => drawUfo(c, ufo.x, ufo.y), '#f0f', glowSize);
    }

    // Falling powerups
    for (const p of fallingPowerups)
      drawPowerupIcon(ctx, p.x, p.y, p.def, p.time);

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    // Boss health bar
    if (boss && bossActive && gameState === 'playing')
      drawBossHealthBar(ctx);

    // Active powerup HUD
    drawPowerupHUD(ctx);

    // Combo display
    if (comboMultiplier > 1 && comboTimer > 0) {
      const size = 14 + comboMultiplier * 2;
      const comboColor = comboMultiplier >= 5 ? '#f44' : comboMultiplier >= 4 ? '#f84' : comboMultiplier >= 3 ? '#fa0' : '#ff0';
      ctx.save();
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = comboColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = comboColor;
      const comboY = boss ? 24 : 8;
      ctx.fillText('x' + comboMultiplier + ' COMBO', GAME_W / 2, comboY);
      ctx.fillText('x' + comboMultiplier + ' COMBO', GAME_W / 2, comboY);
      const barW = 50;
      const barH = 3;
      const ratio = comboTimer / COMBO_TIMEOUT;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(GAME_W / 2 - barW / 2, comboY + size + 3, barW, barH);
      ctx.fillStyle = comboColor;
      ctx.fillRect(GAME_W / 2 - barW / 2, comboY + size + 3, barW * ratio, barH);
      ctx.restore();
    }

    // Wave name announcement
    if (waveNameTimer > 0 && gameState === 'playing') {
      const alpha = Math.min(1, waveNameTimer / 500);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 8;
      ctx.fillText(waveNameText, GAME_W / 2, GAME_H / 2 - 20);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.shadowBlur = 0;
      ctx.fillText('Level ' + level, GAME_W / 2, GAME_H / 2 + 4);
      ctx.restore();
    }

    ctx.restore();

    // Overlays (drawn in game coordinate space)
    ctx.save();

    if (gameState === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', GAME_W / 2, GAME_H / 2 - 12);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText('Press P to resume', GAME_W / 2, GAME_H / 2 + 16);
    }

    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', GAME_W / 2, GAME_H / 2 - 36);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Score: ' + score, GAME_W / 2, GAME_H / 2 - 4);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText(MODES[gameMode].name + ' - Level ' + level, GAME_W / 2, GAME_H / 2 + 20);
      ctx.fillText('Press F2 for New Game', GAME_W / 2, GAME_H / 2 + 44);
    }

    if (gameState === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      ctx.save();
      const pulse = 0.8 + Math.sin(titlePulse) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#0f0';
      ctx.shadowBlur = 15;
      ctx.fillText('SPACE INVADERS', GAME_W / 2, GAME_H / 2 - 80);
      ctx.fillText('SPACE INVADERS', GAME_W / 2, GAME_H / 2 - 80);
      ctx.restore();

      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enhanced Edition', GAME_W / 2, GAME_H / 2 - 50);

      const modes = [
        { key: '1', label: 'CLASSIC', desc: 'Progressive levels with bosses', color: '#4f4' },
        { key: '2', label: 'SURVIVAL', desc: 'Endless waves, no mercy', color: '#ff4' },
        { key: '3', label: 'BOSS RUSH', desc: 'Boss every level', color: '#f44' },
      ];

      for (let i = 0; i < modes.length; ++i) {
        const m = modes[i];
        const y = GAME_H / 2 - 12 + i * 40;
        ctx.fillStyle = m.color;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('[' + m.key + ']  ' + m.label, GAME_W / 2, y);
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.fillText(m.desc, GAME_W / 2, y + 16);
      }

      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.fillText('Press 1-3 to start  |  Enter for Classic', GAME_W / 2, GAME_H / 2 + 120);
    }

    if (gameState === 'levelComplete') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#0ff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = gameMode === 'survival'
        ? 'WAVE ' + wave + ' CLEAR'
        : 'LEVEL ' + level + ' COMPLETE';
      ctx.fillText(text, GAME_W / 2, GAME_H / 2);
    }

    if (gameState === 'bossIntro') {
      const flash = Math.sin(gameTime * 0.015) > 0;
      if (bossWarningTimer > 1000) {
        ctx.fillStyle = flash ? '#f44' : '#800';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WARNING', GAME_W / 2, GAME_H / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText('Boss approaching...', GAME_W / 2, GAME_H / 2 + 16);
      }
    }

    if (gameState === 'bossVictory') {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 10;
      ctx.fillText('BOSS DEFEATED!', GAME_W / 2, GAME_H / 2 - 10);
    }

    ctx.restore();

    // Screen flash (in game coordinates)
    if (screenFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = screenFlashAlpha;
      ctx.fillStyle = screenFlashColor;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }
  }

  /* ================================================================
   *  POWERUP HUD
   * ================================================================ */

  function drawPowerupHUD(ctx) {
    const activeIds = Object.keys(activePowerups).filter(k => activePowerups[k] > 0);
    if (activeIds.length === 0) return;

    let x = GAME_W - 8;
    const y = boss ? 24 : 8;

    for (let i = activeIds.length - 1; i >= 0; --i) {
      const id = activeIds[i];
      const def = POWERUPS.find(p => p.id === id);
      if (!def || def.duration === 0) continue;

      const remaining = activePowerups[id];
      const ratio = remaining / def.duration;

      x -= 28;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, 24, 22);
      ctx.fillStyle = def.color;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.abbr, x + 12, y + 8);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 2, y + 16, 20, 3);
      ctx.fillStyle = def.color;
      ctx.fillRect(x + 2, y + 16, 20 * ratio, 3);
      ctx.restore();
    }
  }

  /* ================================================================
   *  GAME LOOP
   * ================================================================ */

  function gameLoop(timestamp) {
    if (!lastTime)
      lastTime = timestamp;
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  function updateStatusBar() {
    statusScore.textContent = 'Score: ' + score;
    statusLives.textContent = 'Lives: ' + lives;
    if (gameMode === 'survival')
      statusLevel.textContent = 'Wave: ' + wave;
    else
      statusLevel.textContent = 'Level: ' + level;
  }

  /* ================================================================
   *  HIGH SCORES
   * ================================================================ */

  function loadHighScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function saveHighScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (_) {}
  }

  function checkHighScore() {
    const scores = loadHighScores();
    scores.push({ score, level, wave, mode: gameMode });
    scores.sort((a, b) => b.score - a.score);
    scores.length = Math.min(scores.length, MAX_HIGH_SCORES);
    saveHighScores(scores);
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    tbody.innerHTML = '';
    if (scores.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet</td>';
      tbody.appendChild(tr);
    } else {
      for (let i = 0; i < scores.length; ++i) {
        const s = scores[i];
        const modeName = MODES[s.mode] ? MODES[s.mode].name : (s.mode || '?');
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td>' + s.score + '</td>' +
          '<td>' + (s.mode === 'survival' ? 'W' + (s.wave || s.level) : 'L' + s.level) + '</td>' +
          '<td>' + modeName + '</td>';
        tbody.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        saveHighScores([]);
        showHighScores();
      }
    });
  }

  /* ================================================================
   *  INPUT
   * ================================================================ */

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      gameState = 'idle';
      titlePulse = 0;
      return;
    }

    if (gameState === 'idle') {
      if (e.key === '1') { newGame('classic'); return; }
      if (e.key === '2') { newGame('survival'); return; }
      if (e.key === '3') { newGame('bossRush'); return; }
      if (e.key === 'Enter') { newGame(gameMode || 'classic'); return; }
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (gameState === 'playing')
        gameState = 'paused';
      else if (gameState === 'paused')
        gameState = 'playing';
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')
      e.preventDefault();
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ================================================================
   *  MENU
   * ================================================================ */

  new SZ.MenuBar({
    onAction(action) {
      switch (action) {
        case 'new':
          gameState = 'idle';
          titlePulse = 0;
          break;
        case 'pause':
          if (gameState === 'playing')
            gameState = 'paused';
          else if (gameState === 'paused')
            gameState = 'playing';
          break;
        case 'high-scores':
          showHighScores();
          break;
        case 'exit':
          User32.DestroyWindow();
          break;
        case 'controls':
          SZ.Dialog.show('controlsBackdrop');
          break;
        case 'about':
          SZ.Dialog.show('dlg-about');
          break;
      }
    },
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  User32.EnableVisualStyles();

  resizeCanvas();
  updateStatusBar();
  requestAnimationFrame(gameLoop);
})();
