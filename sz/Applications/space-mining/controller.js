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
  const MAX_HIGH_SCORES = 5;

  /* Ship */
  const BASE_THRUST = 200;
  const DRAG = 0.97;
  const ROTATION_SPEED = 4;
  const SHIP_SIZE = 14;

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

  /* Upgrades */
  const UPGRADE_DEFS = {
    drillSpeed:    { label: 'Drill Speed',   baseCost: 100, costMult: 2.0, maxLevel: 5 },
    cargoCapacity: { label: 'Cargo Size',    baseCost: 80,  costMult: 1.8, maxLevel: 5 },
    enginePower:   { label: 'Engine Power',  baseCost: 120, costMult: 2.2, maxLevel: 5 },
    scannerRange:  { label: 'Scanner',       baseCost: 60,  costMult: 1.5, maxLevel: 3 }
  };

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

  /* Ship */
  let ship = { x: STATION_X, y: STATION_Y - 100, vx: 0, vy: 0, angle: 0 };
  let thrustPower = BASE_THRUST;
  let drillSpeed = BASE_DRILL_RATE;
  let cargoMax = BASE_CARGO_MAX;
  let scannerLevel = 0;

  /* Upgrade levels */
  let upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, scannerRange: 0 };

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

  /* Stars (background) */
  let stars = [];

  /* Camera */
  let camera = { x: 0, y: 0 };

  /* Input */
  const keys = {};

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

  /* ── Stars ── */
  function initStars() {
    stars = [];
    for (let i = 0; i < 120; ++i)
      stars.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.2 + Math.random() * 0.6
      });
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
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].score}</td><td>${highScores[i].oreMined}</td>`;
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

  function buyUpgrade(type) {
    if (!canAffordUpgrade(type)) return false;
    const cost = getUpgradeCost(type);
    credits -= cost;
    ++upgradeLevels[type];
    applyUpgrades();
    return true;
  }

  function applyUpgrades() {
    drillSpeed = BASE_DRILL_RATE * (1 + upgradeLevels.drillSpeed * 0.4);
    cargoMax = BASE_CARGO_MAX + upgradeLevels.cargoCapacity * 5;
    thrustPower = BASE_THRUST * (1 + upgradeLevels.enginePower * 0.3);
    scannerLevel = upgradeLevels.scannerRange;
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

  /* ── Reset ── */
  function resetGame() {
    credits = 0;
    totalOreMined = 0;
    ship = { x: STATION_X, y: STATION_Y - 100, vx: 0, vy: 0, angle: -Math.PI / 2 };
    upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, scannerRange: 0 };
    applyUpgrades();
    resetCargo();
    isDrilling = false;
    drillTarget = null;
    drillTimer = 0;
    randomizePrices();
    spawnAsteroids();
    initStars();
    particles.clear();
    floatingText.clear();
    state = STATE_PLAYING;
    updateWindowTitle();
  }

  /* ── Input ── */
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    if (state === STATE_READY && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      resetGame();
      return;
    }

    if (state === STATE_PLAYING && (e.code === 'KeyE')) {
      const dist = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
      if (dist < STATION_DOCK_RANGE)
        sellCargo();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Click/Tap to start ── */
  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_READY || state === STATE_GAME_OVER)
      resetGame();
  });

  /* ── Update ── */
  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;

    updateShip(dt);
    updateDrilling(dt);
    updateAsteroidRotations(dt);
    checkAsteroidRespawn();
    updateCamera();
    updateStatusBar();
    updateWindowTitle();
  }

  function updateShip(dt) {
    /* Rotation */
    if (keys['ArrowLeft'] || keys['KeyA'])
      ship.angle -= ROTATION_SPEED * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      ship.angle += ROTATION_SPEED * dt;

    /* Thrust */
    let thrusting = false;
    if (keys['ArrowUp'] || keys['KeyW']) {
      ship.vx += Math.cos(ship.angle) * thrustPower * dt;
      ship.vy += Math.sin(ship.angle) * thrustPower * dt;
      thrusting = true;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      ship.vx -= Math.cos(ship.angle) * thrustPower * 0.5 * dt;
      ship.vy -= Math.sin(ship.angle) * thrustPower * 0.5 * dt;
    }

    /* Drag */
    ship.vx *= DRAG;
    ship.vy *= DRAG;

    /* Speed limit */
    const speed = Math.hypot(ship.vx, ship.vy);
    const maxSpeed = thrustPower * 1.5;
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
        particles.trail(bx - camera.x, by - camera.y, { color: '#f80', vx: -Math.cos(ship.angle) * 2, vy: -Math.sin(ship.angle) * 2 });
      }
    }
  }

  function updateDrilling(dt) {
    isDrilling = false;
    drillTarget = null;

    if (!keys['Space']) return;
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
    if (nearest.resources <= 0) {
      depleteAsteroid(nearest);
    }
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

  function updateCamera() {
    camera.x = ship.x - CANVAS_W / 2;
    camera.y = ship.y - CANVAS_H / 2;
    camera.x = Math.max(0, Math.min(WORLD_W - CANVAS_W, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_H - CANVAS_H, camera.y));
  }

  /* ── Draw ── */
  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawStars();
    drawAsteroids();
    drawStation();
    drawShip();
    drawDrillBeam();
    drawMinimap();
    drawHUD();

    if (state === STATE_READY)
      drawTitleScreen();
    else if (state === STATE_PAUSED)
      drawPauseOverlay();
    else if (state === STATE_GAME_OVER)
      drawGameOverScreen();
  }

  function drawStars() {
    for (const s of stars) {
      const sx = s.x - camera.x * 0.3;
      const sy = s.y - camera.y * 0.3;
      const wx = ((sx % CANVAS_W) + CANVAS_W) % CANVAS_W;
      const wy = ((sy % CANVAS_H) + CANVAS_H) % CANVAS_H;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(wx, wy, s.size, s.size);
    }
    ctx.globalAlpha = 1;
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
    }
  }

  function drawStation() {
    const sx = STATION_X - camera.x;
    const sy = STATION_Y - camera.y;
    if (sx < -100 || sx > CANVAS_W + 100 || sy < -100 || sy > CANVAS_H + 100) return;

    /* Station ring */
    ctx.save();
    ctx.strokeStyle = '#4a9';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#4a9';
    ctx.beginPath();
    ctx.arc(sx, sy, STATION_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    /* Inner structure */
    ctx.fillStyle = '#2a5a4a';
    ctx.beginPath();
    ctx.arc(sx, sy, STATION_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();

    /* Center dot */
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
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
        ctx.fillText('[E] Sell / Shop', sx, sy + STATION_RADIUS + 20);
      }
    }
  }

  function drawShip() {
    const sx = ship.x - camera.x;
    const sy = ship.y - camera.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ship.angle);

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

  function drawMinimap() {
    const mw = 100, mh = 100;
    const mx = CANVAS_W - mw - 8;
    const my = 8;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;

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
      ctx.fillRect(mx + a.x * sx - 1, my + a.y * sy - 1, 2, 2);
    }

    /* Station */
    ctx.fillStyle = '#0f0';
    ctx.fillRect(mx + STATION_X * sx - 2, my + STATION_Y * sy - 2, 4, 4);

    /* Ship */
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx + ship.x * sx - 1.5, my + ship.y * sy - 1.5, 3, 3);

    /* Viewport rectangle */
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mx + camera.x * sx, my + camera.y * sy, CANVAS_W * sx, CANVAS_H * sy);

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

    /* Show drill speed and proximity */
    if (isDrilling && drillTarget) {
      ctx.fillStyle = ORE_TYPES[drillTarget.oreType].glowColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const pct = Math.round((drillTarget.resources / drillTarget.maxResources) * 100);
      ctx.fillText('DRILLING ' + ORE_TYPES[drillTarget.oreType].label + ' (' + pct + '%)', CANVAS_W / 2, CANVAS_H - 20);
    }
  }

  function drawTitleScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#4ae';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4ae';
    ctx.fillText('SPACE MINING', CANVAS_W / 2, CANVAS_H / 2 - 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Tap or press SPACE to start', CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '12px sans-serif';
    ctx.fillText('Arrow Keys / WASD to fly  |  SPACE to drill  |  E to sell at station', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
    ctx.font = '14px sans-serif';
    ctx.fillText('Press ESC to resume', CANVAS_W / 2, CANVAS_H / 2 + 30);
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
    if (statusState)
      statusState.textContent = state === STATE_PLAYING ? 'Mining' : state;
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
  initStars();
  randomizePrices();
  spawnAsteroids();
  resetCargo();
  applyUpgrades();
  updateWindowTitle();
  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
