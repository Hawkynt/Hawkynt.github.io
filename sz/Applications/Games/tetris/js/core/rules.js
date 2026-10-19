/* The rules: piece shape and wall-kick lookups, collision testing, the ghost row,
   full-row finding and removal, scoring and level curve, and the 7-bag randomizer. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;

  /* Level speed curve (ms per drop) */
  function getDropInterval(level) {
    const speeds = [800, 720, 630, 550, 470, 380, 300, 220, 150, 100, 80, 70, 60, 50, 50];
    return level < speeds.length ? speeds[level] : 50;
  }

  function getShape(type, rotation) {
    return C.PIECES[type].states[rotation];
  }

  function getPieceColor(type) {
    return C.PIECES[type].color;
  }

  function getWallKicks(type, fromRot, toRot) {
    const key = fromRot + '>' + toRot;
    if (type === 'I')
      return C.WALL_KICKS_I[key] || [[0,0]];
    return C.WALL_KICKS_JLSTZ[key] || [[0,0]];
  }

  function isValidPosition(type, rotation, row, col) {
    const shape = getShape(type, rotation);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = row + r;
        const bc = col + c;
        if (bc < 0 || bc >= C.COLS || br >= C.ROWS)
          return false;
        if (br < 0)
          continue;
        if (S.board[br][bc] !== null)
          return false;
      }
    return true;
  }

  /* ---- Ghost Piece Position ---- */
  function getGhostRow() {
    let ghostRow = S.currentPiece.row;
    while (isValidPosition(S.currentPiece.type, S.currentPiece.rotation, ghostRow + 1, S.currentPiece.col))
      ++ghostRow;
    return ghostRow;
  }

  /* ---- Line Clear ---- */
  function findFullRows() {
    const full = [];
    for (let r = 0; r < C.ROWS; ++r) {
      let complete = true;
      for (let c = 0; c < C.COLS; ++c)
        if (S.board[r][c] === null) {
          complete = false;
          break;
        }
      if (complete)
        full.push(r);
    }
    return full;
  }

  function removeRows(rowIndices) {
    const sorted = [...rowIndices].sort((a, b) => b - a);
    for (const row of sorted) {
      S.board.splice(row, 1);
      S.board.unshift(new Array(C.COLS).fill(null));
    }
  }

  /* ---- Scoring ---- */
  function addScore(linesCleared) {
    if (linesCleared > 0 && linesCleared <= 4)
      S.score += C.LINE_SCORES[linesCleared] * (S.level + 1);
  }

  function addSoftDropPoints(cells) {
    S.score += cells;
  }

  function addHardDropPoints(cells) {
    S.score += cells * 2;
  }

  function updateLevel() {
    const newLevel = Math.floor(S.lines / 10);
    if (newLevel > S.level)
      S.level = newLevel;
  }

  /* ---- 7-Bag Randomizer ---- */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function fillBag() {
    S.bag = shuffleArray([...C.PIECE_NAMES]);
  }

  function nextFromBag() {
    if (!S.bag || S.bag.length === 0)
      fillBag();
    return S.bag.pop();
  }

  Object.assign(NS.rules, {
    getDropInterval, getShape, getPieceColor, getWallKicks, isValidPosition, getGhostRow,
    findFullRows, removeRows, addScore, addSoftDropPoints, addHardDropPoints, updateLevel,
    shuffleArray, fillBag, nextFromBag
  });
})();
