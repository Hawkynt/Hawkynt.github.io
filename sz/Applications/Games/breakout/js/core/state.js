/* S, the one shared mutable state object: the field dimensions, the run (state,
   score, lives, level), the entities, the power-up and combo bookkeeping, the
   high scores and the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;

  NS.state = NS.state || {
    /* ---- Mutable Field Dimensions ---- */
    currentField: C.FIELD_SMALL,
    CANVAS_W: C.FIELD_SMALL.w,
    CANVAS_H: C.FIELD_SMALL.h,
    BRICK_COLS: 10,
    BRICK_OFFSET_LEFT: (C.FIELD_SMALL.w - (10 * (C.BRICK_WIDTH + C.BRICK_PADDING) - C.BRICK_PADDING)) / 2,

    /* ---- Game State ---- */
    state: undefined,
    score: undefined,
    lives: undefined,
    level: undefined,
    paddle: undefined,
    balls: undefined,
    bricks: undefined,
    powerUps: undefined,
    activePowerUps: undefined,
    animFrameId: undefined,
    lastTime: undefined,
    simAccumulator: 0,
    keysDown: undefined,
    gameTime: 0,
    arcFrame: 0,
    comboCount: 0,
    comboTimer: 0,
    barrier: null,
    lasers: [],
    laserCooldown: 0,
    levelTransitionTimer: 0,
    levelTransitionPhase: 0,
    gameOverChainTimer: 0,
    gameOverChainIndex: 0,
    zenMode: false,

    /* ---- High Scores ---- */
    highScores: [],

    /* ---- Input: Mouse (pointer lock) ---- */
    pointerLocked: false
  };
})();
