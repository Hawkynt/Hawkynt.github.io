/* The AI enemy snakes: spawning on empty cells, BFS pathfinding toward the food,
   movement with wall and collision handling, and the kill/respawn cycle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const { particles, floatingText, sfx } = NS.effects;
  const { randomInt, cellKey, cellBlockedForSpawn, wrapCoord, isTron, isOpposite, spawnFood } = NS.rules;

  /* ---- AI Snakes ---- */
  function initAISnakes() {
    S.aiSnakes = [];
    for (let i = 0; i < S.gameConfig.enemies; ++i) {
      const pos = findEmptySpawn();
      S.aiSnakes.push({
        body: [pos, { x: pos.x, y: pos.y }, { x: pos.x, y: pos.y }],
        prevBody: null,
        dir: C.ALL_DIRS[randomInt(4)],
        alive: true,
        respawnTime: 0,
        colorIdx: i
      });
    }
  }

  function findEmptySpawn() {
    for (let attempt = 0; attempt < 200; ++attempt) {
      const x = 3 + randomInt(Math.max(1, S.cols - 6));
      const y = 3 + randomInt(Math.max(1, S.rows - 6));
      let ok = true;
      for (let dx = -2; dx <= 0 && ok; ++dx)
        if (cellBlockedForSpawn(x + dx, y))
          ok = false;
      if (ok)
        return { x, y };
    }
    for (let x = 0; x < S.cols; ++x)
      for (let y = 0; y < S.rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          return { x, y };
    return { x: 0, y: 0 };
  }

  function moveAISnakes(timestamp) {
    for (const ai of S.aiSnakes) {
      if (!ai.alive) {
        if (timestamp >= ai.respawnTime) {
          const pos = findEmptySpawn();
          ai.body = [pos, { x: pos.x, y: pos.y }, { x: pos.x, y: pos.y }];
          ai.prevBody = null;
          ai.dir = C.ALL_DIRS[randomInt(4)];
          ai.alive = true;
        }
        continue;
      }

      ai.prevBody = ai.body.map(s => ({ x: s.x, y: s.y }));
      const nextDir = bfsDirection(ai);
      if (nextDir)
        ai.dir = nextDir;

      const head = ai.body[0];
      let nx = head.x + ai.dir.x, ny = head.y + ai.dir.y;

      if (S.gameConfig.walls === 'wrap') {
        nx = wrapCoord(nx, S.cols);
        ny = wrapCoord(ny, S.rows);
      } else if (nx < 0 || nx >= S.cols || ny < 0 || ny >= S.rows) {
        ai.body.unshift({ x: Math.max(0, Math.min(S.cols - 1, nx)), y: Math.max(0, Math.min(S.rows - 1, ny)) });
        killAI(ai, timestamp);
        continue;
      }

      if (S.obstacles.has(cellKey(nx, ny)) || snakeAt(nx, ny) || aiCollides(ai, nx, ny)) {
        ai.body.unshift({ x: nx, y: ny });
        killAI(ai, timestamp);
        continue;
      }

      ai.body.unshift({ x: nx, y: ny });

      if (S.food && nx === S.food.x && ny === S.food.y)
        spawnFood();
      else if (!isTron())
        ai.body.pop();
    }
  }

  function snakeAt(x, y) {
    for (const seg of S.snake)
      if (seg.x === x && seg.y === y)
        return true;
    return false;
  }

  function aiCollides(self, x, y) {
    for (let i = 0; i < self.body.length; ++i)
      if (self.body[i].x === x && self.body[i].y === y)
        return true;
    for (const ai of S.aiSnakes)
      if (ai !== self && ai.alive)
        for (const seg of ai.body)
          if (seg.x === x && seg.y === y)
            return true;
    return false;
  }

  function killAI(ai, timestamp) {
    ai.alive = false;
    ai.respawnTime = timestamp + C.AI_RESPAWN_DELAY;

    if (ai.body.length > 0) {
      const h = ai.body[0];
      const deathColor = isTron() ? (C.TRON_COLORS.ai[ai.colorIdx] || C.TRON_COLORS.ai[0]) : C.AI_COLORS[ai.colorIdx].head;
      particles.burst(h.x * C.CELL + C.CELL / 2, h.y * C.CELL + C.CELL / 2, 15, {
        speed: 4, color: deathColor, life: 0.8, size: 3, gravity: 0.08
      });
    }

    sfx.play('smallExplode');
    S.score += C.AI_KILL_BONUS;
    if (S.snake.length > 0) {
      const h = S.snake[0];
      floatingText.add(h.x * C.CELL + C.CELL / 2, h.y * C.CELL + C.CELL / 2 - 10, '+' + C.AI_KILL_BONUS, {
        color: '#ff0', font: 'bold 12px sans-serif', decay: 0.02, vy: -1.5
      });
    }
    NS.board.updateDisplays();
  }

  function bfsDirection(ai) {
    if (!S.food)
      return null;

    const head = ai.body[0];
    const blocked = new Set(S.obstacles);
    for (const seg of S.snake)
      blocked.add(cellKey(seg.x, seg.y));
    for (const other of S.aiSnakes)
      if (other.alive)
        for (let i = (other === ai ? 1 : 0); i < other.body.length; ++i)
          blocked.add(cellKey(other.body[i].x, other.body[i].y));

    const visited = new Set();
    const queue = [{ x: head.x, y: head.y, firstDir: null }];
    visited.add(cellKey(head.x, head.y));

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.x === S.food.x && cur.y === S.food.y)
        return cur.firstDir;

      for (const d of C.ALL_DIRS) {
        let nx = cur.x + d.x, ny = cur.y + d.y;
        if (S.gameConfig.walls === 'wrap') {
          nx = wrapCoord(nx, S.cols);
          ny = wrapCoord(ny, S.rows);
        } else if (nx < 0 || nx >= S.cols || ny < 0 || ny >= S.rows)
          continue;

        const key = cellKey(nx, ny);
        if (!visited.has(key) && !blocked.has(key)) {
          visited.add(key);
          queue.push({ x: nx, y: ny, firstDir: cur.firstDir || d });
        }
      }
    }

    const shuffled = C.ALL_DIRS.slice().sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      let nx = head.x + d.x, ny = head.y + d.y;
      if (S.gameConfig.walls === 'wrap') {
        nx = wrapCoord(nx, S.cols);
        ny = wrapCoord(ny, S.rows);
      } else if (nx < 0 || nx >= S.cols || ny < 0 || ny >= S.rows)
        continue;
      if (!blocked.has(cellKey(nx, ny)) && !isOpposite(d, ai.dir))
        return d;
    }
    return ai.dir;
  }

  Object.assign(NS.ai, { initAISnakes, findEmptySpawn, moveAISnakes, snakeAt, aiCollides, killAI, bfsDirection });
})();
