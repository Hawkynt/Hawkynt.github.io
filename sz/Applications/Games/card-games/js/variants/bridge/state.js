/* Bridge - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const SUIT_NAMES = { clubs: 'Clubs', diamonds: 'Diamonds', hearts: 'Hearts', spades: 'Spades' };
  const STRAIN_ORDER = ['clubs', 'diamonds', 'hearts', 'spades', 'notrump'];
  const STRAIN_NAMES = { clubs: 'Clubs', diamonds: 'Diamonds', hearts: 'Hearts', spades: 'Spades', notrump: 'No Trump' };
  const STRAIN_SHORT = { clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660', notrump: 'NT' };

  const NUM_PLAYERS = 4;

  /* Players: 0=South(human), 1=West(AI), 2=North(AI partner/dummy), 3=East(AI) */
  const PLAYER_NAMES = ['South (You)', 'West', 'North', 'East'];
  const PLAYER_SHORT = ['S', 'W', 'N', 'E'];
  const SOUTH = 0;
  const WEST = 1;
  const NORTH = 2;
  const EAST = 3;

  /* Partnerships: NS = 0,2  EW = 1,3 */
  const TEAM_NS = 0;

  /* ── Phases ── */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;
  const PHASE_GAME_OVER = 4;

  const hasSuit = T.hasSuit;
  const BID_AREA_Y = 170;
  const PASS_BTN = { x: 260, y: 360, w: 80, h: 28 };

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 18;

  /* Dummy hand at top (North position) */
  const DUMMY_HAND_Y = 12;

  /* AI hand display positions */
  const AI_HAND_POS = {
    [WEST]: { x: 15, y: 180, dir: 'vertical', label: 'West' },
    [EAST]: { x: CANVAS_W - 60, y: 180, dir: 'vertical', label: 'East' }
  };

  const lightenColor = SZ.CardGames.shared.trickPaint.lightenColor;

  const S = {
    hands: [[], [], [], []],
    trickCards: [],
    trickPlayers: [],
    /* Bidding state */
    biddingPlayer: 0,
    bidHistory: [], // array of { player, bid } where bid = { level, strain } or 'pass'
    consecutivePasses: 0,
    contractBid: null, // { level, strain }
    contractPlayer: -1, // declarer
    dummyPlayer: -1,
    defendingLead: -1,
    /* Play state */
    currentTurn: 0,
    trickLeader: 0,
    trickCount: 0,
    tricksWonNS: 0,
    tricksWonEW: 0,
    trumpSuit: null, // null for no trump
    /* Scoring */
    nsAboveLine: 0,
    nsBelow: 0,
    ewAboveLine: 0,
    ewBelow: 0,
    nsGamesWon: 0,
    ewGamesWon: 0,
    nsVulnerable: false,
    ewVulnerable: false,
    dealer: SOUTH,
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
    hoveredBidBtn: -1,
    hoveredPassBtn: false,
    statusMessage: '',
    dummyRevealed: false,
    openingLeadMade: false
  };

  SZ.CardGames.v.bridge = {
    S,
    CANVAS_W, CANVAS_H, SUIT_NAMES, STRAIN_ORDER, STRAIN_SHORT,
    NUM_PLAYERS, PLAYER_NAMES, PLAYER_SHORT, SOUTH, WEST, NORTH, EAST,
    TEAM_NS, PHASE_BIDDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_OVER, PHASE_GAME_OVER, BID_AREA_Y, PASS_BTN, PLAYER_HAND_Y,
    DUMMY_HAND_Y, AI_HAND_POS
  };

})();
