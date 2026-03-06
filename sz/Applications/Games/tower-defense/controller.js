;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const _hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 800;
  const CANVAS_H = 560;
  const MAX_DT = 0.05;
  const CELL = 32;
  const COLS = 25;
  const ROWS = 17;
  const MAX_TIER = 3;

  /* ── Palette layout constants ── */
  const PALETTE_H = 48;
  const PALETTE_Y = CANVAS_H - PALETTE_H;
  const PALETTE_BTN_W = 72;
  const PALETTE_BTN_H = 38;
  const PALETTE_BTN_GAP = 4;
  const PALETTE_BTN_Y = PALETTE_Y + 5;

  /* ── Right-side HUD buttons ── */
  const HUD_BTN_W = 64;
  const HUD_BTN_H = 20;

  /* ── Game states ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_BUILD = 'BUILD';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_VICTORY = 'VICTORY';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-tower-defense';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── Pre-wave warning timing ── */
  const WARNING_DURATION = 3;
  const AUTO_WAVE_DELAY = 5;

  /* ══════════════════════════════════════════════════════════════════
     TOWER DEFINITIONS
     9 tower types with unique abilities
     ══════════════════════════════════════════════════════════════════ */

  const TOWER_TYPES = [
    {
      id: 'arrow', name: 'Arrow', cost: 50, damage: 10, range: 120, fireRate: 0.8,
      color: '#6b4', colorDark: '#3a2', projectileColor: '#8d6', projectileSpeed: 300,
      desc: 'Fast, cheap'
    },
    {
      id: 'cannon', name: 'Cannon', cost: 80, damage: 35, range: 90, fireRate: 1.5,
      color: '#a63', colorDark: '#742', projectileColor: '#f80', projectileSpeed: 200,
      splash: 30, desc: 'Splash dmg'
    },
    {
      id: 'frost', name: 'Frost', cost: 70, damage: 8, range: 100, fireRate: 1.0,
      color: '#6af', colorDark: '#38c', projectileColor: '#aef', projectileSpeed: 250,
      slow: 0.5, desc: 'Slows enemies'
    },
    {
      id: 'lightning', name: 'Lightning', cost: 120, damage: 25, range: 140, fireRate: 1.2,
      color: '#ff0', colorDark: '#aa0', projectileColor: '#ff8', projectileSpeed: 600,
      chain: 2, desc: 'Chain hits'
    },
    {
      id: 'laser', name: 'Laser', cost: 150, damage: 50, range: 160, fireRate: 2.0,
      color: '#f0f', colorDark: '#a0a', projectileColor: '#f8f', projectileSpeed: 800,
      desc: 'High damage'
    },
    {
      id: 'poison', name: 'Poison', cost: 90, damage: 5, range: 110, fireRate: 0.9,
      color: '#0c4', colorDark: '#083', projectileColor: '#4f8', projectileSpeed: 220,
      dot: 15, dotDuration: 3, desc: 'Damage/time'
    },
    {
      id: 'tesla', name: 'Tesla', cost: 140, damage: 18, range: 100, fireRate: 0.6,
      color: '#4df', colorDark: '#29a', projectileColor: '#8ff', projectileSpeed: 500,
      chain: 4, desc: 'Multi-chain'
    },
    {
      id: 'mortar', name: 'Mortar', cost: 110, damage: 45, range: 180, fireRate: 2.5,
      color: '#a86', colorDark: '#754', projectileColor: '#da8', projectileSpeed: 150,
      splash: 50, desc: 'Long-range AoE'
    },
    {
      id: 'flame', name: 'Flame', cost: 100, damage: 12, range: 60, fireRate: 0.3,
      color: '#f60', colorDark: '#a40', projectileColor: '#fa4', projectileSpeed: 400,
      aoe: 40, dot: 8, dotDuration: 2, desc: 'Close AoE + burn'
    }
  ];

  /* ── Upgrade multipliers per tier ── */
  const UPGRADE_COST_MULT = [0, 0.6, 1.0, 1.5];
  const UPGRADE_DAMAGE_MULT = [1, 1.4, 1.8, 2.4];
  const UPGRADE_RANGE_MULT = [1, 1.1, 1.2, 1.35];

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEFINITIONS
     Types: normal, fast, armored, flying, boss, healer, swarm, shield
     ══════════════════════════════════════════════════════════════════ */

  const ENEMY_TYPES = {
    normal:  { hp: 40,  speed: 40, bounty: 10, color: '#c44', radius: 6 },
    fast:    { hp: 25,  speed: 70, bounty: 12, color: '#4c4', radius: 5 },
    armored: { hp: 120, speed: 25, bounty: 25, color: '#888', radius: 8 },
    flying:  { hp: 35,  speed: 50, bounty: 15, color: '#88f', radius: 5 },
    boss:    { hp: 500, speed: 20, bounty: 100, color: '#f0f', radius: 12 },
    healer:  { hp: 60,  speed: 35, bounty: 20, color: '#4f4', radius: 6, heals: true },
    swarm:   { hp: 15,  speed: 60, bounty: 5,  color: '#fa0', radius: 4 },
    shield:  { hp: 80,  speed: 30, bounty: 30, color: '#4ff', radius: 7, shielded: true }
  };

  /* ══════════════════════════════════════════════════════════════════
     MAPS -- 12 maps with paths defined as waypoint sequences
     Grid: 0 = buildable, 1 = path, 2 = blocked
     ══════════════════════════════════════════════════════════════════ */

  const MAPS = [
    { name: 'Serpentine',     startGold: 200, startLives: 20, waves: 15, path: [[0,8],[4,8],[4,4],[10,4],[10,12],[16,12],[16,6],[24,6]] },
    { name: 'Crossroads',     startGold: 220, startLives: 18, waves: 18, path: [[0,4],[6,4],[6,12],[12,12],[12,4],[18,4],[18,12],[24,12]] },
    { name: 'Spiral',         startGold: 200, startLives: 20, waves: 15, path: [[0,0],[0,16],[24,16],[24,0],[4,0],[4,12],[20,12],[20,4],[8,4],[8,8]] },
    { name: 'Zigzag',         startGold: 180, startLives: 15, waves: 20, path: [[0,2],[8,2],[8,14],[16,14],[16,2],[24,2]] },
    { name: 'Diamond',        startGold: 250, startLives: 20, waves: 15, path: [[0,8],[6,2],[12,8],[18,14],[24,8]] },
    { name: 'Fortress',       startGold: 300, startLives: 25, waves: 12, path: [[0,8],[5,8],[5,3],[10,3],[10,13],[15,13],[15,8],[24,8]] },
    { name: 'Canyon',         startGold: 200, startLives: 18, waves: 18, path: [[0,14],[4,14],[4,2],[8,2],[8,14],[12,14],[12,2],[16,2],[16,14],[20,14],[20,2],[24,2]] },
    { name: 'Labyrinth',      startGold: 250, startLives: 15, waves: 20, path: [[0,0],[0,8],[6,8],[6,0],[12,0],[12,16],[18,16],[18,8],[24,8]] },
    { name: 'Twin Paths',     startGold: 220, startLives: 20, waves: 16, path: [[0,4],[10,4],[10,12],[20,12],[20,4],[24,4]] },
    { name: 'Gauntlet',       startGold: 180, startLives: 12, waves: 25, path: [[0,8],[3,4],[6,12],[9,4],[12,12],[15,4],[18,12],[21,4],[24,8]] },
    { name: 'Wasteland',      startGold: 200, startLives: 20, waves: 15, path: [[0,2],[12,2],[12,14],[24,14]] },
    { name: 'Final Stand',    startGold: 350, startLives: 10, waves: 30, path: [[0,8],[4,4],[8,8],[12,4],[16,8],[20,4],[24,8]] }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusWave = document.getElementById('statusWave');
  const statusGold = document.getElementById('statusGold');
  const statusLives = document.getElementById('statusLives');
  const highScoresBody = document.getElementById('highScoresBody');

  const { User32 } = SZ?.Dlls ?? {};

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_READY;
  let currentMap = 0;
  let gold = 200;
  let lives = 20;
  let currentWave = 0;
  let totalWaves = 15;
  let gameSpeed = 1;
  let selectedTowerType = 0;
  let selectedTower = null;
  let hoverCell = null;

  let towers = [];
  let enemies = [];
  let projectiles = [];
  let pathCells = new Set();
  let waveEnemies = [];
  let spawnTimer = 0;
  let waveComplete = false;
  let waveCountdown = 0;
  let highScores = [];

  /* ── Auto-wave mode ── */
  let autoWaveMode = false;
  let autoWaveTimer = 0;

  /* ── Pre-wave warning state ── */
  let warningTimer = 0;
  let warningActive = false;
  let warningPulse = 0;

  /* ── Context menu state ── */
  let contextMenu = null; // { x, y, tower }

  /* ── Tower angle tracking for turret rotation ── */
  let towerAngles = new Map();

  /* ── Global animation timer ── */
  let animTime = 0;

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

  function addHighScore(mapName, wavesCompleted) {
    highScores.push({ map: mapName, waves: wavesCompleted });
    highScores.sort((a, b) => b.waves - a.waves);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].map}</td><td>${highScores[i].waves}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PATH UTILITIES
     ══════════════════════════════════════════════════════════════════ */

  function walkPath(waypoints, visit) {
    for (let i = 0; i < waypoints.length - 1; ++i) {
      let [x0, y0] = waypoints[i];
      const [x1, y1] = waypoints[i + 1];
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      while (x0 !== x1 || y0 !== y1) {
        visit(x0, y0);
        if (x0 !== x1) x0 += dx;
        if (y0 !== y1) y0 += dy;
      }
    }
    const last = waypoints[waypoints.length - 1];
    visit(last[0], last[1]);
  }

  function buildPathCells(mapDef) {
    pathCells = new Set();
    walkPath(mapDef.path, (x, y) => pathCells.add(`${x},${y}`));
  }

  function getPathPoints(mapDef) {
    const points = [];
    walkPath(mapDef.path, (x, y) => points.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));
    return points;
  }

  let pathPoints = [];

  /* ══════════════════════════════════════════════════════════════════
     MAP LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadMap(index) {
    currentMap = index;
    const mapDef = MAPS[currentMap];
    gold = mapDef.startGold;
    lives = mapDef.startLives;
    totalWaves = mapDef.waves;
    currentWave = 0;
    towers = [];
    enemies = [];
    projectiles = [];
    selectedTower = null;
    gameSpeed = 1;
    waveEnemies = [];
    spawnTimer = 0;
    waveComplete = true;
    waveCountdown = 3;
    contextMenu = null;
    towerAngles = new Map();
    warningActive = false;
    warningTimer = 0;
    autoWaveTimer = 0;

    buildPathCells(mapDef);
    pathPoints = getPathPoints(mapDef);

    state = STATE_BUILD;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER PLACEMENT & UPGRADE & SELL
     ══════════════════════════════════════════════════════════════════ */

  function canPlace(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (pathCells.has(`${col},${row}`)) return false;
    for (const t of towers)
      if (t.col === col && t.row === row) return false;
    return true;
  }

  function placeTower(col, row, typeIndex) {
    const def = TOWER_TYPES[typeIndex];
    if (gold < def.cost || !canPlace(col, row)) return false;

    gold -= def.cost;
    const tower = {
      col, row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      type: typeIndex,
      tier: 1,
      damage: def.damage,
      range: def.range,
      fireRate: def.fireRate,
      fireCooldown: 0,
      kills: 0
    };
    towers.push(tower);
    towerAngles.set(tower, 0);

    particles.sparkle(tower.x, tower.y, 12, { color: def.color, speed: 3 });
    floatingText.add(tower.x, tower.y - 16, `-${def.cost}g`, { color: '#fa0', font: 'bold 11px sans-serif' });

    return true;
  }

  function upgradeTower(tower) {
    if (tower.tier >= MAX_TIER) return false;
    const def = TOWER_TYPES[tower.type];
    const upgradeCost = Math.floor(def.cost * UPGRADE_COST_MULT[tower.tier]);
    if (gold < upgradeCost) return false;

    gold -= upgradeCost;
    ++tower.tier;
    tower.damage = Math.floor(def.damage * UPGRADE_DAMAGE_MULT[tower.tier - 1]);
    tower.range = Math.floor(def.range * UPGRADE_RANGE_MULT[tower.tier - 1]);
    tower.fireRate = def.fireRate * 0.85;

    particles.sparkle(tower.x, tower.y, 15, { color: '#ff0', speed: 4 });
    particles.burst(tower.x, tower.y, 8, { color: def.color, speed: 2, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, `Tier ${tower.tier}!`, { color: '#ff0', font: 'bold 12px sans-serif' });
    screenShake.trigger(2, 80);

    return true;
  }

  function sellTower(tower) {
    const def = TOWER_TYPES[tower.type];
    const refund = Math.floor(def.cost * 0.6 * tower.tier);
    gold += refund;
    const idx = towers.indexOf(tower);
    if (idx !== -1) towers.splice(idx, 1);
    towerAngles.delete(tower);
    floatingText.add(tower.x, tower.y - 16, `+${refund}g`, { color: '#8f8', font: 'bold 11px sans-serif' });
    particles.burst(tower.x, tower.y, 8, { color: '#aaa', speed: 2, life: 0.4 });
    if (selectedTower === tower)
      selectedTower = null;
  }

  function getUpgradeCost(tower) {
    if (tower.tier >= MAX_TIER) return 0;
    return Math.floor(TOWER_TYPES[tower.type].cost * UPGRADE_COST_MULT[tower.tier]);
  }

  function getSellValue(tower) {
    return Math.floor(TOWER_TYPES[tower.type].cost * 0.6 * tower.tier);
  }

  /* ══════════════════════════════════════════════════════════════════
     WAVE SPAWNING
     ══════════════════════════════════════════════════════════════════ */

  function generateWave(waveNum) {
    const queue = [];
    const count = 5 + Math.floor(waveNum * 1.5);
    for (let i = 0; i < count; ++i) {
      let type = 'normal';
      const roll = Math.random();
      if (waveNum >= 8 && roll < 0.05)
        type = 'boss';
      else if (waveNum >= 6 && roll < 0.1)
        type = 'shield';
      else if (waveNum >= 5 && roll < 0.15)
        type = 'healer';
      else if (waveNum >= 4 && roll < 0.25)
        type = 'armored';
      else if (waveNum >= 2 && roll < 0.4)
        type = 'fast';
      else if (waveNum >= 3 && roll < 0.5)
        type = 'flying';
      else if (waveNum >= 1 && roll < 0.55)
        type = 'swarm';
      queue.push(type);
    }
    // Swarm burst on even waves
    if (waveNum % 2 === 1 && waveNum >= 3)
      for (let i = 0; i < 4; ++i)
        queue.push('swarm');

    // Boss wave every 5 waves
    if (waveNum % 5 === 4)
      queue.push('boss');
    return queue;
  }

  function triggerVictory() {
    state = STATE_VICTORY;
    addHighScore(MAPS[currentMap].name, currentWave);
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, 'VICTORY!', { color: '#ffd700', font: 'bold 24px sans-serif' });
    particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40, { speed: 6, gravity: 0.08 });
    screenShake.trigger(6, 300);
    updateWindowTitle();
  }

  function startNextWave() {
    if (currentWave >= totalWaves) {
      triggerVictory();
      return;
    }

    waveEnemies = generateWave(currentWave);
    spawnTimer = 0;
    waveComplete = false;
    ++currentWave;
    state = STATE_PLAYING;
    warningActive = false;
    warningTimer = 0;
    contextMenu = null;

    floatingText.add(CANVAS_W / 2, 30, `Wave ${currentWave}`, { color: '#ff0', font: 'bold 16px sans-serif' });

    // Wave bonus/interest
    const bonus = Math.floor(gold * 0.05) + 10;
    gold += bonus;
    floatingText.add(CANVAS_W / 2, 50, `+${bonus}g interest`, { color: '#8f8', font: '11px sans-serif' });
    updateWindowTitle();
  }

  function beginPreWaveWarning() {
    warningActive = true;
    warningTimer = WARNING_DURATION;
    warningPulse = 0;
  }

  function spawnEnemy(type) {
    const def = ENEMY_TYPES[type];
    const waveScale = 1 + currentWave * 0.1;
    enemies.push({
      type,
      hp: Math.floor(def.hp * waveScale),
      maxHp: Math.floor(def.hp * waveScale),
      speed: def.speed,
      baseSpeed: def.speed,
      bounty: def.bounty,
      color: def.color,
      radius: def.radius,
      pathIndex: 0,
      pathProgress: 0,
      x: pathPoints[0].x,
      y: pathPoints[0].y,
      slowTimer: 0,
      dotTimer: 0,
      dotDamage: 0,
      isBoss: type === 'boss',
      isHealer: def.heals || false,
      isShielded: def.shielded || false,
      shieldHp: def.shielded ? Math.floor(def.hp * waveScale * 0.4) : 0,
      healCooldown: 0
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     TARGETING & PROJECTILES
     ══════════════════════════════════════════════════════════════════ */

  function findTarget(tower) {
    let closest = null;
    let bestDist = tower.range + 1;
    for (const enemy of enemies) {
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  function fireProjectile(tower, target) {
    const def = TOWER_TYPES[tower.type];
    projectiles.push({
      x: tower.x,
      y: tower.y,
      targetEnemy: target,
      speed: def.projectileSpeed,
      damage: tower.damage,
      color: def.projectileColor,
      splash: def.splash || 0,
      slow: def.slow || 0,
      chain: def.chain || 0,
      dot: def.dot ? Math.floor(def.dot * UPGRADE_DAMAGE_MULT[tower.tier - 1]) : 0,
      dotDuration: def.dotDuration || 0,
      aoe: def.aoe || 0,
      towerType: tower.type,
      trail: []
    });

    // Update turret angle
    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    towerAngles.set(tower, Math.atan2(dy, dx));
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEATH & LEAK
     ══════════════════════════════════════════════════════════════════ */

  function killEnemy(enemy, index) {
    particles.burst(enemy.x, enemy.y, 12, { color: enemy.color, speed: 3, life: 0.6 });

    gold += enemy.bounty;
    floatingText.add(enemy.x, enemy.y - 16, `+${enemy.bounty}g`, { color: '#ff0', font: 'bold 11px sans-serif' });

    if (enemy.isBoss) {
      screenShake.trigger(8, 400);
      particles.confetti(enemy.x, enemy.y, 20, { speed: 5, gravity: 0.06 });
      floatingText.add(enemy.x, enemy.y - 30, 'BOSS KILL!', { color: '#f0f', font: 'bold 14px sans-serif' });
    } else {
      screenShake.trigger(2, 60);
    }

    enemies.splice(index, 1);
  }

  function enemyReachedGoal(enemy, index) {
    --lives;
    enemies.splice(index, 1);
    screenShake.trigger(4, 150);
    floatingText.add(CANVAS_W - 40, 20, '-1 Life!', { color: '#f44', font: 'bold 12px sans-serif' });

    if (lives <= 0) {
      state = STATE_GAME_OVER;
      addHighScore(MAPS[currentMap].name, currentWave);
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, 'GAME OVER', { color: '#f44', font: 'bold 24px sans-serif' });
      screenShake.trigger(8, 500);
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      // DoT (damage over time)
      if (e.dotTimer > 0) {
        e.dotTimer -= dt;
        e.hp -= e.dotDamage * dt;
        // Poison particle trail
        if (Math.random() < 0.3)
          particles.sparkle(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 6, 1, { color: '#0f4', speed: 1 });
        if (e.hp <= 0) {
          killEnemy(e, i);
          continue;
        }
      }

      // Healer: heal nearby enemies
      if (e.isHealer) {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 2;
          for (const other of enemies) {
            if (other === e) continue;
            const hdx = other.x - e.x;
            const hdy = other.y - e.y;
            if (Math.sqrt(hdx * hdx + hdy * hdy) < 60) {
              other.hp = Math.min(other.maxHp, other.hp + Math.floor(other.maxHp * 0.05));
              particles.sparkle(other.x, other.y, 3, { color: '#4f4', speed: 1 });
            }
          }
        }
      }

      // Slow effect
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        e.speed = e.baseSpeed * 0.5;
      } else {
        e.speed = e.baseSpeed;
      }

      // Move along path
      if (e.pathIndex < pathPoints.length - 1) {
        const from = pathPoints[e.pathIndex];
        const to = pathPoints[e.pathIndex + 1];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        e.pathProgress += (e.speed * dt) / segLen;

        if (e.pathProgress >= 1) {
          e.pathProgress -= 1;
          ++e.pathIndex;
          if (e.pathIndex >= pathPoints.length - 1) {
            enemyReachedGoal(e, i);
            continue;
          }
        }

        const t = e.pathProgress;
        const cfrom = pathPoints[e.pathIndex];
        const cto = pathPoints[Math.min(e.pathIndex + 1, pathPoints.length - 1)];
        e.x = cfrom.x + (cto.x - cfrom.x) * t;
        e.y = cfrom.y + (cto.y - cfrom.y) * t;
      }
    }
  }

  function updateTowers(dt) {
    for (const tower of towers) {
      tower.fireCooldown -= dt;
      if (tower.fireCooldown <= 0) {
        const target = findTarget(tower);
        if (target) {
          fireProjectile(tower, target);
          tower.fireCooldown = tower.fireRate;
        }
      }
    }
  }

  function applyProjectileHit(p, target) {
    // Shield absorbs damage first
    if (target.isShielded && target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, p.damage);
      target.shieldHp -= absorbed;
      const remaining = p.damage - absorbed;
      if (remaining > 0)
        target.hp -= remaining;
      particles.sparkle(target.x, target.y, 4, { color: '#4ff', speed: 2 });
    } else {
      target.hp -= p.damage;
    }

    // Slow
    if (p.slow > 0)
      target.slowTimer = 2;

    // DoT (poison/flame)
    if (p.dot > 0) {
      target.dotTimer = p.dotDuration;
      target.dotDamage = p.dot;
    }

    // Splash damage
    if (p.splash > 0) {
      for (const other of enemies) {
        if (other === target) continue;
        const sdx = other.x - target.x;
        const sdy = other.y - target.y;
        if (Math.sqrt(sdx * sdx + sdy * sdy) < p.splash) {
          other.hp -= Math.floor(p.damage * 0.5);
          if (p.dot > 0) {
            other.dotTimer = p.dotDuration;
            other.dotDamage = Math.floor(p.dot * 0.5);
          }
        }
      }
      // Splash visual
      particles.burst(target.x, target.y, 10, { color: p.color, speed: 3, life: 0.3 });
    }

    // AoE cone (flame tower)
    if (p.aoe > 0) {
      for (const other of enemies) {
        if (other === target) continue;
        const adx = other.x - p.x;
        const ady = other.y - p.y;
        if (Math.sqrt(adx * adx + ady * ady) < p.aoe) {
          other.hp -= Math.floor(p.damage * 0.6);
          if (p.dot > 0) {
            other.dotTimer = p.dotDuration;
            other.dotDamage = Math.floor(p.dot * 0.5);
          }
        }
      }
    }

    // Chain (lightning/tesla)
    if (p.chain > 0) {
      let chainTarget = target;
      let chainsLeft = p.chain;
      const hit = new Set([target]);
      while (chainsLeft > 0) {
        let bestDist = 80;
        let nextTarget = null;
        for (const other of enemies) {
          if (hit.has(other)) continue;
          const cdx = other.x - chainTarget.x;
          const cdy = other.y - chainTarget.y;
          const d = Math.sqrt(cdx * cdx + cdy * cdy);
          if (d < bestDist) {
            bestDist = d;
            nextTarget = other;
          }
        }
        if (!nextTarget) break;
        hit.add(nextTarget);
        nextTarget.hp -= Math.floor(p.damage * 0.6);
        // Chain lightning visual line
        particles.sparkle(
          (chainTarget.x + nextTarget.x) / 2,
          (chainTarget.y + nextTarget.y) / 2,
          3, { color: p.color, speed: 2 }
        );
        chainTarget = nextTarget;
        --chainsLeft;
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; --i) {
      const p = projectiles[i];
      const t = p.targetEnemy;

      if (!t || t.hp <= 0 || !enemies.includes(t)) {
        projectiles.splice(i, 1);
        continue;
      }

      // Store trail position
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6)
        p.trail.shift();

      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveBy = p.speed * dt;

      if (dist <= moveBy + t.radius) {
        applyProjectileHit(p, t);

        // Check death
        if (t.hp <= 0) {
          const idx = enemies.indexOf(t);
          if (idx !== -1) killEnemy(t, idx);
        }

        projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * moveBy;
        p.y += (dy / dist) * moveBy;
      }
    }
  }

  function updateSpawner(dt) {
    if (waveEnemies.length > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy(waveEnemies.shift());
        spawnTimer = 0.6;
      }
    }

    // Wave complete check
    if (waveEnemies.length === 0 && enemies.length === 0 && !waveComplete) {
      waveComplete = true;
      waveCountdown = 3;
      state = STATE_BUILD;
      warningActive = false;

      // Start auto-wave timer
      if (autoWaveMode)
        autoWaveTimer = AUTO_WAVE_DELAY;

      if (currentWave >= totalWaves)
        triggerVictory();
    }
  }

  function updateBuildCountdown(dt) {
    if (state !== STATE_BUILD) return;

    if (waveCountdown > 0)
      waveCountdown -= dt;

    // Pre-wave warning: activate when countdown gets low
    if (!warningActive && waveCountdown <= WARNING_DURATION && waveCountdown > 0)
      beginPreWaveWarning();

    if (warningActive) {
      warningTimer -= dt;
      warningPulse += dt * 4;
      if (warningTimer <= 0)
        warningActive = false;
    }

    // Auto-wave mode
    if (autoWaveMode && waveComplete) {
      autoWaveTimer -= dt;
      if (autoWaveTimer <= 0)
        startNextWave();
    }
  }

  function updateGame(dt) {
    animTime += dt;

    if (state === STATE_PLAYING) {
      const scaledDt = dt * gameSpeed;
      updateSpawner(scaledDt);
      updateEnemies(scaledDt);
      updateTowers(scaledDt);
      updateProjectiles(scaledDt);
    } else if (state === STATE_BUILD) {
      updateBuildCountdown(dt);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- IMPROVED VISUALS
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    // Background grass texture
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#0d1a0d');
    bgGrad.addColorStop(1, '#0a140a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Path tiles with gradient
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      const px = c * CELL;
      const py = r * CELL;
      const pathGrad = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
      pathGrad.addColorStop(0, '#2a1a0a');
      pathGrad.addColorStop(1, '#1e1208');
      ctx.fillStyle = pathGrad;
      ctx.fillRect(px, py, CELL, CELL);

      // Subtle path border
      ctx.strokeStyle = 'rgba(80, 50, 20, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; ++c) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; ++r) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }

    // Hover highlight
    if (hoverCell && (state === STATE_BUILD || state === STATE_PLAYING)) {
      const hcol = hoverCell.col;
      const hrow = hoverCell.row;
      // Don't show hover on palette area
      if (hrow * CELL < PALETTE_Y) {
        const valid = canPlace(hcol, hrow);
        ctx.fillStyle = valid ? 'rgba(0,255,0,0.15)' : 'rgba(255,0,0,0.15)';
        ctx.fillRect(hcol * CELL, hrow * CELL, CELL, CELL);

        // Show range preview when hovering with valid placement
        if (valid) {
          const def = TOWER_TYPES[selectedTowerType];
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hcol * CELL + CELL / 2, hrow * CELL + CELL / 2, def.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  /* ── Path visualization: direction arrows and spawn/exit markers ── */
  function drawPathVisualization() {
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;

    const mapDef = MAPS[currentMap];
    const wp = mapDef.path;

    // Draw direction arrows along path
    const arrowSpacing = 3;
    let stepCount = 0;
    const pulse = 0.4 + 0.3 * Math.sin(animTime * 2);

    walkPath(wp, (x, y) => {
      ++stepCount;
      if (stepCount % arrowSpacing !== 0) return;
      if (stepCount >= pathPoints.length - 1) return;

      const idx = stepCount;
      if (idx >= pathPoints.length - 1) return;

      const from = pathPoints[idx];
      const to = pathPoints[Math.min(idx + 1, pathPoints.length - 1)];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;

      const angle = Math.atan2(dy, dx);
      const cx = from.x;
      const cy = from.y;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(255, 200, 80, ${pulse * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Spawn point marker (pulsing)
    if (pathPoints.length > 0) {
      const spawn = pathPoints[0];
      const spawnPulse = 0.5 + 0.5 * Math.sin(animTime * 3);

      ctx.save();
      ctx.strokeStyle = `rgba(0, 255, 100, ${spawnPulse * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, 14 + spawnPulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(0, 255, 100, ${spawnPulse * 0.4})`;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SPAWN', spawn.x, spawn.y - 18);
      ctx.restore();

      // Exit point marker
      const exit = pathPoints[pathPoints.length - 1];
      const exitPulse = 0.5 + 0.5 * Math.sin(animTime * 3 + 1);

      ctx.save();
      ctx.strokeStyle = `rgba(255, 60, 60, ${exitPulse * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, 14 + exitPulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 60, 60, ${exitPulse * 0.4})`;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('EXIT', exit.x, exit.y - 18);
      ctx.restore();
    }
  }

  /* ── Pre-wave warning animation ── */
  function drawPreWaveWarning() {
    if (!warningActive || pathPoints.length === 0) return;

    const spawn = pathPoints[0];
    const pulse = Math.abs(Math.sin(warningPulse));

    // Flashing exclamation near spawn
    ctx.save();
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse * 0.9})`;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', spawn.x, spawn.y - 28);

    // Expanding warning rings
    for (let ring = 0; ring < 3; ++ring) {
      const ringPhase = (warningPulse + ring * 0.7) % 3;
      const ringRadius = 10 + ringPhase * 15;
      const ringAlpha = Math.max(0, 0.6 - ringPhase * 0.2);
      ctx.strokeStyle = `rgba(255, 80, 40, ${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(spawn.x, spawn.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Directional arrow from spawn showing entry direction
    if (pathPoints.length > 1) {
      const next = pathPoints[1];
      const dx = next.x - spawn.x;
      const dy = next.y - spawn.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const angle = Math.atan2(dy, dx);
        const arrowX = spawn.x - Math.cos(angle) * 30;
        const arrowY = spawn.y - Math.sin(angle) * 30;

        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(255, 100, 40, ${pulse * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

    // Warning countdown text at top
    ctx.save();
    ctx.fillStyle = `rgba(255, 200, 50, ${pulse})`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Enemies incoming in ${Math.ceil(warningTimer)}s`, CANVAS_W / 2, 4);
    ctx.restore();
  }

  /* ── Improved tower drawing with distinct shapes ── */
  function drawTowers() {
    for (const tower of towers) {
      const def = TOWER_TYPES[tower.type];
      const tx = tower.x;
      const ty = tower.y;
      const angle = towerAngles.get(tower) || 0;
      const tierScale = 1 + (tower.tier - 1) * 0.1;

      ctx.save();
      ctx.translate(tx, ty);

      // Glow under tower
      const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 14 * tierScale);
      glowGrad.addColorStop(0, _hexAlpha(def.color, '40'));
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(-16, -16, 32, 32);

      // Base platform
      const baseSize = 11 * tierScale;
      const baseGrad = ctx.createLinearGradient(-baseSize, -baseSize, baseSize, baseSize);
      baseGrad.addColorStop(0, def.color);
      baseGrad.addColorStop(1, def.colorDark);
      ctx.fillStyle = baseGrad;

      // Different shapes per tower type
      switch (def.id) {
        case 'arrow':
          // Diamond base
          ctx.beginPath();
          ctx.moveTo(0, -baseSize);
          ctx.lineTo(baseSize, 0);
          ctx.lineTo(0, baseSize);
          ctx.lineTo(-baseSize, 0);
          ctx.closePath();
          ctx.fill();
          // Turret
          ctx.save();
          ctx.rotate(angle);
          ctx.fillStyle = '#8d6';
          ctx.fillRect(-2, -2, 14, 4);
          ctx.fillRect(10, -4, 4, 8); // arrowhead
          ctx.restore();
          break;

        case 'cannon':
          // Round base
          ctx.beginPath();
          ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
          ctx.fill();
          // Barrel
          ctx.save();
          ctx.rotate(angle);
          ctx.fillStyle = '#742';
          ctx.fillRect(-3, -3, 16, 6);
          ctx.fillStyle = '#555';
          ctx.fillRect(10, -5, 6, 10); // muzzle
          ctx.restore();
          break;

        case 'frost':
          // Hexagonal base
          ctx.beginPath();
          for (let p = 0; p < 6; ++p) {
            const a = (Math.PI / 3) * p - Math.PI / 6;
            const px = Math.cos(a) * baseSize;
            const py = Math.sin(a) * baseSize;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          // Ice crystal on top (rotating)
          ctx.save();
          ctx.rotate(animTime * 0.5);
          ctx.strokeStyle = '#aef';
          ctx.lineWidth = 2;
          for (let p = 0; p < 6; ++p) {
            const a = (Math.PI / 3) * p;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
            ctx.stroke();
          }
          ctx.restore();
          break;

        case 'lightning':
          // Square base with notched corners
          ctx.fillRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
          // Lightning bolt symbol
          ctx.save();
          ctx.fillStyle = '#ff0';
          ctx.beginPath();
          ctx.moveTo(-3, -7);
          ctx.lineTo(3, -2);
          ctx.lineTo(0, -2);
          ctx.lineTo(3, 7);
          ctx.lineTo(-3, 2);
          ctx.lineTo(0, 2);
          ctx.closePath();
          ctx.fill();
          // Electric crackle effect
          if (Math.random() < 0.3) {
            ctx.strokeStyle = `rgba(255, 255, 100, ${0.3 + Math.random() * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const ex = (Math.random() - 0.5) * 20;
            const ey = (Math.random() - 0.5) * 20;
            ctx.moveTo(0, 0);
            ctx.lineTo(ex * 0.5, ey * 0.5);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
          ctx.restore();
          break;

        case 'laser':
          // Octagonal base
          ctx.beginPath();
          for (let p = 0; p < 8; ++p) {
            const a = (Math.PI / 4) * p;
            const px = Math.cos(a) * baseSize;
            const py = Math.sin(a) * baseSize;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          // Laser emitter
          ctx.save();
          ctx.rotate(angle);
          ctx.fillStyle = '#f8f';
          ctx.fillRect(-2, -1.5, 16, 3);
          // Lens
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(14, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case 'poison':
          // Bubbling cauldron shape
          ctx.beginPath();
          ctx.arc(0, 2, baseSize, 0, Math.PI);
          ctx.lineTo(-baseSize, -3);
          ctx.quadraticCurveTo(-baseSize - 2, -baseSize, 0, -baseSize);
          ctx.quadraticCurveTo(baseSize + 2, -baseSize, baseSize, -3);
          ctx.closePath();
          ctx.fill();
          // Bubbles
          const bubblePhase = animTime * 2;
          for (let b = 0; b < 3; ++b) {
            const bx = Math.sin(bubblePhase + b * 2) * 5;
            const by = -5 - ((bubblePhase + b * 1.3) % 2) * 6;
            const br = 1.5 + Math.sin(bubblePhase + b) * 0.5;
            ctx.fillStyle = `rgba(80, 255, 120, ${0.5 - ((bubblePhase + b * 1.3) % 2) * 0.2})`;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'tesla':
          // Cylindrical coil shape
          ctx.beginPath();
          ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
          ctx.fill();
          // Tesla coil rings
          ctx.strokeStyle = '#8ff';
          ctx.lineWidth = 1.5;
          for (let r = 0; r < 3; ++r) {
            const rr = 4 + r * 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, rr, rr * 0.4, animTime * 1.5 + r, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Sparks
          if (Math.random() < 0.4) {
            ctx.strokeStyle = `rgba(100, 220, 255, ${0.5 + Math.random() * 0.5})`;
            ctx.lineWidth = 1;
            const sa = Math.random() * Math.PI * 2;
            const sr = baseSize + Math.random() * 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(sa) * (baseSize - 2), Math.sin(sa) * (baseSize - 2));
            ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
            ctx.stroke();
          }
          break;

        case 'mortar':
          // Sturdy square with reinforced corners
          ctx.fillRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
          // Corner reinforcements
          ctx.fillStyle = def.colorDark;
          const cs = 4;
          ctx.fillRect(-baseSize, -baseSize, cs, cs);
          ctx.fillRect(baseSize - cs, -baseSize, cs, cs);
          ctx.fillRect(-baseSize, baseSize - cs, cs, cs);
          ctx.fillRect(baseSize - cs, baseSize - cs, cs, cs);
          // Mortar tube (angled up)
          ctx.save();
          ctx.rotate(angle);
          ctx.fillStyle = '#8a7560';
          ctx.fillRect(-4, -4, 12, 8);
          ctx.fillStyle = '#333';
          ctx.beginPath();
          ctx.arc(8, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;

        case 'flame':
          // Triangular/flame-shaped base
          ctx.beginPath();
          ctx.moveTo(0, -baseSize);
          ctx.lineTo(baseSize, baseSize * 0.7);
          ctx.lineTo(-baseSize, baseSize * 0.7);
          ctx.closePath();
          ctx.fill();
          // Animated flame on top
          ctx.save();
          ctx.rotate(angle);
          const flicker = Math.sin(animTime * 8) * 2;
          const flameGrad = ctx.createRadialGradient(8, 0, 1, 8, 0, 8 + flicker);
          flameGrad.addColorStop(0, '#fff');
          flameGrad.addColorStop(0.3, '#fa4');
          flameGrad.addColorStop(0.7, '#f60');
          flameGrad.addColorStop(1, 'rgba(255,100,0,0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.arc(8, 0, 8 + flicker, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
      }

      // Tier pips (small dots)
      for (let p = 0; p < tower.tier; ++p) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-6 + p * 6, baseSize + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Range circle for selected tower
      if (selectedTower === tower) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tx, ty, tower.range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /* ── Improved enemy drawing with distinct shapes ── */
  function drawEnemies() {
    for (const e of enemies) {
      const ex = e.x;
      const ey = e.y;
      const r = e.radius;

      ctx.save();
      ctx.translate(ex, ey);

      // Direction for facing
      let faceAngle = 0;
      if (e.pathIndex < pathPoints.length - 1) {
        const to = pathPoints[Math.min(e.pathIndex + 1, pathPoints.length - 1)];
        faceAngle = Math.atan2(to.y - ey, to.x - ex);
      }

      // Glow
      ctx.shadowBlur = e.isBoss ? 10 : 4;
      ctx.shadowColor = e.color;

      switch (e.type) {
        case 'normal':
          // Circle with inner gradient
          {
            const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
            grad.addColorStop(0, '#f88');
            grad.addColorStop(1, e.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'fast':
          // Elongated diamond (shows speed)
          ctx.save();
          ctx.rotate(faceAngle);
          {
            const grad = ctx.createLinearGradient(-r, 0, r, 0);
            grad.addColorStop(0, '#2a2');
            grad.addColorStop(0.5, '#8f8');
            grad.addColorStop(1, e.color);
            ctx.fillStyle = grad;
          }
          ctx.beginPath();
          ctx.moveTo(r + 2, 0);
          ctx.lineTo(0, -r + 1);
          ctx.lineTo(-r - 1, 0);
          ctx.lineTo(0, r - 1);
          ctx.closePath();
          ctx.fill();
          // Speed lines
          ctx.strokeStyle = `rgba(100, 255, 100, ${0.3 + Math.sin(animTime * 10) * 0.2})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(-r - 3, -2);
          ctx.lineTo(-r - 7, -2);
          ctx.moveTo(-r - 2, 2);
          ctx.lineTo(-r - 6, 2);
          ctx.stroke();
          ctx.restore();
          break;

        case 'armored':
          // Thick square with border (tank)
          {
            const grad = ctx.createLinearGradient(-r, -r, r, r);
            grad.addColorStop(0, '#aaa');
            grad.addColorStop(0.5, '#ccc');
            grad.addColorStop(1, '#666');
            ctx.fillStyle = grad;
          }
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-r + 1, -r + 1, r * 2 - 2, r * 2 - 2);
          break;

        case 'flying':
          // Wing shape
          ctx.save();
          ctx.rotate(faceAngle);
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(-r, -r - 2);
          ctx.lineTo(-r + 3, 0);
          ctx.lineTo(-r, r + 2);
          ctx.closePath();
          ctx.fill();
          // Animated wing flap
          {
            const wingFlap = Math.sin(animTime * 12) * 3;
            ctx.strokeStyle = '#aaf';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-2, 0);
            ctx.lineTo(-4, -r - wingFlap);
            ctx.moveTo(-2, 0);
            ctx.lineTo(-4, r + wingFlap);
            ctx.stroke();
          }
          ctx.restore();
          break;

        case 'boss':
          // Large spiked circle
          {
            const grad = ctx.createRadialGradient(0, -2, 2, 0, 0, r);
            grad.addColorStop(0, '#f8f');
            grad.addColorStop(0.5, e.color);
            grad.addColorStop(1, '#808');
            ctx.fillStyle = grad;
          }
          // Spikes
          ctx.beginPath();
          const spikes = 8;
          for (let s = 0; s < spikes; ++s) {
            const a = (Math.PI * 2 / spikes) * s + animTime * 0.3;
            const outerR = r + 4;
            const innerR = r - 2;
            ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
            const midA = a + Math.PI / spikes;
            ctx.lineTo(Math.cos(midA) * innerR, Math.sin(midA) * innerR);
          }
          ctx.closePath();
          ctx.fill();
          // Inner eye
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f0f';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'healer':
          // Green circle with cross
          {
            const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
            grad.addColorStop(0, '#8f8');
            grad.addColorStop(1, e.color);
            ctx.fillStyle = grad;
          }
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          // Plus/cross symbol
          ctx.fillStyle = '#fff';
          ctx.fillRect(-1, -r + 2, 2, r * 2 - 4);
          ctx.fillRect(-r + 2, -1, r * 2 - 4, 2);
          // Healing aura pulse
          {
            const auraPulse = 0.2 + 0.2 * Math.sin(animTime * 4);
            ctx.strokeStyle = `rgba(100, 255, 100, ${auraPulse})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case 'swarm':
          // Tiny triangle (fast and numerous)
          ctx.save();
          ctx.rotate(faceAngle);
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(-r, -r);
          ctx.lineTo(-r, r);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;

        case 'shield':
          // Circle with shield ring
          {
            const grad = ctx.createRadialGradient(0, -1, 1, 0, 0, r);
            grad.addColorStop(0, '#8ff');
            grad.addColorStop(1, e.color);
            ctx.fillStyle = grad;
          }
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          // Shield ring (fades as shield depletes)
          if (e.shieldHp > 0) {
            const shieldRatio = e.shieldHp / (e.maxHp * 0.4);
            ctx.strokeStyle = `rgba(80, 255, 255, ${shieldRatio * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r + 3, 0, Math.PI * 2 * shieldRatio);
            ctx.stroke();
          }
          break;
      }

      ctx.shadowBlur = 0;

      // Slow indicator
      if (e.slowTimer > 0) {
        ctx.strokeStyle = 'rgba(100, 170, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // DoT indicator
      if (e.dotTimer > 0) {
        ctx.strokeStyle = 'rgba(0, 200, 80, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      // Health bar (above enemy)
      const barW = r * 2 + 4;
      const barH = 3;
      const barX = ex - barW / 2;
      const barY = ey - r - 7;
      const hpRatio = Math.max(0, e.hp / e.maxHp);

      ctx.fillStyle = '#300';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Shield bar (below health bar)
      if (e.isShielded && e.shieldHp > 0) {
        const shieldRatio = e.shieldHp / (e.maxHp * 0.4);
        ctx.fillStyle = '#024';
        ctx.fillRect(barX, barY + barH + 1, barW, 2);
        ctx.fillStyle = '#4ff';
        ctx.fillRect(barX, barY + barH + 1, barW * shieldRatio, 2);
      }
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      // Trail
      if (p.trail.length > 1) {
        ctx.strokeStyle = _hexAlpha(p.color, '40');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; ++t)
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // Projectile body
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* ── Tower selection palette (always visible during gameplay) ── */
  function drawTowerPalette() {
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;

    // Background bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, PALETTE_Y, CANVAS_W, PALETTE_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, PALETTE_Y);
    ctx.lineTo(CANVAS_W, PALETTE_Y);
    ctx.stroke();

    // Tower buttons
    for (let i = 0; i < TOWER_TYPES.length; ++i) {
      const def = TOWER_TYPES[i];
      const bx = 4 + i * (PALETTE_BTN_W + PALETTE_BTN_GAP);
      const by = PALETTE_BTN_Y;
      const selected = i === selectedTowerType;
      const canAfford = gold >= def.cost;

      // Button background
      if (selected) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, by, PALETTE_BTN_W, PALETTE_BTN_H);
        ctx.strokeRect(bx, by, PALETTE_BTN_W, PALETTE_BTN_H);
      } else {
        ctx.fillStyle = 'rgba(40,40,40,0.8)';
        ctx.fillRect(bx, by, PALETTE_BTN_W, PALETTE_BTN_H);
      }

      // Color swatch
      ctx.fillStyle = canAfford ? def.color : '#555';
      ctx.fillRect(bx + 3, by + 3, 10, 10);

      // Name and cost
      ctx.fillStyle = canAfford ? (selected ? '#fff' : '#bbb') : '#666';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(def.name, bx + 16, by + 2);
      ctx.fillStyle = canAfford ? '#fa0' : '#644';
      ctx.font = '7px sans-serif';
      ctx.fillText(`${def.cost}g`, bx + 16, by + 12);

      // Hotkey number
      if (i < 9) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${i + 1}`, bx + PALETTE_BTN_W - 3, by + 2);
      }

      // Brief description
      ctx.fillStyle = selected ? '#aaa' : '#666';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(def.desc, bx + 16, by + 22);
    }

    // Right-side HUD buttons
    const rightX = CANVAS_W - 4;

    // Start Wave / Next Wave button
    if (state === STATE_BUILD) {
      const btnX = rightX - HUD_BTN_W - 68 - 4;
      const btnY = PALETTE_BTN_Y + 2;
      ctx.fillStyle = '#2a5a2a';
      ctx.strokeStyle = '#4a4';
      ctx.lineWidth = 1;
      ctx.fillRect(btnX, btnY, HUD_BTN_W + 4, HUD_BTN_H);
      ctx.strokeRect(btnX, btnY, HUD_BTN_W + 4, HUD_BTN_H);
      ctx.fillStyle = '#8f8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Start Wave', btnX + (HUD_BTN_W + 4) / 2, btnY + HUD_BTN_H / 2);
    }

    // Fast Forward button
    if (state === STATE_PLAYING) {
      const btnX = rightX - HUD_BTN_W - 68 - 4;
      const btnY = PALETTE_BTN_Y + 2;
      ctx.fillStyle = gameSpeed > 1 ? '#5a5a2a' : '#2a2a2a';
      ctx.strokeStyle = gameSpeed > 1 ? '#aa0' : '#666';
      ctx.lineWidth = 1;
      ctx.fillRect(btnX, btnY, HUD_BTN_W + 4, HUD_BTN_H);
      ctx.strokeRect(btnX, btnY, HUD_BTN_W + 4, HUD_BTN_H);
      ctx.fillStyle = gameSpeed > 1 ? '#ff0' : '#aaa';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Speed ${gameSpeed}x`, btnX + (HUD_BTN_W + 4) / 2, btnY + HUD_BTN_H / 2);
    }

    // Auto-wave toggle
    {
      const btnX = rightX - 64;
      const btnY = PALETTE_BTN_Y + 2;
      ctx.fillStyle = autoWaveMode ? '#2a4a5a' : '#2a2a2a';
      ctx.strokeStyle = autoWaveMode ? '#4af' : '#666';
      ctx.lineWidth = 1;
      ctx.fillRect(btnX, btnY, 60, HUD_BTN_H);
      ctx.strokeRect(btnX, btnY, 60, HUD_BTN_H);
      ctx.fillStyle = autoWaveMode ? '#8cf' : '#888';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(autoWaveMode ? 'AUTO: ON' : 'AUTO: OFF', btnX + 30, btnY + HUD_BTN_H / 2);
    }

    // Auto-wave countdown
    if (autoWaveMode && state === STATE_BUILD && waveComplete && autoWaveTimer > 0) {
      const btnX = rightX - 64;
      const btnY = PALETTE_BTN_Y + HUD_BTN_H + 4;
      ctx.fillStyle = '#aaf';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`Next: ${Math.ceil(autoWaveTimer)}s`, btnX + 30, btnY);
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Selected tower info panel ── */
  function drawSelectedTowerInfo() {
    if (!selectedTower) return;
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return;

    const def = TOWER_TYPES[selectedTower.type];
    const panelX = 4;
    const panelY = PALETTE_Y - 58;
    const panelW = 160;
    const panelH = 54;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${def.name} (Tier ${selectedTower.tier})`, panelX + 4, panelY + 3);

    ctx.fillStyle = '#aaa';
    ctx.font = '9px sans-serif';
    ctx.fillText(`DMG: ${selectedTower.damage}  RNG: ${selectedTower.range}  Kills: ${selectedTower.kills || 0}`, panelX + 4, panelY + 16);

    // Upgrade button
    if (selectedTower.tier < MAX_TIER) {
      const uc = getUpgradeCost(selectedTower);
      const canUp = gold >= uc;
      ctx.fillStyle = canUp ? '#2a5a2a' : '#3a2a2a';
      ctx.fillRect(panelX + 4, panelY + 30, 70, 16);
      ctx.strokeStyle = canUp ? '#4a4' : '#644';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(panelX + 4, panelY + 30, 70, 16);
      ctx.fillStyle = canUp ? '#8f8' : '#866';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Upgrade ${uc}g`, panelX + 39, panelY + 35);
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAX TIER', panelX + 39, panelY + 35);
    }

    // Sell button
    const sv = getSellValue(selectedTower);
    ctx.fillStyle = '#5a2a2a';
    ctx.fillRect(panelX + 80, panelY + 30, 70, 16);
    ctx.strokeStyle = '#a44';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(panelX + 80, panelY + 30, 70, 16);
    ctx.fillStyle = '#f88';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Sell +${sv}g`, panelX + 115, panelY + 35);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Context menu (right-click on tower) ── */
  function drawContextMenu() {
    if (!contextMenu) return;

    const { x, y, tower } = contextMenu;
    const def = TOWER_TYPES[tower.type];
    const menuW = 110;
    const menuH = tower.tier < MAX_TIER ? 52 : 34;

    // Keep menu on screen
    const mx = Math.min(x, CANVAS_W - menuW - 4);
    const my = Math.min(y, CANVAS_H - menuH - 4);

    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.fillRect(mx, my, menuW, menuH);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, menuW, menuH);

    // Store menu bounds for click detection
    contextMenu.mx = mx;
    contextMenu.my = my;
    contextMenu.menuW = menuW;
    contextMenu.menuH = menuH;

    let itemY = my + 2;

    // Upgrade option
    if (tower.tier < MAX_TIER) {
      const uc = getUpgradeCost(tower);
      const canUp = gold >= uc;
      ctx.fillStyle = canUp ? '#8f8' : '#866';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Upgrade (${uc}g)`, mx + 6, itemY + 2);
      contextMenu.upgradeY = itemY;
      itemY += 18;
    }

    // Sell option
    const sv = getSellValue(tower);
    ctx.fillStyle = '#f88';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Sell (+${sv}g)`, mx + 6, itemY + 2);
    contextMenu.sellY = itemY;
    itemY += 18;

    // Info
    ctx.fillStyle = '#aaa';
    ctx.font = '8px sans-serif';
    ctx.fillText(`${def.name} T${tower.tier} | Kills: ${tower.kills || 0}`, mx + 6, itemY + 2);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fa0';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOWER DEFENSE', CANVAS_W / 2, CANVAS_H / 2 - 80);

      // Subtitle
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Strategic tower defense with 9 tower types and unique enemy varieties', CANVAS_W / 2, CANVAS_H / 2 - 50);

      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Map: ${MAPS[currentMap].name}`, CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.fillText(`${MAPS[currentMap].waves} waves | ${MAPS[currentMap].startGold} gold | ${MAPS[currentMap].startLives} lives`, CANVAS_W / 2, CANVAS_H / 2 + 5);
      ctx.fillStyle = '#ccc';
      ctx.fillText('Click or press Space to start', CANVAS_W / 2, CANVAS_H / 2 + 40);

      // Tower type preview
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('Towers:', CANVAS_W / 2, CANVAS_H / 2 + 70);
      const previewY = CANVAS_H / 2 + 85;
      const totalW = TOWER_TYPES.length * 56;
      const startX = CANVAS_W / 2 - totalW / 2;
      for (let i = 0; i < TOWER_TYPES.length; ++i) {
        const def = TOWER_TYPES[i];
        const px = startX + i * 56;
        ctx.fillStyle = def.color;
        ctx.fillRect(px + 18, previewY - 4, 8, 8);
        ctx.fillStyle = '#999';
        ctx.font = '8px sans-serif';
        ctx.fillText(def.name, px + 10, previewY + 12);
      }

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
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press Escape or click to resume', CANVAS_W / 2, CANVAS_H / 2 + 30);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Survived ${currentWave} waves`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Press F2 or click to try again', CANVAS_W / 2, CANVAS_H / 2 + 35);
      ctx.textAlign = 'start';
    }

    if (state === STATE_VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VICTORY!', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText(`${MAPS[currentMap].name} complete!`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Press F2 or click for next map', CANVAS_W / 2, CANVAS_H / 2 + 35);
      ctx.textAlign = 'start';
    }

    // Top HUD -- Wave / gold / lives
    if (state === STATE_PLAYING || state === STATE_BUILD) {
      // Top bar background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, 22);

      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';

      // Wave info (left)
      ctx.fillStyle = '#fa0';
      ctx.textAlign = 'left';
      ctx.fillText(`Wave ${currentWave}/${totalWaves}`, 8, 11);

      // Gold (center-left)
      ctx.fillStyle = '#ff0';
      ctx.textAlign = 'left';
      ctx.fillText(`Gold: ${gold}`, 130, 11);

      // Lives (center-right)
      ctx.fillStyle = lives <= 5 ? '#f44' : '#4f4';
      ctx.textAlign = 'left';
      ctx.fillText(`Lives: ${lives}`, 250, 11);

      // Speed indicator
      if (gameSpeed > 1) {
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${gameSpeed}x`, 350, 11);
      }

      // Auto-wave indicator
      if (autoWaveMode) {
        ctx.fillStyle = '#8cf';
        ctx.textAlign = 'left';
        ctx.font = '10px sans-serif';
        ctx.fillText('AUTO', 390, 11);
      }

      // Map name (right)
      ctx.fillStyle = '#888';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(MAPS[currentMap].name, CANVAS_W - 8, 11);

      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawGame() {
    drawGrid();

    if (state !== STATE_READY) {
      drawPathVisualization();
      drawPreWaveWarning();
      drawTowers();
      drawEnemies();
      drawProjectiles();
      drawTowerPalette();
      drawSelectedTowerInfo();
      drawContextMenu();
    }

    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusWave) statusWave.textContent = `Wave: ${currentWave}/${totalWaves}`;
    if (statusGold) statusGold.textContent = `Gold: ${gold}`;
    if (statusLives) statusLives.textContent = `Lives: ${lives}`;
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
    ctx.restore();

    updateStatusBar();

    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT -- Mouse-only + keyboard support
     ══════════════════════════════════════════════════════════════════ */

  function togglePause() {
    if (state === STATE_PLAYING)
      state = STATE_PAUSED;
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
  }

  function resetAndStart() {
    loadMap(currentMap);
  }

  function toggleFastForward() {
    gameSpeed = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1;
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height)
    };
  }

  /* ── Palette click detection ── */
  function handlePaletteClick(mx, my) {
    if (my < PALETTE_Y || my > CANVAS_H) return false;

    // Tower type buttons
    for (let i = 0; i < TOWER_TYPES.length; ++i) {
      const bx = 4 + i * (PALETTE_BTN_W + PALETTE_BTN_GAP);
      const by = PALETTE_BTN_Y;
      if (mx >= bx && mx <= bx + PALETTE_BTN_W && my >= by && my <= by + PALETTE_BTN_H) {
        selectedTowerType = i;
        return true;
      }
    }

    // Start Wave button
    if (state === STATE_BUILD) {
      const btnX = CANVAS_W - 4 - HUD_BTN_W - 68 - 4;
      const btnY = PALETTE_BTN_Y + 2;
      if (mx >= btnX && mx <= btnX + HUD_BTN_W + 4 && my >= btnY && my <= btnY + HUD_BTN_H) {
        startNextWave();
        return true;
      }
    }

    // Fast Forward button
    if (state === STATE_PLAYING) {
      const btnX = CANVAS_W - 4 - HUD_BTN_W - 68 - 4;
      const btnY = PALETTE_BTN_Y + 2;
      if (mx >= btnX && mx <= btnX + HUD_BTN_W + 4 && my >= btnY && my <= btnY + HUD_BTN_H) {
        toggleFastForward();
        return true;
      }
    }

    // Auto-wave toggle button
    {
      const btnX = CANVAS_W - 4 - 64;
      const btnY = PALETTE_BTN_Y + 2;
      if (mx >= btnX && mx <= btnX + 60 && my >= btnY && my <= btnY + HUD_BTN_H) {
        autoWaveMode = !autoWaveMode;
        if (autoWaveMode && state === STATE_BUILD && waveComplete)
          autoWaveTimer = AUTO_WAVE_DELAY;
        return true;
      }
    }

    return true; // Consumed by palette area
  }

  /* ── Selected tower info panel click detection ── */
  function handleInfoPanelClick(mx, my) {
    if (!selectedTower) return false;
    if (state !== STATE_BUILD && state !== STATE_PLAYING) return false;

    const panelX = 4;
    const panelY = PALETTE_Y - 58;
    const panelW = 160;
    const panelH = 54;

    if (mx < panelX || mx > panelX + panelW || my < panelY || my > panelY + panelH)
      return false;

    // Upgrade button area
    if (selectedTower.tier < MAX_TIER && mx >= panelX + 4 && mx <= panelX + 74 && my >= panelY + 30 && my <= panelY + 46) {
      upgradeTower(selectedTower);
      return true;
    }

    // Sell button area
    if (mx >= panelX + 80 && mx <= panelX + 150 && my >= panelY + 30 && my <= panelY + 46) {
      sellTower(selectedTower);
      return true;
    }

    return true; // Consumed by panel
  }

  /* ── Context menu click detection ── */
  function handleContextMenuClick(mx, my) {
    if (!contextMenu) return false;
    const { mx: cmx, my: cmy, menuW, menuH, tower, upgradeY, sellY } = contextMenu;

    if (mx < cmx || mx > cmx + menuW || my < cmy || my > cmy + menuH) {
      contextMenu = null;
      return false;
    }

    // Upgrade
    if (upgradeY !== undefined && my >= upgradeY && my < upgradeY + 18) {
      upgradeTower(tower);
      contextMenu = null;
      return true;
    }

    // Sell
    if (sellY !== undefined && my >= sellY && my < sellY + 18) {
      sellTower(tower);
      contextMenu = null;
      return true;
    }

    contextMenu = null;
    return true;
  }

  /* ── Keyboard input ── */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault();
      resetAndStart();
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (contextMenu) {
        contextMenu = null;
        return;
      }
      togglePause();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (state === STATE_READY)
        resetAndStart();
      else if (state === STATE_BUILD)
        startNextWave();
      else if (state === STATE_PLAYING)
        toggleFastForward();
      return;
    }

    // Tower type selection (1-9)
    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
      const idx = parseInt(e.code.charAt(5)) - 1;
      if (idx < TOWER_TYPES.length)
        selectedTowerType = idx;
      return;
    }

    // Upgrade selected tower
    if (e.code === 'KeyU' && selectedTower) {
      upgradeTower(selectedTower);
      return;
    }

    // Sell selected tower
    if (e.code === 'KeyS' && selectedTower) {
      sellTower(selectedTower);
      return;
    }

    // Toggle auto-wave
    if (e.code === 'KeyA') {
      autoWaveMode = !autoWaveMode;
      if (autoWaveMode && state === STATE_BUILD && waveComplete)
        autoWaveTimer = AUTO_WAVE_DELAY;
    }
  });

  /* ── Pointer move ── */
  canvas.addEventListener('pointermove', (e) => {
    const { x: mx, y: my } = getCanvasCoords(e);
    hoverCell = { col: Math.floor(mx / CELL), row: Math.floor(my / CELL) };
  });

  /* ── Left click ── */
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return; // Right-click handled separately

    const { x: mx, y: my } = getCanvasCoords(e);

    // Close context menu on any left click
    if (contextMenu) {
      if (handleContextMenuClick(mx, my)) return;
      contextMenu = null;
    }

    if (state === STATE_READY) {
      resetAndStart();
      return;
    }

    if (state === STATE_PAUSED) {
      togglePause();
      return;
    }

    if (state === STATE_GAME_OVER || state === STATE_VICTORY) {
      if (state === STATE_VICTORY)
        currentMap = (currentMap + 1) % MAPS.length;
      resetAndStart();
      return;
    }

    // Check info panel clicks
    if (handleInfoPanelClick(mx, my)) return;

    // Check palette clicks
    if (my >= PALETTE_Y) {
      handlePaletteClick(mx, my);
      return;
    }

    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);

    // Check if clicking on existing tower
    for (const t of towers) {
      if (t.col === col && t.row === row) {
        selectedTower = t;
        return;
      }
    }

    // Deselect tower when clicking empty space
    selectedTower = null;

    // Try to place tower
    if (state === STATE_BUILD)
      placeTower(col, row, selectedTowerType);
  });

  /* ── Right click (context menu on tower) ── */
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { x: mx, y: my } = getCanvasCoords(e);
    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);

    // Check if right-clicking on a tower
    for (const t of towers) {
      if (t.col === col && t.row === row) {
        selectedTower = t;
        contextMenu = { x: mx, y: my, tower: t };
        return;
      }
    }

    // Right-click on empty space closes context menu
    contextMenu = null;
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
      case 'auto-wave':
        autoWaveMode = !autoWaveMode;
        if (autoWaveMode && state === STATE_BUILD && waveComplete)
          autoWaveTimer = AUTO_WAVE_DELAY;
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
    const mapName = MAPS[currentMap]?.name || '';
    const title = state === STATE_VICTORY
      ? `Tower Defense -- ${mapName} Victory!`
      : state === STATE_GAME_OVER
        ? `Tower Defense -- ${mapName} Game Over`
        : `Tower Defense -- ${mapName} Wave ${currentWave}/${totalWaves}`;
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
  updateWindowTitle();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
