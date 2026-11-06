/* Mau-Mau: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const RANK_POINTS = { 'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 20, 'Q': 10, 'K': 10 };
  const AI_TURN_DELAY = 1.0;

  const SUIT_BTN_SIZE = 60;
  const SUIT_BTN_GAP = 16;
  const suitChoiceRects = [];

  /* ================================================================
     DRAWING - LAYOUT CONSTANTS
     ================================================================ */

  const HAND_Y = 440;
  const HAND_X_START = 80;
  const HAND_SPACING = 55;
  const AI_HAND_Y = 20;
  const AI_HAND_X_START = 80;
  const AI_HAND_SPACING = 20;
  const DISCARD_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const DISCARD_Y = 240;
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 30;
  const STOCK_Y = 240;

  const S = {
    /* ── Game state ── */
    hands: [[], []],
    stock: [],
    discardPile: [],
    currentPlayer: 0,
    score: 0,
    roundOver: false,
    gameOver: false,
    drawObligation: 0,
    skipNext: false,
    extraTurn: false,
    chosenSuit: null,
    waitingForSuitChoice: false,
    pendingJackPlayer: -1,
    mauAnnounced: [false, false],
    mauMauAnnounced: [false, false],

    /* ── Host references ── */
    _ctx: null,
    _host: null,

    /* ── AI timer ── */
    aiTurnTimer: 0
  };

  SZ.CardGames.v['maumau'] = { S, CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, RANK_POINTS, AI_TURN_DELAY, SUIT_BTN_SIZE, SUIT_BTN_GAP, suitChoiceRects, HAND_Y, HAND_X_START, HAND_SPACING, AI_HAND_Y, AI_HAND_X_START, AI_HAND_SPACING, DISCARD_X, DISCARD_Y, STOCK_X, STOCK_Y };

})();
