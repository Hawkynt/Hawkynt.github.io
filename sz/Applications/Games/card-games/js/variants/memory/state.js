/* Memory: layout constants and the one state object of the variant (SZ.CardGames.v.memory). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
   *  GRID LAYOUT
   * ================================================================ */

  const COLS = 6;
  const ROWS = 4;
  const TOTAL_PAIRS = (COLS * ROWS) / 2; // 12
  const GAP_X = 12;
  const GAP_Y = 12;
  const GRID_W = COLS * CE.CARD_W + (COLS - 1) * GAP_X;
  const GRID_H = ROWS * CE.CARD_H + (ROWS - 1) * GAP_Y;
  const GRID_X = (CANVAS_W - GRID_W) / 2;
  const GRID_Y = (CANVAS_H - GRID_H) / 2 + 20;

  /* ── Flip animation state per card ── */
  // Each card gets: flipProgress (0..1), flipDirection ('up'|'down'|null),
  // flipStart (timestamp)
  const FLIP_DURATION = 250; // ms

  /* ── Fade-out for matched pairs ── */
  const FADE_DURATION = 400; // ms

  /* ── New Game button ── */
  const NEW_GAME_BTN = { x: CANVAS_W / 2 - 60, y: CANVAS_H / 2 + 60, w: 120, h: 40 };

  const S = V.S = {
    /* ================================================================
     *  GAME STATE
     * ================================================================ */
    cards: [],         // flat array of 24 card objects
    firstPick: -1,     // index of first flipped card (-1 = none)
    secondPick: -1,    // index of second flipped card (-1 = none)
    flipLockTimer: 0,  // countdown (ms) before unmatched pair flips back
    moves: 0,          // total attempts (each pair reveal = 1 move)
    matchesFound: 0,
    score: 200,
    roundOver: false,
    gameOver: false,
    dealAnimActive: false,
    dealAnimCards: [],
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, COLS, TOTAL_PAIRS, GAP_X, GAP_Y, GRID_X, GRID_Y,
    FLIP_DURATION, FADE_DURATION, NEW_GAME_BTN });

})();
