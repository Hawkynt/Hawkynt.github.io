/* Kalooki: constants and the one mutable game state object (S). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const NUM_PLAYERS = 3;
  const INITIAL_MELD_MIN = 51;
  const PENALTY_LIMIT = 200;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];

  /* ── Phases ── */
  const PHASE_DRAW = 0;
  const PHASE_MELD = 1;
  const PHASE_DISCARD = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Layout ── */
  const STOCK_X = 30;
  const STOCK_Y = 220;
  const DISCARD_X = 130;
  const DISCARD_Y = 220;

  const BTN_W = 80;
  const BTN_H = 28;
  const MELD_BTN = { x: 30, y: 345, w: BTN_W, h: BTN_H };
  const LAYOFF_BTN = { x: 120, y: 345, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: 210, y: 345, w: BTN_W, h: BTN_H };

  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  SZ.CardGames.v.kalooki = {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, INITIAL_MELD_MIN, PENALTY_LIMIT, PLAYER_NAMES, PHASE_DRAW,
    PHASE_MELD, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y,
    MELD_BTN, LAYOFF_BTN, DISCARD_BTN,

    S: {
    /* ══════════════════════════════════════════════════════════════════
       GAME STATE
       ══════════════════════════════════════════════════════════════════ */
      hands: [[], [], []],
      stockPile: [],
      discardPile: [],
      tableMelds: [], // [{cards:[], owner:int}]
      cumulScores: [0, 0, 0], // cumulative penalties per player
      hasMelded: [false, false, false], // initial meld tracker
      noPriorMelds: [true, true, true], // kalooki tracker (never melded before this turn)
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_DRAW,
      currentPlayer: 0,
      selectedIndices: [],
      resultMsg: '',
      aiTimer: 0,
      aiStep: 0, // 0=draw, 1=meld/layoff, 2=discard
      drewFromDiscard: false,
      _ctx: null,
      _host: null
    }
  };

})();
