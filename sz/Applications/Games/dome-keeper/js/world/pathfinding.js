;(function() {
  'use strict';

  // Breadth-first search for walking through the tunnels.
  // Owns: NS.pathfinding
  // Reads: constants
  // Reads state of: gameState

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { GRID_COLS, GRID_ROWS, TILE_EMPTY } = NS.constants;

  /* ======================================================================
     PATHFINDING (BFS for underground navigation)
     ====================================================================== */

  // Breadth-first search through tunnels; typed arrays are reused between calls
  let pathPrev = null, pathQueue = null, pathSeen = null, pathStamp = 0;
  function findPath(fromCol, fromRow, toCol, toRow) {
    if (fromCol === toCol && fromRow === toRow) return [];
    if (toCol < 0 || toCol >= GRID_COLS || toRow < 0 || toRow >= GRID_ROWS) return null;
    if (fromCol < 0 || fromCol >= GRID_COLS || fromRow < 0 || fromRow >= GRID_ROWS) return null;
    if (G.undergroundGrid[toRow][toCol] !== TILE_EMPTY) return null;
    const N = GRID_ROWS * GRID_COLS;
    if (!pathPrev || pathPrev.length !== N) {
      pathPrev = new Int32Array(N);
      pathQueue = new Int32Array(N);
      pathSeen = new Uint32Array(N);
      pathStamp = 0;
    }
    const stamp = ++pathStamp;
    const start = fromRow * GRID_COLS + fromCol, goal = toRow * GRID_COLS + toCol;
    let head = 0, tail = 0;
    pathQueue[tail++] = start;
    pathSeen[start] = stamp;
    pathPrev[start] = -1;
    while (head < tail) {
      const cur = pathQueue[head++];
      if (cur === goal) {
        const path = [];
        for (let i = goal; i !== start; i = pathPrev[i])
          path.push({ col: i % GRID_COLS, row: (i / GRID_COLS) | 0 });
        return path.reverse();
      }
      const r = (cur / GRID_COLS) | 0, c = cur - r * GRID_COLS;
      for (let k = 0; k < 4; ++k) {
        const nr = r + (k === 0 ? -1 : k === 1 ? 1 : 0);
        const nc = c + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        const ni = nr * GRID_COLS + nc;
        if (pathSeen[ni] === stamp || G.undergroundGrid[nr][nc] !== TILE_EMPTY) continue;
        pathSeen[ni] = stamp;
        pathPrev[ni] = cur;
        pathQueue[tail++] = ni;
      }
    }
    return null; // no path found
  }

  function findAdjacentEmptyNear(targetCol, targetRow) {
    // Find the closest empty tile adjacent to (targetCol, targetRow) that has a path from player
    const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];
    let bestPath = null;
    let bestAdj = null;
    for (const d of dirs) {
      const ac = targetCol + d.dc;
      const ar = targetRow + d.dr;
      if (ac < 0 || ac >= GRID_COLS || ar < 0 || ar >= GRID_ROWS) continue;
      if (G.undergroundGrid[ar][ac] !== TILE_EMPTY) continue;
      const path = findPath(G.drillX, G.drillY, ac, ar);
      if (path !== null && (bestPath === null || path.length < bestPath.length)) {
        bestPath = path;
        bestAdj = { col: ac, row: ar, dx: targetCol - ac, dy: targetRow - ar };
      }
    }
    return bestAdj ? { path: bestPath, adj: bestAdj } : null;
  }

  NS.pathfinding = { findPath, findAdjacentEmptyNear };
})();
