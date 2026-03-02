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

  /* ── Views ── */
  const VIEW_SURFACE = 'SURFACE';
  const VIEW_UNDERGROUND = 'UNDERGROUND';

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 5;

  /* ── Underground Grid ── */
  const GRID_COLS = 14;
  const GRID_ROWS = 10;
  const TILE_SIZE = 40;
  const GRID_OFFSET_X = 70;
  const GRID_OFFSET_Y = 60;

  /* ── Tile Types ── */
  const TILE_EMPTY = 0;
  const TILE_DIRT = 1;
  const TILE_IRON = 2;
  const TILE_WATER = 3;
  const TILE_COBALT = 4;

  const TILE_COLORS = {
    [TILE_DIRT]: '#4a3a2a',
    [TILE_IRON]: '#888',
    [TILE_WATER]: '#48f',
    [TILE_COBALT]: '#44a'
  };

  const TILE_VALUES = {
    [TILE_IRON]: 10,
    [TILE_WATER]: 20,
    [TILE_COBALT]: 40
  };

  const TILE_LABELS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt'
  };

  /* ── Dome ── */
  const DOME_X = CANVAS_W / 2;
  const DOME_Y = 260;
  const DOME_RADIUS = 80;
  const BASE_DOME_HP = 100;

  /* ── Weapon defaults ── */
  const BASE_WEAPON_DAMAGE = 10;
  const BASE_FIRE_RATE = 1.0; // shots per second
  const BASE_DRILL_SPEED = 0.3; // seconds per block
  const BASE_CARRY_CAPACITY = 50;

  /* ── Waves ── */
  const WAVE_INTERVAL = 25; // seconds between waves
  const BASE_ENEMIES_PER_WAVE = 3;

  /* ── Upgrade costs (resource units) ── */
  const UPGRADE_DEFS = [
    { name: 'Weapon Damage', key: 'weaponDamage', baseCost: 30, perLevel: 20 },
    { name: 'Fire Rate', key: 'fireRate', baseCost: 25, perLevel: 15 },
    { name: 'Dome HP', key: 'domeHP', baseCost: 40, perLevel: 25 },
    { name: 'Drill Speed', key: 'drillSpeed', baseCost: 20, perLevel: 10 },
    { name: 'Carry Capacity', key: 'carryCapacity', baseCost: 20, perLevel: 10 }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusView = document.getElementById('statusView');
  const statusWave = document.getElementById('statusWave');
  const statusDome = document.getElementById('statusDome');
  const statusResources = document.getElementById('statusResources');
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

  let state = STATE_READY;
  let currentView = VIEW_SURFACE;
  let transitionProgress = 0; // 0 = fully at current view, >0 = animating
  let transitionTarget = null;

  // Dome
  let domeHP = BASE_DOME_HP;
  let maxDomeHP = BASE_DOME_HP;

  // Resources carried & banked
  let resources = { iron: 0, water: 0, cobalt: 0 };
  let carried = 0;
  let carryCapacity = BASE_CARRY_CAPACITY;

  // Weapon
  let weaponDamage = BASE_WEAPON_DAMAGE;
  let fireRate = BASE_FIRE_RATE;
  let fireCooldown = 0;
  let projectiles = [];

  // Drill
  let drillSpeed = BASE_DRILL_SPEED;
  let drillX = 7;
  let drillY = 0;
  let drillTimer = 0;

  // Upgrade levels
  let upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0 };

  // Enemies
  let enemies = [];
  let waveNumber = 0;
  let waveTimer = 0;
  let waveActive = false;
  let score = 0;

  // Underground grid
  let undergroundGrid = [];

  // High scores
  let highScores = [];

  // Input
  const keys = {};

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

  function addHighScore(waves, pts) {
    highScores.push({ waves, score: pts });
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
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].waves}</td><td>${highScores[i].score}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UNDERGROUND GRID GENERATION
     ══════════════════════════════════════════════════════════════════ */

  function generateUnderground() {
    undergroundGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const rand = Math.random();
        if (rand < 0.12)
          row.push(TILE_IRON);
        else if (rand < 0.20)
          row.push(TILE_WATER);
        else if (rand < 0.25)
          row.push(TILE_COBALT);
        else
          row.push(TILE_DIRT);
      }
      undergroundGrid.push(row);
    }
    // Clear starting area
    undergroundGrid[0][7] = TILE_EMPTY;
    undergroundGrid[0][6] = TILE_EMPTY;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  function resetGame() {
    state = STATE_PLAYING;
    currentView = VIEW_SURFACE;
    transitionProgress = 0;
    transitionTarget = null;

    domeHP = BASE_DOME_HP;
    maxDomeHP = BASE_DOME_HP;
    resources = { iron: 0, water: 0, cobalt: 0 };
    carried = 0;
    carryCapacity = BASE_CARRY_CAPACITY;

    weaponDamage = BASE_WEAPON_DAMAGE;
    fireRate = BASE_FIRE_RATE;
    fireCooldown = 0;
    projectiles = [];

    drillSpeed = BASE_DRILL_SPEED;
    drillX = 7;
    drillY = 0;
    drillTimer = 0;

    upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0 };

    enemies = [];
    waveNumber = 0;
    waveTimer = 5; // first wave after 5s
    waveActive = false;
    score = 0;

    generateUnderground();
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     VIEW TRANSITION
     ══════════════════════════════════════════════════════════════════ */

  function toggleView() {
    if (state !== STATE_PLAYING) return;
    if (transitionProgress > 0) return; // already transitioning

    transitionTarget = currentView === VIEW_SURFACE ? VIEW_UNDERGROUND : VIEW_SURFACE;
    transitionProgress = 1.0;

    // When returning to surface, deposit carried resources
    if (transitionTarget === VIEW_SURFACE && carried > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 14px sans-serif' });
      carried = 0;
    }
  }

  function updateTransition(dt) {
    if (transitionProgress <= 0) return;

    transitionProgress -= dt * 3; // transition speed
    if (transitionProgress <= 0) {
      transitionProgress = 0;
      currentView = transitionTarget;
      transitionTarget = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMY WAVES
     ══════════════════════════════════════════════════════════════════ */

  function spawnWave() {
    ++waveNumber;
    waveActive = true;
    const count = BASE_ENEMIES_PER_WAVE + Math.floor(waveNumber * 1.5);
    const hpMult = 1 + waveNumber * 0.3;

    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * TWO_PI;
      const dist = 300 + Math.random() * 100;
      enemies.push({
        x: DOME_X + Math.cos(angle) * dist,
        y: DOME_Y + Math.sin(angle) * dist * 0.6,
        hp: 20 * hpMult,
        maxHP: 20 * hpMult,
        speed: 25 + Math.random() * 15,
        damage: 5 + waveNumber * 2,
        attackTimer: 0
      });
    }

    floatingText.add(CANVAS_W / 2, 40, `WAVE ${waveNumber}`, { color: '#f80', font: 'bold 20px sans-serif' });
    updateWindowTitle();
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      // Move toward dome
      const dx = DOME_X - e.x;
      const dy = DOME_Y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > DOME_RADIUS + 10) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else {
        // At dome — attack
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = 1.0;
          domeHP -= e.damage;
          screenShake.trigger(6, 200);
          floatingText.add(DOME_X + (Math.random() - 0.5) * 40, DOME_Y - 30, `-${e.damage} HP`, { color: '#f44', font: 'bold 14px sans-serif' });
          particles.burst(e.x, e.y, 8, { color: '#f44', speed: 2, life: 0.4 });

          if (domeHP <= 0) {
            domeHP = 0;
            state = STATE_GAME_OVER;
            addHighScore(waveNumber, score);
            updateWindowTitle();
            return;
          }
        }
      }

      // Remove dead enemies
      if (e.hp <= 0) {
        score += 10 + waveNumber * 5;
        particles.burst(e.x, e.y, 15, { color: '#fa0', speed: 3, life: 0.5 });
        floatingText.add(e.x, e.y - 15, `+${10 + waveNumber * 5}`, { color: '#ff0', font: 'bold 12px sans-serif' });
        enemies.splice(i, 1);
      }
    }

    // Wave complete check
    if (waveActive && enemies.length === 0) {
      waveActive = false;
      waveTimer = WAVE_INTERVAL;
      floatingText.add(CANVAS_W / 2, 40, 'WAVE CLEAR!', { color: '#0f0', font: 'bold 18px sans-serif' });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WEAPON SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function updateWeapon(dt) {
    if (currentView !== VIEW_SURFACE) return;
    if (enemies.length === 0) return;

    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      // Find nearest enemy
      let nearest = null;
      let nearDist = Infinity;
      for (const e of enemies) {
        const dx = e.x - DOME_X;
        const dy = e.y - DOME_Y;
        const d = dx * dx + dy * dy;
        if (d < nearDist) {
          nearDist = d;
          nearest = e;
        }
      }

      if (nearest) {
        fireCooldown = 1.0 / fireRate;
        projectiles.push({
          x: DOME_X,
          y: DOME_Y - 20,
          tx: nearest.x,
          ty: nearest.y,
          target: nearest,
          life: 0.3,
          maxLife: 0.3
        });
        nearest.hp -= weaponDamage;
      }
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; --i) {
      projectiles[i].life -= dt;
      if (projectiles[i].life <= 0)
        projectiles.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MINING
     ══════════════════════════════════════════════════════════════════ */

  function tryMine(dx, dy) {
    if (state !== STATE_PLAYING) return;
    if (currentView !== VIEW_UNDERGROUND) return;

    const nx = drillX + dx;
    const ny = drillY + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile = undergroundGrid[ny][nx];
    if (tile === TILE_EMPTY) {
      drillX = nx;
      drillY = ny;
      return;
    }

    // Mine the block
    drillTimer += drillSpeed;

    const tx = GRID_OFFSET_X + nx * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + ny * TILE_SIZE + TILE_SIZE / 2;

    // Debris particles on mining
    particles.burst(tx, ty, 8, { color: TILE_COLORS[tile] || '#654', speed: 2, life: 0.4 });
    screenShake.trigger(3, 100);

    if (tile === TILE_IRON || tile === TILE_WATER || tile === TILE_COBALT) {
      const label = TILE_LABELS[tile];
      const value = TILE_VALUES[tile];
      resources[label] += value;
      carried += value;
      floatingText.add(tx, ty - 15, `+${value} ${label}`, { color: '#0f0', font: 'bold 12px sans-serif' });
    }

    undergroundGrid[ny][nx] = TILE_EMPTY;
    drillX = nx;
    drillY = ny;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPGRADE SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function getUpgradeCost(idx) {
    const def = UPGRADE_DEFS[idx];
    return def.baseCost + upgradeLevels[def.key] * def.perLevel;
  }

  function totalResources() {
    return resources.iron + resources.water + resources.cobalt;
  }

  function spendResources(amount) {
    let remaining = amount;
    // Spend cobalt first (most valuable), then water, then iron
    for (const key of ['cobalt', 'water', 'iron']) {
      const spend = Math.min(resources[key], remaining);
      resources[key] -= spend;
      remaining -= spend;
      if (remaining <= 0) break;
    }
  }

  function applyUpgrade(idx) {
    if (state !== STATE_PLAYING) return;

    const cost = getUpgradeCost(idx);
    if (totalResources() < cost) return;

    spendResources(cost);
    const def = UPGRADE_DEFS[idx];
    ++upgradeLevels[def.key];

    // Apply stat changes
    switch (def.key) {
      case 'weaponDamage':
        weaponDamage = BASE_WEAPON_DAMAGE + upgradeLevels.weaponDamage * 5;
        break;
      case 'fireRate':
        fireRate = BASE_FIRE_RATE + upgradeLevels.fireRate * 0.3;
        break;
      case 'domeHP':
        maxDomeHP = BASE_DOME_HP + upgradeLevels.domeHP * 25;
        domeHP = Math.min(domeHP + 25, maxDomeHP);
        break;
      case 'drillSpeed':
        drillSpeed = Math.max(0.1, BASE_DRILL_SPEED - upgradeLevels.drillSpeed * 0.05);
        break;
      case 'carryCapacity':
        carryCapacity = BASE_CARRY_CAPACITY + upgradeLevels.carryCapacity * 20;
        break;
    }

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, `${def.name} Lv${upgradeLevels[def.key]}`, { color: '#4af', font: 'bold 14px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 10, { color: '#4af', speed: 2 });
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;

    updateTransition(dt);

    // Wave timer
    if (!waveActive) {
      waveTimer -= dt;
      if (waveTimer <= 0)
        spawnWave();
    }

    updateEnemies(dt);
    updateWeapon(dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — SURFACE
     ══════════════════════════════════════════════════════════════════ */

  function drawSurface() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#0a0a2a');
    grad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 80);
    ctx.lineTo(CANVAS_W, CANVAS_H - 80);
    ctx.stroke();

    // Dome
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
    ctx.closePath();
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#4af';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dome HP bar
    const hpRatio = domeHP / maxDomeHP;
    const barW = 120;
    const barX = DOME_X - barW / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, DOME_Y + 20, barW, 8);
    ctx.fillStyle = hpRatio > 0.3 ? '#4c4' : '#f44';
    ctx.fillRect(barX, DOME_Y + 20, barW * hpRatio, 8);

    // Dome HP text
    ctx.fillStyle = '#ccc';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(domeHP)}/${maxDomeHP}`, DOME_X, DOME_Y + 42);

    // Draw enemies
    for (const e of enemies) {
      const hpR = e.hp / e.maxHP;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10, 0, TWO_PI);
      ctx.fillStyle = `rgba(200,50,50,${0.5 + hpR * 0.5})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#f44';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Enemy HP bar
      ctx.fillStyle = '#300';
      ctx.fillRect(e.x - 10, e.y - 16, 20, 3);
      ctx.fillStyle = '#f44';
      ctx.fillRect(e.x - 10, e.y - 16, 20 * hpR, 3);
    }

    // Draw projectiles (laser beams with glow)
    for (const p of projectiles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.strokeStyle = `rgba(255,100,100,${alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#f44';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Impact glow
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, 4 * alpha, 0, TWO_PI);
      ctx.fillStyle = `rgba(255,200,100,${alpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fa0';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Wave info
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    if (waveActive)
      ctx.fillText(`Wave ${waveNumber} — ${enemies.length} enemies`, 10, 20);
    else
      ctx.fillText(`Next wave in ${Math.ceil(waveTimer)}s`, 10, 20);

    // Score
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${score}`, CANVAS_W - 10, 20);

    // View toggle hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText('Press SPACE to go underground', CANVAS_W / 2, CANVAS_H - 10);

    // Upgrade panel (right side)
    drawUpgradePanel();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — UNDERGROUND
     ══════════════════════════════════════════════════════════════════ */

  function drawUnderground() {
    // Dark underground bg
    ctx.fillStyle = '#0a0808';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    for (let r = 0; r < GRID_ROWS; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
        const x = GRID_OFFSET_X + c * TILE_SIZE;
        const y = GRID_OFFSET_Y + r * TILE_SIZE;
        const tile = undergroundGrid[r][c];

        if (tile === TILE_EMPTY) {
          ctx.fillStyle = '#1a1510';
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else {
          ctx.fillStyle = TILE_COLORS[tile] || '#3a2a1a';
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          // Resource glow
          if (tile !== TILE_DIRT) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = TILE_COLORS[tile];
            ctx.fillStyle = 'transparent';
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.shadowBlur = 0;

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(TILE_LABELS[tile] || '', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          }
        }

        ctx.strokeStyle = '#2a2010';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Draw drill cursor
    const dx = GRID_OFFSET_X + drillX * TILE_SIZE;
    const dy = GRID_OFFSET_Y + drillY * TILE_SIZE;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, TILE_SIZE, TILE_SIZE);

    // Drill icon
    ctx.fillStyle = '#da2';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u26CF', dx + TILE_SIZE / 2, dy + TILE_SIZE / 2); // ⛏

    // Resource display
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Iron: ${resources.iron}`, 10, 10);
    ctx.fillText(`Water: ${resources.water}`, 10, 26);
    ctx.fillText(`Cobalt: ${resources.cobalt}`, 10, 42);
    ctx.fillText(`Carried: ${carried}/${carryCapacity}`, CANVAS_W - 140, 10);

    // View toggle hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText('Press SPACE to return to surface', CANVAS_W / 2, CANVAS_H - 10);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — UPGRADE PANEL
     ══════════════════════════════════════════════════════════════════ */

  function drawUpgradePanel() {
    const px = CANVAS_W - 170;
    const py = 50;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px, py, 160, 30 + UPGRADE_DEFS.length * 24);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, 160, 30 + UPGRADE_DEFS.length * 24);

    ctx.fillStyle = '#4af';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Upgrades (U)', px + 8, py + 16);

    const total = totalResources();
    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const def = UPGRADE_DEFS[i];
      const cost = getUpgradeCost(i);
      const ly = py + 28 + i * 24;
      const canAfford = total >= cost;

      ctx.fillStyle = canAfford ? '#ccc' : '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${def.name} Lv${upgradeLevels[def.key]}`, px + 8, ly + 10);
      ctx.fillStyle = canAfford ? '#0f0' : '#844';
      ctx.fillText(`[${cost}]`, px + 120, ly + 10);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — HUD
     ══════════════════════════════════════════════════════════════════ */

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#4af';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME KEEPER', CANVAS_W / 2, CANVAS_H / 2 - 50);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Defend your dome. Mine resources. Upgrade.', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 20);
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

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME DESTROYED', CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Wave: ${waveNumber} — Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'start';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — MAIN
     ══════════════════════════════════════════════════════════════════ */

  function drawGame() {
    // Transition animation: slide between views
    if (transitionProgress > 0) {
      const slideOffset = transitionProgress * CANVAS_H * 0.3;
      ctx.globalAlpha = 1 - transitionProgress * 0.5;
    }

    if (currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;
    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${currentView}`;
    if (statusWave) statusWave.textContent = `Wave: ${waveNumber}`;
    if (statusDome) statusDome.textContent = `Dome: ${Math.ceil(domeHP)}/${maxDomeHP}`;
    if (statusResources) statusResources.textContent = `Fe:${resources.iron} H2O:${resources.water} Co:${resources.cobalt}`;
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

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'F2') {
      e.preventDefault();
      resetGame();
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
    }

    if (state !== STATE_PLAYING) return;

    // Toggle view
    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
      toggleView();
    }

    // Underground drill movement
    if (currentView === VIEW_UNDERGROUND) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') tryMine(0, -1);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') tryMine(0, 1);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') tryMine(-1, 0);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') tryMine(1, 0);
    }

    // Upgrades
    if (e.code === 'KeyU') {
      // Cycle through upgrades — apply the cheapest affordable one
      for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
        if (totalResources() >= getUpgradeCost(i)) {
          applyUpgrade(i);
          break;
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Click/Tap handling ── */
  canvas.addEventListener('pointerdown', (e) => {
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      resetGame();
      return;
    }

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (currentView === VIEW_UNDERGROUND) {
      // Click to mine a block
      const col = Math.floor((mx - GRID_OFFSET_X) / TILE_SIZE);
      const row = Math.floor((my - GRID_OFFSET_Y) / TILE_SIZE);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        // Mine adjacent blocks only
        const ddx = col - drillX;
        const ddy = row - drillY;
        if (Math.abs(ddx) + Math.abs(ddy) === 1)
          tryMine(ddx, ddy);
        else if (ddx === 0 && ddy === 0)
          toggleView(); // click on self to go back up
      }
    } else {
      // Surface — check upgrade panel clicks
      const px = CANVAS_W - 170;
      const py = 50;
      if (mx >= px && mx <= px + 160) {
        for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
          const ly = py + 28 + i * 24;
          if (my >= ly && my <= ly + 24) {
            applyUpgrade(i);
            return;
          }
        }
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Dome Keeper — Game Over — Wave ${waveNumber}`
      : `Dome Keeper — Wave ${waveNumber} — Score ${score}`;
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
  animFrameId = requestAnimationFrame(gameLoop);

})();
