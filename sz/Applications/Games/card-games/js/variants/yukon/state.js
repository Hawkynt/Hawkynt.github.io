;(function() {
  'use strict';

  /* Yukon: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.yukon = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const CARD_GAP = 14;
  const FACE_DOWN_OFFSET = 15;
  const FACE_UP_OFFSET = 25;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 7;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 500;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const MAX_UNDO = 100;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    moveCount: 0,
    score: 0,
    timerSeconds: 0,
    timerInterval: null,
    gameStarted: false,
    gameWon: false,
    roundOver: false,
    gameOver: false,
    undoHistory: [],

    winAnimCards: [],
    winAnimRunning: false,
    winAnimId: null,
    particles: [],
    lastFireworkTime: 0,

    animatingCards: [],
    flippingCards: [],

    dragging: null,

    lastClickTime: 0,
    lastClickHit: null,
    pointerStartX: 0,
    pointerStartY: 0,

    _ctx: null,
    _canvas: null,
    _host: null,
    _W: CANVAS_W,
    _H: CANVAS_H,
    scale: 1,
    canvasW: BASE_W,
    canvasH: BASE_H,

    statusMsg: '',

    winLaunchInterval: null
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, FACE_DOWN_OFFSET, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, PILE_GAP,
    FOUNDATION_COUNT, TABLEAU_COUNT, BASE_W, BASE_H, MAX_UNDO
  });

})();
