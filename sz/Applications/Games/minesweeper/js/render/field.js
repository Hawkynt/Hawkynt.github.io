/* Building the cell grid in the DOM and painting one cell's visual state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const F = NS.field;

  /* ---- Rendering ---- */
  F.buildField = function buildField() {
    D.minefield.innerHTML = '';
    D.minefield.style.gridTemplateColumns = 'repeat(' + S.cols + ', 16px)';
    D.minefield.style.gridTemplateRows = 'repeat(' + S.rows + ', 16px)';

    for (let r = 0; r < S.rows; ++r)
      for (let c = 0; c < S.cols; ++c) {
        const cell = document.createElement('div');
        cell.className = 'cell hidden';
        cell.dataset.r = r;
        cell.dataset.c = c;
        D.minefield.appendChild(cell);
        S.grid[r][c].el = cell;
      }
  };

  F.renderCell = function renderCell(r, c) {
    const data = S.grid[r][c];
    const el = data.el;
    el.textContent = '';

    if (data.revealed) {
      if (data.mine)
        el.className = data.hitMine ? 'cell mine-hit mine-icon' : 'cell mine-shown mine-icon';
      else if (data.adjacent > 0) {
        el.className = 'cell revealed ' + C.NUMBER_COLORS[data.adjacent];
        el.textContent = data.adjacent;
      } else
        el.className = 'cell revealed';
    } else if (data.wrongFlag)
      el.className = 'cell mine-wrong flag-icon';
    else if (data.flagged)
      el.className = 'cell hidden flagged flag-icon';
    else if (data.question) {
      el.className = 'cell hidden question';
      el.textContent = '?';
    } else
      el.className = 'cell hidden';
  };
})();
