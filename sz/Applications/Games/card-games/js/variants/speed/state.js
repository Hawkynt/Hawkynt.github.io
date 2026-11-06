/* Speed: layout constants and the one state object of the variant (SZ.CardGames.v.speed). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.speed = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const HAND_SIZE = 5;
  const DRAW_PILE_SIZE = 18;
  const RESERVE_SIZE = 3;
  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;

  /* ── AI timing ── */
  const AI_MIN_DELAY = 0.4;
  const AI_MAX_DELAY = 0.8;

  /* ── Layout ── */
  const CENTER_Y = CANVAS_H / 2 - CARD_H / 2;
  const CENTER_GAP = 30;
  const CENTER_LEFT_X = CANVAS_W / 2 - CARD_W - CENTER_GAP / 2;
  const CENTER_RIGHT_X = CANVAS_W / 2 + CENTER_GAP / 2;

  const PLAYER_HAND_Y = CANVAS_H - CARD_H - 40;
  const AI_HAND_Y = 40;

  const PLAYER_DRAW_X = 40;
  const PLAYER_DRAW_Y = PLAYER_HAND_Y;
  const AI_DRAW_X = 40;
  const AI_DRAW_Y = AI_HAND_Y;

  const RESERVE_LEFT_X = 60;
  const RESERVE_RIGHT_X = CANVAS_W - 60 - CARD_W;
  const RESERVE_Y = CENTER_Y;

  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: CENTER_Y + CARD_H + 16, w: 100, h: 32 };
  const STUCK_CHECK_INTERVAL = 0.6;

  const S = V.S = {
    playerHand: [],
    playerDraw: [],
    playerReserve: [],
    aiHand: [],
    aiDraw: [],
    aiReserve: [],
    centerPiles: [[], []], // two center piles (arrays of cards, top = last)
    score: 0,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    /* ── Selection ── */
    selectedIndex: -1, // index in playerHand, -1 = none
    /* ── AI timer ── */
    aiTimer: 0,
    aiDelay: 0,
    /* ── Stuck detection ── */
    showFlipButton: false,
    stuckCheckTimer: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, HAND_SIZE, DRAW_PILE_SIZE, RESERVE_SIZE, CARD_W, CARD_H,
    AI_MIN_DELAY, AI_MAX_DELAY, CENTER_Y, CENTER_LEFT_X, CENTER_RIGHT_X, PLAYER_HAND_Y, AI_HAND_Y,
    PLAYER_DRAW_X, PLAYER_DRAW_Y, AI_DRAW_X, AI_DRAW_Y, RESERVE_LEFT_X, RESERVE_RIGHT_X, RESERVE_Y,
    FLIP_BTN, STUCK_CHECK_INTERVAL });

})();
