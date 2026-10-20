/* The game run: snake movement and collision handling, eating and leveling, death,
   pause (also from the window losing focus) and the new-game reset. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { particles, floatingText, sfx } = NS.effects;
  const { isOpposite, wrapCoord, cellKey, hasActiveEffect, isTron, isZen, isMaze, spawnFood, getPointsForFood, randomInt } = NS.rules;
  const { generateObstacles, addGrowingWall } = NS.obstacles;
  const { initAISnakes } = NS.ai;
  const { useShield, collectPowerup } = NS.powerups;
  const { initZenLeaves, buildMazeBrickCanvas } = NS.themes;
  const { updateDisplays } = NS.board;

  /* ---- Game Logic ---- */
  function moveSnake(timestamp) {
    S.prevSnake = S.snake.map(s => ({ x: s.x, y: s.y }));

    if (S.inputQueue.length > 0) {
      const next = S.inputQueue.shift();
      if (!isOpposite(next, S.direction))
        S.nextDirection = next;
    }
    S.direction = S.nextDirection;
    const head = S.snake[0];
    let nx = head.x + S.direction.x;
    let ny = head.y + S.direction.y;

    if (S.gameConfig.walls === 'wrap') {
      nx = wrapCoord(nx, S.cols);
      ny = wrapCoord(ny, S.rows);
    } else if (nx < 0 || nx >= S.cols || ny < 0 || ny >= S.rows) {
      if (useShield())
        return;
      S.snake.unshift({ x: Math.max(0, Math.min(S.cols - 1, nx)), y: Math.max(0, Math.min(S.rows - 1, ny)) });
      doDeath();
      return;
    }

    if (S.obstacles.has(cellKey(nx, ny))) {
      if (useShield())
        return;
      S.snake.unshift({ x: nx, y: ny });
      doDeath();
      return;
    }

    if (!hasActiveEffect('ghost'))
      for (let i = 0; i < S.snake.length; ++i)
        if (S.snake[i].x === nx && S.snake[i].y === ny) {
          if (useShield())
            return;
          S.snake.unshift({ x: nx, y: ny });
          doDeath();
          return;
        }

    for (const ai of S.aiSnakes)
      if (ai.alive)
        for (const seg of ai.body)
          if (seg.x === nx && seg.y === ny) {
            if (useShield())
              return;
            S.snake.unshift({ x: nx, y: ny });
            doDeath();
            return;
          }

    const newHead = { x: nx, y: ny };
    S.snake.unshift(newHead);

    if (S.food && nx === S.food.x && ny === S.food.y)
      eatFood(nx, ny);
    else if (!isTron()) {
      const tail = S.snake.pop();
      const trailColor = isMaze() ? 'rgba(255,109,0,0.4)' : 'rgba(76,175,80,0.4)';
      particles.trail(tail.x * C.CELL + C.CELL / 2, tail.y * C.CELL + C.CELL / 2, {
        color: trailColor, life: 0.3, decay: 0.04, size: 2, shrink: 0.9
      });
    }

    collectPowerup(timestamp);
  }

  function eatFood(fx, fy) {
    const pts = getPointsForFood();
    S.score += pts;
    ++S.foodsEaten;

    const cx = fx * C.CELL + C.CELL / 2, cy = fy * C.CELL + C.CELL / 2;
    particles.burst(cx, cy, 15, {
      speed: 5, color: '#ff0', life: 0.8, size: 3, gravity: 0.05, shrink: 0.96
    });

    const colors = ['#f44', '#ff0', '#4f4', '#4ff', '#f4f', '#fa0'];
    for (let i = 0; i < 8; ++i)
      particles.burst(cx, cy, 1, {
        speed: 3 + Math.random() * 3,
        color: colors[randomInt(colors.length)],
        life: 0.6 + Math.random() * 0.4,
        size: 2 + Math.random() * 2,
        gravity: 0.08
      });

    floatingText.add(cx, cy, '+' + pts, {
      color: '#ff0', font: 'bold 14px sans-serif', decay: 0.02, vy: -1.5
    });
    sfx.play(isMaze() ? 'coin' : 'pickup', { pitch: 1 + ((S.foodsEaten - 1) % C.FOODS_PER_LEVEL) * 0.06 });

    if (S.gameConfig.obstacles === 'growing' && S.foodsEaten % 3 === 0)
      addGrowingWall();

    if (S.foodsEaten % C.FOODS_PER_LEVEL === 0) {
      ++S.level;
      sfx.play('levelup');
      floatingText.add(S.canvasW / 2, S.canvasH / 2, 'LEVEL ' + S.level + '!', {
        color: '#fff', font: 'bold 20px sans-serif', decay: 0.015, vy: -1
      });
    }

    updateDisplays();
    spawnFood();
  }

  function doDeath() {
    S.gameActive = false;
    S.gameOverFlag = true;

    const tron = isTron();
    const maze = isMaze();
    const head = S.snake[0];
    const cx = head.x * C.CELL + C.CELL / 2, cy = head.y * C.CELL + C.CELL / 2;

    let headColor, bodyColor;
    if (tron) {
      headColor = C.TRON_COLORS.player;
      bodyColor = C.TRON_COLORS.player;
    } else if (maze) {
      headColor = '#ff6d00';
      bodyColor = '#e65100';
    } else {
      headColor = '#f44';
      bodyColor = '#4caf50';
    }

    particles.burst(cx, cy, 30, {
      speed: 6, color: headColor, life: 1, size: 4, gravity: 0.1, shrink: 0.97
    });

    for (let i = 1; i < S.snake.length; i += 2) {
      const seg = S.snake[i];
      particles.burst(seg.x * C.CELL + C.CELL / 2, seg.y * C.CELL + C.CELL / 2, 3, {
        speed: 3, color: bodyColor, life: 0.6, size: 2, gravity: 0.05
      });
    }

    NS.effects.screenShake.trigger(8, 400);
    sfx.play('hurt');
    sfx.play('lose', { volume: 0.8 });
    NS.highscores.checkHighScore();
  }

  /* ---- Pause ---- */
  function togglePause() {
    if (!S.gameActive || S.gameOverFlag || S.waitingToStart)
      return;
    S.gamePaused = !S.gamePaused;
    if (!S.gamePaused)
      S.lastMoveTime = performance.now();
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.gameActive && !S.gamePaused && !S.gameOverFlag && !S.waitingToStart,
    pause: togglePause
  });

  /* ---- New Game ---- */
  function newGame() {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }

    particles.clear();
    floatingText.clear();
    D.setupCanvas();

    S.obstacles = new Set();
    S.aiSnakes = [];
    S.activePowerups = [];
    S.fieldPowerup = null;
    S.lastPowerupTime = performance.now();

    generateObstacles();

    const startX = Math.floor(S.cols / 2);
    const startY = Math.floor(S.rows / 2);
    S.snake = [];
    for (let i = 0; i < C.INITIAL_LENGTH; ++i)
      S.snake.push({ x: startX - i, y: startY });

    S.direction = C.DIR.RIGHT;
    S.nextDirection = C.DIR.RIGHT;
    S.inputQueue = [];
    S.prevSnake = null;
    S.lerpT = 1;
    S.score = 0;
    S.level = 1;
    S.foodsEaten = 0;
    S.gameActive = true;
    S.gamePaused = false;
    S.gameOverFlag = false;
    S.waitingToStart = false;
    S.pausedForDialog = false;
    S.lastMoveTime = performance.now();
    S.lastTimestamp = 0;

    if (isZen())
      initZenLeaves();
    else
      S.zenLeaves = null;

    if (isMaze())
      buildMazeBrickCanvas();
    else
      S.mazeBrickCanvas = null;

    spawnFood();
    initAISnakes();
    updateDisplays();

    if (D.statusEffects)
      D.statusEffects.style.display = 'none';

    sfx.play('select');
    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* the loop lives in app.js; newGame starts it through the namespace */
  function gameLoop(timestamp) {
    NS.app.gameLoop(timestamp);
  }

  Object.assign(NS.game, { moveSnake, eatFood, doDeath, togglePause, newGame });
})();
