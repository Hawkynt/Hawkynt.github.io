/* Schwimmen: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Button layout ── */
  const BTN_W = 100;
  const BTN_H = 34;
  const BTN_Y = CANVAS_H - 55;
  const BTN_GAP = 12;
  const BTN_START_X = CANVAS_W / 2 - (3 * BTN_W + 2 * BTN_GAP) / 2;

  const SWAP1_BTN = { x: BTN_START_X, y: BTN_Y, w: BTN_W, h: BTN_H };
  const SWAP_ALL_BTN = { x: BTN_START_X + BTN_W + BTN_GAP, y: BTN_Y, w: BTN_W, h: BTN_H };
  const KNOCK_BTN = { x: BTN_START_X + 2 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.schwimmen = {
    CANVAS_W,
    CANVAS_H,
    BTN_W,
    BTN_H,
    BTN_Y,
    BTN_GAP,
    BTN_START_X,
    SWAP1_BTN,
    SWAP_ALL_BTN,
    KNOCK_BTN,
    S: {
      hands: [[], [], [], []],
      pool: [],
      lives: [3, 3, 3, 3],
      eliminated: [false, false, false, false],
      currentTurn: 0,
      hasKnocked: -1,
      knockFinalTurns: 0,
      roundOver: false,
      gameOver: false,
      score: 0,
      resultMsg: '',
      /* ── Swap-1 interaction state ── */
      selectedHandCard: -1,
      selectedPoolCard: -1,
      swapMode: 'none', // 'none' | 'swap1' | 'swapAll' | 'knock'
      /* ── Host references ── */
      _ctx: null,
      _host: null,
      aiTurnTimer: 0
    }
  };

})();
