;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const WORLD_W = 3000;
  const WORLD_H = 3000;

  /* Storage */
  const STORAGE_PREFIX = 'sz-space-mining';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* Ship */
  const BASE_THRUST = 200;
  const DRAG = 0.97;
  const ROTATION_SPEED = 4;
  const SHIP_SIZE = 14;
  const BASE_HULL = 100;

  /* Drill */
  const BASE_DRILL_RATE = 1.0;
  const DRILL_RANGE = 60;

  /* Cargo */
  const BASE_CARGO_MAX = 10;

  /* Ore types with glow colors and base price */
  const ORE_TYPES = {
    iron:     { color: '#aaa', glowColor: '#ccc',    basePrice: 10,  label: 'Iron' },
    gold:     { color: '#ffd700', glowColor: '#ffe44d', basePrice: 25,  label: 'Gold' },
    platinum: { color: '#e8e8e8', glowColor: '#fff',    basePrice: 50,  label: 'Platinum' },
    crystal:  { color: '#40e0d0', glowColor: '#7fffd4', basePrice: 80,  label: 'Crystal' }
  };
  const ORE_KEYS = Object.keys(ORE_TYPES);

  /* Asteroid types with yield definitions */
  const ASTEROID_DEFS = [
    { minRadius: 20, maxRadius: 35, oreType: 'iron',     resourceAmount: 8,  abundance: 0.4, richness: 1.0 },
    { minRadius: 18, maxRadius: 30, oreType: 'gold',     resourceAmount: 5,  abundance: 0.3, richness: 1.2 },
    { minRadius: 15, maxRadius: 28, oreType: 'platinum',  resourceAmount: 3,  abundance: 0.2, richness: 1.5 },
    { minRadius: 12, maxRadius: 22, oreType: 'crystal',   resourceAmount: 2,  abundance: 0.1, richness: 2.0 }
  ];
  const ASTEROID_COUNT = 40;

  /* Station */
  const STATION_X = WORLD_W / 2;
  const STATION_Y = WORLD_H / 2;
  const STATION_RADIUS = 40;
  const STATION_DOCK_RANGE = 80;

  /* Upgrades -- now includes hullStrength */
  const UPGRADE_DEFS = {
    drillSpeed:    { label: 'Drill Speed',   baseCost: 100, costMult: 2.0, maxLevel: 5, icon: 'D', desc: '+40% drill rate' },
    cargoCapacity: { label: 'Cargo Size',    baseCost: 80,  costMult: 1.8, maxLevel: 5, icon: 'C', desc: '+5 cargo slots' },
    enginePower:   { label: 'Engine Power',  baseCost: 120, costMult: 2.2, maxLevel: 5, icon: 'E', desc: '+30% thrust' },
    hullStrength:  { label: 'Hull Armor',    baseCost: 150, costMult: 2.0, maxLevel: 5, icon: 'H', desc: '+20 max hull' },
    scannerRange:  { label: 'Scanner',       baseCost: 60,  costMult: 1.5, maxLevel: 3, icon: 'S', desc: '+ore indicators' }
  };
  const UPGRADE_KEYS = Object.keys(UPGRADE_DEFS);

  /* Powerups */
  const POWERUP_DEFS = {
    shield:   { label: 'Shield Boost', color: '#44aaff', glowColor: '#88ccff', duration: 10, icon: 'S' },
    speed:    { label: 'Speed Boost',  color: '#ffaa00', glowColor: '#ffcc44', duration: 8,  icon: 'F' },
    magnet:   { label: 'Ore Magnet',   color: '#ff44ff', glowColor: '#ff88ff', duration: 12, icon: 'M' },
    bonusOre: { label: 'Bonus Ore',    color: '#44ff44', glowColor: '#88ff88', duration: 0,  icon: '+' },
    repair:   { label: 'Repair Kit',   color: '#ff4444', glowColor: '#ff8888', duration: 0,  icon: 'R' }
  };
  const POWERUP_KEYS = Object.keys(POWERUP_DEFS);
  const POWERUP_SPAWN_INTERVAL = 15;
  const POWERUP_LIFETIME = 20;
  const POWERUP_RADIUS = 12;
  const POWERUP_COLLECT_RANGE = 30;
  const MAX_POWERUPS = 5;

  /* Background */
  const BG_ASTEROID_COUNT = 20;

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCredits = document.getElementById('statusCredits');
  const statusCargo = document.getElementById('statusCargo');
  const statusState = document.getElementById('statusState');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API ── */
  const { User32 } = window.SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Game State ── */
  let state = STATE_READY;
  let credits = 0;
  let totalOreMined = 0;
  let highScores = [];
  let gameTime = 0;

  /* Ship */
  let ship = { x: STATION_X, y: STATION_Y - 100, vx: 0, vy: 0, angle: 0 };
  let thrustPower = BASE_THRUST;
  let drillSpeed = BASE_DRILL_RATE;
  let cargoMax = BASE_CARGO_MAX;
  let scannerLevel = 0;
  let hullMax = BASE_HULL;
  let hull = BASE_HULL;

  /* Upgrade levels */
  let upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, hullStrength: 0, scannerRange: 0 };

  /* Cargo contents: { iron: 0, gold: 0, platinum: 0, crystal: 0 } */
  let cargo = {};

  /* Drilling state */
  let isDrilling = false;
  let drillTarget = null;
  let drillTimer = 0;

  /* Market prices (fluctuate) */
  let marketPrices = {};

  /* Asteroids */
  let asteroids = [];

  /* Stars -- three parallax layers */
  let starLayers = [[], [], []];

  /* Nebula patches */
  let nebulae = [];

  /* Background asteroids (decorative, far layer) */
  let bgAsteroids = [];

  /* Shooting stars */
  let shootingStars = [];
  let shootingStarTimer = 0;

  /* Powerups */
  let powerups = [];
  let powerupSpawnTimer = 0;
  let activePowerups = {};

  /* Shop state */
  let shopOpen = false;
  let shopSelection = 0;

  /* Tutorial */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'Welcome, Miner!', lines: ['You pilot a mining rig in an asteroid field.', 'Your goal: mine ore, sell it, and get rich!', '', 'Keyboard: Arrow Keys or WASD to fly.', 'Mouse: Click and hold to fly toward the cursor.'] },
    { title: 'Mining Ore', lines: ['Keyboard: Hold SPACE near an asteroid to drill.', 'Mouse: Click and hold on an asteroid to fly', '  there and drill automatically.', '', 'Ore types: Iron (grey), Gold (yellow),', 'Platinum (white), Crystal (teal - most valuable).'] },
    { title: 'Selling & Upgrades', lines: ['Return to the green station in the center.', 'Press E or click the station to sell and shop.', '', 'Buy upgrades: better drill, bigger cargo,', 'stronger hull, faster engines, and scanner.', 'Use 1-5 keys or click to purchase.'] },
    { title: 'Powerups & Tips', lines: ['Floating powerups appear periodically:', '  Shield (blue), Speed (orange), Magnet (pink),', '  Bonus Ore (green), Repair Kit (red).', '', 'Fly into them to collect. Watch the minimap!', 'Press H anytime for help. Good luck, miner!'] }
  ];

  /* Contextual hints */
  let hintTimer = 0;
  let currentHint = '';
  let hintAlpha = 0;
  let lastHintId = '';
  let hintsShown = {};

  /* Camera */
  let camera = { x: 0, y: 0 };

  /* Input */
  const keys = {};

  /* Mouse input */
  let mouseDown = false;
  let mouseWorldX = 0;
  let mouseWorldY = 0;
  let mouseCanvasX = 0;
  let mouseCanvasY = 0;
  let mouseActive = false;       /* true while pointer is held on the game canvas */
  let mouseDrilling = false;     /* true when mouse-hold targets an asteroid in drill range */

  /* Animation */
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;
  let thrusterTimer = 0;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Stars -- 3 parallax layers ── */
  function initStars() {
    starLayers = [[], [], []];
    const counts = [80, 60, 40];
    for (let layer = 0; layer < 3; ++layer) {
      for (let i = 0; i < counts[layer]; ++i)
        starLayers[layer].push({
          x: Math.random() * WORLD_W * 1.5,
          y: Math.random() * WORLD_H * 1.5,
          size: layer === 0 ? 0.5 + Math.random() * 0.8 : layer === 1 ? 0.8 + Math.random() * 1.2 : 1.2 + Math.random() * 2.0,
          alpha: 0.15 + Math.random() * 0.4 + layer * 0.1,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 1 + Math.random() * 3,
          hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? '#aaccff' : '#ffccaa') : '#fff'
        });
    }
  }

  /* ── Nebulae ── */
  function initNebulae() {
    nebulae = [];
    const colors = [
      'rgba(80,40,120,0.04)', 'rgba(40,80,120,0.035)', 'rgba(120,40,60,0.03)',
      'rgba(40,120,80,0.035)', 'rgba(100,60,140,0.03)', 'rgba(60,100,120,0.025)'
    ];
    for (let i = 0; i < 8; ++i)
      nebulae.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        radius: 150 + Math.random() * 250,
        color: colors[i % colors.length],
        driftX: (Math.random() - 0.5) * 2,
        driftY: (Math.random() - 0.5) * 2
      });
  }

  /* ── Background Asteroids (decorative, slow drift) ── */
  function initBgAsteroids() {
    bgAsteroids = [];
    for (let i = 0; i < BG_ASTEROID_COUNT; ++i) {
      const r = 3 + Math.random() * 8;
      bgAsteroids.push({
        x: Math.random() * WORLD_W * 1.5,
        y: Math.random() * WORLD_H * 1.5,
        radius: r,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        driftX: (Math.random() - 0.5) * 8,
        driftY: (Math.random() - 0.5) * 8,
        alpha: 0.15 + Math.random() * 0.2,
        vertices: (() => {
          const v = [];
          const n = 5 + Math.floor(Math.random() * 4);
          for (let j = 0; j < n; ++j)
            v.push({ a: (j / n) * Math.PI * 2, d: r * (0.6 + Math.random() * 0.4) });
          return v;
        })()
      });
    }
  }

  /* ── Persistence ── */
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

  function loadTutorialSeen() {
    try {
      tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1';
    } catch (_) {
      tutorialSeen = false;
    }
  }

  function saveTutorialSeen() {
    try {
      localStorage.setItem(STORAGE_TUTORIAL, '1');
    } catch (_) {}
  }

  function addHighScore(finalCredits, oreMined) {
    highScores.push({ score: finalCredits, oreMined: oreMined });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + highScores[i].score + '</td><td>' + highScores[i].oreMined + '</td>';
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ── Market Prices ── */
  function randomizePrices() {
    for (const key of ORE_KEYS) {
      const base = ORE_TYPES[key].basePrice;
      const priceMultiplier = 0.7 + Math.random() * 0.6;
      marketPrices[key] = Math.round(base * priceMultiplier);
    }
  }

  /* ── Asteroids ── */
  function spawnAsteroids() {
    asteroids = [];
    for (let i = 0; i < ASTEROID_COUNT; ++i) {
      const def = pickAsteroidDef();
      const radius = def.minRadius + Math.random() * (def.maxRadius - def.minRadius);
      let x, y;
      do {
        x = 100 + Math.random() * (WORLD_W - 200);
        y = 100 + Math.random() * (WORLD_H - 200);
      } while (Math.hypot(x - STATION_X, y - STATION_Y) < 200);

      asteroids.push(createAsteroid(x, y, radius, def));
    }
  }

  function pickAsteroidDef() {
    const r = Math.random();
    let cumulative = 0;
    for (const def of ASTEROID_DEFS) {
      cumulative += def.abundance;
      if (r <= cumulative) return def;
    }
    return ASTEROID_DEFS[0];
  }

  function createAsteroid(x, y, radius, def) {
    const vertices = [];
    const vertexCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < vertexCount; ++i) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const jitter = 0.7 + Math.random() * 0.3;
      vertices.push({ angle, dist: radius * jitter });
    }
    return {
      x, y, radius,
      oreType: def.oreType,
      resources: def.resourceAmount * def.richness,
      maxResources: def.resourceAmount * def.richness,
      vertices,
      rotationAngle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3
    };
  }

  /* ── Cargo ── */
  function resetCargo() {
    cargo = {};
    for (const key of ORE_KEYS)
      cargo[key] = 0;
  }

  function totalCargo() {
    let sum = 0;
    for (const key of ORE_KEYS)
      sum += cargo[key];
    return Math.round(sum * 10) / 10;
  }

  function cargoIsFull() {
    return totalCargo() >= cargoMax;
  }

  /* ── Upgrades ── */
  function getUpgradeCost(type) {
    const def = UPGRADE_DEFS[type];
    return Math.round(def.baseCost * Math.pow(def.costMult, upgradeLevels[type]));
  }

  function canAffordUpgrade(type) {
    return credits >= getUpgradeCost(type) && upgradeLevels[type] < UPGRADE_DEFS[type].maxLevel;
  }

  function isMaxLevel(type) {
    return upgradeLevels[type] >= UPGRADE_DEFS[type].maxLevel;
  }

  function buyUpgrade(type) {
    if (!canAffordUpgrade(type)) return false;
    const cost = getUpgradeCost(type);
    credits -= cost;
    ++upgradeLevels[type];
    applyUpgrades();
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, UPGRADE_DEFS[type].label + ' upgraded!', { color: '#4af', font: 'bold 14px sans-serif' });
    return true;
  }

  function applyUpgrades() {
    drillSpeed = BASE_DRILL_RATE * (1 + upgradeLevels.drillSpeed * 0.4);
    cargoMax = BASE_CARGO_MAX + upgradeLevels.cargoCapacity * 5;
    thrustPower = BASE_THRUST * (1 + upgradeLevels.enginePower * 0.3);
    hullMax = BASE_HULL + upgradeLevels.hullStrength * 20;
    scannerLevel = upgradeLevels.scannerRange;
  }

  /* ── Powerups ── */
  function spawnPowerup() {
    if (powerups.length >= MAX_POWERUPS) return;
    const type = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
    let x, y, attempts = 0;
    do {
      x = 150 + Math.random() * (WORLD_W - 300);
      y = 150 + Math.random() * (WORLD_H - 300);
      ++attempts;
    } while (Math.hypot(x - STATION_X, y - STATION_Y) < 150 && attempts < 15);

    powerups.push({
      x, y, type,
      lifetime: POWERUP_LIFETIME,
      bobPhase: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  function collectPowerup(pu) {
    const def = POWERUP_DEFS[pu.type];
    const sx = pu.x - camera.x;
    const sy = pu.y - camera.y;
    particles.burst(sx, sy, 15, { color: def.color, speed: 3, life: 0.8 });
    floatingText.add(sx, sy - 20, def.label + '!', { color: def.glowColor, font: 'bold 13px sans-serif' });

    switch (pu.type) {
      case 'shield':
        activePowerups.shield = (activePowerups.shield || 0) + def.duration;
        break;
      case 'speed':
        activePowerups.speed = (activePowerups.speed || 0) + def.duration;
        break;
      case 'magnet':
        activePowerups.magnet = (activePowerups.magnet || 0) + def.duration;
        break;
      case 'bonusOre':
        if (!cargoIsFull()) {
          const oreKey = ORE_KEYS[Math.floor(Math.random() * ORE_KEYS.length)];
          const amount = Math.min(2, cargoMax - totalCargo());
          cargo[oreKey] += amount;
          totalOreMined += amount;
        }
        break;
      case 'repair':
        hull = Math.min(hullMax, hull + 30);
        break;
    }
  }

  function updatePowerups(dt) {
    powerupSpawnTimer += dt;
    if (powerupSpawnTimer >= POWERUP_SPAWN_INTERVAL) {
      powerupSpawnTimer = 0;
      spawnPowerup();
    }

    /* Update active powerup durations */
    for (const key of Object.keys(activePowerups)) {
      activePowerups[key] -= dt;
      if (activePowerups[key] <= 0)
        delete activePowerups[key];
    }

    /* Magnet effect: pull nearby powerups toward ship */
    const magnetActive = activePowerups.magnet > 0;

    for (let i = powerups.length - 1; i >= 0; --i) {
      const pu = powerups[i];
      pu.lifetime -= dt;
      pu.bobPhase += dt * 2;
      pu.pulsePhase += dt * 3;

      if (magnetActive) {
        const dx = ship.x - pu.x;
        const dy = ship.y - pu.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 300 && dist > 5) {
          const pull = 120 / dist;
          pu.x += (dx / dist) * pull * dt * 60;
          pu.y += (dy / dist) * pull * dt * 60;
        }
      }

      /* Collect */
      const dist = Math.hypot(ship.x - pu.x, ship.y - pu.y);
      if (dist < POWERUP_COLLECT_RANGE) {
        collectPowerup(pu);
        powerups.splice(i, 1);
        continue;
      }

      /* Expire */
      if (pu.lifetime <= 0) {
        powerups.splice(i, 1);
      }
    }
  }

  /* ── Sell ── */
  function sellCargo() {
    if (totalCargo() <= 0) return;
    let profit = 0;
    for (const key of ORE_KEYS) {
      if (cargo[key] > 0) {
        const value = Math.round(cargo[key] * marketPrices[key]);
        profit += value;
        cargo[key] = 0;
      }
    }
    credits += profit;
    if (profit > 0)
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, '+' + profit + ' credits', { color: '#0f0', font: 'bold 18px sans-serif' });
    randomizePrices();
  }

  /* ── Show Hint ── */
  function showHint(id, text) {
    if (hintsShown[id]) return;
    hintsShown[id] = true;
    currentHint = text;
    hintTimer = 5;
    hintAlpha = 1;
    lastHintId = id;
  }

  /* ── Reset ── */
  function resetGame() {
    credits = 0;
    totalOreMined = 0;
    gameTime = 0;
    ship = { x: STATION_X, y: STATION_Y - 100, vx: 0, vy: 0, angle: -Math.PI / 2 };
    upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, hullStrength: 0, scannerRange: 0 };
    applyUpgrades();
    hull = hullMax;
    resetCargo();
    isDrilling = false;
    drillTarget = null;
    drillTimer = 0;
    shopOpen = false;
    shopSelection = 0;
    powerups = [];
    powerupSpawnTimer = 0;
    activePowerups = {};
    hintsShown = {};
    mouseDown = false;
    mouseActive = false;
    mouseDrilling = false;
    randomizePrices();
    spawnAsteroids();
    initStars();
    initNebulae();
    initBgAsteroids();
    shootingStars = [];
    shootingStarTimer = 0;
    particles.clear();
    floatingText.clear();
    state = STATE_PLAYING;
    updateWindowTitle();

    if (!tutorialSeen) {
      showTutorial = true;
      tutorialPage = 0;
      tutorialSeen = true;
      saveTutorialSeen();
    }
  }

  /* ── Input ── */
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

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

    if (e.key === 'Escape') {
      e.preventDefault();
      if (shopOpen) {
        shopOpen = false;
        return;
      }
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (state === STATE_READY && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      resetGame();
      return;
    }

    if (state === STATE_PLAYING && e.code === 'KeyE') {
      const dist = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
      if (dist < STATION_DOCK_RANGE) {
        if (!shopOpen) {
          sellCargo();
          shopOpen = true;
          shopSelection = 0;
        } else
          shopOpen = false;
      }
      return;
    }

    /* Shop keyboard controls */
    if (shopOpen && state === STATE_PLAYING) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        shopSelection = (shopSelection - 1 + UPGRADE_KEYS.length) % UPGRADE_KEYS.length;
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        shopSelection = (shopSelection + 1) % UPGRADE_KEYS.length;
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        buyUpgrade(UPGRADE_KEYS[shopSelection]);
        return;
      }
      /* Quick buy by number key */
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= UPGRADE_KEYS.length) {
        e.preventDefault();
        shopSelection = numKey - 1;
        buyUpgrade(UPGRADE_KEYS[numKey - 1]);
        return;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Click/Tap to start + mouse-driven gameplay ── */
  canvas.addEventListener('pointerdown', (e) => {
    updateMouseWorld(e);

    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      resetGame();
      return;
    }
    /* Shop click handling */
    if (shopOpen && state === STATE_PLAYING) {
      const mx = mouseCanvasX;
      const my = mouseCanvasY;

      const panelW = 320;
      const panelX = CANVAS_W / 2 - panelW / 2;
      const panelY = 60;
      const rowH = 28;
      const startY = panelY + 50;

      /* Close button */
      const closeBtnX = panelX + panelW / 2 - 40;
      const closeBtnY = startY + UPGRADE_KEYS.length * rowH + 34;
      if (mx >= closeBtnX && mx <= closeBtnX + 80 && my >= closeBtnY && my <= closeBtnY + 22) {
        shopOpen = false;
        return;
      }

      /* Click outside panel to close */
      const panelH = 50 + UPGRADE_KEYS.length * rowH + 60;
      if (mx < panelX || mx > panelX + panelW || my < panelY || my > panelY + panelH) {
        shopOpen = false;
        return;
      }

      for (let i = 0; i < UPGRADE_KEYS.length; ++i) {
        const ry = startY + i * rowH;
        if (mx >= panelX && mx <= panelX + panelW && my >= ry && my <= ry + rowH) {
          shopSelection = i;
          buyUpgrade(UPGRADE_KEYS[i]);
          break;
        }
      }
      return;
    }

    /* In-game mouse controls */
    if (state === STATE_PLAYING && !shopOpen) {
      mouseDown = true;
      mouseActive = true;

      /* Click near station to dock/sell */
      const distToStation = Math.hypot(mouseWorldX - STATION_X, mouseWorldY - STATION_Y);
      if (distToStation < STATION_DOCK_RANGE) {
        const shipDistToStation = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
        if (shipDistToStation < STATION_DOCK_RANGE) {
          sellCargo();
          shopOpen = true;
          shopSelection = 0;
          mouseDown = false;
          mouseActive = false;
          return;
        }
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!mouseDown) return;
    updateMouseWorld(e);
  });

  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
    mouseActive = false;
    mouseDrilling = false;
  });

  canvas.addEventListener('pointerleave', () => {
    mouseDown = false;
    mouseActive = false;
    mouseDrilling = false;
  });

  /* ── Mouse helpers ── */
  function canvasToWorld(cx, cy) {
    return { x: cx + camera.x, y: cy + camera.y };
  }

  function updateMouseWorld(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    mouseCanvasX = (e.clientX - rect.left) * scaleX;
    mouseCanvasY = (e.clientY - rect.top) * scaleY;
    const w = canvasToWorld(mouseCanvasX, mouseCanvasY);
    mouseWorldX = w.x;
    mouseWorldY = w.y;
  }

  /* ── Update ── */
  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;
    if (showTutorial) return;

    gameTime += dt;

    if (!shopOpen) {
      updateShip(dt);
      updateDrilling(dt);
    }
    updateAsteroidRotations(dt);
    checkAsteroidRespawn();
    updatePowerups(dt);
    updateBgAsteroids(dt);
    updateShootingStars(dt);
    updateNebulae(dt);
    updateHints(dt);
    updateCamera();
    updateStatusBar();
    updateWindowTitle();
  }

  function updateShip(dt) {
    const speedMult = activePowerups.speed > 0 ? 1.6 : 1.0;

    /* Keyboard rotation */
    if (keys['ArrowLeft'] || keys['KeyA'])
      ship.angle -= ROTATION_SPEED * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      ship.angle += ROTATION_SPEED * dt;

    /* Keyboard thrust */
    let thrusting = false;
    if (keys['ArrowUp'] || keys['KeyW']) {
      ship.vx += Math.cos(ship.angle) * thrustPower * speedMult * dt;
      ship.vy += Math.sin(ship.angle) * thrustPower * speedMult * dt;
      thrusting = true;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      ship.vx -= Math.cos(ship.angle) * thrustPower * 0.5 * speedMult * dt;
      ship.vy -= Math.sin(ship.angle) * thrustPower * 0.5 * speedMult * dt;
    }

    /* Mouse-driven movement: rotate toward target and thrust when held */
    mouseDrilling = false;
    if (mouseActive && mouseDown) {
      /* Recalculate world position from current camera (camera follows ship) */
      const tw = canvasToWorld(mouseCanvasX, mouseCanvasY);
      mouseWorldX = tw.x;
      mouseWorldY = tw.y;

      const dx = mouseWorldX - ship.x;
      const dy = mouseWorldY - ship.y;
      const distToTarget = Math.hypot(dx, dy);

      /* Check if mouse target is near an asteroid -- prefer drilling over flying */
      let nearAsteroid = null;
      for (const a of asteroids) {
        if (a.resources <= 0) continue;
        if (Math.hypot(mouseWorldX - a.x, mouseWorldY - a.y) < a.radius + 20) {
          nearAsteroid = a;
          break;
        }
      }

      if (nearAsteroid) {
        /* Fly toward the asteroid, then drill once in range */
        const adx = nearAsteroid.x - ship.x;
        const ady = nearAsteroid.y - ship.y;
        const asteroidDist = Math.hypot(adx, ady);
        const targetAngle = Math.atan2(ady, adx);

        /* Rotate toward asteroid */
        let angleDiff = targetAngle - ship.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), ROTATION_SPEED * dt);

        /* Thrust toward asteroid if not yet in drill range */
        if (asteroidDist > DRILL_RANGE + nearAsteroid.radius * 0.5) {
          ship.vx += Math.cos(ship.angle) * thrustPower * speedMult * dt;
          ship.vy += Math.sin(ship.angle) * thrustPower * speedMult * dt;
          thrusting = true;
        } else {
          /* In range: signal drilling */
          mouseDrilling = true;
        }
      } else if (distToTarget > SHIP_SIZE * 2) {
        /* Navigate toward the clicked point */
        const targetAngle = Math.atan2(dy, dx);

        /* Smooth rotation toward target */
        let angleDiff = targetAngle - ship.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), ROTATION_SPEED * dt);

        /* Thrust when roughly facing target */
        if (Math.abs(angleDiff) < Math.PI * 0.6) {
          ship.vx += Math.cos(ship.angle) * thrustPower * speedMult * dt;
          ship.vy += Math.sin(ship.angle) * thrustPower * speedMult * dt;
          thrusting = true;
        }
      }
    }

    /* Drag */
    ship.vx *= DRAG;
    ship.vy *= DRAG;

    /* Speed limit */
    const speed = Math.hypot(ship.vx, ship.vy);
    const maxSpeed = thrustPower * 1.5 * speedMult;
    if (speed > maxSpeed) {
      ship.vx = (ship.vx / speed) * maxSpeed;
      ship.vy = (ship.vy / speed) * maxSpeed;
    }

    /* Position */
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    /* Clamp to world bounds */
    if (ship.x < SHIP_SIZE) { ship.x = SHIP_SIZE; ship.vx = 0; }
    if (ship.y < SHIP_SIZE) { ship.y = SHIP_SIZE; ship.vy = 0; }
    if (ship.x > WORLD_W - SHIP_SIZE) { ship.x = WORLD_W - SHIP_SIZE; ship.vx = 0; }
    if (ship.y > WORLD_H - SHIP_SIZE) { ship.y = WORLD_H - SHIP_SIZE; ship.vy = 0; }

    /* Thruster particles */
    if (thrusting) {
      thrusterTimer += dt;
      if (thrusterTimer > 0.03) {
        thrusterTimer = 0;
        const bx = ship.x - Math.cos(ship.angle) * SHIP_SIZE;
        const by = ship.y - Math.sin(ship.angle) * SHIP_SIZE;
        const thrustColor = activePowerups.speed > 0 ? '#ff4' : '#f80';
        particles.trail(bx - camera.x, by - camera.y, { color: thrustColor, vx: -Math.cos(ship.angle) * 2, vy: -Math.sin(ship.angle) * 2 });
      }
    }

    /* Contextual hints */
    if (gameTime < 30) {
      const distToStation = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
      if (distToStation < STATION_DOCK_RANGE * 1.5 && totalCargo() > 0)
        showHint('sell', 'Press E or click the station to sell ore and buy upgrades');

      let nearAsteroid = false;
      for (const a of asteroids) {
        if (a.resources <= 0) continue;
        if (Math.hypot(ship.x - a.x, ship.y - a.y) < DRILL_RANGE + a.radius + 30) {
          nearAsteroid = true;
          break;
        }
      }
      if (nearAsteroid && totalCargo() < cargoMax)
        showHint('drill', 'Hold SPACE or click and hold an asteroid to mine ore');

      if (gameTime > 3 && !thrusting)
        showHint('move', 'Use WASD/Arrows to fly, or click and hold to fly toward the cursor');
    }
  }

  function updateDrilling(dt) {
    isDrilling = false;
    drillTarget = null;

    if (!keys['Space'] && !mouseDrilling) return;
    if (cargoIsFull()) return;

    /* Find nearest asteroid in drill range */
    let nearest = null;
    let nearestDist = Infinity;
    for (const a of asteroids) {
      if (a.resources <= 0) continue;
      const dist = Math.hypot(ship.x - a.x, ship.y - a.y);
      if (dist < DRILL_RANGE + a.radius && dist < nearestDist) {
        nearest = a;
        nearestDist = dist;
      }
    }

    if (!nearest) return;

    isDrilling = true;
    drillTarget = nearest;
    drillTimer += dt;

    /* Extract resources over time */
    const extractRate = drillSpeed * dt;
    const extracted = Math.min(extractRate, nearest.resources);
    const remainingCapacity = cargoMax - totalCargo();
    const actual = Math.min(extracted, remainingCapacity);

    if (actual > 0) {
      nearest.resources -= actual;
      cargo[nearest.oreType] += actual;
      totalOreMined += actual;

      /* Drill particle spray */
      if (drillTimer > 0.08) {
        drillTimer = 0;
        const drillX = nearest.x - camera.x;
        const drillY = nearest.y - camera.y;
        particles.burst(drillX, drillY, 3, { color: ORE_TYPES[nearest.oreType].color, speed: 2, life: 0.5 });
      }
    }

    /* Check if asteroid is depleted */
    if (nearest.resources <= 0)
      depleteAsteroid(nearest);
  }

  function depleteAsteroid(asteroid) {
    /* Asteroid break apart - debris particles + screen shake */
    const sx = asteroid.x - camera.x;
    const sy = asteroid.y - camera.y;
    particles.burst(sx, sy, 25, { color: ORE_TYPES[asteroid.oreType].color, speed: 4, life: 1.2 });
    particles.burst(sx, sy, 15, { color: '#888', speed: 3, life: 1.0 });
    screenShake.trigger(6, 400);
    floatingText.add(sx, sy - 20, 'DEPLETED', { color: '#f88', font: 'bold 14px sans-serif' });
  }

  function updateAsteroidRotations(dt) {
    for (const a of asteroids)
      a.rotationAngle += a.rotationSpeed * dt;
  }

  function checkAsteroidRespawn() {
    /* Respawn depleted asteroids far from player */
    for (let i = 0; i < asteroids.length; ++i) {
      const a = asteroids[i];
      if (a.resources > 0) continue;

      const def = pickAsteroidDef();
      const radius = def.minRadius + Math.random() * (def.maxRadius - def.minRadius);
      let x, y, attempts = 0;
      do {
        x = 100 + Math.random() * (WORLD_W - 200);
        y = 100 + Math.random() * (WORLD_H - 200);
        ++attempts;
      } while ((Math.hypot(x - ship.x, y - ship.y) < 400 || Math.hypot(x - STATION_X, y - STATION_Y) < 200) && attempts < 20);

      asteroids[i] = createAsteroid(x, y, radius, def);
    }
  }

  function updateBgAsteroids(dt) {
    for (const bg of bgAsteroids) {
      bg.x += bg.driftX * dt;
      bg.y += bg.driftY * dt;
      bg.angle += bg.rotSpeed * dt;
      if (bg.x < -50) bg.x = WORLD_W * 1.5 + 50;
      if (bg.x > WORLD_W * 1.5 + 50) bg.x = -50;
      if (bg.y < -50) bg.y = WORLD_H * 1.5 + 50;
      if (bg.y > WORLD_H * 1.5 + 50) bg.y = -50;
    }
  }

  function updateShootingStars(dt) {
    shootingStarTimer += dt;
    if (shootingStarTimer > 2 + Math.random() * 4) {
      shootingStarTimer = 0;
      if (shootingStars.length < 3) {
        const angle = 0.3 + Math.random() * 0.8;
        const speed = 200 + Math.random() * 300;
        shootingStars.push({
          x: camera.x + Math.random() * CANVAS_W,
          y: camera.y - 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.8,
          maxLife: 0.6 + Math.random() * 0.8,
          length: 20 + Math.random() * 40
        });
      }
    }

    for (let i = shootingStars.length - 1; i >= 0; --i) {
      const ss = shootingStars[i];
      ss.x += ss.vx * dt;
      ss.y += ss.vy * dt;
      ss.life -= dt;
      if (ss.life <= 0)
        shootingStars.splice(i, 1);
    }
  }

  function updateNebulae(dt) {
    for (const n of nebulae) {
      n.x += n.driftX * dt;
      n.y += n.driftY * dt;
    }
  }

  function updateHints(dt) {
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer < 1)
        hintAlpha = hintTimer;
      else
        hintAlpha = Math.min(1, hintAlpha + dt * 3);
    }
  }

  function updateCamera() {
    camera.x = ship.x - CANVAS_W / 2;
    camera.y = ship.y - CANVAS_H / 2;
    camera.x = Math.max(0, Math.min(WORLD_W - CANVAS_W, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_H - CANVAS_H, camera.y));
  }

  /* ── Draw ── */
  function drawGame() {
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawNebulae();
    drawStars();
    drawShootingStars();
    drawBgAsteroids();
    drawAsteroids();
    drawPowerups();
    drawStation();
    drawShip();
    drawDrillBeam();
    drawScannerOverlay();
    drawMinimap();
    drawHUD();
    drawActivePowerupIndicators();
    drawHintOverlay();

    if (shopOpen && state === STATE_PLAYING)
      drawShopPanel();

    if (showTutorial)
      drawTutorialOverlay();
    else if (state === STATE_READY)
      drawTitleScreen();
    else if (state === STATE_PAUSED)
      drawPauseOverlay();
    else if (state === STATE_GAME_OVER)
      drawGameOverScreen();
  }

  function drawNebulae() {
    ctx.save();
    for (const n of nebulae) {
      const sx = n.x - camera.x * 0.15;
      const sy = n.y - camera.y * 0.15;
      const nebGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, n.radius);
      nebGrad.addColorStop(0, n.color);
      nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, n.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStars() {
    const now = gameTime || Date.now() / 1000;
    const parallaxFactors = [0.1, 0.2, 0.35];

    for (let layer = 0; layer < 3; ++layer) {
      const pf = parallaxFactors[layer];
      for (const s of starLayers[layer]) {
        const sx = s.x - camera.x * pf;
        const sy = s.y - camera.y * pf;
        const wx = ((sx % CANVAS_W) + CANVAS_W) % CANVAS_W;
        const wy = ((sy % CANVAS_H) + CANVAS_H) % CANVAS_H;

        /* Twinkle */
        const twinkle = 0.5 + 0.5 * Math.sin(now * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.alpha * twinkle;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.hue;

        if (s.size > 1.8) {
          /* Large stars get a glow halo */
          ctx.save();
          ctx.globalAlpha = alpha * 0.2;
          ctx.fillStyle = s.hue === '#fff' ? '#aaccff' : s.hue;
          ctx.beginPath();
          ctx.arc(wx + s.size * 0.5, wy + s.size * 0.5, s.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = s.hue;
        }

        ctx.fillRect(wx, wy, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShootingStars() {
    ctx.save();
    for (const ss of shootingStars) {
      const sx = ss.x - camera.x;
      const sy = ss.y - camera.y;
      const lifeRatio = ss.life / ss.maxLife;
      const alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      const speed = Math.hypot(ss.vx, ss.vy);
      const nx = ss.vx / speed;
      const ny = ss.vy / speed;

      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#cceeff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - nx * ss.length, sy - ny * ss.length);
      ctx.stroke();

      /* Bright head */
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBgAsteroids() {
    ctx.save();
    const pf = 0.25;
    for (const bg of bgAsteroids) {
      const sx = bg.x - camera.x * pf;
      const sy = bg.y - camera.y * pf;
      const wx = ((sx % CANVAS_W) + CANVAS_W) % CANVAS_W;
      const wy = ((sy % CANVAS_H) + CANVAS_H) % CANVAS_H;

      ctx.globalAlpha = bg.alpha;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(bg.angle);
      ctx.beginPath();
      for (let j = 0; j < bg.vertices.length; ++j) {
        const v = bg.vertices[j];
        const px = Math.cos(v.a) * v.d;
        const py = Math.sin(v.a) * v.d;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#2a2220';
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAsteroids() {
    for (const a of asteroids) {
      if (a.resources <= 0) continue;

      const sx = a.x - camera.x;
      const sy = a.y - camera.y;
      if (sx < -50 || sx > CANVAS_W + 50 || sy < -50 || sy > CANVAS_H + 50) continue;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a.rotationAngle);

      /* Asteroid body */
      ctx.beginPath();
      for (let i = 0; i < a.vertices.length; ++i) {
        const v = a.vertices[i];
        const px = Math.cos(v.angle) * v.dist;
        const py = Math.sin(v.angle) * v.dist;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#5a4a3e';
      ctx.fill();
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Ore glow spots */
      const ore = ORE_TYPES[a.oreType];
      const glowIntensity = a.resources / a.maxResources;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.shadowColor = ore.glowColor;
      ctx.fillStyle = ore.color;
      const oreSpots = 2 + Math.floor(a.radius / 10);
      for (let j = 0; j < oreSpots; ++j) {
        const oa = (j / oreSpots) * Math.PI * 2 + a.rotationAngle * 0.5;
        const od = a.radius * 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(oa) * od, Math.sin(oa) * od, 2 + glowIntensity * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      ctx.restore();

      /* Scanner overlay: ore label when scanner upgraded */
      if (scannerLevel >= 1) {
        const dist = Math.hypot(ship.x - a.x, ship.y - a.y);
        const scanRange = 150 + scannerLevel * 100;
        if (dist < scanRange) {
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = ore.color;
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ore.label, sx, sy - a.radius - 5);
          if (scannerLevel >= 2) {
            const pct = Math.round(glowIntensity * 100);
            ctx.fillText(pct + '%', sx, sy - a.radius - 15);
          }
          if (scannerLevel >= 3) {
            ctx.strokeStyle = ore.color;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.arc(sx, sy, a.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
        }
      }
    }
  }

  function drawPowerups() {
    const now = gameTime || 0;
    for (const pu of powerups) {
      const sx = pu.x - camera.x;
      const sy = pu.y - camera.y;
      if (sx < -30 || sx > CANVAS_W + 30 || sy < -30 || sy > CANVAS_H + 30) continue;

      const def = POWERUP_DEFS[pu.type];
      const bob = Math.sin(pu.bobPhase) * 4;
      const pulse = 0.7 + 0.3 * Math.sin(pu.pulsePhase);
      const fadeAlpha = pu.lifetime < 3 ? pu.lifetime / 3 : 1;

      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.globalAlpha = fadeAlpha;

      /* Glow */
      ctx.shadowBlur = 12 * pulse;
      ctx.shadowColor = def.glowColor;

      /* Outer ring */
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS * pulse, 0, Math.PI * 2);
      ctx.stroke();

      /* Inner fill */
      ctx.globalAlpha = fadeAlpha * 0.3;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS * 0.7 * pulse, 0, Math.PI * 2);
      ctx.fill();

      /* Icon letter */
      ctx.globalAlpha = fadeAlpha;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 1);
      ctx.textBaseline = 'alphabetic';

      ctx.restore();
    }
  }

  function drawStation() {
    const sx = STATION_X - camera.x;
    const sy = STATION_Y - camera.y;
    if (sx < -100 || sx > CANVAS_W + 100 || sy < -100 || sy > CANVAS_H + 100) return;

    const now = gameTime || 0;

    /* Rotating outer ring */
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(now * 0.2);

    ctx.strokeStyle = '#4a9';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#4a9';
    ctx.beginPath();
    ctx.arc(0, 0, STATION_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    /* Docking arms */
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; ++i) {
      const armAngle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(armAngle) * STATION_RADIUS * 0.6, Math.sin(armAngle) * STATION_RADIUS * 0.6);
      ctx.lineTo(Math.cos(armAngle) * STATION_RADIUS, Math.sin(armAngle) * STATION_RADIUS);
      ctx.stroke();
    }

    ctx.restore();

    /* Inner structure (fixed) */
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4a9';
    ctx.fillStyle = '#2a5a4a';
    ctx.beginPath();
    ctx.arc(sx, sy, STATION_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();

    /* Center dot with pulse */
    const centerPulse = 0.7 + 0.3 * Math.sin(now * 3);
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(sx, sy, 4 * centerPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    /* Dock range indicator */
    const distToStation = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
    if (distToStation < STATION_DOCK_RANGE * 2) {
      ctx.save();
      ctx.strokeStyle = distToStation < STATION_DOCK_RANGE ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,0,0.15)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, STATION_DOCK_RANGE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (distToStation < STATION_DOCK_RANGE) {
        ctx.fillStyle = '#0f0';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(shopOpen ? 'Click Close or press E / ESC' : '[E] or Click to Sell & Shop', sx, sy + STATION_RADIUS + 20);
      }
    }
  }

  function drawShip() {
    const sx = ship.x - camera.x;
    const sy = ship.y - camera.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ship.angle);

    /* Shield effect */
    if (activePowerups.shield > 0) {
      ctx.save();
      const shieldPulse = 0.6 + 0.4 * Math.sin(gameTime * 4);
      ctx.globalAlpha = shieldPulse * 0.3;
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#44aaff';
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_SIZE + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* Speed trail effect */
    if (activePowerups.speed > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; ++i) {
        ctx.globalAlpha = 0.15 / i;
        ctx.beginPath();
        ctx.moveTo(-SHIP_SIZE * (0.4 + i * 0.3), -SHIP_SIZE * 0.3);
        ctx.lineTo(-SHIP_SIZE * (0.4 + i * 0.3) - 8 * i, 0);
        ctx.lineTo(-SHIP_SIZE * (0.4 + i * 0.3), SHIP_SIZE * 0.3);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Ship body */
    ctx.fillStyle = '#aab';
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#889';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* Cockpit */
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(SHIP_SIZE * 0.2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    /* Magnet indicator */
    if (activePowerups.magnet > 0) {
      ctx.save();
      const magnetPulse = 0.5 + 0.5 * Math.sin(gameTime * 6);
      ctx.globalAlpha = magnetPulse * 0.15;
      ctx.fillStyle = '#ff44ff';
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_SIZE + 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawDrillBeam() {
    if (!isDrilling || !drillTarget) return;

    const sx = ship.x - camera.x;
    const sy = ship.y - camera.y;
    const tx = drillTarget.x - camera.x;
    const ty = drillTarget.y - camera.y;

    ctx.save();
    ctx.strokeStyle = ORE_TYPES[drillTarget.oreType].glowColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = ORE_TYPES[drillTarget.oreType].glowColor;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawScannerOverlay() {
    if (scannerLevel < 1) return;
    /* Draw scanner pulse ring from ship */
    const sx = ship.x - camera.x;
    const sy = ship.y - camera.y;
    const scanRange = 150 + scannerLevel * 100;
    const pulse = (gameTime * 0.5) % 1;
    ctx.save();
    ctx.globalAlpha = (1 - pulse) * 0.08;
    ctx.strokeStyle = '#4ae';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, scanRange * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap() {
    const mw = 100, mh = 100;
    const mx = CANVAS_W - mw - 8;
    const my = 8;
    const scaleX = mw / WORLD_W;
    const scaleY = mh / WORLD_H;

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#111';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);

    /* Asteroids on minimap */
    for (const a of asteroids) {
      if (a.resources <= 0) continue;
      ctx.fillStyle = ORE_TYPES[a.oreType].color;
      ctx.fillRect(mx + a.x * scaleX - 1, my + a.y * scaleY - 1, 2, 2);
    }

    /* Powerups on minimap */
    for (const pu of powerups) {
      ctx.fillStyle = POWERUP_DEFS[pu.type].color;
      ctx.fillRect(mx + pu.x * scaleX - 1, my + pu.y * scaleY - 1, 2, 2);
    }

    /* Station */
    ctx.fillStyle = '#0f0';
    ctx.fillRect(mx + STATION_X * scaleX - 2, my + STATION_Y * scaleY - 2, 4, 4);

    /* Ship */
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx + ship.x * scaleX - 1.5, my + ship.y * scaleY - 1.5, 3, 3);

    /* Viewport rectangle */
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mx + camera.x * scaleX, my + camera.y * scaleY, CANVAS_W * scaleX, CANVAS_H * scaleY);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHUD() {
    /* Cargo fill indicator */
    const barW = 120, barH = 10;
    const barX = 8, barY = 8;
    const fillRatio = totalCargo() / cargoMax;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = fillRatio >= 1 ? '#f44' : fillRatio > 0.8 ? '#fa0' : '#0a0';
    ctx.fillRect(barX, barY, barW * fillRatio, barH);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cargo: ' + Math.floor(totalCargo()) + '/' + cargoMax, barX, barY + barH + 12);
    ctx.fillText('Credits: ' + credits, barX, barY + barH + 24);

    /* Hull bar */
    const hullBarY = barY + barH + 30;
    const hullRatio = hull / hullMax;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, hullBarY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hullRatio < 0.3 ? '#f44' : hullRatio < 0.6 ? '#fa0' : '#4a4';
    ctx.fillRect(barX, hullBarY, barW * hullRatio, barH);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(barX, hullBarY, barW, barH);
    ctx.fillStyle = '#fff';
    ctx.fillText('Hull: ' + Math.round(hull) + '/' + hullMax, barX, hullBarY + barH + 12);

    /* Show drill speed and proximity */
    if (isDrilling && drillTarget) {
      ctx.fillStyle = ORE_TYPES[drillTarget.oreType].glowColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const pct = Math.round((drillTarget.resources / drillTarget.maxResources) * 100);
      ctx.fillText('DRILLING ' + ORE_TYPES[drillTarget.oreType].label + ' (' + pct + '%)', CANVAS_W / 2, CANVAS_H - 20);
    }
  }

  function drawActivePowerupIndicators() {
    const activeKeys = Object.keys(activePowerups);
    if (!activeKeys.length) return;

    let py = 120;
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    for (const key of activeKeys) {
      const remaining = activePowerups[key];
      if (remaining <= 0) continue;
      const def = POWERUP_DEFS[key];
      const barW = 60;
      const ratio = Math.min(remaining / def.duration, 1);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(7, py - 1, barW + 2, 10);
      ctx.fillStyle = def.color;
      ctx.fillRect(8, py, barW * ratio, 8);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(8, py, barW, 8);
      ctx.fillStyle = '#fff';
      ctx.fillText(def.icon + ' ' + Math.ceil(remaining) + 's', barW + 14, py + 8);
      py += 14;
    }
    ctx.restore();
  }

  function drawHintOverlay() {
    if (hintTimer <= 0 || !currentHint) return;
    ctx.save();
    ctx.globalAlpha = hintAlpha * 0.9;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    const textW = ctx.measureText(currentHint).width;
    const px = CANVAS_W / 2;
    const py = CANVAS_H - 50;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px - textW / 2 - 8, py - 14, textW + 16, 22);
    ctx.fillStyle = '#ffe';
    ctx.fillText(currentHint, px, py);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawShopPanel() {
    const panelW = 320;
    const panelH = 50 + UPGRADE_KEYS.length * 28 + 60;
    const px = (CANVAS_W - panelW) / 2;
    const py = 60;

    /* Background */
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,30,0.92)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#4a9';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    /* Title */
    ctx.fillStyle = '#4ae';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STATION SHOP', px + panelW / 2, py + 24);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.fillText('Credits: ' + credits, px + panelW / 2, py + 40);

    /* Upgrade rows */
    const startY = py + 50;
    const rowH = 28;
    ctx.textAlign = 'left';

    for (let i = 0; i < UPGRADE_KEYS.length; ++i) {
      const key = UPGRADE_KEYS[i];
      const def = UPGRADE_DEFS[key];
      const level = upgradeLevels[key];
      const ry = startY + i * rowH;
      const maxed = isMaxLevel(key);
      const cost = maxed ? 0 : getUpgradeCost(key);
      const canBuy = !maxed && credits >= cost;

      /* Selection highlight */
      if (i === shopSelection) {
        ctx.fillStyle = 'rgba(68,170,238,0.15)';
        ctx.fillRect(px + 4, ry, panelW - 8, rowH - 2);
      }

      /* Number key */
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText((i + 1) + '.', px + 10, ry + 17);

      /* Label */
      ctx.fillStyle = canBuy ? '#fff' : '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText(def.label, px + 28, ry + 17);

      /* Level pips */
      for (let l = 0; l < def.maxLevel; ++l) {
        ctx.fillStyle = l < level ? '#4ae' : '#333';
        ctx.fillRect(px + 140 + l * 14, ry + 8, 10, 8);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 140 + l * 14, ry + 8, 10, 8);
      }

      /* Cost or MAX */
      ctx.textAlign = 'right';
      if (maxed) {
        ctx.fillStyle = '#4a4';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('MAX', px + panelW - 10, ry + 17);
      } else {
        ctx.fillStyle = canBuy ? '#0f0' : '#f44';
        ctx.font = '11px sans-serif';
        ctx.fillText(cost + ' cr', px + panelW - 10, ry + 17);
      }
      ctx.textAlign = 'left';
    }

    /* Description of selected upgrade */
    const selKey = UPGRADE_KEYS[shopSelection];
    const selDef = UPGRADE_DEFS[selKey];
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(selDef.desc, px + panelW / 2, startY + UPGRADE_KEYS.length * rowH + 10);

    /* Market prices */
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    let priceText = 'Market:';
    for (const key of ORE_KEYS)
      priceText += '  ' + ORE_TYPES[key].label + ' ' + marketPrices[key];
    ctx.fillText(priceText, px + panelW / 2, startY + UPGRADE_KEYS.length * rowH + 28);

    /* Close button */
    const closeBtnX = px + panelW / 2 - 40;
    const closeBtnY = startY + UPGRADE_KEYS.length * rowH + 34;
    const closeBtnW = 80;
    const closeBtnH = 22;
    ctx.fillStyle = '#533';
    ctx.fillRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    ctx.strokeStyle = '#a66';
    ctx.lineWidth = 1;
    ctx.strokeRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    ctx.fillStyle = '#faa';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Close', closeBtnX + closeBtnW / 2, closeBtnY + 15);

    ctx.restore();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const centerX = CANVAS_W / 2;
    const panelW = 420;
    const panelH = 240;
    const px = centerX - panelW / 2;
    const py = (CANVAS_H - panelH) / 2;

    /* Panel bg */
    ctx.fillStyle = 'rgba(15,25,40,0.95)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#4ae';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    /* Page indicator */
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, centerX, py + panelH - 12);

    /* Title */
    ctx.fillStyle = '#4ae';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(page.title, centerX, py + 35);

    /* Lines */
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], centerX, py + 65 + i * 22);

    /* Navigation hint */
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / SPACE / Right Arrow = Next  |  ESC = Skip', centerX, py + panelH - 28);
    else
      ctx.fillText('Click / SPACE = Start Mining!  |  Press H anytime for help', centerX, py + panelH - 28);
  }

  function drawTitleScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#4ae';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4ae';
    ctx.fillText('SPACE MINING', CANVAS_W / 2, CANVAS_H / 2 - 50);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Tap or press SPACE to start', CANVAS_W / 2, CANVAS_H / 2);
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD / Arrows to fly  |  SPACE to drill  |  or use Mouse', CANVAS_W / 2, CANVAS_H / 2 + 30);
    ctx.fillStyle = '#888';
    ctx.fillText('Press H for tutorial', CANVAS_W / 2, CANVAS_H / 2 + 55);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
    ctx.font = '14px sans-serif';
    ctx.fillText('Press ESC to resume  |  H for help', CANVAS_W / 2, CANVAS_H / 2 + 30);
  }

  function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Final Credits: ' + credits, CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '14px sans-serif';
    ctx.fillText('Tap or press F2 for New Game', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }

  /* ── Status Bar ── */
  function updateStatusBar() {
    if (statusCredits)
      statusCredits.textContent = 'Credits: ' + credits;
    if (statusCargo)
      statusCargo.textContent = 'Cargo: ' + Math.floor(totalCargo()) + '/' + cargoMax;
    if (statusState) {
      let stateText = state === STATE_PLAYING ? 'Mining' : state;
      if (shopOpen) stateText = 'Docked';
      const activeList = Object.keys(activePowerups);
      if (activeList.length > 0)
        stateText += ' [' + activeList.map(k => POWERUP_DEFS[k].icon).join('') + ']';
      statusState.textContent = stateText;
    }
  }

  /* ── Window Title ── */
  function updateWindowTitle() {
    const title = 'Space Mining - Credits: ' + credits;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  /* ── Game Loop ── */
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

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Menu Actions ── */
  function handleAction(action) {
    switch (action) {
      case 'new':
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

  /* ── OS Integration ── */
  function handleResize() {
    setupCanvas();
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

  /* ── Dialog wiring ── */
  SZ.Dialog.wireAll();

  /* ── MenuBar ── */
  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  /* ── Init ── */
  setupCanvas();
  loadHighScores();
  loadTutorialSeen();
  initStars();
  initNebulae();
  initBgAsteroids();
  randomizePrices();
  spawnAsteroids();
  resetCargo();
  applyUpgrades();
  hull = hullMax;
  updateWindowTitle();
  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
