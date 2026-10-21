/* The one shared mutable state object every module reads and writes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state = NS.state || {};

  /* ---- State ---- */
  S.difficulty = 'beginner';
  S.cols = undefined;
  S.rows = undefined;
  S.mineCount = undefined;
  S.grid = undefined;          // 2D: { mine, revealed, flagged, question, adjacent }
  S.gameOver = undefined;
  S.gameWon = undefined;
  S.firstClick = undefined;
  S.gameStarted = undefined;
  S.flagCount = undefined;
  S.revealedCount = undefined;
  S.timerValue = undefined;
  S.timerInterval = undefined;
  S.marksEnabled = true;
  S.customConfig = null;
  S.mineRevealTimeouts = [];
  S.flashAnimId = null;
  S.currentTheme = 'neutral';

  /* ---- Canvas Effects State ---- */
  S.effectsCanvas = null;
  S.effectsCtx = null;
  S.particles = null;
  S.shake = null;
  S.effectsRunning = false;

  S.bestTimes = {
    beginner:     { time: 999, name: 'Anonymous' },
    intermediate: { time: 999, name: 'Anonymous' },
    expert:       { time: 999, name: 'Anonymous' }
  };

  S.defaultStats = () => ({ played: 0, won: 0, streak: 0, bestStreak: 0 });
  S.stats = {
    beginner:     S.defaultStats(),
    intermediate: S.defaultStats(),
    expert:       S.defaultStats()
  };

  /* ---- Reveal origin (staggered reveal animation) ---- */
  S.revealOriginR = -1;
  S.revealOriginC = -1;

  /* ---- Pointer state ---- */
  S.leftDown = false;
  S.rightDown = false;
  S.bothDown = false;
  S.touchPress = null;
})();
