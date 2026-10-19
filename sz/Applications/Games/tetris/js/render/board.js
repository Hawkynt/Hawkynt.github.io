/* The DOM renderer: builds the board and mini grids, paints board, ghost and current
   piece into the cells, renders hold and preview, the clear animation and the displays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { getShape, getPieceColor, getGhostRow } = NS.rules;
  const { spawnClearParticles, flashClearedRows, shakeBoard } = NS.effects;

  /* ---- Build DOM grids ---- */
  function buildBoard() {
    D.boardEl.innerHTML = '';
    D.boardCells = [];
    for (let r = 0; r < C.ROWS; ++r)
      for (let c = 0; c < C.COLS; ++c) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        D.boardEl.appendChild(cell);
        D.boardCells.push(cell);
      }
  }

  function buildMiniGrid(parent, extraClass) {
    const grid = document.createElement('div');
    grid.className = 'preview-grid' + (extraClass ? ' ' + extraClass : '');
    const cells = [];
    for (let r = 0; r < C.PREVIEW_ROWS; ++r)
      for (let c = 0; c < C.PREVIEW_COLS; ++c) {
        const cell = document.createElement('div');
        cell.className = 'preview-cell';
        grid.appendChild(cell);
        cells.push(cell);
      }
    parent.appendChild(grid);
    return cells;
  }

  function buildPreview() {
    D.previewGridEl.innerHTML = '';
    D.previewCells = [];
    for (let i = 0; i < C.NEXT_COUNT; ++i)
      D.previewCells.push(buildMiniGrid(D.previewGridEl, i === 0 ? 'preview-first' : 'preview-later'));
    D.holdGridEl.innerHTML = '';
    D.holdCells = buildMiniGrid(D.holdGridEl, 'preview-first');
  }

  /* ---- Rendering ---- */
  function render() {
    for (let r = 0; r < C.ROWS; ++r)
      for (let c = 0; c < C.COLS; ++c) {
        const idx = r * C.COLS + c;
        const val = S.board[r][c];
        if (val !== null)
          D.boardCells[idx].className = 'board-cell filled piece-' + val;
        else
          D.boardCells[idx].className = 'board-cell';
      }

    if (!S.currentPiece)
      return;

    /* Draw ghost piece */
    const ghostRow = getGhostRow();
    if (ghostRow !== S.currentPiece.row) {
      const shape = getShape(S.currentPiece.type, S.currentPiece.rotation);
      const color = getPieceColor(S.currentPiece.type);
      const size = shape.length;
      for (let r = 0; r < size; ++r)
        for (let c = 0; c < size; ++c) {
          if (!shape[r][c])
            continue;
          const br = ghostRow + r;
          const bc = S.currentPiece.col + c;
          if (br >= 0 && br < C.ROWS && bc >= 0 && bc < C.COLS) {
            const idx = br * C.COLS + bc;
            if (S.board[br][bc] === null)
              D.boardCells[idx].className = 'board-cell ghost piece-' + color;
          }
        }
    }

    /* Draw current piece */
    const shape = getShape(S.currentPiece.type, S.currentPiece.rotation);
    const color = getPieceColor(S.currentPiece.type);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = S.currentPiece.row + r;
        const bc = S.currentPiece.col + c;
        if (br >= 0 && br < C.ROWS && bc >= 0 && bc < C.COLS) {
          const idx = br * C.COLS + bc;
          D.boardCells[idx].className = 'board-cell filled piece-' + color;
        }
      }
  }

  /* Draws a piece centred in a small grid, trimmed to its filled cells */
  function renderMini(cells, type) {
    for (const cell of cells)
      cell.className = 'preview-cell';
    if (!type)
      return;

    const shape = getShape(type, 0);
    const size = shape.length;
    let minR = size, maxR = -1, minC = size, maxC = -1;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c)
        if (shape[r][c]) {
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }

    const offsetR = Math.floor((C.PREVIEW_ROWS - (maxR - minR + 1)) / 2) - minR;
    const offsetC = Math.floor((C.PREVIEW_COLS - (maxC - minC + 1)) / 2) - minC;
    const color = getPieceColor(type);
    for (let r = minR; r <= maxR; ++r)
      for (let c = minC; c <= maxC; ++c) {
        if (!shape[r][c])
          continue;
        const pr = offsetR + r;
        const pc = offsetC + c;
        if (pr >= 0 && pr < C.PREVIEW_ROWS && pc >= 0 && pc < C.PREVIEW_COLS)
          cells[pr * C.PREVIEW_COLS + pc].className = 'preview-cell filled piece-' + color;
      }
  }

  function renderPreview() {
    for (let i = 0; i < C.NEXT_COUNT; ++i)
      renderMini(D.previewCells[i], S.nextQueue[i]);
  }

  function renderHold() {
    renderMini(D.holdCells, S.heldType);
    D.holdBox.classList.toggle('hold-used', !!S.holdUsed);
  }

  function renderClearAnimation(rows) {
    for (const row of rows)
      for (let c = 0; c < C.COLS; ++c) {
        const idx = row * C.COLS + c;
        D.boardCells[idx].className = 'board-cell clearing';
      }
    spawnClearParticles(rows);
    flashClearedRows(rows);
    shakeBoard(rows.length);
    SZ.GameAudio.play('lineClear', { pitch: 1 + (rows.length - 1) * 0.12, volume: 0.8 + rows.length * 0.1 });
    if (rows.length >= 4)
      SZ.GameAudio.play('powerup');
  }

  function updateDisplays() {
    D.scoreDisplay.textContent = S.score;
    D.levelDisplay.textContent = S.level;
    D.linesDisplay.textContent = S.lines;
  }

  Object.assign(NS.board, {
    buildBoard, buildMiniGrid, buildPreview, render, renderMini, renderPreview, renderHold,
    renderClearAnimation, updateDisplays
  });
})();
