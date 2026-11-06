;(function() {
  'use strict';

  /* Clock: constants and the one mutable state object (V.S) shared by
     every file of this variant. */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.clock = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const PILE_COUNT = 13; // 12 clock positions + 1 center
  const CARDS_PER_PILE = 4;
  const CENTER_PILE = 12; // index for the King/center pile

  /* ── Scaled card size for clock layout ── */
  const SCALE = 0.72;
  const CW = Math.round(CARD_W * SCALE);
  const CH = Math.round(CARD_H * SCALE);
  const CR = Math.round(CARD_RADIUS * SCALE);

  /* ── Clock geometry ── */
  const CLOCK_CX = CANVAS_W / 2;
  const CLOCK_CY = CANVAS_H / 2 - 10;
  const CLOCK_RADIUS = 210;

  /* ── Fan offset for stacked cards in each pile ── */
  const FAN_OFFSET = 3;

  /* ── Rank labels for clock positions ── */
  const PILE_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ── Buttons ── */
  const BTN_W = 100;
  const BTN_H = 32;
  const BTN_GAP = 16;
  const AUTO_BTN = { x: CANVAS_W - BTN_W - 20, y: CANVAS_H - BTN_H - 16, w: BTN_W, h: BTN_H };
  const NEXT_BTN = { x: AUTO_BTN.x - BTN_W - BTN_GAP, y: AUTO_BTN.y, w: BTN_W, h: BTN_H };

  /* ── Animation ── */
  const MOVE_DURATION = 0.3;
  const AUTO_INTERVAL = 0.45;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  V.S = {
    piles: [], // 13 piles, each an array of cards
    score: 0,
    cardsPlaced: 0, // number of cards successfully placed
    roundOver: false,
    gameOver: false,
    resultMsg: '',

    currentCard: null, // the card just flipped, waiting to be placed
    currentFromPile: -1, // pile the current card came from

    autoPlaying: false,
    autoTimer: 0,

    /* ── Move animation ── */
    animating: false,
    animCard: null,
    animFromX: 0,
    animFromY: 0,
    animToX: 0,
    animToY: 0,
    animProgress: 0,
    animCallback: null,

    hoverPile: -1,

    _ctx: null,
    _host: null,
    _canvas: null
  };

  Object.assign(V, {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, RANKS, PILE_COUNT, CARDS_PER_PILE, CENTER_PILE, CW,
    CH, CR, CLOCK_CX, CLOCK_CY, CLOCK_RADIUS, FAN_OFFSET, PILE_LABELS, AUTO_BTN, NEXT_BTN,
    MOVE_DURATION, AUTO_INTERVAL
  });

})();
