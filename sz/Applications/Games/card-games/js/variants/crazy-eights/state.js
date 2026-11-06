/* Crazy Eights: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Suit display names ── */
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const MAX_DRAWS = 3;
  const AI_TURN_DELAY = 1.0;

  /* ── Target score ── */
  const WIN_SCORE = 200;

  /* ── Button positions ── */
  const DRAW_BTN = { x: CANVAS_W / 2 + 80, y: 270, w: 90, h: 36 };
  const PASS_BTN = { x: CANVAS_W / 2 + 80, y: 312, w: 90, h: 30 };

  const SUIT_BTN_SIZE = 70;
  const SUIT_BTN_GAP = 16;
  const suitChoiceRects = [];

  const S = {
    /* ── Game state ── */
    playerHand: [],
    aiHand: [],
    stock: [],
    discardPile: [],
    currentSuit: null,
    playerTurn: true,
    drawCount: 0,
    score: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',

    /* ── Suit chooser overlay ── */
    waitingForSuitChoice: false,
    pendingSuitPlayer: -1,

    /* ── Host references ── */
    _ctx: null,
    _host: null,

    /* ── AI timer ── */
    aiTurnTimer: 0
  };

  SZ.CardGames.v['crazy-eights'] = { S, CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, MAX_DRAWS, AI_TURN_DELAY, WIN_SCORE, DRAW_BTN, PASS_BTN, SUIT_BTN_SIZE, SUIT_BTN_GAP, suitChoiceRects };

})();
