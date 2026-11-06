/* Texas Hold'em: layout constants and the one state object of the variant (SZ.CardGames.v.holdem). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.holdem = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const STARTING_CHIPS = 1000;
  const SMALL_BLIND = 10;
  const BIG_BLIND = 20;
  const BLUFF_CHANCE = 0.15;

  const PLAYER_NAMES = ['You', 'Left', 'Top', 'Right'];

  const RANK_VALUE = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const HAND_RANKS = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_KIND: 3,
    STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR_KIND: 7,
    STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
  };

  const HAND_NAMES = [
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind',
    'Straight Flush', 'Royal Flush'
  ];

  /* ── Phases ── */
  const PHASE_PREFLOP = 0;
  const PHASE_FLOP = 1;
  const PHASE_TURN = 2;
  const PHASE_RIVER = 3;
  const PHASE_SHOWDOWN = 4;
  const PHASE_ROUND_OVER = 5;

  const PHASE_NAMES = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown', ''];

  /* ── Layout ── */
  const COMMUNITY_Y = 220;
  const COMMUNITY_START_X = (CANVAS_W - 5 * CE.CARD_W - 4 * 8) / 2;
  const CARD_GAP = 8;

  const PLAYER_POSITIONS = [
    { x: CANVAS_W / 2, y: CANVAS_H - 130, labelY: CANVAS_H - 140, align: 'bottom' },
    { x: 80, y: 280, labelY: 250, align: 'left' },
    { x: CANVAS_W / 2, y: 40, labelY: 30, align: 'top' },
    { x: CANVAS_W - 80 - CE.CARD_W, y: 280, labelY: 250, align: 'right' }
  ];

  /* ── Button layout ── */
  const BTN_W = 90;
  const BTN_H = 34;
  const BTN_Y = CANVAS_H - 50;
  const BTN_GAP = 10;
  const AI_TURN_DELAY = 0.8;
  const SHOWDOWN_DELAY = 2.5;

  const S = V.S = {
    deck: [],
    community: [],
    holeCards: [[], [], [], []],
    chips: [0, 0, 0, 0],
    bets: [0, 0, 0, 0],
    folded: [false, false, false, false],
    allIn: [false, false, false, false],
    eliminated: [false, false, false, false],
    pot: 0,
    sidePots: [],
    dealerIdx: 0,
    currentTurn: 0,
    phase: PHASE_PREFLOP,
    roundOver: false,
    gameOver: false,
    score: STARTING_CHIPS,
    currentBet: 0,
    minRaise: BIG_BLIND,
    raiseAmount: BIG_BLIND,
    lastRaiser: -1,
    actedThisRound: [],
    showdownRevealed: false,
    resultMessage: '',
    handRankText: '',
    hoverBtn: -1,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    showdownTimer: 0,
    _cachedButtons: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, NUM_PLAYERS, STARTING_CHIPS, SMALL_BLIND, BIG_BLIND,
    BLUFF_CHANCE, PLAYER_NAMES, RANK_VALUE, HAND_RANKS, HAND_NAMES, PHASE_PREFLOP, PHASE_FLOP,
    PHASE_TURN, PHASE_RIVER, PHASE_SHOWDOWN, PHASE_ROUND_OVER, PHASE_NAMES, COMMUNITY_Y,
    COMMUNITY_START_X, CARD_GAP, PLAYER_POSITIONS, BTN_W, BTN_H, BTN_Y, BTN_GAP, AI_TURN_DELAY,
    SHOWDOWN_DELAY });

})();
