/* Flood-fill reveal with staggered animation and the chord action. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const GR = NS.grid;
  const F = NS.field;
  const GO = NS.gameover;
  const RV = NS.reveal;

  /* ---- Reveal Logic ---- */
  RV.revealCell = function revealCell(r, c) {
    const data = S.grid[r][c];
    if (data.revealed || data.flagged)
      return;

    data.revealed = true;
    data.question = false;
    ++S.revealedCount;

    if (data.mine) {
      data.hitMine = true;
      SZ.GameAudio.play('explode');
      F.renderCell(r, c);
      GO.doGameOver(false);
      return;
    }

    F.renderCell(r, c);

    if (S.revealOriginR >= 0) {
      const dist = Math.abs(r - S.revealOriginR) + Math.abs(c - S.revealOriginC);
      data.el.classList.add('revealing');
      data.el.style.animationDelay = (dist * 30) + 'ms';
      data.el.addEventListener('animationend', function handler() {
        data.el.classList.remove('revealing');
        data.el.style.animationDelay = '';
        data.el.removeEventListener('animationend', handler);
      });
    }

    if (data.adjacent === 0)
      GR.forEachNeighbor(r, c, (nr, nc) => RV.revealCell(nr, nc));
  };

  RV.chordCell = function chordCell(r, c) {
    const data = S.grid[r][c];
    if (!data.revealed || data.adjacent === 0)
      return;

    let adjacentFlags = 0;
    GR.forEachNeighbor(r, c, (nr, nc) => {
      if (S.grid[nr][nc].flagged)
        ++adjacentFlags;
    });

    if (adjacentFlags !== data.adjacent)
      return;

    GR.forEachNeighbor(r, c, (nr, nc) => {
      if (!S.grid[nr][nc].revealed && !S.grid[nr][nc].flagged)
        RV.revealCell(nr, nc);
    });
  };
})();
