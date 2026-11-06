;(function() {
  'use strict';

  /* Pyramid: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.pyramid = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const PYRAMID_ROWS = 7;
  const PYRAMID_CARDS = 28;

  const ROW_OFFSET_Y = 38;
  const CARD_OVERLAP_X = 40;
  const PYRAMID_TOP_Y = 55;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H - CARD_H - 40;
  const WASTE_X = STOCK_X + CARD_W + 16;
  const WASTE_Y = STOCK_Y;

  const NEW_DEAL_BTN = { x: CANVAS_W / 2 - 55, y: CANVAS_H / 2 + 40, w: 110, h: 36 };
  const HINT_BTN = { x: CANVAS_W - 100, y: STOCK_Y + CARD_H / 2 - 14, w: 72, h: 28 };

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    pyramid: [], // 2D array: pyramid[row][col] = { card, removed }
    stock: [],
    waste: [],
    score: 0,
    pairsRemoved: 0,
    roundOver: false,
    gameOver: false,
    selectedCard: null, // { source, row, col } or { source: 'waste' }
    statusMsg: '',
    moveCount: 0,
    hintPair: null,
    hintTimer: 0,
    particles: [],

    _ctx: null,
    _canvas: null,
    _host: null
  };

  Object.assign(V, {
    CE, CARD_W, CARD_H, CANVAS_W, CANVAS_H, PYRAMID_ROWS, ROW_OFFSET_Y, CARD_OVERLAP_X,
    PYRAMID_TOP_Y, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, NEW_DEAL_BTN, HINT_BTN
  });

})();
