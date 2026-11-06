/* Oh Hell - constants and the single mutable state object. */
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

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  /* Round sequence: 1,2,3,4,5,6,7,6,5,4,3,2,1 = 13 rounds */
  const MAX_HAND = 7;
  const ROUND_SIZES = [];
  for (let i = 1; i <= MAX_HAND; ++i) ROUND_SIZES.push(i);
  for (let i = MAX_HAND - 1; i >= 1; --i) ROUND_SIZES.push(i);
  const TOTAL_ROUNDS = ROUND_SIZES.length;

  /* Phases */
  const PHASE_BIDDING = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_DONE = 2;
  const PHASE_ROUND_OVER = 3;

  const hasSuit = T.hasSuit;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 20;

  const S = {
    hands: [[], [], [], []],
    bids: [-1, -1, -1, -1],
    bidsDone: [false, false, false, false],
    tricksWon: [0, 0, 0, 0],
    cumulativeScores: [0, 0, 0, 0],
    trickCards: [],
    trickPlayers: [],
    trumpCard: null,
    trumpSuit: null,
    currentTurn: 0,
    trickLeader: 0,
    trickCount: 0,
    handSize: 1,
    roundIndex: 0,
    dealer: 0,
    biddingPlayer: 0,
    totalBidsSoFar: 0,
    phase: PHASE_BIDDING,
    roundOver: false,
    gameOver: false,
    score: 0,
    trickWinnerIdx: -1,
    trickDoneTimer: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoveredCard: -1,
    hoveredBid: -1
  };

  SZ.CardGames.v.ohhell = {
    S,
    CANVAS_W, CANVAS_H, SUIT_NAMES, NUM_PLAYERS, PLAYER_NAMES, ROUND_SIZES,
    TOTAL_ROUNDS, PHASE_BIDDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_OVER, PLAYER_HAND_Y
  };

})();
