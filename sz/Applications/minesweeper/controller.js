;(function() {
  'use strict';

  /* ---- Constants ---- */
  const DIFFICULTIES = {
    beginner:     { cols:  9, rows:  9, mines:  10 },
    intermediate: { cols: 16, rows: 16, mines:  40 },
    expert:       { cols: 30, rows: 16, mines:  99 }
  };

  const STORAGE_KEY = 'sz-minesweeper-best-times';
  const STATS_KEY = 'sz-minesweeper-stats';
  const NUMBER_COLORS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];

  const FACE_NORMAL = 'normal';
  const FACE_CLICK  = 'click';
  const FACE_WIN    = 'win';
  const FACE_DEAD   = 'dead';

  /* ---- Difficulty Themes ---- */
  const THEME_CONFIG = {
    meadow:  { particles: ['#6a4', '#8c6', '#ff0', '#fa0'], confetti: ['#6a4', '#8c6', '#4a2', '#ff0', '#fa0', '#f80'] },
    steel:   { particles: ['#6cf', '#adf', '#fff', '#8af'], confetti: ['#6cf', '#adf', '#8af', '#fff', '#68a', '#4af'] },
    inferno: { particles: ['#f44', '#f80', '#ff0', '#fa0'], confetti: ['#f44', '#f80', '#ff0', '#fa0', '#f00', '#ff6'] },
    neutral: { particles: ['#f44', '#f80', '#ff0', '#fa0', '#f00', '#fff'], confetti: ['#f44', '#4af', '#fa0', '#4f4', '#f4f', '#ff0'] }
  };

  function getThemeForDifficulty(diff) {
    if (diff === 'beginner') return 'meadow';
    if (diff === 'intermediate') return 'steel';
    if (diff === 'expert') return 'inferno';
    return 'neutral';
  }

  /* ---- SVG Icons ---- */
  const SVG_ICONS = {
    mine: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
      <defs><radialGradient id='mg' cx='35%' cy='35%' r='55%'>
        <stop offset='0%' stop-color='#555'/><stop offset='100%' stop-color='#000'/>
      </radialGradient></defs>
      <circle cx='8' cy='8' r='4.5' fill='url(#mg)'/>
      <line x1='8' y1='1.5' x2='8' y2='3.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='8' y1='12.5' x2='8' y2='14.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='1.5' y1='8' x2='3.5' y2='8' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='12.5' y1='8' x2='14.5' y2='8' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='3.4' y1='3.4' x2='5' y2='5' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='11' y1='5' x2='12.6' y2='3.4' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='3.4' y1='12.6' x2='5' y2='11' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <line x1='11' y1='11' x2='12.6' y2='12.6' stroke='#000' stroke-width='1.2' stroke-linecap='round'/>
      <circle cx='6' cy='6.2' r='1.8' fill='rgba(255,255,255,0.4)'/>
    </svg>`,
    flag: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
      <defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#f44'/><stop offset='100%' stop-color='#c00'/>
      </linearGradient></defs>
      <polygon points='4,2 4,9.5 11,5.75' fill='url(#fg)'/>
      <rect x='3' y='2' width='1.5' height='10' rx='0.3' fill='#000'/>
      <rect x='1.5' y='12' width='6' height='1.2' rx='0.3' fill='#000'/>
      <rect x='0.5' y='13.2' width='8' height='1.3' rx='0.3' fill='#000'/>
    </svg>`,
    faceNormal: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <circle cx='9' cy='10' r='1.8' fill='#000'/>
      <circle cx='17' cy='10' r='1.8' fill='#000'/>
      <path d='M8 16 Q13 21 18 16' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceClick: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <circle cx='9' cy='10' r='1.8' fill='#000'/>
      <circle cx='17' cy='10' r='1.8' fill='#000'/>
      <circle cx='13' cy='17' r='2.5' fill='none' stroke='#000' stroke-width='1.5'/>
    </svg>`,
    faceWin: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <rect x='5' y='8.5' width='7' height='4' rx='1.5' fill='#000'/>
      <rect x='14' y='8.5' width='7' height='4' rx='1.5' fill='#000'/>
      <rect x='11.5' y='9.5' width='3' height='2' fill='#000'/>
      <path d='M8 17 Q13 22 18 17' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceDead: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='11' fill='#ff0' stroke='#000' stroke-width='1.5'/>
      <line x1='6.5' y1='7.5' x2='11.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='11.5' y1='7.5' x2='6.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='14.5' y1='7.5' x2='19.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <line x1='19.5' y1='7.5' x2='14.5' y2='12.5' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
      <path d='M8 19 Q13 15 18 19' fill='none' stroke='#000' stroke-width='1.5' stroke-linecap='round'/>
    </svg>`,
    faceSkull: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'>
      <defs><radialGradient id='sg' cx='50%' cy='40%' r='50%'>
        <stop offset='0%' stop-color='#fff'/><stop offset='100%' stop-color='#e0d5c8'/>
      </radialGradient></defs>
      <ellipse cx='13' cy='11' rx='9' ry='8.5' fill='url(#sg)' stroke='#555' stroke-width='1'/>
      <ellipse cx='9.5' cy='10' rx='2.5' ry='2.8' fill='#1a1a1a'/>
      <ellipse cx='16.5' cy='10' rx='2.5' ry='2.8' fill='#1a1a1a'/>
      <path d='M12 14.5 L14 14.5 L13 16.5 Z' fill='#333'/>
      <rect x='7' y='17.5' width='12' height='3.5' rx='1' fill='url(#sg)' stroke='#555' stroke-width='0.8'/>
      <line x1='9' y1='17.5' x2='9' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='11' y1='17.5' x2='11' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='13' y1='17.5' x2='13' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='15' y1='17.5' x2='15' y2='21' stroke='#888' stroke-width='0.5'/>
      <line x1='17' y1='17.5' x2='17' y2='21' stroke='#888' stroke-width='0.5'/>
      <path d='M10 3.5 L11.5 6.5 L10 8.5' fill='none' stroke='#aaa' stroke-width='0.6'/>
    </svg>`
  };

  function svgToDataUri(svg) {
    return 'url("data:image/svg+xml,' + svg
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/#/g, '%23')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
      .replace(/"/g, "'") + '")';
  }

  function injectIcons() {
    const root = document.documentElement.style;
    root.setProperty('--icon-mine', svgToDataUri(SVG_ICONS.mine));
    root.setProperty('--icon-flag', svgToDataUri(SVG_ICONS.flag));
    root.setProperty('--face-normal', svgToDataUri(SVG_ICONS.faceNormal));
    root.setProperty('--face-click', svgToDataUri(SVG_ICONS.faceClick));
    root.setProperty('--face-win', svgToDataUri(SVG_ICONS.faceWin));
    root.setProperty('--face-dead', svgToDataUri(SVG_ICONS.faceDead));
    root.setProperty('--face-skull', svgToDataUri(SVG_ICONS.faceSkull));
  }

  /* ---- State ---- */
  let difficulty = 'beginner';
  let cols, rows, mineCount;
  let grid;          // 2D: { mine, revealed, flagged, question, adjacent }
  let gameOver;
  let gameWon;
  let firstClick;
  let gameStarted;
  let flagCount;
  let revealedCount;
  let timerValue;
  let timerInterval;
  let marksEnabled = true;
  let customConfig = null;
  let mineRevealTimeouts = [];
  let flashAnimId = null;
  let currentTheme = 'neutral';

  /* ---- Canvas Effects State ---- */
  let effectsCanvas = null;
  let effectsCtx = null;
  let particles = null;
  let shake = null;
  let effectsRunning = false;

  const bestTimes = {
    beginner:     { time: 999, name: 'Anonymous' },
    intermediate: { time: 999, name: 'Anonymous' },
    expert:       { time: 999, name: 'Anonymous' }
  };

  const defaultStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0 });
  const stats = {
    beginner:     defaultStats(),
    intermediate: defaultStats(),
    expert:       defaultStats()
  };

  /* ---- localStorage persistence ---- */
  function loadBestTimes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return;
      const saved = JSON.parse(raw);
      for (const key of ['beginner', 'intermediate', 'expert'])
        if (saved[key] && typeof saved[key].time === 'number' && typeof saved[key].name === 'string') {
          bestTimes[key].time = saved[key].time;
          bestTimes[key].name = saved[key].name;
        }
    } catch (_) {
      // ignore corrupt data
    }
  }

  function saveBestTimes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bestTimes));
    } catch (_) {}
  }

  function resetBestTimes() {
    for (const key of ['beginner', 'intermediate', 'expert']) {
      bestTimes[key].time = 999;
      bestTimes[key].name = 'Anonymous';
    }
    saveBestTimes();
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw)
        return;
      const saved = JSON.parse(raw);
      for (const key of ['beginner', 'intermediate', 'expert'])
        if (saved[key]) {
          stats[key].played = saved[key].played || 0;
          stats[key].won = saved[key].won || 0;
          stats[key].streak = saved[key].streak || 0;
          stats[key].bestStreak = saved[key].bestStreak || 0;
        }
    } catch (_) {}
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (_) {}
  }

  function resetStats() {
    for (const key of ['beginner', 'intermediate', 'expert']) {
      stats[key].played = 0;
      stats[key].won = 0;
      stats[key].streak = 0;
      stats[key].bestStreak = 0;
    }
    saveStats();
  }

  function recordGameResult(won) {
    if (difficulty === 'custom' || !stats[difficulty])
      return;
    const s = stats[difficulty];
    ++s.played;
    if (won) {
      ++s.won;
      ++s.streak;
      if (s.streak > s.bestStreak)
        s.bestStreak = s.streak;
    } else {
      s.streak = 0;
    }
    saveStats();
  }

  /* ---- DOM ---- */
  const minefield    = document.getElementById('minefield');
  const mineCounter  = document.getElementById('mineCounter');
  const timerDisplay = document.getElementById('timer');
  const smileyBtn    = document.getElementById('smileyBtn');
  const gameFrame    = document.getElementById('gameFrame');
  const scaleWrapper = document.getElementById('scaleWrapper');
  const flashOverlay = document.getElementById('flashOverlay');

  /* ---- Menu System ---- */
  new SZ.MenuBar({ onAction: handleMenuAction });

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
      case 'statistics':
        showStatsDialog();
        break;
      case 'exit':
        SZ.Dlls.User32.DestroyWindow();
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

  /* ---- Display Scaling ---- */
  function fitGameToWrapper() {
    const wrapW = scaleWrapper.clientWidth;
    const wrapH = scaleWrapper.clientHeight;
    if (wrapW <= 0 || wrapH <= 0)
      return;

    gameFrame.style.transform = '';
    const natW = gameFrame.offsetWidth;
    const natH = gameFrame.offsetHeight;
    if (natW <= 0 || natH <= 0)
      return;

    const scaleX = wrapW / natW;
    const scaleY = wrapH / natH;
    const scale = Math.min(scaleX, scaleY);
    gameFrame.style.transform = scale !== 1 ? 'scale(' + scale + ')' : '';
  }

  const _resizeObserver = new ResizeObserver(() => fitGameToWrapper());
  _resizeObserver.observe(scaleWrapper);

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
  function showBestTimes() {
    document.getElementById('btBegTime').textContent = bestTimes.beginner.time + ' seconds';
    document.getElementById('btBegName').textContent = bestTimes.beginner.name;
    document.getElementById('btIntTime').textContent = bestTimes.intermediate.time + ' seconds';
    document.getElementById('btIntName').textContent = bestTimes.intermediate.name;
    document.getElementById('btExpTime').textContent = bestTimes.expert.time + ' seconds';
    document.getElementById('btExpName').textContent = bestTimes.expert.name;
    SZ.Dialog.show('bestTimesBackdrop').then(result => {
      if (result === 'reset') {
        resetBestTimes();
        showBestTimes();
      }
    });
  }

  /* ---- Statistics Dialog ---- */
  function showStatsDialog() {
    const d = difficulty === 'custom' ? 'beginner' : difficulty;
    const s = stats[d] || defaultStats();
    const pct = s.played > 0 ? Math.round(s.won / s.played * 100) : 0;
    document.getElementById('statsDifficulty').textContent = d.charAt(0).toUpperCase() + d.slice(1);
    document.getElementById('statsPlayed').textContent = s.played;
    document.getElementById('statsWon').textContent = s.won;
    document.getElementById('statsWinPct').textContent = pct + '%';
    document.getElementById('statsStreak').textContent = s.streak;
    document.getElementById('statsBestStreak').textContent = s.bestStreak;
    SZ.Dialog.show('statsBackdrop').then(result => {
      if (result === 'reset') {
        resetStats();
        showStatsDialog();
      }
    });
  }

  /* ---- Custom Field Dialog ---- */
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
    SZ.Dialog.show('customBackdrop').then(result => {
      if (result === 'ok')
        applyCustom();
    });
    customRowsInput.focus();
  }

  function applyCustom() {
    const r = parseInt(customRowsInput.value, 10);
    const c = parseInt(customColsInput.value, 10);
    const m = parseInt(customMinesInput.value, 10);

    if (isNaN(r) || r < 9 || r > 24) {
      customError.textContent = 'Height must be between 9 and 24.';
      showCustomDialog();
      customRowsInput.focus();
      return;
    }
    if (isNaN(c) || c < 9 || c > 30) {
      customError.textContent = 'Width must be between 9 and 30.';
      showCustomDialog();
      customColsInput.focus();
      return;
    }
    if (isNaN(m) || m < 10 || m > 667) {
      customError.textContent = 'Mines must be between 10 and 667.';
      showCustomDialog();
      customMinesInput.focus();
      return;
    }

    const maxMines = r * c - 9;
    if (m >= maxMines) {
      customError.textContent = 'Mines must be less than ' + maxMines + ' (' + r + 'x' + c + ' - 9).';
      showCustomDialog();
      customMinesInput.focus();
      return;
    }

    customConfig = { rows: r, cols: c, mines: m };
    difficulty = 'custom';
    updateDifficultyChecks();
    newGame();
    requestWindowResize();
  }

  // Allow Enter key in custom dialog inputs
  [customRowsInput, customColsInput, customMinesInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        SZ.Dialog.close('customBackdrop');
        applyCustom();
      }
    });
  });

  /* ---- About Dialog ---- */
  function showAboutDialog() {
    SZ.Dialog.show('dlg-about');
  }

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
    }
    if (e.key === 'Escape') {
      SZ.Dialog.close('bestTimesBackdrop');
      SZ.Dialog.close('customBackdrop');
      SZ.Dialog.close('dlg-about');
      SZ.Dialog.close('statsBackdrop');
    }
  });

  /* ---- Smiley ---- */
  smileyBtn.addEventListener('click', () => {
    smileyBtn.classList.add('smiley-bounce');
    smileyBtn.addEventListener('animationend', function handler() {
      smileyBtn.classList.remove('smiley-bounce');
      smileyBtn.removeEventListener('animationend', handler);
    });
    newGame();
  });

  function setSmiley(face) {
    smileyBtn.dataset.face = face;
  }

  /* ---- Flash Overlay ---- */
  function screenFlash(color, duration) {
    if (flashAnimId)
      cancelAnimationFrame(flashAnimId);
    flashOverlay.style.background = color;
    flashOverlay.style.opacity = '0.5';
    flashOverlay.style.display = 'block';
    let start = null;
    const animate = (ts) => {
      if (!start)
        start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      flashOverlay.style.opacity = String(0.5 * (1 - progress));
      if (progress < 1)
        flashAnimId = requestAnimationFrame(animate);
      else {
        flashOverlay.style.display = 'none';
        flashAnimId = null;
      }
    };
    flashAnimId = requestAnimationFrame(animate);
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

  /* ---- Canvas Effects Layer ---- */
  function ensureEffectsCanvas() {
    const fieldBorder = document.querySelector('.field-border');
    const w = fieldBorder.offsetWidth;
    const h = fieldBorder.offsetHeight;

    if (!effectsCanvas || effectsCanvas.parentElement !== fieldBorder) {
      if (effectsCanvas)
        effectsCanvas.remove();
      effectsCanvas = document.createElement('canvas');
      effectsCanvas.className = 'effects-overlay';
      fieldBorder.appendChild(effectsCanvas);
    }

    if (effectsCanvas.width !== w || effectsCanvas.height !== h) {
      effectsCanvas.width = w;
      effectsCanvas.height = h;
    }

    effectsCtx = effectsCanvas.getContext('2d');

    if (!particles)
      particles = new SZ.GameEffects.ParticleSystem();
    if (!shake)
      shake = new SZ.GameEffects.ScreenShake();
  }

  function startEffectsLoop() {
    if (effectsRunning)
      return;
    effectsRunning = true;
    let lastTime = performance.now();
    const loop = (now) => {
      if (!effectsCanvas || !effectsCtx) {
        effectsRunning = false;
        return;
      }
      const dt = now - lastTime;
      lastTime = now;
      effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
      shake.update(dt);
      effectsCtx.save();
      shake.apply(effectsCtx);
      particles.update();
      particles.draw(effectsCtx);
      effectsCtx.restore();
      if (particles.count > 0 || shake.active)
        requestAnimationFrame(loop);
      else
        effectsRunning = false;
    };
    requestAnimationFrame(loop);
  }

  function getCellCenter(r, c) {
    return { x: c * 16 + 8, y: r * 16 + 8 };
  }

  function pickColor(palette) {
    return palette[Math.floor(Math.random() * palette.length)];
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
    el.textContent = '';

    if (data.revealed) {
      if (data.mine)
        el.className = data.hitMine ? 'cell mine-hit mine-icon' : 'cell mine-shown mine-icon';
      else if (data.adjacent > 0) {
        el.className = 'cell revealed ' + NUMBER_COLORS[data.adjacent];
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
  }

  /* ---- Reveal Logic ---- */
  let revealOriginR = -1;
  let revealOriginC = -1;

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

    if (revealOriginR >= 0) {
      const dist = Math.abs(r - revealOriginR) + Math.abs(c - revealOriginC);
      data.el.classList.add('revealing');
      data.el.style.animationDelay = (dist * 30) + 'ms';
      data.el.addEventListener('animationend', function handler() {
        data.el.classList.remove('revealing');
        data.el.style.animationDelay = '';
        data.el.removeEventListener('animationend', handler);
      });
    }

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

    if (gameStarted)
      recordGameResult(won);

    if (won) {
      setSmiley(FACE_WIN);

      // Auto-flag remaining mines
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c)
          if (grid[r][c].mine && !grid[r][c].flagged) {
            grid[r][c].flagged = true;
            ++flagCount;
            renderCell(r, c);
          }
      updateMineCounter();

      // Canvas confetti from 3 burst points
      ensureEffectsCanvas();
      const themeColors = THEME_CONFIG[currentTheme].confetti;
      const w = effectsCanvas.width;
      particles.confetti(w * 0.2, 0, 40, { colors: themeColors });
      particles.confetti(w * 0.5, 0, 40, { colors: themeColors });
      particles.confetti(w * 0.8, 0, 40, { colors: themeColors });
      startEffectsLoop();

      // Gold flash
      screenFlash('#ffd700', 600);

      // Victory bounce on smiley
      smileyBtn.classList.add('victory-bounce');
      smileyBtn.addEventListener('animationend', function handler() {
        smileyBtn.classList.remove('victory-bounce');
        smileyBtn.removeEventListener('animationend', handler);
      });

      // Best time check
      if (difficulty !== 'custom' && bestTimes[difficulty] && timerValue < bestTimes[difficulty].time) {
        bestTimes[difficulty].time = timerValue;
        const name = prompt('You have the fastest time for ' + difficulty + ' level.\nPlease enter your name:', 'Anonymous');
        bestTimes[difficulty].name = name || 'Anonymous';
        saveBestTimes();
      }
    } else {
      // ---- DEATH ANIMATION SEQUENCE ----
      const currentGrid = grid;
      const themeParticles = THEME_CONFIG[currentTheme].particles;

      // Phase 1: Impact
      setSmiley(FACE_DEAD);
      screenFlash('#f00', 400);

      // CSS screen shake on field border
      const fieldBorder = document.querySelector('.field-border');
      fieldBorder.classList.add('mine-shake');
      fieldBorder.addEventListener('animationend', function handler() {
        fieldBorder.classList.remove('mine-shake');
        fieldBorder.removeEventListener('animationend', handler);
      });

      // Find hit mine
      let hitR = -1;
      let hitC = -1;
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c)
          if (grid[r][c].hitMine) {
            hitR = r;
            hitC = c;
          }

      // Canvas: screen shake + large particle burst at hit mine
      ensureEffectsCanvas();
      shake.trigger(6, 400);
      if (hitR >= 0) {
        const center = getCellCenter(hitR, hitC);
        for (let i = 0; i < 30; ++i)
          particles.burst(center.x, center.y, 1, {
            speed: 6,
            color: pickColor(themeParticles),
            gravity: 0.1,
            life: 0.8 + Math.random() * 0.4,
            size: 2 + Math.random() * 4
          });
      }
      startEffectsLoop();

      // Phase 2: Chain detonation -- reveal mines outward with staggered particle bursts
      let maxDist = 0;
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const d = grid[r][c];
          if (d.mine && !d.revealed && !d.flagged) {
            d.revealed = true;
            const dist = hitR >= 0 ? Math.abs(r - hitR) + Math.abs(c - hitC) : 0;
            if (dist > maxDist)
              maxDist = dist;
            ((row, col, distance) => {
              const tid = setTimeout(() => {
                if (grid !== currentGrid)
                  return;
                renderCell(row, col);
                currentGrid[row][col].el.classList.add('mine-reveal-stagger');
                currentGrid[row][col].el.addEventListener('animationend', function handler() {
                  currentGrid[row][col].el.classList.remove('mine-reveal-stagger');
                  currentGrid[row][col].el.removeEventListener('animationend', handler);
                });
                // Canvas particle burst for each mine (8 particles)
                ensureEffectsCanvas();
                const center = getCellCenter(row, col);
                particles.burst(center.x, center.y, 8, {
                  speed: 3,
                  color: pickColor(themeParticles),
                  gravity: 0.08,
                  life: 0.5 + Math.random() * 0.3,
                  size: 1.5 + Math.random() * 2
                });
                startEffectsLoop();
              }, distance * 40);
              mineRevealTimeouts.push(tid);
            })(r, c, dist);
          } else if (d.flagged && !d.mine) {
            d.flagged = false;
            d.wrongFlag = true;
            renderCell(r, c);
          }
        }

      // Phase 3: Aftermath -- board darkens, hit mine glows
      const aftermathDelay = maxDist * 40 + 500;
      const darkTid = setTimeout(() => {
        if (grid !== currentGrid)
          return;
        minefield.classList.add('board-darkened');
        if (hitR >= 0 && currentGrid[hitR] && currentGrid[hitR][hitC] && currentGrid[hitR][hitC].el)
          currentGrid[hitR][hitC].el.classList.add('mine-hit-glow');
      }, aftermathDelay);
      mineRevealTimeouts.push(darkTid);

      // Phase 4: Skull transition -- smiley shrinks away, swaps to skull, grows back
      const skullDelay = aftermathDelay + 300;
      const skullTid = setTimeout(() => {
        if (grid !== currentGrid)
          return;
        smileyBtn.classList.add('smiley-shrink-away');
        const onShrinkEnd = () => {
          smileyBtn.classList.remove('smiley-shrink-away');
          smileyBtn.removeEventListener('animationend', onShrinkEnd);
          // Swap to skull at midpoint
          smileyBtn.dataset.face = 'skull';
          smileyBtn.classList.add('smiley-skull-grow');
          const onGrowEnd = () => {
            smileyBtn.classList.remove('smiley-skull-grow');
            smileyBtn.removeEventListener('animationend', onGrowEnd);
            // Phase 5: Skull pulses red indefinitely
            smileyBtn.classList.add('skull-pulse');
          };
          smileyBtn.addEventListener('animationend', onGrowEnd);
        };
        smileyBtn.addEventListener('animationend', onShrinkEnd);
      }, skullDelay);
      mineRevealTimeouts.push(skullTid);
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
      setSmiley(FACE_CLICK);

    if (e.button === 2 && !leftDown) {
      const r = +cell.dataset.r;
      const c = +cell.dataset.c;
      const data = grid[r][c];
      if (!data.revealed) {
        const wasFlagged = data.flagged;
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
        if (data.flagged && !wasFlagged) {
          data.el.classList.add('flag-placed');
          data.el.addEventListener('animationend', function handler() {
            data.el.classList.remove('flag-placed');
            data.el.removeEventListener('animationend', handler);
          });
        }
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
      setSmiley(FACE_NORMAL);
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
          gameStarted = true;
          startTimer();
        }

        revealOriginR = r;
        revealOriginC = c;
        chordCell(r, c);
        revealOriginR = -1;
        revealOriginC = -1;
        if (!gameOver) {
          checkWin();
          setSmiley(gameOver ? (gameWon ? FACE_WIN : FACE_DEAD) : FACE_NORMAL);
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
          gameStarted = true;
          startTimer();
        }
        revealOriginR = r;
        revealOriginC = c;
        revealCell(r, c);
        revealOriginR = -1;
        revealOriginC = -1;
        if (!gameOver)
          checkWin();
      }
      if (!gameOver)
        setSmiley(FACE_NORMAL);
    }

    if (e.button === 2)
      rightDown = false;

    if (!leftDown && !rightDown && !gameOver)
      setSmiley(FACE_NORMAL);
  });

  minefield.addEventListener('pointerleave', () => {
    if (!gameOver)
      setSmiley(FACE_NORMAL);
  });

  /* ---- New Game ---- */
  function newGame() {
    stopTimer();

    // Cancel in-flight mine reveal timeouts (also covers aftermath + skull phase timers)
    for (const tid of mineRevealTimeouts)
      clearTimeout(tid);
    mineRevealTimeouts = [];

    // Cancel in-flight flash
    if (flashAnimId) {
      cancelAnimationFrame(flashAnimId);
      flashAnimId = null;
      flashOverlay.style.display = 'none';
    }

    // Clear canvas effects
    if (particles)
      particles.clear();
    effectsRunning = false;

    // Remove effects canvas (recreated on demand)
    if (effectsCanvas) {
      effectsCanvas.remove();
      effectsCanvas = null;
      effectsCtx = null;
    }

    // Remove visual state from previous game
    const fieldBorder = document.querySelector('.field-border');
    if (fieldBorder)
      fieldBorder.classList.remove('mine-shake');

    minefield.classList.remove('board-darkened');

    // Clean up smiley animation state
    smileyBtn.classList.remove('skull-pulse', 'smiley-shrink-away', 'smiley-skull-grow', 'victory-bounce');

    // Remove mine-hit-glow from any cells
    minefield.querySelectorAll('.mine-hit-glow').forEach(el => el.classList.remove('mine-hit-glow'));

    let cfg;
    if (customConfig)
      cfg = customConfig;
    else
      cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.beginner;

    cols = cfg.cols;
    rows = cfg.rows;
    mineCount = cfg.mines;

    // Set difficulty theme
    currentTheme = getThemeForDifficulty(difficulty);
    gameFrame.dataset.theme = currentTheme;

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
    gameStarted = false;
    flagCount = 0;
    revealedCount = 0;
    timerValue = 0;
    leftDown = false;
    rightDown = false;
    bothDown = false;

    setSmiley(FACE_NORMAL);
    updateMineCounter();
    updateTimer();
    buildField();
    requestAnimationFrame(() => fitGameToWrapper());
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    injectIcons();
    loadBestTimes();
    loadStats();
    updateDifficultyChecks();
    updateMarksCheck();
    newGame();
    requestWindowResize();
  }

  init();

})();
