/* Spades - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Suits & Ranks (game-specific ordering) ── */
  const SUIT_NAMES = T.SUIT_NAMES;
  const TRUMP_SUIT = 'spades';

  /* ── Players: 0=South(human), 1=West(AI), 2=North(AI partner), 3=East(AI) ── */
  /* Teams: NS = players 0,2   EW = players 1,3 */
  const PLAYER_NAMES = ['You', 'West', 'Partner', 'East'];
  const TEAM_NS = 0;
  const TEAM_EW = 1;

  /* ── Phases ── */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_ROUND_OVER = 3;

  const PLAYER_HAND_Y = 470;
  const PLAYER_HAND_START = 100;
  const BID_ROWS = [
    { start: 0, end: 7 },
    { start: 7, end: 14 }
  ];

  const S = {
    /* ── Game state ── */
    hands: [[], [], [], []],
    bids: [0, 0, 0, 0],
    bidsDone: [false, false, false, false],
    tricksWon: [0, 0, 0, 0],
    teamScores: [0, 0],
    teamBags: [0, 0],
    trickCards: [],
    trickPlayers: [],
    currentTurn: 0,
    currentLead: 0,
    spadesBroken: false,
    phase: PHASE_BIDDING,
    biddingPlayer: 0,
    roundOver: false,
    gameOver: false,
    score: 0,
    trickCount: 0,
    trickWinnerDisplay: '',
    trickDisplayTimer: 0,
    selectedCard: -1,
    hoveredCard: -1,
    hoveredBid: -1,
    statusMessage: '',
    /* ── Host references ── */
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v.spades = {
    S,
    CANVAS_W, CANVAS_H, TRUMP_SUIT, PLAYER_NAMES, TEAM_NS, TEAM_EW,
    PHASE_BIDDING, PHASE_PLAYING, PHASE_ROUND_OVER, PLAYER_HAND_Y
  };

})();
