/* The pure game rules: interval and scoring math, coordinate and direction helpers,
   occupancy tests, theme predicates, food spawning and the interpolation math. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;

  /* ---- Helpers ---- */
  function getMoveInterval() {
    const spd = C.SPEED_PRESETS[S.gameConfig.speed] || C.SPEED_PRESETS.normal;
    let interval = Math.max(spd.min, spd.base - (S.level - 1) * C.INTERVAL_STEP);
    if (hasActiveEffect('speed'))
      interval = Math.round(interval * 0.6);
    else if (hasActiveEffect('slow'))
      interval = Math.round(interval * 1.4);
    return interval;
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function cellKey(x, y) {
    return x + ',' + y;
  }

  function isOpposite(d1, d2) {
    return d1.x + d2.x === 0 && d1.y + d2.y === 0;
  }

  function wrapCoord(val, max) {
    return val < 0 ? max - 1 : val >= max ? 0 : val;
  }

  function hasActiveEffect(id) {
    return S.activePowerups.some(p => p.type.id === id);
  }

  function cellBlocked(x, y) {
    if (S.obstacles.has(cellKey(x, y)))
      return true;
    for (const seg of S.snake)
      if (seg.x === x && seg.y === y)
        return true;
    for (const ai of S.aiSnakes)
      if (ai.alive)
        for (const seg of ai.body)
          if (seg.x === x && seg.y === y)
            return true;
    return false;
  }

  function cellBlockedForSpawn(x, y) {
    return cellBlocked(x, y) ||
      (S.food && S.food.x === x && S.food.y === y) ||
      (S.fieldPowerup && S.fieldPowerup.x === x && S.fieldPowerup.y === y);
  }

  function isTron() {
    return (S.gameConfig.visualTheme || null) === 'tron';
  }

  function isZen() {
    return (S.gameConfig.visualTheme || null) === 'zen';
  }

  function isMaze() {
    return (S.gameConfig.visualTheme || null) === 'maze';
  }

  function spawnFood() {
    const empty = [];
    for (let x = 0; x < S.cols; ++x)
      for (let y = 0; y < S.rows; ++y)
        if (!cellBlockedForSpawn(x, y))
          empty.push({ x, y });
    if (empty.length === 0)
      return;

    if (hasActiveEffect('magnet') && S.snake.length > 0) {
      const head = S.snake[0];
      const adjacent = [];
      for (const d of C.ALL_DIRS) {
        let nx = head.x + d.x, ny = head.y + d.y;
        if (S.gameConfig.walls === 'wrap') {
          nx = wrapCoord(nx, S.cols);
          ny = wrapCoord(ny, S.rows);
        }
        if (nx >= 0 && nx < S.cols && ny >= 0 && ny < S.rows && !cellBlockedForSpawn(nx, ny))
          adjacent.push({ x: nx, y: ny });
      }
      if (adjacent.length > 0) {
        S.food = adjacent[randomInt(adjacent.length)];
        return;
      }
    }

    S.food = empty[randomInt(empty.length)];
  }

  function getPointsForFood() {
    return C.FOOD_SCORE_BASE * S.level;
  }

  function lerpPos(cur, prev, t) {
    if (!prev)
      return { x: cur.x * C.CELL + C.CELL / 2, y: cur.y * C.CELL + C.CELL / 2 };

    let px = prev.x, py = prev.y;
    if (Math.abs(cur.x - px) > S.cols / 2)
      px = cur.x;
    if (Math.abs(cur.y - py) > S.rows / 2)
      py = cur.y;

    const pxPx = px * C.CELL + C.CELL / 2, pyPx = py * C.CELL + C.CELL / 2;
    const nxPx = cur.x * C.CELL + C.CELL / 2, nyPx = cur.y * C.CELL + C.CELL / 2;
    return { x: pxPx + (nxPx - pxPx) * t, y: pyPx + (nyPx - pyPx) * t };
  }

  function isBlinking(timestamp) {
    const cycle = timestamp % 3500;
    return cycle > 3350;
  }

  function dirAngle(d) {
    if (d === C.DIR.UP)    return 0;
    if (d === C.DIR.RIGHT) return Math.PI / 2;
    if (d === C.DIR.DOWN)  return Math.PI;
    return -Math.PI / 2;
  }

  Object.assign(NS.rules, { getMoveInterval, randomInt, cellKey, isOpposite, wrapCoord, hasActiveEffect,
    cellBlocked, cellBlockedForSpawn, isTron, isZen, isMaze, spawnFood, getPointsForFood,
    lerpPos, isBlinking, dirAngle });
})();
