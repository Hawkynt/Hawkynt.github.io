/* The piece lifecycle: spawning from the queue, hold, movement and rotation with
   wall kicks, the lock-delay bookkeeping, locking onto the board and advancing
   after a clear. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;
  const {
    getShape, getPieceColor, getWallKicks, isValidPosition, findFullRows, removeRows,
    addScore, addSoftDropPoints, addHardDropPoints, updateLevel, nextFromBag
  } = NS.rules;
  const { render, renderPreview, renderHold, renderClearAnimation, updateDisplays } = NS.board;
  const { flashLockedCells, showScorePopup, showLevelUp, shakeBoard } = NS.effects;

  /* ---- Spawn Piece ---- */
  function spawnPiece(heldPiece) {
    let type = heldPiece;
    if (!type) {
      type = S.nextQueue.shift();
      S.nextQueue.push(nextFromBag());
    }

    const shape = getShape(type, 0);
    const size = shape.length;
    const col = Math.floor((C.COLS - size) / 2);
    const row = -1;

    S.currentPiece = { type, rotation: 0, row, col };
    resetLockState();

    if (!isValidPosition(type, 0, row, col)) {
      if (!isValidPosition(type, 0, row - 1, col)) {
        lockPieceToBoard();
        NS.game.doGameOver();
        return false;
      }
      S.currentPiece.row = row - 1;
    }

    S.lowestRow = S.currentPiece.row;
    renderPreview();
    return true;
  }

  /* ---- Lock Delay ---- */
  function resetLockState() {
    S.lockStart = null;
    S.lockResets = 0;
    S.lowestRow = S.currentPiece ? S.currentPiece.row : -99;
  }

  function isGrounded() {
    return !!S.currentPiece && !isValidPosition(S.currentPiece.type, S.currentPiece.rotation, S.currentPiece.row + 1, S.currentPiece.col);
  }

  /* A piece that reaches a new lowest row earns a fresh set of lock resets */
  function noteLowestRow() {
    if (S.currentPiece.row > S.lowestRow) {
      S.lowestRow = S.currentPiece.row;
      S.lockResets = 0;
    }
  }

  /* Moving or rotating a resting piece restarts its lock timer (limited) */
  function onPieceShifted() {
    noteLowestRow();
    if (S.lockStart !== null && S.lockResets < C.MAX_LOCK_RESETS) {
      S.lockStart = performance.now();
      ++S.lockResets;
    }
  }

  /* ---- Hold ---- */
  function holdPiece() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows || !S.currentPiece)
      return;
    if (S.holdUsed) {
      SZ.GameAudio.play('error', { volume: 0.4 });
      return;
    }
    const swapIn = S.heldType;
    S.heldType = S.currentPiece.type;
    S.holdUsed = true;
    S.currentPiece = null;
    SZ.GameAudio.play('whoosh', { pitch: 1.4, volume: 0.7 });
    if (!spawnPiece(swapIn))
      return;
    renderHold();
    S.lastDropTime = performance.now();
    render();
  }

  /* ---- Lock piece onto board ---- */
  function lockPieceToBoard() {
    const shape = getShape(S.currentPiece.type, S.currentPiece.rotation);
    const color = getPieceColor(S.currentPiece.type);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = S.currentPiece.row + r;
        const bc = S.currentPiece.col + c;
        if (br >= 0 && br < C.ROWS && bc >= 0 && bc < C.COLS)
          S.board[br][bc] = color;
      }
  }

  /* ---- Movement ---- */
  function moveLeft() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;
    if (isValidPosition(S.currentPiece.type, S.currentPiece.rotation, S.currentPiece.row, S.currentPiece.col - 1)) {
      --S.currentPiece.col;
      onPieceShifted();
      SZ.GameAudio.play('click', { volume: 0.5 });
      render();
    }
  }

  function moveRight() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;
    if (isValidPosition(S.currentPiece.type, S.currentPiece.rotation, S.currentPiece.row, S.currentPiece.col + 1)) {
      ++S.currentPiece.col;
      onPieceShifted();
      SZ.GameAudio.play('click', { volume: 0.5 });
      render();
    }
  }

  function moveDown() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return false;
    if (isValidPosition(S.currentPiece.type, S.currentPiece.rotation, S.currentPiece.row + 1, S.currentPiece.col)) {
      ++S.currentPiece.row;
      noteLowestRow();
      if (!isGrounded())
        S.lockStart = null;
      render();
      return true;
    }
    return false;
  }

  function softDrop() {
    if (moveDown()) {
      addSoftDropPoints(1);
      updateDisplays();
      S.lastDropTime = performance.now();
    }
  }

  function hardDrop() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;
    let dropped = 0;
    while (isValidPosition(S.currentPiece.type, S.currentPiece.rotation, S.currentPiece.row + 1, S.currentPiece.col)) {
      ++S.currentPiece.row;
      ++dropped;
    }
    addHardDropPoints(dropped);
    updateDisplays();
    if (dropped > 0)
      shakeBoard(1);
    SZ.GameAudio.play('thud');
    lockAndAdvance(true);
  }

  function rotateCW() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;
    const newRot = (S.currentPiece.rotation + 1) % 4;
    const kicks = getWallKicks(S.currentPiece.type, S.currentPiece.rotation, newRot);
    for (const [dx, dy] of kicks) {
      if (isValidPosition(S.currentPiece.type, newRot, S.currentPiece.row - dy, S.currentPiece.col + dx)) {
        S.currentPiece.rotation = newRot;
        S.currentPiece.col += dx;
        S.currentPiece.row -= dy;
        onPieceShifted();
        SZ.GameAudio.play('blip', { pitch: 1.3, volume: 0.5 });
        render();
        return;
      }
    }
  }

  function rotateCCW() {
    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;
    const newRot = (S.currentPiece.rotation + 3) % 4;
    const kicks = getWallKicks(S.currentPiece.type, S.currentPiece.rotation, newRot);
    for (const [dx, dy] of kicks) {
      if (isValidPosition(S.currentPiece.type, newRot, S.currentPiece.row - dy, S.currentPiece.col + dx)) {
        S.currentPiece.rotation = newRot;
        S.currentPiece.col += dx;
        S.currentPiece.row -= dy;
        onPieceShifted();
        SZ.GameAudio.play('blip', { pitch: 1.3, volume: 0.5 });
        render();
        return;
      }
    }
  }

  /* ---- Lock and Advance ---- */
  function lockAndAdvance(hardDropped) {
    const lockedRow = S.currentPiece.row;
    const lockedShape = getShape(S.currentPiece.type, S.currentPiece.rotation);

    flashLockedCells();
    lockPieceToBoard();
    S.currentPiece = null;
    S.holdUsed = false;
    renderHold();
    if (!hardDropped)
      SZ.GameAudio.play('drop', { volume: 0.7 });

    /* Lock out: any filled cell above the visible playfield = game over */
    const lockedSize = lockedShape.length;
    for (let r = 0; r < lockedSize; ++r)
      for (let c = 0; c < lockedSize; ++c)
        if (lockedShape[r][c] && lockedRow + r < 0) {
          NS.game.doGameOver();
          return;
        }

    const fullRows = findFullRows();
    if (fullRows.length > 0) {
      S.clearingRows = fullRows;
      S.clearAnimStart = performance.now();
      renderClearAnimation(fullRows);
      return;
    }

    advanceAfterClear(0);
  }

  function advanceAfterClear(linesCleared) {
    const prevLevel = S.level;
    if (linesCleared > 0) {
      S.lines += linesCleared;
      const pts = C.LINE_SCORES[linesCleared] * (S.level + 1);
      addScore(linesCleared);
      updateLevel();
      showScorePopup(pts, linesCleared, Math.min(...S.clearingRowsSnapshot));
      if (S.level > prevLevel) {
        showLevelUp();
        SZ.GameAudio.play('levelup');
      }
    }
    updateDisplays();

    if (!spawnPiece())
      return;

    S.lastDropTime = performance.now();
    render();
  }

  Object.assign(NS.pieces, {
    spawnPiece, resetLockState, isGrounded, noteLowestRow, onPieceShifted, holdPiece,
    lockPieceToBoard, moveLeft, moveRight, moveDown, softDrop, hardDrop, rotateCW, rotateCCW,
    lockAndAdvance, advanceAfterClear
  });
})();
