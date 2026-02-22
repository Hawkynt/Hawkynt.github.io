;(function() {
  'use strict';

  /* ---- Constants ---- */
  const COLS = 10;
  const ROWS = 20;
  const PREVIEW_SIZE = 4;
  const STORAGE_KEY = 'sz-tetris-high-scores';
  const MAX_HIGH_SCORES = 5;

  /* Tetromino definitions: shape matrices for each rotation state */
  const PIECES = {
    I: {
      color: 'I',
      states: [
        [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
        [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
        [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
        [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
      ]
    },
    O: {
      color: 'O',
      states: [
        [[1,1],[1,1]],
        [[1,1],[1,1]],
        [[1,1],[1,1]],
        [[1,1],[1,1]]
      ]
    },
    T: {
      color: 'T',
      states: [
        [[0,1,0],[1,1,1],[0,0,0]],
        [[0,1,0],[0,1,1],[0,1,0]],
        [[0,0,0],[1,1,1],[0,1,0]],
        [[0,1,0],[1,1,0],[0,1,0]]
      ]
    },
    S: {
      color: 'S',
      states: [
        [[0,1,1],[1,1,0],[0,0,0]],
        [[0,1,0],[0,1,1],[0,0,1]],
        [[0,0,0],[0,1,1],[1,1,0]],
        [[1,0,0],[1,1,0],[0,1,0]]
      ]
    },
    Z: {
      color: 'Z',
      states: [
        [[1,1,0],[0,1,1],[0,0,0]],
        [[0,0,1],[0,1,1],[0,1,0]],
        [[0,0,0],[1,1,0],[0,1,1]],
        [[0,1,0],[1,1,0],[1,0,0]]
      ]
    },
    J: {
      color: 'J',
      states: [
        [[1,0,0],[1,1,1],[0,0,0]],
        [[0,1,1],[0,1,0],[0,1,0]],
        [[0,0,0],[1,1,1],[0,0,1]],
        [[0,1,0],[0,1,0],[1,1,0]]
      ]
    },
    L: {
      color: 'L',
      states: [
        [[0,0,1],[1,1,1],[0,0,0]],
        [[0,1,0],[0,1,0],[0,1,1]],
        [[0,0,0],[1,1,1],[1,0,0]],
        [[1,1,0],[0,1,0],[0,1,0]]
      ]
    }
  };

  const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  /* SRS wall kick data */
  const WALL_KICKS_JLSTZ = {
    '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };

  const WALL_KICKS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };

  /* Scoring multipliers (NES-style) */
  const LINE_SCORES = [0, 40, 100, 300, 1200];

  /* Level speed curve (ms per drop) */
  function getDropInterval(level) {
    const speeds = [800, 720, 630, 550, 470, 380, 300, 220, 150, 100, 80, 70, 60, 50, 50];
    return level < speeds.length ? speeds[level] : 50;
  }

  /* ---- State ---- */
  let board;
  let currentPiece;
  let nextPieceType;
  let bag;
  let score;
  let level;
  let lines;
  let gameActive;
  let gamePaused;
  let gameOverFlag;
  let lastDropTime;
  let animFrameId;
  let clearingRows;
  let clearAnimStart;
  let softDropping;

  /* ---- DOM ---- */
  const boardEl = document.getElementById('board');
  const previewGridEl = document.getElementById('previewGrid');
  const scoreDisplay = document.getElementById('scoreDisplay');
  const levelDisplay = document.getElementById('levelDisplay');
  const linesDisplay = document.getElementById('linesDisplay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');

  let boardCells = [];
  let previewCells = [];

  /* ---- Build DOM grids ---- */
  function buildBoard() {
    boardEl.innerHTML = '';
    boardCells = [];
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        boardEl.appendChild(cell);
        boardCells.push(cell);
      }
  }

  function buildPreview() {
    previewGridEl.innerHTML = '';
    previewCells = [];
    for (let r = 0; r < PREVIEW_SIZE; ++r)
      for (let c = 0; c < PREVIEW_SIZE; ++c) {
        const cell = document.createElement('div');
        cell.className = 'preview-cell';
        previewGridEl.appendChild(cell);
        previewCells.push(cell);
      }
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
    bag = shuffleArray([...PIECE_NAMES]);
  }

  function nextFromBag() {
    if (!bag || bag.length === 0)
      fillBag();
    return bag.pop();
  }

  /* ---- Piece Helpers ---- */
  function getShape(type, rotation) {
    return PIECES[type].states[rotation];
  }

  function getPieceColor(type) {
    return PIECES[type].color;
  }

  function getWallKicks(type, fromRot, toRot) {
    const key = fromRot + '>' + toRot;
    if (type === 'I')
      return WALL_KICKS_I[key] || [[0,0]];
    return WALL_KICKS_JLSTZ[key] || [[0,0]];
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
        if (bc < 0 || bc >= COLS || br >= ROWS)
          return false;
        if (br < 0)
          continue;
        if (board[br][bc] !== null)
          return false;
      }
    return true;
  }

  /* ---- Spawn Piece ---- */
  function spawnPiece() {
    const type = nextPieceType;
    nextPieceType = nextFromBag();

    const shape = getShape(type, 0);
    const size = shape.length;
    const col = Math.floor((COLS - size) / 2);
    const row = -1;

    currentPiece = { type, rotation: 0, row, col };

    if (!isValidPosition(type, 0, row, col)) {
      if (!isValidPosition(type, 0, row - 1, col)) {
        lockPieceToBoard();
        doGameOver();
        return false;
      }
      currentPiece.row = row - 1;
    }

    renderPreview();
    return true;
  }

  /* ---- Lock piece onto board ---- */
  function lockPieceToBoard() {
    const shape = getShape(currentPiece.type, currentPiece.rotation);
    const color = getPieceColor(currentPiece.type);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = currentPiece.row + r;
        const bc = currentPiece.col + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS)
          board[br][bc] = color;
      }
  }

  /* ---- Ghost Piece Position ---- */
  function getGhostRow() {
    let ghostRow = currentPiece.row;
    while (isValidPosition(currentPiece.type, currentPiece.rotation, ghostRow + 1, currentPiece.col))
      ++ghostRow;
    return ghostRow;
  }

  /* ---- Line Clear ---- */
  function findFullRows() {
    const full = [];
    for (let r = 0; r < ROWS; ++r) {
      let complete = true;
      for (let c = 0; c < COLS; ++c)
        if (board[r][c] === null) {
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
      board.splice(row, 1);
      board.unshift(new Array(COLS).fill(null));
    }
  }

  /* ---- Scoring ---- */
  function addScore(linesCleared) {
    if (linesCleared > 0 && linesCleared <= 4)
      score += LINE_SCORES[linesCleared] * (level + 1);
  }

  function addSoftDropPoints(cells) {
    score += cells;
  }

  function addHardDropPoints(cells) {
    score += cells * 2;
  }

  function updateLevel() {
    const newLevel = Math.floor(lines / 10);
    if (newLevel > level)
      level = newLevel;
  }

  /* ---- Movement ---- */
  function moveLeft() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;
    if (isValidPosition(currentPiece.type, currentPiece.rotation, currentPiece.row, currentPiece.col - 1)) {
      --currentPiece.col;
      render();
    }
  }

  function moveRight() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;
    if (isValidPosition(currentPiece.type, currentPiece.rotation, currentPiece.row, currentPiece.col + 1)) {
      ++currentPiece.col;
      render();
    }
  }

  function moveDown() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return false;
    if (isValidPosition(currentPiece.type, currentPiece.rotation, currentPiece.row + 1, currentPiece.col)) {
      ++currentPiece.row;
      render();
      return true;
    }
    return false;
  }

  function softDrop() {
    if (moveDown()) {
      addSoftDropPoints(1);
      updateDisplays();
      lastDropTime = performance.now();
    }
  }

  function hardDrop() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;
    let dropped = 0;
    while (isValidPosition(currentPiece.type, currentPiece.rotation, currentPiece.row + 1, currentPiece.col)) {
      ++currentPiece.row;
      ++dropped;
    }
    addHardDropPoints(dropped);
    updateDisplays();
    lockAndAdvance();
  }

  function rotateCW() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;
    const newRot = (currentPiece.rotation + 1) % 4;
    const kicks = getWallKicks(currentPiece.type, currentPiece.rotation, newRot);
    for (const [dx, dy] of kicks) {
      if (isValidPosition(currentPiece.type, newRot, currentPiece.row - dy, currentPiece.col + dx)) {
        currentPiece.rotation = newRot;
        currentPiece.col += dx;
        currentPiece.row -= dy;
        render();
        return;
      }
    }
  }

  function rotateCCW() {
    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;
    const newRot = (currentPiece.rotation + 3) % 4;
    const kicks = getWallKicks(currentPiece.type, currentPiece.rotation, newRot);
    for (const [dx, dy] of kicks) {
      if (isValidPosition(currentPiece.type, newRot, currentPiece.row - dy, currentPiece.col + dx)) {
        currentPiece.rotation = newRot;
        currentPiece.col += dx;
        currentPiece.row -= dy;
        render();
        return;
      }
    }
  }

  /* ---- Lock and Advance ---- */
  function lockAndAdvance() {
    const lockedRow = currentPiece.row;
    const lockedShape = getShape(currentPiece.type, currentPiece.rotation);

    lockPieceToBoard();
    currentPiece = null;

    /* Lock out: any filled cell above the visible playfield = game over */
    const lockedSize = lockedShape.length;
    for (let r = 0; r < lockedSize; ++r)
      for (let c = 0; c < lockedSize; ++c)
        if (lockedShape[r][c] && lockedRow + r < 0) {
          doGameOver();
          return;
        }

    const fullRows = findFullRows();
    if (fullRows.length > 0) {
      clearingRows = fullRows;
      clearAnimStart = performance.now();
      renderClearAnimation(fullRows);
      return;
    }

    advanceAfterClear(0);
  }

  function advanceAfterClear(linesCleared) {
    if (linesCleared > 0) {
      lines += linesCleared;
      addScore(linesCleared);
      updateLevel();
    }
    updateDisplays();

    if (!spawnPiece())
      return;

    lastDropTime = performance.now();
    render();
  }

  /* ---- Rendering ---- */
  function render() {
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c) {
        const idx = r * COLS + c;
        const val = board[r][c];
        if (val !== null)
          boardCells[idx].className = 'board-cell filled piece-' + val;
        else
          boardCells[idx].className = 'board-cell';
      }

    if (!currentPiece)
      return;

    /* Draw ghost piece */
    const ghostRow = getGhostRow();
    if (ghostRow !== currentPiece.row) {
      const shape = getShape(currentPiece.type, currentPiece.rotation);
      const color = getPieceColor(currentPiece.type);
      const size = shape.length;
      for (let r = 0; r < size; ++r)
        for (let c = 0; c < size; ++c) {
          if (!shape[r][c])
            continue;
          const br = ghostRow + r;
          const bc = currentPiece.col + c;
          if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
            const idx = br * COLS + bc;
            if (board[br][bc] === null)
              boardCells[idx].className = 'board-cell ghost piece-' + color;
          }
        }
    }

    /* Draw current piece */
    const shape = getShape(currentPiece.type, currentPiece.rotation);
    const color = getPieceColor(currentPiece.type);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = currentPiece.row + r;
        const bc = currentPiece.col + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
          const idx = br * COLS + bc;
          boardCells[idx].className = 'board-cell filled piece-' + color;
        }
      }
  }

  function renderPreview() {
    const shape = getShape(nextPieceType, 0);
    const size = shape.length;

    for (const cell of previewCells)
      cell.className = 'preview-cell';

    const offsetR = Math.floor((PREVIEW_SIZE - size) / 2);
    const offsetC = Math.floor((PREVIEW_SIZE - size) / 2);

    const color = getPieceColor(nextPieceType);
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const pr = offsetR + r;
        const pc = offsetC + c;
        if (pr >= 0 && pr < PREVIEW_SIZE && pc >= 0 && pc < PREVIEW_SIZE) {
          const idx = pr * PREVIEW_SIZE + pc;
          previewCells[idx].className = 'preview-cell filled piece-' + color;
        }
      }
  }

  function renderClearAnimation(rows) {
    for (const row of rows)
      for (let c = 0; c < COLS; ++c) {
        const idx = row * COLS + c;
        boardCells[idx].className = 'board-cell clearing';
      }
  }

  function updateDisplays() {
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    linesDisplay.textContent = lines;
  }

  /* ---- Game Over ---- */
  function doGameOver() {
    gameActive = false;
    gameOverFlag = true;
    render();
    finalScoreEl.textContent = 'Score: ' + score;
    gameOverOverlay.classList.add('visible');
    checkHighScore();
  }

  /* ---- Pause ---- */
  function togglePause() {
    if (!gameActive || gameOverFlag)
      return;
    gamePaused = !gamePaused;
    if (gamePaused) {
      pauseOverlay.classList.add('visible');
    } else {
      pauseOverlay.classList.remove('visible');
      lastDropTime = performance.now();
    }
  }

  /* ---- High Scores ---- */
  let highScores = [];

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        highScores = JSON.parse(raw);
      if (!Array.isArray(highScores))
        highScores = [];
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(highScores));
    } catch (_) {
      /* storage full or unavailable */
    }
  }

  function checkHighScore() {
    if (score <= 0)
      return;
    const entry = { score, lines, level };
    if (highScores.length < MAX_HIGH_SCORES || score > highScores[highScores.length - 1].score) {
      highScores.push(entry);
      highScores.sort((a, b) => b.score - a.score);
      if (highScores.length > MAX_HIGH_SCORES)
        highScores.length = MAX_HIGH_SCORES;
      saveHighScores();
    }
  }

  function resetHighScores() {
    highScores = [];
    saveHighScores();
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    body.innerHTML = '';
    if (highScores.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      for (let i = 0; i < highScores.length; ++i) {
        const e = highScores[i];
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.lines + '</td><td>' + e.level + '</td>';
        body.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        resetHighScores();
        showHighScores();
      }
    });
  }

  /* ---- Menu System ---- */
  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        newGame();
        break;
      case 'pause':
        togglePause();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  /* ---- Keyboard Input ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'Enter' && gameOverFlag) {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (!gameActive || gamePaused || gameOverFlag || clearingRows)
      return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveRight();
        break;
      case 'ArrowDown':
        e.preventDefault();
        softDrop();
        softDropping = true;
        break;
      case 'ArrowUp':
      case 'z':
      case 'Z':
        e.preventDefault();
        rotateCW();
        break;
      case 'x':
      case 'X':
        e.preventDefault();
        rotateCCW();
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown')
      softDropping = false;
  });

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    if (!gameActive || gamePaused || gameOverFlag)
      return;

    if (clearingRows) {
      if (timestamp - clearAnimStart >= 300) {
        const count = clearingRows.length;
        removeRows(clearingRows);
        clearingRows = null;
        clearAnimStart = 0;
        advanceAfterClear(count);
      }
      return;
    }

    if (!currentPiece)
      return;

    const interval = getDropInterval(level);
    if (timestamp - lastDropTime >= interval) {
      if (!moveDown())
        lockAndAdvance();
      lastDropTime = timestamp;
    }
  }

  /* ---- New Game ---- */
  function newGame() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    board = [];
    for (let r = 0; r < ROWS; ++r)
      board.push(new Array(COLS).fill(null));

    score = 0;
    level = 0;
    lines = 0;
    gameActive = true;
    gamePaused = false;
    gameOverFlag = false;
    clearingRows = null;
    clearAnimStart = 0;
    softDropping = false;
    bag = null;

    pauseOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');

    nextPieceType = nextFromBag();
    if (!spawnPiece())
      return;

    updateDisplays();
    render();
    renderPreview();

    lastDropTime = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ---- Window Resize ---- */
  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    buildBoard();
    buildPreview();
    loadHighScores();
    newGame();
    requestWindowResize();
  }

  init();

})();
