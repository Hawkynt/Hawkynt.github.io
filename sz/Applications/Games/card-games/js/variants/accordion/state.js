;(function() {
  'use strict';

  /* Accordion: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.accordion = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ================================================================
   *  LAYOUT — wrapped grid, 13 cards per row
   * ================================================================ */

  const COLS = 13;
  const MAX_ROWS = 5;
  const H_GAP = 2;
  const V_GAP = 6;
  const TOTAL_ROW_W = COLS * CARD_W + (COLS - 1) * H_GAP;
  const GRID_LEFT = (CANVAS_W - TOTAL_ROW_W) / 2;
  const GRID_TOP = 50;
  const MAX_UNDO = 200;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    piles: [], // array of arrays; each sub-array is a pile (top card = last element)
    selected: -1, // index into piles[] of the selected pile, or -1
    score: 0,
    moveCount: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    undoHistory: [],

    hoverIdx: -1,

    animatingCards: [],
    particles: [],

    _ctx: null,
    _host: null,
    _canvas: null
  };

  Object.assign(V, {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, CARD_RADIUS, RANKS, COLS, H_GAP, V_GAP, GRID_LEFT,
    GRID_TOP, MAX_UNDO
  });

})();
