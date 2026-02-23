;(function() {
  'use strict';

  /* ============================== CONSTANTS ============================== */

  const FIELD_SIZES = {
    small:  { label: 'Small',  size: 520  },
    medium: { label: 'Medium', size: 800  },
    large:  { label: 'Large',  size: 1200 },
    huge:   { label: 'Huge',   size: 1600 }
  };
  const FIELD_SIZE_KEYS = Object.keys(FIELD_SIZES);

  const STORAGE_KEY = 'sz-asteroids-high-scores';
  const FIELD_STORAGE_KEY = 'sz-asteroids-field-size';
  const MAX_HIGH_SCORES = 5;
  const SHIP_SIZE = 12;
  const SHIP_ROTATION_SPEED = 0.07;
  const SHIP_THRUST = 0.12;
  const SHIP_FRICTION = 0.99;
  const BULLET_SPEED = 8;
  const BULLET_LIFETIME = 55;
  const INVULN_DURATION = 2000;
  const HYPERSPACE_COOLDOWN = 500;
  const UFO_SPEED = 2;
  const BASE_STAR_COUNT = 120;
  const SHOOT_COOLDOWN = 180;
  const SHOOT_COOLDOWN_RAPID = 70;
  const MAX_BULLETS_NORMAL = 4;
  const MAX_BULLETS_RAPID = 8;
  const COMBO_TIMEOUT = 1500;
  const POWERUP_LIFETIME = 10000;
  const POWERUP_COLLECT_RADIUS = 18;
  const WARP_DURATION = 1800;

  const ASTEROID_SIZES = {
    large:  { radius: 40, points: 20,  speed: 1.2, dropRate: 0.05, craters: [3, 5] },
    medium: { radius: 20, points: 50,  speed: 2,   dropRate: 0.12, craters: [2, 3] },
    small:  { radius: 10, points: 100, speed: 3,   dropRate: 0.18, craters: [1, 2] }
  };

  /* ---- Mode Configurations ---- */
  const MODE_CONFIGS = {
    classic: {
      lives: 3, label: 'Classic', asteroidSpeedMult: 1, ufoInterval: 15000,
      ufoShootInterval: 2000, extraAsteroids: 0, scoreMult: 1, bonusLifeEvery: 10000,
      description: '3 lives \u00b7 progressive levels'
    },
    survival: {
      lives: 1, label: 'Survival', asteroidSpeedMult: 1, ufoInterval: 12000,
      ufoShootInterval: 1800, extraAsteroids: 0, scoreMult: 1, spawnInterval: 8000,
      description: '1 life \u00b7 endless waves'
    },
    zen: {
      lives: Infinity, label: 'Zen', asteroidSpeedMult: 0.85, ufoInterval: 20000,
      ufoShootInterval: 2500, extraAsteroids: 0, scoreMult: 1, timeLimit: 180000,
      description: 'Infinite lives \u00b7 3-min timer'
    },
    hardcore: {
      lives: 1, label: 'Hardcore', asteroidSpeedMult: 1.5, ufoInterval: 8000,
      ufoShootInterval: 1400, extraAsteroids: 2, scoreMult: 2, bonusLifeEvery: 0,
      description: '1 life \u00b7 1.5\u00d7 speed \u00b7 2\u00d7 score'
    }
  };

  /* ---- Rock Types ---- */
  const ROCK_TYPES = {
    normal:    { hp: 1, pointsMult: 1,   minLevel: 1,  glow: null },
    iron:      { hp: 2, pointsMult: 1.5, minLevel: 3,  glow: '#aaaacc' },
    crystal:   { hp: 3, pointsMult: 2,   minLevel: 6,  glow: '#44aaff' },
    exploding: { hp: 2, pointsMult: 1.5, minLevel: 9,  glow: '#ff6600' },
    ice:       { hp: 2, pointsMult: 1.5, minLevel: 12, glow: '#88ddff' },
    lava:      { hp: 3, pointsMult: 2,   minLevel: 15, glow: '#ff4400' },
    electric:  { hp: 2, pointsMult: 2,   minLevel: 18, glow: '#ffff66' }
  };

  const ROCK_TYPE_PALETTES = {
    normal: [
      { light: '#9b8365', dark: '#4a3a25', edge: '#b09575' },
      { light: '#8b6050', dark: '#4a2a20', edge: '#a07060' },
      { light: '#8a8a70', dark: '#454530', edge: '#a0a085' }
    ],
    iron: [
      { light: '#8888a0', dark: '#444460', edge: '#aaaacc' },
      { light: '#909098', dark: '#505058', edge: '#b0b0b8' },
      { light: '#787890', dark: '#3a3a50', edge: '#9898b0' }
    ],
    crystal: [
      { light: '#708899', dark: '#354455', edge: '#88bbdd' },
      { light: '#6090a0', dark: '#304050', edge: '#70aabb' },
      { light: '#8060a0', dark: '#402060', edge: '#a080cc' }
    ],
    exploding: [
      { light: '#cc5522', dark: '#661100', edge: '#ff7733' },
      { light: '#bb4411', dark: '#551100', edge: '#ee6622' },
      { light: '#dd6633', dark: '#772200', edge: '#ff8844' }
    ],
    ice: [
      { light: '#aaddee', dark: '#556688', edge: '#cceeFF' },
      { light: '#99ccdd', dark: '#445577', edge: '#bbddee' },
      { light: '#bbddff', dark: '#667799', edge: '#ddeeff' }
    ],
    lava: [
      { light: '#554433', dark: '#221100', edge: '#776655' },
      { light: '#443322', dark: '#110800', edge: '#665544' },
      { light: '#665544', dark: '#332211', edge: '#887766' }
    ],
    electric: [
      { light: '#cccc88', dark: '#666644', edge: '#eeeeaa' },
      { light: '#bbbb77', dark: '#555533', edge: '#dddd99' },
      { light: '#ddddaa', dark: '#777755', edge: '#ffffcc' }
    ]
  };

  /* ---- Enemy Types ---- */
  const ENEMY_TYPES = {
    ufo:       { radius: 18, points: 200,  hp: 1, minLevel: 1,  color: '#00ff88' },
    ufoSmall:  { radius: 10, points: 1000, hp: 1, minLevel: 1,  color: '#00ff88' },
    drone:     { radius: 8,  points: 150,  hp: 1, minLevel: 5,  color: '#ff4444' },
    gunship:   { radius: 16, points: 500,  hp: 3, minLevel: 8,  color: '#88ff44' },
    minelayer: { radius: 14, points: 300,  hp: 2, minLevel: 11, color: '#ffcc00' },
    stealth:   { radius: 12, points: 800,  hp: 2, minLevel: 14, color: '#aa44ff' },
    boss:      { radius: 28, points: 2000, hp: 8, minLevel: 10, color: '#ff44ff' }
  };

  const EXPLOSION_RADIUS = 120;
  const ICE_ZONE_RADIUS = 80;
  const ICE_ZONE_DURATION = 5000;
  const FIRE_PATCH_RADIUS = 25;
  const FIRE_PATCH_DURATION = 3000;
  const LAVA_TRAIL_INTERVAL = 500;
  const EMP_DURATION = 3000;
  const MINE_RADIUS = 30;
  const MINE_DURATION = 15000;
  const MAX_ENEMIES = 3;
  const MAX_ALLIES = 2;
  const ALLY_SHOOT_INTERVAL = 800;
  const ALLY_FOLLOW_DIST = 100;
  const FIRE_DAMAGE_COOLDOWN = 500;

  /* ---- Powerup Definitions ---- */
  const POWERUP_TYPES = {
    shield:    { icon: 'S', color: '#44aaff', label: 'Shield',       duration: 15000, weight: 22 },
    triple:    { icon: 'T', color: '#ff8844', label: 'Triple Shot',   duration: 12000, weight: 16 },
    rapid:     { icon: 'R', color: '#ff4444', label: 'Rapid Fire',    duration: 12000, weight: 16 },
    piercing:  { icon: 'P', color: '#aa44ff', label: 'Piercing',      duration: 10000, weight: 12 },
    spread:    { icon: 'W', color: '#44ffaa', label: 'Spread Shot',   duration: 10000, weight: 10 },
    homing:    { icon: 'H', color: '#00ffff', label: 'Homing',        duration: 10000, weight: 5  },
    extraLife: { icon: '+', color: '#44ff44', label: 'Extra Life',     duration: 0,     weight: 10 },
    nuke:      { icon: 'N', color: '#ffff44', label: 'Nuke',          duration: 0,     weight: 9  }
  };

  const DURATION_POWERUPS = ['shield', 'triple', 'rapid', 'piercing', 'spread', 'homing'];

  const POWERUP_POOL = [];
  for (const [key, def] of Object.entries(POWERUP_TYPES))
    for (let i = 0; i < def.weight; ++i)
      POWERUP_POOL.push(key);

  /* ---- Star Colors ---- */
  const STAR_COLORS = ['#fff', '#fff', '#fff', '#aaccff', '#ffddaa', '#fff', '#ffcccc', '#ccddff'];

  /* ============================== CANVAS SETUP ============================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let W, H, uiS;
  let fieldSizeKey = 'small';
  let bgCanvas;
  const stars = [];
  let resizeCanvasFn = null;

  try {
    const saved = localStorage.getItem(FIELD_STORAGE_KEY);
    if (saved && FIELD_SIZES[saved]) fieldSizeKey = saved;
  } catch (_) {}

  function setupField() {
    const size = FIELD_SIZES[fieldSizeKey].size;
    W = size;
    H = size;
    uiS = W / 520;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!document.body.classList.contains('flex-layout')) {
      const cssSize = Math.min(W, 520);
      canvas.style.width = cssSize + 'px';
      canvas.style.height = cssSize + 'px';
    } else if (resizeCanvasFn)
      resizeCanvasFn();

    bgCanvas = generateBackground();
    initStars();
  }

  function setupCanvasScaling() {
    const frame = document.querySelector('.game-frame');
    if (!frame) return;

    resizeCanvasFn = () => {
      if (!document.body.classList.contains('flex-layout')) return;
      const availW = frame.clientWidth - 10;
      const availH = frame.clientHeight - 10;
      const size = Math.max(50, Math.floor(Math.min(availW, availH)));
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    };

    new ResizeObserver(resizeCanvasFn).observe(frame);
  }

  /* ============================== EFFECTS ============================== */

  const { ParticleSystem, ScreenShake, FloatingText } = SZ.GameEffects;
  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const floatingText = new FloatingText();

  let shockwaves = [];
  let screenFlashAlpha = 0;

  /* ============================== BACKGROUND ============================== */

  function generateBackground() {
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    const bgCtx = bg.getContext('2d');

    const grad = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
    grad.addColorStop(0, '#0d0d1a');
    grad.addColorStop(1, '#050510');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, W, H);

    const cloudCount = Math.round(6 * (W / 520));
    for (let i = 0; i < cloudCount; ++i) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = (80 + Math.random() * 60) * uiS;
      const c = [
        Math.floor(10 + Math.random() * 40),
        Math.floor(10 + Math.random() * 25),
        Math.floor(30 + Math.random() * 35)
      ];
      const cg = bgCtx.createRadialGradient(x, y, 0, x, y, r);
      cg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.35)`);
      cg.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.12)`);
      cg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      bgCtx.fillStyle = cg;
      bgCtx.fillRect(0, 0, W, H);
    }

    return bg;
  }

  function initStars() {
    stars.length = 0;
    const count = Math.round(BASE_STAR_COUNT * (W * H) / (520 * 520));
    for (let i = 0; i < count; ++i) {
      const driftAngle = Math.random() * Math.PI * 2;
      const driftSpeed = 0.01 + Math.random() * 0.04;
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        baseBrightness: 0.2 + Math.random() * 0.8,
        size: 0.4 + Math.random() * 1.6,
        twinkleSpeed: 0.5 + Math.random() * 3,
        twinklePhase: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        driftVx: Math.cos(driftAngle) * driftSpeed,
        driftVy: Math.sin(driftAngle) * driftSpeed
      });
    }
  }

  /* ============================== STATUS BAR DOM ============================== */

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');
  const statusLevelLabel = document.getElementById('statusLevelLabel');
  const statusMode = document.getElementById('statusMode');

  /* ============================== GAME STATE ============================== */

  let ship, asteroids, bullets;
  let enemies, enemyBullets, enemySpawnTimer;
  let allies, allyBullets;
  let zones;
  let score, lives, level;
  let gameActive, gamePaused, gameOverFlag;
  let invulnTimer, hyperspaceCooldown;
  let animFrameId, lastTime;
  let gameMode, modeSelectActive;
  let collectiblePowerups, powerupState;
  let combo, stats, warpState;
  let zenTimer, survivalSpawnTimer;
  let nextExtraLife, gameTime, shootCooldownTimer;
  let empActive, empTimer;
  let fireDamageCooldown;
  let bossActive;
  let allySpawnedForLevel;

  const keys = {};

  /* ============================== UTILITY ============================== */

  function wrap(obj) {
    if (obj.x < 0) obj.x += W;
    if (obj.x > W) obj.x -= W;
    if (obj.y < 0) obj.y += H;
    if (obj.y > H) obj.y -= H;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distWrapped(a, b) {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    if (dx > W / 2) dx = W - dx;
    if (dy > H / 2) dy = H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function randomAngle() { return Math.random() * Math.PI * 2; }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function randomPowerupType() {
    return POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)];
  }

  function modeConfig() { return MODE_CONFIGS[gameMode] || MODE_CONFIGS.classic; }

  function scaledFont(size, weight) {
    return (weight || 'bold') + ' ' + Math.round(size * uiS) + 'px sans-serif';
  }

  function getEffectiveLevel() {
    if (gameMode === 'survival')
      return Math.floor((gameTime || 0) / 30000) + 1;
    return level;
  }

  /* ============================== ASTEROID SHAPE ============================== */

  function generateAsteroidShape(vertexCount) {
    const shape = [];
    for (let i = 0; i < vertexCount; ++i) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const jitter = 0.6 + Math.random() * 0.4;
      shape.push({ angle, jitter });
    }
    return shape;
  }

  function generateCraters(radius, count) {
    const craters = [];
    for (let i = 0; i < count; ++i) {
      const d = Math.random() * radius * 0.55;
      const a = randomAngle();
      craters.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        r: radius * (0.07 + Math.random() * 0.1)
      });
    }
    return craters;
  }

  function generateCrackPattern(radius) {
    const cracks = [];
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; ++i) {
      const startAngle = randomAngle();
      const points = [{ r: 0, a: startAngle }];
      let r = radius * 0.1;
      let a = startAngle;
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < segments; ++j) {
        r += radius * (0.12 + Math.random() * 0.2);
        a += (Math.random() - 0.5) * 0.8;
        points.push({ r: Math.min(r, radius * 0.85), a });
      }
      cracks.push(points);
    }
    return cracks;
  }

  /* ============================== ENTITY CREATION ============================== */

  function createShip() {
    return {
      x: W / 2, y: H / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      thrusting: false
    };
  }

  function getAsteroidTypeForLevel() {
    const lvl = getEffectiveLevel();
    const weights = { normal: 10, iron: 0, crystal: 0, exploding: 0, ice: 0, lava: 0, electric: 0 };
    if (lvl >= 3) weights.iron = Math.min(lvl - 2, 8);
    if (lvl >= 6) weights.crystal = Math.min(lvl - 5, 6);
    if (lvl >= 9) weights.exploding = Math.min(lvl - 8, 5);
    if (lvl >= 12) weights.ice = Math.min(lvl - 11, 5);
    if (lvl >= 15) weights.lava = Math.min(lvl - 14, 4);
    if (lvl >= 18) weights.electric = Math.min(lvl - 17, 4);
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const type in weights) {
      r -= weights[type];
      if (r <= 0) return type;
    }
    return 'normal';
  }

  function createAsteroid(x, y, size, forceRockType) {
    const info = ASTEROID_SIZES[size];
    const angle = randomAngle();
    const cfg = modeConfig();
    const levelSpeedMult = 1 + (level - 1) * 0.05;
    const speed = (0.5 + Math.random() * 0.5) * info.speed * cfg.asteroidSpeedMult * levelSpeedMult;

    const rockType = forceRockType || getAsteroidTypeForLevel();
    const rt = ROCK_TYPES[rockType];
    const palettes = ROCK_TYPE_PALETTES[rockType];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];

    const [minC, maxC] = info.craters;
    const craterCount = minC + Math.floor(Math.random() * (maxC - minC + 1));

    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: info.radius,
      size,
      points: Math.round(info.points * rt.pointsMult),
      shape: generateAsteroidShape(8 + Math.floor(Math.random() * 5)),
      craters: generateCraters(info.radius, craterCount),
      palette,
      rotation: randomAngle(),
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      rockType,
      hp: rt.hp,
      maxHp: rt.hp,
      hitFlash: 0,
      damageCracks: [],
      lavaTrailTimer: rockType === 'lava' ? LAVA_TRAIL_INTERVAL : 0,
      sparkleTimer: rockType === 'ice' ? Math.random() * 300 : 0
    };
  }

  function spawnAsteroidAwayFromShip(size) {
    let x, y;
    const minDist = Math.max(120, W * 0.15);
    do {
      x = Math.random() * W;
      y = Math.random() * H;
    } while (ship && dist({ x, y }, ship) < minDist);
    return createAsteroid(x, y, size || 'large');
  }

  function createBullet(x, y, angle) {
    return {
      x, y,
      vx: Math.cos(angle) * BULLET_SPEED + (ship ? ship.vx * 0.3 : 0),
      vy: Math.sin(angle) * BULLET_SPEED + (ship ? ship.vy * 0.3 : 0),
      life: BULLET_LIFETIME
    };
  }

  function createEnemy(type) {
    const goingRight = Math.random() < 0.5;
    const y = Math.random() * H;
    const base = {
      type,
      x: goingRight ? -20 : W + 20,
      y,
      vx: goingRight ? UFO_SPEED : -UFO_SPEED,
      vy: (Math.random() - 0.5) * 1.5,
      hp: ENEMY_TYPES[type].hp,
      maxHp: ENEMY_TYPES[type].hp,
      radius: ENEMY_TYPES[type].radius,
      points: ENEMY_TYPES[type].points,
      shootTimer: modeConfig().ufoShootInterval,
      pulsePhase: 0,
      lightPhase: 0,
      hitFlash: 0
    };

    switch (type) {
      case 'ufo':
        base.large = true;
        break;
      case 'ufoSmall':
        base.large = false;
        break;
      case 'drone':
        base.vx = 0;
        base.vy = 0;
        base.x = goingRight ? -20 : W + 20;
        break;
      case 'gunship':
        base.vx *= 0.6;
        base.burstCount = 0;
        base.burstTimer = 0;
        base.strafeDir = Math.random() < 0.5 ? 1 : -1;
        break;
      case 'minelayer':
        base.mineTimer = 3000;
        base.weavePhase = Math.random() * Math.PI * 2;
        break;
      case 'stealth':
        base.cloakTimer = 2000;
        base.visible = true;
        base.cloakCycle = 2000;
        break;
      case 'boss': {
        const lvl = getEffectiveLevel();
        base.hp = 8 + Math.floor((lvl - 10) / 5) * 4;
        base.maxHp = base.hp;
        base.x = W / 2;
        base.y = -40;
        base.vx = 0;
        base.vy = 1.5;
        base.attackPattern = 0;
        base.attackTimer = 2000;
        base.shieldFlash = 0;
        base.entered = false;
        break;
      }
    }
    return base;
  }

  function createAlly() {
    const side = Math.random() < 0.5;
    return {
      x: side ? -20 : W + 20,
      y: H / 2 + (Math.random() - 0.5) * 100,
      vx: side ? 2 : -2,
      vy: 0,
      angle: side ? 0 : Math.PI,
      hp: 3,
      maxHp: 3,
      shootTimer: ALLY_SHOOT_INTERVAL,
      target: null,
      entered: false
    };
  }

  function createCollectiblePowerup(x, y) {
    const type = randomPowerupType();
    const def = POWERUP_TYPES[type];
    const angle = randomAngle();
    return {
      x, y,
      vx: Math.cos(angle) * 0.5,
      vy: Math.sin(angle) * 0.5,
      type, icon: def.icon, color: def.color, label: def.label,
      phase: 0,
      lifetime: POWERUP_LIFETIME
    };
  }

  /* ============================== ZONE EFFECTS SYSTEM ============================== */

  function createZone(type, x, y, opts = {}) {
    return {
      type,
      x, y,
      radius: opts.radius ?? 50,
      timer: opts.duration ?? 5000,
      duration: opts.duration ?? 5000,
      damage: opts.damage ?? 0
    };
  }

  function updateZones(dt) {
    for (let i = zones.length - 1; i >= 0; --i) {
      const z = zones[i];
      z.timer -= dt;
      if (z.timer <= 0) {
        zones.splice(i, 1);
        continue;
      }

      if (z.type === 'ice') {
        for (const a of asteroids) {
          if (distWrapped(a, z) < z.radius) {
            a.vx *= 0.98;
            a.vy *= 0.98;
          }
        }
        for (const e of enemies)
          if (distWrapped(e, z) < z.radius) {
            e.vx *= 0.98;
            e.vy *= 0.98;
          }
        if (ship && distWrapped(ship, z) < z.radius) {
          ship.vx *= 0.98;
          ship.vy *= 0.98;
        }
      }

      if (z.type === 'fire' && ship && invulnTimer <= 0 && fireDamageCooldown <= 0) {
        if (distWrapped(ship, z) < z.radius) {
          fireDamageCooldown = FIRE_DAMAGE_COOLDOWN;
          destroyShip();
        }
      }

      if (z.type === 'mine') {
        if (ship && invulnTimer <= 0 && distWrapped(ship, z) < z.radius) {
          detonateMine(z, i);
          continue;
        }
        for (let bi = bullets.length - 1; bi >= 0; --bi) {
          if (distWrapped(bullets[bi], z) < z.radius) {
            bullets.splice(bi, 1);
            detonateMine(z, i);
            break;
          }
        }
      }
    }
  }

  function detonateMine(mine, index) {
    zones.splice(index, 1);
    particles.burst(mine.x, mine.y, 20, { speed: 4, color: '#ffcc00', size: 3, life: 0.6, decay: 0.02 });
    addShockwave(mine.x, mine.y, { maxRadius: 60, speed: 4, color: '#ffcc00' });
    shake.trigger(5, 200);
    if (ship && invulnTimer <= 0 && distWrapped(ship, mine) < 60) {
      fireDamageCooldown = FIRE_DAMAGE_COOLDOWN;
      destroyShip();
    }
  }

  function drawZones() {
    const time = performance.now() / 1000;
    for (const z of zones) {
      const life = z.timer / z.duration;
      ctx.save();
      ctx.translate(z.x, z.y);

      if (z.type === 'ice') {
        ctx.globalAlpha = 0.15 * life;
        ctx.fillStyle = '#88ddff';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3 * life;
        ctx.strokeStyle = '#aaeeff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 0; i < 3; ++i) {
          const a = time * 0.5 + i * Math.PI * 2 / 3;
          const r = z.radius * (0.3 + Math.random() * 0.5);
          ctx.fillStyle = `rgba(200,240,255,${0.5 * life})`;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (z.type === 'fire') {
        const flicker = 0.7 + Math.sin(time * 8 + z.x) * 0.3;
        ctx.globalAlpha = 0.2 * life * flicker;
        const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, z.radius);
        fg.addColorStop(0, '#ff6600');
        fg.addColorStop(0.6, '#ff330066');
        fg.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4 * life;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (z.type === 'mine') {
        const pulse = 0.6 + Math.sin(time * 6) * 0.4;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#332200';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,0,0,${pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#ff6600';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  /* ============================== POWERUP SYSTEM ============================== */

  function initPowerupState() {
    const state = {};
    for (const key of DURATION_POWERUPS)
      state[key] = { active: false, timer: 0 };
    return state;
  }

  function activatePowerup(type) {
    const def = POWERUP_TYPES[type];
    ++stats.powerupsCollected;

    if (type === 'extraLife') {
      if (lives !== Infinity) {
        ++lives;
        updateDisplays();
      }
      floatingText.add(ship.x, ship.y - 20, '+1 LIFE', { color: '#44ff44', decay: 0.015, font: scaledFont(16) });
      particles.sparkle(ship.x, ship.y, 15, { color: '#44ff44' });
      return;
    }

    if (type === 'nuke') {
      triggerNuke();
      return;
    }

    if (powerupState[type]) {
      powerupState[type].active = true;
      powerupState[type].timer = def.duration;
    }
    floatingText.add(ship.x, ship.y - 20, def.label.toUpperCase(), { color: def.color, decay: 0.02, font: scaledFont(14) });
  }

  function triggerNuke() {
    const cfg = modeConfig();
    let scoreGained = 0;
    for (const a of asteroids) {
      scoreGained += a.points;
      particles.burst(a.x, a.y, 8, { speed: 3, color: '#ffff44', size: 2, life: 0.5, decay: 0.03 });
      addShockwave(a.x, a.y, { maxRadius: a.radius * 1.5, speed: 3, color: '#ffff44' });
    }
    asteroids = [];
    for (const e of enemies) {
      if (e.type === 'boss') continue;
      scoreGained += e.points;
      particles.burst(e.x, e.y, 8, { speed: 3, color: '#ffff44', size: 2, life: 0.5, decay: 0.03 });
      addShockwave(e.x, e.y, { maxRadius: 40, speed: 3, color: '#ffff44' });
    }
    enemies = enemies.filter(e => e.type === 'boss');
    zones = [];
    score += Math.round(scoreGained * getComboMultiplier() * cfg.scoreMult);
    triggerScreenFlash(0.6);
    shake.trigger(10, 500);
    floatingText.add(W / 2, H / 2, 'NUKE! +' + scoreGained, { color: '#ffff44', decay: 0.012, font: scaledFont(20) });
    updateDisplays();
  }

  function updatePowerupTimers(dt) {
    for (const key of DURATION_POWERUPS)
      if (powerupState[key].active) {
        powerupState[key].timer -= dt;
        if (powerupState[key].timer <= 0) {
          powerupState[key].active = false;
          powerupState[key].timer = 0;
        }
      }
  }

  function trySpawnPowerup(x, y, dropRate) {
    if (Math.random() < dropRate)
      collectiblePowerups.push(createCollectiblePowerup(x, y));
  }

  /* ============================== COMBO SYSTEM ============================== */

  function getComboMultiplier() {
    return combo.count < 2 ? 1 : Math.min(combo.count, 8);
  }

  function addKill() {
    ++combo.count;
    combo.timer = COMBO_TIMEOUT;
    combo.displayScale = 1;
    if (combo.count > stats.maxCombo)
      stats.maxCombo = combo.count;
  }

  function updateCombo(dt) {
    if (combo.count > 0) {
      combo.timer -= dt;
      if (combo.timer <= 0)
        combo.count = 0;
    }
    if (combo.displayScale > 0)
      combo.displayScale = Math.max(0, combo.displayScale - 0.04);
  }

  /* ============================== SHOCKWAVE SYSTEM ============================== */

  function addShockwave(x, y, opts = {}) {
    shockwaves.push({
      x, y,
      radius: opts.radius ?? 5,
      maxRadius: opts.maxRadius ?? 60,
      speed: opts.speed ?? 3,
      life: 1,
      color: opts.color ?? '#fff',
      lineWidth: opts.lineWidth ?? 2
    });
  }

  function updateShockwaves() {
    for (let i = shockwaves.length - 1; i >= 0; --i) {
      const s = shockwaves[i];
      s.radius += s.speed;
      s.life = 1 - s.radius / s.maxRadius;
      if (s.life <= 0)
        shockwaves.splice(i, 1);
    }
  }

  /* ============================== SCREEN FLASH ============================== */

  function triggerScreenFlash(alpha) {
    screenFlashAlpha = alpha ?? 0.3;
  }

  /* ============================== WARP SYSTEM ============================== */

  function startWarp() {
    warpState = { timer: WARP_DURATION, duration: WARP_DURATION };
    invulnTimer = WARP_DURATION + 1000;
    bullets = [];
    enemyBullets = [];
    allyBullets = [];
    collectiblePowerups = [];
    enemies = [];
    zones = [];
    bossActive = false;
  }

  function endWarp() {
    warpState = null;
    triggerScreenFlash(0.25);
    shake.trigger(5, 300);
    for (const s of stars) {
      s.x = Math.random() * W;
      s.y = Math.random() * H;
    }

    /* Spawn ally every 5 levels starting at 5 */
    if (level >= 5 && level % 5 === 0 && allies.length < MAX_ALLIES && !allySpawnedForLevel) {
      allySpawnedForLevel = true;
      const a = createAlly();
      allies.push(a);
      floatingText.add(W / 2, H / 2 + 40, 'ALLY INCOMING!', { color: '#44ffaa', decay: 0.012, font: scaledFont(18) });
    }

    /* Boss every 5 levels starting at 10 */
    if (level >= 10 && level % 5 === 0) {
      bossActive = true;
      const boss = createEnemy('boss');
      enemies.push(boss);
      floatingText.add(W / 2, H / 2 - 40, 'BOSS FIGHT!', { color: '#ff44ff', decay: 0.01, font: scaledFont(22) });
    } else
      spawnLevelAsteroids();
  }

  function updateWarpStars() {
    if (!warpState) return;
    const progress = 1 - warpState.timer / warpState.duration;
    const intensity = Math.sin(progress * Math.PI);
    const speed = intensity * 8;
    const cx = W / 2, cy = H / 2;

    for (const s of stars) {
      const dx = s.x - cx, dy = s.y - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      s.x += (dx / len) * speed;
      s.y += (dy / len) * speed;

      if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) {
        const a = randomAngle();
        const r = 10 + Math.random() * 50;
        s.x = cx + Math.cos(a) * r;
        s.y = cy + Math.sin(a) * r;
      }
    }
  }

  /* ============================== LEVEL MANAGEMENT ============================== */

  function spawnLevelAsteroids() {
    const cfg = modeConfig();
    asteroids = [];
    const fieldScale = Math.sqrt(W * H / (520 * 520));

    if (level === 1) {
      let x, y;
      const minDist = Math.max(120, W * 0.2);
      do {
        x = Math.random() * W;
        y = Math.random() * H;
      } while (ship && dist({ x, y }, ship) < minDist);
      asteroids.push(createAsteroid(x, y, 'medium', 'normal'));
      return;
    }

    const baseCount = Math.min(1 + level, 12) + cfg.extraAsteroids;
    const count = Math.max(2, Math.round(baseCount * fieldScale));

    for (let i = 0; i < count; ++i)
      asteroids.push(spawnAsteroidAwayFromShip());
  }

  /* ============================== SHOOTING ============================== */

  function shoot() {
    if (!ship) return;
    const emp = empActive;
    const maxBullets = (!emp && powerupState.rapid.active) ? MAX_BULLETS_RAPID : MAX_BULLETS_NORMAL;
    if (bullets.length >= maxBullets) return;

    ++stats.shotsFired;
    const tipX = ship.x + Math.cos(ship.angle) * SHIP_SIZE;
    const tipY = ship.y + Math.sin(ship.angle) * SHIP_SIZE;

    if (!emp && powerupState.spread.active) {
      const count = 5;
      const arc = 0.5;
      for (let i = 0; i < count; ++i) {
        const a = ship.angle + (i - (count - 1) / 2) * (arc / (count - 1));
        bullets.push(createBullet(tipX, tipY, a));
      }
      stats.shotsFired += count - 1;
    } else if (!emp && powerupState.triple.active) {
      bullets.push(createBullet(tipX, tipY, ship.angle));
      bullets.push(createBullet(tipX, tipY, ship.angle - 0.15));
      bullets.push(createBullet(tipX, tipY, ship.angle + 0.15));
      stats.shotsFired += 2;
    } else
      bullets.push(createBullet(tipX, tipY, ship.angle));
  }

  function enemyShoot(enemy) {
    if (!ship) return;
    let angle;
    if (enemy.type === 'ufo')
      angle = randomAngle();
    else {
      angle = Math.atan2(ship.y - enemy.y, ship.x - enemy.x);
      angle += (Math.random() - 0.5) * 0.3;
    }

    if (enemy.type === 'gunship') {
      for (let i = 0; i < 3; ++i)
        enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle + (i - 1) * 0.12) * BULLET_SPEED * 0.65,
          vy: Math.sin(angle + (i - 1) * 0.12) * BULLET_SPEED * 0.65,
          life: BULLET_LIFETIME
        });
    } else if (enemy.type === 'boss') {
      if (enemy.attackPattern === 0) {
        for (let i = 0; i < 3; ++i)
          enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(angle + (i - 1) * 0.15) * BULLET_SPEED * 0.6,
            vy: Math.sin(angle + (i - 1) * 0.15) * BULLET_SPEED * 0.6,
            life: BULLET_LIFETIME
          });
      } else if (enemy.attackPattern === 1) {
        for (let i = 0; i < 8; ++i) {
          const a = (i / 8) * Math.PI * 2;
          enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * BULLET_SPEED * 0.5,
            vy: Math.sin(a) * BULLET_SPEED * 0.5,
            life: BULLET_LIFETIME
          });
        }
      } else {
        const lvl = getEffectiveLevel();
        if (enemies.filter(e => e.type === 'drone').length < 3) {
          const d = createEnemy('drone');
          d.x = enemy.x + (Math.random() - 0.5) * 30;
          d.y = enemy.y + 20;
          enemies.push(d);
        }
      }
    } else
      enemyBullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * BULLET_SPEED * 0.7,
        vy: Math.sin(angle) * BULLET_SPEED * 0.7,
        life: BULLET_LIFETIME
      });
  }

  /* ============================== HYPERSPACE ============================== */

  function hyperspace() {
    if (!ship || hyperspaceCooldown > 0) return;

    particles.burst(ship.x, ship.y, 12, { speed: 3, color: '#88aaff', size: 2, life: 0.4, decay: 0.04 });
    addShockwave(ship.x, ship.y, { maxRadius: 30, speed: 4, color: '#88aaff' });

    ship.x = Math.random() * W;
    ship.y = Math.random() * H;
    ship.vx = 0;
    ship.vy = 0;
    hyperspaceCooldown = HYPERSPACE_COOLDOWN;

    particles.burst(ship.x, ship.y, 12, { speed: 3, color: '#88aaff', size: 2, life: 0.4, decay: 0.04 });
  }

  /* ============================== DESTRUCTION ============================== */

  function damageAsteroid(asteroid, index) {
    --asteroid.hp;
    asteroid.hitFlash = 150;

    if (asteroid.hp > 0) {
      if (asteroid.damageCracks.length === 0)
        asteroid.damageCracks = generateCrackPattern(asteroid.radius);
      else
        asteroid.damageCracks.push(...generateCrackPattern(asteroid.radius).slice(0, 2));

      particles.burst(asteroid.x, asteroid.y, 4, {
        speed: 2, color: asteroid.palette.edge, size: 2, life: 0.3, decay: 0.05
      });
      return;
    }

    destroyAsteroid(asteroid, index);
  }

  function destroyAsteroid(asteroid, index) {
    asteroids.splice(index, 1);
    ++stats.asteroidsDestroyed;
    addKill();

    const p = asteroid.palette;
    particles.burst(asteroid.x, asteroid.y, 14, {
      speed: 3.5, color: p.light, size: 3, life: 0.7,
      decay: 0.02, shape: 'square', rotationSpeed: (Math.random() - 0.5) * 0.3
    });
    particles.burst(asteroid.x, asteroid.y, 6, {
      speed: 2, color: p.edge, size: 2, life: 0.5, decay: 0.03
    });
    addShockwave(asteroid.x, asteroid.y, {
      maxRadius: asteroid.radius * 1.8, speed: 2.5, color: p.edge, lineWidth: 1.5
    });

    if (asteroid.size === 'large')
      triggerScreenFlash(0.08);

    /* Rock-type-specific death effects */
    if (asteroid.rockType === 'exploding') {
      addShockwave(asteroid.x, asteroid.y, { maxRadius: EXPLOSION_RADIUS, speed: 5, color: '#ff6600', lineWidth: 3 });
      particles.burst(asteroid.x, asteroid.y, 30, { speed: 6, color: '#ff8800', size: 4, life: 0.8, decay: 0.015 });
      particles.burst(asteroid.x, asteroid.y, 15, { speed: 3, color: '#ffcc00', size: 3, life: 0.6, decay: 0.025 });
      triggerScreenFlash(0.25);
      shake.trigger(8, 400);
      for (let ai = asteroids.length - 1; ai >= 0; --ai) {
        if (distWrapped(asteroids[ai], asteroid) < EXPLOSION_RADIUS)
          damageAsteroid(asteroids[ai], ai);
      }
      if (ship && invulnTimer <= 0 && distWrapped(ship, asteroid) < EXPLOSION_RADIUS)
        destroyShip();
      for (let ei = enemies.length - 1; ei >= 0; --ei) {
        if (distWrapped(enemies[ei], asteroid) < EXPLOSION_RADIUS)
          damageEnemy(enemies[ei], ei, 1);
      }
    }

    if (asteroid.rockType === 'ice')
      zones.push(createZone('ice', asteroid.x, asteroid.y, { radius: ICE_ZONE_RADIUS, duration: ICE_ZONE_DURATION }));

    if (asteroid.rockType === 'lava') {
      const patchCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < patchCount; ++i) {
        const ox = asteroid.x + (Math.random() - 0.5) * 60;
        const oy = asteroid.y + (Math.random() - 0.5) * 60;
        zones.push(createZone('fire', ox, oy, { radius: FIRE_PATCH_RADIUS, duration: FIRE_PATCH_DURATION }));
      }
      particles.burst(asteroid.x, asteroid.y, 20, { speed: 4, color: '#ff4400', size: 3, life: 0.6, decay: 0.02 });
    }

    if (asteroid.rockType === 'electric') {
      empActive = true;
      empTimer = EMP_DURATION;
      addShockwave(asteroid.x, asteroid.y, { maxRadius: 150, speed: 6, color: '#88ccff', lineWidth: 2 });
      particles.burst(asteroid.x, asteroid.y, 25, { speed: 5, color: '#aaddff', size: 2, life: 0.5, decay: 0.03 });
      floatingText.add(asteroid.x, asteroid.y - 30, 'EMP!', { color: '#88ccff', decay: 0.015, font: scaledFont(16) });
      triggerScreenFlash(0.15);
    }

    const mult = getComboMultiplier() * modeConfig().scoreMult;
    const pts = Math.round(asteroid.points * mult);
    score += pts;

    const comboText = mult > 1 ? ' x' + mult : '';
    floatingText.add(asteroid.x, asteroid.y, '+' + pts + comboText, {
      color: mult > 1 ? '#ffd700' : '#ff0',
      decay: 0.02,
      font: scaledFont(mult >= 4 ? 16 : 14)
    });

    updateDisplays();
    checkBonusLife();
    trySpawnPowerup(asteroid.x, asteroid.y, ASTEROID_SIZES[asteroid.size].dropRate);

    if (asteroid.size === 'large') {
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, 'medium', asteroid.rockType));
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, 'medium', asteroid.rockType));
    } else if (asteroid.size === 'medium') {
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, 'small', asteroid.rockType));
      asteroids.push(createAsteroid(asteroid.x, asteroid.y, 'small', asteroid.rockType));
    }
  }

  function destroyShip() {
    if (!ship) return;

    if (powerupState.shield.active && !empActive) {
      powerupState.shield.active = false;
      powerupState.shield.timer = 0;
      particles.burst(ship.x, ship.y, 20, { speed: 4, color: '#44aaff', size: 2, life: 0.5, decay: 0.03 });
      addShockwave(ship.x, ship.y, { maxRadius: 40, speed: 3, color: '#44aaff' });
      invulnTimer = 500;
      floatingText.add(ship.x, ship.y - 20, 'SHIELD!', { color: '#44aaff', decay: 0.02, font: scaledFont(14) });
      return;
    }

    particles.burst(ship.x, ship.y, 35, { speed: 5, color: '#fff', size: 3, life: 0.8, decay: 0.015 });
    particles.burst(ship.x, ship.y, 20, { speed: 3, color: '#f80', size: 4, life: 0.6, decay: 0.02 });
    particles.burst(ship.x, ship.y, 10, { speed: 2, color: '#f44', size: 5, life: 0.5, decay: 0.025 });
    addShockwave(ship.x, ship.y, { maxRadius: 80, speed: 3, color: '#f80' });
    triggerScreenFlash(0.3);
    shake.trigger(10, 500);

    if (lives !== Infinity)
      --lives;
    combo.count = 0;
    updateDisplays();
    ship = null;

    if (lives <= 0) {
      doGameOver();
      return;
    }

    setTimeout(() => {
      if (!gameActive || gameOverFlag) return;
      ship = createShip();
      invulnTimer = INVULN_DURATION;
    }, 1500);
  }

  function damageEnemy(enemy, index, amount) {
    enemy.hp -= amount;
    enemy.hitFlash = 150;
    if (enemy.type === 'boss')
      enemy.shieldFlash = 200;
    if (enemy.hp <= 0)
      destroyEnemy(enemy, index);
  }

  function destroyEnemy(enemy, index) {
    enemies.splice(index, 1);
    addKill();

    const color = ENEMY_TYPES[enemy.type]?.color ?? '#0f0';
    const isBoss = enemy.type === 'boss';
    const burstCount = isBoss ? 50 : 25;
    const shockRadius = isBoss ? 100 : 50;

    particles.burst(enemy.x, enemy.y, burstCount, { speed: isBoss ? 6 : 4, color, size: 3, life: 0.6, decay: 0.02 });
    particles.burst(enemy.x, enemy.y, Math.round(burstCount / 2), { speed: 2, color: '#fff', size: 2, life: 0.4, decay: 0.03 });
    addShockwave(enemy.x, enemy.y, { maxRadius: shockRadius, speed: 3, color });
    triggerScreenFlash(isBoss ? 0.3 : 0.12);

    if (isBoss) {
      shake.trigger(12, 600);
      particles.confetti(enemy.x, enemy.y, 40);
      bossActive = false;
    }

    if (enemy.type === 'minelayer') {
      for (let i = zones.length - 1; i >= 0; --i)
        if (zones[i].type === 'mine')
          detonateMine(zones[i], i);
    }

    const mult = getComboMultiplier() * modeConfig().scoreMult;
    const pts = Math.round(enemy.points * mult);
    score += pts;

    const comboText = mult > 1 ? ' x' + mult : '';
    floatingText.add(enemy.x, enemy.y, '+' + pts + comboText, { color, decay: 0.02, font: scaledFont(isBoss ? 18 : 14) });

    updateDisplays();
    checkBonusLife();
    trySpawnPowerup(enemy.x, enemy.y, isBoss ? 0.80 : 0.30);
  }

  function destroyAlly(ally, index) {
    allies.splice(index, 1);
    particles.burst(ally.x, ally.y, 20, { speed: 4, color: '#44ffaa', size: 3, life: 0.6, decay: 0.02 });
    addShockwave(ally.x, ally.y, { maxRadius: 40, speed: 3, color: '#44ffaa' });
    floatingText.add(ally.x, ally.y - 20, 'ALLY LOST!', { color: '#ff4444', decay: 0.015, font: scaledFont(14) });
    trySpawnPowerup(ally.x, ally.y, 0.50);
  }

  function checkBonusLife() {
    if (!nextExtraLife || lives === Infinity) return;
    if (score >= nextExtraLife) {
      ++lives;
      updateDisplays();
      floatingText.add(W / 2, H / 3, 'EXTRA LIFE!', { color: '#44ff44', decay: 0.012, font: scaledFont(20) });
      particles.sparkle(W / 2, H / 3, 20, { color: '#44ff44', speed: 3 });
      nextExtraLife += modeConfig().bonusLifeEvery;
    }
  }

  /* ============================== COLLISION DETECTION ============================== */

  function checkCollisions() {
    const isPiercing = powerupState.piercing.active && !empActive;

    /* Bullets vs Asteroids */
    for (let bi = bullets.length - 1; bi >= 0; --bi) {
      const b = bullets[bi];
      let hit = false;
      for (let ai = asteroids.length - 1; ai >= 0; --ai) {
        const a = asteroids[ai];
        if (distWrapped(b, a) < a.radius) {
          ++stats.shotsHit;
          if (!isPiercing) {
            bullets.splice(bi, 1);
            hit = true;
          }
          damageAsteroid(a, ai);
          if (hit) break;
        }
      }
      if (hit) continue;

      /* Bullets vs Enemies */
      if (bi < bullets.length)
        for (let ei = enemies.length - 1; ei >= 0; --ei) {
          const e = enemies[ei];
          if (e.type === 'stealth' && !e.visible) continue;
          if (distWrapped(bullets[bi], e) < e.radius) {
            ++stats.shotsHit;
            if (!isPiercing)
              bullets.splice(bi, 1);
            damageEnemy(e, ei, 1);
            hit = true;
            break;
          }
        }
    }

    /* Ally bullets vs Asteroids and Enemies */
    for (let bi = allyBullets.length - 1; bi >= 0; --bi) {
      const b = allyBullets[bi];
      let hit = false;
      for (let ai = asteroids.length - 1; ai >= 0; --ai) {
        if (distWrapped(b, asteroids[ai]) < asteroids[ai].radius) {
          allyBullets.splice(bi, 1);
          damageAsteroid(asteroids[ai], ai);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (let ei = enemies.length - 1; ei >= 0; --ei) {
        const e = enemies[ei];
        if (e.type === 'stealth' && !e.visible) continue;
        if (distWrapped(b, e) < e.radius) {
          allyBullets.splice(bi, 1);
          damageEnemy(e, ei, 1);
          break;
        }
      }
    }

    /* Enemy bullets vs Ship */
    if (ship && invulnTimer <= 0)
      for (let i = enemyBullets.length - 1; i >= 0; --i)
        if (distWrapped(enemyBullets[i], ship) < SHIP_SIZE) {
          enemyBullets.splice(i, 1);
          destroyShip();
          return;
        }

    /* Enemy bullets vs Allies */
    for (let bi = enemyBullets.length - 1; bi >= 0; --bi)
      for (let ai = allies.length - 1; ai >= 0; --ai)
        if (distWrapped(enemyBullets[bi], allies[ai]) < 10) {
          enemyBullets.splice(bi, 1);
          allies[ai].hp -= 1;
          if (allies[ai].hp <= 0)
            destroyAlly(allies[ai], ai);
          break;
        }

    /* Ship vs Asteroids (bypasses HP -- instant destroy) */
    if (ship && invulnTimer <= 0)
      for (let ai = asteroids.length - 1; ai >= 0; --ai) {
        const a = asteroids[ai];
        if (distWrapped(ship, a) < a.radius * 0.8 + SHIP_SIZE * 0.6) {
          destroyAsteroid(a, ai);
          destroyShip();
          return;
        }
      }

    /* Ship vs Enemies */
    if (ship && invulnTimer <= 0)
      for (let ei = enemies.length - 1; ei >= 0; --ei) {
        const e = enemies[ei];
        if (e.type === 'stealth' && !e.visible) continue;
        if (distWrapped(ship, e) < e.radius + SHIP_SIZE * 0.6) {
          if (e.type === 'drone')
            destroyEnemy(e, ei);
          else
            damageEnemy(e, ei, 1);
          destroyShip();
          return;
        }
      }

    /* Allies vs Asteroids */
    for (let ai = allies.length - 1; ai >= 0; --ai)
      for (let ri = asteroids.length - 1; ri >= 0; --ri) {
        if (distWrapped(allies[ai], asteroids[ri]) < asteroids[ri].radius * 0.8 + 8) {
          allies[ai].hp -= 1;
          damageAsteroid(asteroids[ri], ri);
          if (allies[ai].hp <= 0) {
            destroyAlly(allies[ai], ai);
            break;
          }
        }
      }

    /* Ship vs Powerups */
    if (ship)
      for (let i = collectiblePowerups.length - 1; i >= 0; --i) {
        const p = collectiblePowerups[i];
        if (distWrapped(ship, p) < POWERUP_COLLECT_RADIUS) {
          collectiblePowerups.splice(i, 1);
          activatePowerup(p.type);
        }
      }
  }

  /* ============================== LEVEL ADVANCE ============================== */

  function spawnEnemy() {
    const lvl = getEffectiveLevel();
    const candidates = [];

    candidates.push('ufo');
    candidates.push(Math.random() < 0.5 ? 'ufo' : 'ufoSmall');

    if (lvl >= 5) candidates.push('drone', 'drone');
    if (lvl >= 8) candidates.push('gunship');
    if (lvl >= 11) candidates.push('minelayer');
    if (lvl >= 14) candidates.push('stealth');

    const type = candidates[Math.floor(Math.random() * candidates.length)];

    if (type === 'drone') {
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; ++i) {
        const d = createEnemy('drone');
        d.y = Math.random() * H;
        enemies.push(d);
      }
    } else
      enemies.push(createEnemy(type));
  }

  function checkLevelAdvance() {
    if (gameMode === 'survival') return;
    if (warpState) return;
    if (bossActive) return;
    if (asteroids.length === 0 && enemies.length === 0) {
      ++level;
      allySpawnedForLevel = false;
      updateDisplays();
      startWarp();
    }
  }

  /* ============================== STAR UPDATE ============================== */

  function updateStars() {
    if (warpState) {
      updateWarpStars();
      return;
    }
    for (const s of stars) {
      s.x += s.driftVx;
      s.y += s.driftVy;
      if (s.x < 0) s.x += W;
      if (s.x > W) s.x -= W;
      if (s.y < 0) s.y += H;
      if (s.y > H) s.y -= H;
    }
  }

  /* ============================== HOMING BULLETS ============================== */

  function updateHomingBullets() {
    if (!powerupState.homing.active || empActive) return;
    for (const b of bullets) {
      let nearest = null, nearestDist = Infinity;
      for (const a of asteroids) {
        const d = distWrapped(b, a);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = a;
        }
      }
      for (const e of enemies) {
        if (e.type === 'stealth' && !e.visible) continue;
        const d = distWrapped(b, e);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (!nearest) continue;

      const targetAngle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
      const currentAngle = Math.atan2(b.vy, b.vx);
      let diff = targetAngle - currentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const turn = clamp(diff, -0.04, 0.04);
      const newAngle = currentAngle + turn;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.vx = Math.cos(newAngle) * speed;
      b.vy = Math.sin(newAngle) * speed;
    }
  }

  /* ============================== UPDATE ============================== */

  function update(dt) {
    gameTime += dt;

    /* Ship controls */
    if (ship) {
      if (keys['ArrowLeft'] || keys['a'] || keys['A'])
        ship.angle -= SHIP_ROTATION_SPEED;
      if (keys['ArrowRight'] || keys['d'] || keys['D'])
        ship.angle += SHIP_ROTATION_SPEED;

      ship.thrusting = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
      if (ship.thrusting) {
        ship.vx += Math.cos(ship.angle) * SHIP_THRUST;
        ship.vy += Math.sin(ship.angle) * SHIP_THRUST;

        const exhaust = ship.angle + Math.PI;
        const ex = ship.x + Math.cos(exhaust) * SHIP_SIZE * 0.8;
        const ey = ship.y + Math.sin(exhaust) * SHIP_SIZE * 0.8;
        const trailColors = ['#f80', '#ff0', '#fa0', '#f60'];
        particles.trail(ex, ey, {
          vx: Math.cos(exhaust) * 2 + (Math.random() - 0.5),
          vy: Math.sin(exhaust) * 2 + (Math.random() - 0.5),
          color: trailColors[Math.floor(Math.random() * trailColors.length)],
          size: 2 + Math.random() * 2.5,
          life: 0.45, decay: 0.04, shrink: 0.93
        });
      }

      ship.vx *= SHIP_FRICTION;
      ship.vy *= SHIP_FRICTION;
      ship.x += ship.vx;
      ship.y += ship.vy;
      wrap(ship);

      if (invulnTimer > 0) invulnTimer -= dt;
      if (hyperspaceCooldown > 0) hyperspaceCooldown -= dt;

      /* Auto-fire on held space (not during warp) */
      if (keys[' '] && !warpState) {
        shootCooldownTimer -= dt;
        if (shootCooldownTimer <= 0) {
          shoot();
          shootCooldownTimer = (!empActive && powerupState.rapid.active) ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN;
        }
      }
    }

    /* Star drift / warp */
    updateStars();

    /* During warp, skip normal entity updates */
    if (warpState) {
      warpState.timer -= dt;

      particles.update();
      shake.update(dt);
      floatingText.update();
      updateShockwaves();
      if (screenFlashAlpha > 0)
        screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.02);

      if (warpState.timer <= 0)
        endWarp();
      return;
    }

    /* Asteroids */
    for (const a of asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.rotationSpeed;
      wrap(a);
      if (a.hitFlash > 0) a.hitFlash -= dt;

      /* Lava trail */
      if (a.rockType === 'lava') {
        a.lavaTrailTimer -= dt;
        if (a.lavaTrailTimer <= 0) {
          a.lavaTrailTimer = LAVA_TRAIL_INTERVAL;
          zones.push(createZone('fire', a.x, a.y, { radius: 12, duration: 2000 }));
        }
        particles.trail(a.x, a.y, {
          vx: (Math.random() - 0.5) * 0.5, vy: -0.5 - Math.random(),
          color: Math.random() < 0.5 ? '#ff4400' : '#ff8800', size: 1.5 + Math.random(), life: 0.3, decay: 0.05
        });
      }

      /* Ice sparkle */
      if (a.rockType === 'ice') {
        a.sparkleTimer -= dt;
        if (a.sparkleTimer <= 0) {
          a.sparkleTimer = 200 + Math.random() * 300;
          const sa = randomAngle();
          const sr = a.radius * 0.6 * Math.random();
          particles.sparkle(a.x + Math.cos(sa) * sr, a.y + Math.sin(sa) * sr, 1, { color: '#cceeFF', speed: 0.5 });
        }
      }
    }

    /* Bullets */
    for (let i = bullets.length - 1; i >= 0; --i) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      wrap(b);
      if (b.life <= 0) bullets.splice(i, 1);
    }

    /* Homing adjustment */
    updateHomingBullets();

    /* Enemy bullets */
    for (let i = enemyBullets.length - 1; i >= 0; --i) {
      const b = enemyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      wrap(b);
      if (b.life <= 0) enemyBullets.splice(i, 1);
    }

    /* Ally bullets */
    for (let i = allyBullets.length - 1; i >= 0; --i) {
      const b = allyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      --b.life;
      wrap(b);
      if (b.life <= 0) allyBullets.splice(i, 1);
    }

    /* Enemies */
    const cfg = modeConfig();
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];
      e.pulsePhase += dt / 1000 * 4;
      e.lightPhase += dt / 1000 * 8;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      switch (e.type) {
        case 'ufo':
        case 'ufoSmall':
          e.x += e.vx;
          e.y += e.vy;
          if (Math.random() < 0.01) e.vy = (Math.random() - 0.5) * 2;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            enemyShoot(e);
            e.shootTimer = cfg.ufoShootInterval * (0.7 + Math.random() * 0.6);
          }
          if (e.x < -40 || e.x > W + 40) {
            enemies.splice(i, 1);
            continue;
          }
          break;

        case 'drone':
          if (ship) {
            const da = Math.atan2(ship.y - e.y, ship.x - e.x);
            e.vx += Math.cos(da) * 0.15;
            e.vy += Math.sin(da) * 0.15;
            const dspd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
            if (dspd > 4) {
              e.vx = (e.vx / dspd) * 4;
              e.vy = (e.vy / dspd) * 4;
            }
          }
          e.x += e.vx;
          e.y += e.vy;
          wrap(e);
          particles.trail(e.x, e.y, { color: '#ff4444', size: 1.5, life: 0.2, decay: 0.06 });
          break;

        case 'gunship':
          e.x += e.vx;
          e.y += e.vy;
          e.vy = Math.sin(e.pulsePhase * 0.5) * 1.5 * e.strafeDir;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            enemyShoot(e);
            e.shootTimer = cfg.ufoShootInterval * 1.2;
          }
          if (e.x < -40 || e.x > W + 40) {
            enemies.splice(i, 1);
            continue;
          }
          break;

        case 'minelayer':
          e.weavePhase += dt / 1000;
          e.x += e.vx;
          e.y += Math.sin(e.weavePhase * 2) * 2;
          e.mineTimer -= dt;
          if (e.mineTimer <= 0) {
            e.mineTimer = 3000;
            zones.push(createZone('mine', e.x, e.y, { radius: MINE_RADIUS, duration: MINE_DURATION }));
          }
          if (e.x < -40 || e.x > W + 40) {
            enemies.splice(i, 1);
            continue;
          }
          break;

        case 'stealth':
          e.x += e.vx;
          e.y += e.vy;
          e.cloakTimer -= dt;
          if (e.cloakTimer <= 0) {
            e.visible = !e.visible;
            e.cloakTimer = e.cloakCycle;
            if (e.visible && ship)
              enemyShoot(e);
          }
          if (e.x < -40 || e.x > W + 40) {
            enemies.splice(i, 1);
            continue;
          }
          break;

        case 'boss':
          if (!e.entered) {
            e.y += e.vy;
            if (e.y >= H * 0.2) {
              e.entered = true;
              e.vy = 0;
            }
          } else {
            e.x += Math.sin(e.pulsePhase * 0.3) * 1.5;
            e.y += Math.cos(e.pulsePhase * 0.2) * 0.5;
            e.x = clamp(e.x, 40, W - 40);
            e.y = clamp(e.y, 40, H * 0.5);
          }
          if (e.shieldFlash > 0) e.shieldFlash -= dt;
          e.attackTimer -= dt;
          if (e.attackTimer <= 0 && e.entered) {
            e.attackPattern = (e.attackPattern + 1) % 3;
            enemyShoot(e);
            e.attackTimer = 2500;
          }
          break;
      }
    }

    /* Enemy spawning */
    if (!bossActive) {
      enemySpawnTimer -= dt;
      const nonBossEnemies = enemies.filter(e => e.type !== 'boss').length;
      if (enemySpawnTimer <= 0 && nonBossEnemies < MAX_ENEMIES && asteroids.length > 0) {
        spawnEnemy();
        enemySpawnTimer = cfg.ufoInterval * (0.7 + Math.random() * 0.6);
      }
    }

    /* Allies */
    for (const ally of allies) {
      if (!ally.entered) {
        ally.x += ally.vx;
        if (ally.x > 40 && ally.x < W - 40) {
          ally.entered = true;
          ally.vx = 0;
          ally.vy = 0;
        }
        continue;
      }

      /* Follow player */
      if (ship) {
        const dx = ship.x + Math.cos(ship.angle + Math.PI) * ALLY_FOLLOW_DIST - ally.x;
        const dy = ship.y + Math.sin(ship.angle + Math.PI) * ALLY_FOLLOW_DIST - ally.y;
        ally.vx += dx * 0.005;
        ally.vy += dy * 0.005;
        ally.vx *= 0.96;
        ally.vy *= 0.96;
      }
      ally.x += ally.vx;
      ally.y += ally.vy;
      wrap(ally);

      /* Find target */
      let nearest = null, nearestDist = Infinity;
      for (const a of asteroids) {
        const d = distWrapped(ally, a);
        if (d < nearestDist) { nearestDist = d; nearest = a; }
      }
      for (const e of enemies) {
        const d = distWrapped(ally, e);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      if (nearest)
        ally.angle = Math.atan2(nearest.y - ally.y, nearest.x - ally.x);

      /* Shoot */
      ally.shootTimer -= dt;
      if (ally.shootTimer <= 0 && nearest) {
        ally.shootTimer = ALLY_SHOOT_INTERVAL;
        const tipX = ally.x + Math.cos(ally.angle) * 8;
        const tipY = ally.y + Math.sin(ally.angle) * 8;
        allyBullets.push({
          x: tipX, y: tipY,
          vx: Math.cos(ally.angle) * BULLET_SPEED * 0.9,
          vy: Math.sin(ally.angle) * BULLET_SPEED * 0.9,
          life: BULLET_LIFETIME * 0.7
        });
      }

      /* Engine trail */
      particles.trail(ally.x - Math.cos(ally.angle) * 6, ally.y - Math.sin(ally.angle) * 6, {
        color: '#44ffaa', size: 1.2, life: 0.2, decay: 0.06
      });
    }

    /* Collectible powerups */
    for (let i = collectiblePowerups.length - 1; i >= 0; --i) {
      const p = collectiblePowerups[i];
      p.x += p.vx;
      p.y += p.vy;
      p.phase += dt / 1000 * 3;
      p.lifetime -= dt;
      wrap(p);
      if (p.lifetime <= 0) collectiblePowerups.splice(i, 1);
    }

    /* Zones */
    updateZones(dt);
    if (fireDamageCooldown > 0) fireDamageCooldown -= dt;

    /* EMP timer */
    if (empActive) {
      empTimer -= dt;
      if (empTimer <= 0)
        empActive = false;
    }

    /* Survival mode: spawn asteroids continuously */
    if (gameMode === 'survival') {
      survivalSpawnTimer -= dt;
      if (survivalSpawnTimer <= 0) {
        const speedMult = 1 + gameTime / 60000 * 0.3;
        const a = spawnAsteroidAwayFromShip();
        a.vx *= speedMult;
        a.vy *= speedMult;
        asteroids.push(a);
        survivalSpawnTimer = Math.max(2000, cfg.spawnInterval - gameTime / 1000 * 50);
      }
    }

    /* Zen mode timer */
    if (gameMode === 'zen') {
      zenTimer -= dt;
      updateDisplays();
      if (zenTimer <= 0) {
        zenTimer = 0;
        doGameOver();
        return;
      }
    }

    /* Collisions */
    checkCollisions();

    /* Boss defeated: spawn level asteroids */
    if (bossActive && enemies.filter(e => e.type === 'boss').length === 0) {
      bossActive = false;
      spawnLevelAsteroids();
    }

    /* Effects */
    particles.update();
    shake.update(dt);
    floatingText.update();
    updateShockwaves();
    updateCombo(dt);
    if (!empActive)
      updatePowerupTimers(dt);

    if (screenFlashAlpha > 0)
      screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.02);

    /* Level advance */
    checkLevelAdvance();
  }

  /* ============================== DRAWING ============================== */

  function drawStars() {
    const time = performance.now() / 1000;
    const isWarping = !!warpState;
    let warpProgress = 0, warpI = 0;

    if (isWarping) {
      warpProgress = 1 - warpState.timer / warpState.duration;
      warpI = Math.sin(warpProgress * Math.PI);
    }

    for (const s of stars) {
      const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.15;
      const brightness = clamp(s.baseBrightness + twinkle, 0.1, 1);

      if (isWarping) {
        const cx = W / 2, cy = H / 2;
        const dx = s.x - cx, dy = s.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        const trailLen = warpI * 50 * (s.size + 0.5);

        ctx.save();
        ctx.globalAlpha = brightness * (0.6 + warpI * 0.4);

        const tg = ctx.createLinearGradient(
          s.x - nx * trailLen, s.y - ny * trailLen,
          s.x, s.y
        );
        tg.addColorStop(0, 'rgba(255,255,255,0)');
        tg.addColorStop(1, s.color);
        ctx.strokeStyle = tg;
        ctx.lineWidth = s.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - nx * trailLen, s.y - ny * trailLen);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = brightness;
        ctx.fillStyle = s.color;
        if (s.size > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else
          ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShip() {
    if (!ship) return;
    if (invulnTimer > 0 && Math.floor(invulnTimer / 100) % 2 === 0) return;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    /* Engine flame */
    if (ship.thrusting) {
      const flicker = 0.7 + Math.random() * 0.3;
      const flameLen = SHIP_SIZE * (0.7 + Math.random() * 0.5);

      const fg = ctx.createLinearGradient(-SHIP_SIZE * 0.45, 0, -SHIP_SIZE * 0.5 - flameLen, 0);
      fg.addColorStop(0, 'rgba(255,220,100,' + flicker * 0.9 + ')');
      fg.addColorStop(0.3, 'rgba(255,130,30,' + flicker * 0.7 + ')');
      fg.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.35, -SHIP_SIZE * 0.22);
      ctx.lineTo(-SHIP_SIZE * 0.5 - flameLen, 0);
      ctx.lineTo(-SHIP_SIZE * 0.35, SHIP_SIZE * 0.22);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createLinearGradient(-SHIP_SIZE * 0.4, 0, -SHIP_SIZE * 0.4 - flameLen * 0.35, 0);
      ig.addColorStop(0, 'rgba(255,255,240,' + flicker * 0.7 + ')');
      ig.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.35, -SHIP_SIZE * 0.1);
      ctx.lineTo(-SHIP_SIZE * 0.4 - flameLen * 0.35, 0);
      ctx.lineTo(-SHIP_SIZE * 0.35, SHIP_SIZE * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    /* Ship body */
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();

    const bg = ctx.createLinearGradient(-SHIP_SIZE, -SHIP_SIZE * 0.6, SHIP_SIZE, SHIP_SIZE * 0.3);
    bg.addColorStop(0, '#3a4555');
    bg.addColorStop(0.4, '#7888a0');
    bg.addColorStop(0.7, '#99aabc');
    bg.addColorStop(1, '#6a7a8c');
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.strokeStyle = '#aabbdd';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* Cockpit */
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#66bbff';
    ctx.beginPath();
    ctx.arc(SHIP_SIZE * 0.15, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    /* Shield bubble */
    if (powerupState.shield.active) {
      const shimmer = Math.sin(gameTime / 1000 * 3) * 0.15;
      const empDim = empActive ? 0.3 : 1;
      ctx.save();
      ctx.strokeStyle = `rgba(68,170,255,${(0.35 + shimmer) * empDim})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = empActive ? 2 : 12;
      ctx.setLineDash(empActive ? [4, 4] : []);
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, SHIP_SIZE + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function buildAsteroidPath(a) {
    ctx.beginPath();
    for (let i = 0; i < a.shape.length; ++i) {
      const v = a.shape[i];
      const r = a.radius * v.jitter;
      const px = Math.cos(v.angle) * r;
      const py = Math.sin(v.angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);

    buildAsteroidPath(a);

    /* Gradient fill */
    const grad = ctx.createRadialGradient(
      -a.radius * 0.25, -a.radius * 0.25, a.radius * 0.1,
      0, 0, a.radius
    );
    grad.addColorStop(0, a.palette.light);
    grad.addColorStop(1, a.palette.dark);
    ctx.fillStyle = grad;
    ctx.fill();

    /* Edge */
    ctx.strokeStyle = a.palette.edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* Iron shimmer */
    if (a.rockType === 'iron') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const shimmerAngle = gameTime / 1000 * 0.5 + a.rotation;
      const sx = Math.cos(shimmerAngle) * a.radius * 0.3;
      const sy = Math.sin(shimmerAngle) * a.radius * 0.3;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, a.radius * 0.5);
      sg.addColorStop(0, 'rgba(200,200,220,0.25)');
      sg.addColorStop(1, 'rgba(200,200,220,0)');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.restore();
    }

    /* Crystal glow + facets */
    if (a.rockType === 'crystal') {
      ctx.save();
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 6;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(68,170,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      ctx.strokeStyle = 'rgba(100,180,255,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; ++i) {
        const fa = a.rotation * 0.5 + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * a.radius * 0.9, Math.sin(fa) * a.radius * 0.9);
        ctx.lineTo(Math.cos(fa + Math.PI) * a.radius * 0.9, Math.sin(fa + Math.PI) * a.radius * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Exploding: pulsing inner glow + ember cracks */
    if (a.rockType === 'exploding') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const pulse = 0.3 + Math.sin(gameTime / 1000 * 4) * 0.2;
      const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, a.radius * 0.8);
      eg.addColorStop(0, `rgba(255,100,0,${pulse})`);
      eg.addColorStop(0.5, `rgba(255,60,0,${pulse * 0.5})`);
      eg.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,150,50,${0.3 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; ++i) {
        const ca = a.rotation * 1.5 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ca) * a.radius * 0.7, Math.sin(ca) * a.radius * 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Ice: frosted surface + specular highlight */
    if (a.rockType === 'ice') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const ig = ctx.createRadialGradient(-a.radius * 0.3, -a.radius * 0.3, 0, 0, 0, a.radius);
      ig.addColorStop(0, 'rgba(220,240,255,0.3)');
      ig.addColorStop(0.4, 'rgba(180,220,255,0.1)');
      ig.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = ig;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 4;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(150,220,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* Lava: glowing magma cracks */
    if (a.rockType === 'lava') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const lavaGlow = 0.4 + Math.sin(gameTime / 1000 * 3 + a.rotation) * 0.2;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = `rgba(255,100,0,${lavaGlow})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; ++i) {
        const ca = a.rotation * 0.8 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * a.radius * 0.1, Math.sin(ca) * a.radius * 0.1);
        const segs = 3 + Math.floor(i * 1.3);
        let r = a.radius * 0.1, ang = ca;
        for (let j = 0; j < segs; ++j) {
          r += a.radius * 0.2;
          ang += (Math.sin(i + j) * 0.5);
          ctx.lineTo(Math.cos(ang) * Math.min(r, a.radius * 0.8), Math.sin(ang) * Math.min(r, a.radius * 0.8));
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* Electric: surface crackling */
    if (a.rockType === 'electric') {
      ctx.save();
      ctx.shadowColor = '#ffff66';
      ctx.shadowBlur = 6;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(255,255,100,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,200,0.5)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 2; ++i) {
        const sa = randomAngle();
        ctx.beginPath();
        let px = Math.cos(sa) * a.radius * 0.2;
        let py = Math.sin(sa) * a.radius * 0.2;
        ctx.moveTo(px, py);
        for (let j = 0; j < 4; ++j) {
          px += (Math.random() - 0.5) * a.radius * 0.4;
          py += (Math.random() - 0.5) * a.radius * 0.4;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Craters */
    ctx.save();
    buildAsteroidPath(a);
    ctx.clip();
    for (const c of a.craters) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.9, -1, 0.5);
      ctx.stroke();
    }
    ctx.restore();

    /* Damage cracks */
    if (a.damageCracks.length > 0 && a.hp < a.maxHp) {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const dmgRatio = 1 - a.hp / a.maxHp;
      const isCrystal = a.rockType === 'crystal';
      ctx.strokeStyle = isCrystal
        ? `rgba(100,200,255,${0.4 + dmgRatio * 0.4})`
        : `rgba(255,200,100,${0.3 + dmgRatio * 0.5})`;
      ctx.lineWidth = 1 + dmgRatio;
      if (isCrystal) {
        ctx.shadowColor = '#44aaff';
        ctx.shadowBlur = 5 * dmgRatio;
      }
      for (const crack of a.damageCracks) {
        ctx.beginPath();
        for (let i = 0; i < crack.length; ++i) {
          const px = Math.cos(crack[i].a) * crack[i].r;
          const py = Math.sin(crack[i].a) * crack[i].r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Hit flash */
    if (a.hitFlash > 0) {
      buildAsteroidPath(a);
      ctx.globalAlpha = 0.4 * (a.hitFlash / 150);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    /* HP pips (world space) */
    if (a.maxHp > 1) {
      const pipY = a.y + a.radius + 6;
      const pipR = 2;
      const pipGap = 6;
      const totalW = (a.maxHp - 1) * pipGap;
      const startX = a.x - totalW / 2;
      for (let i = 0; i < a.maxHp; ++i) {
        ctx.fillStyle = i < a.hp ? a.palette.edge : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(startX + i * pipGap, pipY, pipR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawElectricArcs() {
    const { drawElectricArc } = SZ.GameEffects;
    for (const a of asteroids) {
      if (a.rockType !== 'electric') continue;
      for (const other of asteroids) {
        if (other === a) continue;
        const d = distWrapped(a, other);
        if (d < 100)
          drawElectricArc(ctx, a.x, a.y, other.x, other.y, {
            segments: 8, jitter: 6, color: '#ffff88', glowColor: '#aaaa44', width: 1.2, glowWidth: 3
          });
      }
      for (const e of enemies) {
        const d = distWrapped(a, e);
        if (d < 100)
          drawElectricArc(ctx, a.x, a.y, e.x, e.y, {
            segments: 8, jitter: 6, color: '#ffff88', glowColor: '#aaaa44', width: 1.2, glowWidth: 3
          });
      }
    }
  }

  function drawBullet(b) {
    const isHoming = powerupState.homing.active && !empActive;
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 8;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;
    const glowColor = isHoming ? '#00ffff' : '#88ffff';
    const dotColor = isHoming ? '#aff' : '#dff';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, isHoming ? 'rgba(0,255,255,0)' : 'rgba(136,255,255,0)');
    tg.addColorStop(1, isHoming ? 'rgba(0,255,255,0.7)' : 'rgba(136,255,255,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawUFOBullet(b) {
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 6;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;

    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 8;

    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, 'rgba(255,68,68,0)');
    tg.addColorStop(1, 'rgba(255,68,68,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = '#faa';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEnemy(e) {
    const glow = 0.4 + Math.sin(e.pulsePhase) * 0.2;
    const r = e.radius;
    const color = ENEMY_TYPES[e.type]?.color ?? '#0f0';

    ctx.save();
    ctx.translate(e.x, e.y);

    /* Hit flash */
    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * (e.hitFlash / 150);
      ctx.fillStyle = '#fff';
    }

    switch (e.type) {
      case 'ufo':
      case 'ufoSmall': {
        const large = e.type === 'ufo';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8 + glow * 6;
        ctx.fillStyle = `rgba(0,180,80,${0.3 + glow * 0.2})`;
        ctx.strokeStyle = '#00ff88';
        ctx.globalAlpha = 0.7 + glow * 0.3;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(0,255,120,${0.15 + glow * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.15, r * 0.5, r * 0.35, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.2);
        ctx.lineTo(r * 0.5, r * 0.2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const lightCount = large ? 5 : 3;
        for (let i = 0; i < lightCount; ++i) {
          const la = (i / lightCount) * Math.PI * 2 + e.lightPhase;
          const lx = Math.cos(la) * r * 0.7;
          const ly = Math.sin(la) * r * 0.2;
          const lb = (Math.sin(la + e.lightPhase) + 1) * 0.5;
          ctx.fillStyle = `rgba(255,255,100,${lb * 0.8})`;
          ctx.beginPath();
          ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'drone':
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(200,40,40,${0.6 + glow * 0.3})`;
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.6, -r * 0.7);
        ctx.lineTo(-r * 0.3, 0);
        ctx.lineTo(-r * 0.6, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;

      case 'gunship':
        ctx.shadowColor = '#88ff44';
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(80,160,40,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#88ff44';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.3, -r * 0.6);
        ctx.lineTo(-r, -r * 0.4);
        ctx.lineTo(-r * 0.7, 0);
        ctx.lineTo(-r, r * 0.4);
        ctx.lineTo(r * 0.3, r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        /* Turret glow */
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(r * 0.5, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;

      case 'minelayer':
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 5;
        ctx.fillStyle = `rgba(160,120,20,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-r, -r * 0.5, r * 2, r);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#332200';
        ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.3);
        ctx.shadowBlur = 0;
        break;

      case 'stealth': {
        const vis = e.visible ? 1 : 0.08;
        const flicker = e.visible ? 1 : (Math.random() < 0.1 ? 0.3 : 0.05);
        ctx.globalAlpha = vis * flicker;
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 6 * vis;
        ctx.fillStyle = `rgba(120,40,200,${0.5 * vis})`;
        ctx.strokeStyle = `rgba(170,68,255,${0.8 * vis})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.5, -r * 0.8);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(-r * 0.5, r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }

      case 'boss': {
        /* Shield aura */
        const shieldGlow = e.shieldFlash > 0 ? 0.4 : 0.15;
        ctx.globalAlpha = shieldGlow + glow * 0.1;
        ctx.strokeStyle = '#ff88ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.8;
        ctx.shadowColor = '#ff44ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(160,40,160,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#ff44ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.5, -r * 0.7);
        ctx.lineTo(-r * 0.2, -r * 0.9);
        ctx.lineTo(-r, -r * 0.4);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(-r, r * 0.4);
        ctx.lineTo(-r * 0.2, r * 0.9);
        ctx.lineTo(r * 0.5, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* HP bar */
        const barW = r * 2;
        const barH = 4;
        const barY = -r - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        ctx.fillStyle = '#ff44ff';
        ctx.fillRect(-barW / 2, barY, barW * (e.hp / e.maxHp), barH);
        ctx.strokeStyle = '#ff88ff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-barW / 2, barY, barW, barH);
        break;
      }
    }

    ctx.restore();
  }

  function drawAlly(ally) {
    ctx.save();
    ctx.translate(ally.x, ally.y);
    ctx.rotate(ally.angle);

    ctx.shadowColor = '#44ffaa';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(40,180,120,0.7)';
    ctx.strokeStyle = '#44ffaa';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();

    /* HP pips */
    if (ally.maxHp > 1) {
      const pipY = ally.y + 10;
      const pipGap = 5;
      const totalW = (ally.maxHp - 1) * pipGap;
      const startX = ally.x - totalW / 2;
      for (let i = 0; i < ally.maxHp; ++i) {
        ctx.fillStyle = i < ally.hp ? '#44ffaa' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(startX + i * pipGap, pipY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawAllyBullet(b) {
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 6;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;

    ctx.save();
    ctx.shadowColor = '#44ffaa';
    ctx.shadowBlur = 8;
    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, 'rgba(68,255,170,0)');
    tg.addColorStop(1, 'rgba(68,255,170,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#aaffdd';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCollectiblePowerup(p) {
    const fadeStart = 2000;
    const alpha = p.lifetime < fadeStart ? p.lifetime / fadeStart : 1;
    const pulse = 0.8 + Math.sin(p.phase) * 0.2;
    const r = 11 * pulse;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha;
    ctx.rotate(p.phase * 0.3);

    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;

    ctx.fillStyle = p.color + '30';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, 0, 1);

    ctx.restore();
  }

  function drawShockwaves() {
    for (const s of shockwaves) {
      ctx.save();
      ctx.globalAlpha = s.life * 0.5;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawComboHUD() {
    if (combo.count < 2) return;
    const mult = getComboMultiplier();
    const scale = 1 + combo.displayScale * 0.4;
    const colors = ['#fff', '#ffd700', '#ff8c00', '#ff4500', '#ff0044', '#ff00aa', '#aa44ff', '#ff44ff'];
    const color = colors[Math.min(mult - 1, colors.length - 1)];

    ctx.save();
    ctx.translate(W / 2, 35 * uiS);
    ctx.scale(scale, scale);
    ctx.font = scaledFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;
    ctx.fillText('\u00d7' + mult + ' COMBO', 0, 0);
    ctx.restore();
  }

  function drawPowerupHUD() {
    /* EMP warning */
    if (empActive) {
      const pulse = 0.5 + Math.sin(gameTime / 1000 * 6) * 0.3;
      ctx.save();
      ctx.font = scaledFont(14);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(136,204,255,${pulse})`;
      ctx.fillText('EMP ACTIVE -- POWERUPS DISABLED', W / 2, H - 40 * uiS);
      ctx.restore();
    }

    const active = [];
    for (const key of DURATION_POWERUPS)
      if (powerupState[key].active) {
        const def = POWERUP_TYPES[key];
        active.push({ ...def, timer: powerupState[key].timer, key });
      }
    if (active.length === 0) return;

    const barW = 50 * uiS;
    const barH = 14 * uiS;
    let x = 8 * uiS;
    const y = H - (22 * uiS);
    ctx.save();
    ctx.font = scaledFont(10);
    for (const p of active) {
      const pct = p.timer / p.duration;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = p.color + '88';
      ctx.fillRect(x, y, barW * pct, barH);

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW, barH);

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, x + barW / 2, y + barH / 2);

      x += barW + 4 * uiS;
    }
    ctx.restore();
  }

  function drawWarpText() {
    if (!warpState) return;
    const progress = 1 - warpState.timer / warpState.duration;

    if (progress < 0.2 || progress > 0.9) return;

    const alpha = progress < 0.3 ? (progress - 0.2) / 0.1 : progress > 0.8 ? (0.9 - progress) / 0.1 : 1;
    const scale = 0.5 + Math.min((progress - 0.2) / 0.3, 1) * 0.5;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = scaledFont(42);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#88ccff';
    ctx.fillText('LEVEL ' + level, 0, 0);
    ctx.restore();
  }

  function drawModeSelect() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    const time = performance.now() / 1000;
    const titleGlow = 15 + Math.sin(time * 1.5) * 10;

    /* Title */
    ctx.save();
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = titleGlow;
    ctx.font = scaledFont(44);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('ASTEROIDS', W / 2, 70 * uiS);
    ctx.restore();

    ctx.fillStyle = '#667';
    ctx.font = scaledFont(12, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Enhanced Edition', W / 2, 96 * uiS);

    /* Field size selector */
    const fieldY = 125 * uiS;
    ctx.fillStyle = '#889';
    ctx.font = scaledFont(11, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Field Size', W / 2, fieldY);

    const fLabel = FIELD_SIZES[fieldSizeKey].label + ' (' + FIELD_SIZES[fieldSizeKey].size + ')';
    ctx.fillStyle = '#88ccff';
    ctx.font = scaledFont(16);
    ctx.fillText('\u25C0  ' + fLabel + '  \u25B6', W / 2, fieldY + 20 * uiS);

    /* Mode cards */
    const modes = [
      { key: 'classic', num: '1' },
      { key: 'survival', num: '2' },
      { key: 'zen', num: '3' },
      { key: 'hardcore', num: '4' }
    ];

    const cardH = 56 * uiS;
    const cardW = 280 * uiS;
    const startY = 170 * uiS;
    const gap = 12 * uiS;

    for (let i = 0; i < modes.length; ++i) {
      const m = modes[i];
      const modeCfg = MODE_CONFIGS[m.key];
      const y = startY + i * (cardH + gap);
      const x = (W - cardW) / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 6 * uiS);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#88ccff';
      ctx.font = scaledFont(22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.num, x + 24 * uiS, y + cardH / 2);

      ctx.fillStyle = '#fff';
      ctx.font = scaledFont(18);
      ctx.textAlign = 'left';
      ctx.fillText(modeCfg.label, x + 50 * uiS, y + cardH / 2 - 8 * uiS);

      ctx.fillStyle = '#889';
      ctx.font = scaledFont(12, 'normal');
      ctx.fillText(modeCfg.description, x + 50 * uiS, y + cardH / 2 + 12 * uiS);
    }

    const footerY = startY + modes.length * (cardH + gap) + 16 * uiS;
    ctx.fillStyle = '#556';
    ctx.font = scaledFont(11, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Press 1\u20134 to start  \u00b7  \u25C0 \u25B6 field size', W / 2, footerY);
    ctx.fillText('Arrow keys or WASD to move \u00b7 Space to shoot', W / 2, footerY + 16 * uiS);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    const time = performance.now() / 1000;
    const pulse = 0.7 + Math.sin(time * 2) * 0.3;

    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.font = scaledFont(32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgb(255,${Math.round(70 + pulse * 30)},${Math.round(70 + pulse * 30)})`;
    ctx.fillText('GAME OVER', W / 2, H / 2 - 80 * uiS);
    ctx.restore();

    ctx.font = scaledFont(20);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Score: ' + score, W / 2, H / 2 - 40 * uiS);

    ctx.font = scaledFont(14, 'normal');
    ctx.fillStyle = '#aaa';
    ctx.fillText(modeConfig().label + ' Mode  \u00b7  Level ' + level, W / 2, H / 2 - 15 * uiS);

    const statLines = [
      'Asteroids destroyed: ' + stats.asteroidsDestroyed,
      'Accuracy: ' + (stats.shotsFired > 0 ? Math.round(stats.shotsHit / stats.shotsFired * 100) : 0) + '%',
      'Max combo: \u00d7' + Math.max(1, stats.maxCombo),
      'Powerups collected: ' + stats.powerupsCollected
    ];

    ctx.font = scaledFont(12, 'normal');
    ctx.fillStyle = '#888';
    for (let i = 0; i < statLines.length; ++i)
      ctx.fillText(statLines[i], W / 2, H / 2 + 15 * uiS + i * 18 * uiS);

    ctx.fillStyle = '#667';
    ctx.font = scaledFont(12, 'normal');
    ctx.fillText('Press F2 for new game', W / 2, H / 2 + 110 * uiS);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.font = scaledFont(28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.fillText('PAUSED', W / 2, H / 2 - 10 * uiS);
    ctx.restore();

    ctx.fillStyle = '#888';
    ctx.font = scaledFont(14, 'normal');
    ctx.textAlign = 'center';
    ctx.fillText('Press P to resume', W / 2, H / 2 + 20 * uiS);
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (modeSelectActive) {
      ctx.drawImage(bgCanvas, 0, 0);
      drawStars();
      drawModeSelect();
      ctx.restore();
      return;
    }

    shake.apply(ctx);

    /* Background */
    ctx.drawImage(bgCanvas, 0, 0);
    drawStars();

    /* Entities (not during warp) */
    if (!warpState) {
      drawZones();
      for (const a of asteroids) drawAsteroid(a);
      drawElectricArcs();
      for (const p of collectiblePowerups) drawCollectiblePowerup(p);
      for (const e of enemies) drawEnemy(e);
      for (const a of allies) drawAlly(a);
      for (const b of bullets) drawBullet(b);
      for (const b of enemyBullets) drawUFOBullet(b);
      for (const b of allyBullets) drawAllyBullet(b);
    }

    /* Ship (always visible) */
    drawShip();

    /* Effects */
    particles.draw(ctx);
    floatingText.draw(ctx);
    drawShockwaves();

    /* HUD (not during warp) */
    if (!warpState) {
      drawComboHUD();
      drawPowerupHUD();
    }

    /* Warp text */
    drawWarpText();

    /* Screen flash */
    if (screenFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${screenFlashAlpha})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }

    /* Overlays */
    if (gamePaused) drawPauseOverlay();
    else if (gameOverFlag) drawGameOver();

    ctx.restore();
  }

  /* ============================== DISPLAY UPDATES ============================== */

  function updateDisplays() {
    statusScore.textContent = score;

    if (lives === Infinity)
      statusLives.textContent = '\u221e';
    else
      statusLives.textContent = lives;

    if (gameMode === 'zen') {
      statusLevelLabel.textContent = 'Time';
      const secs = Math.ceil((zenTimer || 0) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      statusLevel.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    } else if (gameMode === 'survival') {
      statusLevelLabel.textContent = 'Wave';
      statusLevel.textContent = Math.floor((gameTime || 0) / 10000) + 1;
    } else {
      statusLevelLabel.textContent = 'Level';
      statusLevel.textContent = level;
    }

    if (statusMode)
      statusMode.textContent = modeConfig().label;
  }

  /* ============================== GAME OVER ============================== */

  function doGameOver() {
    gameActive = false;
    gameOverFlag = true;
    checkHighScore();
  }

  function togglePause() {
    if (!gameActive || gameOverFlag || modeSelectActive) return;
    gamePaused = !gamePaused;
    if (!gamePaused)
      lastTime = performance.now();
  }

  /* ============================== HIGH SCORES ============================== */

  let highScores = [];

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) highScores = JSON.parse(raw);
      if (!Array.isArray(highScores)) highScores = [];
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores)); }
    catch (_) {}
  }

  function checkHighScore() {
    if (score <= 0) return;
    const entry = { score, level, mode: gameMode };
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
      td.colSpan = 4;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      for (let i = 0; i < highScores.length; ++i) {
        const e = highScores[i];
        const modeName = MODE_CONFIGS[e.mode]?.label || e.mode || 'Classic';
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.level + '</td><td>' + modeName + '</td>';
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

  /* ============================== MENU SYSTEM ============================== */

  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new': showModeSelect(); break;
      case 'pause': togglePause(); break;
      case 'high-scores': showHighScores(); break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;
    }
  }

  /* ============================== INPUT ============================== */

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    /* Mode selection */
    if (modeSelectActive) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cycleFieldSize(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        cycleFieldSize(1);
        return;
      }
      const modeKeys = { '1': 'classic', '2': 'survival', '3': 'zen', '4': 'hardcore' };
      if (modeKeys[e.key]) {
        e.preventDefault();
        modeSelectActive = false;
        newGame(modeKeys[e.key]);
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      showModeSelect();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    keys[e.key] = true;

    if (e.key === ' ') e.preventDefault();

    if (!gameActive || gamePaused || gameOverFlag) return;

    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      hyperspace();
    }
  });

  document.addEventListener('keyup', e => { keys[e.key] = false; });

  /* ============================== GAME LOOP ============================== */

  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    if (gameActive && !gamePaused && !gameOverFlag && !modeSelectActive)
      update(dt);

    render();
  }

  /* ============================== MODE SELECT / NEW GAME / FIELD SIZE ============================== */

  function cycleFieldSize(dir) {
    const idx = FIELD_SIZE_KEYS.indexOf(fieldSizeKey);
    const newIdx = (idx + dir + FIELD_SIZE_KEYS.length) % FIELD_SIZE_KEYS.length;
    fieldSizeKey = FIELD_SIZE_KEYS[newIdx];
    try { localStorage.setItem(FIELD_STORAGE_KEY, fieldSizeKey); } catch (_) {}
    setupField();
  }

  function showModeSelect() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    gameActive = false;
    gamePaused = false;
    gameOverFlag = false;
    modeSelectActive = true;
    warpState = null;
    gameTime = 0;
    lastTime = null;
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function newGame(mode) {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    gameMode = mode || 'classic';
    const cfg = modeConfig();

    score = 0;
    lives = cfg.lives;
    level = 1;
    gameActive = true;
    gamePaused = false;
    gameOverFlag = false;
    modeSelectActive = false;
    invulnTimer = INVULN_DURATION;
    hyperspaceCooldown = 0;
    enemySpawnTimer = cfg.ufoInterval;
    shootCooldownTimer = 0;
    lastTime = null;
    gameTime = 0;
    warpState = null;

    bullets = [];
    enemies = [];
    enemyBullets = [];
    allies = [];
    allyBullets = [];
    zones = [];
    collectiblePowerups = [];
    powerupState = initPowerupState();
    combo = { count: 0, timer: 0, displayScale: 0 };
    shockwaves = [];
    screenFlashAlpha = 0;
    empActive = false;
    empTimer = 0;
    fireDamageCooldown = 0;
    bossActive = false;
    allySpawnedForLevel = false;

    stats = {
      asteroidsDestroyed: 0,
      shotsFired: 0,
      shotsHit: 0,
      powerupsCollected: 0,
      maxCombo: 0
    };

    if (gameMode === 'zen')
      zenTimer = cfg.timeLimit;
    if (gameMode === 'survival')
      survivalSpawnTimer = cfg.spawnInterval;

    nextExtraLife = cfg.bonusLifeEvery || 0;

    particles.clear();
    floatingText.clear();

    ship = createShip();
    spawnLevelAsteroids();
    updateDisplays();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ============================== WINDOW RESIZE ============================== */

  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      SZ.Dlls.User32.MoveWindow(w, h);
      document.documentElement.classList.add('flex-layout');
      document.body.classList.add('flex-layout');
      if (resizeCanvasFn) resizeCanvasFn();
    });
  }

  /* ============================== INIT ============================== */

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    setupField();
    setupCanvasScaling();
    loadHighScores();
    showModeSelect();
    requestWindowResize();
  }

  init();

})();
