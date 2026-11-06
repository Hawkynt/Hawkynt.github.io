/* Tonk: layout constants and the one mutable game state object (S). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const NUM_PLAYERS = 3;
  const WIN_SCORE = 100;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];

  /* ── Phases ── */
  const PHASE_DEAL_CHECK = 0;
  const PHASE_DRAW = 1;
  const PHASE_PLAY = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Layout positions ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 30;
  const STOCK_Y = 210;
  const DISCARD_X = CANVAS_W / 2 + 30;
  const DISCARD_Y = 210;

  const BTN_W = 90;
  const BTN_H = 30;
  const BTN_Y = 380;
  const BTN_GAP = 10;
  const BTN_START_X = CANVAS_W / 2 - (4 * BTN_W + 3 * BTN_GAP) / 2;

  const SPREAD_BTN  = { x: BTN_START_X, y: BTN_Y, w: BTN_W, h: BTN_H };
  const DROP_BTN    = { x: BTN_START_X + BTN_W + BTN_GAP, y: BTN_Y, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: BTN_START_X + 2 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };
  const TONK_BTN    = { x: BTN_START_X + 3 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };

  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  SZ.CardGames.v.tonk = {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, WIN_SCORE, PLAYER_NAMES, PHASE_DEAL_CHECK, PHASE_DRAW,
    PHASE_PLAY, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y,
    SPREAD_BTN, DROP_BTN, DISCARD_BTN, TONK_BTN,

    S: {
    /* ── Game state ── */
      hands: [[], [], []],
      stockPile: [],
      discardPile: [],
      tableMelds: [],
      scores: [0, 0, 0],
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_DEAL_CHECK,
      currentPlayer: 0,
      selectedIndices: [],
      resultMsg: '',
      tonkDeclared: false,
    /* ── AI timing ── */
      aiTimer: 0,
      aiStep: 0,
    /* ── Host references ── */
      _ctx: null,
      _host: null
    }
  };

})();
