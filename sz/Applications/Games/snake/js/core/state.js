/* S, the one shared mutable state object: the game configuration and canvas
   geometry, the player snake and its input queue, the food and power-up, the run's
   score/level/foods and flags, the timings, the obstacles and AI snakes, the theme
   decorations, the high scores and the mouse-steering bookkeeping. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;

  NS.state = NS.state || {
    /* ---- Game Config ---- */
    gameConfig: { ...C.DEFAULT_CONFIG },
    cols: undefined,
    rows: undefined,
    canvasW: undefined,
    canvasH: undefined,
    dpr: undefined,

    /* ---- State ---- */
    snake: undefined,
    prevSnake: undefined,
    direction: undefined,
    nextDirection: undefined,
    inputQueue: undefined,
    food: undefined,
    score: undefined,
    level: undefined,
    foodsEaten: undefined,
    gameActive: undefined,
    gamePaused: undefined,
    gameOverFlag: undefined,
    waitingToStart: undefined,
    lastMoveTime: undefined,
    animFrameId: undefined,
    lastTimestamp: undefined,
    lerpT: undefined,
    pausedForDialog: undefined,
    obstacles: undefined,
    aiSnakes: undefined,
    fieldPowerup: undefined,
    activePowerups: undefined,
    lastPowerupTime: undefined,
    dialogGen: undefined,
    pendingVisualTheme: undefined,
    zenLeaves: undefined,
    mazeBrickCanvas: undefined,

    /* ---- High Scores ---- */
    highScores: [],

    /* ---- Mouse / Touch controls ---- */
    mouseCanvasX: -1,
    mouseCanvasY: -1,
    mouseControlActive: false
  };
})();
