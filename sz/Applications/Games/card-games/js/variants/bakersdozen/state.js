;(function() {
  'use strict';

  /* Baker's Dozen: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.bakersdozen = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const FACE_UP_OFFSET = 20;
  const MARGIN_X = 6;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 13;
  const FOUNDATION_COUNT = 4;
  const CARDS_PER_COLUMN = 4;

  const COL_GAP = Math.floor((900 - MARGIN_X * 2 - TABLEAU_COUNT * CARD_W) / (TABLEAU_COUNT - 1));
  const PILE_GAP = CARD_W + COL_GAP;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 480;

  const FOUNDATION_GAP = 12;
  const FOUNDATION_TOTAL_W = FOUNDATION_COUNT * CARD_W + (FOUNDATION_COUNT - 1) * FOUNDATION_GAP;

  const TABLEAU_TOP = MARGIN_Y + CARD_H + 18;
  const MAX_UNDO = 200;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    foundations: [[], [], [], []],
    tableau: [],
    moveCount: 0,
    score: 0,
    timerSeconds: 0,
    timerInterval: null,
    gameStarted: false,
    gameWon: false,
    undoHistory: [],

    winAnimCards: [],
    winAnimRunning: false,
    winAnimId: null,
    particles: [],
    lastFireworkTime: 0,

    animatingCards: [],
    dealAnimCards: [],
    dealAnimRunning: false,

    dragging: null,
    selection: null,

    lastClickTime: 0,
    lastClickHit: null,
    pointerStartX: 0,
    pointerStartY: 0,

    _ctx: null,
    _canvas: null,
    _host: null,
    canvasW: 900,
    canvasH: 600,
    scale: 1,

    /* ================================================================
     *  POINTER ID TRACKING
     * ================================================================ */
    _lastPointerId: 0
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, TABLEAU_COUNT, FOUNDATION_COUNT,
    PILE_GAP, BASE_W, BASE_H, FOUNDATION_GAP, FOUNDATION_TOTAL_W, TABLEAU_TOP, MAX_UNDO
  });

})();
