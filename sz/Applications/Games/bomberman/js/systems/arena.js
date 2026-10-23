/* The arena: level layout generation, the hidden power-up placement, the grass
   detail seed, the walkability rules per actor and the enemy spawning. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const A = NS.arena = NS.arena || {};

  A.generateGrassDetails = function generateGrassDetails() {
    S.grassSeed = [];
    for (let i = 0; i < C.ROWS * C.COLS; ++i)
      S.grassSeed[i] = Array.from({ length: 3 }, () => ({
        x: Math.random() * C.TILE_SIZE,
        y: Math.random() * C.TILE_SIZE,
        s: 0.5 + Math.random()
      }));
  };

  /* ── Grid Generation ── */
  A.generateArena = function generateArena(level) {
    S.grid = [];
    for (let r = 0; r < C.ROWS; ++r) {
      S.grid[r] = [];
      for (let c = 0; c < C.COLS; ++c) {
        // Border walls
        if (r === 0 || r === C.ROWS - 1 || c === 0 || c === C.COLS - 1)
          S.grid[r][c] = C.WALL;
        // Indestructible pillars at even row & col (alternating pattern using % 2)
        else if (r % 2 === 0 && c % 2 === 0)
          S.grid[r][c] = C.WALL;
        else
          S.grid[r][c] = C.EMPTY;
      }
    }

    // Place destructible walls with density increasing per level
    const density = Math.min(0.3 + level * 0.05, 0.7);
    for (let r = 1; r < C.ROWS - 1; ++r) {
      for (let c = 1; c < C.COLS - 1; ++c) {
        if (S.grid[r][c] !== C.EMPTY)
          continue;
        // Keep player spawn area clear (top-left)
        if (r <= 2 && c <= 2)
          continue;
        if (Math.random() < density)
          S.grid[r][c] = C.DESTRUCTIBLE;
      }
    }

    // Place hidden power-ups under some destructible walls
    S.hiddenPowerUps = {};
    const destructibles = [];
    for (let r = 1; r < C.ROWS - 1; ++r)
      for (let c = 1; c < C.COLS - 1; ++c)
        if (S.grid[r][c] === C.DESTRUCTIBLE)
          destructibles.push(r + ',' + c);

    const numPowerUps = Math.min(4 + level, destructibles.length);
    for (let i = 0; i < numPowerUps && destructibles.length > 0; ++i) {
      const idx = Math.floor(Math.random() * destructibles.length);
      const key = destructibles.splice(idx, 1)[0];
      S.hiddenPowerUps[key] = T.randomPowerUpType();
    }
    A.generateGrassDetails();
  };

  /* ── isWalkable ── */
  A.isWalkable = function isWalkable(col, row) {
    if (col < 0 || col >= C.COLS || row < 0 || row >= C.ROWS)
      return false;
    const cell = S.grid[row][col];
    return cell === C.EMPTY;
  };

  /* ── isPlayerWalkable (climb lets player walk over destructible walls) ── */
  A.isPlayerWalkable = function isPlayerWalkable(col, row) {
    if (col < 0 || col >= C.COLS || row < 0 || row >= C.ROWS)
      return false;
    const cell = S.grid[row][col];
    if (cell === C.EMPTY)
      return true;
    if (S.hasClimb && cell === C.DESTRUCTIBLE)
      return true;
    return false;
  };

  /* ── isEnemyWalkable (per-type walkability) ── */
  A.isEnemyWalkable = function isEnemyWalkable(enemy, col, row) {
    if (col < 0 || col >= C.COLS || row < 0 || row >= C.ROWS)
      return false;
    const cell = S.grid[row][col];
    if (cell === C.EMPTY)
      return true;
    if (enemy.type === 'climber' && cell === C.DESTRUCTIBLE)
      return true;
    if (enemy.type === 'ghost' && enemy.phasing)
      return cell !== undefined; // can walk through anything in-bounds
    return false;
  };

  /* ── hasBomb at position ── */
  A.hasBombAt = function hasBombAt(col, row) {
    for (const b of S.bombs)
      if (b.col === col && b.row === row)
        return true;
    return false;
  };

  /* ── Spawn Enemies ── */
  A.spawnEnemies = function spawnEnemies(level) {
    S.enemies = [];
    const count = C.NUM_ENEMIES + Math.floor(level / 2);

    // Build eligible pool with weights
    const eligible = T.ENEMY_TYPES.filter(t => level >= t.minLevel);
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
    for (const t of T.ENEMY_TYPES)
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
        col = 3 + Math.floor(Math.random() * (C.COLS - 4));
        row = 3 + Math.floor(Math.random() * (C.ROWS - 4));
      } while (
        (canSpawnOnDestructible
          ? S.grid[row][col] === C.WALL
          : S.grid[row][col] !== C.EMPTY) ||
        (col <= 3 && row <= 3)
      );

      const hp = typeDef.type === 'tank' ? 2 + Math.floor(level / 5) : typeDef.hp;
      const enemy = {
        col, row,
        x: col * C.TILE_SIZE + C.TILE_SIZE / 2,
        y: row * C.TILE_SIZE + C.TILE_SIZE / 2,
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

      S.enemies.push(enemy);
    }
  };

  /* ── Reset player to spawn position ── */
  A.resetPlayerPosition = function resetPlayerPosition() {
    S.player.col = 1;
    S.player.row = 1;
    S.player.x = 1 * C.TILE_SIZE + C.TILE_SIZE / 2;
    S.player.y = 1 * C.TILE_SIZE + C.TILE_SIZE / 2;
    S.player.moveProgress = 0;
    S.player.moveDir = null;
    S.player.facing = 0;
    S.player.walkFrame = 0;
    S.player.walkTimer = 0;
  };
})();
