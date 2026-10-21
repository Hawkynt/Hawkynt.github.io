/* The new-game reset: timers, effects, visual state, grid and field rebuild. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const SC = NS.scale;
  const LED = NS.led;
  const SM = NS.smiley;
  const TI = NS.timer;
  const F = NS.field;
  const IN = NS.input;
  const G = NS.game;

  /* ---- New Game ---- */
  G.newGame = function newGame() {
    TI.stopTimer();
    IN.cancelTouchPress();

    // Cancel in-flight mine reveal timeouts (also covers aftermath + skull phase timers)
    for (const tid of S.mineRevealTimeouts)
      clearTimeout(tid);
    S.mineRevealTimeouts = [];

    // Cancel in-flight flash
    if (S.flashAnimId) {
      cancelAnimationFrame(S.flashAnimId);
      S.flashAnimId = null;
      D.flashOverlay.style.display = 'none';
    }

    // Clear canvas effects
    if (S.particles)
      S.particles.clear();
    S.effectsRunning = false;

    // Remove effects canvas (recreated on demand)
    if (S.effectsCanvas) {
      S.effectsCanvas.remove();
      S.effectsCanvas = null;
      S.effectsCtx = null;
    }

    // Remove visual state from previous game
    const fieldBorder = document.querySelector('.field-border');
    if (fieldBorder)
      fieldBorder.classList.remove('mine-shake');

    D.minefield.classList.remove('board-darkened');

    // Clean up smiley animation state
    D.smileyBtn.classList.remove('skull-pulse', 'smiley-shrink-away', 'smiley-skull-grow', 'victory-bounce');

    // Remove mine-hit-glow from any cells
    D.minefield.querySelectorAll('.mine-hit-glow').forEach(el => el.classList.remove('mine-hit-glow'));

    let cfg;
    if (S.customConfig)
      cfg = S.customConfig;
    else
      cfg = C.DIFFICULTIES[S.difficulty] || C.DIFFICULTIES.beginner;

    S.cols = cfg.cols;
    S.rows = cfg.rows;
    S.mineCount = cfg.mines;

    // Set difficulty theme
    S.currentTheme = T.getThemeForDifficulty(S.difficulty);
    D.gameFrame.dataset.theme = S.currentTheme;

    S.grid = [];
    for (let r = 0; r < S.rows; ++r) {
      S.grid[r] = [];
      for (let c = 0; c < S.cols; ++c)
        S.grid[r][c] = {
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

    S.gameOver = false;
    S.gameWon = false;
    S.firstClick = true;
    S.gameStarted = false;
    S.flagCount = 0;
    S.revealedCount = 0;
    S.timerValue = 0;
    S.leftDown = false;
    S.rightDown = false;
    S.bothDown = false;

    SM.setSmiley(C.FACE_NORMAL);
    LED.updateMineCounter();
    LED.updateTimer();
    F.buildField();
    requestAnimationFrame(() => SC.fitGameToWrapper());
  };
})();
