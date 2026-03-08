;(function() {
  'use strict';

  /* ── Constants ── */
  const CANVAS_W = 600;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;

  /* Storage */
  const STORAGE_PREFIX = 'sz-space-combat';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* Player */
  const PLAYER_SPEED = 280;
  const PLAYER_SIZE = 16;
  const MAX_LIVES = 3;

  /* Shield */
  const SHIELD_MAX_HP = 3;

  /* Weapons */
  const WEAPON_TYPES = ['spread', 'laser', 'missile', 'plasma', 'beam', 'shotgun', 'lightning', 'flak', 'railgun'];
  const WEAPON_COOLDOWNS = { spread: 0.25, laser: 0.12, missile: 0.5, plasma: 0.6, beam: 0.08, shotgun: 0.7, lightning: 0.5, flak: 0.45, railgun: 1.2 };
  const BULLET_SPEED = 500;
  const MISSILE_SPEED = 350;
  const MISSILE_TURN_RATE = 4;
  const PLASMA_SPEED = 280;
  const PLASMA_RADIUS = 40;
  const SHOTGUN_SPEED = 400;
  const SHOTGUN_PELLETS = 5;
  const SHOTGUN_SPREAD = 0.4;
  const SHOTGUN_FADE_TIME = 0.3;
  const LIGHTNING_SPEED = 600;
  const LIGHTNING_CHAIN_RANGE = 80;
  const LIGHTNING_CHAIN_COUNT = 2;
  const LIGHTNING_CHAIN_DECAY = 0.5;
  const FLAK_SPEED = 350;
  const FLAK_DETONATE_TIME = 0.25;
  const FLAK_FRAGMENT_COUNT = 6;
  const RAILGUN_SPEED = 1500;
  const RAILGUN_TRAIL_DURATION = 0.3;

  /* Enemies */
  const ENEMY_TYPES = {
    scout:       { hp: 1,  speed: 160, score: 100,  size: 12, color: '#e74c3c', canShoot: false, minWave: 1 },
    fighter:     { hp: 2,  speed: 120, score: 200,  size: 14, color: '#e67e22', canShoot: true,  minWave: 1 },
    dart:        { hp: 1,  speed: 300, score: 150,  size: 10, color: '#2ecc71', canShoot: false, minWave: 2 },
    bomber:      { hp: 4,  speed: 70,  score: 500,  size: 18, color: '#8e44ad', canShoot: true,  minWave: 3 },
    swarm:       { hp: 1,  speed: 180, score: 80,   size: 8,  color: '#ff6b6b', canShoot: false, minWave: 4 },
    sniper:      { hp: 2,  speed: 80,  score: 300,  size: 14, color: '#f1c40f', canShoot: true,  minWave: 4 },
    cloaker:     { hp: 2,  speed: 140, score: 350,  size: 12, color: '#9b59b6', canShoot: false, minWave: 5, cloaks: true },
    carrier:     { hp: 6,  speed: 50,  score: 800,  size: 22, color: '#1abc9c', canShoot: true,  minWave: 6 },
    minelayer:   { hp: 3,  speed: 90,  score: 400,  size: 14, color: '#d35400', canShoot: false, minWave: 7, dropsMines: true },
    juggernaut:  { hp: 10, speed: 40,  score: 1200, size: 26, color: '#95a5a6', canShoot: true,  minWave: 8 },
    shieldbearer:{ hp: 5,  speed: 60,  score: 600,  size: 18, color: '#3498db', canShoot: false, minWave: 9, shieldAura: true }
  };
  const ENEMY_FIRE_INTERVAL = 2;
  const ENEMY_BULLET_SPEED = 250;

  /* Streak */
  const STREAK_TIMEOUT = 2;
  const MAX_MULTIPLIER = 12;

  /* Upgrades */
  const UPGRADE_SPEED = 80;
  const UPGRADE_SIZE = 10;
  const UPGRADE_LIFETIME = 8;
  const MAX_UPGRADE_LEVEL = 5;
  const UPGRADE_TYPES_PERSISTENT = ['extraShots', 'damageUp', 'speedUp', 'fireRate', 'shieldUp', 'bulletSize', 'magnetRange'];
  const PERSISTENT_UPGRADE_DEFS = {
    extraShots:  { label: 'MULTI',  color: '#0f0' },
    damageUp:    { label: 'DMG',    color: '#f44' },
    speedUp:     { label: 'SPD',    color: '#ff0' },
    fireRate:    { label: 'RATE',   color: '#f0f' },
    shieldUp:    { label: 'SHLD',   color: '#0bf' },
    bulletSize:  { label: 'SIZE',   color: '#ffa500' },
    magnetRange: { label: 'MAGNET', color: '#ff69b4' }
  };

  /* Boss definitions */
  const BOSS_TYPES = [
    { name: 'Commander',  baseHP: 150,  size: 40, color: '#ff4444', score: 2000,
      shieldHP: 40, shieldRegenDelay: 4, shieldRegenRate: 8,
      attacks: ['aimedBurst', 'sweepArc', 'spiralBurst'] },
    { name: 'Destroyer',  baseHP: 350, size: 50, color: '#ff8800', score: 5000,
      shieldHP: 80, shieldRegenDelay: 5, shieldRegenRate: 10,
      attacks: ['laserBeam', 'missileSalvo', 'crossBeams', 'mineDeployment'] },
    { name: 'Mothership', baseHP: 600, size: 60, color: '#44ff44', score: 10000,
      shieldHP: 120, shieldRegenDelay: 6, shieldRegenRate: 12,
      attacks: ['spawnMinions', 'bulletRing', 'spiralBurst', 'mineDeployment'] },
    { name: 'Dreadnought',baseHP: 1000, size: 70, color: '#8844ff', score: 20000,
      shieldHP: 200, shieldRegenDelay: 4, shieldRegenRate: 15,
      attacks: ['aimedBurst', 'sweepArc', 'laserBeam', 'bulletRing', 'spiralBurst', 'crossBeams', 'mineDeployment'] }
  ];

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusScore = document.getElementById('statusScore');
  const statusWave = document.getElementById('statusWave');
  const statusLives = document.getElementById('statusLives');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Pilot your ship through waves of enemies.', 'Destroy all enemies to advance to the next wave.', '', 'Arrow Keys / WASD = Move (8 directions)', 'Space / Z = Fire weapon'] },
    { title: 'Weapons & Upgrades', lines: ['Collect weapon pickups dropped by enemies:', 'Spread, Laser, Missile, Plasma, Beam.', '', 'Between waves, spend points on upgrades:', 'Extra shots, damage, speed, fire rate, shields.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Game State ── */
  let state = STATE_READY;
  let score = 0;
  let lives = MAX_LIVES;
  let waveNumber = 1;
  let highScores = [];

  /* Player */
  let player = { x: CANVAS_W / 2, y: CANVAS_H - 60, dx: 0 };
  let shieldHP = SHIELD_MAX_HP;
  let currentWeapon = 'spread';
  let fireCooldown = 0;

  /* Input */
  const keys = {};
  let mouseDown = false;

  /* Entities */
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let upgrades = [];

  /* Streak */
  let streak = 0;
  let streakTimer = 0;
  let multiplier = 1;

  /* Persistent Upgrades */
  let pUpgrades = { extraShots: 0, damageUp: 0, speedUp: 0, fireRate: 0, shieldUp: 0, bulletSize: 0, magnetRange: 0 };

  /* Wave */
  let waveEnemiesLeft = 0;
  let waveSpawnTimer = 0;
  let waveSpawnCount = 0;
  let waveTotalEnemies = 0;
  let waveDelay = 0;

  /* Mines (dropped by minelayer enemies) */
  let mines = [];

  /* Rail trails (visual effect) */
  let railTrails = [];

  /* Boss */
  let boss = null;
  let bossWarningTimer = 0;
  let bossVictoryTimer = 0;
  let isBossWave = false;

  /* Stars */
  let stars = [];

  /* Thruster trail timer */
  let thrusterTimer = 0;

  /* Rendering */
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;

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
    for (let i = 0; i < 80; ++i)
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        speed: 20 + Math.random() * 60,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7
      });
  }

  /* ── Persistence ── */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(finalScore, finalWave) {
    highScores.push({ score: finalScore, wave: finalWave });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveData();
  }

  /* ── Wave Spawning ── */
  function startWave() {
    isBossWave = waveNumber % 5 === 0;

    if (isBossWave) {
      // Boss wave: no regular enemies, spawn boss after warning
      waveTotalEnemies = 0;
      waveSpawnCount = 0;
      waveEnemiesLeft = 0;
      waveSpawnTimer = 0;
      waveDelay = 0;
      bossWarningTimer = 2;
      bossVictoryTimer = 0;
      boss = null;
      return;
    }

    const count = Math.min(3 + waveNumber * 2 + Math.floor(waveNumber / 5), 40);
    waveTotalEnemies = count;
    waveSpawnCount = 0;
    waveEnemiesLeft = count;
    waveSpawnTimer = 0;
    waveDelay = 0;
  }

  function _createEnemy(type, x, y, extraProps) {
    const def = ENEMY_TYPES[type];
    const waveSpeedBonus = Math.min(waveNumber * 8, 80);
    const hpBonus = type === 'juggernaut' ? Math.floor(waveNumber / 4) * 2
      : type === 'carrier' ? Math.floor(waveNumber / 5)
      : 0;

    // Determine spawn edge and position if not explicitly provided
    const edge = (extraProps && extraProps.spawnEdge) || (x != null ? 'top' : _pickSpawnEdge());
    let spawnPos;
    if (x != null && y != null)
      spawnPos = { x, y };
    else if (x != null)
      spawnPos = { x, y: -20 - Math.random() * 40 };
    else
      spawnPos = _spawnPositionForEdge(edge);

    // Pick path pattern for non-special types
    const pattern = (extraProps && extraProps.pathPattern) || _pickPathPattern();

    const enemy = {
      x: spawnPos.x,
      y: spawnPos.y,
      type,
      hp: def.hp + hpBonus,
      maxHp: def.hp + hpBonus,
      speed: def.speed + waveSpeedBonus,
      size: def.size,
      color: def.color,
      score: def.score,
      canShoot: def.canShoot,
      fireTimer: 1 + Math.random() * ENEMY_FIRE_INTERVAL,
      movePhase: Math.random() * Math.PI * 2,
      targetY: type === 'sniper' ? 30 + Math.random() * 60
        : type === 'dart' ? CANVAS_H + 50
        : type === 'minelayer' ? 40 + Math.random() * (CANVAS_H * 0.3)
        : 40 + Math.random() * (CANVAS_H * 0.4),
      targetX: CANVAS_W / 2 + (Math.random() - 0.5) * (CANVAS_W * 0.6),
      spawnTimer: type === 'carrier' ? 3 + Math.random() * 2 : 0,
      hitTimer: 0,
      // Spawn/path fields
      spawnEdge: edge,
      pathPattern: pattern,
      pathTime: 0,
      originX: spawnPos.x,
      originY: spawnPos.y,
      // Cloaker fields
      cloakTimer: 0,
      visible: true,
      // Minelayer fields
      mineDropTimer: type === 'minelayer' ? 3 : 0,
      // Swarm fields
      swarmOffset: 0,
      // Shield bearer fields
      shieldActive: !!def.shieldAura
    };

    if (extraProps)
      Object.assign(enemy, extraProps);

    return enemy;
  }

  /* ── Spawn edges ── */
  const SPAWN_EDGES = ['top', 'left', 'right', 'bottom'];

  /* ── Path patterns for enemy movement ── */
  const PATH_PATTERNS = ['straight', 'sine', 'zigzag', 'arc', 'dive'];

  function _pickSpawnEdge() {
    // Top is most common; sides and bottom unlock at higher waves
    if (waveNumber < 3)
      return 'top';
    const roll = Math.random();
    if (roll < 0.4) return 'top';
    if (roll < 0.6) return 'left';
    if (roll < 0.8) return 'right';
    return waveNumber >= 5 ? 'bottom' : 'top';
  }

  function _spawnPositionForEdge(edge) {
    if (edge === 'top')
      return { x: 30 + Math.random() * (CANVAS_W - 60), y: -20 - Math.random() * 40 };
    if (edge === 'left')
      return { x: -20 - Math.random() * 40, y: 30 + Math.random() * (CANVAS_H * 0.6) };
    if (edge === 'right')
      return { x: CANVAS_W + 20 + Math.random() * 40, y: 30 + Math.random() * (CANVAS_H * 0.6) };
    // bottom
    return { x: 30 + Math.random() * (CANVAS_W - 60), y: CANVAS_H + 20 + Math.random() * 40 };
  }

  function _pickPathPattern() {
    if (waveNumber < 2)
      return 'straight';
    return PATH_PATTERNS[Math.floor(Math.random() * PATH_PATTERNS.length)];
  }

  /* ── Formation patterns ── */
  const FORMATION_PATTERNS = ['v', 'ring', 'line', 'diamond'];

  function _getFormation(pattern, count, centerX, startY) {
    const positions = [];
    if (pattern === 'v') {
      // V-formation: leader at front, wings spread back
      for (let i = 0; i < count; ++i) {
        const side = i % 2 === 0 ? 1 : -1;
        const rank = Math.ceil(i / 2);
        positions.push({
          x: centerX + side * rank * 25,
          y: startY - rank * 20
        });
      }
    } else if (pattern === 'ring') {
      // Ring formation: circular arrangement
      for (let i = 0; i < count; ++i) {
        const angle = (i / count) * Math.PI * 2;
        positions.push({
          x: centerX + Math.cos(angle) * 40,
          y: startY + Math.sin(angle) * 30
        });
      }
    } else if (pattern === 'line') {
      // Line wave: horizontal spread
      const spacing = Math.min(40, (CANVAS_W - 100) / count);
      const startX = centerX - ((count - 1) * spacing) / 2;
      for (let i = 0; i < count; ++i)
        positions.push({
          x: startX + i * spacing,
          y: startY - Math.sin(i * 0.5) * 10
        });
    } else if (pattern === 'diamond') {
      // Diamond formation
      const half = Math.floor(count / 2);
      for (let i = 0; i < count; ++i) {
        const row = i <= half ? i : count - 1 - i;
        const offset = (i <= half ? i - half / 2 : (count - 1 - i) - half / 2) * 30;
        positions.push({
          x: centerX + offset,
          y: startY - i * 18
        });
      }
    }
    return positions;
  }

  function spawnEnemy() {
    const pool = [];
    for (const [name, def] of Object.entries(ENEMY_TYPES))
      if (waveNumber >= def.minWave)
        pool.push(name);

    const type = pool[Math.floor(Math.random() * pool.length)];

    // Swarm spawns 4-6 at once in formation
    if (type === 'swarm') {
      const count = 4 + Math.floor(Math.random() * 3);
      const baseX = 60 + Math.random() * (CANVAS_W - 120);
      const baseY = -20;
      const groupPhase = Math.random() * Math.PI * 2;
      for (let s = 0; s < count; ++s) {
        const enemy = _createEnemy(type, baseX + (s - count / 2) * 20, baseY - s * 15);
        enemy.swarmOffset = groupPhase + s * 0.5;
        enemies.push(enemy);
        if (s > 0)
          ++waveEnemiesLeft;
      }
      return;
    }

    // Formation spawning: higher waves use formation patterns more often
    const useFormation = waveNumber >= 3 && Math.random() < Math.min(0.5, waveNumber * 0.05);
    if (useFormation) {
      // Select formation based on wave number for variety
      const pattern = FORMATION_PATTERNS[waveNumber % FORMATION_PATTERNS.length];
      // Pick count based on enemy type: lighter = more, heavier = fewer
      const def = ENEMY_TYPES[type];
      const formationCount = def.hp <= 2 ? 3 + Math.floor(Math.random() * 3)
        : def.hp <= 4 ? 2 + Math.floor(Math.random() * 2)
        : 2;
      const centerX = 80 + Math.random() * (CANVAS_W - 160);
      const positions = _getFormation(pattern, formationCount, centerX, -20);
      for (let f = 0; f < positions.length; ++f) {
        const enemy = _createEnemy(type, positions[f].x, positions[f].y);
        enemies.push(enemy);
        if (f > 0)
          ++waveEnemiesLeft;
      }
      return;
    }

    enemies.push(_createEnemy(type));
  }

  /* ── Firing ── */
  function fireWeapon() {
    if (state !== STATE_PLAYING || fireCooldown > 0)
      return;

    const cooldownMult = Math.pow(0.8, pUpgrades.fireRate);
    fireCooldown = WEAPON_COOLDOWNS[currentWeapon] * cooldownMult;
    const px = player.x;
    const py = player.y;
    const baseDamage = 1 + pUpgrades.damageUp;
    const extra = pUpgrades.extraShots;

    if (currentWeapon === 'spread') {
      const baseAngles = [-0.2, 0, 0.2];
      for (let e = 0; e <= extra; ++e) {
        const offset = e * 0.12;
        for (const angle of baseAngles) {
          const a = angle + (e % 2 === 0 ? offset : -offset);
          bullets.push({ x: px, y: py - PLAYER_SIZE, vx: Math.sin(a) * BULLET_SPEED, vy: -Math.cos(a) * BULLET_SPEED, type: 'spread', damage: baseDamage });
        }
      }
    } else if (currentWeapon === 'laser') {
      for (let e = 0; e <= extra; ++e) {
        const ox = (e - extra / 2) * 6;
        bullets.push({ x: px + ox, y: py - PLAYER_SIZE, vx: 0, vy: -BULLET_SPEED * 1.5, type: 'laser', damage: baseDamage });
      }
    } else if (currentWeapon === 'missile') {
      for (let e = 0; e <= extra; ++e) {
        const ox = (e - extra / 2) * 10;
        bullets.push({ x: px + ox, y: py - PLAYER_SIZE, vx: ox * 2, vy: -MISSILE_SPEED, type: 'missile', damage: baseDamage + 2, homing: true });
      }
    } else if (currentWeapon === 'plasma') {
      bullets.push({ x: px, y: py - PLAYER_SIZE, vx: 0, vy: -PLASMA_SPEED, type: 'plasma', damage: baseDamage + 3, aoe: true, aoeRadius: PLASMA_RADIUS + extra * 10 });
    } else if (currentWeapon === 'beam') {
      for (let e = 0; e <= extra; ++e) {
        const ox = (e - extra / 2) * 4;
        bullets.push({ x: px + ox, y: py - PLAYER_SIZE, vx: 0, vy: -BULLET_SPEED * 2, type: 'beam', damage: baseDamage, piercing: true });
      }
    } else if (currentWeapon === 'shotgun') {
      const sizeMult = 1 + pUpgrades.bulletSize * 0.2;
      for (let p = 0; p < SHOTGUN_PELLETS + extra; ++p) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * SHOTGUN_SPREAD * 2;
        bullets.push({
          x: px, y: py - PLAYER_SIZE,
          vx: Math.cos(angle) * SHOTGUN_SPEED,
          vy: Math.sin(angle) * SHOTGUN_SPEED,
          type: 'shotgun', damage: baseDamage + 1,
          fadeTimer: SHOTGUN_FADE_TIME,
          size: 3 * sizeMult
        });
      }
    } else if (currentWeapon === 'lightning') {
      const sizeMult = 1 + pUpgrades.bulletSize * 0.2;
      for (let e = 0; e <= extra; ++e) {
        const ox = (e - extra / 2) * 6;
        bullets.push({
          x: px + ox, y: py - PLAYER_SIZE,
          vx: 0, vy: -LIGHTNING_SPEED,
          type: 'lightning', damage: baseDamage + 1,
          chainCount: LIGHTNING_CHAIN_COUNT,
          chainTargets: [],
          size: 4 * sizeMult
        });
      }
    } else if (currentWeapon === 'flak') {
      const sizeMult = 1 + pUpgrades.bulletSize * 0.2;
      for (let e = 0; e <= extra; ++e) {
        const ox = (e - extra / 2) * 8;
        bullets.push({
          x: px + ox, y: py - PLAYER_SIZE,
          vx: ox * 0.5, vy: -FLAK_SPEED,
          type: 'flak', damage: baseDamage,
          detonateTimer: FLAK_DETONATE_TIME,
          detonated: false,
          size: 5 * sizeMult
        });
      }
    } else if (currentWeapon === 'railgun') {
      const sizeMult = 1 + pUpgrades.bulletSize * 0.2;
      bullets.push({
        x: px, y: py - PLAYER_SIZE,
        vx: 0, vy: -RAILGUN_SPEED,
        type: 'railgun', damage: baseDamage + 5,
        piercing: true,
        trailX: px, trailY: py - PLAYER_SIZE,
        size: 3 * sizeMult
      });
      // Add visual trail
      railTrails.push({ x: px, y1: py - PLAYER_SIZE, y2: py - PLAYER_SIZE, timer: RAILGUN_TRAIL_DURATION });
    }
  }

  /* ── Collision Helpers ── */
  function circleOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }

  /* ── Enemy shooting ── */
  function enemyFire(enemy) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    enemyBullets.push({
      x: enemy.x,
      y: enemy.y + enemy.size,
      vx: (dx / dist) * ENEMY_BULLET_SPEED,
      vy: (dy / dist) * ENEMY_BULLET_SPEED
    });
  }

  /* ── Player Hit ── */
  function playerHit() {
    if (shieldHP > 0) {
      --shieldHP;
      screenShake.trigger(4, 200);
      particles.burst(player.x, player.y, 10, { color: '#00bfff', speed: 3, life: 0.5, size: 2, decay: 0.02 });
      return;
    }

    --lives;
    screenShake.trigger(8, 400);
    particles.burst(player.x, player.y, 20, { color: '#f44', speed: 5, life: 0.8, size: 3, decay: 0.02 });

    if (lives <= 0) {
      state = STATE_DEAD;
      addHighScore(Math.floor(score), waveNumber);
    } else {
      // Brief invulnerability handled by shield recharge
      shieldHP = 1;
    }
    updateStatus();
  }

  /* ── Enemy Destroyed ── */
  function destroyEnemy(enemy, idx) {
    const burstCount = Math.max(15, enemy.size);
    particles.burst(enemy.x, enemy.y, burstCount, { color: enemy.color, speed: 4, life: 0.6, size: 3, decay: 0.02 });
    particles.burst(enemy.x, enemy.y, 8, { color: '#ffd700', speed: 3, life: 0.4, size: 2, decay: 0.03 });
    screenShake.trigger(Math.min(3 + (enemy.maxHp || 1), 8), 150);

    ++streak;
    streakTimer = STREAK_TIMEOUT;
    multiplier = Math.min(streak, MAX_MULTIPLIER);

    const points = enemy.score * multiplier;
    score += points;
    floatingText.add(enemy.x, enemy.y, '+' + points + (multiplier > 1 ? ' x' + multiplier : ''), { color: '#ffd700', decay: 0.025 });

    // Drop: weapon pickup (12%) or persistent upgrade (10%)
    const dropRoll = Math.random();
    if (dropRoll < 0.12) {
      const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
      upgrades.push({ x: enemy.x, y: enemy.y, type, kind: 'weapon', life: UPGRADE_LIFETIME });
    } else if (dropRoll < 0.22) {
      const available = UPGRADE_TYPES_PERSISTENT.filter(u => pUpgrades[u] < MAX_UPGRADE_LEVEL);
      if (available.length > 0) {
        const type = available[Math.floor(Math.random() * available.length)];
        upgrades.push({ x: enemy.x, y: enemy.y, type, kind: 'persistent', life: UPGRADE_LIFETIME });
      }
    }

    enemies.splice(idx, 1);
    --waveEnemiesLeft;
  }

  /* ── Boss System ── */
  function spawnBoss() {
    const bossIdx = Math.floor((waveNumber / 5 - 1) % BOSS_TYPES.length);
    const def = BOSS_TYPES[bossIdx];
    const cycle = Math.floor((waveNumber / 5 - 1) / BOSS_TYPES.length);
    const hpScale = 1 + 0.6 * cycle + 0.1 * cycle * cycle;
    const shieldScale = 1 + 0.5 * cycle;
    const maxShield = Math.floor((def.shieldHP || 0) * shieldScale);
    boss = {
      x: CANVAS_W / 2,
      y: -60,
      hp: Math.floor(def.baseHP * hpScale),
      maxHp: Math.floor(def.baseHP * hpScale),
      size: def.size,
      color: def.color,
      name: def.name,
      score: def.score,
      attacks: def.attacks,
      attackTimer: 2,
      attackIdx: 0,
      movePhase: 0,
      enraged: false,
      targetY: 80,
      alive: true,
      // Shield mechanic
      shield: maxShield,
      maxShield,
      shieldRegenDelay: def.shieldRegenDelay || 5,
      shieldRegenRate: def.shieldRegenRate || 10,
      shieldDownTimer: 0,
      // Spiral burst tracking
      spiralAngle: 0
    };
  }

  function updateBoss(dt) {
    if (!boss || !boss.alive)
      return;

    // Move boss into position
    if (boss.y < boss.targetY)
      boss.y += 60 * dt;
    else {
      boss.movePhase += dt * 1.5;
      boss.x = CANVAS_W / 2 + Math.sin(boss.movePhase) * (CANVAS_W * 0.3);
    }

    boss.x = Math.max(boss.size, Math.min(CANVAS_W - boss.size, boss.x));

    // Shield regeneration
    if (boss.maxShield > 0) {
      if (boss.shield <= 0)
        boss.shieldDownTimer += dt;
      if (boss.shieldDownTimer >= boss.shieldRegenDelay && boss.shield < boss.maxShield) {
        boss.shield = Math.min(boss.maxShield, boss.shield + boss.shieldRegenRate * dt);
        if (boss.shield >= boss.maxShield)
          floatingText.add(boss.x, boss.y - boss.size - 10, 'SHIELD RESTORED', { color: '#4af', decay: 0.02 });
      }
    }

    // Enrage at 50% HP
    if (!boss.enraged && boss.hp <= boss.maxHp * 0.5) {
      boss.enraged = true;
      screenShake.trigger(10, 500);
      floatingText.add(boss.x, boss.y + boss.size + 20, 'ENRAGED!', { color: '#f44', decay: 0.02 });
    }

    // Spiral angle always advances for spiral burst pattern
    boss.spiralAngle += dt * 3;

    const attackSpeed = boss.enraged ? 1.5 : 1;
    boss.attackTimer -= dt * attackSpeed;

    if (boss.attackTimer <= 0 && boss.y >= boss.targetY) {
      const attack = boss.attacks[boss.attackIdx % boss.attacks.length];
      boss.attackIdx = (boss.attackIdx + 1) % boss.attacks.length;
      boss.attackTimer = boss.enraged ? 1.5 : 2.5;

      if (attack === 'aimedBurst') {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        for (let i = -1; i <= 1; ++i) {
          const spread = i * 0.15;
          enemyBullets.push({
            x: boss.x, y: boss.y + boss.size,
            vx: (dx / dist) * ENEMY_BULLET_SPEED * 1.2 + Math.sin(spread) * 50,
            vy: (dy / dist) * ENEMY_BULLET_SPEED * 1.2 + Math.cos(spread) * 50,
            boss: true
          });
        }
      } else if (attack === 'sweepArc') {
        for (let a = -0.6; a <= 0.6; a += 0.15)
          enemyBullets.push({
            x: boss.x, y: boss.y + boss.size,
            vx: Math.sin(a) * ENEMY_BULLET_SPEED,
            vy: Math.cos(a) * ENEMY_BULLET_SPEED,
            boss: true
          });
      } else if (attack === 'laserBeam') {
        for (let i = 0; i < 5; ++i)
          enemyBullets.push({
            x: boss.x + (Math.random() - 0.5) * 20,
            y: boss.y + boss.size,
            vx: 0, vy: ENEMY_BULLET_SPEED * 1.5 + i * 20,
            boss: true
          });
      } else if (attack === 'missileSalvo') {
        for (let i = 0; i < 8; ++i) {
          const angle = (i / 8) * Math.PI * 2;
          enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.sin(angle) * ENEMY_BULLET_SPEED * 0.8,
            vy: Math.cos(angle) * ENEMY_BULLET_SPEED * 0.8,
            boss: true
          });
        }
      } else if (attack === 'spawnMinions') {
        for (let i = 0; i < 3; ++i) {
          const minion = _createEnemy('scout', boss.x + (i - 1) * 30, boss.y + boss.size);
          minion.speed = 200;
          enemies.push(minion);
        }
      } else if (attack === 'bulletRing') {
        for (let i = 0; i < 12; ++i) {
          const angle = (i / 12) * Math.PI * 2;
          enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.sin(angle) * ENEMY_BULLET_SPEED,
            vy: Math.cos(angle) * ENEMY_BULLET_SPEED,
            boss: true
          });
        }
      } else if (attack === 'spiralBurst') {
        // Fire bullets in a rotating spiral pattern
        const arms = boss.enraged ? 4 : 3;
        const bulletsPerArm = 3;
        for (let arm = 0; arm < arms; ++arm) {
          const baseAngle = boss.spiralAngle + (arm / arms) * Math.PI * 2;
          for (let b = 0; b < bulletsPerArm; ++b) {
            const angle = baseAngle + b * 0.2;
            const speed = ENEMY_BULLET_SPEED * (0.7 + b * 0.15);
            enemyBullets.push({
              x: boss.x, y: boss.y,
              vx: Math.sin(angle) * speed,
              vy: Math.cos(angle) * speed,
              boss: true
            });
          }
        }
      } else if (attack === 'crossBeams') {
        // Fire 4 beams in a cross pattern (cardinal directions) plus diagonals when enraged
        const directions = [
          { vx: 0, vy: 1 }, { vx: 0, vy: -1 },
          { vx: 1, vy: 0 }, { vx: -1, vy: 0 }
        ];
        if (boss.enraged)
          directions.push(
            { vx: 0.707, vy: 0.707 }, { vx: -0.707, vy: 0.707 },
            { vx: 0.707, vy: -0.707 }, { vx: -0.707, vy: -0.707 }
          );
        for (const dir of directions)
          for (let i = 0; i < 4; ++i)
            enemyBullets.push({
              x: boss.x + dir.vx * i * 12,
              y: boss.y + dir.vy * i * 12,
              vx: dir.vx * ENEMY_BULLET_SPEED * 1.3,
              vy: dir.vy * ENEMY_BULLET_SPEED * 1.3,
              boss: true
            });
      } else if (attack === 'mineDeployment') {
        // Deploy mines around the arena
        const count = boss.enraged ? 6 : 4;
        for (let i = 0; i < count; ++i) {
          mines.push({
            x: 50 + Math.random() * (CANVAS_W - 100),
            y: boss.y + boss.size + 20 + Math.random() * (CANVAS_H * 0.4),
            triggerRadius: 50,
            damageRadius: 70,
            armed: false,
            armTimer: 1.0,
            life: 10
          });
        }
        particles.burst(boss.x, boss.y + boss.size, 10, { color: '#f80', speed: 3, life: 0.4, size: 2, decay: 0.03 });
      }
    }

    // Boss-player collision
    if (circleOverlap(boss.x, boss.y, boss.size, player.x, player.y, PLAYER_SIZE)) {
      playerHit();
      if (state === STATE_DEAD)
        return;
    }
  }

  function drawBoss() {
    if (!boss || !boss.alive)
      return;

    ctx.save();

    // Boss body
    const drawColor = boss.enraged ? '#ff2222' : boss.color;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = 15;

    // Outer hull
    const grad = ctx.createRadialGradient(boss.x, boss.y, 0, boss.x, boss.y, boss.size);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, drawColor);
    grad.addColorStop(1, '#222');
    ctx.fillStyle = grad;
    ctx.beginPath();
    // Octagon shape for bosses
    for (let i = 0; i < 8; ++i) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = boss.x + Math.cos(angle) * boss.size;
      const py = boss.y + Math.sin(angle) * boss.size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Inner detail
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    for (let i = 0; i < 8; ++i) {
      const angle = (i / 8) * Math.PI * 2;
      const px = boss.x + Math.cos(angle) * boss.size * 0.5;
      const py = boss.y + Math.sin(angle) * boss.size * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Enrage glow pulse
    if (boss.enraged) {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 100);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Shield visual arc around boss
    if (boss.maxShield > 0 && boss.shield > 0) {
      const shieldRatio = boss.shield / boss.maxShield;
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(Date.now() / 200);
      ctx.strokeStyle = '#4af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.size + 12, 0, Math.PI * 2 * shieldRatio);
      ctx.stroke();
      // Shield shimmer fill
      ctx.globalAlpha = 0.08 + 0.05 * Math.sin(Date.now() / 150);
      ctx.fillStyle = '#4af';
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.size + 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // HP bar at top of screen
    ctx.save();
    const barW = CANVAS_W * 0.6;
    const barH = 10;
    const barX = (CANVAS_W - barW) / 2;
    const barY = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4 + (boss.maxShield > 0 ? 8 : 0));
    ctx.fillStyle = '#400';
    ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = boss.hp / boss.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    // Shield bar below HP bar
    if (boss.maxShield > 0) {
      const shieldBarY = barY + barH + 2;
      const shieldBarH = 5;
      ctx.fillStyle = '#024';
      ctx.fillRect(barX, shieldBarY, barW, shieldBarH);
      const shieldRatio = Math.max(0, boss.shield / boss.maxShield);
      ctx.fillStyle = '#4af';
      ctx.fillRect(barX, shieldBarY, barW * shieldRatio, shieldBarH);
    }
    // Boss name label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const labelY = barY + barH + (boss.maxShield > 0 ? 20 : 14);
    ctx.fillText(boss.name + (boss.enraged ? ' [ENRAGED]' : '') + (boss.shield > 0 ? ' [SHIELDED]' : ''), CANVAS_W / 2, labelY);
    ctx.restore();
  }

  function bossDefeated() {
    const points = boss.score * multiplier;
    score += points;
    floatingText.add(boss.x, boss.y, 'BOSS DEFEATED +' + points, { color: '#ffd700', decay: 0.01 });
    particles.burst(boss.x, boss.y, 40, { color: boss.color, speed: 6, life: 1, size: 4, decay: 0.015 });
    particles.burst(boss.x, boss.y, 25, { color: '#ffd700', speed: 5, life: 0.8, size: 3, decay: 0.02 });
    screenShake.trigger(12, 600);
    boss.alive = false;
    bossVictoryTimer = 3;
  }

  /* ── Reset ── */
  function resetGame() {
    state = STATE_READY;
    score = 0;
    lives = MAX_LIVES;
    waveNumber = 1;
    player.x = CANVAS_W / 2;
    player.y = CANVAS_H - 60;
    player.dx = 0;
    shieldHP = SHIELD_MAX_HP;
    currentWeapon = 'spread';
    fireCooldown = 0;
    mouseDown = false;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    upgrades = [];
    streak = 0;
    streakTimer = 0;
    multiplier = 1;
    pUpgrades = { extraShots: 0, damageUp: 0, speedUp: 0, fireRate: 0, shieldUp: 0, bulletSize: 0, magnetRange: 0 };
    waveEnemiesLeft = 0;
    waveSpawnTimer = 0;
    waveSpawnCount = 0;
    waveTotalEnemies = 0;
    waveDelay = 0;
    thrusterTimer = 0;
    mines = [];
    railTrails = [];
    boss = null;
    bossWarningTimer = 0;
    bossVictoryTimer = 0;
    isBossWave = false;
    particles.clear();
    floatingText.clear();
    updateStatus();
    SZ.Dlls.User32.SetWindowText('Space Combat');
  }

  /* ── Update ── */
  function update(dt) {
    if (state === STATE_READY || state === STATE_PAUSED || state === STATE_DEAD) {
      screenShake.update(dt * 1000);
      particles.update();
      floatingText.update();
      return;
    }

    if (state !== STATE_PLAYING)
      return;

    // Player movement (8-directional)
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA'])
      dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD'])
      dx += 1;
    if (keys['ArrowUp'] || keys['KeyW'])
      dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS'])
      dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    player.dx = dx;
    const effectiveSpeed = PLAYER_SPEED + pUpgrades.speedUp * 50;
    player.x += dx * effectiveSpeed * dt;
    player.y += dy * effectiveSpeed * dt;
    player.x = Math.max(PLAYER_SIZE, Math.min(CANVAS_W - PLAYER_SIZE, player.x));
    player.y = Math.max(PLAYER_SIZE, Math.min(CANVAS_H - PLAYER_SIZE, player.y));

    // Thruster trail particles
    thrusterTimer += dt;
    if (thrusterTimer > 0.03) {
      thrusterTimer = 0;
      particles.burst(
        player.x + (Math.random() - 0.5) * 6,
        player.y + PLAYER_SIZE,
        1,
        { color: '#ff6600', speed: 1.5, life: 0.3, size: 2, decay: 0.04 }
      );
    }

    // Fire cooldown
    if (fireCooldown > 0)
      fireCooldown = Math.max(0, fireCooldown - dt);

    // Auto-fire if holding key or mouse button
    if (keys['Space'] || keys['KeyZ'] || mouseDown)
      fireWeapon();

    // Streak decay
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0) {
        streak = 0;
        multiplier = 1;
      }
    }

    // Update player bullets
    for (let i = bullets.length - 1; i >= 0; --i) {
      const b = bullets[i];

      // Homing missile tracking
      if (b.homing && enemies.length > 0) {
        let closest = null;
        let closeDist = Infinity;
        for (const e of enemies) {
          const d = Math.sqrt((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
          if (d < closeDist) {
            closeDist = d;
            closest = e;
          }
        }
        if (closest) {
          const tdx = closest.x - b.x;
          const tdy = closest.y - b.y;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
          b.vx += (tdx / tlen) * MISSILE_TURN_RATE * dt * 100;
          b.vy += (tdy / tlen) * MISSILE_TURN_RATE * dt * 100;
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
          b.vx = (b.vx / spd) * MISSILE_SPEED;
          b.vy = (b.vy / spd) * MISSILE_SPEED;
        }
      }

      // Shotgun fade timer
      if (b.type === 'shotgun') {
        b.fadeTimer -= dt;
        if (b.fadeTimer <= 0) {
          bullets.splice(i, 1);
          continue;
        }
      }

      // Flak detonation timer
      if (b.type === 'flak' && !b.detonated) {
        b.detonateTimer -= dt;
        if (b.detonateTimer <= 0) {
          b.detonated = true;
          // Spawn fragments in 360 spread
          for (let f = 0; f < FLAK_FRAGMENT_COUNT; ++f) {
            const angle = (f / FLAK_FRAGMENT_COUNT) * Math.PI * 2;
            bullets.push({
              x: b.x, y: b.y,
              vx: Math.cos(angle) * FLAK_SPEED * 0.8,
              vy: Math.sin(angle) * FLAK_SPEED * 0.8,
              type: 'flak_fragment', damage: 1,
              fadeTimer: 0.4,
              size: 2
            });
          }
          particles.burst(b.x, b.y, 8, { color: '#f80', speed: 3, life: 0.3, size: 2, decay: 0.04 });
          bullets.splice(i, 1);
          continue;
        }
      }

      // Flak fragment fade
      if (b.type === 'flak_fragment') {
        b.fadeTimer -= dt;
        if (b.fadeTimer <= 0) {
          bullets.splice(i, 1);
          continue;
        }
      }

      // Railgun trail update
      if (b.type === 'railgun')
        b.trailY = Math.min(b.trailY, b.y);

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Off-screen cleanup
      if (b.y < -20 || b.y > CANVAS_H + 20 || b.x < -20 || b.x > CANVAS_W + 20) {
        bullets.splice(i, 1);
        continue;
      }

      // Determine bullet hitbox size
      const bulletRadius = b.type === 'plasma' ? 8 : b.size ? b.size : 4;

      // Collision with enemies
      let bulletConsumed = false;
      for (let j = enemies.length - 1; j >= 0; --j) {
        const e = enemies[j];

        // Cloaker immunity: invisible cloakers immune to non-AoE
        if (e.type === 'cloaker' && !e.visible && !b.aoe)
          continue;

        // Shield bearer damage reduction for nearby enemies
        let dmgMult = 1;
        if (e.type !== 'shieldbearer') {
          for (const other of enemies) {
            if (other.shieldActive && other.type === 'shieldbearer') {
              const sdx = e.x - other.x, sdy = e.y - other.y;
              if (sdx * sdx + sdy * sdy < 80 * 80) {
                dmgMult = 0.5;
                break;
              }
            }
          }
        }

        if (circleOverlap(b.x, b.y, bulletRadius, e.x, e.y, e.size)) {
          if (b.aoe) {
            // Plasma AOE: damage all enemies in radius
            particles.burst(b.x, b.y, 20, { color: '#a0f', speed: 5, life: 0.6, size: 4, decay: 0.02 });
            screenShake.trigger(5, 200);
            for (let k = enemies.length - 1; k >= 0; --k) {
              const t = enemies[k];
              const adx = t.x - b.x, ady = t.y - b.y;
              if (adx * adx + ady * ady < b.aoeRadius * b.aoeRadius) {
                t.hp -= b.damage;
                t.hitTimer = 0.15;
                if (t.hp <= 0)
                  destroyEnemy(t, k);
                else
                  particles.burst(t.x, t.y, 4, { color: '#fff', speed: 2, life: 0.2, size: 1, decay: 0.05 });
              }
            }
            bulletConsumed = true;
            break;
          }

          const actualDmg = Math.max(1, Math.floor(b.damage * dmgMult));
          e.hp -= actualDmg;
          e.hitTimer = 0.15;

          // Lightning chain effect
          if (b.type === 'lightning' && b.chainCount > 0) {
            let chainDmg = actualDmg * LIGHTNING_CHAIN_DECAY;
            let lastX = e.x, lastY = e.y;
            const chained = [j];
            for (let c = 0; c < b.chainCount; ++c) {
              let closestIdx = -1;
              let closestDist = LIGHTNING_CHAIN_RANGE;
              for (let k = 0; k < enemies.length; ++k) {
                if (chained.includes(k))
                  continue;
                const cdx = enemies[k].x - lastX, cdy = enemies[k].y - lastY;
                const cd = Math.sqrt(cdx * cdx + cdy * cdy);
                if (cd < closestDist) {
                  closestDist = cd;
                  closestIdx = k;
                }
              }
              if (closestIdx >= 0) {
                const ce = enemies[closestIdx];
                ce.hp -= Math.max(1, Math.floor(chainDmg));
                ce.hitTimer = 0.15;
                particles.burst(ce.x, ce.y, 4, { color: '#fff', speed: 2, life: 0.2, size: 1, decay: 0.05 });
                b.chainTargets.push({ x1: lastX, y1: lastY, x2: ce.x, y2: ce.y, timer: 0.15 });
                chained.push(closestIdx);
                lastX = ce.x;
                lastY = ce.y;
                chainDmg *= LIGHTNING_CHAIN_DECAY;
                if (ce.hp <= 0)
                  destroyEnemy(ce, closestIdx);
              }
            }
          }

          if (!b.piercing)
            bulletConsumed = true;
          if (e.hp <= 0)
            destroyEnemy(e, j);
          else {
            particles.burst(e.x, e.y, 4, { color: '#fff', speed: 2, life: 0.2, size: 1, decay: 0.05 });
            screenShake.trigger(2, 80);
          }
          if (bulletConsumed)
            break;
        }
      }

      // Boss collision
      if (!bulletConsumed && boss && boss.alive && boss.y >= boss.targetY) {
        if (circleOverlap(b.x, b.y, bulletRadius, boss.x, boss.y, boss.size)) {
          // Shield absorbs damage first
          if (boss.shield > 0) {
            const absorbed = Math.min(boss.shield, b.damage);
            boss.shield -= absorbed;
            const remaining = b.damage - absorbed;
            if (remaining > 0)
              boss.hp -= remaining;
            particles.burst(b.x, b.y, 4, { color: '#4af', speed: 2, life: 0.2, size: 1, decay: 0.05 });
            if (boss.shield <= 0) {
              boss.shieldDownTimer = 0;
              floatingText.add(boss.x, boss.y - boss.size - 10, 'SHIELD BROKEN!', { color: '#f44', decay: 0.02 });
              screenShake.trigger(6, 300);
            }
          } else {
            boss.hp -= b.damage;
            particles.burst(b.x, b.y, 4, { color: '#fff', speed: 2, life: 0.2, size: 1, decay: 0.05 });
          }
          screenShake.trigger(2, 80);
          if (!b.piercing)
            bulletConsumed = true;
          if (boss.hp <= 0)
            bossDefeated();
        }
      }

      if (bulletConsumed)
        bullets.splice(i, 1);
    }

    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; --i) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y < -20 || b.y > CANVAS_H + 20 || b.x < -20 || b.x > CANVAS_W + 20) {
        enemyBullets.splice(i, 1);
        continue;
      }

      // Player hit detection
      if (circleOverlap(b.x, b.y, 3, player.x, player.y, PLAYER_SIZE)) {
        enemyBullets.splice(i, 1);
        playerHit();
        if (state === STATE_DEAD)
          return;
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      if (e.hitTimer > 0)
        e.hitTimer -= dt;

      // Type-specific movement AI
      if (e.type === 'dart') {
        // Dive toward player
        const ddx = player.x - e.x;
        const ddy = player.y - e.y;
        const ddist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        e.x += (ddx / ddist) * e.speed * dt;
        e.y += (ddy / ddist) * e.speed * dt;
      } else if (e.type === 'sniper') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 1.2;
          e.x += Math.sin(e.movePhase) * e.speed * 0.3 * dt;
        }
      } else if (e.type === 'carrier') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 0.8;
          e.x += Math.sin(e.movePhase) * e.speed * 0.4 * dt;
        }
        // Spawn mini scouts
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && e.y > 20) {
          e.spawnTimer = 3.5 + Math.random() * 2;
          enemies.push({
            x: e.x, y: e.y + e.size,
            type: 'scout', hp: 1, maxHp: 1,
            speed: 180 + Math.min(waveNumber * 8, 80),
            size: 10, color: '#e74c3c', score: 50,
            canShoot: false,
            fireTimer: 99, movePhase: Math.random() * Math.PI * 2,
            targetY: e.y + 40 + Math.random() * 80,
            spawnTimer: 0, hitTimer: 0
          });
          ++waveEnemiesLeft;
        }
      } else if (e.type === 'juggernaut') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 0.6;
          e.x += Math.sin(e.movePhase) * e.speed * 0.3 * dt;
        }
      } else if (e.type === 'cloaker') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 2.5;
          e.x += Math.sin(e.movePhase) * e.speed * 0.6 * dt;
          e.y += Math.cos(e.movePhase * 0.7) * e.speed * 0.2 * dt;
        }
        // Toggle visibility every 2s
        e.cloakTimer += dt;
        if (e.cloakTimer >= 2) {
          e.cloakTimer = 0;
          e.visible = !e.visible;
        }
      } else if (e.type === 'minelayer') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 1.5;
          e.x += Math.sin(e.movePhase) * e.speed * 0.8 * dt;
        }
        // Drop mines every 3s
        e.mineDropTimer -= dt;
        if (e.mineDropTimer <= 0 && e.y > 20) {
          e.mineDropTimer = 3;
          mines.push({
            x: e.x, y: e.y + e.size,
            triggerRadius: 40,
            damageRadius: 60,
            armed: false,
            armTimer: 0.5,
            life: 12
          });
        }
      } else if (e.type === 'swarm') {
        e.y += e.speed * 0.3 * dt;
        e.movePhase += dt * 4;
        e.x += Math.sin(e.movePhase + e.swarmOffset) * e.speed * 0.4 * dt;
      } else if (e.type === 'shieldbearer') {
        if (e.y < e.targetY)
          e.y += e.speed * dt;
        else {
          e.movePhase += dt * 0.8;
          e.x += Math.sin(e.movePhase) * e.speed * 0.3 * dt;
        }
      } else {
        // Default wander with path patterns: scout, fighter, bomber
        e.pathTime += dt;
        const edge = e.spawnEdge || 'top';
        const pat = e.pathPattern || 'straight';

        if (edge === 'top') {
          if (e.y < e.targetY)
            e.y += e.speed * dt;
          else {
            e.movePhase += dt * 2;
            if (pat === 'sine')
              e.x += Math.sin(e.movePhase) * e.speed * 0.8 * dt;
            else if (pat === 'zigzag') {
              const zigPeriod = Math.floor(e.pathTime * 2) % 2;
              e.x += (zigPeriod === 0 ? 1 : -1) * e.speed * 0.5 * dt;
            } else if (pat === 'arc') {
              const arcAngle = e.movePhase * 0.5;
              e.x += Math.cos(arcAngle) * e.speed * 0.4 * dt;
              e.y += Math.sin(arcAngle) * e.speed * 0.15 * dt;
            } else if (pat === 'dive') {
              if (e.pathTime > 1.5 && e.pathTime < 3)
                e.y += e.speed * 0.6 * dt;
              else if (e.pathTime >= 3 && e.pathTime < 4)
                e.y -= e.speed * 0.4 * dt;
              e.x += Math.sin(e.movePhase) * e.speed * 0.3 * dt;
            } else
              e.x += Math.sin(e.movePhase) * e.speed * 0.5 * dt;
          }
        } else if (edge === 'left') {
          if (e.x < (e.targetX || CANVAS_W * 0.4))
            e.x += e.speed * dt;
          else {
            e.movePhase += dt * 2;
            if (pat === 'sine')
              e.y += Math.sin(e.movePhase) * e.speed * 0.8 * dt;
            else if (pat === 'zigzag') {
              const zigPeriod = Math.floor(e.pathTime * 2) % 2;
              e.y += (zigPeriod === 0 ? 1 : -1) * e.speed * 0.5 * dt;
            } else if (pat === 'arc') {
              const arcAngle = e.movePhase * 0.5;
              e.y += Math.cos(arcAngle) * e.speed * 0.4 * dt;
              e.x += Math.sin(arcAngle) * e.speed * 0.15 * dt;
            } else
              e.y += Math.sin(e.movePhase) * e.speed * 0.5 * dt;
          }
        } else if (edge === 'right') {
          if (e.x > (e.targetX || CANVAS_W * 0.6))
            e.x -= e.speed * dt;
          else {
            e.movePhase += dt * 2;
            if (pat === 'sine')
              e.y += Math.sin(e.movePhase) * e.speed * 0.8 * dt;
            else if (pat === 'zigzag') {
              const zigPeriod = Math.floor(e.pathTime * 2) % 2;
              e.y += (zigPeriod === 0 ? 1 : -1) * e.speed * 0.5 * dt;
            } else if (pat === 'arc') {
              const arcAngle = e.movePhase * 0.5;
              e.y += Math.cos(arcAngle) * e.speed * 0.4 * dt;
              e.x -= Math.sin(arcAngle) * e.speed * 0.15 * dt;
            } else
              e.y += Math.sin(e.movePhase) * e.speed * 0.5 * dt;
          }
        } else {
          // bottom edge: move upward
          if (e.y > (e.targetY || CANVAS_H * 0.6))
            e.y -= e.speed * dt;
          else {
            e.movePhase += dt * 2;
            if (pat === 'sine')
              e.x += Math.sin(e.movePhase) * e.speed * 0.8 * dt;
            else if (pat === 'zigzag') {
              const zigPeriod = Math.floor(e.pathTime * 2) % 2;
              e.x += (zigPeriod === 0 ? 1 : -1) * e.speed * 0.5 * dt;
            } else
              e.x += Math.sin(e.movePhase) * e.speed * 0.5 * dt;
          }
        }
      }

      e.x = Math.max(e.size, Math.min(CANVAS_W - e.size, e.x));
      e.y = Math.max(-30, Math.min(CANVAS_H + 60, e.y));

      // Enemy firing (type-specific) -- allow fire once on-screen
      if (e.canShoot && e.x > 10 && e.x < CANVAS_W - 10 && e.y > 10 && e.y < CANVAS_H - 10) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          if (e.type === 'sniper') {
            e.fireTimer = 2.5 + Math.random() * 1.5;
            const sdx = player.x - e.x;
            const sdy = player.y - e.y;
            const sdist = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
            enemyBullets.push({
              x: e.x, y: e.y + e.size,
              vx: (sdx / sdist) * ENEMY_BULLET_SPEED * 1.5,
              vy: (sdy / sdist) * ENEMY_BULLET_SPEED * 1.5
            });
          } else if (e.type === 'juggernaut') {
            e.fireTimer = ENEMY_FIRE_INTERVAL * (0.8 + Math.random() * 0.4);
            for (const angle of [-0.3, 0, 0.3])
              enemyBullets.push({
                x: e.x, y: e.y + e.size,
                vx: Math.sin(angle) * ENEMY_BULLET_SPEED,
                vy: Math.cos(angle) * ENEMY_BULLET_SPEED
              });
          } else {
            e.fireTimer = ENEMY_FIRE_INTERVAL * (0.7 + Math.random() * 0.6);
            enemyFire(e);
          }
        }
      }

      // Enemy-player collision
      if (circleOverlap(e.x, e.y, e.size, player.x, player.y, PLAYER_SIZE)) {
        destroyEnemy(e, i);
        playerHit();
        if (state === STATE_DEAD)
          return;
      }

      // Remove enemies that drifted off-screen (any edge, after reaching play area)
      if (e.pathTime > 3 && (e.y > CANVAS_H + 50 || e.y < -60 || e.x < -60 || e.x > CANVAS_W + 60)) {
        enemies.splice(i, 1);
        --waveEnemiesLeft;
      }
    }

    // Update upgrades
    for (let i = upgrades.length - 1; i >= 0; --i) {
      const u = upgrades[i];
      u.y += UPGRADE_SPEED * dt;
      u.life -= dt;

      if (u.life <= 0 || u.y > CANVAS_H + 20) {
        upgrades.splice(i, 1);
        continue;
      }

      // Magnet: pickups gravitate toward player
      const magnetDist = pUpgrades.magnetRange * 50;
      if (magnetDist > 0) {
        const mdx = player.x - u.x;
        const mdy = player.y - u.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < magnetDist && md > 1) {
          const pull = 200 * dt;
          u.x += (mdx / md) * pull;
          u.y += (mdy / md) * pull;
        }
      }

      // Pickup
      if (circleOverlap(u.x, u.y, UPGRADE_SIZE, player.x, player.y, PLAYER_SIZE)) {
        if (u.kind === 'persistent') {
          ++pUpgrades[u.type];
          const def = PERSISTENT_UPGRADE_DEFS[u.type];
          floatingText.add(u.x, u.y, def.label + ' ' + pUpgrades[u.type], { color: def.color, decay: 0.02 });
          particles.burst(u.x, u.y, 12, { color: def.color, speed: 3, life: 0.5, size: 2, decay: 0.03 });
          if (u.type === 'shieldUp')
            shieldHP = Math.min(shieldHP + 1, SHIELD_MAX_HP + pUpgrades.shieldUp);
        } else {
          currentWeapon = u.type;
          floatingText.add(u.x, u.y, u.type.toUpperCase(), { color: '#0ff', decay: 0.025 });
          particles.burst(u.x, u.y, 8, { color: '#0ff', speed: 3, life: 0.4, size: 2, decay: 0.03 });
        }
        upgrades.splice(i, 1);
      }
    }

    // Update mines
    for (let i = mines.length - 1; i >= 0; --i) {
      const m = mines[i];
      m.life -= dt;
      if (m.life <= 0) {
        mines.splice(i, 1);
        continue;
      }
      if (!m.armed) {
        m.armTimer -= dt;
        if (m.armTimer <= 0)
          m.armed = true;
        continue;
      }
      // Check proximity to player
      const mdx = player.x - m.x, mdy = player.y - m.y;
      if (mdx * mdx + mdy * mdy < m.triggerRadius * m.triggerRadius) {
        // Detonate mine
        particles.burst(m.x, m.y, 15, { color: '#f80', speed: 5, life: 0.5, size: 3, decay: 0.03 });
        screenShake.trigger(6, 250);
        // Damage player if within damage radius
        if (mdx * mdx + mdy * mdy < m.damageRadius * m.damageRadius)
          playerHit();
        mines.splice(i, 1);
        if (state === STATE_DEAD)
          return;
      }
    }

    // Update rail trails
    for (let i = railTrails.length - 1; i >= 0; --i) {
      railTrails[i].timer -= dt;
      if (railTrails[i].timer <= 0)
        railTrails.splice(i, 1);
    }

    // Update lightning chain visual timers on bullets
    for (const b of bullets) {
      if (b.chainTargets)
        for (let ci = b.chainTargets.length - 1; ci >= 0; --ci) {
          b.chainTargets[ci].timer -= dt;
          if (b.chainTargets[ci].timer <= 0)
            b.chainTargets.splice(ci, 1);
        }
    }

    // Boss wave logic
    if (isBossWave) {
      if (bossWarningTimer > 0) {
        bossWarningTimer -= dt;
        if (bossWarningTimer <= 0)
          spawnBoss();
      }
      if (boss && boss.alive)
        updateBoss(dt);
      if (bossVictoryTimer > 0) {
        bossVictoryTimer -= dt;
        if (bossVictoryTimer <= 0) {
          boss = null;
          isBossWave = false;
          ++waveNumber;
          shieldHP = Math.min(shieldHP + 1, SHIELD_MAX_HP + pUpgrades.shieldUp);
          startWave();
          floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'WAVE ' + waveNumber, { color: '#fff', decay: 0.015 });
        }
      }
    } else {
      // Wave spawning
      if (waveSpawnCount < waveTotalEnemies) {
        waveSpawnTimer += dt;
        const spawnInterval = Math.max(0.3, 1.0 - waveNumber * 0.05);
        if (waveSpawnTimer >= spawnInterval) {
          waveSpawnTimer = 0;
          spawnEnemy();
          ++waveSpawnCount;
        }
      }

      // Wave completion check
      if (waveEnemiesLeft <= 0 && enemies.length === 0 && waveSpawnCount >= waveTotalEnemies) {
        waveDelay += dt;
        if (waveDelay >= 1.5) {
          ++waveNumber;
          shieldHP = Math.min(shieldHP + 1, SHIELD_MAX_HP + pUpgrades.shieldUp);
          startWave();
          floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'WAVE ' + waveNumber, { color: '#fff', decay: 0.015 });
        }
      }
    }

    // Stars scroll
    for (const star of stars) {
      star.y += star.speed * dt;
      if (star.y > CANVAS_H) {
        star.y = -2;
        star.x = Math.random() * CANVAS_W;
      }
    }

    // Effects
    particles.update();
    floatingText.update();
    screenShake.update(dt * 1000);
    updateStatus();
  }

  /* ── Draw ── */
  function draw() {
    ctx.save();
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    screenShake.apply(ctx);

    // Nebula clouds (drawn before stars)
    ctx.save();
    {
      const nebulaTime = Date.now() / 20000;
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = 'rgb(80,40,120)';
      ctx.beginPath();
      ctx.ellipse(150 + Math.sin(nebulaTime) * 20, 200, 140, 90, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = 'rgb(40,60,120)';
      ctx.beginPath();
      ctx.ellipse(420 + Math.cos(nebulaTime * 0.7) * 15, 380, 120, 100, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = 'rgb(60,30,90)';
      ctx.beginPath();
      ctx.ellipse(500 + Math.sin(nebulaTime * 1.2) * 10, 100, 100, 70, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Distant planet (partial circle at bottom-right edge)
    ctx.save();
    {
      const planetX = CANVAS_W - 40;
      const planetY = CANVAS_H - 20;
      const planetR = 80;
      const planetGrad = ctx.createRadialGradient(planetX - 20, planetY - 20, planetR * 0.2, planetX, planetY, planetR);
      planetGrad.addColorStop(0, 'rgba(40,80,120,0.25)');
      planetGrad.addColorStop(0.6, 'rgba(20,50,80,0.15)');
      planetGrad.addColorStop(1, 'rgba(10,20,40,0)');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
      ctx.fill();
      // Atmospheric glow ring
      const atmosGrad = ctx.createRadialGradient(planetX, planetY, planetR * 0.85, planetX, planetY, planetR * 1.2);
      atmosGrad.addColorStop(0, 'rgba(100,180,255,0)');
      atmosGrad.addColorStop(0.5, 'rgba(100,180,255,0.06)');
      atmosGrad.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetR * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Stars (enhanced variety)
    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      if (star.size > 1.2) {
        // Larger stars get a faint glow halo
        ctx.save();
        ctx.globalAlpha = star.alpha * 0.2;
        ctx.fillStyle = '#aaccff';
        ctx.beginPath();
        ctx.arc(star.x + star.size * 0.5, star.y + star.size * 0.5, star.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = star.alpha;
      }
      ctx.fillStyle = star.size > 1.5 ? '#ddeeff' : '#fff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    // Upgrades
    for (const u of upgrades) {
      ctx.save();
      let uColor, uLabel;
      if (u.kind === 'persistent') {
        const def = PERSISTENT_UPGRADE_DEFS[u.type];
        uColor = def.color;
        uLabel = def.label;
      } else {
        uColor = u.type === 'spread' ? '#0f0' : u.type === 'laser' ? '#f0f' : u.type === 'missile' ? '#f80' : u.type === 'plasma' ? '#a0f' : u.type === 'shotgun' ? '#ff0' : u.type === 'lightning' ? '#fff' : u.type === 'flak' ? '#f80' : u.type === 'railgun' ? '#0ff' : '#0ff';
        uLabel = u.type[0].toUpperCase();
      }
      ctx.shadowColor = uColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = uColor;
      if (u.kind === 'persistent') {
        // Star shape for persistent upgrades
        ctx.beginPath();
        for (let p = 0; p < 5; ++p) {
          const angle = -Math.PI / 2 + p * Math.PI * 2 / 5;
          const angle2 = angle + Math.PI / 5;
          ctx.lineTo(u.x + Math.cos(angle) * UPGRADE_SIZE, u.y + Math.sin(angle) * UPGRADE_SIZE);
          ctx.lineTo(u.x + Math.cos(angle2) * UPGRADE_SIZE * 0.5, u.y + Math.sin(angle2) * UPGRADE_SIZE * 0.5);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(u.x, u.y, UPGRADE_SIZE, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(uLabel, u.x, u.y);
    }

    // Player bullets
    for (const b of bullets) {
      ctx.save();
      if (b.type === 'laser') {
        // Outer glow line (wider, dimmer cyan)
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#0ff';
        ctx.fillRect(b.x - 2.5, b.y - 7, 5, 14);
        // Bright core line (white, thinner)
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 0.8, b.y - 6, 1.6, 12);
      } else if (b.type === 'missile') {
        // Exhaust trail: 4 fading circles behind
        const angle = Math.atan2(b.vy, b.vx);
        const trailDx = -Math.cos(angle);
        const trailDy = -Math.sin(angle);
        for (let t = 1; t <= 4; ++t) {
          ctx.globalAlpha = 0.5 - t * 0.1;
          ctx.fillStyle = t <= 2 ? '#f80' : '#f44';
          ctx.beginPath();
          ctx.arc(b.x + trailDx * t * 5, b.y + trailDy * t * 5, 3 - t * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Missile body
        ctx.shadowColor = '#f80';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#f80';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        // Triangular fins on sides
        ctx.fillStyle = '#c60';
        const finAngle = angle + Math.PI;
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        ctx.beginPath();
        ctx.moveTo(b.x + perpX * 4, b.y + perpY * 4);
        ctx.lineTo(b.x + perpX * 2 + Math.cos(finAngle) * 6, b.y + perpY * 2 + Math.sin(finAngle) * 6);
        ctx.lineTo(b.x + Math.cos(finAngle) * 3, b.y + Math.sin(finAngle) * 3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.x - perpX * 4, b.y - perpY * 4);
        ctx.lineTo(b.x - perpX * 2 + Math.cos(finAngle) * 6, b.y - perpY * 2 + Math.sin(finAngle) * 6);
        ctx.lineTo(b.x + Math.cos(finAngle) * 3, b.y + Math.sin(finAngle) * 3);
        ctx.fill();
      } else if (b.type === 'plasma') {
        const wobble = Math.sin(Date.now() / 80) * 2;
        const plasmaR = 8 + wobble;
        // Trailing particles (2-3 small fading circles behind)
        for (let t = 1; t <= 3; ++t) {
          ctx.globalAlpha = 0.4 - t * 0.12;
          ctx.fillStyle = '#a0f';
          ctx.beginPath();
          ctx.arc(
            b.x + (Math.random() - 0.5) * 2,
            b.y + t * 8 + (Math.random() - 0.5) * 2,
            plasmaR * (0.6 - t * 0.15),
            0, Math.PI * 2
          );
          ctx.fill();
        }
        // Main plasma orb
        ctx.shadowColor = '#a0f';
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#a0f';
        ctx.beginPath();
        ctx.arc(b.x, b.y, plasmaR, 0, Math.PI * 2);
        ctx.fill();
        // Bright core
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3 + wobble * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'beam') {
        // Wide gradient beam: transparent edges to bright center
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 18;
        const beamGrad = ctx.createLinearGradient(b.x - 5, 0, b.x + 5, 0);
        beamGrad.addColorStop(0, 'rgba(0,255,255,0)');
        beamGrad.addColorStop(0.3, 'rgba(0,255,255,0.4)');
        beamGrad.addColorStop(0.5, 'rgba(200,255,255,0.9)');
        beamGrad.addColorStop(0.7, 'rgba(0,255,255,0.4)');
        beamGrad.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(b.x - 5, b.y - 10, 10, 20);
        // White center core line
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 0.5, b.y - 10, 1, 20);
        ctx.globalAlpha = 1;
      } else if (b.type === 'shotgun') {
        ctx.shadowColor = '#ff0';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = b.fadeTimer / SHOTGUN_FADE_TIME;
        ctx.fillStyle = '#ffff44';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (b.type === 'lightning') {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 4, 0, Math.PI * 2);
        ctx.fill();
        // Draw chain arcs
        if (b.chainTargets)
          for (const chain of b.chainTargets) {
            ctx.strokeStyle = `rgba(255,255,255,${chain.timer / 0.15})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(chain.x1, chain.y1);
            // Zigzag lightning line
            const mx = (chain.x1 + chain.x2) / 2 + (Math.random() - 0.5) * 20;
            const my = (chain.y1 + chain.y2) / 2 + (Math.random() - 0.5) * 20;
            ctx.lineTo(mx, my);
            ctx.lineTo(chain.x2, chain.y2);
            ctx.stroke();
          }
      } else if (b.type === 'flak') {
        ctx.shadowColor = '#f80';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 5, 0, Math.PI * 2);
        ctx.fill();
        // Timer indicator ring
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, (b.size || 5) + 3, 0, Math.PI * 2 * (b.detonateTimer / FLAK_DETONATE_TIME));
        ctx.stroke();
      } else if (b.type === 'flak_fragment') {
        ctx.globalAlpha = b.fadeTimer / 0.4;
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (b.type === 'railgun') {
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#aaffff';
        ctx.fillRect(b.x - 1.5, b.y - 12, 3, 24);
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 0.5, b.y - 10, 1, 20);
      } else {
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#0ff';
        ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
      }
      ctx.restore();
    }

    // Rail trails
    for (const rt of railTrails) {
      ctx.save();
      ctx.globalAlpha = rt.timer / RAILGUN_TRAIL_DURATION * 0.6;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(rt.x, rt.y1);
      ctx.lineTo(rt.x, -10);
      ctx.stroke();
      ctx.restore();
    }

    // Mines
    for (const m of mines) {
      ctx.save();
      if (m.armed) {
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 6 + 4 * Math.sin(Date.now() / 150);
        ctx.fillStyle = '#880000';
      } else {
        ctx.fillStyle = '#444';
      }
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Blink dot
      if (m.armed && Math.sin(Date.now() / 200) > 0) {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Enemy bullets
    for (const b of enemyBullets) {
      ctx.save();
      ctx.shadowColor = '#f44';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enemies
    for (const e of enemies) {
      ctx.save();
      const drawColor = e.hitTimer > 0 ? '#fff' : e.color;
      ctx.shadowColor = drawColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = drawColor;

      if (e.type === 'dart') {
        // Thin elongated diamond with body gradient
        const dartGrad = ctx.createLinearGradient(e.x - e.size * 0.5, e.y, e.x + e.size * 0.5, e.y);
        dartGrad.addColorStop(0, drawColor);
        dartGrad.addColorStop(0.5, e.hitTimer > 0 ? '#fff' : '#5fe89a');
        dartGrad.addColorStop(1, drawColor);
        ctx.fillStyle = dartGrad;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size * 1.3);
        ctx.lineTo(e.x - e.size * 0.5, e.y);
        ctx.lineTo(e.x, e.y - e.size * 1.3);
        ctx.lineTo(e.x + e.size * 0.5, e.y);
        ctx.closePath();
        ctx.fill();
        // Center stripe/panel detail
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - e.size * 1.1);
        ctx.lineTo(e.x, e.y + e.size * 1.1);
        ctx.stroke();
      } else if (e.type === 'sniper') {
        // Triangle with aiming line + body gradient
        const sniperGrad = ctx.createLinearGradient(e.x - e.size, e.y, e.x + e.size, e.y);
        sniperGrad.addColorStop(0, drawColor);
        sniperGrad.addColorStop(0.5, e.hitTimer > 0 ? '#fff' : '#f7e06e');
        sniperGrad.addColorStop(1, drawColor);
        ctx.fillStyle = sniperGrad;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size);
        ctx.lineTo(e.x - e.size, e.y - e.size * 0.6);
        ctx.lineTo(e.x + e.size, e.y - e.size * 0.6);
        ctx.closePath();
        ctx.fill();
        // Scope lens dot at nose
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#ff0';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x, e.y + e.size * 0.7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Aiming line
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 150);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size);
        ctx.lineTo(player.x, player.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'carrier') {
        // Hexagon with gradient
        const carrierGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size);
        carrierGrad.addColorStop(0, e.hitTimer > 0 ? '#fff' : '#3de8c4');
        carrierGrad.addColorStop(1, drawColor);
        ctx.fillStyle = carrierGrad;
        ctx.beginPath();
        for (let a = 0; a < 6; ++a) {
          const angle = Math.PI / 6 + a * Math.PI / 3;
          const px = e.x + Math.cos(angle) * e.size;
          const py = e.y + Math.sin(angle) * e.size;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Antenna fins: 2 small lines extending from top
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x - e.size * 0.3, e.y - e.size * 0.85);
        ctx.lineTo(e.x - e.size * 0.5, e.y - e.size * 1.3);
        ctx.moveTo(e.x + e.size * 0.3, e.y - e.size * 0.85);
        ctx.lineTo(e.x + e.size * 0.5, e.y - e.size * 1.3);
        ctx.stroke();
        // Window dots along the sides
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let w = -1; w <= 1; ++w) {
          ctx.beginPath();
          ctx.arc(e.x + w * e.size * 0.4, e.y - e.size * 0.15, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Bay indicator
        ctx.fillStyle = '#0a0a1e';
        ctx.beginPath();
        ctx.arc(e.x, e.y + e.size * 0.4, e.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'juggernaut') {
        // Outer diamond (main armor)
        const jugGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size);
        jugGrad.addColorStop(0, e.hitTimer > 0 ? '#fff' : '#c0c8cc');
        jugGrad.addColorStop(1, drawColor);
        ctx.fillStyle = jugGrad;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size);
        ctx.lineTo(e.x - e.size, e.y);
        ctx.lineTo(e.x, e.y - e.size);
        ctx.lineTo(e.x + e.size, e.y);
        ctx.closePath();
        ctx.fill();
        // Inner diamond (layered armor, slightly different shade)
        const innerScale = 0.65;
        ctx.fillStyle = e.hitTimer > 0 ? '#eee' : '#a8b0b4';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size * innerScale);
        ctx.lineTo(e.x - e.size * innerScale, e.y);
        ctx.lineTo(e.x, e.y - e.size * innerScale);
        ctx.lineTo(e.x + e.size * innerScale, e.y);
        ctx.closePath();
        ctx.fill();
        // Armor plate line details
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Horizontal plate line
        ctx.moveTo(e.x - e.size * 0.7, e.y);
        ctx.lineTo(e.x + e.size * 0.7, e.y);
        // Vertical plate line
        ctx.moveTo(e.x, e.y - e.size * 0.7);
        ctx.lineTo(e.x, e.y + e.size * 0.7);
        // Diagonal plate lines
        ctx.moveTo(e.x - e.size * 0.5, e.y - e.size * 0.5);
        ctx.lineTo(e.x + e.size * 0.5, e.y + e.size * 0.5);
        ctx.moveTo(e.x + e.size * 0.5, e.y - e.size * 0.5);
        ctx.lineTo(e.x - e.size * 0.5, e.y + e.size * 0.5);
        ctx.stroke();
      } else if (e.type === 'cloaker') {
        // Cloaker: fading diamond shape
        ctx.globalAlpha = e.visible ? 1 : 0.15;
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - e.size);
        ctx.lineTo(e.x + e.size * 0.8, e.y);
        ctx.lineTo(e.x, e.y + e.size);
        ctx.lineTo(e.x - e.size * 0.8, e.y);
        ctx.closePath();
        ctx.fill();
        // Phase shimmer
        if (!e.visible) {
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'minelayer') {
        // Minelayer: wide body with cargo pods
        ctx.fillStyle = drawColor;
        ctx.fillRect(e.x - e.size, e.y - e.size * 0.4, e.size * 2, e.size * 0.8);
        // Cargo pods on sides
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(e.x - e.size * 0.7, e.y + e.size * 0.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.size * 0.7, e.y + e.size * 0.5, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'swarm') {
        // Swarm: small wedge shape
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size);
        ctx.lineTo(e.x - e.size, e.y - e.size * 0.5);
        ctx.lineTo(e.x + e.size, e.y - e.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (e.type === 'shieldbearer') {
        // Shield bearer: hexagon with glowing dome
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        for (let a = 0; a < 6; ++a) {
          const angle = a * Math.PI / 3;
          const sx = e.x + Math.cos(angle) * e.size * 0.8;
          const sy = e.y + Math.sin(angle) * e.size * 0.8;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        // Shield aura dome
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(Date.now() / 300);
        ctx.strokeStyle = '#88ddff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Default triangle: scout, fighter, bomber -- with body gradient
        const defGrad = ctx.createLinearGradient(e.x - e.size, e.y, e.x + e.size, e.y);
        defGrad.addColorStop(0, drawColor);
        defGrad.addColorStop(0.5, e.hitTimer > 0 ? '#fff' : '#ffeedd');
        defGrad.addColorStop(1, drawColor);
        ctx.fillStyle = defGrad;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size);
        ctx.lineTo(e.x - e.size, e.y - e.size * 0.6);
        ctx.lineTo(e.x + e.size, e.y - e.size * 0.6);
        ctx.closePath();
        ctx.fill();
        // Engine glow dots at rear (top, since enemies face downward)
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff8833';
        ctx.beginPath();
        ctx.arc(e.x - e.size * 0.4, e.y - e.size * 0.5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.size * 0.4, e.y - e.size * 0.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shield shimmer effect for enemies above 50% HP (multi-HP only)
      if (e.maxHp > 1 && e.hp > e.maxHp * 0.5) {
        const shimmerAlpha = 0.12 + 0.08 * Math.sin(Date.now() / 200 + e.movePhase);
        ctx.globalAlpha = shimmerAlpha;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // HP bar for multi-HP enemies
      if (e.maxHp > 1) {
        const barW = e.size * 2;
        const barH = 3;
        const barX = e.x - barW / 2;
        const barY = e.y - e.size - 6;
        ctx.fillStyle = '#300';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#0f0' : e.hp / e.maxHp > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
      }

      ctx.restore();
    }

    // Player ship (multi-part with strafe lean and engine thrust)
    ctx.save();
    ctx.translate(player.x, player.y);
    // Strafe lean: slight rotation when moving horizontally
    const leanAngle = player.dx * -0.15;
    if (leanAngle !== 0)
      ctx.rotate(leanAngle);

    // Engine thrust: animated flame trail behind ship
    {
      const thrustFlicker = Math.sin(Date.now() / 50) * 0.3 + 0.7;
      const thrustJitter = Math.random() * 0.3;
      const flameLen = PLAYER_SIZE * (0.6 + thrustFlicker * 0.4 + thrustJitter);
      // Left engine flame
      const flameGrad1 = ctx.createLinearGradient(0, PLAYER_SIZE * 0.6, 0, PLAYER_SIZE * 0.6 + flameLen);
      flameGrad1.addColorStop(0, 'rgba(255,200,50,0.9)');
      flameGrad1.addColorStop(0.4, 'rgba(255,120,20,0.7)');
      flameGrad1.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = flameGrad1;
      ctx.beginPath();
      ctx.moveTo(-PLAYER_SIZE * 0.35 - 2, PLAYER_SIZE * 0.55);
      ctx.lineTo(-PLAYER_SIZE * 0.35 + 2, PLAYER_SIZE * 0.55);
      ctx.lineTo(-PLAYER_SIZE * 0.35 + (Math.random() - 0.5), PLAYER_SIZE * 0.6 + flameLen);
      ctx.closePath();
      ctx.fill();
      // Right engine flame
      ctx.beginPath();
      ctx.moveTo(PLAYER_SIZE * 0.35 - 2, PLAYER_SIZE * 0.55);
      ctx.lineTo(PLAYER_SIZE * 0.35 + 2, PLAYER_SIZE * 0.55);
      ctx.lineTo(PLAYER_SIZE * 0.35 + (Math.random() - 0.5), PLAYER_SIZE * 0.6 + flameLen);
      ctx.closePath();
      ctx.fill();
    }

    // Wing struts: smaller parallelograms extending left and right from hull midpoint
    ctx.shadowColor = '#3a9ca5';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#3a9ca5';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-PLAYER_SIZE * 0.3, 0);
    ctx.lineTo(-PLAYER_SIZE * 1.1, PLAYER_SIZE * 0.4);
    ctx.lineTo(-PLAYER_SIZE * 0.8, PLAYER_SIZE * 0.55);
    ctx.lineTo(-PLAYER_SIZE * 0.15, PLAYER_SIZE * 0.2);
    ctx.closePath();
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(PLAYER_SIZE * 0.3, 0);
    ctx.lineTo(PLAYER_SIZE * 1.1, PLAYER_SIZE * 0.4);
    ctx.lineTo(PLAYER_SIZE * 0.8, PLAYER_SIZE * 0.55);
    ctx.lineTo(PLAYER_SIZE * 0.15, PLAYER_SIZE * 0.2);
    ctx.closePath();
    ctx.fill();

    // Central hull: triangle with linear gradient (lighter center, darker edges)
    const hullGrad = ctx.createLinearGradient(-PLAYER_SIZE, 0, PLAYER_SIZE, 0);
    hullGrad.addColorStop(0, '#357f88');
    hullGrad.addColorStop(0.5, '#6ee0ec');
    hullGrad.addColorStop(1, '#357f88');
    ctx.shadowColor = '#4ec0ca';
    ctx.shadowBlur = 10;
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_SIZE);
    ctx.lineTo(-PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.6);
    ctx.lineTo(PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();

    // Cockpit canopy: small lighter arc on top portion of hull
    ctx.fillStyle = 'rgba(150,230,255,0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#aaf0ff';
    ctx.beginPath();
    ctx.ellipse(0, -PLAYER_SIZE * 0.35, PLAYER_SIZE * 0.2, PLAYER_SIZE * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine nozzles: 2 small circles at the bottom-back of the ship
    ctx.fillStyle = '#2a7a82';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-PLAYER_SIZE * 0.35, PLAYER_SIZE * 0.55, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PLAYER_SIZE * 0.35, PLAYER_SIZE * 0.55, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Shield visual arc/shimmer
    if (shieldHP > 0) {
      ctx.save();
      const shieldAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 200);
      ctx.strokeStyle = `rgba(0,191,255,${shieldAlpha + 0.2})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_SIZE + 6, 0, Math.PI * 2);
      ctx.stroke();
      // Shield shimmer glow
      ctx.globalAlpha = shieldAlpha;
      ctx.fillStyle = 'rgba(0,191,255,0.1)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_SIZE + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Boss
    drawBoss();

    // Boss warning overlay
    if (isBossWave && bossWarningTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 100);
      ctx.fillStyle = '#f00';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WARNING', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    // Boss victory overlay
    if (bossVictoryTimer > 0 && (!boss || !boss.alive)) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, bossVictoryTimer / 2);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BOSS DEFEATED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);

    // HUD
    ctx.save();
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('Score: ' + Math.floor(score), 10, 24);
    ctx.font = '14px sans-serif';
    ctx.fillText('Wave ' + waveNumber, 10, 42);
    ctx.fillText('Shield: ' + shieldHP, 10, 58);
    if (multiplier > 1)
      ctx.fillText('x' + multiplier + ' streak', 10, 74);

    ctx.textAlign = 'right';
    ctx.fillText('Weapon: ' + currentWeapon, CANVAS_W - 10, 24);
    ctx.fillText('Lives: ' + lives, CANVAS_W - 10, 42);

    // Persistent upgrade indicators
    let uy = 58;
    for (const [key, def] of Object.entries(PERSISTENT_UPGRADE_DEFS)) {
      if (pUpgrades[key] > 0) {
        ctx.fillStyle = def.color;
        ctx.fillText(def.label + ' ' + pUpgrades[key], CANVAS_W - 10, uy);
        uy += 14;
      }
    }
    ctx.restore();

    // Ready overlay
    if (state === STATE_READY) {
      ctx.save();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('Tap or press Space to Start', CANVAS_W / 2, CANVAS_H * 0.4);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap or press Space to Start', CANVAS_W / 2, CANVAS_H * 0.4);
      ctx.font = '16px sans-serif';
      ctx.strokeText('WASD/Arrows to move, Space/Z to fire', CANVAS_W / 2, CANVAS_H * 0.5);
      ctx.fillText('WASD/Arrows to move, Space/Z to fire', CANVAS_W / 2, CANVAS_H * 0.5);
      ctx.restore();
    }

    // Paused overlay
    if (state === STATE_PAUSED) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    // Dead overlay
    if (state === STATE_DEAD) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f44';
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H * 0.35);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Score: ' + Math.floor(score), CANVAS_W / 2, CANVAS_H * 0.45);
      ctx.fillText('Wave: ' + waveNumber, CANVAS_W / 2, CANVAS_H * 0.5);

      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press Space to Restart', CANVAS_W / 2, CANVAS_H * 0.6);
      ctx.restore();
    }

    ctx.restore();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 400, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(5,10,30,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#4af';
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

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    update(dt);
    draw();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Status Bar ── */
  function updateStatus() {
    statusScore.textContent = 'Score: ' + Math.floor(score);
    statusWave.textContent = 'Wave: ' + waveNumber;
    statusLives.textContent = 'Lives: ' + lives;
    statusState.textContent = state === STATE_PAUSED ? 'Paused' :
      state === STATE_DEAD ? 'Game Over' :
      state === STATE_PLAYING ? 'Playing' : 'Ready';
  }

  /* ── Input ── */
  function togglePause() {
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
    updateStatus();
  }

  function handleStart() {
    if (state === STATE_READY) {
      state = STATE_PLAYING;
      startWave();
      updateStatus();
    } else if (state === STATE_DEAD) {
      resetGame();
    }
  }

  function onKeyDown(e) {
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

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    keys[e.code] = true;

    if (e.code === 'Space' || e.code === 'KeyZ') {
      e.preventDefault();
      if (state === STATE_READY || state === STATE_DEAD)
        handleStart();
    }

    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown'
      || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD')
      e.preventDefault();
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    canvas.focus();
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_DEAD) {
      handleStart();
      return;
    }
    if (state === STATE_PLAYING) {
      mouseDown = true;
      fireWeapon();
    }
  });

  canvas.addEventListener('pointerup', function() {
    mouseDown = false;
  });

  /* ── Resize ── */
  window.addEventListener('resize', setupCanvas);

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => resetGame(),
      pause: togglePause,
      'high-scores': async () => {
        const tbody = document.getElementById('highScoresBody');
        tbody.innerHTML = '';
        for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
          const entry = highScores[i] || { score: 0, wave: 0 };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${Math.floor(entry.score)}</td><td>${entry.wave}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          highScores = [];
          saveData();
          updateStatus();
        }
      },
      exit: () => SZ.Dlls.User32.DestroyWindow(),
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      tutorial: () => { showTutorial = true; tutorialPage = 0; },
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — CSS handles it
    }
    if (msg === 'WM_SIZE') {
      setupCanvas();
    }
  });

  SZ.Dlls.User32.SetWindowText('Space Combat');

  /* ── Init ── */
  loadData();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  setupCanvas();
  initStars();
  updateStatus();
  canvas.focus();
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  animFrameId = requestAnimationFrame(gameLoop);

})();
