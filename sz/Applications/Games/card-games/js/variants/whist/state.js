/* Whist - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const WINNING_SCORE = 5;
  const BOOK_SIZE = 6;

  /* Players: 0=South(human), 1=West(AI), 2=North(AI partner), 3=East(AI) */
  /* Teams: NS = players 0,2   EW = players 1,3 */
  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_NS = 0;
  const TEAM_EW = 1;

  const PHASE_TRUMP_REVEAL = 0;
  const PHASE_PLAYING = 1;
  const PHASE_ROUND_OVER = 3;

  const hasSuit = T.hasSuit;

  const PLAYER_HAND_Y = 470;

  const S = {
    hands: [[], [], [], []],
    tricksWon: [0, 0, 0, 0],
    teamScores: [0, 0],
    trickCards: [],
    trickPlayers: [],
    currentTurn: 0,
    currentLead: 0,
    dealer: 0,
    trumpSuit: null,
    trumpCard: null,
    phase: PHASE_TRUMP_REVEAL,
    roundOver: false,
    gameOver: false,
    score: 0,
    trickCount: 0,
    trickWinnerDisplay: '',
    trickDisplayTimer: 0,
    hoveredCard: -1,
    statusMessage: '',
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    trumpRevealTimer: 0
  };

  SZ.CardGames.v.whist = {
    S,
    CANVAS_W, CANVAS_H, WINNING_SCORE, BOOK_SIZE, PLAYER_NAMES, TEAM_NS,
    TEAM_EW, PHASE_TRUMP_REVEAL, PHASE_PLAYING, PHASE_ROUND_OVER,
    PLAYER_HAND_Y
  };

})();
