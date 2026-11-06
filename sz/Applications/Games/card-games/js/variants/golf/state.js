;(function() {
  'use strict';

  /* Golf: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.golf = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const COLUMN_COUNT = 7;
  const CARDS_PER_COLUMN = 5;
  const CARD_OVERLAP = 25;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const MAX_UNDO = 100;

  /* ================================================================
   *  LAYOUT
   * ================================================================ */

  const COLUMN_GAP = 12;
  const TOTAL_COLUMNS_W = COLUMN_COUNT * CARD_W + (COLUMN_COUNT - 1) * COLUMN_GAP;
  const COLUMNS_LEFT = (CANVAS_W - TOTAL_COLUMNS_W) / 2;
  const COLUMNS_TOP = 30;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H - CARD_H - 40;
  const WASTE_X = STOCK_X + CARD_W + 20;
  const WASTE_Y = STOCK_Y;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    columns: [],
    stock: [],
    waste: [],
    score: 0,
    cardsCleared: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    moveCount: 0,
    undoHistory: [],

    hoverCol: -1,

    animatingCards: [],
    particles: [],

    _ctx: null,
    _host: null,
    _canvas: null
  };

  Object.assign(V, {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, CARD_RADIUS, COLUMN_COUNT, CARDS_PER_COLUMN,
    CARD_OVERLAP, RANKS, MAX_UNDO, COLUMN_GAP, COLUMNS_LEFT, COLUMNS_TOP, STOCK_X, STOCK_Y,
    WASTE_X, WASTE_Y
  });

})();
