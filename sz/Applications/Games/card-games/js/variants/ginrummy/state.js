/* Gin Rummy: constants and the one mutable game state object (S). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_PLAYER_DRAW = 0;
  const PHASE_PLAYER_DISCARD = 1;
  const PHASE_AI_THINKING = 2;
  const PHASE_ROUND_REVEAL = 3;
  const PHASE_LAYOFF = 4;

  /* ── Button positions ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 20;
  const STOCK_Y = 240;
  const DISCARD_X = CANVAS_W / 2 + 20;
  const DISCARD_Y = 240;
  const KNOCK_BTN = { x: CANVAS_W / 2 - 45, y: 370, w: 90, h: 32 };

  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  SZ.CardGames.v.ginrummy = {
    CANVAS_W, CANVAS_H, PHASE_PLAYER_DRAW, PHASE_PLAYER_DISCARD, PHASE_AI_THINKING,
    PHASE_ROUND_REVEAL, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y, KNOCK_BTN,

    S: {
    /* ── Game state ── */
      playerHand: [],
      aiHand: [],
      stockPile: [],
      discardPile: [],
      score: 0,
      aiScore: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_PLAYER_DRAW,
      selectedCardIndex: -1,
      resultMsg: '',
    /* ── Round reveal state ── */
      knocker: -1, // 0 = player, 1 = AI
      isGin: false,
      playerMelds: [],
      aiMelds: [],
      playerDeadwood: [],
      aiDeadwood: [],
      layoffCards: [], // cards opponent laid off
    /* ── AI timing ── */
      aiTimer: 0,
      aiDrawn: false,
    /* ── Host references ── */
      _ctx: null,
      _host: null
    }
  };

})();
