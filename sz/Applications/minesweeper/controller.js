;(function() {
  'use strict';

  /* ---- Constants ---- */
  const DIFFICULTIES = {
    beginner:     { cols:  9, rows:  9, mines:  10 },
    intermediate: { cols: 16, rows: 16, mines:  40 },
    expert:       { cols: 30, rows: 16, mines:  99 }
  };

  const STORAGE_KEY = 'sz-minesweeper-best-times';

  const NUMBER_COLORS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];
  const MINE_CHAR = '\u{1F4A3}';
  const FLAG_CHAR = '\u{1F6A9}';
  const QUESTION_CHAR = '\u2753';
  const WRONG_MARK = '\u2716';

  const SMILEY_NORMAL  = '\u{1F60A}';
  const SMILEY_CLICK   = '\u{1F62E}';
  const SMILEY_WIN     = '\u{1F60E}';
  const SMILEY_LOSE    = '\u{1F480}';

  /* ---- State ---- */
  let difficulty = 'beginner';
  let cols, rows, mineCount;
  let grid;          // 2D: { mine, revealed, flagged, question, adjacent }
  let gameOver;
  let gameWon;
  let firstClick;
  let flagCount;
  let revealedCount;
  let timerValue;
  let timerInterval;
  let marksEnabled = true;
  let customConfig = null; // { cols, rows, mines } when custom is active

  const bestTimes = {
    beginner:     { time: 999, name: 'Anonymous' },
    intermediate: { time: 999, name: 'Anonymous' },
    expert:       { time: 999, name: 'Anonymous' }
  };

  /* ---- localStorage persistence ---- */
  function loadBestTimes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return;
      const saved = JSON.parse(raw);
      for (const key of ['beginner', 'intermediate', 'expert']) {
        if (saved[key] && typeof saved[key].time === 'number' && typeof saved[key].name === 'string') {
          bestTimes[key].time = saved[key].time;
          bestTimes[key].name = saved[key].name;
        }
      }
    } catch (_) {
      // ignore corrupt data
    }
  }

  function saveBestTimes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bestTimes));
    } catch (_) {
      // storage full or unavailable
    }
  }

  function resetBestTimes() {
    for (const key of ['beginner', 'intermediate', 'expert']) {
      bestTimes[key].time = 999;
      bestTimes[key].name = 'Anonymous';
    }
    saveBestTimes();
  }

  /* ---- DOM ---- */
  const minefield    = document.getElementById('minefield');
  const mineCounter  = document.getElementById('mineCounter');
  const timerDisplay = document.getElementById('timer');
  const smileyBtn    = document.getElementById('smileyBtn');

  /* ---- Menu System ---- */
  let openMenu = null;

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (e.target.closest('.menu-entry'))
        return;
      const dropdown = item.querySelector('.menu-dropdown');
      if (openMenu === dropdown) {
        closeMenus();
        return;
      }
      closeMenus();
      dropdown.classList.add('visible');
      item.classList.add('open');
      openMenu = dropdown;
    });

    item.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== item.querySelector('.menu-dropdown')) {
        closeMenus();
        const dropdown = item.querySelector('.menu-dropdown');
        dropdown.classList.add('visible');
        item.classList.add('open');
        openMenu = dropdown;
      }
    });
  });

  document.querySelectorAll('.menu-entry').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      closeMenus();
      handleMenuAction(action);
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.menu-bar'))
      closeMenus();
  });

  function closeMenus() {
    document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('visible'));
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('open'));
    openMenu = null;
  }

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        newGame();
        break;
      case 'beginner':
      case 'intermediate':
      case 'expert':
        customConfig = null;
        setDifficulty(action);
        break;
      case 'custom':
        showCustomDialog();
        break;
      case 'marks':
        toggleMarks();
        break;
      case 'best-times':
        showBestTimes();
        break;
      case 'about':
        showAboutDialog();
        break;
    }
  }

  function setDifficulty(level) {
    difficulty = level;
    updateDifficultyChecks();
    newGame();
    requestWindowResize();
  }

  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  }

  function updateDifficultyChecks() {
    const levels = ['beginner', 'intermediate', 'expert', 'custom'];
    levels.forEach(level => {
      const el = document.querySelector('.menu-entry[data-action="' + level + '"]');
      if (!el)
        return;
      if (level === 'custom')
        el.classList.toggle('checked', customConfig !== null);
      else
        el.classList.toggle('checked', difficulty === level && customConfig === null);
    });
  }

  /* ---- Marks (?) Toggle ---- */
  function toggleMarks() {
    marksEnabled = !marksEnabled;
    updateMarksCheck();
  }

  function updateMarksCheck() {
    const el = document.querySelector('.menu-entry[data-action="marks"]');
    if (el)
      el.classList.toggle('checked', marksEnabled);
  }

  /* ---- Best Times Dialog ---- */
  const bestTimesBackdrop = document.getElementById('bestTimesBackdrop');

  function showBestTimes() {
    document.getElementById('btBegTime').textContent = bestTimes.beginner.time + ' seconds';
    document.getElementById('btBegName').textContent = bestTimes.beginner.name;
    document.getElementById('btIntTime').textContent = bestTimes.intermediate.time + ' seconds';
    document.getElementById('btIntName').textContent = bestTimes.intermediate.name;
    document.getElementById('btExpTime').textContent = bestTimes.expert.time + ' seconds';
    document.getElementById('btExpName').textContent = bestTimes.expert.name;
    bestTimesBackdrop.classList.add('visible');
  }

  function closeBestTimes() {
    bestTimesBackdrop.classList.remove('visible');
  }

  bestTimesBackdrop.addEventListener('pointerdown', e => {
    if (e.target === bestTimesBackdrop)
      closeBestTimes();
  });
  bestTimesBackdrop.addEventListener('click', e => {
    const btn = e.target.closest('[data-result]');
    if (!btn)
      return;
    if (btn.dataset.result === 'reset') {
      resetBestTimes();
      showBestTimes();
    } else
      closeBestTimes();
  });

  /* ---- Custom Field Dialog ---- */
  const customBackdrop   = document.getElementById('customBackdrop');
  const customRowsInput  = document.getElementById('customRows');
  const customColsInput  = document.getElementById('customCols');
  const customMinesInput = document.getElementById('customMines');
  const customError      = document.getElementById('customError');

  function showCustomDialog() {
    if (customConfig) {
      customRowsInput.value = customConfig.rows;
      customColsInput.value = customConfig.cols;
      customMinesInput.value = customConfig.mines;
    }
    customError.textContent = '';
    customBackdrop.classList.add('visible');
    customRowsInput.focus();
  }

  function closeCustomDialog() {
    customBackdrop.classList.remove('visible');
  }

  function applyCustom() {
    const r = parseInt(customRowsInput.value, 10);
    const c = parseInt(customColsInput.value, 10);
    const m = parseInt(customMinesInput.value, 10);

    if (isNaN(r) || r < 9 || r > 24) {
      customError.textContent = 'Height must be between 9 and 24.';
      customRowsInput.focus();
      return;
    }
    if (isNaN(c) || c < 9 || c > 30) {
      customError.textContent = 'Width must be between 9 and 30.';
      customColsInput.focus();
      return;
    }
    if (isNaN(m) || m < 10 || m > 667) {
      customError.textContent = 'Mines must be between 10 and 667.';
      customMinesInput.focus();
      return;
    }

    const maxMines = r * c - 9;
    if (m >= maxMines) {
      customError.textContent = 'Mines must be less than ' + maxMines + ' (' + r + 'x' + c + ' - 9).';
      customMinesInput.focus();
      return;
    }

    customConfig = { rows: r, cols: c, mines: m };
    difficulty = 'custom';
    updateDifficultyChecks();
    closeCustomDialog();
    newGame();
    requestWindowResize();
  }

  customBackdrop.addEventListener('pointerdown', e => {
    if (e.target === customBackdrop)
      closeCustomDialog();
  });
  customBackdrop.addEventListener('click', e => {
    const btn = e.target.closest('[data-result]');
    if (!btn)
      return;
    if (btn.dataset.result === 'ok')
      applyCustom();
    else
      closeCustomDialog();
  });

  // Allow Enter key in custom dialog inputs
  [customRowsInput, customColsInput, customMinesInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustom();
      }
    });
  });

  /* ---- About Dialog ---- */
  function showAboutDialog() {
    const dlg = document.getElementById('dlg-about');
    if (dlg) dlg.classList.add('visible');
  }

  function closeAboutDialog() {
    const dlg = document.getElementById('dlg-about');
    if (dlg) dlg.classList.remove('visible');
  }

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
    }
    if (e.key === 'Escape') {
      closeBestTimes();
      closeCustomDialog();
      closeAboutDialog();
    }
  });

  /* ---- Smiley ---- */
  smileyBtn.addEventListener('click', () => newGame());

  function setSmiley(face) {
    smileyBtn.textContent = face;
  }

  /* ---- LED Display ---- */
  function formatLED(value) {
    const clamped = Math.max(-99, Math.min(999, value));
    if (clamped < 0)
      return '-' + String(Math.abs(clamped)).padStart(2, '0');
    return String(clamped).padStart(3, '0');
  }

  function updateMineCounter() {
    mineCounter.textContent = formatLED(mineCount - flagCount);
  }

  function updateTimer() {
    timerDisplay.textContent = formatLED(timerValue);
  }

  /* ---- Timer ---- */
  function startTimer() {
    if (timerInterval)
      return;
    timerInterval = setInterval(() => {
      if (timerValue < 999)
        ++timerValue;
      updateTimer();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /* ---- Grid Helpers ---- */
  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        if (dr === 0 && dc === 0)
          continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc))
          fn(nr, nc);
      }
  }

  /* ---- Mine Placement ---- */
  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (grid[r][c].mine)
        continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)
        continue;
      grid[r][c].mine = true;
      ++placed;
    }

    for (let r = 0; r < rows; ++r)
      for (let c = 0; c < cols; ++c) {
        let count = 0;
        forEachNeighbor(r, c, (nr, nc) => {
          if (grid[nr][nc].mine)
            ++count;
        });
        grid[r][c].adjacent = count;
      }
  }

  /* ---- Rendering ---- */
  function buildField() {
    minefield.innerHTML = '';
    minefield.style.gridTemplateColumns = 'repeat(' + cols + ', 16px)';
    minefield.style.gridTemplateRows = 'repeat(' + rows + ', 16px)';

    for (let r = 0; r < rows; ++r)
      for (let c = 0; c < cols; ++c) {
        const cell = document.createElement('div');
        cell.className = 'cell hidden';
        cell.dataset.r = r;
        cell.dataset.c = c;
        minefield.appendChild(cell);
        grid[r][c].el = cell;
      }
  }

  function renderCell(r, c) {
    const data = grid[r][c];
    const el = data.el;

    if (data.revealed) {
      el.className = 'cell revealed';
      if (data.mine) {
        el.className = data.hitMine ? 'cell mine-hit' : 'cell mine-shown';
        el.textContent = MINE_CHAR;
      } else if (data.adjacent > 0) {
        el.className = 'cell revealed ' + NUMBER_COLORS[data.adjacent];
        el.textContent = data.adjacent;
      } else {
        el.textContent = '';
      }
    } else if (data.wrongFlag) {
      el.className = 'cell mine-wrong';
      el.textContent = FLAG_CHAR + WRONG_MARK;
    } else if (data.flagged) {
      el.className = 'cell hidden flagged';
      el.textContent = FLAG_CHAR;
    } else if (data.question) {
      el.className = 'cell hidden question';
      el.textContent = QUESTION_CHAR;
    } else {
      el.className = 'cell hidden';
      el.textContent = '';
    }
  }

  /* ---- Reveal Logic ---- */
  function revealCell(r, c) {
    const data = grid[r][c];
    if (data.revealed || data.flagged)
      return;

    data.revealed = true;
    data.question = false;
    ++revealedCount;

    if (data.mine) {
      data.hitMine = true;
      renderCell(r, c);
      doGameOver(false);
      return;
    }

    renderCell(r, c);

    if (data.adjacent === 0)
      forEachNeighbor(r, c, (nr, nc) => revealCell(nr, nc));
  }

  function chordCell(r, c) {
    const data = grid[r][c];
    if (!data.revealed || data.adjacent === 0)
      return;

    let adjacentFlags = 0;
    forEachNeighbor(r, c, (nr, nc) => {
      if (grid[nr][nc].flagged)
        ++adjacentFlags;
    });

    if (adjacentFlags !== data.adjacent)
      return;

    forEachNeighbor(r, c, (nr, nc) => {
      if (!grid[nr][nc].revealed && !grid[nr][nc].flagged)
        revealCell(nr, nc);
    });
  }

  /* ---- Win / Lose ---- */
  function checkWin() {
    if (revealedCount === rows * cols - mineCount) {
      doGameOver(true);
      return true;
    }
    return false;
  }

  function doGameOver(won) {
    gameOver = true;
    gameWon = won;
    stopTimer();

    if (won) {
      setSmiley(SMILEY_WIN);
      // Auto-flag remaining mines
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c)
          if (grid[r][c].mine && !grid[r][c].flagged) {
            grid[r][c].flagged = true;
            ++flagCount;
            renderCell(r, c);
          }
      updateMineCounter();

      // Only track best times for standard difficulties
      if (difficulty !== 'custom' && bestTimes[difficulty] && timerValue < bestTimes[difficulty].time) {
        bestTimes[difficulty].time = timerValue;
        const name = prompt('You have the fastest time for ' + difficulty + ' level.\nPlease enter your name:', 'Anonymous');
        bestTimes[difficulty].name = name || 'Anonymous';
        saveBestTimes();
      }
    } else {
      setSmiley(SMILEY_LOSE);
      // Reveal all mines, mark wrong flags
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const d = grid[r][c];
          if (d.mine && !d.revealed && !d.flagged) {
            d.revealed = true;
            renderCell(r, c);
          } else if (d.flagged && !d.mine) {
            d.flagged = false;
            d.wrongFlag = true;
            renderCell(r, c);
          }
        }
    }
  }

  /* ---- Pointer Handling ---- */
  let leftDown = false;
  let rightDown = false;
  let bothDown = false;

  minefield.addEventListener('contextmenu', e => e.preventDefault());

  minefield.addEventListener('pointerdown', e => {
    if (gameOver)
      return;

    const cell = e.target.closest('.cell');
    if (!cell)
      return;

    if (e.button === 0) {
      leftDown = true;
      if (rightDown)
        bothDown = true;
    }
    if (e.button === 2) {
      rightDown = true;
      if (leftDown)
        bothDown = true;
    }
    if (e.button === 1)
      bothDown = true;

    if ((e.button === 0 && !bothDown) || bothDown)
      setSmiley(SMILEY_CLICK);

    if (e.button === 2 && !leftDown) {
      const r = +cell.dataset.r;
      const c = +cell.dataset.c;
      const data = grid[r][c];
      if (!data.revealed) {
        if (!data.flagged && !data.question) {
          data.flagged = true;
          ++flagCount;
        } else if (data.flagged) {
          data.flagged = false;
          --flagCount;
          if (marksEnabled)
            data.question = true;
        } else {
          data.question = false;
        }
        renderCell(r, c);
        updateMineCounter();
      }
    }
  });

  minefield.addEventListener('pointerup', e => {
    if (gameOver) {
      leftDown = false;
      rightDown = false;
      bothDown = false;
      return;
    }

    const cell = e.target.closest('.cell');
    if (!cell) {
      leftDown = false;
      rightDown = false;
      bothDown = false;
      setSmiley(SMILEY_NORMAL);
      return;
    }

    const r = +cell.dataset.r;
    const c = +cell.dataset.c;

    if (bothDown) {
      // Chord action on release of either button
      if (e.button === 0)
        leftDown = false;
      if (e.button === 2)
        rightDown = false;
      if (e.button === 1 || !leftDown || !rightDown) {
        bothDown = false;
        leftDown = false;
        rightDown = false;

        if (firstClick) {
          placeMines(r, c);
          firstClick = false;
          startTimer();
        }

        chordCell(r, c);
        if (!gameOver) {
          checkWin();
          setSmiley(gameOver ? (gameWon ? SMILEY_WIN : SMILEY_LOSE) : SMILEY_NORMAL);
        }
      }
      return;
    }

    if (e.button === 0) {
      leftDown = false;
      const data = grid[r][c];
      if (!data.flagged && !data.question && !data.revealed) {
        if (firstClick) {
          placeMines(r, c);
          firstClick = false;
          startTimer();
        }
        revealCell(r, c);
        if (!gameOver)
          checkWin();
      }
      if (!gameOver)
        setSmiley(SMILEY_NORMAL);
    }

    if (e.button === 2)
      rightDown = false;

    if (!leftDown && !rightDown && !gameOver)
      setSmiley(SMILEY_NORMAL);
  });

  minefield.addEventListener('pointerleave', () => {
    if (!gameOver)
      setSmiley(SMILEY_NORMAL);
  });

  /* ---- New Game ---- */
  function newGame() {
    stopTimer();

    let cfg;
    if (customConfig)
      cfg = customConfig;
    else
      cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.beginner;

    cols = cfg.cols;
    rows = cfg.rows;
    mineCount = cfg.mines;

    grid = [];
    for (let r = 0; r < rows; ++r) {
      grid[r] = [];
      for (let c = 0; c < cols; ++c)
        grid[r][c] = {
          mine: false,
          revealed: false,
          flagged: false,
          question: false,
          wrongFlag: false,
          hitMine: false,
          adjacent: 0,
          el: null
        };
    }

    gameOver = false;
    gameWon = false;
    firstClick = true;
    flagCount = 0;
    revealedCount = 0;
    timerValue = 0;
    leftDown = false;
    rightDown = false;
    bothDown = false;

    setSmiley(SMILEY_NORMAL);
    updateMineCounter();
    updateTimer();
    buildField();
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    loadBestTimes();
    updateDifficultyChecks();
    updateMarksCheck();
    newGame();
    requestWindowResize();
  }

  init();

  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });

})();
