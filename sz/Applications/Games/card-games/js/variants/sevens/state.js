/* Sevens: layout constants and the one state object of the variant (SZ.CardGames.v.sevens). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sevens = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const SUITS = CE ? CE.SUITS : ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_DISPLAY = ['spades', 'hearts', 'diamonds', 'clubs'];

  const GAME_OVER_THRESHOLD = 100;
  const AI_TURN_DELAY = 0.7;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 22;
  const SMALL_W = CE.CARD_W * 0.5;
  const SMALL_H = CE.CARD_H * 0.5;

  const ROW_TOP = 140;
  const ROW_SPACING = 80;
  const CARD_SPACING = 28;    // horizontal spacing for placed cards in row

  const PASS_BTN = { x: CANVAS_W / 2 - 50, y: PLAYER_HAND_Y - 36, w: 100, h: 28 };

  /* AI hand positions */
  const AI_POS = [
    null,
    { x: 12, y: 150, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 160, y: 8, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 12 - SMALL_W, y: 150, dir: 'vertical', label: 'East' }
  ];

  const S = V.S = {
    hands: [[], [], [], []],
    suitRows: {},            // { suit: { low: rankIdx, high: rankIdx } }
    placedCards: {},          // { suit: Set of rankIdx }
    cumulativeScores: [0, 0, 0, 0],
    roundScores: [0, 0, 0, 0],
    score: 0,
    roundOver: false,
    gameOver: false,
    roundNumber: 0,
    currentTurn: 0,
    passCount: 0,            // consecutive passes (informational)
    totalPasses: [0, 0, 0, 0],
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,
    hoverCardIdx: -1,
    hoverPassBtn: false
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, RANKS, SUIT_SYMBOLS,
    SUIT_DISPLAY, GAME_OVER_THRESHOLD, AI_TURN_DELAY, PLAYER_HAND_Y, SMALL_W, SMALL_H, ROW_TOP,
    ROW_SPACING, CARD_SPACING, PASS_BTN, AI_POS });

})();
