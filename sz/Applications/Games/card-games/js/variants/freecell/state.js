;(function() {
  'use strict';

  /* FreeCell: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.freecell = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const CARD_GAP = 14;
  const FACE_UP_OFFSET = 22;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FREECELL_COUNT = 4;
  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 8;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 450;

  const TOP_ROW_Y = MARGIN_Y;
  const TABLEAU_TOP = TOP_ROW_Y + CARD_H + 16;
  const MAX_UNDO = 500;

  /* ================================================================
   *  GAME STATE (module-scoped)
   * ================================================================ */

  V.S = {
    freeCells: [null, null, null, null],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], [], []],
    gameNumber: 1,
    moveCount: 0,
    timerSeconds: 0,
    timerInterval: null,
    gameStarted: false,
    gameWon: false,
    undoHistory: [],

    selection: null,
    dragging: null,

    winAnimCards: [],
    winAnimRunning: false,
    winAnimId: null,
    particles: [],
    lastFireworkTime: 0,

    animatingCards: [],

    dealAnimCards: [],
    dealAnimRunning: false,

    _ctx: null,
    _canvas: null,
    _host: null,
    canvasW: 900,
    canvasH: 600,
    scale: 1,

    lastClickTime: 0,
    lastClickHit: null,

    pointerStartX: 0,
    pointerStartY: 0,

    /* ================================================================
     *  POINTER ID TRACKING
     * ================================================================ */
    _lastPointerId: 0
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, CARD_GAP, FACE_UP_OFFSET, MARGIN_X, PILE_GAP, FREECELL_COUNT,
    FOUNDATION_COUNT, TABLEAU_COUNT, BASE_W, BASE_H, TOP_ROW_Y, TABLEAU_TOP, MAX_UNDO
  });

})();
