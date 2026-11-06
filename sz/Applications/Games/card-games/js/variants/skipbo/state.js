/* Skip-Bo: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const AI_TURN_DELAY = 0.8;

  /* ── Layout constants ── */
  const SB_BUILD_Y = 130;
  const SB_BUILD_X = 310;
  const SB_HAND_Y = 340;
  const SB_HAND_X = 200;
  const SB_DISCARD_Y = 460;
  const SB_DISCARD_X = 200;
  const SB_STOCK_X = 60;
  const SB_STOCK_Y = 340;
  const SB_ENDTURN_BTN = { x: 590, y: 468, w: 100, h: 32 };

  const S = {
    /* ── Game state ── */
    skipBoStockPiles: [[], []],
    skipBoBuildPiles: [[], [], [], []],
    skipBoDiscardPiles: [[], [], [], []],
    skipBoSelectedCard: -1,
    skipBoSelectedSource: null,
    skipBoPlayerTurn: true,
    playerHand: [],
    aiHands: [[]],
    deck: [],
    score: 0,
    roundOver: false,
    gameOver: false,

    /* ── Host references ── */
    _ctx: null,
    _host: null,

    /* ── AI timer ── */
    aiTurnTimer: 0
  };

  SZ.CardGames.v['skipbo'] = { S, CANVAS_W, CANVAS_H, AI_TURN_DELAY, SB_BUILD_Y, SB_BUILD_X, SB_HAND_Y, SB_HAND_X, SB_DISCARD_Y, SB_DISCARD_X, SB_STOCK_X, SB_STOCK_Y, SB_ENDTURN_BTN };

})();
