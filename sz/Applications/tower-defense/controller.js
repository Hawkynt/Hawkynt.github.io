;(function() {
  'use strict';

  const SZ = window.SZ;

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

  /* ══════════════════════════════════════════════════════════════════
     TOWER DEFINITIONS
     5 tower types: arrow, cannon, frost, lightning, laser
     ══════════════════════════════════════════════════════════════════ */

  const TOWER_TYPES = [
    { id: 'arrow',     name: 'Arrow',     cost: 50,  damage: 10, range: 120, fireRate: 0.8,  color: '#6b4', projectileColor: '#8d6', projectileSpeed: 300 },
    { id: 'cannon',    name: 'Cannon',    cost: 80,  damage: 35, range: 90,  fireRate: 1.5,  color: '#a63', projectileColor: '#f80', projectileSpeed: 200, splash: 30 },
    { id: 'frost',     name: 'Frost',     cost: 70,  damage: 8,  range: 100, fireRate: 1.0,  color: '#6af', projectileColor: '#aef', projectileSpeed: 250, slow: 0.5 },
    { id: 'lightning', name: 'Lightning', cost: 120, damage: 25, range: 140, fireRate: 1.2,  color: '#ff0', projectileColor: '#ff8', projectileSpeed: 600, chain: 2 },
    { id: 'laser',     name: 'Laser',     cost: 150, damage: 50, range: 160, fireRate: 2.0,  color: '#f0f', projectileColor: '#f8f', projectileSpeed: 800 }
  ];

  /* ── Upgrade multipliers per tier ── */
  const UPGRADE_COST_MULT = [0, 0.6, 1.0, 1.5];
  const UPGRADE_DAMAGE_MULT = [1, 1.4, 1.8, 2.4];
  const UPGRADE_RANGE_MULT = [1, 1.1, 1.2, 1.35];

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEFINITIONS
     Types: normal, fast, armored, flying, boss
     ══════════════════════════════════════════════════════════════════ */

  const ENEMY_TYPES = {
    normal:  { hp: 40,  speed: 40, bounty: 10, color: '#c44', radius: 6 },
    fast:    { hp: 25,  speed: 70, bounty: 12, color: '#4c4', radius: 5 },
    armored: { hp: 120, speed: 25, bounty: 25, color: '#888', radius: 8 },
    flying:  { hp: 35,  speed: 50, bounty: 15, color: '#88f', radius: 5 },
    boss:    { hp: 500, speed: 20, bounty: 100, color: '#f0f', radius: 12 }
  };

  /* ══════════════════════════════════════════════════════════════════
     MAPS — 12 maps with paths defined as waypoint sequences
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
        x0 += dx;
        y0 += dy;
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

    buildPathCells(mapDef);
    pathPoints = getPathPoints(mapDef);

    state = STATE_BUILD;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     TOWER PLACEMENT & UPGRADE
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
      fireCooldown: 0
    };
    towers.push(tower);

    // Construction sparkle effect
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

    // Upgrade sparkle
    particles.sparkle(tower.x, tower.y, 15, { color: '#ff0', speed: 4 });
    particles.burst(tower.x, tower.y, 8, { color: def.color, speed: 2, life: 0.5 });
    floatingText.add(tower.x, tower.y - 16, `Tier ${tower.tier}!`, { color: '#ff0', font: 'bold 12px sans-serif' });
    screenShake.trigger(2, 80);

    return true;
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
      if (waveNum >= 8 && roll < 0.05) type = 'boss';
      else if (waveNum >= 4 && roll < 0.2) type = 'armored';
      else if (waveNum >= 2 && roll < 0.35) type = 'fast';
      else if (waveNum >= 3 && roll < 0.45) type = 'flying';
      queue.push(type);
    }
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

    floatingText.add(CANVAS_W / 2, 30, `Wave ${currentWave}`, { color: '#ff0', font: 'bold 16px sans-serif' });

    // Wave bonus/interest
    const bonus = Math.floor(gold * 0.05) + 10;
    gold += bonus;
    floatingText.add(CANVAS_W / 2, 50, `+${bonus}g interest`, { color: '#8f8', font: '11px sans-serif' });
    updateWindowTitle();
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
      isBoss: type === 'boss'
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
      towerType: tower.type
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEATH & LEAK
     ══════════════════════════════════════════════════════════════════ */

  function killEnemy(enemy, index) {
    // Burst particles on death
    particles.burst(enemy.x, enemy.y, 12, { color: enemy.color, speed: 3, life: 0.6 });

    // Gold reward
    gold += enemy.bounty;
    floatingText.add(enemy.x, enemy.y - 16, `+${enemy.bounty}g`, { color: '#ff0', font: 'bold 11px sans-serif' });

    // Boss kill: big screen shake
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

      // Slow effect
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        e.speed = e.baseSpeed * 0.5;
      } else {
        e.speed = e.baseSpeed;
      }

      // Move along path — interpolate smoothly
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

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; --i) {
      const p = projectiles[i];
      const t = p.targetEnemy;

      if (!t || t.hp <= 0 || !enemies.includes(t)) {
        projectiles.splice(i, 1);
        continue;
      }

      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveBy = p.speed * dt;

      if (dist <= moveBy + t.radius) {
        // Hit
        t.hp -= p.damage;

        // Slow effect
        if (p.slow > 0)
          t.slowTimer = 2;

        // Splash damage
        if (p.splash > 0) {
          for (const other of enemies) {
            if (other === t) continue;
            const sdx = other.x - t.x;
            const sdy = other.y - t.y;
            if (Math.sqrt(sdx * sdx + sdy * sdy) < p.splash)
              other.hp -= Math.floor(p.damage * 0.5);
          }
        }

        // Check death
        if (t.hp <= 0) {
          const idx = enemies.indexOf(t);
          if (idx !== -1) killEnemy(t, idx);
        }

        projectiles.splice(i, 1);
      } else {
        // Move toward target
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

      if (currentWave >= totalWaves)
        triggerVictory();
    }
  }

  function updateBuildCountdown(dt) {
    if (state === STATE_BUILD && waveCountdown > 0) {
      waveCountdown -= dt;
    }
  }

  function updateGame(dt) {
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
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    // Path tiles
    ctx.fillStyle = '#2a1a0a';
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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
      const valid = canPlace(hoverCell.col, hoverCell.row);
      ctx.fillStyle = valid ? 'rgba(0,255,0,0.15)' : 'rgba(255,0,0,0.15)';
      ctx.fillRect(hoverCell.col * CELL, hoverCell.row * CELL, CELL, CELL);
    }
  }

  function drawTowers() {
    for (const tower of towers) {
      const def = TOWER_TYPES[tower.type];
      ctx.fillStyle = def.color;
      ctx.shadowBlur = 4 + tower.tier * 2;
      ctx.shadowColor = def.color;

      // Base
      ctx.fillRect(tower.x - 10, tower.y - 10, 20, 20);

      // Tier indicator
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tower.tier}`, tower.x, tower.y);
      ctx.shadowBlur = 0;

      // Range circle for selected tower
      if (selectedTower === tower) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.textAlign = 'start';
  }

  function drawEnemies() {
    for (const e of enemies) {
      // Body
      ctx.fillStyle = e.color;
      ctx.shadowBlur = e.isBoss ? 8 : 3;
      ctx.shadowColor = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Health bar
      const barW = e.radius * 2 + 4;
      const barH = 3;
      const barX = e.x - barW / 2;
      const barY = e.y - e.radius - 6;
      const hpRatio = Math.max(0, e.hp / e.maxHp);

      ctx.fillStyle = '#300';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fa0';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOWER DEFENSE', CANVAS_W / 2, CANVAS_H / 2 - 60);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Place towers to defend against enemy waves', CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.fillText(`Map: ${MAPS[currentMap].name}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Press F2 or click to start', CANVAS_W / 2, CANVAS_H / 2 + 40);
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

    if (state === STATE_BUILD) {
      // Tower palette
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, CANVAS_H - 36, CANVAS_W, 36);
      for (let i = 0; i < TOWER_TYPES.length; ++i) {
        const def = TOWER_TYPES[i];
        const bx = 10 + i * 130;
        const by = CANVAS_H - 30;
        ctx.fillStyle = i === selectedTowerType ? '#fff' : '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${i + 1}: ${def.name} (${def.cost}g)`, bx, by + 10);
      }

      if (waveCountdown > 0) {
        ctx.fillStyle = '#aaa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Next wave in ${Math.ceil(waveCountdown)}s — Space to start`, CANVAS_W - 10, CANVAS_H - 42);
        ctx.textAlign = 'start';
      }
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
      ctx.fillText('Press F2 to try again', CANVAS_W / 2, CANVAS_H / 2 + 35);
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
      ctx.fillText('Press F2 for next map', CANVAS_W / 2, CANVAS_H / 2 + 35);
      ctx.textAlign = 'start';
    }

    // Speed indicator
    if (state === STATE_PLAYING && gameSpeed > 1) {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${gameSpeed}x`, 10, 18);
    }

    // Wave / gold / lives overlay
    if (state === STATE_PLAYING || state === STATE_BUILD) {
      ctx.fillStyle = '#ccc';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Wave ${currentWave}/${totalWaves}  Gold: ${gold}  Lives: ${lives}`, CANVAS_W - 10, 14);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawGrid();

    if (state !== STATE_READY) {
      drawTowers();
      drawEnemies();
      drawProjectiles();
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
     INPUT
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

    if (e.code === 'Space') {
      e.preventDefault();
      if (state === STATE_READY) {
        resetAndStart();
      } else if (state === STATE_BUILD) {
        startNextWave();
      } else if (state === STATE_PLAYING) {
        toggleFastForward();
      }
      return;
    }

    // Tower type selection (1-5)
    if (e.code >= 'Digit1' && e.code <= 'Digit5') {
      selectedTowerType = parseInt(e.code.charAt(5)) - 1;
      return;
    }

    // Upgrade selected tower
    if (e.code === 'KeyU' && selectedTower) {
      upgradeTower(selectedTower);
      return;
    }

    // Sell selected tower
    if (e.code === 'KeyS' && selectedTower) {
      const def = TOWER_TYPES[selectedTower.type];
      const refund = Math.floor(def.cost * 0.6 * selectedTower.tier);
      gold += refund;
      const idx = towers.indexOf(selectedTower);
      if (idx !== -1) towers.splice(idx, 1);
      floatingText.add(selectedTower.x, selectedTower.y - 16, `+${refund}g`, { color: '#8f8', font: 'bold 11px sans-serif' });
      selectedTower = null;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    hoverCell = { col: Math.floor(mx / CELL), row: Math.floor(my / CELL) };
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (state === STATE_READY) {
      resetAndStart();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);

    // Check if clicking on existing tower
    for (const t of towers) {
      if (t.col === col && t.row === row) {
        selectedTower = t;
        return;
      }
    }

    // Try to place tower
    if (state === STATE_BUILD || state === STATE_PLAYING)
      placeTower(col, row, selectedTowerType);
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
    const mapName = MAPS[currentMap]?.name || '';
    const title = state === STATE_VICTORY
      ? `Tower Defense — ${mapName} Victory!`
      : state === STATE_GAME_OVER
        ? `Tower Defense — ${mapName} Game Over`
        : `Tower Defense — ${mapName} Wave ${currentWave}/${totalWaves}`;
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
