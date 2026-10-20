/* S, the one shared mutable state object: the grid, the run's state/score/lives/level,
   the player, the enemies, the level bookkeeping, the boulder animation maps, the input
   bookkeeping and the tutorial page. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;

  NS.state = NS.state || {
    /* ── Game state ── */
    grid: [],
    state: C.STATE_READY,
    score: 0,
    lives: C.MAX_LIVES,
    currentLevel: 1,
    highScores: [],

    /* Player */
    player: { col: 1, row: 1, targetCol: 1, targetRow: 1, moveProgress: 1, alive: true },

    /* Enemies */
    enemies: [],

    /* Level */
    gemsCollected: 0,
    gemsRequired: 0,
    exitOpen: false,
    exitCol: 0,
    exitRow: 0,
    timeLeft: 0,
    TIME_LIMIT: 150,

    /* Boulder physics */
    fallingBoulders: new Map(),
    lastBoulderThud: 0,
    slidingBoulders: new Map(),
    fadingCells: [],

    /* Input */
    keysDown: {},
    moveQueue: null,

    /* ── Mouse state for click-to-move ── */
    mouseHeld: false,
    mouseCol: -1,
    mouseRow: -1,

    /* ── Tutorial ── */
    tutorialSeen: false,
    showTutorial: false,
    tutorialPage: 0,

    /* ── Game loop ── */
    lastTime: 0
  };
})();
