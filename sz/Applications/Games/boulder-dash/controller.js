;(function() {
  'use strict';

  /* ── Constants ── */
  const COLS = 40;
  const ROWS = 22;
  const TILE_SIZE = 24;
  const HALF_TILE = TILE_SIZE / 2;
  const MAX_DT = 0.05;

  /* Cell types */
  const EMPTY = 0;
  const WALL = 1;
  const DIRT = 2;
  const BOULDER = 3;
  const GEM = 4;
  const EXIT = 5;

  /* States */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DEAD = 'DEAD';

  /* Storage */
  const STORAGE_PREFIX = 'sz-boulder-dash';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* Gameplay */
  const MAX_LIVES = 3;
  const MOVE_SPEED = 8;
  const GEM_SCORE = 100;
  const ENEMY_KILL_SCORE = 500;
  const TIME_BONUS_FACTOR = 5;

  /* Directions */
  const DIRS = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 }
  };

  /* ── API bootstrap ── */
  const { User32 } = window.SZ?.Dlls ?? {};
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Status bar elements ── */
  const elScore = document.getElementById('statusScore');
  const elLevel = document.getElementById('statusLevel');
  const elLives = document.getElementById('statusLives');
  const elState = document.getElementById('statusState');
  const elTime = document.getElementById('statusTime');
  const elGems = document.getElementById('statusGems');

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Dig through caves and collect gems.', 'Reach the gem quota to unlock the exit.', '', 'Arrow Keys / WASD = Move & dig', 'Avoid falling boulders and enemies!'] },
    { title: 'Tips', lines: ['Boulders fall when unsupported -- use this', 'to crush enemies or clear paths.', '', 'Watch the timer! Collect gems quickly.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Game state ── */
  let grid = [];
  let state = STATE_READY;
  let score = 0;
  let lives = MAX_LIVES;
  let currentLevel = 1;
  let highScores = [];

  /* Player */
  let player = { col: 1, row: 1, targetCol: 1, targetRow: 1, moveProgress: 1, alive: true };

  /* Enemies */
  let enemies = [];

  /* Level */
  let gemsCollected = 0;
  let gemsRequired = 0;
  let exitOpen = false;
  let exitCol = 0;
  let exitRow = 0;
  let timeLeft = 0;
  let TIME_LIMIT = 150;

  /* Boulder physics */
  let fallingBoulders = new Map();
  let slidingBoulders = new Map();
  let fadingCells = [];
  const FALL_ANIM_SPEED = 10;
  const SLIDE_ANIM_SPEED = 8;
  const FADE_SPEED = 4;

  /* Input */
  const keysDown = {};
  let moveQueue = null;

  /* ── High score persistence ── */
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      highScores = raw ? JSON.parse(raw) : [];
    } catch (e) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (e) {
      // storage unavailable
    }
  }

  function addHighScore(s, lvl) {
    highScores.push({ score: s, level: lvl, date: Date.now() });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  /* ── Level generator ── */
  function generateLevel(level) {
    grid = [];
    enemies = [];
    fallingBoulders = new Map();
    slidingBoulders = new Map();
    fadingCells = [];
    gemsCollected = 0;
    exitOpen = false;

    const boulderChance = Math.min(0.12 + level * 0.01, 0.25);
    const gemChance = Math.min(0.06 + level * 0.005, 0.12);
    const dirtChance = 0.55;
    gemsRequired = Math.min(8 + level * 2, 30);
    TIME_LIMIT = Math.max(150 - level * 5, 60);
    timeLeft = TIME_LIMIT;

    let totalGems = 0;

    for (let r = 0; r < ROWS; ++r) {
      grid[r] = [];
      for (let c = 0; c < COLS; ++c) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          grid[r][c] = WALL;
          continue;
        }
        // Player start area
        if (r <= 2 && c <= 2) {
          grid[r][c] = (r === 1 && c === 1) ? EMPTY : DIRT;
          continue;
        }
        const rng = Math.random();
        if (rng < boulderChance) {
          grid[r][c] = BOULDER;
        } else if (rng < boulderChance + gemChance) {
          grid[r][c] = GEM;
          ++totalGems;
        } else if (rng < boulderChance + gemChance + dirtChance) {
          grid[r][c] = DIRT;
        } else {
          grid[r][c] = EMPTY;
        }
      }
    }

    // Ensure enough gems
    while (totalGems < gemsRequired + 3) {
      const r = 1 + Math.floor(Math.random() * (ROWS - 2));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      if (grid[r][c] === DIRT || grid[r][c] === EMPTY) {
        grid[r][c] = GEM;
        ++totalGems;
      }
    }

    // Place exit in bottom-right area
    exitRow = ROWS - 2;
    exitCol = COLS - 2;
    grid[exitRow][exitCol] = WALL; // hidden until unlocked

    // Place enemies
    const numEnemies = Math.min(2 + level, 8);
    for (let i = 0; i < numEnemies; ++i) {
      let er, ec;
      do {
        er = 3 + Math.floor(Math.random() * (ROWS - 5));
        ec = 3 + Math.floor(Math.random() * (COLS - 5));
      } while (grid[er][ec] === WALL || grid[er][ec] === BOULDER);
      grid[er][ec] = EMPTY;
      enemies.push({
        col: ec, row: er,
        targetCol: ec, targetRow: er,
        moveProgress: 1,
        direction: Math.floor(Math.random() * 4),
        alive: true,
        moveTimer: 0
      });
    }
  }

  /* ── Player movement & digging ── */
  function tryMovePlayer(dx, dy) {
    if (state !== STATE_PLAYING || !player.alive) return;
    if (player.moveProgress < 1) return;

    const nc = player.col + dx;
    const nr = player.row + dy;

    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return;

    const cell = grid[nr][nc];

    // Wall — blocked
    if (cell === WALL) return;

    // Boulder — push horizontally only
    if (cell === BOULDER) {
      if (dy !== 0) return; // cannot push boulders vertically
      const behindCol = nc + dx;
      if (behindCol < 0 || behindCol >= COLS) return;
      if (grid[nr][behindCol] !== EMPTY) return;
      // Push boulder sideways into empty space (with slide animation)
      grid[nr][behindCol] = BOULDER;
      grid[nr][nc] = EMPTY;
      slidingBoulders.set(nr * COLS + behindCol, { slideProgress: 0, fromCol: nc });
      particles.burst(tileX(behindCol), tileY(nr), 4, { color: '#a0a0a0', life: 0.3, speed: 30 });
    }

    // Dig through dirt (with fade-out animation)
    if (cell === DIRT) {
      grid[nr][nc] = EMPTY;
      fadingCells.push({ col: nc, row: nr, type: DIRT, alpha: 1 });
      particles.burst(tileX(nc), tileY(nr), 6, { color: '#8B4513', life: 0.4, speed: 40 }); // dig dirt particle
    }

    // Gem collection (with pop animation)
    if (cell === GEM) {
      grid[nr][nc] = EMPTY;
      fadingCells.push({ col: nc, row: nr, type: GEM, alpha: 1 });
      ++gemsCollected;
      score += GEM_SCORE;
      // Gem sparkle particles
      particles.sparkle(tileX(nc), tileY(nr), 10, { color: '#00ffff', life: 0.6 });
      floatingText.add(tileX(nc), nr * TILE_SIZE, '+' + GEM_SCORE, { color: '#00ffff' });
      // Check exit unlock
      if (gemsCollected >= gemsRequired && !exitOpen) {
        exitOpen = true;
        grid[exitRow][exitCol] = EXIT;
        particles.sparkle(tileX(exitCol), tileY(exitRow), 15, { color: '#ffd700', life: 1.0 });
      }
    }

    // Exit — level complete
    if (cell === EXIT && exitOpen) {
      levelComplete();
      return;
    }

    // Start smooth movement
    player.targetCol = nc;
    player.targetRow = nr;
    player.moveProgress = 0;
  }

  /* ── Boulder physics ── */
  function updateBoulderPhysics(dt) {
    // Scan bottom-up so boulders settle properly
    for (let r = ROWS - 2; r >= 1; --r) {
      for (let c = 1; c < COLS - 1; ++c) {
        if (grid[r][c] !== BOULDER) continue;

        const below = grid[r + 1][c];
        const key = r * COLS + c;

        // Can fall straight down
        if (below === EMPTY) {
          grid[r][c] = EMPTY;
          grid[r + 1][c] = BOULDER;
          fallingBoulders.set((r + 1) * COLS + c, { fallProgress: 0, fromRow: r });
          fallingBoulders.delete(key);

          // Check if boulder crushes player
          if (player.col === c && player.row === r + 1)
            playerDeath();

          // Check if boulder crushes enemy
          for (const enemy of enemies) {
            if (enemy.alive && enemy.col === c && enemy.row === r + 1) {
              enemy.alive = false;
              score += ENEMY_KILL_SCORE;
              particles.burst(tileX(c), tileY(r + 1), 12, { color: '#ff4444', life: 0.5, speed: 60 });
              floatingText.add(tileX(c), (r + 1) * TILE_SIZE, '+' + ENEMY_KILL_SCORE, { color: '#ff4444' });
              screenShake.trigger(3, 0.15);
            }
          }
          continue;
        }

        // Boulder sliding off rounded objects (other boulders or gems)
        if (below === BOULDER || below === GEM) {
          const sides = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (const side of sides) {
            const sc = c + side;
            if (sc < 1 || sc >= COLS - 1) continue;
            if (grid[r][sc] === EMPTY && grid[r + 1][sc] === EMPTY) {
              grid[r][c] = EMPTY;
              grid[r][sc] = BOULDER;
              fallingBoulders.delete(key);
              slidingBoulders.set(r * COLS + sc, { slideProgress: 0, fromCol: c });
              break;
            }
          }
        }

        // Landing — was falling, now settled (dt-based)
        if (fallingBoulders.has(key)) {
          const fb = fallingBoulders.get(key);
          fb.fallProgress += dt * FALL_ANIM_SPEED;
          if (fb.fallProgress >= 1) {
            fallingBoulders.delete(key);
            particles.burst(tileX(c), (r + 1) * TILE_SIZE, 5, { color: '#aa8866', life: 0.3, speed: 25 }); // boulder dust landing
            screenShake.trigger(2, 0.1);
          }
        }
      }
    }

    // Update sliding boulders (dt-based)
    for (const [skey, sb] of slidingBoulders) {
      sb.slideProgress += dt * SLIDE_ANIM_SPEED;
      if (sb.slideProgress >= 1)
        slidingBoulders.delete(skey);
    }
  }

  /* ── Enemy movement AI ── */
  function updateEnemies(dt) {
    const dirVecs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
    ];

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      if (enemy.moveProgress < 1) {
        enemy.moveProgress = Math.min(1, enemy.moveProgress + dt * MOVE_SPEED * 0.5);
        if (enemy.moveProgress >= 1) {
          enemy.col = enemy.targetCol;
          enemy.row = enemy.targetRow;
        }
        continue;
      }

      enemy.moveTimer += dt;
      if (enemy.moveTimer < 0.15) continue;
      enemy.moveTimer = 0;

      // Wall-following AI: try to turn left, else go straight, else turn right, else reverse
      const tryDirs = [
        (enemy.direction + 3) % 4,
        enemy.direction,
        (enemy.direction + 1) % 4,
        (enemy.direction + 2) % 4
      ];

      let moved = false;
      for (const d of tryDirs) {
        const dir = dirVecs[d];
        const nc = enemy.col + dir.dx;
        const nr = enemy.row + dir.dy;
        if (nc < 1 || nc >= COLS - 1 || nr < 1 || nr >= ROWS - 1) continue;
        if (grid[nr][nc] !== EMPTY && grid[nr][nc] !== EXIT) continue;
        enemy.direction = d;
        enemy.targetCol = nc;
        enemy.targetRow = nr;
        enemy.moveProgress = 0;
        moved = true;
        break;
      }
      if (!moved)
        enemy.direction = (enemy.direction + 2) % 4;

      // Check enemy-player collision
      if (enemy.col === player.col && enemy.row === player.row)
        playerDeath();
    }
  }

  /* ── Player death ── */
  function playerDeath() {
    if (!player.alive || state !== STATE_PLAYING) return;
    player.alive = false;
    --lives;

    // Death explosion particles
    particles.burst(tileX(player.col), tileY(player.row), 20, { color: '#ff2200', life: 0.8, speed: 80 });
    screenShake.trigger(6, 0.3);

    if (lives <= 0) {
      state = STATE_DEAD;
      addHighScore(score, currentLevel);
      updateTitle();
    } else {
      // Respawn after short delay
      setTimeout(() => {
        if (state === STATE_DEAD) return;
        resetPlayerPosition();
        player.alive = true;
      }, 1500);
    }
  }

  function resetPlayerPosition() {
    player.col = 1;
    player.row = 1;
    player.targetCol = 1;
    player.targetRow = 1;
    player.moveProgress = 1;
    grid[1][1] = EMPTY;
    grid[1][2] = EMPTY;
    grid[2][1] = EMPTY;
  }

  /* ── Level complete ── */
  function levelComplete() {
    // Time bonus
    const timeBonus = Math.floor(timeLeft) * TIME_BONUS_FACTOR;
    score += timeBonus;
    floatingText.add(canvas.width / 2, canvas.height / 2 - 20, 'Time Bonus +' + timeBonus, { color: '#ffd700', size: 20 });

    // Level-complete confetti burst
    for (let i = 0; i < 5; ++i) {
      const cx = TILE_SIZE * (5 + Math.random() * (COLS - 10));
      const cy = TILE_SIZE * (3 + Math.random() * (ROWS - 6));
      particles.burst(cx, cy, 15, {
        color: ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0'][i],
        life: 1.2,
        speed: 60
      });
    }

    ++currentLevel;
    generateLevel(currentLevel);
    resetPlayerPosition();
    player.alive = true;
    updateTitle();
  }

  /* ── Game reset ── */
  function resetGame() {
    state = STATE_PLAYING;
    score = 0;
    lives = MAX_LIVES;
    currentLevel = 1;
    generateLevel(currentLevel);
    resetPlayerPosition();
    player.alive = true;
    particles.clear();
    floatingText.clear();
    updateTitle();
  }

  /* ── Update title ── */
  function updateTitle() {
    const title = state === STATE_DEAD
      ? `Boulder Dash - Game Over (Score: ${score})`
      : `Boulder Dash - Level ${currentLevel} - Score: ${score}`;
    if (User32?.SetWindowText) User32.SetWindowText(title);
  }

  /* ── Time management ── */
  function updateTimer(dt) {
    if (state !== STATE_PLAYING) return;
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      // Time expired — player dies
      playerDeath();
    }
  }

  /* ── Update loop ── */
  function update(dt) {
    if (state !== STATE_PLAYING) return;
    if (!player.alive) return;

    // Update player smooth movement
    if (player.moveProgress < 1) {
      player.moveProgress = Math.min(1, player.moveProgress + dt * MOVE_SPEED);
      if (player.moveProgress >= 1) {
        player.col = player.targetCol;
        player.row = player.targetRow;

        // Re-check enemy collision after move complete
        for (const enemy of enemies) {
          if (enemy.alive && enemy.col === player.col && enemy.row === player.row)
            playerDeath();
        }
      }
    }

    // Process queued movement
    if (player.moveProgress >= 1 && moveQueue) {
      tryMovePlayer(moveQueue.dx, moveQueue.dy);
      moveQueue = null;
    }

    // Handle held keys
    if (player.moveProgress >= 1) {
      for (const key in keysDown) {
        if (keysDown[key] && DIRS[key]) {
          tryMovePlayer(DIRS[key].dx, DIRS[key].dy);
          break;
        }
      }
    }

    updateBoulderPhysics(dt);
    updateEnemies(dt);
    updateTimer(dt);

    // Update fading cells
    for (let i = fadingCells.length - 1; i >= 0; --i) {
      fadingCells[i].alpha -= dt * FADE_SPEED;
      if (fadingCells[i].alpha <= 0)
        fadingCells.splice(i, 1);
    }

    particles.update(dt);
    screenShake.update(dt);
    floatingText.update(dt);
  }

  /* ── Rendering ── */
  const COLORS = {
    [EMPTY]: '#111',
    [WALL]: '#555',
    [DIRT]: '#8B4513',
    [BOULDER]: '#888',
    [GEM]: '#00e5ff',
    [EXIT]: '#ffd700'
  };

  function draw() {
    canvas.width = COLS * TILE_SIZE;
    canvas.height = ROWS * TILE_SIZE;

    ctx.save();
    screenShake.apply(ctx);

    // Draw grid
    for (let r = 0; r < ROWS; ++r) {
      for (let c = 0; c < COLS; ++c) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const cell = grid[r]?.[c];

        // Cave background with subtle per-cell depth variation
        const shade = 17 + ((r * 7 + c * 13) % 6) - 3;
        ctx.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Solid-fill tiles that fully cover the cell (wall, dirt)
        if (cell === WALL || cell === DIRT) {
          ctx.fillStyle = COLORS[cell];
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }

        if (cell === WALL) {
          ctx.save();
          // Brick/stone pattern
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 0.5;
          // Horizontal mortar lines
          ctx.beginPath();
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x + TILE_SIZE, y + 8);
          ctx.moveTo(x, y + 16);
          ctx.lineTo(x + TILE_SIZE, y + 16);
          ctx.stroke();
          // Vertical mortar lines (staggered per row)
          const offset = (r % 2) * (TILE_SIZE / 2);
          ctx.beginPath();
          ctx.moveTo(x + (TILE_SIZE / 2 + offset) % TILE_SIZE, y);
          ctx.lineTo(x + (TILE_SIZE / 2 + offset) % TILE_SIZE, y + 8);
          ctx.moveTo(x + offset % TILE_SIZE || TILE_SIZE, y + 8);
          ctx.lineTo(x + offset % TILE_SIZE || TILE_SIZE, y + 16);
          ctx.moveTo(x + (TILE_SIZE / 2 + offset) % TILE_SIZE, y + 16);
          ctx.lineTo(x + (TILE_SIZE / 2 + offset) % TILE_SIZE, y + TILE_SIZE);
          ctx.stroke();
          // Depth shading: lighter top edge, darker bottom edge
          ctx.strokeStyle = '#777';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 0.5);
          ctx.lineTo(x + TILE_SIZE, y + 0.5);
          ctx.stroke();
          ctx.strokeStyle = '#333';
          ctx.beginPath();
          ctx.moveTo(x, y + TILE_SIZE - 0.5);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE - 0.5);
          ctx.stroke();
          ctx.restore();
        } else if (cell === DIRT) {
          ctx.save();
          // Scattered darker clumps for texture variation
          const seed = (r * 17 + c * 31) % 7;
          ctx.fillStyle = '#6b3510';
          ctx.fillRect(x + 2 + seed, y + 3, 2, 2);
          ctx.fillRect(x + TILE_SIZE - 5 - (seed % 3), y + TILE_SIZE - 5, 2, 2);
          ctx.fillRect(x + 10 + (seed % 4), y + 8, 2, 2);
          ctx.fillStyle = '#5a2d0c';
          ctx.fillRect(x + 7, y + 14 + (seed % 3), 2, 2);
          ctx.fillRect(x + 16 - seed, y + 4, 2, 2);
          // Thin root-like lines
          ctx.strokeStyle = '#5a2d0c';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x + 4 + seed, y + 10);
          ctx.lineTo(x + 12 + (seed % 3), y + 14);
          ctx.moveTo(x + 14, y + 6 + seed);
          ctx.lineTo(x + 20, y + 10 + (seed % 4));
          ctx.stroke();
          // Darker edge on sides adjacent to empty cells
          ctx.strokeStyle = '#4a2008';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (c > 0 && grid[r][c - 1] === EMPTY) {
            ctx.moveTo(x + 0.5, y);
            ctx.lineTo(x + 0.5, y + TILE_SIZE);
          }
          if (c < COLS - 1 && grid[r][c + 1] === EMPTY) {
            ctx.moveTo(x + TILE_SIZE - 0.5, y);
            ctx.lineTo(x + TILE_SIZE - 0.5, y + TILE_SIZE);
          }
          if (r > 0 && grid[r - 1][c] === EMPTY) {
            ctx.moveTo(x, y + 0.5);
            ctx.lineTo(x + TILE_SIZE, y + 0.5);
          }
          if (r < ROWS - 1 && grid[r + 1][c] === EMPTY) {
            ctx.moveTo(x, y + TILE_SIZE - 0.5);
            ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE - 0.5);
          }
          ctx.stroke();
          ctx.restore();
        } else if (cell === BOULDER) {
          // 3D boulder look with smooth fall/slide offsets
          const key = r * COLS + c;
          let ox = 0, oy = 0;
          if (fallingBoulders.has(key)) {
            const fb = fallingBoulders.get(key);
            oy = -(1 - easeOut(fb.fallProgress)) * TILE_SIZE;
          }
          if (slidingBoulders.has(key)) {
            const sb = slidingBoulders.get(key);
            ox = (sb.fromCol - c) * TILE_SIZE * (1 - easeOut(sb.slideProgress));
          }
          ctx.save();
          const bcx = x + HALF_TILE + ox;
          const bcy = y + HALF_TILE + oy;
          const bRadius = HALF_TILE - 2;
          // Drop shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(bcx + 1, bcy + bRadius + 2, bRadius - 1, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          // Main boulder with radial gradient: #bbb top-left to #666 bottom-right
          const bGrad = ctx.createRadialGradient(bcx - 3, bcy - 3, 1, bcx, bcy, bRadius);
          bGrad.addColorStop(0, '#bbb');
          bGrad.addColorStop(1, '#666');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(bcx, bcy, bRadius, 0, Math.PI * 2);
          ctx.fill();
          // Surface cracks: 2-3 thin dark lines seeded per position
          const crackSeed = (r * 7 + c * 13) % 5;
          ctx.strokeStyle = 'rgba(40,30,20,0.5)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(bcx - 4 + crackSeed, bcy - 2);
          ctx.lineTo(bcx + 1, bcy + 3 + (crackSeed % 3));
          ctx.moveTo(bcx + 2, bcy - 5 + crackSeed);
          ctx.lineTo(bcx + 5 - (crackSeed % 2), bcy + 1);
          if (crackSeed > 2) {
            ctx.moveTo(bcx - 3, bcy + 2);
            ctx.lineTo(bcx + 2, bcy + 5);
          }
          ctx.stroke();
          ctx.restore();
        } else if (cell === GEM) {
          ctx.save();
          const gcx = x + HALF_TILE;
          const gcy = y + HALF_TILE;
          const gTop = y + 3;
          const gBot = y + TILE_SIZE - 3;
          const gLft = x + 3;
          const gRgt = x + TILE_SIZE - 3;
          // Glow
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00e5ff';
          // Rainbow refraction: each facet triangle gets a slightly different hue
          const facetColors = ['#00e5ff', '#40ffb0', '#a080ff', '#ff80d0'];
          // Top facet
          ctx.fillStyle = facetColors[0];
          ctx.beginPath();
          ctx.moveTo(gcx, gTop);
          ctx.lineTo(gRgt, gcy);
          ctx.lineTo(gcx, gcy);
          ctx.closePath();
          ctx.fill();
          // Right facet
          ctx.fillStyle = facetColors[1];
          ctx.beginPath();
          ctx.moveTo(gRgt, gcy);
          ctx.lineTo(gcx, gBot);
          ctx.lineTo(gcx, gcy);
          ctx.closePath();
          ctx.fill();
          // Bottom facet
          ctx.fillStyle = facetColors[2];
          ctx.beginPath();
          ctx.moveTo(gcx, gBot);
          ctx.lineTo(gLft, gcy);
          ctx.lineTo(gcx, gcy);
          ctx.closePath();
          ctx.fill();
          // Left facet
          ctx.fillStyle = facetColors[3];
          ctx.beginPath();
          ctx.moveTo(gLft, gcy);
          ctx.lineTo(gcx, gTop);
          ctx.lineTo(gcx, gcy);
          ctx.closePath();
          ctx.fill();
          // Internal facet lines from center to each vertex midpoint
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(gcx, gcy);
          ctx.lineTo((gcx + gRgt) / 2, (gTop + gcy) / 2);
          ctx.moveTo(gcx, gcy);
          ctx.lineTo((gcx + gRgt) / 2, (gBot + gcy) / 2);
          ctx.moveTo(gcx, gcy);
          ctx.lineTo((gcx + gLft) / 2, (gBot + gcy) / 2);
          ctx.moveTo(gcx, gcy);
          ctx.lineTo((gcx + gLft) / 2, (gTop + gcy) / 2);
          ctx.stroke();
          // Sparkle animation: rotating highlight dot orbiting the gem
          const sparkAngle = Date.now() * 0.003 + (r * 5 + c * 11);
          const sparkR = 7;
          const sparkX = gcx + Math.cos(sparkAngle) * sparkR;
          const sparkY = gcy + Math.sin(sparkAngle) * sparkR;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (cell === EXIT) {
          ctx.save();
          if (exitOpen) {
            // Pulsing glow animation
            const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
            ctx.shadowBlur = 10 + pulse * 15;
            ctx.shadowColor = '#ffd700';
            ctx.fillStyle = '#ffd700';
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#555';
          }
          ctx.fillRect(x + 4, y + 2, TILE_SIZE - 8, TILE_SIZE - 4);
          ctx.fillStyle = '#333';
          ctx.fillRect(x + TILE_SIZE - 10, y + HALF_TILE - 2, 3, 4);
          // Sparkle particles around open exit
          if (exitOpen) {
            ctx.shadowBlur = 0;
            const now = Date.now();
            for (let s = 0; s < 4; ++s) {
              const angle = now * 0.002 + s * (Math.PI / 2);
              const dist = 10 + Math.sin(now * 0.004 + s) * 3;
              const sx = x + HALF_TILE + Math.cos(angle) * dist;
              const sy = y + HALF_TILE + Math.sin(angle) * dist;
              const alpha = 0.5 + Math.sin(now * 0.006 + s * 2) * 0.4;
              ctx.fillStyle = `rgba(255,215,0,${alpha})`;
              ctx.beginPath();
              ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
    }

    // Draw fading cells (dirt dig / gem collect animations)
    for (const fc of fadingCells) {
      const fx = fc.col * TILE_SIZE;
      const fy = fc.row * TILE_SIZE;
      ctx.save();
      ctx.globalAlpha = fc.alpha;
      if (fc.type === DIRT) {
        const s = fc.alpha;
        const cx = fx + TILE_SIZE / 2;
        const cy = fy + TILE_SIZE / 2;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(cx - TILE_SIZE * s / 2, cy - TILE_SIZE * s / 2, TILE_SIZE * s, TILE_SIZE * s);
      } else if (fc.type === GEM) {
        const s = 1 + (1 - fc.alpha) * 0.5;
        const cx = fx + TILE_SIZE / 2;
        const cy = fy + TILE_SIZE / 2;
        const half = (TILE_SIZE / 2 - 3) * s;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw enemies
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const ex = lerp(enemy.col, enemy.targetCol, easeOut(enemy.moveProgress)) * TILE_SIZE;
      const ey = lerp(enemy.row, enemy.targetRow, easeOut(enemy.moveProgress)) * TILE_SIZE;
      ctx.save();
      const ecx = ex + HALF_TILE;
      const ecy = ey + HALF_TILE;
      // Body wobble animation
      const wobble = Math.sin(Date.now() * 0.008) * 1.5;
      // Legs: 2 tiny arcs at the bottom
      ctx.fillStyle = '#cc2222';
      ctx.beginPath();
      ctx.arc(ecx - 4, ecy + 8, 3, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ecx + 4, ecy + 8, 3, 0, Math.PI);
      ctx.fill();
      // Main body (slightly wobbling)
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(ecx + wobble * 0.3, ecy, HALF_TILE - 3, 0, Math.PI * 2);
      ctx.fill();
      // Antennae: 2 short lines with dots on top of head
      ctx.strokeStyle = '#ff6666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ecx - 3 + wobble * 0.2, ecy - 8);
      ctx.lineTo(ecx - 6 + wobble * 0.5, ecy - 13);
      ctx.moveTo(ecx + 3 + wobble * 0.2, ecy - 8);
      ctx.lineTo(ecx + 6 + wobble * 0.5, ecy - 13);
      ctx.stroke();
      // Antenna tips
      ctx.fillStyle = '#ffaaaa';
      ctx.beginPath();
      ctx.arc(ecx - 6 + wobble * 0.5, ecy - 13, 1.5, 0, Math.PI * 2);
      ctx.arc(ecx + 6 + wobble * 0.5, ecy - 13, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ecx - 4, ecy - 2, 3.5, 0, Math.PI * 2);
      ctx.arc(ecx + 4, ecy - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(ecx - 3, ecy - 2, 1.8, 0, Math.PI * 2);
      ctx.arc(ecx + 5, ecy - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw player
    if (player.alive) {
      const px = lerp(player.col, player.targetCol, easeOut(player.moveProgress)) * TILE_SIZE;
      const py = lerp(player.row, player.targetRow, easeOut(player.moveProgress)) * TILE_SIZE;
      ctx.save();
      const pcx = px + HALF_TILE;
      const pcy = py + HALF_TILE;
      // Slightly oval body shape
      ctx.fillStyle = '#4ec0ca';
      ctx.beginPath();
      ctx.ellipse(pcx, pcy + 1, HALF_TILE - 2, HALF_TILE - 1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hardhat: colored arc on top of head
      ctx.fillStyle = '#f0c020';
      ctx.beginPath();
      ctx.ellipse(pcx, pcy - 4, 9, 5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Hardhat brim
      ctx.strokeStyle = '#d4a010';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pcx - 10, pcy - 4);
      ctx.lineTo(pcx + 10, pcy - 4);
      ctx.stroke();
      // Eyes: slightly larger whites, more defined pupils
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pcx - 4, pcy - 1, 3.5, 0, Math.PI * 2);
      ctx.arc(pcx + 4, pcy - 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(pcx - 3, pcy - 1, 2, 0, Math.PI * 2);
      ctx.arc(pcx + 5, pcy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
      // Pupil highlights
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pcx - 3.5, pcy - 2, 0.7, 0, Math.PI * 2);
      ctx.arc(pcx + 4.5, pcy - 2, 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Small pickaxe held to the right
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pcx + 8, pcy + 2);
      ctx.lineTo(pcx + 14, pcy - 6);
      ctx.stroke();
      // Pickaxe head
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pcx + 12, pcy - 7);
      ctx.lineTo(pcx + 16, pcy - 5);
      ctx.stroke();
      ctx.restore();
    }

    // Draw effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    ctx.restore();

    // HUD overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, 22);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`Level: ${currentLevel}  Score: ${score}  Gems: ${gemsCollected}/${gemsRequired}  Time: ${Math.ceil(timeLeft)}  Lives: ${lives}`, 6, 15);

    // Status bar
    if (elScore) elScore.textContent = 'Score: ' + score;
    if (elLevel) elLevel.textContent = 'Level: ' + currentLevel;
    if (elLives) elLives.textContent = 'Lives: ' + lives;
    if (elGems) elGems.textContent = 'Gems: ' + gemsCollected + '/' + gemsRequired;
    if (elTime) elTime.textContent = 'Time: ' + Math.ceil(timeLeft);
    if (elState) elState.textContent = state === STATE_PAUSED ? 'Paused' : state === STATE_DEAD ? 'Game Over' : 'Playing';

    // Overlay text
    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    } else if (state === STATE_DEAD) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Score: ' + score + '  |  Tap or press F2 for New Game', canvas.width / 2, canvas.height / 2 + 20);
      ctx.textAlign = 'start';
    } else if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BOULDER DASH', canvas.width / 2, canvas.height / 2 - 15);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press F2 or click New Game to start', canvas.width / 2, canvas.height / 2 + 15);
      ctx.textAlign = 'start';
    }

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = w / 2, pw = 380, ph = 200, px = cx - pw / 2, py = (h - ph) / 2;
    ctx.fillStyle = 'rgba(20,15,10,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#ffd700';
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
    ctx.textAlign = 'start';
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  function easeOut(t) {
    const c = Math.min(1, Math.max(0, t));
    return c * (2 - c);
  }

  function tileX(c) { return c * TILE_SIZE + HALF_TILE; }
  function tileY(r) { return r * TILE_SIZE + HALF_TILE; }

  /* ── Game loop ── */
  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT);
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ── Input ── */
  document.addEventListener('keydown', (e) => {
    keysDown[e.key] = true;

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
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    if (DIRS[e.key]) {
      e.preventDefault();
      if (state === STATE_PLAYING && player.alive) {
        if (player.moveProgress >= 1)
          tryMovePlayer(DIRS[e.key].dx, DIRS[e.key].dy);
        else
          moveQueue = DIRS[e.key];
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    keysDown[e.key] = false;
  });

  /* ── Click/Tap to start ── */
  canvas.addEventListener('pointerdown', () => {
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_DEAD)
      resetGame();
  });

  /* ── Menu bar ── */
  const menuActions = {
    'new': () => resetGame(),
    'pause': () => {
      if (state === STATE_PLAYING) state = STATE_PAUSED;
      else if (state === STATE_PAUSED) state = STATE_PLAYING;
    },
    'high-scores': () => {
      renderHighScores();
      SZ.Dialog.show('highScoresBackdrop');
    },
    'exit': () => { if (User32?.DestroyWindow) User32.DestroyWindow(); },
    'controls': () => SZ.Dialog.show('controlsBackdrop'),
    'tutorial': () => { showTutorial = true; tutorialPage = 0; },
    'about': () => SZ.Dialog.show('dlg-about')
  };

  new SZ.MenuBar({ onAction: (action) => menuActions[action]?.() });

  /* ── Dialog wiring ── */
  SZ.Dialog.wireAll();

  const highScoresDialog = document.getElementById('highScoresBackdrop');
  if (highScoresDialog) {
    highScoresDialog.addEventListener('dialog:result', (e) => {
      if (e.detail === 'reset') {
        highScores = [];
        saveHighScores();
        renderHighScores();
      }
    });
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = '';
    for (let i = 0; i < MAX_HIGH_SCORES; ++i) {
      const hs = highScores[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${hs ? hs.score : '---'}</td><td>${hs ? hs.level : '-'}</td>`;
      body.appendChild(tr);
    }
  }

  /* ── OS integration ── */
  function handleResize() {
    // Canvas size is fixed to grid; CSS scales it
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg, wParam, lParam) => {
      if (msg === 'WM_THEMECHANGED') {
        // Theme changed — no action needed for canvas game
      }
      if (msg === 'WM_SIZE')
        handleResize();
    });
  }

  /* ── Init ── */
  loadHighScores();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  generateLevel(currentLevel);
  updateTitle();
  handleResize();
  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }
  requestAnimationFrame(gameLoop);

})();
