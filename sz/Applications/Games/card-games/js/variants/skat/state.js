/* Skat - constants and the single mutable state object. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- Constants -- */
  const SKAT_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_VALUES = { '7': 0, '8': 0, '9': 0, '10': 10, 'J': 2, 'Q': 3, 'K': 4, 'A': 11 };
  const BID_VALUES = [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 46, 48, 50, 54, 59, 60];
  const PHASE_BIDDING = 0;
  const PHASE_SKAT_PICK = 1;
  const PHASE_TRUMP_PICK = 2;
  const PHASE_PLAYING = 3;

  const BID_BTN = { x: 350, y: 300, w: 80, h: 32 };
  const PASS_BTN = { x: 450, y: 300, w: 80, h: 32 };
  const SKAT_BTN = { x: 350, y: 360, w: 180, h: 32 };
  const trumpBtns = [];

  const S = {
    /* -- Game state -- */
    skatHands: [[], [], []],
    skatPile: [],
    trickCards: [],
    trickPlayers: [],
    trumpSuit: 'spades',
    deck: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    declarer: -1,
    currentTrickLead: 0,
    currentTurn: 0,
    tricksWon: [0, 0, 0],
    cardPoints: [0, 0, 0],
    trickCount: 0,
    /* -- Bidding state -- */
    phase: PHASE_BIDDING,
    bidCurrent: 0,
    bidActive: [true, true, true],
    bidWinner: -1,
    bidAmount: 0,
    bidPhaseStep: 0,
    bidMessage: '',
    /* -- Host references -- */
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v.skat = {
    S,
    CANVAS_W, CANVAS_H, SKAT_RANKS, RANK_VALUES, BID_VALUES, PHASE_BIDDING,
    PHASE_SKAT_PICK, PHASE_TRUMP_PICK, PHASE_PLAYING, BID_BTN, PASS_BTN,
    SKAT_BTN, trumpBtns
  };

})();
