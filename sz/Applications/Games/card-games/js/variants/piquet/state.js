/* Piquet: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const RANK_ORDER = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };

  const SUIT_SHORT = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  const HAND_SIZE = 12;
  const TALON_SIZE = 8;
  const GAME_WIN_SCORE = 100;
  const ELDER_MAX_EXCHANGE = 5;

  /* Phases */
  const PHASE_EXCHANGE = 0;
  const PHASE_DECLARE_POINT = 1;
  const PHASE_DECLARE_SEQUENCE = 2;
  const PHASE_DECLARE_SET = 3;
  const PHASE_TRICK_PLAY = 4;
  const PHASE_TRICK_DONE = 5;
  const PHASE_ROUND_OVER = 6;

  const PHASE_NAMES = [
    'Exchange', 'Declare: Point', 'Declare: Sequence',
    'Declare: Set', 'Trick Play', 'Trick Done', 'Round Over'
  ];

  /* Button areas */
  const EXCHANGE_BTN = { x: 370, y: 415, w: 120, h: 30 };
  const CONTINUE_BTN = { x: 370, y: 340, w: 120, h: 30 };

  /* ================================================================
     DRAWING - LAYOUT HELPERS
     ================================================================ */

  const PLAYER_HAND_Y = 465;

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.piquet = {
    CANVAS_W,
    CANVAS_H,
    RANK_ORDER,
    SUIT_SHORT,
    HAND_SIZE,
    TALON_SIZE,
    GAME_WIN_SCORE,
    ELDER_MAX_EXCHANGE,
    PHASE_EXCHANGE,
    PHASE_DECLARE_POINT,
    PHASE_DECLARE_SEQUENCE,
    PHASE_DECLARE_SET,
    PHASE_TRICK_PLAY,
    PHASE_TRICK_DONE,
    PHASE_ROUND_OVER,
    PHASE_NAMES,
    EXCHANGE_BTN,
    CONTINUE_BTN,
    PLAYER_HAND_Y,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      talon: [],
      deck: [],
      trickCards: [], // [{ card, player }]
      playerScore: 0,
      aiScore: 0,
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_EXCHANGE,
      dealer: 1, // 0=player, 1=AI; non-dealer (elder) acts first
      currentTurn: 0,
      trickLeader: 0,
      trickCount: 0,
      playerTricksWon: 0,
      aiTricksWon: 0,
      roundNumber: 0,
      /* Declaration tracking */
      playerDeclScore: 0,
      aiDeclScore: 0,
      declResults: [],
      declPhaseTimer: 0,
      /* Exchange state */
      selectedIndices: [],
      exchangeDone: false,
      aiExchangeDone: false,
      /* Trick done timer */
      trickDoneTimer: 0,
      trickWinnerLabel: '',
      /* AI timing */
      aiTimer: 0,
      pendingAiAction: false,
      /* Host & canvas refs */
      _ctx: null,
      _host: null,
      hoverCardIdx: -1,
      resultMsg: '',
      /* Points scored during declarations for pique/repique checks */
      playerPointsBeforeTricks: 0,
      aiPointsBeforeTricks: 0,
      /* Points scored during trick play (for lead/capture) */
      playerTrickPlayPts: 0,
      aiTrickPlayPts: 0
    }
  };

})();
