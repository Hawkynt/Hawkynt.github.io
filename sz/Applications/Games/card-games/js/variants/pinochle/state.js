/* Pinochle - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 12;
  const MIN_BID = 20;
  const BID_STEP = 5;
  const GAME_WIN_SCORE = 1500;

  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_A = 0;
  const TEAM_B = 1;

  /* Phases */
  const PHASE_BIDDING = 0;
  const PHASE_TRUMP_SELECT = 1;
  const PHASE_MELDING = 2;
  const PHASE_PLAYING = 3;
  const PHASE_TRICK_DONE = 4;
  const PHASE_ROUND_SCORE = 5;

  const hasSuit = T.hasSuit;

  const PLAYER_HAND_Y = 470;

  const S = {
    hands: [[], [], [], []],
    trickCards: [],
    trickPlayers: [],
    teamScores: [0, 0],
    meldPoints: [0, 0, 0, 0],
    trickPointsWon: [0, 0],
    tricksWon: [0, 0],
    score: 0,
    roundOver: false,
    gameOver: false,
    phase: PHASE_BIDDING,
    trumpSuit: null,
    dealer: 0,
    currentBidder: 0,
    highBid: 0,
    highBidder: -1,
    passCount: 0,
    bidPassed: [false, false, false, false],
    currentTurn: 0,
    trickLeader: 0,
    trickCount: 0,
    roundNumber: 0,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    meldDisplayTimer: 0,
    meldResults: [],
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoverCardIdx: -1,
    hoverBidBtn: -1,
    hoveredTrumpSuit: null
  };

  SZ.CardGames.v.pinochle = {
    S,
    CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, MIN_BID, BID_STEP,
    GAME_WIN_SCORE, PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_BIDDING,
    PHASE_TRUMP_SELECT, PHASE_MELDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_SCORE, hasSuit, PLAYER_HAND_Y
  };

})();
