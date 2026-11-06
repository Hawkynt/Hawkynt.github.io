/* Yaniv: constants and the one mutable game state object (S). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const NUM_PLAYERS = 4;
  const YANIV_THRESHOLD = 7;
  const ELIMINATION_SCORE = 200;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2', 'AI-3'];

  /* ── Phases ── */
  const PHASE_DISCARD = 0;
  const PHASE_DRAW = 1;
  const PHASE_AI_THINKING = 2;
  const PHASE_YANIV_REVEAL = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Layout constants ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 40;
  const STOCK_Y = (CANVAS_H - CE.CARD_H) / 2;
  const DISCARD_X = CANVAS_W / 2 + 40;
  const DISCARD_Y = (CANVAS_H - CE.CARD_H) / 2;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 28;

  const BTN_W = 90;
  const BTN_H = 30;
  const DISCARD_BTN = { x: CANVAS_W / 2 - BTN_W - 10, y: CANVAS_H - 60, w: BTN_W, h: BTN_H };
  const YANIV_BTN = { x: CANVAS_W / 2 + 10, y: CANVAS_H - 60, w: BTN_W, h: BTN_H };
  const REVEAL_DELAY = 2.5;

  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  SZ.CardGames.v.yaniv = {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, YANIV_THRESHOLD, ELIMINATION_SCORE, PLAYER_NAMES,
    PHASE_DISCARD, PHASE_DRAW, PHASE_AI_THINKING, PHASE_YANIV_REVEAL, PHASE_ROUND_OVER, STOCK_X,
    STOCK_Y, DISCARD_X, DISCARD_Y, PLAYER_HAND_Y, DISCARD_BTN, YANIV_BTN, REVEAL_DELAY,

    S: {
    /* ================================================================
       GAME STATE
       ================================================================ */
      hands: [[], [], [], []],
      stockPile: [],
      discardGroup: [], // last discarded group (array of cards)
      cumulativeScores: [0, 0, 0, 0],
      eliminated: [false, false, false, false],
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_DISCARD,
      currentPlayer: 0,
      selectedIndices: [], // toggled card indices in player hand
      resultMsg: '',
      yanivCaller: -1,
      assafTriggered: false,
    /* ── AI timing ── */
      aiTimer: 0,
      aiStep: 0, // 0=discard, 1=draw
    /* ── Yaniv reveal timer ── */
      revealTimer: 0,
    /* ── Host references ── */
      _ctx: null,
      _host: null
    }
  };

})();
