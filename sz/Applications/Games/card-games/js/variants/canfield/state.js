;(function() {
  'use strict';

  /* Canfield: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.canfield = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const CARD_GAP = 14;
  const FACE_UP_OFFSET = 25;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 4;
  const RESERVE_SIZE = 13;

  const BASE_W = MARGIN_X * 2 + 6 * PILE_GAP + CARD_W;
  const BASE_H = 460;
  const MAX_UNDO = 200;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    stock: [],
    waste: [],
    reserve: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], []],
    baseRank: -1, // value (0-12) of the foundation starter rank
    moveCount: 0,
    score: 0,
    timerSeconds: 0,
    timerInterval: null,
    gameStarted: false,
    gameWon: false,
    roundOver: false,
    gameOver: false,
    undoHistory: [],

    animatingCards: [],
    flippingCards: [],
    dealAnimCards: [],
    winAnimCards: [],
    winAnimRunning: false,
    winAnimId: null,
    particles: [],
    lastFireworkTime: 0,
    winLaunchInterval: null,

    dragging: null,
    lastClickTime: 0,
    lastClickHit: null,
    pointerStartX: 0,
    pointerStartY: 0,

    statusMsg: '',

    _ctx: null,
    _canvas: null,
    _host: null,
    canvasW: 900,
    canvasH: 600,
    scale: 1
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, PILE_GAP, FOUNDATION_COUNT,
    TABLEAU_COUNT, RESERVE_SIZE, BASE_W, BASE_H, MAX_UNDO
  });

})();
