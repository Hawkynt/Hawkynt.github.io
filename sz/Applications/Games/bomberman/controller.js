;(function() {
  'use strict';

  /* ── Constants ── */
  const COLS = 15;
  const ROWS = 13;
  const TILE_SIZE = 40;
  const MAX_DT = 0.05;

  /* Cell types */
  const EMPTY = 0;
  const WALL = 1;           // indestructible
  const DESTRUCTIBLE = 2;   // breakable brick

  /* Storage */
  const STORAGE_PREFIX = 'sz-bomberman';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* Player */
  const PLAYER_SPEED_BASE = 4.0;
  const MAX_LIVES = 3;

  /* Bombs */
  const BOMB_TIME = 2.5;
  const FIRE_DURATION = 0.6;
  const NUM_ENEMIES = 3;

  /* Directions: cardinal (up, down, left, right) */
  const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  /* Power-up types */
  const POWERUP_BOMB_UP = 'bomb_up';
  const POWERUP_FIRE_UP = 'fire_up';
  const POWERUP_SPEED_UP = 'speed_up';
  const POWERUP_KICK = 'kick';
  const POWERUP_REMOTE = 'remote';
  const POWERUP_POWER_KICK = 'power_kick';
  const POWERUP_FLY = 'fly';
  const POWERUP_GLOVE = 'glove';
  const POWERUP_CLIMB = 'climb';

  /* Weighted drop table (type, weight, color, letter) */
  const POWERUP_TABLE = [
    { type: POWERUP_BOMB_UP,    weight: 20, color: '#ff6b6b', letter: 'B' },
    { type: POWERUP_FIRE_UP,    weight: 20, color: '#ff9f43', letter: 'F' },
    { type: POWERUP_SPEED_UP,   weight: 15, color: '#2ed573', letter: 'S' },
    { type: POWERUP_KICK,       weight: 12, color: '#1e90ff', letter: 'K' },
    { type: POWERUP_REMOTE,     weight: 10, color: '#e056fd', letter: 'R' },
    { type: POWERUP_POWER_KICK, weight: 6,  color: '#00d2ff', letter: 'P' },
    { type: POWERUP_FLY,        weight: 5,  color: '#87ceeb', letter: 'W' },
    { type: POWERUP_GLOVE,      weight: 6,  color: '#ff69b4', letter: 'G' },
    { type: POWERUP_CLIMB,      weight: 6,  color: '#daa520', letter: 'C' }
  ];
  const POWERUP_TOTAL_WEIGHT = POWERUP_TABLE.reduce((s, e) => s + e.weight, 0);

  /* Enemy type definitions — level-gated with distinct abilities */
  const ENEMY_TYPES = [
    { type: 'slow',    speed: 1.5, hp: 1, color: '#9b59b6', minLevel: 1, points: 100 },
    { type: 'normal',  speed: 2.5, hp: 1, color: '#e74c3c', minLevel: 1, points: 100 },
    { type: 'fast',    speed: 3.5, hp: 1, color: '#e67e22', minLevel: 1, points: 100 },
    { type: 'climber', speed: 2.0, hp: 1, color: '#2ecc71', minLevel: 3, points: 150 },
    { type: 'chaser',  speed: 2.5, hp: 1, color: '#f1c40f', minLevel: 4, points: 200 },
    { type: 'tank',    speed: 1.5, hp: 2, color: '#95a5a6', minLevel: 5, points: 200 },
    { type: 'ghost',   speed: 2.0, hp: 1, color: '#a29bfe', minLevel: 7, points: 250 }
  ];

  function getEnemyTypeDef(typeName) {
    return ENEMY_TYPES.find(t => t.type === typeName) || ENEMY_TYPES[0];
  }

  function randomPowerUpType() {
    let roll = Math.random() * POWERUP_TOTAL_WEIGHT;
    for (const entry of POWERUP_TABLE) {
      roll -= entry.weight;
      if (roll <= 0)
        return entry.type;
    }
    return POWERUP_TABLE[0].type;
  }

  function powerUpEntry(type) {
    return POWERUP_TABLE.find(e => e.type === type) || POWERUP_TABLE[0];
  }

  /* Bomb sliding speed */
  const BOMB_SLIDE_SPEED = 8;

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusScore = document.getElementById('statusScore');
  const statusLevel = document.getElementById('statusLevel');
  const statusLives = document.getElementById('statusLives');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Sprites ── */
  const spriteSheet = new Image();
  spriteSheet.src = 'bomb_party_v4.png';
  const explosionSheet = new Image();
  explosionSheet.src = 'BomberManEffect.png';
  let spritesReady = 0;
  spriteSheet.onload = () => ++spritesReady;
  explosionSheet.onload = () => ++spritesReady;
  spriteSheet.onerror = () => {};
  explosionSheet.onerror = () => {};

  const SP = 16; // sprite tile size on sheet

  // Terrain sprites (from bomb_party_v4 sheet)
  const S_GRASS = { x: SP * 2, y: SP };        // row 1 col 2 — green grass tile
  const S_WALL = { x: 0, y: 0 };              // row 0 col 0 — grey stone wall
  const S_BOX = { x: 0, y: 13 * SP };         // row 13 col 0 — brown destructible block

  // Character frames: [direction] → { stand, walk: [frameA, frameB] }
  // 0=down 1=up 2=left 3=right
  // Each character row has 10 cols laid out as:
  //   col 0=stand top, col 1=stand bottom, cols 2-3=walk bottom,
  //   col 4=stand right, cols 5-7=walk right, cols 8-9=walk top
  // There are NO dedicated left-facing sprites; left is drawn by flipping right.
  // Direction 2 (left) reuses the right sprite coords; the draw call mirrors them.
  function _buildCharFrames(startRow) {
    const y = startRow * SP;
    return [
      // dir 0 = down: stand=col1, walk=[col2, col3]
      { stand: { x: 1 * SP, y }, walk: [{ x: 2 * SP, y }, { x: 3 * SP, y }] },
      // dir 1 = up: stand=col0, walk=[col8, col9]
      { stand: { x: 0 * SP, y }, walk: [{ x: 8 * SP, y }, { x: 9 * SP, y }] },
      // dir 2 = left: same sprites as right, drawn flipped horizontally
      { stand: { x: 4 * SP, y }, walk: [{ x: 5 * SP, y }, { x: 6 * SP, y }] },
      // dir 3 = right: stand=col4, walk=[col5, col6]
      { stand: { x: 4 * SP, y }, walk: [{ x: 5 * SP, y }, { x: 6 * SP, y }] }
    ];
  }

  // Character rows (14-17): green mob, blue mob, mage mob, player
  const S_PLAYER = _buildCharFrames(17);             // row 17 — player (last character row)
  const S_ENEMY_ROWS = {
    slow: _buildCharFrames(14),    // row 14 — green mob
    normal: _buildCharFrames(15),  // row 15 — blue mob
    fast: _buildCharFrames(16),    // row 16 — mage mob
    climber: _buildCharFrames(14),
    chaser: _buildCharFrames(16),
    tank: _buildCharFrames(15),
    ghost: _buildCharFrames(15)
  };

  // Bomb animation frames (row 18, cols 4–9: grey body + brown fuse)
  const S_BOMB = [];
  for (let i = 0; i < 6; ++i)
    S_BOMB[i] = { x: (4 + i) * SP, y: 18 * SP };

  // Fire piece sprites (row 18, cols 0–3)
  const S_FIRE_CENTER = { x: 2 * SP, y: 18 * SP };  // centre cross piece
  const S_FIRE_H = { x: SP, y: 18 * SP };            // horizontal beam mid
  const S_FIRE_END_L = { x: 0, y: 18 * SP };         // left end cap
  const S_FIRE_END_R = { x: 3 * SP, y: 18 * SP };    // right end cap

  // Explosion sheet frame layout (BomberManEffect.png: 336×134)
  const EXPL_FW = 48;
  const EXPL_FH = 67;
  const EXPL_COLS = 7;

  // Per-level grass detail seed
  let grassSeed = [];
  function generateGrassDetails() {
    grassSeed = [];
    for (let i = 0; i < ROWS * COLS; ++i)
      grassSeed[i] = Array.from({ length: 3 }, () => ({
        x: Math.random() * TILE_SIZE,
        y: Math.random() * TILE_SIZE,
        s: 0.5 + Math.random()
      }));
  }

  function drawSprite(s, dx, dy, dw, dh) {
    ctx.drawImage(spriteSheet, s.x, s.y, SP, SP, dx, dy, dw || TILE_SIZE, dh || TILE_SIZE);
  }

  function drawSpriteFlippedH(s, dx, dy, dw, dh) {
    const w = dw || TILE_SIZE;
    const h = dh || TILE_SIZE;
    ctx.save();
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(spriteSheet, s.x, s.y, SP, SP, 0, 0, w, h);
    ctx.restore();
  }

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Place bombs to destroy walls and enemies.', 'Collect power-ups hidden under walls.', '', 'Arrow Keys / WASD = Move', 'Space = Place bomb'] },
    { title: 'Power-Ups & Tips', lines: ['Bomb Up = more bombs, Fire Up = bigger blasts,', 'Speed Up, Kick, Remote Detonation, and more.', '', 'Chain explosions by placing bombs near each other.', 'Trap enemies in corridors for easy kills.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Game State ── */
  let state = STATE_READY;
  let score = 0;
  let lives = MAX_LIVES;
  let currentLevel = 1;
  let highScores = [];

  /* Grid */
  let grid = [];

  /* Player */
  let player = { col: 1, row: 1, x: 0, y: 0, moveProgress: 0, moveDir: null, targetCol: 0, targetRow: 0, facing: 0, walkFrame: 0, walkTimer: 0 };
  let playerSpeed = PLAYER_SPEED_BASE;
  let maxBombs = 1;
  let blastRange = 2;
  let hasKick = false;
  let hasRemote = false;
  let hasPowerKick = false;
  let hasFly = false;
  let hasGlove = false;
  let hasClimb = false;

  /* Bombs */
  let bombs = [];
  let fireCells = [];

  /* Enemies */
  let enemies = [];

  /* Power-ups on the grid */
  let powerUps = [];

  /* Hidden power-ups under destructible walls */
  let hiddenPowerUps = {};

  /* Input */
  const keys = {};

  /* Rendering */
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = COLS * TILE_SIZE * dpr;
    canvas.height = ROWS * TILE_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function addHighScore(finalScore, finalLevel) {
    highScores.push({ score: finalScore, level: finalLevel });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveData();
  }

  /* ── Grid Generation ── */
  function generateArena(level) {
    grid = [];
    for (let r = 0; r < ROWS; ++r) {
      grid[r] = [];
      for (let c = 0; c < COLS; ++c) {
        // Border walls
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1)
          grid[r][c] = WALL;
        // Indestructible pillars at even row & col (alternating pattern using % 2)
        else if (r % 2 === 0 && c % 2 === 0)
          grid[r][c] = WALL;
        else
          grid[r][c] = EMPTY;
      }
    }

    // Place destructible walls with density increasing per level
    const density = Math.min(0.3 + level * 0.05, 0.7);
    for (let r = 1; r < ROWS - 1; ++r) {
      for (let c = 1; c < COLS - 1; ++c) {
        if (grid[r][c] !== EMPTY)
          continue;
        // Keep player spawn area clear (top-left)
        if (r <= 2 && c <= 2)
          continue;
        if (Math.random() < density)
          grid[r][c] = DESTRUCTIBLE;
      }
    }

    // Place hidden power-ups under some destructible walls
    hiddenPowerUps = {};
    const destructibles = [];
    for (let r = 1; r < ROWS - 1; ++r)
      for (let c = 1; c < COLS - 1; ++c)
        if (grid[r][c] === DESTRUCTIBLE)
          destructibles.push(r + ',' + c);

    const numPowerUps = Math.min(4 + level, destructibles.length);
    for (let i = 0; i < numPowerUps && destructibles.length > 0; ++i) {
      const idx = Math.floor(Math.random() * destructibles.length);
      const key = destructibles.splice(idx, 1)[0];
      hiddenPowerUps[key] = randomPowerUpType();
    }
    generateGrassDetails();
  }

  /* ── isWalkable ── */
  function isWalkable(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS)
      return false;
    const cell = grid[row][col];
    return cell === EMPTY;
  }

  /* ── isPlayerWalkable (climb lets player walk over destructible walls) ── */
  function isPlayerWalkable(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS)
      return false;
    const cell = grid[row][col];
    if (cell === EMPTY)
      return true;
    if (hasClimb && cell === DESTRUCTIBLE)
      return true;
    return false;
  }

  /* ── isEnemyWalkable (per-type walkability) ── */
  function isEnemyWalkable(enemy, col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS)
      return false;
    const cell = grid[row][col];
    if (cell === EMPTY)
      return true;
    if (enemy.type === 'climber' && cell === DESTRUCTIBLE)
      return true;
    if (enemy.type === 'ghost' && enemy.phasing)
      return cell !== undefined; // can walk through anything in-bounds
    return false;
  }

  /* ── hasBomb at position ── */
  function hasBombAt(col, row) {
    for (const b of bombs)
      if (b.col === col && b.row === row)
        return true;
    return false;
  }

  /* ── Spawn Enemies ── */
  function spawnEnemies(level) {
    enemies = [];
    const count = NUM_ENEMIES + Math.floor(level / 2);

    // Build eligible pool with weights
    const eligible = ENEMY_TYPES.filter(t => level >= t.minLevel);
    const weights = eligible.map(t => {
      const base = (t.type === 'slow' || t.type === 'normal' || t.type === 'fast') ? 10 : 0;
      const bonus = Math.max(0, level - t.minLevel + 1);
      return base + bonus;
    });
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    function pickType() {
      let roll = Math.random() * totalWeight;
      for (let i = 0; i < eligible.length; ++i) {
        roll -= weights[i];
        if (roll <= 0)
          return eligible[i];
      }
      return eligible[0];
    }

    // Guarantee at least 1 of each newly unlocked type
    const guaranteed = [];
    for (const t of ENEMY_TYPES)
      if (level === t.minLevel && t.minLevel > 1)
        guaranteed.push(t);

    const toSpawn = [];
    for (const g of guaranteed)
      toSpawn.push(g);
    while (toSpawn.length < count)
      toSpawn.push(pickType());

    for (const typeDef of toSpawn) {
      let col, row;
      const canSpawnOnDestructible = typeDef.type === 'climber' || typeDef.type === 'ghost';
      do {
        col = 3 + Math.floor(Math.random() * (COLS - 4));
        row = 3 + Math.floor(Math.random() * (ROWS - 4));
      } while (
        (canSpawnOnDestructible
          ? grid[row][col] === WALL
          : grid[row][col] !== EMPTY) ||
        (col <= 3 && row <= 3)
      );

      const hp = typeDef.type === 'tank' ? 2 + Math.floor(level / 5) : typeDef.hp;
      const enemy = {
        col, row,
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
        type: typeDef.type,
        speed: typeDef.speed,
        hp,
        maxHp: hp,
        hitTimer: 0,
        moveTimer: 0,
        moveDir: null,
        targetCol: col,
        targetRow: row,
        moveProgress: 0,
        alive: true,
        facing: 0,
        walkFrame: 0,
        walkTimer: 0
      };

      // Ghost-specific phase fields
      if (typeDef.type === 'ghost') {
        enemy.phaseTimer = 0;
        enemy.phasing = false;
      }

      enemies.push(enemy);
    }
  }

  /* ── Reset player to spawn position ── */
  function resetPlayerPosition() {
    player.col = 1;
    player.row = 1;
    player.x = 1 * TILE_SIZE + TILE_SIZE / 2;
    player.y = 1 * TILE_SIZE + TILE_SIZE / 2;
    player.moveProgress = 0;
    player.moveDir = null;
    player.facing = 0;
    player.walkFrame = 0;
    player.walkTimer = 0;
  }

  /* ── Place Bomb ── */
  function placeBomb() {
    if (state !== STATE_PLAYING)
      return;

    // Prevent placing on non-EMPTY cells (climb lets you walk on walls, but not plant)
    if (grid[player.row][player.col] !== EMPTY)
      return;

    // Remote detonation: at max bombs or bomb already here, detonate oldest
    if (hasRemote && (bombs.length >= maxBombs || hasBombAt(player.col, player.row))) {
      if (bombs.length > 0)
        detonateBomb(bombs[0]);
      return;
    }

    if (bombs.length >= maxBombs)
      return;
    if (hasBombAt(player.col, player.row))
      return;

    bombs.push({
      col: player.col,
      row: player.row,
      fuse: BOMB_TIME,
      blastRange,
      sliding: false,
      slideDx: 0,
      slideDy: 0,
      slideProgress: 0
    });
  }

  /* ── Detonate Bomb ── */
  function detonateBomb(bomb) {
    const idx = bombs.indexOf(bomb);
    if (idx === -1)
      return;
    bombs.splice(idx, 1);

    const cx = bomb.col * TILE_SIZE + TILE_SIZE / 2;
    const cy = bomb.row * TILE_SIZE + TILE_SIZE / 2;

    // Center fire cell
    fireCells.push({ col: bomb.col, row: bomb.row, timer: FIRE_DURATION, isCenter: true });

    // Primary burst: orange/red circles
    particles.burst(cx, cy, 15, { color: '#ff4500', speed: 5, life: 0.6, size: 3, decay: 0.02, gravity: 0.05 });
    // Secondary burst: yellow star-shaped sparks
    particles.sparkle(cx, cy, 10, { color: '#ffd700', speed: 4, life: 0.5 });
    // Debris: brown square confetti with gravity
    particles.confetti(cx, cy, 6, { colors: ['#8b4513', '#a0522d', '#cd853f'], speed: 3, gravity: 0.12 });

    // Spread in cardinal directions
    for (const dir of DIRS) {
      for (let i = 1; i <= bomb.blastRange; ++i) {
        const fc = bomb.col + dir.dx * i;
        const fr = bomb.row + dir.dy * i;

        if (fc < 0 || fc >= COLS || fr < 0 || fr >= ROWS)
          break;

        const cell = grid[fr][fc];

        // Indestructible wall: stop, blocked
        if (cell === WALL)
          break;

        const fx = fc * TILE_SIZE + TILE_SIZE / 2;
        const fy = fr * TILE_SIZE + TILE_SIZE / 2;

        // Destructible wall: destroy breakable wall and stop
        if (cell === DESTRUCTIBLE) {
          grid[fr][fc] = EMPTY;
          fireCells.push({ col: fc, row: fr, timer: FIRE_DURATION, dirX: dir.dx, dirY: dir.dy, isEnd: true });

          // Enhanced wall destruction: confetti debris with gravity + rotation
          particles.confetti(fx, fy, 8, { colors: ['#8b4513', '#a0522d', '#cd853f', '#d2b48c'], speed: 4, gravity: 0.15 });
          particles.burst(fx, fy, 6, { color: '#a0522d', speed: 3, life: 0.4, size: 2, decay: 0.03 });

          // Reveal hidden power-up from destroyed wall
          const key = fr + ',' + fc;
          if (hiddenPowerUps[key]) {
            powerUps.push({ col: fc, row: fr, type: hiddenPowerUps[key] });
            delete hiddenPowerUps[key];
          }
          break; // Explosion stops at destructible wall
        }

        // Empty: add fire cell
        fireCells.push({ col: fc, row: fr, timer: FIRE_DURATION, dirX: dir.dx, dirY: dir.dy, isEnd: i === bomb.blastRange });

        // Directional sparkle at each fire cell
        particles.sparkle(fx, fy, 3, {
          color: '#ff9f43',
          speed: 2,
          vx: dir.dx * 2,
          vy: dir.dy * 2
        });

        // Trail particle along explosion arm
        particles.trail(fx, fy, {
          color: '#ff6600',
          vx: dir.dx * 1.5,
          vy: dir.dy * 1.5,
          life: 0.3,
          size: 2
        });

        // Chain explosion: trigger adjacent bomb if fire hits another bomb
        for (const otherBomb of bombs) {
          if (otherBomb.col === fc && otherBomb.row === fr) {
            detonateBomb(otherBomb);
            screenShake.trigger(8, 300);
            break;
          }
        }
      }
    }

    // Screen shake scaled by blast range
    screenShake.trigger(3 + bomb.blastRange, 150 + bomb.blastRange * 30);
  }

  /* ── Check fire damage ── */
  function checkFireDamage() {
    for (const fire of fireCells) {
      // Check player hit by fire/explosion
      if (fire.col === player.col && fire.row === player.row && player.moveProgress === 0) {
        playerHitByExplosion();
        if (state === STATE_DEAD)
          return;
      }

      // Check enemy killed by explosion/fire
      for (let i = enemies.length - 1; i >= 0; --i) {
        const e = enemies[i];
        if (e.col === fire.col && e.row === fire.row && e.alive) {
          enemyKilledByExplosion(e, i);
        }
      }
    }
  }

  /* ── Player hit by explosion ── */
  function playerHitByExplosion() {
    --lives;

    // Death particle burst for player
    particles.burst(
      player.col * TILE_SIZE + TILE_SIZE / 2,
      player.row * TILE_SIZE + TILE_SIZE / 2,
      20,
      { color: '#ff0', speed: 5, life: 0.8, size: 3, decay: 0.02 }
    );
    screenShake.trigger(10, 400);

    if (lives <= 0) {
      state = STATE_DEAD;
      addHighScore(score, currentLevel);
      SZ.Dlls.User32.SetWindowText('Bomberman — Game Over');
    } else {
      resetPlayerPosition();
    }
    updateStatus();
  }

  /* ── Enemy killed by explosion ── */
  function enemyKilledByExplosion(enemy, idx) {
    --enemy.hp;

    if (enemy.hp > 0) {
      // Hit but alive — flash + small burst + HP indicator
      enemy.hitTimer = 0.15;
      particles.burst(enemy.x, enemy.y, 8, { color: '#fff', speed: 3, life: 0.3, size: 2, decay: 0.04 });
      floatingText.add(enemy.x, enemy.y, 'HP ' + enemy.hp, { color: '#ff6b6b', decay: 0.04 });
      screenShake.trigger(4, 100);
      return;
    }

    // Dead — remove
    enemy.alive = false;
    enemies.splice(idx, 1);

    const typeDef = getEnemyTypeDef(enemy.type);
    const points = enemy.type === 'tank'
      ? typeDef.points * enemy.maxHp * currentLevel
      : typeDef.points * currentLevel;
    score += points;

    // Death particle burst for enemy destruction
    particles.burst(enemy.x, enemy.y, 15, { color: typeDef.color, speed: 4, life: 0.6, size: 3, decay: 0.02 });

    // Floating score text for enemy kill
    floatingText.add(enemy.x, enemy.y, '+' + points, { color: '#ffd700', decay: 0.025 });

    // Check if level clear — all enemies defeated
    if (enemies.length === 0)
      levelComplete();

    updateStatus();
  }

  /* ── Level Complete ── */
  function levelComplete() {
    ++currentLevel;
    floatingText.add(
      COLS * TILE_SIZE / 2,
      ROWS * TILE_SIZE / 2,
      'LEVEL ' + currentLevel,
      { color: '#fff', decay: 0.015 }
    );
    // Advance to next level
    generateArena(currentLevel);
    spawnEnemies(currentLevel);
    resetPlayerPosition();
    bombs = [];
    fireCells = [];
    powerUps = [];
    SZ.Dlls.User32.SetWindowText('Bomberman — Level ' + currentLevel);
  }

  /* ── Move Enemy AI ── */
  function updateEnemy(enemy, dt) {
    if (!enemy.alive)
      return;

    // Decrement hit flash timer
    if (enemy.hitTimer > 0)
      enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);

    // Ghost phase cycle: solid 3s → phasing 2s → solid 3s → ...
    if (enemy.type === 'ghost') {
      enemy.phaseTimer += dt;
      if (!enemy.phasing) {
        if (enemy.phaseTimer >= 3) {
          enemy.phasing = true;
          enemy.phaseTimer = 0;
        }
      } else {
        if (enemy.phaseTimer >= 2) {
          enemy.phasing = false;
          enemy.phaseTimer = 0;
          // If ghost ended phase inside a wall, push to nearest open cell
          if (grid[enemy.row][enemy.col] !== EMPTY) {
            for (const d of DIRS) {
              const nc = enemy.col + d.dx;
              const nr = enemy.row + d.dy;
              if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && grid[nr][nc] === EMPTY) {
                enemy.col = nc;
                enemy.row = nr;
                enemy.x = nc * TILE_SIZE + TILE_SIZE / 2;
                enemy.y = nr * TILE_SIZE + TILE_SIZE / 2;
                break;
              }
            }
          }
        }
      }
    }

    // If moving between tiles, continue smooth animation
    if (enemy.moveProgress > 0) {
      enemy.moveProgress = Math.min(1, enemy.moveProgress + enemy.speed * dt);
      enemy.walkTimer += dt;
      if (enemy.walkTimer > 0.12) {
        enemy.walkTimer = 0;
        enemy.walkFrame = (enemy.walkFrame + 1) % 2;
      }
      const fromX = enemy.col * TILE_SIZE + TILE_SIZE / 2;
      const fromY = enemy.row * TILE_SIZE + TILE_SIZE / 2;
      const toX = enemy.targetCol * TILE_SIZE + TILE_SIZE / 2;
      const toY = enemy.targetRow * TILE_SIZE + TILE_SIZE / 2;
      // Smooth interpolation (lerp)
      enemy.x = fromX + (toX - fromX) * enemy.moveProgress;
      enemy.y = fromY + (toY - fromY) * enemy.moveProgress;

      if (enemy.moveProgress >= 1) {
        enemy.col = enemy.targetCol;
        enemy.row = enemy.targetRow;
        enemy.moveProgress = 0;
        enemy.x = enemy.col * TILE_SIZE + TILE_SIZE / 2;
        enemy.y = enemy.row * TILE_SIZE + TILE_SIZE / 2;
        enemy.walkFrame = 0;
      }
      return;
    }

    // Decide new direction — timer threshold varies by type
    enemy.moveTimer += dt;
    const threshold = enemy.type === 'chaser' ? 0.2 : 0.3;
    if (enemy.moveTimer < threshold)
      return;
    enemy.moveTimer = 0;

    // Build valid directions using per-type walkability
    const validDirs = [];
    for (const d of DIRS) {
      const nc = enemy.col + d.dx;
      const nr = enemy.row + d.dy;
      if (isEnemyWalkable(enemy, nc, nr) && !hasBombAt(nc, nr))
        validDirs.push(d);
    }

    if (validDirs.length === 0)
      return;

    let chosen;

    if (enemy.type === 'chaser') {
      // Chaser AI: prefer direction reducing Manhattan distance to player
      validDirs.sort((a, b) => {
        const distA = Math.abs(enemy.col + a.dx - player.col) + Math.abs(enemy.row + a.dy - player.row);
        const distB = Math.abs(enemy.col + b.dx - player.col) + Math.abs(enemy.row + b.dy - player.row);
        return distA - distB;
      });
      chosen = Math.random() < 0.7 ? validDirs[0] : validDirs[Math.floor(Math.random() * validDirs.length)];
    } else {
      // Wander AI (slow, normal, fast, tank, climber, ghost)
      chosen = validDirs[Math.floor(Math.random() * validDirs.length)];
      if (enemy.moveDir) {
        const sameDir = validDirs.find(d => d.dx === enemy.moveDir.dx && d.dy === enemy.moveDir.dy);
        if (sameDir && Math.random() < 0.6)
          chosen = sameDir;
      }
    }

    enemy.moveDir = chosen;
    enemy.targetCol = enemy.col + chosen.dx;
    enemy.targetRow = enemy.row + chosen.dy;
    enemy.moveProgress = 0.01;
    const newFacing = chosen.dy < 0 ? 1 : chosen.dy > 0 ? 0 : chosen.dx < 0 ? 2 : 3;
    if (newFacing !== enemy.facing)
      enemy.walkFrame = 0;
    enemy.facing = newFacing;
    enemy.walkTimer = 0;
  }

  /* ── Player Movement ── */
  function updatePlayer(dt) {
    if (state !== STATE_PLAYING)
      return;

    // If moving between tiles, continue smooth animation with lerp/offset
    if (player.moveProgress > 0) {
      player.moveProgress = Math.min(1, player.moveProgress + playerSpeed * dt);
      player.walkTimer += dt;
      if (player.walkTimer > 0.12) {
        player.walkTimer = 0;
        player.walkFrame = (player.walkFrame + 1) % 2;
      }
      const fromX = player.col * TILE_SIZE + TILE_SIZE / 2;
      const fromY = player.row * TILE_SIZE + TILE_SIZE / 2;
      const toX = player.targetCol * TILE_SIZE + TILE_SIZE / 2;
      const toY = player.targetRow * TILE_SIZE + TILE_SIZE / 2;
      // Smooth interpolation
      player.x = fromX + (toX - fromX) * player.moveProgress;
      player.y = fromY + (toY - fromY) * player.moveProgress;

      if (player.moveProgress >= 1) {
        player.col = player.targetCol;
        player.row = player.targetRow;
        player.moveProgress = 0;
        player.x = player.col * TILE_SIZE + TILE_SIZE / 2;
        player.y = player.row * TILE_SIZE + TILE_SIZE / 2;
        player.walkFrame = 0;

        // Check power-up collection at new cell
        collectPowerUp();
      }
      return;
    }

    // Read directional input
    let dx = 0, dy = 0;
    if (keys['ArrowUp'] || keys['KeyW'])
      dy = -1;
    else if (keys['ArrowDown'] || keys['KeyS'])
      dy = 1;
    else if (keys['ArrowLeft'] || keys['KeyA'])
      dx = -1;
    else if (keys['ArrowRight'] || keys['KeyD'])
      dx = 1;

    if (dx === 0 && dy === 0)
      return;

    const newCol = player.col + dx;
    const newRow = player.row + dy;

    // Wall collision check — use isPlayerWalkable (enables climb)
    if (!isPlayerWalkable(newCol, newRow))
      return;

    // Bomb collision — priority-based interaction
    if (hasBombAt(newCol, newRow)) {
      // Fly: walk through bombs freely
      if (hasFly) {
        // Don't block — fall through to movement below
      } else if (hasGlove) {
        throwBomb(newCol, newRow);
        return;
      } else if (hasPowerKick) {
        slideBomb(newCol, newRow, dx, dy);
        return;
      } else if (hasKick) {
        const kickCol = newCol + dx;
        const kickRow = newRow + dy;
        if (isWalkable(kickCol, kickRow) && !hasBombAt(kickCol, kickRow))
          for (const b of bombs)
            if (b.col === newCol && b.row === newRow) {
              b.col = kickCol;
              b.row = kickRow;
              break;
            }
        return;
      } else {
        return;
      }
    }

    player.targetCol = newCol;
    player.targetRow = newRow;
    player.moveProgress = 0.01;
    const newFacing = dy < 0 ? 1 : dy > 0 ? 0 : dx < 0 ? 2 : 3;
    if (newFacing !== player.facing)
      player.walkFrame = 0;
    player.facing = newFacing;
    player.walkTimer = 0;
  }

  /* ── Collect Power-Up ── */
  function collectPowerUp() {
    for (let i = powerUps.length - 1; i >= 0; --i) {
      const pu = powerUps[i];
      if (pu.col === player.col && pu.row === player.row) {
        applyPowerUp(pu.type);

        // Sparkle/burst particles on power-up collection
        particles.sparkle(
          pu.col * TILE_SIZE + TILE_SIZE / 2,
          pu.row * TILE_SIZE + TILE_SIZE / 2,
          10,
          { color: '#ffd700', speed: 3, life: 0.5, size: 2, decay: 0.03 }
        );

        floatingText.add(
          pu.col * TILE_SIZE + TILE_SIZE / 2,
          pu.row * TILE_SIZE + TILE_SIZE / 2,
          pu.type.replace('_', ' ').toUpperCase(),
          { color: '#0ff', decay: 0.025 }
        );

        powerUps.splice(i, 1);
      }
    }
  }

  /* ── Throw Bomb (Glove) ── */
  function throwBomb(col, row) {
    const bomb = bombs.find(b => b.col === col && b.row === row);
    if (!bomb)
      return;

    // Pick random cardinal direction and range 3-5
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const range = 3 + Math.floor(Math.random() * 3);

    let landCol = col;
    let landRow = row;
    // Fly over all cells (even walls)
    for (let i = 1; i <= range; ++i) {
      const nc = col + dir.dx * i;
      const nr = row + dir.dy * i;
      if (nc < 1 || nc >= COLS - 1 || nr < 1 || nr >= ROWS - 1)
        break;
      landCol = nc;
      landRow = nr;
    }

    // If landing on indestructible WALL, back up to last non-WALL cell
    while (grid[landRow][landCol] === WALL && (landCol !== col || landRow !== row)) {
      landCol -= dir.dx;
      landRow -= dir.dy;
    }

    bomb.col = landCol;
    bomb.row = landRow;

    // Particle burst at landing spot
    const lx = landCol * TILE_SIZE + TILE_SIZE / 2;
    const ly = landRow * TILE_SIZE + TILE_SIZE / 2;
    particles.burst(lx, ly, 10, { color: '#ff69b4', speed: 4, life: 0.5, size: 3, decay: 0.03 });
  }

  /* ── Slide Bomb (Power Kick) ── */
  function slideBomb(col, row, dx, dy) {
    const bomb = bombs.find(b => b.col === col && b.row === row);
    if (!bomb || bomb.sliding)
      return;
    bomb.sliding = true;
    bomb.slideDx = dx;
    bomb.slideDy = dy;
    bomb.slideProgress = 0;
  }

  /* ── Update Sliding Bombs ── */
  function updateSlidingBombs(dt) {
    for (const bomb of bombs) {
      if (!bomb.sliding)
        continue;

      bomb.slideProgress += BOMB_SLIDE_SPEED * dt;
      if (bomb.slideProgress >= 1) {
        bomb.slideProgress = 0;
        const nextCol = bomb.col + bomb.slideDx;
        const nextRow = bomb.row + bomb.slideDy;

        // Stop if wall/bomb/bounds
        if (!isWalkable(nextCol, nextRow) || hasBombAt(nextCol, nextRow)) {
          bomb.sliding = false;
          bomb.slideDx = 0;
          bomb.slideDy = 0;
          bomb.slideProgress = 0;
          // Dust particles on stop
          const sx = bomb.col * TILE_SIZE + TILE_SIZE / 2;
          const sy = bomb.row * TILE_SIZE + TILE_SIZE / 2;
          particles.burst(sx, sy, 6, { color: '#aaa', speed: 2, life: 0.3, size: 2, decay: 0.04, gravity: 0.05 });
          continue;
        }

        // Stop if hitting an enemy
        let hitEnemy = false;
        for (const e of enemies)
          if (e.alive && e.col === nextCol && e.row === nextRow) {
            hitEnemy = true;
            break;
          }

        if (hitEnemy) {
          bomb.sliding = false;
          bomb.slideDx = 0;
          bomb.slideDy = 0;
          bomb.slideProgress = 0;
          const sx = bomb.col * TILE_SIZE + TILE_SIZE / 2;
          const sy = bomb.row * TILE_SIZE + TILE_SIZE / 2;
          particles.burst(sx, sy, 6, { color: '#aaa', speed: 2, life: 0.3, size: 2, decay: 0.04, gravity: 0.05 });
          continue;
        }

        // Move to next cell
        bomb.col = nextCol;
        bomb.row = nextRow;
      }
    }
  }

  /* ── Apply Power-Up ── */
  function applyPowerUp(type) {
    if (type === POWERUP_BOMB_UP)
      ++maxBombs;
    else if (type === POWERUP_FIRE_UP)
      ++blastRange;
    else if (type === POWERUP_SPEED_UP)
      playerSpeed += 0.5;
    else if (type === POWERUP_KICK)
      hasKick = true;
    else if (type === POWERUP_REMOTE)
      hasRemote = true;
    else if (type === POWERUP_POWER_KICK)
      hasPowerKick = true;
    else if (type === POWERUP_FLY)
      hasFly = true;
    else if (type === POWERUP_GLOVE)
      hasGlove = true;
    else if (type === POWERUP_CLIMB)
      hasClimb = true;
  }

  /* ── Reset ── */
  function resetGame() {
    state = STATE_READY;
    score = 0;
    lives = MAX_LIVES;
    currentLevel = 1;
    playerSpeed = PLAYER_SPEED_BASE;
    maxBombs = 1;
    blastRange = 2;
    hasKick = false;
    hasRemote = false;
    hasPowerKick = false;
    hasFly = false;
    hasGlove = false;
    hasClimb = false;
    bombs = [];
    fireCells = [];
    powerUps = [];
    generateArena(currentLevel);
    spawnEnemies(currentLevel);
    resetPlayerPosition();
    particles.clear();
    floatingText.clear();
    updateStatus();
    SZ.Dlls.User32.SetWindowText('Bomberman');
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

    // Player movement
    updatePlayer(dt);

    // Update enemies
    for (const e of enemies)
      updateEnemy(e, dt);

    // Update bomb fuses
    for (let i = bombs.length - 1; i >= 0; --i) {
      bombs[i].fuse -= dt;
      if (bombs[i].fuse <= 0)
        detonateBomb(bombs[i]);
    }

    // Update sliding bombs
    updateSlidingBombs(dt);

    // Update fire timers — clear fire cells after fire duration expires
    for (let i = fireCells.length - 1; i >= 0; --i) {
      fireCells[i].timer -= dt;
      if (fireCells[i].timer <= 0)
        fireCells.splice(i, 1);
    }

    // Check fire damage to player and enemies
    checkFireDamage();

    // Check enemy-player collision (distance-based for smooth movement)
    for (const e of enemies) {
      if (!e.alive)
        continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const collisionThreshold = TILE_SIZE * 0.6;
      if (dx * dx + dy * dy < collisionThreshold * collisionThreshold) {
        playerHitByExplosion();
        if (state === STATE_DEAD)
          return;
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
    const w = COLS * TILE_SIZE;
    const h = ROWS * TILE_SIZE;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    screenShake.apply(ctx);
    ctx.imageSmoothingEnabled = false;

    // Draw grid
    for (let r = 0; r < ROWS; ++r) {
      for (let c = 0; c < COLS; ++c) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const cell = grid[r][c];

        if (spritesReady < 1) {
          if (cell === WALL) {
            ctx.fillStyle = '#555';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#666';
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          } else if (cell === DESTRUCTIBLE) {
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#cd853f';
            ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.beginPath();
            ctx.moveTo(x + TILE_SIZE / 2, y + 3);
            ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 3, y + TILE_SIZE / 2);
            ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE / 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#2d3436';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#353b48';
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
          continue;
        }

        // Sprite-based rendering
        if (cell === WALL) {
          drawSprite(S_WALL, x, y);
        } else {
          drawSprite(S_GRASS, x, y);
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }
          if (cell === EMPTY) {
            const details = grassSeed[r * COLS + c];
            if (details) {
              ctx.fillStyle = 'rgba(0,80,0,0.15)';
              for (const dot of details)
                ctx.fillRect(x + dot.x, y + dot.y, dot.s, dot.s);
            }
          } else if (cell === DESTRUCTIBLE) {
            drawSprite(S_BOX, x, y);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
        ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      }
    }

    // Draw power-ups with power-up sparkle effect
    for (const pu of powerUps) {
      const px = pu.col * TILE_SIZE + TILE_SIZE / 2;
      const py = pu.row * TILE_SIZE + TILE_SIZE / 2;
      const entry = powerUpEntry(pu.type);
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8 + 4 * Math.sin(Date.now() / 200);
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.arc(px, py, TILE_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Icon letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.letter, px, py);
    }

    // Draw bombs (with slide interpolation)
    for (const bomb of bombs) {
      let bx = bomb.col * TILE_SIZE + TILE_SIZE / 2;
      let by = bomb.row * TILE_SIZE + TILE_SIZE / 2;
      if (bomb.sliding && bomb.slideProgress > 0) {
        bx += bomb.slideDx * bomb.slideProgress * TILE_SIZE;
        by += bomb.slideDy * bomb.slideProgress * TILE_SIZE;
      }
      const pulse = 1 + 0.08 * Math.sin(bomb.fuse * 8);
      if (spritesReady >= 1) {
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(bx, by + TILE_SIZE * 0.3, TILE_SIZE * 0.25, TILE_SIZE * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bomb sprite (frame based on fuse)
        const frameIdx = Math.min(5, Math.floor((1 - bomb.fuse / BOMB_TIME) * 5.99));
        const sz = TILE_SIZE * pulse;
        drawSprite(S_BOMB[frameIdx], bx - sz / 2, by - sz / 2, sz, sz);
        // Fuse spark with glow
        ctx.save();
        ctx.shadowColor = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        ctx.shadowBlur = 6;
        ctx.fillStyle = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        ctx.beginPath();
        ctx.arc(bx, by - TILE_SIZE * 0.35 * pulse, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(bx, by, TILE_SIZE / 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        ctx.beginPath();
        ctx.arc(bx, by - TILE_SIZE / 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw fire cells
    for (const fire of fireCells) {
      const progress = fire.timer / FIRE_DURATION;
      const fx = fire.col * TILE_SIZE;
      const fy = fire.row * TILE_SIZE;
      const fcx = fx + TILE_SIZE / 2;
      const fcy = fy + TILE_SIZE / 2;

      ctx.save();
      ctx.globalAlpha = Math.min(1, progress * 2);
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 20 * progress;

      if (spritesReady >= 2 && fire.isCenter) {
        // Center burst from explosion sheet
        const frameIdx = Math.min(EXPL_COLS - 1, Math.floor((1 - progress) * EXPL_COLS));
        const es = TILE_SIZE + 8;
        ctx.drawImage(explosionSheet, frameIdx * EXPL_FW, 0, EXPL_FW, EXPL_FH,
          fcx - es / 2, fcy - es / 2, es, es);
      } else if (spritesReady >= 1 && fire.dirX !== undefined) {
        // Arm/end from main sprite sheet (horizontal pieces rotated for vertical)
        const isH = fire.dirX !== 0;
        if (isH) {
          const s = fire.isEnd
            ? (fire.dirX > 0 ? S_FIRE_END_R : S_FIRE_END_L)
            : S_FIRE_H;
          drawSprite(s, fx, fy);
        } else {
          // Vertical: rotate horizontal pieces 90° CW
          const s = fire.isEnd ? S_FIRE_END_R : S_FIRE_H;
          ctx.translate(fcx, fcy);
          ctx.rotate(fire.dirY > 0 ? Math.PI / 2 : -Math.PI / 2);
          ctx.drawImage(spriteSheet, s.x, s.y, SP, SP, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        }
      } else {
        // Fallback: animated gradient
        const radius = (TILE_SIZE / 2 - 2) * Math.min(1, progress * 1.5);
        const pulseGlow = 0.7 + 0.3 * Math.sin(fire.timer * 12);
        ctx.globalAlpha = Math.min(1, progress * 1.8) * pulseGlow;
        const grad = ctx.createRadialGradient(fcx, fcy, 0, fcx, fcy, radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.25, '#ffee58');
        grad.addColorStop(0.5, '#ff9800');
        grad.addColorStop(0.8, '#ff4500');
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fcx, fcy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw enemies
    for (const e of enemies) {
      if (!e.alive)
        continue;

      const typeDef = getEnemyTypeDef(e.type);
      const er = TILE_SIZE / 3;

      ctx.save();

      // Ghost phasing: reduced alpha + pulsing glow
      if (e.type === 'ghost' && e.phasing) {
        ctx.globalAlpha = 0.3 + 0.1 * Math.sin(Date.now() / 150);
        ctx.shadowColor = '#a29bfe';
        ctx.shadowBlur = 12 + 4 * Math.sin(Date.now() / 200);
      } else {
        ctx.shadowColor = typeDef.color;
        ctx.shadowBlur = 6;
      }

      if (spritesReady >= 1 && e.hitTimer <= 0) {
        // Character shadow
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + TILE_SIZE * 0.35, TILE_SIZE * 0.28, TILE_SIZE * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Sprite (different character row per enemy type)
        // Facing 2 (left) uses the right-facing sprite horizontally flipped
        const eAllFrames = S_ENEMY_ROWS[e.type] || S_ENEMY_ROWS.normal;
        const eDirFrames = eAllFrames[e.facing];
        const s = e.moveProgress > 0 ? eDirFrames.walk[e.walkFrame] : eDirFrames.stand;
        if (e.facing === 2)
          drawSpriteFlippedH(s, e.x - TILE_SIZE / 2, e.y - TILE_SIZE / 2);
        else
          drawSprite(s, e.x - TILE_SIZE / 2, e.y - TILE_SIZE / 2);
      } else {
        // Hit flash or fallback
        ctx.fillStyle = (e.hitTimer > 0) ? '#fff' : typeDef.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, er, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x - 4, e.y - 3, 3, 0, Math.PI * 2);
        ctx.arc(e.x + 4, e.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(e.x - 3, e.y - 3, 1.5, 0, Math.PI * 2);
        ctx.arc(e.x + 5, e.y - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Climber visual: 4 small leg dots
      if (e.type === 'climber') {
        ctx.fillStyle = '#1a9c56';
        for (const d of DIRS) {
          ctx.beginPath();
          ctx.arc(e.x + d.dx * (er + 3), e.y + d.dy * (er + 3), 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Chaser visual: angry eyebrows
      if (e.type === 'chaser') {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x - 7, e.y - 8);
        ctx.lineTo(e.x - 2, e.y - 6);
        ctx.moveTo(e.x + 7, e.y - 8);
        ctx.lineTo(e.x + 2, e.y - 6);
        ctx.stroke();
      }

      // Tank HP pips
      if (e.type === 'tank' && e.maxHp > 1) {
        const pipY = e.y + er + 5;
        const pipSpacing = 6;
        const startX = e.x - (e.maxHp - 1) * pipSpacing / 2;
        for (let p = 0; p < e.maxHp; ++p) {
          ctx.fillStyle = p < e.hp ? '#fff' : '#444';
          ctx.beginPath();
          ctx.arc(startX + p * pipSpacing, pipY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Draw player
    ctx.save();
    ctx.shadowColor = '#4ec0ca';
    ctx.shadowBlur = 8;
    if (spritesReady >= 1) {
      // Character shadow
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + TILE_SIZE * 0.35, TILE_SIZE * 0.28, TILE_SIZE * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Player sprite — facing 2 (left) uses the right-facing sprite flipped
      const pFrames = S_PLAYER[player.facing];
      const s = player.moveProgress > 0 ? pFrames.walk[player.walkFrame] : pFrames.stand;
      if (player.facing === 2)
        drawSpriteFlippedH(s, player.x - TILE_SIZE / 2, player.y - TILE_SIZE / 2);
      else
        drawSprite(s, player.x - TILE_SIZE / 2, player.y - TILE_SIZE / 2);
    } else {
      ctx.fillStyle = '#4ec0ca';
      ctx.beginPath();
      ctx.arc(player.x, player.y, TILE_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(player.x - 4, player.y - 3, 3, 0, Math.PI * 2);
      ctx.arc(player.x + 4, player.y - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(player.x - 3, player.y - 3, 1.5, 0, Math.PI * 2);
      ctx.arc(player.x + 5, player.y - 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    // HUD overlay
    if (state === STATE_READY) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('BOMBERMAN', w / 2, h * 0.35);
      ctx.font = '16px sans-serif';
      ctx.fillText('Tap or press Space to Start', w / 2, h * 0.5);
      ctx.fillText('Arrows/WASD: Move | Space: Bomb', w / 2, h * 0.6);
      ctx.restore();
    }

    if (state === STATE_PAUSED) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('PAUSED', w / 2, h / 2);
      ctx.restore();
    }

    if (state === STATE_DEAD) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f44';
      ctx.fillText('GAME OVER', w / 2, h * 0.35);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Score: ' + score, w / 2, h * 0.45);
      ctx.fillText('Level: ' + currentLevel, w / 2, h * 0.5);
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press Space to Restart', w / 2, h * 0.6);
      ctx.restore();
    }

    ctx.restore();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    const w = COLS * TILE_SIZE;
    const h = ROWS * TILE_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = w / 2, pw = 380, ph = 220, px = cx - pw / 2, py = (h - ph) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#f90';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#f90';
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
    statusScore.textContent = 'Score: ' + score;
    statusLevel.textContent = 'Level: ' + currentLevel;
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
      updateStatus();
    } else if (state === STATE_DEAD) {
      resetGame();
    }
  }

  document.addEventListener('keydown', function(e) {
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

    if (e.code === 'Space') {
      e.preventDefault();
      if (state === STATE_READY || state === STATE_DEAD)
        handleStart();
      else if (state === STATE_PLAYING)
        placeBomb();
    }
  });

  document.addEventListener('keyup', function(e) {
    keys[e.code] = false;
  });

  /* ── Click/Tap to start / advance tutorial ── */
  canvas.addEventListener('pointerdown', () => {
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_DEAD)
      handleStart();
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
          const entry = highScores[i] || { score: 0, level: 0 };
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${i + 1}</td><td>${entry.score}</td><td>${entry.level}</td>`;
          tbody.appendChild(tr);
        }
        const result = await SZ.Dialog.show('highScoresBackdrop');
        if (result === 'reset') {
          highScores = [];
          saveData();
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
    if (msg === WM_THEMECHANGED) {
      // Theme changed — CSS handles it
    }
    if (msg === WM_SIZE) {
      setupCanvas();
    }
  });

  SZ.Dlls.User32.SetWindowText('Bomberman');

  /* ── Init ── */
  loadData();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  setupCanvas();
  resetGame();
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  animFrameId = requestAnimationFrame(gameLoop);

})();
