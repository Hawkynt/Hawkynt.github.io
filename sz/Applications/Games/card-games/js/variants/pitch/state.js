/* Pitch - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const SUIT_NAMES = T.SUIT_NAMES;
  const SUIT_SYMBOLS = T.SUIT_SYMBOLS;
  const STRENGTH_ORDER = T.STRENGTH_ORDER;

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 6;
  const WIN_SCORE = 11;

  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  /* -- Phases -- */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_SCORE = 3;
  const PHASE_GAME_OVER = 4;

  const hasSuit = T.hasSuit;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  const S = {
    hands: [[], [], [], []],
    trumpSuit: null,
    bidder: -1,
    bidAmount: 0,
    playerBids: [0, 0, 0, 0], // 0 = passed
    playerBidDone: [false, false, false, false],
    biddingPlayer: 0,
    dealer: 0,
    currentTurn: 0,
    trickLeader: 0,
    trickCards: [],
    trickPlayers: [],
    trickCount: 0,
    capturedCards: [[], [], [], []], // cards won by each player
    playerScores: [0, 0, 0, 0], // cumulative scores
    roundOver: false,
    gameOver: false,
    score: 0,
    phase: PHASE_BIDDING,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoveredCard: -1,
    hoveredBtn: '',
    roundMessages: []
  };

  SZ.CardGames.v.pitch = {
    S,
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, STRENGTH_ORDER,
    NUM_PLAYERS, HAND_SIZE, WIN_SCORE, PLAYER_NAMES, PHASE_BIDDING,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_SCORE, PHASE_GAME_OVER,
    PLAYER_HAND_Y
  };

})();
