/* R, the pure puzzle logic: which cells the current perspective lets the player
   walk through, and which illusion link a tile fires at this angle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const L = NS.levels;
  const S = NS.state;

  /* ══════════════════════════════════════════════════════════════════
     WALKABILITY — perspective determines which paths are passable
     ══════════════════════════════════════════════════════════════════ */

  function isWalkable(row, col) {
    const def = L.LEVELS[S.currentLevel];
    if (row < 0 || row >= def.grid.length || col < 0 || col >= def.grid[0].length)
      return false;

    const cell = def.grid[row][col];
    if (cell === 0) return false;
    if (cell === 1 || cell === 2 || cell === 4) return true;

    // Penrose stair cells: walkable depends on perspective
    if (cell === 3) {
      // Check illusion links
      for (const link of def.illusionLinks) {
        if (link.from.row === row && link.from.col === col)
          return link.perspective === S.perspective;
      }
      return true;
    }

    return false;
  }

  function checkIllusionLink(row, col) {
    const def = L.LEVELS[S.currentLevel];
    for (const link of def.illusionLinks) {
      if (link.from.row === row && link.from.col === col && link.perspective === S.perspective)
        return link.to;
    }
    return null;
  }

  Object.assign(NS.rules, { isWalkable, checkIllusionLink });
})();
