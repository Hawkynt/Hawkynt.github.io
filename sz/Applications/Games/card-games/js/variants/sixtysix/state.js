/* Sixty-Six - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const TOTAL_CARD_POINTS = 120;
  const TARGET_POINTS = 66;
  const MATCH_TARGET = 7;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_ROUND_OVER = 2;

  /* Close button layout */
  const CLOSE_BTN = { x: 20, y: 420, w: 80, h: 30 };

  /* Marriage button layout */
  const MARRIAGE_BTN = { x: 20, y: 460, w: 100, h: 30 };

  const S = {
    playerHand: [],
    aiHand: [],
    stock: [],
    trumpCard: null,
    trumpSuit: '',
    trickCards: [],
    trickPlayers: [],
    playerCaptured: [],
    aiCaptured: [],
    playerTrickPoints: 0,
    aiTrickPoints: 0,
    playerTricksTaken: 0,
    aiTricksTaken: 0,
    trickCount: 0,
    currentTurn: 0, // 0=player, 1=ai
    trickLeader: 0,
    phase: PHASE_PLAY,
    trickWinner: -1,
    trickDoneTimer: 0,
    stockClosed: false,
    closedBy: -1, // who closed the stock (-1 = nobody)
    stockClosedPointsAtClose: [0, 0], // points when stock was closed
    playerGamePoints: 0,
    aiGamePoints: 0,
    score: 0,
    roundOver: false,
    gameOver: false,
    matchOver: false,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoverCardIdx: -1,
    /* Marriage declaration state */
    marriagePending: false, // player can declare a marriage this turn
    marriageSuit: '', // suit of pending marriage
    marriageShownTimer: 0, // visual feedback timer
    marriageShownSuit: '', // suit being shown
    marriageShownBy: -1, // who declared it
    aiDeclaredMarriage: false // flag for AI marriage declaration this turn
  };

  SZ.CardGames.v.sixtysix = {
    S,
    CANVAS_W, CANVAS_H, TARGET_POINTS, MATCH_TARGET, PHASE_PLAY,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, CLOSE_BTN, MARRIAGE_BTN
  };

})();
