/* Baccarat: layout constants and the one state object of the variant (SZ.CardGames.v.baccarat). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.baccarat = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BETTING = 'BETTING';
  const PHASE_DEALING = 'DEALING';
  const PHASE_DRAWING = 'DRAWING';
  const PHASE_RESULT = 'RESULT';

  /* ── Bet targets ── */
  const BET_PLAYER = 'player';
  const BET_BANKER = 'banker';
  const BET_TIE = 'tie';

  /* ── Chip denominations ── */

  /* ── Layout constants ── */
  const HAND_Y = 200;
  const PLAYER_HAND_X = 180;
  const BANKER_HAND_X = 530;
  const CARD_GAP = 12;
  const BET_ZONE_Y = 430;
  const BET_ZONE_W = 140;
  const BET_ZONE_H = 60;
  const BET_ZONE_GAP = 30;
  const CHIP_BTN_Y = 510;
  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 560, w: 100, h: 32 };

  const S = V.S = {
    /* ── Game state ── */
    shoe: [],
    playerHand: [],
    bankerHand: [],
    phase: PHASE_BETTING,
    betTarget: null,
    betAmount: 0,
    selectedChip: 10,
    score: 1000,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    dealTimer: 0,
    dealStep: 0,
    drawTimer: 0,
    drawStep: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DEALING, PHASE_DRAWING, PHASE_RESULT,
    BET_PLAYER, BET_BANKER, BET_TIE, HAND_Y, PLAYER_HAND_X, BANKER_HAND_X, CARD_GAP, BET_ZONE_Y,
    BET_ZONE_W, BET_ZONE_H, BET_ZONE_GAP, CHIP_BTN_Y, DEAL_BTN });

})();
