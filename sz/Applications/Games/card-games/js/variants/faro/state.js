/* Faro: layout constants and the one state object of the variant (SZ.CardGames.v.faro). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.faro = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BETTING = 'BETTING';
  const PHASE_DEALING = 'DEALING';
  const PHASE_RESULT = 'RESULT';

  /* ── Layout constants ── */
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const BOARD_X = 30;
  const BOARD_Y = 80;
  const CELL_W = 58;
  const CELL_H = 70;
  const CELL_GAP = 4;
  const CELLS_PER_ROW = 7;

  const DRAWN_X = 540;
  const DRAWN_Y = 85;
  const DRAWN_GAP = 90;

  const CASE_KEEPER_X = 550;
  const CASE_KEEPER_Y = 250;
  const CK_ROW_H = 18;

  const CHIP_DENOMINATIONS = [10, 25, 50];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422' };
  const CHIP_BTN_Y = 555;
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 30;
  const CHIP_BTN_GAP = 10;

  const DEAL_BTN = { x: 720, y: 555, w: 90, h: 30 };
  const CLEAR_BTN = { x: 620, y: 555, w: 70, h: 30 };
  const HIGHCARD_BTN = { x: 540, y: 200, w: 120, h: 30 };

  const S = V.S = {
    /* ── Game state ── */
    deck: [],
    bets: {},          // rank -> bet amount
    highCardBet: 0,
    selectedChip: 10,
    score: 500,
    phase: PHASE_BETTING,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    turnNumber: 0,
    maxTurns: 25,
    loserCard: null,
    winnerCard: null,
    caseKeeper: {},    // rank -> count remaining (0-4)
    dealTimer: 0,
    dealStep: 0,
    hoverCell: -1,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DEALING, PHASE_RESULT, RANKS,
    RANK_LABELS, BOARD_X, BOARD_Y, CELL_W, CELL_H, CELL_GAP, CELLS_PER_ROW, DRAWN_X, DRAWN_Y,
    DRAWN_GAP, CASE_KEEPER_X, CASE_KEEPER_Y, CK_ROW_H, CHIP_DENOMINATIONS, CHIP_COLORS, CHIP_BTN_Y,
    CHIP_BTN_W, CHIP_BTN_H, CHIP_BTN_GAP, DEAL_BTN, CLEAR_BTN, HIGHCARD_BTN });

})();
