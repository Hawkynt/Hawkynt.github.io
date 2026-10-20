/* The procedural cave generator: the random layout roll, enemy placement, the boulder
   settling that lets loose boulders come to rest, and the solvability analysis with its
   blockage repair that keeps every generated level winnable. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Level generator ── */

  // Every generated level is solvable: enough diamonds and the exit are
  // reachable along cells the player can dig without setting any boulder in
  // motion, so no boulder can crush the player on that route or block it
  // later. Random layouts that fall short get the boulders in the way of the
  // explored area turned into dirt, one blockage at a time.
  function generateLevel(level) {
    buildLevelLayout(level);
    for (let repair = 0; repair < C.MAX_LEVEL_REPAIRS; ++repair) {
      const result = analyseLevel();
      if (result.solvable || !result.frontier.length)
        return;
      clearBlockage(pickBlockage(result));
    }
  }

  // Unsafe cells bordering the explored area: toward the exit while it is
  // still out of reach, anywhere otherwise
  function pickBlockage(result) {
    const frontier = result.frontier;
    if (result.exitReached)
      return frontier[Math.floor(Math.random() * frontier.length)];
    const dist = (key) => Math.abs(Math.floor(key / C.COLS) - S.exitRow) + Math.abs(key % C.COLS - S.exitCol);
    frontier.sort((a, b) => dist(a) - dist(b));
    return frontier[Math.floor(Math.random() * Math.min(3, frontier.length))];
  }

  // Turns the boulders that make a cell unsafe (and a boulder in it) into dirt
  function clearBlockage(key) {
    const r = Math.floor(key / C.COLS);
    const c = key % C.COLS;
    const soften = (rr, cc) => {
      if (S.grid[rr][cc] === C.BOULDER)
        S.grid[rr][cc] = C.DIRT;
    };
    soften(r, c);
    soften(r - 1, c);
    if (isRollingBoulder(r, c - 1))
      soften(r, c - 1);
    if (isRollingBoulder(r, c + 1))
      soften(r, c + 1);
    if (isRollingBoulder(r - 1, c - 1))
      soften(r - 1, c - 1);
    if (isRollingBoulder(r - 1, c + 1))
      soften(r - 1, c + 1);
  }

  function buildLevelLayout(level) {
    S.grid = [];
    S.enemies = [];
    S.fallingBoulders = new Map();
    S.slidingBoulders = new Map();
    S.fadingCells = [];
    S.gemsCollected = 0;
    S.exitOpen = false;

    const boulderChance = Math.min(0.12 + level * 0.01, 0.25);
    const gemChance = Math.min(0.06 + level * 0.005, 0.12);
    const dirtChance = 0.55;
    S.gemsRequired = Math.min(8 + level * 2, 30);
    S.TIME_LIMIT = Math.max(150 - level * 5, 60);
    S.timeLeft = S.TIME_LIMIT;

    let totalGems = 0;

    for (let r = 0; r < C.ROWS; ++r) {
      S.grid[r] = [];
      for (let c = 0; c < C.COLS; ++c) {
        if (r === 0 || r === C.ROWS - 1 || c === 0 || c === C.COLS - 1) {
          S.grid[r][c] = C.WALL;
          continue;
        }
        // Player start area
        if (r <= 2 && c <= 2) {
          S.grid[r][c] = (r === 1 && c === 1) ? C.EMPTY : C.DIRT;
          continue;
        }
        const rng = Math.random();
        if (rng < boulderChance) {
          S.grid[r][c] = C.BOULDER;
        } else if (rng < boulderChance + gemChance) {
          S.grid[r][c] = C.GEM;
          ++totalGems;
        } else if (rng < boulderChance + gemChance + dirtChance) {
          S.grid[r][c] = C.DIRT;
        } else {
          S.grid[r][c] = C.EMPTY;
        }
      }
    }

    // Ensure enough gems
    while (totalGems < S.gemsRequired + 3) {
      const r = 1 + Math.floor(Math.random() * (C.ROWS - 2));
      const c = 1 + Math.floor(Math.random() * (C.COLS - 2));
      if (S.grid[r][c] === C.DIRT || S.grid[r][c] === C.EMPTY) {
        S.grid[r][c] = C.GEM;
        ++totalGems;
      }
    }

    // Player start pocket
    S.grid[1][1] = C.EMPTY;
    S.grid[1][2] = C.EMPTY;
    S.grid[2][1] = C.EMPTY;

    // Place exit in bottom-right area
    S.exitRow = C.ROWS - 2;
    S.exitCol = C.COLS - 2;
    S.grid[S.exitRow][S.exitCol] = C.WALL; // hidden until unlocked

    placeEnemies(level);

    // Let loose boulders come to rest before play starts
    settleBoulders();
    S.enemies = S.enemies.filter((e) => S.grid[e.row][e.col] === C.EMPTY);
  }

  function placeEnemies(level) {
    const numEnemies = Math.min(2 + level, 8);
    for (let i = 0; i < numEnemies; ++i) {
      let er, ec;
      do {
        er = 3 + Math.floor(Math.random() * (C.ROWS - 5));
        ec = 3 + Math.floor(Math.random() * (C.COLS - 5));
      } while (S.grid[er][ec] === C.WALL || S.grid[er][ec] === C.BOULDER);
      S.grid[er][ec] = C.EMPTY;
      S.enemies.push({
        col: ec, row: er,
        targetCol: ec, targetRow: er,
        moveProgress: 1,
        direction: Math.floor(Math.random() * 4),
        alive: true,
        moveTimer: 0
      });
    }
  }

  function isRounded(cell) {
    return cell === C.BOULDER || cell === C.GEM;
  }

  /* Applies the boulder rules (fall, roll off rounded objects) until nothing moves */
  function settleBoulders() {
    for (let pass = 0; pass < C.ROWS * 4; ++pass) {
      let moved = false;
      for (let r = C.ROWS - 2; r >= 1; --r)
        for (let c = 1; c < C.COLS - 1; ++c) {
          if (S.grid[r][c] !== C.BOULDER)
            continue;
          if (S.grid[r + 1][c] === C.EMPTY) {
            S.grid[r][c] = C.EMPTY;
            S.grid[r + 1][c] = C.BOULDER;
            moved = true;
            continue;
          }
          if (!isRounded(S.grid[r + 1][c]))
            continue;
          for (const side of [-1, 1]) {
            const sc = c + side;
            if (sc >= 1 && sc < C.COLS - 1 && S.grid[r][sc] === C.EMPTY && S.grid[r + 1][sc] === C.EMPTY) {
              S.grid[r][c] = C.EMPTY;
              S.grid[r][sc] = C.BOULDER;
              moved = true;
              break;
            }
          }
        }
      if (!moved)
        return;
    }
  }

  // A boulder that sits on a rounded object rolls as soon as there is room beside it
  function isRollingBoulder(r, c) {
    return c >= 1 && c < C.COLS - 1 && S.grid[r][c] === C.BOULDER && isRounded(S.grid[r + 1][c]);
  }

  // Digging or collecting this cell can never start a boulder moving
  function isSafeCell(r, c) {
    const cell = S.grid[r][c];
    if (cell !== C.EMPTY && cell !== C.DIRT && cell !== C.GEM)
      return false;
    if (S.grid[r - 1][c] === C.BOULDER)
      return false;
    if (isRollingBoulder(r, c - 1) || isRollingBoulder(r, c + 1))
      return false;
    const above = S.grid[r - 1][c];
    if (above !== C.WALL && above !== C.BOULDER && (isRollingBoulder(r - 1, c - 1) || isRollingBoulder(r - 1, c + 1)))
      return false;
    return true;
  }

  function isLevelSolvable() {
    return analyseLevel().solvable;
  }

  // Explores everything reachable over safe cells from the start
  function analyseLevel() {
    const seen = new Uint8Array(C.ROWS * C.COLS);
    const queue = [1 * C.COLS + 1];
    const frontier = [];
    seen[C.COLS + 1] = 1;
    let gems = 0;
    let exitReached = false;
    for (let i = 0; i < queue.length; ++i) {
      const r = Math.floor(queue[i] / C.COLS);
      const c = queue[i] % C.COLS;
      if (S.grid[r][c] === C.GEM)
        ++gems;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr === S.exitRow && nc === S.exitCol)
          exitReached = true;
        const key = nr * C.COLS + nc;
        if (seen[key] || nr < 1 || nr >= C.ROWS - 1 || nc < 1 || nc >= C.COLS - 1 || S.grid[nr][nc] === C.WALL)
          continue;
        seen[key] = 1;
        if (isSafeCell(nr, nc))
          queue.push(key);
        else
          frontier.push(key);
      }
    }
    return { solvable: exitReached && gems >= S.gemsRequired, exitReached, frontier };
  }

  Object.assign(NS.levelgen, { generateLevel, isLevelSolvable });
})();
