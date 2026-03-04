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
  const STATE_SHIP_SELECT = 'SHIP_SELECT';
  const STATE_UPGRADES = 'UPGRADES';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_RACE_OVER = 'RACE_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-racing';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_CREDITS = STORAGE_PREFIX + '-credits';
  const STORAGE_UPGRADES = STORAGE_PREFIX + '-upgrades';
  const STORAGE_SELECTED_SHIP = STORAGE_PREFIX + '-selected-ship';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* ── Parallax starfield layers ── */
  const STAR_LAYERS = [
    { count: 80, sizeMin: 0.3, sizeMax: 0.8, speed: 0.02, alphaBase: 0.15, alphaRange: 0.15, twinkleSpeed: 0.8 },
    { count: 50, sizeMin: 0.6, sizeMax: 1.4, speed: 0.05, alphaBase: 0.25, alphaRange: 0.25, twinkleSpeed: 1.2 },
    { count: 30, sizeMin: 1.0, sizeMax: 2.2, speed: 0.10, alphaBase: 0.40, alphaRange: 0.30, twinkleSpeed: 1.8 }
  ];
  const STAR_COLORS = ['#fff', '#ccf', '#ffc', '#cff', '#fcf', '#fcc'];

  /* ── Gravity wells ── */
  const GRAVITY_CONSTANT = 8000;
  const GRAVITY_MIN_DIST = 30;
  const GRAVITY_MAX_DIST = 250;

  /* ── Wormholes ── */
  const WORMHOLE_RADIUS = 28;
  const WORMHOLE_COOLDOWN = 1.5;

  /* ── Base ship physics (before ship/upgrade modifiers) ── */
  const BASE_ACCEL = 320;
  const BASE_BRAKE = 200;
  const SHIP_FRICTION = 0.985;
  const BASE_TURN_SPEED = 3.0;
  const BASE_MAX_SPEED = 400;
  const SHIP_RADIUS = 10;

  /* ── Boost ── */
  const BASE_BOOST_MULT = 1.8;
  const BASE_BOOST_DURATION = 1.5;

  /* ── Race ── */
  const TOTAL_LAPS = 3;
  const NUM_OPPONENTS = 3;
  const CHECKPOINT_RADIUS = 40;

  /* ── AI (nerfed) ── */
  const AI_BASE_ACCEL = 200;
  const AI_BASE_TURN_SPEED = 2.0;
  const AI_SPEED_VARIANCE = 0.18;
  const AI_REACTION_DELAY = 0.25;
  const AI_MISTAKE_CHANCE = 0.008;
  const AI_MISTAKE_DURATION = 0.6;
  const AI_BRAKE_ON_TURN_THRESHOLD = 1.2;
  const AI_BRAKE_FACTOR = 0.6;

  /* ── Credits ── */
  const CREDITS_1ST = 500;
  const CREDITS_2ND = 300;
  const CREDITS_3RD = 150;
  const CREDITS_4TH = 50;

  /* ══════════════════════════════════════════════════════════════════
     SHIP DEFINITIONS (5 ships with unique stats and visuals)
     ══════════════════════════════════════════════════════════════════ */

  const SHIP_DEFS = [
    {
      id: 'falcon',
      name: 'Star Falcon',
      description: 'Balanced all-rounder. Good for beginners.',
      color: '#4af',
      accentColor: '#27d',
      exhaustColor: '#48f',
      stats: { speed: 1.0, accel: 1.0, handling: 1.0, boost: 1.0 },
      shape: 'arrow'
    },
    {
      id: 'viper',
      name: 'Neon Viper',
      description: 'Blazing fast but drifts on turns.',
      color: '#f44',
      accentColor: '#a22',
      exhaustColor: '#f84',
      stats: { speed: 1.25, accel: 0.9, handling: 0.7, boost: 1.1 },
      shape: 'dart'
    },
    {
      id: 'mantis',
      name: 'Void Mantis',
      description: 'Nimble and quick to accelerate. Fragile top speed.',
      color: '#4f4',
      accentColor: '#2a2',
      exhaustColor: '#8f4',
      stats: { speed: 0.85, accel: 1.3, handling: 1.25, boost: 0.9 },
      shape: 'wing'
    },
    {
      id: 'titan',
      name: 'Iron Titan',
      description: 'Slow starter but unstoppable at max speed.',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#fc0',
      stats: { speed: 1.15, accel: 0.7, handling: 0.85, boost: 1.3 },
      shape: 'heavy'
    },
    {
      id: 'phantom',
      name: 'Ghost Phantom',
      description: 'Excellent handling and boost. Lower raw speed.',
      color: '#c4f',
      accentColor: '#82a',
      exhaustColor: '#d8f',
      stats: { speed: 0.9, accel: 1.05, handling: 1.35, boost: 1.25 },
      shape: 'stealth'
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     UPGRADE DEFINITIONS
     ══════════════════════════════════════════════════════════════════ */

  const UPGRADE_DEFS = [
    {
      id: 'engine',
      name: 'Engine',
      stat: 'speed',
      icon: 'SPD',
      maxLevel: 5,
      costBase: 200,
      costScale: 1.5,
      bonusPerLevel: 0.06
    },
    {
      id: 'thruster',
      name: 'Thruster',
      stat: 'accel',
      icon: 'ACC',
      maxLevel: 5,
      costBase: 180,
      costScale: 1.5,
      bonusPerLevel: 0.07
    },
    {
      id: 'gyro',
      name: 'Gyroscope',
      stat: 'handling',
      icon: 'HND',
      maxLevel: 5,
      costBase: 160,
      costScale: 1.4,
      bonusPerLevel: 0.06
    },
    {
      id: 'nitro',
      name: 'Nitro Tank',
      stat: 'boost',
      icon: 'BST',
      maxLevel: 5,
      costBase: 250,
      costScale: 1.6,
      bonusPerLevel: 0.08
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     AI RACER PERSONALITIES (visually distinct, unique behaviors)
     ══════════════════════════════════════════════════════════════════ */

  const AI_PERSONALITIES = [
    {
      name: 'Blaze',
      color: '#f55',
      accentColor: '#c22',
      exhaustColor: '#f80',
      shape: 'dart',
      speedBias: 1.05,
      turnBias: 0.85,
      aggressiveness: 0.6,
      mistakeRate: 1.2
    },
    {
      name: 'Comet',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#ff4',
      shape: 'wing',
      speedBias: 0.9,
      turnBias: 1.1,
      aggressiveness: 0.4,
      mistakeRate: 0.8
    },
    {
      name: 'Nebula',
      color: '#5f5',
      accentColor: '#2a2',
      exhaustColor: '#8f8',
      shape: 'heavy',
      speedBias: 0.95,
      turnBias: 0.95,
      aggressiveness: 0.5,
      mistakeRate: 1.0
    },
    {
      name: 'Pulse',
      color: '#f5f',
      accentColor: '#a2a',
      exhaustColor: '#faf',
      shape: 'stealth',
      speedBias: 0.85,
      turnBias: 1.15,
      aggressiveness: 0.3,
      mistakeRate: 1.4
    },
    {
      name: 'Drift',
      color: '#5ff',
      accentColor: '#2aa',
      exhaustColor: '#8ff',
      shape: 'arrow',
      speedBias: 1.0,
      turnBias: 1.0,
      aggressiveness: 0.5,
      mistakeRate: 1.1
    }
  ];

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
      gravityBodies: [
        { x: 350, y: 280, mass: 1.0, radius: 18, type: 'planet', color: '#4a8' }
      ],
      wormholes: [
        { x: 150, y: 150, pairIndex: 1, color: '#f80' },
        { x: 550, y: 380, pairIndex: 0, color: '#08f' }
      ],
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
      gravityBodies: [
        { x: 350, y: 280, mass: 1.5, radius: 22, type: 'star', color: '#ff8' },
        { x: 150, y: 400, mass: 0.6, radius: 12, type: 'planet', color: '#a4f' }
      ],
      wormholes: [],
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
      gravityBodies: [
        { x: 350, y: 250, mass: 2.0, radius: 16, type: 'blackhole', color: '#222' }
      ],
      wormholes: [
        { x: 100, y: 120, pairIndex: 1, color: '#f0f' },
        { x: 580, y: 400, pairIndex: 0, color: '#0ff' }
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
      gravityBodies: [
        { x: 360, y: 300, mass: 1.2, radius: 20, type: 'planet', color: '#f84' },
        { x: 550, y: 120, mass: 0.8, radius: 14, type: 'planet', color: '#48f' }
      ],
      wormholes: [
        { x: 80, y: 200, pairIndex: 1, color: '#ff0' },
        { x: 620, y: 400, pairIndex: 0, color: '#f40' }
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
      gravityBodies: [
        { x: 350, y: 270, mass: 2.5, radius: 20, type: 'star', color: '#ff4' },
        { x: 100, y: 180, mass: 0.7, radius: 12, type: 'planet', color: '#4fa' },
        { x: 600, y: 400, mass: 1.0, radius: 14, type: 'blackhole', color: '#222' }
      ],
      wormholes: [
        { x: 200, y: 100, pairIndex: 1, color: '#4ff' },
        { x: 500, y: 440, pairIndex: 0, color: '#f4f' }
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
  const statusCredits = document.getElementById('statusCredits');
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

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Race', lines: ['Race against AI opponents on space tracks!', 'Complete laps to finish the race.', '', 'Up / W = Accelerate', 'Down / S = Brake', 'Left/Right or A/D = Steer'] },
    { title: 'Ships & Upgrades', lines: ['Press Tab for ship selection (5 unique ships).', 'Press F3 for upgrades (engine, thrusters, etc).', 'Earn credits by finishing races.', '', 'Hit boost pads for speed bursts!', 'Press H anytime to see this help again.'] }
  ];

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

  // Parallax starfield layers (initialized in resetGame)
  let starLayers = [];

  // Wormhole cooldown (prevents ping-pong teleporting)
  let wormholeCooldown = 0;
  let aiWormholeCooldowns = [];

  // Global elapsed time for animations
  let globalTime = 0;

  // Speed-line effect
  let speedLines = [];

  // High scores
  let highScores = [];

  // Ship selection & upgrades
  let selectedShipIndex = 0;
  let credits = 0;
  let shipUpgrades = {};
  let selectCursorIndex = 0;
  let upgradeCursorIndex = 0;

  // Input
  const keys = {};
  let keyJustPressed = {};

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

  function loadCredits() {
    try {
      const raw = localStorage.getItem(STORAGE_CREDITS);
      if (raw)
        credits = JSON.parse(raw);
    } catch (_) {
      credits = 0;
    }
  }

  function saveCredits() {
    try {
      localStorage.setItem(STORAGE_CREDITS, JSON.stringify(credits));
    } catch (_) {}
  }

  function loadUpgrades() {
    try {
      const raw = localStorage.getItem(STORAGE_UPGRADES);
      if (raw)
        shipUpgrades = JSON.parse(raw);
    } catch (_) {
      shipUpgrades = {};
    }
  }

  function saveUpgrades() {
    try {
      localStorage.setItem(STORAGE_UPGRADES, JSON.stringify(shipUpgrades));
    } catch (_) {}
  }

  function loadSelectedShip() {
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_SHIP);
      if (raw != null)
        selectedShipIndex = JSON.parse(raw);
    } catch (_) {
      selectedShipIndex = 0;
    }
  }

  function saveSelectedShip() {
    try {
      localStorage.setItem(STORAGE_SELECTED_SHIP, JSON.stringify(selectedShipIndex));
    } catch (_) {}
  }

  function getUpgradeLevel(shipId, upgradeId) {
    const key = shipId + ':' + upgradeId;
    return shipUpgrades[key] || 0;
  }

  function setUpgradeLevel(shipId, upgradeId, level) {
    const key = shipId + ':' + upgradeId;
    shipUpgrades[key] = level;
    saveUpgrades();
  }

  function getUpgradeCost(upgradeDef, currentLevel) {
    return Math.floor(upgradeDef.costBase * Math.pow(upgradeDef.costScale, currentLevel));
  }

  function getEffectiveStats(shipDef) {
    const stats = { speed: shipDef.stats.speed, accel: shipDef.stats.accel, handling: shipDef.stats.handling, boost: shipDef.stats.boost };
    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const upg = UPGRADE_DEFS[i];
      const level = getUpgradeLevel(shipDef.id, upg.id);
      stats[upg.stat] += level * upg.bonusPerLevel;
    }
    return stats;
  }

  /* ── High scores ── */

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
     SHIP SHAPE DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawShipShape(shape, scale) {
    const s = scale || 1;
    switch (shape) {
      case 'arrow':
        ctx.moveTo(12 * s, 0);
        ctx.lineTo(-8 * s, -7 * s);
        ctx.lineTo(-5 * s, 0);
        ctx.lineTo(-8 * s, 7 * s);
        break;
      case 'dart':
        ctx.moveTo(14 * s, 0);
        ctx.lineTo(-4 * s, -5 * s);
        ctx.lineTo(-8 * s, -8 * s);
        ctx.lineTo(-6 * s, 0);
        ctx.lineTo(-8 * s, 8 * s);
        ctx.lineTo(-4 * s, 5 * s);
        break;
      case 'wing':
        ctx.moveTo(10 * s, 0);
        ctx.lineTo(2 * s, -4 * s);
        ctx.lineTo(-10 * s, -9 * s);
        ctx.lineTo(-6 * s, 0);
        ctx.lineTo(-10 * s, 9 * s);
        ctx.lineTo(2 * s, 4 * s);
        break;
      case 'heavy':
        ctx.moveTo(10 * s, 0);
        ctx.lineTo(6 * s, -6 * s);
        ctx.lineTo(-6 * s, -8 * s);
        ctx.lineTo(-8 * s, -4 * s);
        ctx.lineTo(-8 * s, 4 * s);
        ctx.lineTo(-6 * s, 8 * s);
        ctx.lineTo(6 * s, 6 * s);
        break;
      case 'stealth':
        ctx.moveTo(13 * s, 0);
        ctx.lineTo(0, -3 * s);
        ctx.lineTo(-7 * s, -10 * s);
        ctx.lineTo(-5 * s, 0);
        ctx.lineTo(-7 * s, 10 * s);
        ctx.lineTo(0, 3 * s);
        break;
      default:
        ctx.moveTo(12 * s, 0);
        ctx.lineTo(-8 * s, -7 * s);
        ctx.lineTo(-5 * s, 0);
        ctx.lineTo(-8 * s, 7 * s);
        break;
    }
  }

  function drawExhaust(shape, color, intensity, scale) {
    const s = scale || 1;
    const flicker = Math.random() * 6 * intensity;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;

    switch (shape) {
      case 'dart':
        ctx.beginPath();
        ctx.moveTo(-6 * s, -2 * s);
        ctx.lineTo(-14 * s - flicker, 0);
        ctx.lineTo(-6 * s, 2 * s);
        ctx.fill();
        break;
      case 'wing':
        ctx.beginPath();
        ctx.moveTo(-6 * s, -2 * s);
        ctx.lineTo(-10 * s - flicker * 0.7, -3 * s);
        ctx.lineTo(-8 * s - flicker, 0);
        ctx.lineTo(-10 * s - flicker * 0.7, 3 * s);
        ctx.lineTo(-6 * s, 2 * s);
        ctx.fill();
        break;
      case 'heavy':
        ctx.beginPath();
        ctx.moveTo(-8 * s, -3 * s);
        ctx.lineTo(-13 * s - flicker, -1 * s);
        ctx.lineTo(-13 * s - flicker, 1 * s);
        ctx.lineTo(-8 * s, 3 * s);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(-8 * s, -1 * s);
        ctx.lineTo(-16 * s - flicker, 0);
        ctx.lineTo(-8 * s, 1 * s);
        ctx.fill();
        break;
      case 'stealth':
        ctx.beginPath();
        ctx.moveTo(-5 * s, -1.5 * s);
        ctx.lineTo(-10 * s - flicker * 0.8, 0);
        ctx.lineTo(-5 * s, 1.5 * s);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-7 * s - flicker * 0.5, 0, 1.5 * s, 0, TWO_PI);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.moveTo(-5 * s, -3 * s);
        ctx.lineTo(-12 * s - flicker, 0);
        ctx.lineTo(-5 * s, 3 * s);
        ctx.fill();
        break;
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  function getPlayerShipDef() {
    return SHIP_DEFS[selectedShipIndex];
  }

  function resetGame() {
    track = TRACK_DEFS[currentTrackIndex];
    const shipDef = getPlayerShipDef();
    const stats = getEffectiveStats(shipDef);

    ship.x = track.startX;
    ship.y = track.startY;
    ship.angle = track.startAngle;
    ship.speed = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.stats = stats;
    ship.def = shipDef;
    boostTimer = 0;
    boostActive = false;

    camX = ship.x - CANVAS_W / 2;
    camY = ship.y - CANVAS_H / 2;

    playerCheckpoint = 0;
    playerLap = 0;
    raceTime = 0;
    playerPlace = 1;
    raceFinished = false;

    // Pick NUM_OPPONENTS unique AI personalities
    const shuffled = AI_PERSONALITIES.slice();
    for (let i = shuffled.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    opponents = [];
    for (let i = 0; i < NUM_OPPONENTS; ++i) {
      const personality = shuffled[i % shuffled.length];
      const speedFactor = (1 - AI_SPEED_VARIANCE + Math.random() * AI_SPEED_VARIANCE * 2) * personality.speedBias;
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
        personality,
        color: personality.color,
        accentColor: personality.accentColor,
        exhaustColor: personality.exhaustColor,
        shape: personality.shape,
        name: personality.name,
        finished: false,
        finishTime: 0,
        reactionTimer: AI_REACTION_DELAY * (0.8 + Math.random() * 0.4),
        mistakeTimer: 0,
        mistakeAngle: 0,
        throttle: 0
      });
    }

    speedLines = [];
    wormholeCooldown = 0;
    aiWormholeCooldowns = opponents.map(() => 0);
    globalTime = 0;

    // Build parallax starfield
    starLayers = [];
    for (let li = 0; li < STAR_LAYERS.length; ++li) {
      const layer = STAR_LAYERS[li];
      const stars = [];
      for (let si = 0; si < layer.count; ++si)
        stars.push({
          x: Math.random() * CANVAS_W * 2,
          y: Math.random() * CANVAS_H * 2,
          size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
          phase: Math.random() * TWO_PI,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        });
      starLayers.push(stars);
    }

    state = STATE_PLAYING;
    updateWindowTitle();
  }

  function enterShipSelect() {
    state = STATE_SHIP_SELECT;
    selectCursorIndex = selectedShipIndex;
    updateWindowTitle();
  }

  function enterUpgrades() {
    state = STATE_UPGRADES;
    upgradeCursorIndex = 0;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     SHIP PHYSICS
     ══════════════════════════════════════════════════════════════════ */

  function updateShip(dt) {
    if (state !== STATE_PLAYING) return;

    const stats = ship.stats;
    const turnSpeed = BASE_TURN_SPEED * stats.handling;
    const accel = BASE_ACCEL * stats.accel;
    const brake = BASE_BRAKE * stats.accel;
    const maxSpeed = (boostActive ? BASE_MAX_SPEED * BASE_BOOST_MULT * stats.boost : BASE_MAX_SPEED) * stats.speed;

    // Steering
    if (keys['ArrowLeft'] || keys['KeyA'])
      ship.angle -= turnSpeed * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      ship.angle += turnSpeed * dt;

    // Acceleration / braking
    if (keys['ArrowUp'] || keys['KeyW']) {
      ship.vx += Math.cos(ship.angle) * accel * dt;
      ship.vy += Math.sin(ship.angle) * accel * dt;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      ship.vx -= Math.cos(ship.angle) * brake * dt;
      ship.vy -= Math.sin(ship.angle) * brake * dt;
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
      particles.trail(
        ship.x - Math.cos(ship.angle) * 14,
        ship.y - Math.sin(ship.angle) * 14,
        { color: ship.def.exhaustColor || '#f80', speed: 1.5, life: 0.4, count: 2 }
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI OPPONENTS (nerfed + distinct behaviors)
     ══════════════════════════════════════════════════════════════════ */

  function updateAI(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if (ai.finished) continue;

      const p = ai.personality;

      // Reaction delay: AI doesn't steer toward next checkpoint instantly
      ai.reactionTimer -= dt;
      if (ai.reactionTimer > 0) {
        // During reaction delay, just coast with friction
        ai.vx *= SHIP_FRICTION;
        ai.vy *= SHIP_FRICTION;
        ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
        ai.x += ai.vx * dt;
        ai.y += ai.vy * dt;
        continue;
      }

      // Mistake system: occasionally steer the wrong way
      if (ai.mistakeTimer > 0) {
        ai.mistakeTimer -= dt;
        ai.angle += ai.mistakeAngle * dt;
      } else if (Math.random() < AI_MISTAKE_CHANCE * p.mistakeRate) {
        ai.mistakeTimer = AI_MISTAKE_DURATION * (0.5 + Math.random());
        ai.mistakeAngle = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 1.5);
      }

      // Steer toward next checkpoint
      const targetCP = track.checkpoints[ai.checkpoint];
      const dx = targetCP.x - ai.x;
      const dy = targetCP.y - ai.y;
      const targetAngle = Math.atan2(dy, dx);

      let angleDiff = targetAngle - ai.angle;
      while (angleDiff > Math.PI) angleDiff -= TWO_PI;
      while (angleDiff < -Math.PI) angleDiff += TWO_PI;

      const turnSpeed = AI_BASE_TURN_SPEED * p.turnBias;
      if (ai.mistakeTimer <= 0) {
        if (angleDiff > 0)
          ai.angle += Math.min(turnSpeed * dt, angleDiff);
        else
          ai.angle += Math.max(-turnSpeed * dt, angleDiff);
      }

      // Brake on sharp turns (AI is less efficient at this)
      const absAngleDiff = Math.abs(angleDiff);
      let throttle = 1.0;
      if (absAngleDiff > AI_BRAKE_ON_TURN_THRESHOLD)
        throttle = AI_BRAKE_FACTOR;

      // Smooth throttle transitions
      ai.throttle += (throttle - ai.throttle) * 0.1;

      // Accelerate toward waypoint
      const accel = AI_BASE_ACCEL * ai.speedFactor * ai.throttle;
      ai.vx += Math.cos(ai.angle) * accel * dt;
      ai.vy += Math.sin(ai.angle) * accel * dt;

      // Friction
      ai.vx *= SHIP_FRICTION;
      ai.vy *= SHIP_FRICTION;

      // Clamp speed
      ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
      const aiMax = BASE_MAX_SPEED * ai.speedFactor * 0.82;
      if (ai.speed > aiMax) {
        const ratio = aiMax / ai.speed;
        ai.vx *= ratio;
        ai.vy *= ratio;
        ai.speed = aiMax;
      }

      // Move
      ai.x += ai.vx * dt;
      ai.y += ai.vy * dt;

      // Clamp within world bounds
      if (ai.x < 0) { ai.x = 0; ai.vx = Math.abs(ai.vx) * 0.5; }
      if (ai.y < 0) { ai.y = 0; ai.vy = Math.abs(ai.vy) * 0.5; }
      if (ai.x > CANVAS_W) { ai.x = CANVAS_W; ai.vx = -Math.abs(ai.vx) * 0.5; }
      if (ai.y > CANVAS_H) { ai.y = CANVAS_H; ai.vy = -Math.abs(ai.vy) * 0.5; }

      // Exhaust particles for AI
      if (ai.speed > 80) {
        const exhaustRate = ai.speed > 200 ? 0.3 : 0.1;
        if (Math.random() < exhaustRate)
          particles.trail(
            ai.x - Math.cos(ai.angle) * 12,
            ai.y - Math.sin(ai.angle) * 12,
            { color: ai.exhaustColor, speed: 0.8, life: 0.25, count: 1 }
          );
      }

      // Check checkpoint crossing
      const distToCP = Math.sqrt(dx * dx + dy * dy);
      if (distToCP < CHECKPOINT_RADIUS) {
        ++ai.checkpoint;
        ai.reactionTimer = AI_REACTION_DELAY * (0.6 + Math.random() * 0.8);
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

    // Award credits based on placement
    const creditReward = [CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH][finalPlace - 1] || CREDITS_4TH;
    credits += creditReward;
    saveCredits();

    const resultText = `${getOrdinal(finalPlace)} Place -- ${formatTime(raceTime)}`;
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2, resultText, {
      color: finalPlace <= 3 ? '#ff0' : '#fff',
      font: 'bold 22px sans-serif'
    });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 30, `+${creditReward} Credits`, {
      color: '#0f0',
      font: 'bold 16px sans-serif'
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

    const stats = ship.stats;
    for (let i = 0; i < track.boostPads.length; ++i) {
      const pad = track.boostPads[i];
      const dx = pad.x - ship.x;
      const dy = pad.y - ship.y;
      if (dx * dx + dy * dy < 30 * 30) {
        boostActive = true;
        boostTimer = BASE_BOOST_DURATION * stats.boost;
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
        ship.speed *= 0.4;
        ship.vx *= 0.4;
        ship.vy *= 0.4;

        const pushAngle = Math.atan2(-dy, -dx);
        ship.x += Math.cos(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);
        ship.y += Math.sin(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);

        particles.burst(ship.x, ship.y, 12, {
          color: '#ff0',
          speed: 3,
          life: 0.3
        });

        screenShake.trigger(8, 300);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GRAVITY WELLS
     ══════════════════════════════════════════════════════════════════ */

  function applyGravity(dt) {
    if (state !== STATE_PLAYING) return;
    const bodies = track.gravityBodies;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];

      // Apply to player
      const pdx = body.x - ship.x;
      const pdy = body.y - ship.y;
      const pDistSq = pdx * pdx + pdy * pdy;
      const pDist = Math.sqrt(pDistSq);
      if (pDist > GRAVITY_MIN_DIST && pDist < GRAVITY_MAX_DIST) {
        const force = GRAVITY_CONSTANT * body.mass / pDistSq;
        ship.vx += (pdx / pDist) * force * dt;
        ship.vy += (pdy / pDist) * force * dt;
      }

      // Apply to AI opponents
      for (let i = 0; i < opponents.length; ++i) {
        const ai = opponents[i];
        if (ai.finished) continue;
        const adx = body.x - ai.x;
        const ady = body.y - ai.y;
        const aDistSq = adx * adx + ady * ady;
        const aDist = Math.sqrt(aDistSq);
        if (aDist > GRAVITY_MIN_DIST && aDist < GRAVITY_MAX_DIST) {
          const force = GRAVITY_CONSTANT * body.mass / aDistSq;
          ai.vx += (adx / aDist) * force * dt;
          ai.vy += (ady / aDist) * force * dt;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WORMHOLES
     ══════════════════════════════════════════════════════════════════ */

  function checkWormholes(dt) {
    if (state !== STATE_PLAYING) return;
    const holes = track.wormholes;
    if (!holes || !holes.length) return;

    // Player wormhole cooldown
    if (wormholeCooldown > 0) wormholeCooldown -= dt;

    // Check player
    if (wormholeCooldown <= 0) {
      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - ship.x;
        const dy = wh.y - ship.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          // Particle burst at entry
          particles.burst(ship.x, ship.y, 20, {
            color: wh.color, speed: 4, life: 0.6, size: 3
          });

          // Teleport
          ship.x = dest.x + Math.cos(ship.angle) * (WORMHOLE_RADIUS + 5);
          ship.y = dest.y + Math.sin(ship.angle) * (WORMHOLE_RADIUS + 5);

          // Particle burst at exit
          particles.burst(ship.x, ship.y, 20, {
            color: dest.color, speed: 4, life: 0.6, size: 3
          });

          floatingText.add(ship.x, ship.y - 25, 'WARP!', {
            color: '#fff', font: 'bold 14px sans-serif'
          });

          screenShake.trigger(6, 250);
          wormholeCooldown = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }

    // AI wormhole cooldowns
    for (let ai_i = 0; ai_i < opponents.length; ++ai_i) {
      if (aiWormholeCooldowns[ai_i] > 0)
        aiWormholeCooldowns[ai_i] -= dt;
    }

    // Check AI ships
    for (let ai_i = 0; ai_i < opponents.length; ++ai_i) {
      const ai = opponents[ai_i];
      if (ai.finished || aiWormholeCooldowns[ai_i] > 0) continue;

      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - ai.x;
        const dy = wh.y - ai.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          particles.burst(ai.x, ai.y, 10, {
            color: wh.color, speed: 3, life: 0.4, size: 2
          });

          ai.x = dest.x + Math.cos(ai.angle) * (WORMHOLE_RADIUS + 5);
          ai.y = dest.y + Math.sin(ai.angle) * (WORMHOLE_RADIUS + 5);

          particles.burst(ai.x, ai.y, 10, {
            color: dest.color, speed: 3, life: 0.4, size: 2
          });

          aiWormholeCooldowns[ai_i] = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     THRUST & SPEED TRAIL PARTICLES
     ══════════════════════════════════════════════════════════════════ */

  function emitThrustParticles() {
    if (state !== STATE_PLAYING) return;

    const isThrusting = keys['ArrowUp'] || keys['KeyW'];
    const pd = getPlayerShipDef();

    // Thrust exhaust particles when accelerating
    if (isThrusting) {
      const ex = ship.x - Math.cos(ship.angle) * 12;
      const ey = ship.y - Math.sin(ship.angle) * 12;
      const spread = 0.4;
      const baseAngle = ship.angle + Math.PI;
      for (let i = 0; i < 2; ++i) {
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const spd = 1.5 + Math.random() * 2;
        particles.trail(ex + (Math.random() - 0.5) * 4, ey + (Math.random() - 0.5) * 4, {
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          color: pd.exhaustColor || '#f80',
          life: 0.25 + Math.random() * 0.15,
          size: 1.5 + Math.random() * 1.5,
          decay: 0.04,
          shrink: 0.94
        });
      }
    }

    // Speed trail sparkles at high speed
    const speedRatio = ship.speed / BASE_MAX_SPEED;
    if (speedRatio > 0.6) {
      const trailRate = (speedRatio - 0.6) * 5;
      if (Math.random() < trailRate * 0.3) {
        const side = (Math.random() > 0.5 ? 1 : -1);
        const perpAngle = ship.angle + Math.PI / 2 * side;
        const ox = Math.cos(perpAngle) * (3 + Math.random() * 5);
        const oy = Math.sin(perpAngle) * (3 + Math.random() * 5);
        particles.trail(ship.x + ox - Math.cos(ship.angle) * 8, ship.y + oy - Math.sin(ship.angle) * 8, {
          vx: -ship.vx * 0.01,
          vy: -ship.vy * 0.01,
          color: boostActive ? '#0ff' : '#aaf',
          life: 0.15 + Math.random() * 0.1,
          size: 0.8 + Math.random(),
          decay: 0.05,
          shrink: 0.92
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SPEED-LINE EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  function updateSpeedLines() {
    const ratio = ship.speed / BASE_MAX_SPEED;
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
    const targetX = ship.x - CANVAS_W / 2;
    const targetY = ship.y - CANVAS_H / 2;
    camX += (targetX - camX) * 0.08;
    camY += (targetY - camY) * 0.08;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    globalTime += dt;
    if (state === STATE_PAUSED || state === STATE_SHIP_SELECT || state === STATE_UPGRADES) return;

    updateShip(dt);
    updateAI(dt);
    applyGravity(dt);
    checkBoostPads();
    checkHazards();
    checkWormholes(dt);
    emitThrustParticles();
    updateRace(dt);
    updateCamera();
    updateSpeedLines();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- TRACK & GAME
     ══════════════════════════════════════════════════════════════════ */

  function drawTrack() {
    ctx.fillStyle = track.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Multi-layer parallax starfield with twinkling
    for (let li = 0; li < starLayers.length; ++li) {
      const layerDef = STAR_LAYERS[li];
      const stars = starLayers[li];
      const parallax = layerDef.speed;
      for (let si = 0; si < stars.length; ++si) {
        const s = stars[si];
        // Parallax offset based on camera
        let sx = ((s.x - camX * parallax) % (CANVAS_W * 2) + CANVAS_W * 2) % (CANVAS_W * 2) - CANVAS_W * 0.5;
        let sy = ((s.y - camY * parallax) % (CANVAS_H * 2) + CANVAS_H * 2) % (CANVAS_H * 2) - CANVAS_H * 0.5;
        if (sx < -5 || sx > CANVAS_W + 5 || sy < -5 || sy > CANVAS_H + 5) continue;
        // Sine-wave twinkle
        const twinkle = Math.sin(globalTime * layerDef.twinkleSpeed + s.phase);
        const alpha = layerDef.alphaBase + layerDef.alphaRange * twinkle;
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

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

    for (let i = 0; i < track.checkpoints.length; ++i) {
      const cp = track.checkpoints[i];
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 6, 0, TWO_PI);
      ctx.fillStyle = i === playerCheckpoint ? '#0f0' : '#555';
      ctx.fill();
    }

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

      if (h.type === 'asteroid') {
        ctx.fillStyle = '#887';
        ctx.beginPath();
        ctx.arc(h.x - 3, h.y - 2, h.radius * 0.3, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  function drawGravityBodies() {
    const bodies = track.gravityBodies;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];
      ctx.save();

      if (body.type === 'blackhole') {
        // Black hole: dark center with swirling accretion disc
        const pulse = 1 + 0.1 * Math.sin(globalTime * 3);
        // Accretion disc glow
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.3, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, 'rgba(80,0,120,0.5)');
        grad.addColorStop(0.4, 'rgba(120,40,180,0.2)');
        grad.addColorStop(1, 'rgba(60,0,100,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Swirl ring
        ctx.strokeStyle = 'rgba(180,100,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(body.x, body.y, body.radius * 2.2 * pulse, body.radius * 1.2 * pulse, globalTime * 0.5, 0, TWO_PI);
        ctx.stroke();

        // Dark center
        ctx.fillStyle = '#111';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#608';
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (body.type === 'star') {
        // Star: bright glowing center with pulsating corona
        const pulse = 1 + 0.15 * Math.sin(globalTime * 2.5);
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.2, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, body.color);
        grad.addColorStop(0.6, body.color.slice(0, 4) + '8');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 16;
        ctx.shadowColor = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 0.6, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Planet: solid with atmosphere glow
        const pulse = 1 + 0.05 * Math.sin(globalTime * 1.5);
        // Atmosphere
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.8, body.x, body.y, body.radius * 2 * pulse);
        grad.addColorStop(0, body.color + '60');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 2 * pulse, 0, TWO_PI);
        ctx.fill();

        // Planet body
        ctx.fillStyle = body.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Light highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(body.x - body.radius * 0.3, body.y - body.radius * 0.3, body.radius * 0.4, 0, TWO_PI);
        ctx.fill();
      }

      // Gravity range indicator (subtle dashed circle)
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(body.x, body.y, GRAVITY_MAX_DIST, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  function drawWormholes() {
    const holes = track.wormholes;
    if (!holes || !holes.length) return;

    for (let i = 0; i < holes.length; ++i) {
      const wh = holes[i];
      ctx.save();

      // Swirling outer ring
      const time = globalTime * 2;
      for (let ring = 3; ring >= 0; --ring) {
        const r = WORMHOLE_RADIUS + ring * 4;
        const alpha = 0.15 - ring * 0.03;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = wh.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wh.x, wh.y, r, time + ring * 0.5, time + ring * 0.5 + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Swirling gradient center
      const pulse = 1 + 0.12 * Math.sin(globalTime * 3 + i * Math.PI);
      const grad = ctx.createRadialGradient(wh.x, wh.y, 0, wh.x, wh.y, WORMHOLE_RADIUS * pulse);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.2, wh.color);
      grad.addColorStop(0.7, wh.color + '40');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, WORMHOLE_RADIUS * pulse, 0, TWO_PI);
      ctx.fill();

      // Inner swirl lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let arm = 0; arm < 3; ++arm) {
        const baseAngle = time + arm * (TWO_PI / 3);
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.05) {
          const spiralR = t * WORMHOLE_RADIUS * 0.8;
          const spiralA = baseAngle + t * 4;
          const sx = wh.x + Math.cos(spiralA) * spiralR;
          const sy = wh.y + Math.sin(spiralA) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Center glow dot
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = wh.color;
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, 3, 0, TWO_PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  function drawShip(x, y, angle, color, accentColor, exhaustColor, shape, isPlayer, isThrusting) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Ship body
    ctx.beginPath();
    drawShipShape(shape, 1);
    ctx.closePath();

    ctx.fillStyle = color;
    if (isPlayer) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
    }
    ctx.fill();

    // Accent stripe
    ctx.strokeStyle = accentColor || '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cockpit dot
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(4, 0, 1.5, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Thruster flame
    if (isThrusting)
      drawExhaust(shape, exhaustColor || '#f80', 1, 1);

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

    ctx.strokeStyle = '#334';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mmX + track.checkpoints[0].x / CANVAS_W * mmW, mmY + track.checkpoints[0].y / CANVAS_H * mmH);
    for (let i = 1; i < track.checkpoints.length; ++i)
      ctx.lineTo(mmX + track.checkpoints[i].x / CANVAS_W * mmW, mmY + track.checkpoints[i].y / CANVAS_H * mmH);
    ctx.closePath();
    ctx.stroke();

    // Player dot
    ctx.fillStyle = getPlayerShipDef().color;
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

    // AI name labels on minimap
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      ctx.fillStyle = ai.color;
      ctx.fillText(ai.name, mmX + ai.x / CANVAS_W * mmW, mmY + ai.y / CANVAS_H * mmH - 3);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Race info overlays
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
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#aaf';
      ctx.fillText('Press Tab for Ship Select / F3 for Upgrades', CANVAS_W / 2, CANVAS_H / 2 + 40);
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
      ctx.fillText(`Race Complete -- ${getOrdinal(playerPlace)} Place`, CANVAS_W / 2, CANVAS_H / 2 - 40);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Time: ${formatTime(raceTime)}`, CANVAS_W / 2, CANVAS_H / 2 - 10);

      const creditReward = [CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH][playerPlace - 1] || CREDITS_4TH;
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`+${creditReward} Credits earned`, CANVAS_W / 2, CANVAS_H / 2 + 15);

      ctx.fillStyle = '#bbb';
      ctx.font = '13px sans-serif';
      ctx.fillText('Tap or press F2 for next track', CANVAS_W / 2, CANVAS_H / 2 + 45);
      ctx.fillStyle = '#aaf';
      ctx.fillText('Tab = Ship Select / F3 = Upgrades', CANVAS_W / 2, CANVAS_H / 2 + 65);
      ctx.textAlign = 'start';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- SHIP SELECT SCREEN
     ══════════════════════════════════════════════════════════════════ */

  function drawShipSelect() {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Select Your Ship', CANVAS_W / 2, 30);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Left/Right to browse, Enter to confirm, Escape to go back', CANVAS_W / 2, 55);

    const cardW = 120;
    const cardH = 200;
    const gap = 10;
    const totalW = SHIP_DEFS.length * cardW + (SHIP_DEFS.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const cardY = 75;

    for (let i = 0; i < SHIP_DEFS.length; ++i) {
      const sd = SHIP_DEFS[i];
      const cx = startX + i * (cardW + gap);
      const isSelected = i === selectCursorIndex;
      const isCurrent = i === selectedShipIndex;

      // Card background
      ctx.fillStyle = isSelected ? '#223' : '#111';
      ctx.fillRect(cx, cardY, cardW, cardH);
      ctx.strokeStyle = isSelected ? sd.color : (isCurrent ? '#555' : '#333');
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(cx, cardY, cardW, cardH);

      if (isCurrent) {
        ctx.fillStyle = sd.color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(cx, cardY, cardW, cardH);
        ctx.globalAlpha = 1;
      }

      // Ship preview
      ctx.save();
      ctx.translate(cx + cardW / 2, cardY + 40);
      ctx.rotate(-Math.PI / 6);
      ctx.beginPath();
      drawShipShape(sd.shape, 2.0);
      ctx.closePath();
      ctx.fillStyle = sd.color;
      ctx.shadowBlur = isSelected ? 12 : 4;
      ctx.shadowColor = sd.color;
      ctx.fill();
      ctx.strokeStyle = sd.accentColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw exhaust on preview
      drawExhaust(sd.shape, sd.exhaustColor, 0.7, 2.0);
      ctx.restore();

      // Ship name
      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sd.name, cx + cardW / 2, cardY + 75);

      // Description
      ctx.fillStyle = '#888';
      ctx.font = '9px sans-serif';
      const words = sd.description.split(' ');
      let line = '';
      let lineY = cardY + 90;
      for (let w = 0; w < words.length; ++w) {
        const test = line + (line ? ' ' : '') + words[w];
        if (ctx.measureText(test).width > cardW - 10) {
          ctx.fillText(line, cx + cardW / 2, lineY);
          line = words[w];
          lineY += 11;
        } else
          line = test;
      }
      if (line)
        ctx.fillText(line, cx + cardW / 2, lineY);

      // Stats bars
      const stats = getEffectiveStats(sd);
      const statNames = ['speed', 'accel', 'handling', 'boost'];
      const statLabels = ['SPD', 'ACC', 'HND', 'BST'];
      const statColors = ['#4af', '#fa0', '#4f4', '#f4f'];
      const barX = cx + 8;
      const barW = cardW - 16;
      let barY = cardY + 130;

      for (let s = 0; s < statNames.length; ++s) {
        const val = Math.min(stats[statNames[s]], 2.0);

        ctx.fillStyle = '#666';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(statLabels[s], barX, barY + 7);

        // Background bar
        ctx.fillStyle = '#222';
        ctx.fillRect(barX + 24, barY, barW - 24, 8);

        // Filled bar
        ctx.fillStyle = statColors[s];
        ctx.fillRect(barX + 24, barY, (barW - 24) * (val / 2.0), 8);

        barY += 14;
      }

      // "EQUIPPED" label for current ship
      if (isCurrent) {
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EQUIPPED', cx + cardW / 2, cardY + cardH - 6);
      }
    }

    // Credits display
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Credits: ${credits}`, CANVAS_W / 2, CANVAS_H - 40);

    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Press F3 to open Upgrades', CANVAS_W / 2, CANVAS_H - 20);

    ctx.textAlign = 'start';
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- UPGRADE SCREEN
     ══════════════════════════════════════════════════════════════════ */

  function drawUpgradeScreen() {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const sd = getPlayerShipDef();

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Upgrade: ${sd.name}`, CANVAS_W / 2, 30);

    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Up/Down to select, Enter to buy, Escape to go back', CANVAS_W / 2, 52);

    // Credits
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Credits: ${credits}`, CANVAS_W / 2, 78);

    // Ship preview on the left
    ctx.save();
    ctx.translate(130, 200);
    ctx.rotate(-Math.PI / 6);
    ctx.beginPath();
    drawShipShape(sd.shape, 4);
    ctx.closePath();
    ctx.fillStyle = sd.color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = sd.color;
    ctx.fill();
    ctx.strokeStyle = sd.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawExhaust(sd.shape, sd.exhaustColor, 1, 4);
    ctx.restore();

    // Current effective stats on the left
    const stats = getEffectiveStats(sd);
    const statNames = ['speed', 'accel', 'handling', 'boost'];
    const statLabels = ['Speed', 'Accel', 'Handling', 'Boost'];
    const statColors = ['#4af', '#fa0', '#4f4', '#f4f'];

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('Current Stats', 130, 280);

    for (let s = 0; s < statNames.length; ++s) {
      const val = Math.min(stats[statNames[s]], 2.0);
      const barX = 50;
      const barY = 295 + s * 22;
      const barW = 160;

      ctx.fillStyle = '#777';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(statLabels[s], barX, barY + 10);

      ctx.fillStyle = '#222';
      ctx.fillRect(barX + 55, barY + 2, barW - 55, 10);

      ctx.fillStyle = statColors[s];
      ctx.fillRect(barX + 55, barY + 2, (barW - 55) * (val / 2.0), 10);

      ctx.fillStyle = '#ccc';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((val * 100).toFixed(0) + '%', barX + barW + 25, barY + 11);
    }

    // Upgrade cards on the right
    const cardX = 280;
    const cardW = 380;
    const cardH = 70;

    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const upg = UPGRADE_DEFS[i];
      const level = getUpgradeLevel(sd.id, upg.id);
      const cost = getUpgradeCost(upg, level);
      const maxed = level >= upg.maxLevel;
      const canAfford = credits >= cost && !maxed;
      const isSelected = i === upgradeCursorIndex;
      const cy = 100 + i * (cardH + 10);

      // Card background
      ctx.fillStyle = isSelected ? '#1a1a3a' : '#111';
      ctx.fillRect(cardX, cy, cardW, cardH);
      ctx.strokeStyle = isSelected ? '#88f' : '#333';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(cardX, cy, cardW, cardH);

      // Upgrade icon
      ctx.fillStyle = statColors[i];
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(upg.icon, cardX + 28, cy + 30);

      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(upg.name, cardX + 55, cy + 22);

      // Level pips
      for (let l = 0; l < upg.maxLevel; ++l) {
        const pipX = cardX + 55 + l * 18;
        const pipY = cy + 35;
        ctx.fillStyle = l < level ? statColors[i] : '#333';
        ctx.fillRect(pipX, pipY, 14, 8);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(pipX, pipY, 14, 8);
      }

      // Bonus info
      ctx.fillStyle = '#888';
      ctx.font = '9px sans-serif';
      ctx.fillText(`+${(upg.bonusPerLevel * 100).toFixed(0)}% ${upg.stat} per level`, cardX + 55, cy + 58);

      // Cost / maxed label
      ctx.textAlign = 'right';
      if (maxed) {
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('MAX', cardX + cardW - 12, cy + 30);
      } else {
        ctx.fillStyle = canAfford ? '#ff0' : '#f44';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${cost} cr`, cardX + cardW - 12, cy + 25);
        ctx.fillStyle = '#888';
        ctx.font = '9px sans-serif';
        ctx.fillText(canAfford ? 'Enter to buy' : 'Not enough', cardX + cardW - 12, cy + 42);
      }
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW GAME
     ══════════════════════════════════════════════════════════════════ */

  function drawGame() {
    if (state === STATE_SHIP_SELECT) {
      drawShipSelect();
      return;
    }

    if (state === STATE_UPGRADES) {
      drawUpgradeScreen();
      return;
    }

    drawTrack();
    drawGravityBodies();
    drawWormholes();
    drawBoostPads();
    drawHazards();

    // Draw AI opponents
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      drawShip(ai.x, ai.y, ai.angle, ai.color, ai.accentColor, ai.exhaustColor, ai.shape, false, ai.speed > 50);

      // Draw AI name label above ship
      ctx.fillStyle = ai.color;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(ai.name, ai.x, ai.y - 14);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    // Draw player ship
    const pd = getPlayerShipDef();
    drawShip(ship.x, ship.y, ship.angle, pd.color, pd.accentColor, pd.exhaustColor, pd.shape, true, keys['ArrowUp'] || keys['KeyW']);

    drawSpeedLines();
    drawHUD();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 400, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#f80';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusPosition) statusPosition.textContent = `Pos: ${getOrdinal(playerPlace)}`;
    if (statusLap) statusLap.textContent = `Lap: ${Math.min(playerLap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`;
    if (statusSpeed) statusSpeed.textContent = `Speed: ${Math.round(ship.speed)}`;
    if (statusTime) statusTime.textContent = `Time: ${formatTime(raceTime)}`;
    if (statusCredits) statusCredits.textContent = `Credits: ${credits}`;
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

    // Clear just-pressed flags at end of frame
    keyJustPressed = {};

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (keys[e.code]) return; // Ignore key repeat
    keys[e.code] = true;
    keyJustPressed[e.code] = true;

    /* Tutorial navigation */
    if (showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++tutorialPage;
        if (tutorialPage >= TUTORIAL_PAGES.length)
          showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && tutorialPage > 0) {
        e.preventDefault();
        --tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    // ── Ship Select navigation ──
    if (state === STATE_SHIP_SELECT) {
      e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA')
        selectCursorIndex = (selectCursorIndex - 1 + SHIP_DEFS.length) % SHIP_DEFS.length;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD')
        selectCursorIndex = (selectCursorIndex + 1) % SHIP_DEFS.length;
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        selectedShipIndex = selectCursorIndex;
        saveSelectedShip();
        state = STATE_READY;
        updateWindowTitle();
      } else if (e.code === 'Escape') {
        state = STATE_READY;
        updateWindowTitle();
      } else if (e.code === 'F3')
        enterUpgrades();
      return;
    }

    // ── Upgrade Screen navigation ──
    if (state === STATE_UPGRADES) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW')
        upgradeCursorIndex = (upgradeCursorIndex - 1 + UPGRADE_DEFS.length) % UPGRADE_DEFS.length;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS')
        upgradeCursorIndex = (upgradeCursorIndex + 1) % UPGRADE_DEFS.length;
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const sd = getPlayerShipDef();
        const upg = UPGRADE_DEFS[upgradeCursorIndex];
        const level = getUpgradeLevel(sd.id, upg.id);
        const cost = getUpgradeCost(upg, level);
        if (level < upg.maxLevel && credits >= cost) {
          credits -= cost;
          setUpgradeLevel(sd.id, upg.id, level + 1);
          saveCredits();
        }
      } else if (e.code === 'Escape') {
        state = STATE_READY;
        updateWindowTitle();
      } else if (e.code === 'Tab') {
        enterShipSelect();
      }
      return;
    }

    // ── Normal game controls ──
    if (e.code === 'F2') {
      e.preventDefault();
      if (state === STATE_RACE_OVER)
        currentTrackIndex = (currentTrackIndex + 1) % TRACK_DEFS.length;
      resetGame();
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      if (state === STATE_READY || state === STATE_RACE_OVER)
        enterShipSelect();
    }

    if (e.code === 'F3') {
      e.preventDefault();
      if (state === STATE_READY || state === STATE_RACE_OVER)
        enterUpgrades();
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
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
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
      case 'ship-select':
        if (state === STATE_READY || state === STATE_RACE_OVER || state === STATE_UPGRADES)
          enterShipSelect();
        break;
      case 'upgrades':
        if (state === STATE_READY || state === STATE_RACE_OVER || state === STATE_SHIP_SELECT)
          enterUpgrades();
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
      case 'tutorial':
        showTutorial = true;
        tutorialPage = 0;
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
    let title;
    if (state === STATE_SHIP_SELECT)
      title = 'Space Racing -- Ship Select';
    else if (state === STATE_UPGRADES)
      title = 'Space Racing -- Upgrades';
    else if (state === STATE_RACE_OVER)
      title = `Space Racing -- ${getOrdinal(playerPlace)} Place -- ${track.name}`;
    else
      title = `Space Racing -- ${track.name}`;
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
  loadCredits();
  loadUpgrades();
  loadSelectedShip();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }

  // Initialize starfield for the ready screen
  for (let li = 0; li < STAR_LAYERS.length; ++li) {
    const layer = STAR_LAYERS[li];
    const stars = [];
    for (let si = 0; si < layer.count; ++si)
      stars.push({
        x: Math.random() * CANVAS_W * 2,
        y: Math.random() * CANVAS_H * 2,
        size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
        phase: Math.random() * TWO_PI,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
      });
    starLayers.push(stars);
  }

  updateWindowTitle();

  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
