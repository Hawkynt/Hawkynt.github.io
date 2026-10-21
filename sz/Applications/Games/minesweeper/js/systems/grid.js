/* Grid bounds and neighbor iteration over the minefield. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const GR = NS.grid;

  /* ---- Grid Helpers ---- */
  GR.inBounds = function inBounds(r, c) {
    return r >= 0 && r < S.rows && c >= 0 && c < S.cols;
  };

  GR.forEachNeighbor = function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        if (dr === 0 && dc === 0)
          continue;
        const nr = r + dr;
        const nc = c + dc;
        if (GR.inBounds(nr, nc))
          fn(nr, nc);
      }
  };
})();
