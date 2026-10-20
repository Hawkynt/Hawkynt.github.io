/* The status bar under the canvas: level, gems and moves. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const L = NS.levels;
  const S = NS.state;
  const D = NS.dom;

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (D.statusLevel) D.statusLevel.textContent = `Level: ${S.currentLevel + 1}/${L.LEVELS.length}`;
    if (D.statusGems) {
      const total = L.LEVELS[S.currentLevel]?.collectibles?.length || 0;
      D.statusGems.textContent = `Gems: ${S.collected.length}/${total}`;
    }
    if (D.statusMoves) D.statusMoves.textContent = `Moves: ${S.moves}`;
  }

  Object.assign(NS.statusbar, { updateStatusBar });
})();
