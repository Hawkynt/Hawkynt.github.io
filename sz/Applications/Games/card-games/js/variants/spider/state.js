;(function() {
  'use strict';

  /* Spider: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.spider = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const FACE_DOWN_OFFSET = 5;
  const FACE_UP_OFFSET = 20;
  const MARGIN_X = 8;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 10;
  const FOUNDATION_TOTAL = 8;

  const BASE_W = MARGIN_X * 2 + TABLEAU_COUNT * CARD_W + (TABLEAU_COUNT - 1) * 10;
  const BASE_H = 500;

  /* ================================================================
   *  MODULE STATE
   * ================================================================ */

  V.S = {
    _ctx: null,
    _canvas: null,
    _host: null,
    canvasW: 900,
    canvasH: 600,
    scale: 1,

    stock: [],
    tableau: [],
    completedSuits: 0,
    suitCount: 1,
    moveCount: 0,
    score: 500,
    timerSeconds: 0,
    timerInterval: null,
    gameStarted: false,
    gameWon: false,
    undoHistory: [],

    completionAnim: null,
    winAnimCards: [],
    winAnimRunning: false,
    winAnimId: null,
    particles: [],
    lastFireworkTime: 0,

    flippingCards: [],
    dealAnimCards: [],

    dragging: null,
    lastClickTime: 0,
    lastClickHit: null,
    pointerStartX: 0,
    pointerStartY: 0,

    statusMsg: '',

    winLaunchInterval: null
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, FACE_DOWN_OFFSET, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, TABLEAU_COUNT,
    FOUNDATION_TOTAL, BASE_W, BASE_H
  });

})();
