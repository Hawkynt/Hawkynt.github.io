/* Obstacle generation: random blocks, the symmetric maze corridors and the growing
   wall that appears while eating. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const { particles, sfx } = NS.effects;
  const { cellKey, randomInt, cellBlocked } = NS.rules;

  /* ---- Obstacles ---- */
  function generateObstacles() {
    S.obstacles = new Set();
    if (S.gameConfig.obstacles === 'none' || S.gameConfig.obstacles === 'growing')
      return;

    const cx = Math.floor(S.cols / 2), cy = Math.floor(S.rows / 2);
    const safe = new Set();
    for (let dx = -3; dx <= 3; ++dx)
      for (let dy = -2; dy <= 2; ++dy)
        safe.add(cellKey(cx + dx, cy + dy));

    if (S.gameConfig.obstacles === 'random') {
      const count = Math.floor(S.cols * S.rows * 0.04) + 5;
      let placed = 0;
      while (placed < count) {
        const x = randomInt(S.cols), y = randomInt(S.rows);
        const key = cellKey(x, y);
        if (!safe.has(key) && !S.obstacles.has(key)) {
          S.obstacles.add(key);
          ++placed;
        }
      }
    } else if (S.gameConfig.obstacles === 'maze')
      generateMaze(safe);
  }

  function generateMaze(safe) {
    function addWall(x, y) {
      if (x < 0 || x >= S.cols || y < 0 || y >= S.rows)
        return;
      const key = cellKey(x, y);
      if (!safe.has(key))
        S.obstacles.add(key);
    }

    function addSym(x, y) {
      addWall(x, y);
      addWall(S.cols - 1 - x, y);
      addWall(x, S.rows - 1 - y);
      addWall(S.cols - 1 - x, S.rows - 1 - y);
    }

    const barLen = Math.max(2, Math.floor(S.cols * 0.2));
    const off1 = Math.floor(S.rows * 0.25);
    const off2 = Math.floor(S.cols * 0.25);
    for (let i = 0; i < barLen; ++i) {
      addSym(2 + i, off1);
      addSym(off2, 2 + i);
    }

    const innerLen = Math.max(1, Math.floor(S.cols * 0.12));
    const innerOff = Math.floor(S.cols * 0.35);
    for (let i = 0; i < innerLen; ++i)
      addSym(innerOff, off1 + 2 + i);

    addSym(2, 2);
    addSym(3, 2);
    addSym(2, 3);
  }

  function addGrowingWall() {
    let attempts = 0;
    while (attempts < 100) {
      const x = randomInt(S.cols), y = randomInt(S.rows);
      const key = cellKey(x, y);
      if (!S.obstacles.has(key) && !cellBlocked(x, y) &&
          !(S.food && S.food.x === x && S.food.y === y)) {
        S.obstacles.add(key);
        particles.burst(x * C.CELL + C.CELL / 2, y * C.CELL + C.CELL / 2, 5, {
          speed: 2, color: '#666', life: 0.5, size: 2
        });
        sfx.play('thud', { volume: 0.6 });
        return;
      }
      ++attempts;
    }
  }

  Object.assign(NS.obstacles, { generateObstacles, generateMaze, addGrowingWall });
})();
