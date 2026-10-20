/* I, the isometric helpers: the easing curve and the grid-to-screen projection. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;

  /* ══════════════════════════════════════════════════════════════════
     ISOMETRIC HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function toIso(col, row) {
    const isoX = (col - row) * (C.TILE_W / 2) + C.CANVAS_W / 2;
    const isoY = (col + row) * (C.TILE_H / 2) + C.BOARD_ORIGIN_Y;
    return { x: isoX, y: isoY };
  }

  function toScreen(col, row, elevation) {
    const iso = toIso(col, row);
    return { x: iso.x, y: iso.y - (elevation || 0) * C.TILE_H };
  }

  Object.assign(NS.iso, { smoothstep, toIso, toScreen });
})();
