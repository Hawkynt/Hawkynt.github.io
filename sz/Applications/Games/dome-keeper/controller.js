;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ======================================================================
     CONSTANTS
     ====================================================================== */

  let CANVAS_W = 700;
  let CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* -- Views -- */
  const VIEW_SURFACE = 'SURFACE';
  const VIEW_UNDERGROUND = 'UNDERGROUND';

  /* -- States -- */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* -- Storage -- */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* -- Underground Grid -- */
  const GRID_COLS = 14;
  const GRID_ROWS = 10;
  const TILE_SIZE = 40;
  const GRID_OFFSET_X = 70;
  const GRID_OFFSET_Y = 60;

  /* -- Tile Types -- */
  const TILE_EMPTY = 0;
  const TILE_DIRT = 1;
  const TILE_IRON = 2;
  const TILE_WATER = 3;
  const TILE_COBALT = 4;

  const TILE_COLORS = {
    [TILE_DIRT]: '#4a3a2a',
    [TILE_IRON]: '#888888',
    [TILE_WATER]: '#4488ff',
    [TILE_COBALT]: '#4444aa'
  };

  const TILE_HIGHLIGHT_COLORS = {
    [TILE_IRON]: '#bbbbbb',
    [TILE_WATER]: '#66aaff',
    [TILE_COBALT]: '#6666cc'
  };

  const TILE_SHADOW_COLORS = {
    [TILE_DIRT]: '#2a1a0a',
    [TILE_IRON]: '#555555',
    [TILE_WATER]: '#2266aa',
    [TILE_COBALT]: '#222288'
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

  /* -- Dome -- */
  const DOME_RADIUS = 80;
  let DOME_X = CANVAS_W / 2;
  let DOME_Y = CANVAS_H - 80 - DOME_RADIUS; // sits ON the ground surface
  const BASE_DOME_HP = 100;

  /* -- Weapon defaults -- */
  const BASE_WEAPON_DAMAGE = 10;
  const BASE_FIRE_RATE = 1.0;
  const BASE_DRILL_SPEED = 0.3;
  const BASE_CARRY_CAPACITY = 50;

  /* -- Waves -- */
  const WAVE_INTERVAL = 25;
  const BASE_ENEMIES_PER_WAVE = 3;

  /* -- Upgrade costs (resource units) -- */
  const UPGRADE_DEFS = [
    { name: 'Weapon Damage', key: 'weaponDamage', baseCost: 30, perLevel: 20 },
    { name: 'Fire Rate', key: 'fireRate', baseCost: 25, perLevel: 15 },
    { name: 'Dome HP', key: 'domeHP', baseCost: 40, perLevel: 25 },
    { name: 'Drill Speed', key: 'drillSpeed', baseCost: 20, perLevel: 10 },
    { name: 'Carry Capacity', key: 'carryCapacity', baseCost: 20, perLevel: 10 }
  ];

  /* ======================================================================
     DOM
     ====================================================================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusView = document.getElementById('statusView');
  const statusWave = document.getElementById('statusWave');
  const statusDome = document.getElementById('statusDome');
  const statusResources = document.getElementById('statusResources');
  const highScoresBody = document.getElementById('highScoresBody');

  /* -- API: Windows integration -- */
  const { User32 } = SZ?.Dlls ?? {};

  /* -- Effects -- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  const starfield = new SZ.GameEffects.Starfield(CANVAS_W, CANVAS_H * 0.85, 80);

  /* ======================================================================
     ANIMATION STATE
     ====================================================================== */

  let animTime = 0; // global animation clock (seconds)

  // Mining / pickaxe swing
  let pickaxeAngle = 0;         // current swing angle (radians)
  let pickaxeSwinging = false;
  let pickaxeSwingTimer = 0;
  const PICKAXE_SWING_DURATION = 0.25;
  let lastMineDir = { dx: 1, dy: 0 }; // direction of last mine action

  // Dome pulse
  let domePulsePhase = 0;
  let domeHitFlash = 0; // flash timer when dome is hit

  // Player idle bob (underground)
  let playerBob = 0;

  // Rock crumble animations
  let crumbleEffects = []; // { x, y, pieces: [{x,y,vx,vy,rot,rotV,size,color}], life }

  // Dust clouds
  let dustClouds = []; // { x, y, alpha, radius, expandRate }

  // Resource reveal glows
  let resourceGlows = []; // { x, y, color, life, radius }

  // Dome shield impact flashes
  let shieldImpacts = []; // { angle, life, intensity }

  // Ambient underground sparkles for resource tiles
  let tileSparkleTimer = 0;

  /* ======================================================================
     GAME STATE
     ====================================================================== */

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Defend your dome from alien waves on the surface', 'while mining resources underground!', '', 'Click/Tap = Fire weapon (surface) / Mine (underground)', 'Arrow Keys/WASD = Move drill underground', 'Space/Tab = Toggle surface / underground'] },
    { title: 'Upgrades & Tips', lines: ['Press U to open the upgrade shop.', 'Upgrade weapon, dome armor, drill, fire rate.', '', 'Mine iron, water, and cobalt to fund upgrades.', 'Return to the surface before waves arrive!', 'Press H anytime to see this help again.'] }
  ];

  let state = STATE_READY;
  let currentView = VIEW_SURFACE;
  let transitionProgress = 0;
  let transitionTarget = null;

  let domeHP = BASE_DOME_HP;
  let maxDomeHP = BASE_DOME_HP;

  let resources = { iron: 0, water: 0, cobalt: 0 };
  let carried = 0;
  let carryCapacity = BASE_CARRY_CAPACITY;

  let weaponDamage = BASE_WEAPON_DAMAGE;
  let fireRate = BASE_FIRE_RATE;
  let fireCooldown = 0;
  let projectiles = [];

  let drillSpeed = BASE_DRILL_SPEED;
  let drillX = 7;
  let drillY = 0;
  let drillTimer = 0;

  let upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0 };

  let enemies = [];
  let waveNumber = 0;
  let waveTimer = 0;
  let waveActive = false;
  let score = 0;

  let undergroundGrid = [];
  let highScores = [];

  const keys = {};

  /* ======================================================================
     DETERMINISTIC SEED FOR TERRAIN TEXTURE
     ====================================================================== */

  // Pre-generate dirt texture noise offsets for each tile
  let dirtNoise = [];
  function generateDirtNoise() {
    dirtNoise = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 6; ++d)
          dots.push({
            ox: Math.random() * (TILE_SIZE - 6) + 3,
            oy: Math.random() * (TILE_SIZE - 6) + 3,
            size: 1 + Math.random() * 2.5,
            shade: Math.random() * 0.3
          });
        row.push(dots);
      }
      dirtNoise.push(row);
    }
  }

  /* ======================================================================
     CANVAS SETUP
     ====================================================================== */

  function setupCanvas() {
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    CANVAS_W = Math.floor(rect.width) || 700;
    CANVAS_H = Math.floor(rect.height) || 500;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Recalculate derived layout values
    DOME_X = CANVAS_W / 2;
    DOME_Y = CANVAS_H - 80 - DOME_RADIUS;
    starfield.resize(CANVAS_W, CANVAS_H * 0.85);
  }

  /* ======================================================================
     PERSISTENCE
     ====================================================================== */

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

  /* ======================================================================
     UNDERGROUND GRID GENERATION
     ====================================================================== */

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
    undergroundGrid[0][7] = TILE_EMPTY;
    undergroundGrid[0][6] = TILE_EMPTY;
    generateDirtNoise();
    generateOreSpeckles();
  }

  /* ======================================================================
     GAME INIT / RESET
     ====================================================================== */

  function resetGame() {
    state = STATE_PLAYING;
    currentView = VIEW_SURFACE;
    transitionProgress = 0;
    transitionTarget = null;
    transitionPhase = 'none';

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
    waveTimer = 5;
    waveActive = false;
    score = 0;

    // Reset animation state
    animTime = 0;
    pickaxeAngle = 0;
    pickaxeSwinging = false;
    pickaxeSwingTimer = 0;
    domePulsePhase = 0;
    domeHitFlash = 0;
    playerBob = 0;
    crumbleEffects = [];
    dustClouds = [];
    resourceGlows = [];
    shieldImpacts = [];
    tileSparkleTimer = 0;

    generateUnderground();
    updateWindowTitle();
  }

  /* ======================================================================
     VIEW TRANSITION
     ====================================================================== */

  const TRANSITION_DURATION = 0.6; // seconds for a full view switch
  let transitionPhase = 'none';    // 'none' | 'fade-out' | 'fade-in'

  function toggleView() {
    if (state !== STATE_PLAYING) return;
    if (transitionPhase !== 'none') return;

    transitionTarget = currentView === VIEW_SURFACE ? VIEW_UNDERGROUND : VIEW_SURFACE;
    transitionProgress = 0;
    transitionPhase = 'fade-out';

    if (transitionTarget === VIEW_SURFACE && carried > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 14px sans-serif' });
      carried = 0;
    }
  }

  function updateTransition(dt) {
    if (transitionPhase === 'none') return;

    const speed = 1 / (TRANSITION_DURATION / 2); // each half takes TRANSITION_DURATION/2
    transitionProgress += dt * speed;

    if (transitionPhase === 'fade-out' && transitionProgress >= 1) {
      // Midpoint: switch the actual view
      transitionProgress = 1;
      currentView = transitionTarget;
      transitionPhase = 'fade-in';
    } else if (transitionPhase === 'fade-in' && transitionProgress >= 2) {
      // Done
      transitionProgress = 0;
      transitionPhase = 'none';
      transitionTarget = null;
    }
  }

  function getTransitionAlpha() {
    if (transitionPhase === 'none') return 1;
    if (transitionPhase === 'fade-out')
      return 1 - transitionProgress; // 1 -> 0
    // fade-in: transitionProgress goes from 1 -> 2
    return transitionProgress - 1; // 0 -> 1
  }

  /* ======================================================================
     ANIMATION UPDATES
     ====================================================================== */

  function updateAnimations(dt) {
    animTime += dt;

    // Dome pulse
    domePulsePhase += dt * 2.0;

    // Dome hit flash decay
    if (domeHitFlash > 0)
      domeHitFlash = Math.max(0, domeHitFlash - dt * 4);

    // Player idle bob
    playerBob = Math.sin(animTime * 3) * 2;

    // Pickaxe swing
    if (pickaxeSwinging) {
      pickaxeSwingTimer -= dt;
      const progress = 1 - (pickaxeSwingTimer / PICKAXE_SWING_DURATION);
      // Swing out to 70 deg then back
      if (progress < 0.5)
        pickaxeAngle = progress * 2 * 1.2;
      else
        pickaxeAngle = (1 - progress) * 2 * 1.2;

      if (pickaxeSwingTimer <= 0) {
        pickaxeSwinging = false;
        pickaxeAngle = 0;
      }
    }

    // Crumble effects
    for (let i = crumbleEffects.length - 1; i >= 0; --i) {
      const c = crumbleEffects[i];
      c.life -= dt;
      for (const p of c.pieces) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 0.15;
        p.rot += p.rotV;
      }
      if (c.life <= 0)
        crumbleEffects.splice(i, 1);
    }

    // Dust clouds
    for (let i = dustClouds.length - 1; i >= 0; --i) {
      const d = dustClouds[i];
      d.alpha -= dt * 2;
      d.radius += d.expandRate * dt * 60;
      d.y -= dt * 15;
      if (d.alpha <= 0)
        dustClouds.splice(i, 1);
    }

    // Resource glows
    for (let i = resourceGlows.length - 1; i >= 0; --i) {
      const g = resourceGlows[i];
      g.life -= dt * 1.5;
      g.radius += dt * 40;
      if (g.life <= 0)
        resourceGlows.splice(i, 1);
    }

    // Shield impacts
    for (let i = shieldImpacts.length - 1; i >= 0; --i) {
      const s = shieldImpacts[i];
      s.life -= dt * 3;
      if (s.life <= 0)
        shieldImpacts.splice(i, 1);
    }

    // Ambient sparkles on resource tiles underground
    if (currentView === VIEW_UNDERGROUND) {
      tileSparkleTimer -= dt;
      if (tileSparkleTimer <= 0) {
        tileSparkleTimer = 0.3 + Math.random() * 0.4;
        // Pick a random resource tile
        const candidates = [];
        for (let r = 0; r < GRID_ROWS; ++r)
          for (let c = 0; c < GRID_COLS; ++c)
            if (undergroundGrid[r][c] !== TILE_EMPTY && undergroundGrid[r][c] !== TILE_DIRT)
              candidates.push({ r, c });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const sx = GRID_OFFSET_X + pick.c * TILE_SIZE + Math.random() * TILE_SIZE;
          const sy = GRID_OFFSET_Y + pick.r * TILE_SIZE + Math.random() * TILE_SIZE;
          particles.sparkle(sx, sy, 1, { color: TILE_HIGHLIGHT_COLORS[undergroundGrid[pick.r][pick.c]] || '#fff', speed: 0.5 });
        }
      }
    }

    // Update starfield
    starfield.update(dt);

    // Update enemy animation phases
    for (const e of enemies) {
      if (e.wobblePhase === undefined) {
        e.wobblePhase = Math.random() * TWO_PI;
        e.legPhase = Math.random() * TWO_PI;
        e.eyeBlinkTimer = 2 + Math.random() * 3;
        e.eyeBlinking = false;
      }
      e.wobblePhase += dt * 4;
      e.legPhase += dt * 8;
      e.eyeBlinkTimer -= dt;
      if (e.eyeBlinkTimer <= 0) {
        e.eyeBlinking = !e.eyeBlinking;
        e.eyeBlinkTimer = e.eyeBlinking ? 0.15 : (2 + Math.random() * 3);
      }
    }
  }

  /* ======================================================================
     CRUMBLE / DUST SPAWNERS
     ====================================================================== */

  function spawnCrumble(tx, ty, color) {
    const pieces = [];
    for (let i = 0; i < 8; ++i)
      pieces.push({
        x: tx + (Math.random() - 0.5) * 10,
        y: ty + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        rot: Math.random() * TWO_PI,
        rotV: (Math.random() - 0.5) * 0.3,
        size: 2 + Math.random() * 4,
        color: color
      });
    crumbleEffects.push({ x: tx, y: ty, pieces, life: 0.6 });
  }

  function spawnDust(tx, ty) {
    for (let i = 0; i < 3; ++i)
      dustClouds.push({
        x: tx + (Math.random() - 0.5) * 15,
        y: ty + (Math.random() - 0.5) * 5,
        alpha: 0.4 + Math.random() * 0.2,
        radius: 3 + Math.random() * 4,
        expandRate: 0.5 + Math.random() * 0.3
      });
  }

  function spawnResourceGlow(tx, ty, color) {
    resourceGlows.push({ x: tx, y: ty, color, life: 1.0, radius: 5 });
  }

  function spawnShieldImpact(ex, ey) {
    const angle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    shieldImpacts.push({ angle, life: 1.0, intensity: 1.0 });
  }

  /* ======================================================================
     ENEMY WAVES
     ====================================================================== */

  function spawnWave() {
    ++waveNumber;
    waveActive = true;
    const count = BASE_ENEMIES_PER_WAVE + Math.floor(waveNumber * 1.5);
    const hpMult = 1 + waveNumber * 0.3;

    for (let i = 0; i < count; ++i) {
      // Spawn only from left, right, or top -- never below the dome / underground
      // Angle range: PI (left) through 1.5*PI (top) to 2*PI (right)
      const angle = Math.PI + Math.random() * Math.PI;
      const dist = 300 + Math.random() * 100;
      enemies.push({
        x: DOME_X + Math.cos(angle) * dist,
        y: DOME_Y + Math.sin(angle) * dist * 0.6,
        hp: 20 * hpMult,
        maxHP: 20 * hpMult,
        speed: 25 + Math.random() * 15,
        damage: 5 + waveNumber * 2,
        attackTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: 10 + Math.random() * 4
      });
    }

    floatingText.add(CANVAS_W / 2, 40, `WAVE ${waveNumber}`, { color: '#f80', font: 'bold 20px sans-serif' });
    updateWindowTitle();
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      const dx = DOME_X - e.x;
      const dy = DOME_Y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > DOME_RADIUS + 10) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = 1.0;
          domeHP -= e.damage;
          domeHitFlash = 1.0;
          screenShake.trigger(8, 250);
          floatingText.add(DOME_X + (Math.random() - 0.5) * 40, DOME_Y - 30, `-${e.damage} HP`, { color: '#f44', font: 'bold 14px sans-serif' });

          // Shield impact flash
          spawnShieldImpact(e.x, e.y);

          // Dome-hit sparks along the shield surface
          const impactAngle = Math.atan2(e.y - DOME_Y, e.x - DOME_X);
          for (let s = 0; s < 12; ++s) {
            const spread = (Math.random() - 0.5) * 0.6;
            const sa = impactAngle + spread;
            const ix = DOME_X + Math.cos(sa) * DOME_RADIUS;
            const iy = DOME_Y + Math.sin(sa) * DOME_RADIUS;
            particles.trail(ix, iy, {
              vx: Math.cos(sa) * (1 + Math.random() * 2),
              vy: Math.sin(sa) * (1 + Math.random() * 2) - 1,
              color: Math.random() > 0.5 ? '#4af' : '#8cf',
              life: 0.3 + Math.random() * 0.3,
              size: 1 + Math.random() * 2
            });
          }
          particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2.5, life: 0.5 });

          if (domeHP <= 0) {
            domeHP = 0;
            state = STATE_GAME_OVER;
            // Dome destruction explosion
            particles.burst(DOME_X, DOME_Y, 40, { color: '#4af', speed: 5, life: 0.8 });
            particles.burst(DOME_X, DOME_Y, 25, { color: '#f80', speed: 4, life: 0.6 });
            screenShake.trigger(15, 500);
            addHighScore(waveNumber, score);
            updateWindowTitle();
            return;
          }
        }
      }

      // Remove dead enemies with death animation
      if (e.hp <= 0) {
        score += 10 + waveNumber * 5;
        // Chunky death explosion
        particles.burst(e.x, e.y, 20, { color: '#fa0', speed: 3.5, life: 0.6, gravity: 0.05 });
        particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2, life: 0.4 });
        particles.sparkle(e.x, e.y, 6, { color: '#ff0', speed: 1.5 });
        // Gore chunks (squares)
        for (let g = 0; g < 5; ++g)
          particles.trail(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, {
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            color: '#c33',
            life: 0.5 + Math.random() * 0.3,
            size: 3 + Math.random() * 3,
            gravity: 0.12,
            shape: 'square'
          });
        floatingText.add(e.x, e.y - 15, `+${10 + waveNumber * 5}`, { color: '#ff0', font: 'bold 12px sans-serif' });
        enemies.splice(i, 1);
      }
    }

    if (waveActive && enemies.length === 0) {
      waveActive = false;
      waveTimer = WAVE_INTERVAL;
      floatingText.add(CANVAS_W / 2, 40, 'WAVE CLEAR!', { color: '#0f0', font: 'bold 18px sans-serif' });
    }
  }

  /* ======================================================================
     WEAPON SYSTEM
     ====================================================================== */

  function updateWeapon(dt) {
    if (currentView !== VIEW_SURFACE) return;
    if (enemies.length === 0) return;

    fireCooldown -= dt;
    if (fireCooldown <= 0) {
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

        // Muzzle flash at dome turret
        particles.burst(DOME_X, DOME_Y - 25, 4, { color: '#faa', speed: 1.5, life: 0.15, size: 2 });
      }
    }

    for (let i = projectiles.length - 1; i >= 0; --i) {
      projectiles[i].life -= dt;
      if (projectiles[i].life <= 0)
        projectiles.splice(i, 1);
    }
  }

  /* ======================================================================
     MINING
     ====================================================================== */

  function tryMine(dx, dy) {
    if (state !== STATE_PLAYING) return;
    if (currentView !== VIEW_UNDERGROUND) return;

    const nx = drillX + dx;
    const ny = drillY + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile = undergroundGrid[ny][nx];
    if (tile === TILE_EMPTY) {
      // Movement dust
      const cx = GRID_OFFSET_X + drillX * TILE_SIZE + TILE_SIZE / 2;
      const cy = GRID_OFFSET_Y + drillY * TILE_SIZE + TILE_SIZE / 2;
      spawnDust(cx, cy);
      drillX = nx;
      drillY = ny;
      return;
    }

    // Trigger pickaxe swing animation
    pickaxeSwinging = true;
    pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    lastMineDir = { dx, dy };

    drillTimer += drillSpeed;

    const tx = GRID_OFFSET_X + nx * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + ny * TILE_SIZE + TILE_SIZE / 2;

    // Rich mining particles
    const tileColor = TILE_COLORS[tile] || '#654';

    // Directional rock debris (chunks fly opposite to mining direction)
    for (let p = 0; p < 6; ++p)
      particles.trail(tx + (Math.random() - 0.5) * 12, ty + (Math.random() - 0.5) * 12, {
        vx: -dx * (1.5 + Math.random() * 2) + (Math.random() - 0.5),
        vy: -dy * (1.5 + Math.random() * 2) - Math.random() * 1.5,
        color: tileColor,
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        gravity: 0.08,
        shape: 'square'
      });

    // Small circular dust particles
    particles.burst(tx, ty, 6, { color: '#8a7a6a', speed: 1.5, life: 0.3, size: 1.5 });

    // Rock crumble animation
    spawnCrumble(tx, ty, tileColor);

    // Dust cloud at impact
    spawnDust(tx, ty);

    // Stronger shake for mining
    screenShake.trigger(4, 120);

    if (tile === TILE_IRON || tile === TILE_WATER || tile === TILE_COBALT) {
      const label = TILE_LABELS[tile];
      const value = TILE_VALUES[tile];
      resources[label] += value;
      carried += value;
      floatingText.add(tx, ty - 15, `+${value} ${label}`, { color: '#0f0', font: 'bold 12px sans-serif' });

      // Resource reveal glow burst
      spawnResourceGlow(tx, ty, TILE_HIGHLIGHT_COLORS[tile] || '#fff');
      particles.sparkle(tx, ty, 12, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2.5 });

      // Extra screen shake for precious resources
      screenShake.trigger(5, 150);
    }

    undergroundGrid[ny][nx] = TILE_EMPTY;
    drillX = nx;
    drillY = ny;
  }

  /* ======================================================================
     UPGRADE SYSTEM
     ====================================================================== */

  function getUpgradeCost(idx) {
    const def = UPGRADE_DEFS[idx];
    return def.baseCost + upgradeLevels[def.key] * def.perLevel;
  }

  function totalResources() {
    return resources.iron + resources.water + resources.cobalt;
  }

  function spendResources(amount) {
    let remaining = amount;
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

  /* ======================================================================
     UPDATE
     ====================================================================== */

  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;

    updateTransition(dt);
    updateAnimations(dt);

    if (!waveActive) {
      waveTimer -= dt;
      if (waveTimer <= 0)
        spawnWave();
    }

    updateEnemies(dt);
    updateWeapon(dt);
  }

  /* ======================================================================
     DRAWING HELPERS
     ====================================================================== */

  function drawGroundLayer() {
    const groundY = CANVAS_H - 80;

    // Multi-layer ground gradient
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#3a2510');
    groundGrad.addColorStop(0.3, '#2a1a0a');
    groundGrad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, CANVAS_W, 80);

    // Ground highlight edge
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_W, groundY);
    ctx.stroke();

    // Grass tufts along the ground line
    ctx.strokeStyle = '#2a5a1a';
    ctx.lineWidth = 1.5;
    for (let gx = 5; gx < CANVAS_W; gx += 12 + Math.sin(gx * 0.3) * 5) {
      const tiltSeed = Math.sin(gx * 0.7 + animTime * 0.8);
      const h = 4 + Math.abs(Math.sin(gx * 0.5)) * 6;
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.quadraticCurveTo(gx + tiltSeed * 3, groundY - h * 0.6, gx + tiltSeed * 2, groundY - h);
      ctx.stroke();
    }

    // Pebble/rock details on the ground surface
    ctx.fillStyle = '#4a3a20';
    const pebbleSeed = 42;
    for (let px = 20; px < CANVAS_W; px += 35 + ((px * pebbleSeed) % 20)) {
      const py = groundY + 5 + ((px * 7) % 15);
      const pr = 1 + ((px * 3) % 3);
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.5, pr, 0, 0, TWO_PI);
      ctx.fill();
    }
  }

  function drawDome() {
    const pulse = Math.sin(domePulsePhase) * 0.15;
    const flashAlpha = domeHitFlash * 0.6;
    const hpRatio = domeHP / maxDomeHP;

    // Dome interior gradient fill (semi-transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 2, Math.PI, 0);
    ctx.closePath();
    const interiorGrad = ctx.createRadialGradient(DOME_X, DOME_Y - 20, 10, DOME_X, DOME_Y, DOME_RADIUS);
    interiorGrad.addColorStop(0, 'rgba(80,140,220,0.08)');
    interiorGrad.addColorStop(0.6, 'rgba(60,120,200,0.04)');
    interiorGrad.addColorStop(1, 'rgba(40,100,180,0.02)');
    ctx.fillStyle = interiorGrad;
    ctx.fill();
    ctx.restore();

    // Hex pattern on dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 1, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = `rgba(80,160,255,${0.06 + pulse * 0.03})`;
    ctx.lineWidth = 0.5;
    const hexSize = 12;
    const hexH = hexSize * Math.sqrt(3);
    for (let hy = DOME_Y - DOME_RADIUS; hy < DOME_Y + 10; hy += hexH) {
      for (let hx = DOME_X - DOME_RADIUS; hx < DOME_X + DOME_RADIUS; hx += hexSize * 3) {
        const ox = ((Math.floor((hy - DOME_Y + DOME_RADIUS) / hexH)) % 2) * hexSize * 1.5;
        drawHexagon(hx + ox, hy, hexSize);
      }
    }
    ctx.restore();

    // Dome shield arc (main)
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
    ctx.closePath();
    const domeGrad = ctx.createLinearGradient(DOME_X - DOME_RADIUS, DOME_Y, DOME_X + DOME_RADIUS, DOME_Y);
    domeGrad.addColorStop(0, `rgba(40,120,255,${0.5 + pulse})`);
    domeGrad.addColorStop(0.5, `rgba(80,170,255,${0.8 + pulse})`);
    domeGrad.addColorStop(1, `rgba(40,120,255,${0.5 + pulse})`);
    ctx.strokeStyle = domeGrad;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20 + pulse * 10;
    ctx.shadowColor = '#4af';
    ctx.stroke();

    // Second pass -- brighter inner line
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 1.5, Math.PI, 0);
    ctx.strokeStyle = `rgba(140,200,255,${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#8cf';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dome base (ground contact)
    ctx.beginPath();
    ctx.moveTo(DOME_X - DOME_RADIUS, DOME_Y);
    ctx.lineTo(DOME_X + DOME_RADIUS, DOME_Y);
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dome hit flash overlay
    if (flashAlpha > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,80,80,${flashAlpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Shield impact flashes
    for (const impact of shieldImpacts) {
      const ia = impact.angle;
      const il = impact.life;
      ctx.save();
      ctx.beginPath();
      const arcSpan = 0.3 * il;
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 2, ia - arcSpan, ia + arcSpan);
      ctx.strokeStyle = `rgba(100,200,255,${il * 0.8})`;
      ctx.lineWidth = 4 * il;
      ctx.shadowBlur = 15 * il;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Dome turret (small weapon on top)
    ctx.fillStyle = '#6a8ab0';
    ctx.fillRect(DOME_X - 4, DOME_Y - DOME_RADIUS - 8, 8, 12);
    const turretGrad = ctx.createLinearGradient(DOME_X - 4, DOME_Y - DOME_RADIUS - 8, DOME_X + 4, DOME_Y - DOME_RADIUS - 8);
    turretGrad.addColorStop(0, '#8ab0d0');
    turretGrad.addColorStop(1, '#4a6a8a');
    ctx.fillStyle = turretGrad;
    ctx.fillRect(DOME_X - 3, DOME_Y - DOME_RADIUS - 6, 6, 8);
    // Turret barrel
    ctx.fillStyle = '#556';
    ctx.fillRect(DOME_X - 1.5, DOME_Y - DOME_RADIUS - 14, 3, 8);

    // Dome HP bar with gradient
    const barW = 120;
    const barH = 10;
    const barX = DOME_X - barW / 2;
    const barY = DOME_Y + 22;

    // Bar background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    // Health bar fill with gradient
    const hpBarGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    if (hpRatio > 0.3) {
      hpBarGrad.addColorStop(0, '#6e6');
      hpBarGrad.addColorStop(0.5, '#4c4');
      hpBarGrad.addColorStop(1, '#3a3');
    } else {
      hpBarGrad.addColorStop(0, '#f66');
      hpBarGrad.addColorStop(0.5, '#f44');
      hpBarGrad.addColorStop(1, '#c22');
    }
    ctx.fillStyle = hpBarGrad;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // HP bar highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpRatio, barH / 2);

    // Bar border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // HP text
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.ceil(domeHP)}/${maxDomeHP}`, DOME_X, barY + barH + 3);
  }

  function drawHexagon(cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = (TWO_PI / 6) * i - Math.PI / 6;
      const hx = cx + Math.cos(a) * size;
      const hy = cy + Math.sin(a) * size;
      if (i === 0)
        ctx.moveTo(hx, hy);
      else
        ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawEnemy(e) {
    const hpR = e.hp / e.maxHP;
    const sz = e.size || 10;
    const wobble = Math.sin(e.wobblePhase) * 1.5;
    const legOffset = Math.sin(e.legPhase) * 3;

    ctx.save();
    ctx.translate(e.x, e.y + wobble);

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, sz + 2, sz * 0.8, 3, 0, 0, TWO_PI);
    ctx.fill();

    // Legs (4 little appendages)
    ctx.strokeStyle = '#a33';
    ctx.lineWidth = 2;
    // Left legs
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, sz * 0.3);
    ctx.lineTo(-sz * 0.8, sz * 0.6 + legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, sz * 0.1);
    ctx.lineTo(-sz * 0.7, sz * 0.3 - legOffset);
    ctx.stroke();
    // Right legs
    ctx.beginPath();
    ctx.moveTo(sz * 0.4, sz * 0.3);
    ctx.lineTo(sz * 0.8, sz * 0.6 - legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, sz * 0.1);
    ctx.lineTo(sz * 0.7, sz * 0.3 + legOffset);
    ctx.stroke();

    // Body -- gradient sphere
    const bodyGrad = ctx.createRadialGradient(-sz * 0.15, -sz * 0.2, 1, 0, 0, sz);
    bodyGrad.addColorStop(0, `rgba(240,80,80,${0.6 + hpR * 0.4})`);
    bodyGrad.addColorStop(0.6, `rgba(180,40,40,${0.5 + hpR * 0.5})`);
    bodyGrad.addColorStop(1, `rgba(100,20,20,${0.4 + hpR * 0.4})`);
    ctx.beginPath();
    ctx.arc(0, 0, sz, 0, TWO_PI);
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(255,50,50,${0.3 + hpR * 0.4})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Body highlight (specular)
    ctx.fillStyle = 'rgba(255,180,180,0.3)';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.25, -sz * 0.3, sz * 0.35, sz * 0.2, -0.3, 0, TWO_PI);
    ctx.fill();

    // Eyes
    const eyeH = e.eyeBlinking ? 0.5 : 3;
    // Left eye
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.3, -sz * 0.15, 3, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    // Pupil
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(-sz * 0.3, -sz * 0.15, 1.2, 0, TWO_PI);
      ctx.fill();
    }
    // Right eye
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.ellipse(sz * 0.3, -sz * 0.15, 3, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(sz * 0.3, -sz * 0.15, 1.2, 0, TWO_PI);
      ctx.fill();
    }

    // Mouth (angry slit)
    ctx.strokeStyle = '#300';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.25, sz * 0.25);
    ctx.quadraticCurveTo(0, sz * 0.4, sz * 0.25, sz * 0.25);
    ctx.stroke();

    ctx.restore();

    // Enemy HP bar (improved)
    const barW = sz * 2 + 4;
    const barX = e.x - barW / 2;
    const barY = e.y - sz - 10 + wobble;
    ctx.fillStyle = '#200';
    ctx.fillRect(barX, barY, barW, 4);
    const ehpGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpR, barY);
    ehpGrad.addColorStop(0, '#f66');
    ehpGrad.addColorStop(1, '#f44');
    ctx.fillStyle = ehpGrad;
    ctx.fillRect(barX, barY, barW * hpR, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpR, 2);
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      const alpha = p.life / p.maxLife;

      // Electric arc effect using shared helper
      SZ.GameEffects.drawElectricArc(ctx, p.x, p.y, p.tx, p.ty, {
        segments: 8,
        jitter: 6 * alpha,
        color: `rgba(255,120,120,${alpha})`,
        glowColor: `rgba(255,60,60,${alpha * 0.5})`,
        width: 1.5 * alpha,
        glowWidth: 4 * alpha
      });

      // Impact flash
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, 6 * alpha, 0, TWO_PI);
      const impactGrad = ctx.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, 6 * alpha);
      impactGrad.addColorStop(0, `rgba(255,220,150,${alpha})`);
      impactGrad.addColorStop(0.5, `rgba(255,100,50,${alpha * 0.6})`);
      impactGrad.addColorStop(1, `rgba(255,50,50,0)`);
      ctx.fillStyle = impactGrad;
      ctx.fill();

      // Emit trail particles along beam
      if (Math.random() < 0.3) {
        const t = Math.random();
        const px = p.x + (p.tx - p.x) * t;
        const py = p.y + (p.ty - p.y) * t;
        particles.trail(px, py, { color: '#f88', life: 0.15, size: 1 });
      }
    }
  }

  /* ======================================================================
     DRAWING -- SURFACE
     ====================================================================== */

  function drawSurface() {
    // Sky gradient (deeper, richer)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H - 80);
    skyGrad.addColorStop(0, '#050520');
    skyGrad.addColorStop(0.4, '#0a0a30');
    skyGrad.addColorStop(0.7, '#101040');
    skyGrad.addColorStop(1, '#1a1a50');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H - 80);

    // Starfield
    starfield.draw(ctx);

    // Distant mountains silhouette
    ctx.fillStyle = '#0f0f2a';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 80);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 20 + Math.sin(mx * 0.008) * 25 + Math.sin(mx * 0.02 + 1) * 12 + Math.sin(mx * 0.05 + 2) * 5;
      ctx.lineTo(mx, CANVAS_H - 80 - h);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H - 80);
    ctx.closePath();
    ctx.fill();

    // Near hills
    ctx.fillStyle = '#151530';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 80);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 8 + Math.sin(mx * 0.015 + 3) * 12 + Math.sin(mx * 0.04) * 6;
      ctx.lineTo(mx, CANVAS_H - 80 - h);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H - 80);
    ctx.closePath();
    ctx.fill();

    // Ground layer with details
    drawGroundLayer();

    // Dome
    drawDome();

    // Enemies
    for (const e of enemies)
      drawEnemy(e);

    // Projectiles
    drawProjectiles();

    // Wave info with styled text
    ctx.fillStyle = '#bbb';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (waveActive) {
      ctx.fillStyle = '#f88';
      ctx.fillText(`Wave ${waveNumber}`, 10, 14);
      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${enemies.length} enemies remaining`, 10, 30);
    } else {
      ctx.fillText(`Next wave in ${Math.ceil(waveTimer)}s`, 10, 14);
      // Timer bar
      const timerRatio = waveTimer / WAVE_INTERVAL;
      ctx.fillStyle = '#333';
      ctx.fillRect(10, 32, 100, 4);
      ctx.fillStyle = '#f80';
      ctx.fillRect(10, 32, 100 * (1 - timerRatio), 4);
    }

    // Score with glow
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dd8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Score: ${score}`, CANVAS_W - 10, 14);

    // View toggle hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Press SPACE to go underground', CANVAS_W / 2, CANVAS_H - 10);

    // Upgrade panel
    drawUpgradePanel();
  }

  /* ======================================================================
     DRAWING -- UNDERGROUND
     ====================================================================== */

  function drawUnderground() {
    // Dark cavern background with subtle gradient
    const caveBg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    caveBg.addColorStop(0, '#0c0806');
    caveBg.addColorStop(0.5, '#0a0604');
    caveBg.addColorStop(1, '#060402');
    ctx.fillStyle = caveBg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle vignette
    const vignetteGrad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 100, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid tiles
    for (let r = 0; r < GRID_ROWS; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
        const x = GRID_OFFSET_X + c * TILE_SIZE;
        const y = GRID_OFFSET_Y + r * TILE_SIZE;
        const tile = undergroundGrid[r][c];

        if (tile === TILE_EMPTY) {
          // Empty cave space with depth
          const emptyGrad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
          emptyGrad.addColorStop(0, '#1a1510');
          emptyGrad.addColorStop(1, '#120e08');
          ctx.fillStyle = emptyGrad;
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else {
          drawTile(x, y, tile, r, c);
        }

        // Grid lines
        ctx.strokeStyle = '#2a2010';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Resource reveal glows (drawn over tiles)
    for (const g of resourceGlows) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, TWO_PI);
      const glowGrad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
      glowGrad.addColorStop(0, `rgba(255,255,255,${g.life * 0.4})`);
      glowGrad.addColorStop(0.5, hexToRgba(g.color, g.life * 0.2));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // Rock crumble debris
    for (const crumble of crumbleEffects) {
      const alpha = Math.max(0, crumble.life / 0.6);
      ctx.globalAlpha = alpha;
      for (const p of crumble.pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Dust clouds
    for (const d of dustClouds) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fillStyle = '#8a7a5a';
      ctx.fill();
      ctx.restore();
    }

    // Draw drill/player character
    drawPlayer();

    // Resource display (improved styling)
    drawResourceHUD();

    // View toggle hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Press SPACE to return to surface', CANVAS_W / 2, CANVAS_H - 10);
  }

  // Pre-generate deterministic ore speckle positions per tile
  let oreSpeckles = [];
  function generateOreSpeckles() {
    oreSpeckles = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 10; ++d)
          dots.push({
            ox: 4 + Math.random() * (TILE_SIZE - 8),
            oy: 4 + Math.random() * (TILE_SIZE - 8),
            size: 1.5 + Math.random() * 2.5,
            brightness: 0.4 + Math.random() * 0.6
          });
        row.push(dots);
      }
      oreSpeckles.push(row);
    }
  }

  function drawTile(x, y, tile, r, c) {
    const baseColor = TILE_COLORS[tile] || '#3a2a1a';
    const shadowColor = TILE_SHADOW_COLORS[tile] || '#1a0f05';
    const highlightColor = TILE_HIGHLIGHT_COLORS[tile];
    const bevel = 3; // bevel thickness in pixels

    // Main tile fill (flat base)
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // === Minecraft-style 3D bevel ===
    // Top bevel (bright highlight)
    ctx.fillStyle = highlightColor || lightenColor(baseColor, 40);
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, bevel);

    // Left bevel (slightly less bright)
    ctx.fillStyle = lightenColor(baseColor, 25);
    ctx.fillRect(x + 1, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Bottom bevel (dark shadow)
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 1, y + TILE_SIZE - 1 - bevel, TILE_SIZE - 2, bevel);

    // Right bevel (medium shadow)
    const [br, bg, bb] = parseHex(shadowColor.startsWith('#') ? shadowColor : '#1a0f05');
    ctx.fillStyle = `rgb(${Math.min(255, br + 15)},${Math.min(255, bg + 15)},${Math.min(255, bb + 15)})`;
    ctx.fillRect(x + TILE_SIZE - 1 - bevel, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Inner face gradient (subtle depth)
    const innerGrad = ctx.createLinearGradient(x, y + bevel, x, y + TILE_SIZE - bevel);
    innerGrad.addColorStop(0, lightenColor(baseColor, 10));
    innerGrad.addColorStop(0.5, baseColor);
    innerGrad.addColorStop(1, shadowColor);
    ctx.fillStyle = innerGrad;
    ctx.fillRect(x + 1 + bevel, y + 1 + bevel, TILE_SIZE - 2 - bevel * 2, TILE_SIZE - 2 - bevel * 2);

    // Dirt texture noise dots
    if (tile === TILE_DIRT && dirtNoise[r] && dirtNoise[r][c]) {
      for (const dot of dirtNoise[r][c]) {
        ctx.fillStyle = `rgba(0,0,0,${dot.shade})`;
        ctx.beginPath();
        ctx.arc(x + dot.ox, y + dot.oy, dot.size * 0.6, 0, TWO_PI);
        ctx.fill();
      }
      // Small cracks on dirt
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      const seed = r * GRID_COLS + c;
      ctx.beginPath();
      ctx.moveTo(x + 8 + (seed % 10), y + 5 + (seed % 7));
      ctx.lineTo(x + 15 + (seed % 12), y + 18 + (seed % 5));
      ctx.lineTo(x + 20 + (seed % 8), y + 28 + (seed % 9));
      ctx.stroke();
    }

    // === Ore-specific decorations ===
    if (tile !== TILE_DIRT) {
      // Colored ore speckles (Minecraft-style scattered dots)
      const speckleColors = {
        [TILE_IRON]: ['#cccccc', '#aaaaaa', '#eeeeee', '#999999'],
        [TILE_WATER]: ['#66bbff', '#88ddff', '#4499dd', '#aaeeff'],
        [TILE_COBALT]: ['#7777cc', '#9999ee', '#5555aa', '#aaaaff']
      };
      const colors = speckleColors[tile] || ['#fff'];
      if (oreSpeckles[r] && oreSpeckles[r][c]) {
        for (const dot of oreSpeckles[r][c]) {
          const ci = Math.floor(dot.brightness * colors.length) % colors.length;
          ctx.fillStyle = colors[ci];
          // Square speckles like Minecraft ore pixels
          const sz = dot.size;
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy - sz / 2, sz, sz);
          // Tiny highlight on top-left of each speckle
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy - sz / 2, sz, 1);
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy - sz / 2, 1, sz);
          // Tiny shadow on bottom-right of each speckle
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy + sz / 2 - 1, sz, 1);
          ctx.fillRect(x + dot.ox + sz / 2 - 1, y + dot.oy - sz / 2, 1, sz);
        }
      }

      // Glowing edge around resource tiles
      ctx.save();
      const glowPulse = Math.sin(animTime * 3 + r * 0.5 + c * 0.7) * 0.3 + 0.3;
      ctx.shadowBlur = 8 + glowPulse * 4;
      ctx.shadowColor = baseColor;
      ctx.strokeStyle = highlightColor || baseColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Resource-specific animated details
      if (tile === TILE_IRON) {
        // Metallic streaks
        ctx.fillStyle = 'rgba(200,200,200,0.15)';
        ctx.fillRect(x + 8, y + 10, 2, 20);
        ctx.fillRect(x + 18, y + 6, 2, 15);
        ctx.fillRect(x + 28, y + 12, 2, 18);
        // Sparkle dots
        const sp = Math.sin(animTime * 4 + r + c) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${sp * 0.4})`;
        ctx.beginPath();
        ctx.arc(x + 14, y + 14, 1.5, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 26, y + 22, 1, 0, TWO_PI);
        ctx.fill();
      } else if (tile === TILE_WATER) {
        // Wavy ripple lines
        ctx.strokeStyle = 'rgba(100,180,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let wx = x + 5; wx < x + TILE_SIZE - 5; wx += 2) {
          const wy = y + TILE_SIZE / 2 + Math.sin((wx - x) * 0.3 + animTime * 4) * 3;
          if (wx === x + 5)
            ctx.moveTo(wx, wy);
          else
            ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        // Bubble
        const bubbleY = y + 10 + Math.sin(animTime * 2 + c) * 4;
        ctx.fillStyle = 'rgba(150,200,255,0.3)';
        ctx.beginPath();
        ctx.arc(x + 20, bubbleY, 2, 0, TWO_PI);
        ctx.fill();
      } else if (tile === TILE_COBALT) {
        // Crystal facets
        ctx.fillStyle = 'rgba(100,100,200,0.2)';
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 8);
        ctx.lineTo(x + 20, y + 5);
        ctx.lineTo(x + 28, y + 14);
        ctx.lineTo(x + 22, y + 20);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 22);
        ctx.lineTo(x + 18, y + 18);
        ctx.lineTo(x + 24, y + 30);
        ctx.lineTo(x + 14, y + 32);
        ctx.closePath();
        ctx.fill();
        // Crystal glint
        const glint = Math.sin(animTime * 5 + r * 2 + c) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(180,180,255,${glint * 0.5})`;
        ctx.beginPath();
        ctx.arc(x + 18, y + 12, 1.5, 0, TWO_PI);
        ctx.fill();
      }

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#000';
      ctx.fillText(TILE_LABELS[tile] || '', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 10);
      ctx.shadowBlur = 0;
    }
  }

  function drawPlayer() {
    const px = GRID_OFFSET_X + drillX * TILE_SIZE;
    const py = GRID_OFFSET_Y + drillY * TILE_SIZE;
    const cx = px + TILE_SIZE / 2;
    const cy = px + TILE_SIZE / 2; // intentionally kept but we use py below
    const bob = playerBob;

    // Selection highlight (animated border)
    const selPulse = Math.sin(animTime * 5) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,255,0,${selPulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.setLineDash([]);

    // Player body
    const bodyX = px + TILE_SIZE / 2;
    const bodyY = py + TILE_SIZE / 2 + bob;

    ctx.save();
    ctx.translate(bodyX, bodyY);

    // Mining helmet (top arc)
    ctx.fillStyle = '#da2';
    ctx.beginPath();
    ctx.arc(0, -4, 8, Math.PI, 0);
    ctx.fill();
    // Helmet highlight
    ctx.fillStyle = '#fc4';
    ctx.beginPath();
    ctx.arc(-2, -6, 3, Math.PI, 0);
    ctx.fill();
    // Headlamp
    ctx.fillStyle = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -8, 2.5, 0, TWO_PI);
    ctx.fill();
    // Headlamp glow
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -8, 2, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,128,0.3)';
    ctx.fill();
    ctx.restore();

    // Face
    ctx.fillStyle = '#d8a060';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TWO_PI);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-2.5, -1, 1.2, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.5, -1, 1.2, 0, TWO_PI);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#733';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 2, 2.5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Body/suit
    ctx.fillStyle = '#36a';
    ctx.fillRect(-5, 6, 10, 8);

    // Arms (one holds pickaxe)
    ctx.strokeStyle = '#d8a060';
    ctx.lineWidth = 2.5;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(-9, 14);
    ctx.stroke();
    // Right arm (holding pickaxe, animated)
    ctx.beginPath();
    ctx.moveTo(5, 8);
    if (pickaxeSwinging) {
      const swingDir = lastMineDir.dx !== 0 ? lastMineDir.dx : lastMineDir.dy;
      ctx.lineTo(5 + Math.cos(-pickaxeAngle * swingDir) * 8, 8 + Math.sin(pickaxeAngle) * 4);
    } else
      ctx.lineTo(9, 14);
    ctx.stroke();

    // Pickaxe in right hand
    ctx.save();
    if (pickaxeSwinging) {
      const swingAngle = pickaxeAngle * (lastMineDir.dx >= 0 ? 1 : -1);
      ctx.translate(7, 10);
      ctx.rotate(-0.5 + swingAngle * 1.5);
    } else {
      ctx.translate(9, 13);
      ctx.rotate(-0.3);
    }
    // Handle
    ctx.strokeStyle = '#854';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, -6);
    ctx.stroke();
    // Pick head
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(13, -8);
    ctx.lineTo(10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(5, -10);
    ctx.lineTo(6, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.strokeStyle = '#248';
    ctx.lineWidth = 2.5;
    const legAnim = pickaxeSwinging ? Math.sin(animTime * 15) * 1 : 0;
    ctx.beginPath();
    ctx.moveTo(-3, 14);
    ctx.lineTo(-4 + legAnim, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, 14);
    ctx.lineTo(4 - legAnim, 20);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#543';
    ctx.fillRect(-6 + legAnim, 18, 5, 3);
    ctx.fillRect(2 - legAnim, 18, 5, 3);

    ctx.restore();
  }

  function drawResourceHUD() {
    // Resource panel background
    const panelX = 5;
    const panelY = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(panelX, panelY, 130, 56);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 130, 56);

    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Iron
    ctx.fillStyle = '#bbb';
    ctx.fillText(`Iron: ${resources.iron}`, panelX + 6, panelY + 5);
    // Water
    ctx.fillStyle = '#6af';
    ctx.fillText(`Water: ${resources.water}`, panelX + 6, panelY + 20);
    // Cobalt
    ctx.fillStyle = '#88c';
    ctx.fillText(`Cobalt: ${resources.cobalt}`, panelX + 6, panelY + 35);

    // Carried indicator (right side)
    const carryX = CANVAS_W - 145;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(carryX, panelY, 140, 30);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(carryX, panelY, 140, 30);

    ctx.fillStyle = '#cc8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Carried: ${carried}/${carryCapacity}`, carryX + 6, panelY + 5);

    // Carry capacity bar
    const carryRatio = Math.min(carried / carryCapacity, 1);
    ctx.fillStyle = '#333';
    ctx.fillRect(carryX + 6, panelY + 20, 128, 5);
    ctx.fillStyle = carryRatio >= 1 ? '#f44' : '#da2';
    ctx.fillRect(carryX + 6, panelY + 20, 128 * carryRatio, 5);
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function lightenColor(hex, amount) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ======================================================================
     DRAWING -- UPGRADE PANEL
     ====================================================================== */

  function drawUpgradePanel() {
    const px = CANVAS_W - 170;
    const py = 50;
    const panelH = 30 + UPGRADE_DEFS.length * 24;

    // Panel background with gradient
    const panelGrad = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGrad.addColorStop(0, 'rgba(10,15,30,0.7)');
    panelGrad.addColorStop(1, 'rgba(5,8,20,0.8)');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(px, py, 160, panelH);

    // Border
    ctx.strokeStyle = '#3a4a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, 160, panelH);

    // Header
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Upgrades (U)', px + 8, py + 16);

    // Separator line
    ctx.strokeStyle = '#334';
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 22);
    ctx.lineTo(px + 155, py + 22);
    ctx.stroke();

    const total = totalResources();
    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const def = UPGRADE_DEFS[i];
      const cost = getUpgradeCost(i);
      const ly = py + 28 + i * 24;
      const canAfford = total >= cost;

      // Hover-like highlight for affordable upgrades
      if (canAfford) {
        ctx.fillStyle = 'rgba(60,120,200,0.08)';
        ctx.fillRect(px + 2, ly - 2, 156, 22);
      }

      ctx.fillStyle = canAfford ? '#ccc' : '#555';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${def.name} Lv${upgradeLevels[def.key]}`, px + 8, ly + 10);
      ctx.fillStyle = canAfford ? '#0f0' : '#633';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`[${cost}]`, px + 118, ly + 10);
    }
  }

  /* ======================================================================
     DRAWING -- HUD
     ====================================================================== */

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Title with glow
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#4af';
      ctx.fillStyle = '#4af';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME KEEPER', CANVAS_W / 2, CANVAS_H / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Subtitle
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Defend your dome. Mine resources. Upgrade.', CANVAS_W / 2, CANVAS_H / 2 - 15);

      // Pulsing start prompt
      const startPulse = Math.sin(animTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(170,170,170,${startPulse})`;
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 20);

      // Decorative dome outline
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2 + 100, 50, Math.PI, 0);
      ctx.closePath();
      ctx.strokeStyle = `rgba(80,160,255,${0.2 + Math.sin(animTime * 2) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff0';
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 30);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Red glow title
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f44';
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME DESTROYED', CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Wave: ${waveNumber} -- Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 10);

      const restartPulse = Math.sin(animTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(204,204,204,${restartPulse})`;
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'start';
    }
  }

  /* ======================================================================
     DRAWING -- MAIN
     ====================================================================== */

  function drawGame() {
    const alpha = getTransitionAlpha();
    ctx.globalAlpha = alpha;

    if (currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;

    // Transition overlay (black fade)
    if (alpha < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    drawHUD();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 400, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(15,10,5,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#c80';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#c80';
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

  /* ======================================================================
     STATUS BAR
     ====================================================================== */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${currentView}`;
    if (statusWave) statusWave.textContent = `Wave: ${waveNumber}`;
    if (statusDome) statusDome.textContent = `Dome: ${Math.ceil(domeHP)}/${maxDomeHP}`;
    if (statusResources) statusResources.textContent = `Fe:${resources.iron} H2O:${resources.water} Co:${resources.cobalt}`;
  }

  /* ======================================================================
     GAME LOOP
     ====================================================================== */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    // Always update animations (even on title/pause/game-over for visual polish)
    animTime += state !== STATE_PLAYING ? dt : 0;
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

  /* ======================================================================
     INPUT
     ====================================================================== */

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'F2') {
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

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    if (state !== STATE_PLAYING) return;

    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
      toggleView();
    }

    if (currentView === VIEW_UNDERGROUND) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') tryMine(0, -1);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') tryMine(0, 1);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') tryMine(-1, 0);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') tryMine(1, 0);
    }

    if (e.code === 'KeyU') {
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

  /* -- Click/Tap handling -- */
  canvas.addEventListener('pointerdown', (e) => {
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

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mx - GRID_OFFSET_X) / TILE_SIZE);
      const row = Math.floor((my - GRID_OFFSET_Y) / TILE_SIZE);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const ddx = col - drillX;
        const ddy = row - drillY;
        if (Math.abs(ddx) + Math.abs(ddy) === 1)
          tryMine(ddx, ddy);
        else if (ddx === 0 && ddy === 0)
          toggleView();
      }
    } else {
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

  /* ======================================================================
     MENU ACTIONS
     ====================================================================== */

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

  /* ======================================================================
     OS INTEGRATION
     ====================================================================== */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Dome Keeper -- Game Over -- Wave ${waveNumber}`
      : `Dome Keeper -- Wave ${waveNumber} -- Score ${score}`;
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

  /* ======================================================================
     INIT
     ====================================================================== */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadHighScores();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
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
