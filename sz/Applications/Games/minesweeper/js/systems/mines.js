/* First-click-safe mine placement and adjacency counting. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const GR = NS.grid;
  const MI = NS.mines;

  /* ---- Mine Placement ---- */
  MI.placeMines = function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < S.mineCount) {
      const r = Math.floor(Math.random() * S.rows);
      const c = Math.floor(Math.random() * S.cols);
      if (S.grid[r][c].mine)
        continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)
        continue;
      S.grid[r][c].mine = true;
      ++placed;
    }

    for (let r = 0; r < S.rows; ++r)
      for (let c = 0; c < S.cols; ++c) {
        let count = 0;
        GR.forEachNeighbor(r, c, (nr, nc) => {
          if (S.grid[nr][nc].mine)
            ++count;
        });
        S.grid[r][c].adjacent = count;
      }
  };
})();
